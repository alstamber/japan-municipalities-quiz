import { useEffect, useMemo, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from "d3-zoom";
import { feature, mesh } from "topojson-client";
import type { GeometryObject } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { MAP_TOPOLOGY, MAP_MARKER_FALLBACKS, LAKES } from "../data/map.generated";
import { MUNICIPALITIES } from "../data/municipalities.generated";
import { formatMunicipalityName } from "../lib/format";
import { StatsBar } from "./StatsBar";
import { ResultSummary } from "./ResultSummary";
import { MapShape } from "./MapShape";
import { MapMarker } from "./MapMarker";
import type { EntryStatus } from "../types";

interface Props {
  status: Record<string, EntryStatus>;
  startedAt: number;
  finishedAt: number | null;
  pausedAt: number | null;
  pausedDurationMs: number;
  solvedCount: number;
  total: number;
  wrongCount: number;
  onRetryWrong: () => void;
  onStartFull: () => void;
  focusPrefCode: string | null;
}

const WIDTH = 480;
const HEIGHT = 520;
const SCALE_EXTENT: [number, number] = [1, 24];

interface ShapeDatum {
  cityCode: string;
  d: string;
  title: string;
}

interface MarkerDatum {
  cityCode: string;
  x: number;
  y: number;
  title: string;
}

type Bounds = [[number, number], [number, number]];

function extendBounds(bounds: Bounds | undefined, [x, y]: [number, number]): Bounds {
  if (!bounds) return [[x, y], [x, y]];
  return [
    [Math.min(bounds[0][0], x), Math.min(bounds[0][1], y)],
    [Math.max(bounds[1][0], x), Math.max(bounds[1][1], y)],
  ];
}

function mergeBounds(a: Bounds | undefined, b: Bounds): Bounds {
  if (!a) return b;
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

export function JapanMap({
  status,
  startedAt,
  finishedAt,
  pausedAt,
  pausedDurationMs,
  solvedCount,
  total,
  wrongCount,
  onRetryWrong,
  onStartFull,
  focusPrefCode,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGroupRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const nameByCode = useMemo(() => new Map(MUNICIPALITIES.map((m) => [m.cityCode, m])), []);

  // Geometry never changes at runtime, so the projection and every path's `d`
  // string are computed exactly once, independent of `status`.
  const { shapes, markers, prefBorderPath, lakePaths, prefBounds } = useMemo(() => {
    const collection = feature(
      MAP_TOPOLOGY,
      MAP_TOPOLOGY.objects.municipalities,
    ) as unknown as FeatureCollection<Geometry, { cityCode: string; prefCode: string }>;

    const projection = geoMercator().fitSize([WIDTH, HEIGHT], collection);
    const path = geoPath(projection);

    const shapes: ShapeDatum[] = collection.features.map((f) => ({
      cityCode: f.properties.cityCode,
      d: path(f) ?? "",
      title: formatMunicipalityName(nameByCode.get(f.properties.cityCode)),
    }));

    const markers: MarkerDatum[] = MAP_MARKER_FALLBACKS.map((m) => {
      const projected = projection([m.lng, m.lat]);
      return {
        cityCode: m.cityCode,
        x: projected?.[0] ?? 0,
        y: projected?.[1] ?? 0,
        title: formatMunicipalityName(nameByCode.get(m.cityCode)),
      };
    });

    // Lines where the two municipalities on either side belong to different
    // prefectures (or there's no municipality on one side, i.e. coastline) —
    // drawn as a separate, thicker layer on top of the municipality borders.
    const prefMesh = mesh(MAP_TOPOLOGY, MAP_TOPOLOGY.objects.municipalities as unknown as GeometryObject, (a, b) => {
      const aPref = (a as unknown as { properties: { prefCode: string } }).properties?.prefCode;
      const bPref = (b as unknown as { properties: { prefCode: string } } | undefined)?.properties?.prefCode;
      return !b || aPref !== bPref;
    });
    const prefBorderPath = path(prefMesh) ?? "";

    // Decorative only: these lakes' surfaces are already part of the
    // surrounding municipalities' polygons above, so they're drawn on top as
    // a separate water-colored layer purely so they're visually recognizable.
    const lakePaths = LAKES.map((lake) => path(lake) ?? "");

    // Per-prefecture bounding box (shapes + any island markers), used to
    // zoom the map to fit whichever prefecture is currently selected.
    const prefBounds = new Map<string, Bounds>();
    for (const f of collection.features) {
      const b = path.bounds(f) as Bounds;
      prefBounds.set(f.properties.prefCode, mergeBounds(prefBounds.get(f.properties.prefCode), b));
    }
    for (const m of markers) {
      const municipality = MUNICIPALITIES.find((mm) => mm.cityCode === m.cityCode);
      if (!municipality) continue;
      prefBounds.set(municipality.prefCode, extendBounds(prefBounds.get(municipality.prefCode), [m.x, m.y]));
    }

    return { shapes, markers, prefBorderPath, lakePaths, prefBounds };
  }, [nameByCode]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const g = zoomGroupRef.current;
    if (!svgEl || !g) return;

    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent(SCALE_EXTENT)
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.setAttribute("transform", event.transform.toString());
      });
    zoomBehaviorRef.current = behavior;

    const selection = select(svgEl);
    selection.call(behavior);
    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  // Smoothly zoom/pan to fit the selected prefecture whenever it changes;
  // back to the full-country view when no prefecture is selected.
  useEffect(() => {
    const svgEl = svgRef.current;
    const behavior = zoomBehaviorRef.current;
    if (!svgEl || !behavior) return;
    const selection = select(svgEl);

    if (!focusPrefCode) {
      selection.transition().duration(500).call(behavior.transform, zoomIdentity);
      return;
    }

    const bounds = prefBounds.get(focusPrefCode);
    if (!bounds) return;
    const [[x0, y0], [x1, y1]] = bounds;
    const width = Math.max(x1 - x0, 1);
    const height = Math.max(y1 - y0, 1);
    const padding = 0.8;
    const rawScale = padding / Math.max(width / WIDTH, height / HEIGHT);
    const scale = Math.min(SCALE_EXTENT[1], Math.max(SCALE_EXTENT[0], rawScale));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const transform = zoomIdentity.translate(WIDTH / 2 - scale * cx, HEIGHT / 2 - scale * cy).scale(scale);

    selection.transition().duration(500).call(behavior.transform, transform);
  }, [focusPrefCode, prefBounds]);

  return (
    <div className="japan-map">
      <StatsBar
        startedAt={startedAt}
        finishedAt={finishedAt}
        pausedAt={pausedAt}
        pausedDurationMs={pausedDurationMs}
        solvedCount={solvedCount}
        total={total}
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="japan-map-svg"
        role="img"
        aria-label="日本地図（都道府県別の正解状況）"
      >
        <g ref={zoomGroupRef}>
          {shapes.map((s, i) => (
            <MapShape key={`${s.cityCode}-${i}`} d={s.d} status={status[s.cityCode] ?? "blank"} title={s.title} />
          ))}
          {lakePaths.map((d, i) => (
            <path key={i} d={d} className="map-lake" />
          ))}
          {markers.map((m) => (
            <MapMarker key={m.cityCode} cx={m.x} cy={m.y} status={status[m.cityCode] ?? "blank"} title={m.title} />
          ))}
          <path d={prefBorderPath} className="map-pref-border" />
        </g>
      </svg>
      {finishedAt !== null && (
        <ResultSummary
          startedAt={startedAt}
          finishedAt={finishedAt}
          pausedDurationMs={pausedDurationMs}
          solvedCount={solvedCount}
          total={total}
          wrongCount={wrongCount}
          onRetryWrong={onRetryWrong}
          onStartFull={onStartFull}
        />
      )}
      <p className="japan-map-credit">
        出典：国土数値情報（行政区域データ）（国土交通省）を加工して作成 / 湖沼形状の一部に © OpenStreetMap contributors のデータを使用
      </p>
    </div>
  );
}
