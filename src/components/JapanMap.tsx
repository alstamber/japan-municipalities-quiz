import { useEffect, useMemo, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { zoom as d3zoom, type D3ZoomEvent } from "d3-zoom";
import { feature, mesh } from "topojson-client";
import type { GeometryObject } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { MAP_TOPOLOGY, MAP_MARKER_FALLBACKS, LAKES } from "../data/map.generated";
import { MUNICIPALITIES } from "../data/municipalities.generated";
import { formatMunicipalityName } from "../lib/format";
import { StatsBar } from "./StatsBar";
import { ResultSummary } from "./ResultSummary";
import type { EntryStatus } from "../types";

interface Props {
  status: Record<string, EntryStatus>;
  elapsedMs: number;
  solvedCount: number;
  total: number;
  finished: boolean;
}

const WIDTH = 480;
const HEIGHT = 520;

interface ShapeDatum {
  cityCode: string;
  d: string;
}

interface MarkerDatum {
  cityCode: string;
  x: number;
  y: number;
}

export function JapanMap({ status, elapsedMs, solvedCount, total, finished }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGroupRef = useRef<SVGGElement | null>(null);

  const nameByCode = useMemo(() => new Map(MUNICIPALITIES.map((m) => [m.cityCode, m])), []);

  // Geometry never changes at runtime, so the projection and every path's `d`
  // string are computed exactly once, independent of `status`.
  const { shapes, markers, prefBorderPath, lakePaths } = useMemo(() => {
    const collection = feature(
      MAP_TOPOLOGY,
      MAP_TOPOLOGY.objects.municipalities,
    ) as unknown as FeatureCollection<Geometry, { cityCode: string; prefCode: string }>;

    const projection = geoMercator().fitSize([WIDTH, HEIGHT], collection);
    const path = geoPath(projection);

    const shapes: ShapeDatum[] = collection.features.map((f) => ({
      cityCode: f.properties.cityCode,
      d: path(f) ?? "",
    }));

    const markers: MarkerDatum[] = MAP_MARKER_FALLBACKS.map((m) => {
      const projected = projection([m.lng, m.lat]);
      return { cityCode: m.cityCode, x: projected?.[0] ?? 0, y: projected?.[1] ?? 0 };
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

    return { shapes, markers, prefBorderPath, lakePaths };
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    const g = zoomGroupRef.current;
    if (!svgEl || !g) return;

    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.setAttribute("transform", event.transform.toString());
      });

    const selection = select(svgEl);
    selection.call(behavior);
    return () => {
      selection.on(".zoom", null);
    };
  }, []);

  return (
    <div className="japan-map">
      <StatsBar elapsedMs={elapsedMs} solvedCount={solvedCount} total={total} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="japan-map-svg"
        role="img"
        aria-label="日本地図（都道府県別の正解状況）"
      >
        <g ref={zoomGroupRef}>
          {shapes.map((s, i) => {
            const st = status[s.cityCode] ?? "blank";
            return (
              <path key={`${s.cityCode}-${i}`} d={s.d} className={`map-shape map-shape-${st}`}>
                {st === "solved" && <title>{formatMunicipalityName(nameByCode.get(s.cityCode))}</title>}
              </path>
            );
          })}
          {lakePaths.map((d, i) => (
            <path key={i} d={d} className="map-lake" />
          ))}
          {markers.map((m) => {
            const st = status[m.cityCode] ?? "blank";
            return (
              <circle key={m.cityCode} cx={m.x} cy={m.y} r={2.5} className={`map-marker map-marker-${st}`}>
                {st === "solved" && <title>{formatMunicipalityName(nameByCode.get(m.cityCode))}</title>}
              </circle>
            );
          })}
          <path d={prefBorderPath} className="map-pref-border" />
        </g>
      </svg>
      {finished && <ResultSummary elapsedMs={elapsedMs} solvedCount={solvedCount} total={total} />}
      <p className="japan-map-credit">
        出典：国土数値情報（行政区域データ）（国土交通省）を加工して作成 / 湖沼形状の一部に © OpenStreetMap contributors のデータを使用
      </p>
    </div>
  );
}
