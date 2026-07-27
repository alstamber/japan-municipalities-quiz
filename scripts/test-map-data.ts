import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { geoMercator, geoPath } from "d3-geo";
import { MAP_TOPOLOGY, MAP_MARKER_FALLBACKS } from "../src/data/map.generated";
import { MUNICIPALITIES } from "../src/data/municipalities.generated";

let failures = 0;
function check(label: string, cond: boolean) {
  if (!cond) {
    failures++;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const collection = feature(
  MAP_TOPOLOGY,
  MAP_TOPOLOGY.objects.municipalities,
) as unknown as FeatureCollection<Geometry, { cityCode: string }>;

check("feature collection is non-empty", collection.features.length > 0);
console.log(`feature count: ${collection.features.length}`);

const projection = geoMercator().fitSize([480, 520], collection);
const path = geoPath(projection);

let emptyPaths = 0;
for (const f of collection.features) {
  const d = path(f);
  if (!d || d.length < 10) emptyPaths++;
}
check("no empty/degenerate path strings", emptyPaths === 0);
console.log(`empty paths: ${emptyPaths} / ${collection.features.length}`);

// Every feature's cityCode must resolve to a real municipality.
const codeSet = new Set(MUNICIPALITIES.map((m) => m.cityCode));
const unknownCodes = collection.features.filter((f) => !codeSet.has(f.properties.cityCode));
check("every feature cityCode resolves to a real municipality", unknownCodes.length === 0);

// Sapporo's 10 wards must all resolve to the same cityCode (the parent city).
const sapporo = MUNICIPALITIES.find((m) => m.cityName === "札幌市")!;
const sapporoFeatures = collection.features.filter((f) => f.properties.cityCode === sapporo.cityCode);
check("札幌市 has multiple ward polygons merged under one cityCode", sapporoFeatures.length >= 5);
console.log(`札幌市 polygon count: ${sapporoFeatures.length}`);

// Northern Territories villages must be present as polygons (not markers).
const hoppoNames = ["色丹村", "泊村", "留夜別村", "留別村", "紗那村", "蘂取村"];
const hoppoCodes = MUNICIPALITIES.filter(
  (m) => m.prefName === "北海道" && hoppoNames.includes(m.cityName) && m.districtName !== "古宇郡",
).map((m) => m.cityCode);
check("6 Northern Territories villages identified", hoppoCodes.length === 6);
const hoppoWithPolygon = hoppoCodes.filter((c) => collection.features.some((f) => f.properties.cityCode === c));
check("all 6 Northern Territories villages have polygons", hoppoWithPolygon.length === 6);

// Marker fallbacks: exactly the 8 known islands, each projects to a finite point.
check("exactly 8 marker fallbacks", MAP_MARKER_FALLBACKS.length === 8);
let badMarkers = 0;
for (const m of MAP_MARKER_FALLBACKS) {
  const p = projection([m.lng, m.lat]);
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) badMarkers++;
}
check("all marker fallbacks project to finite coordinates", badMarkers === 0);

// No municipality should be both a polygon feature AND a marker fallback.
const markerCodes = new Set(MAP_MARKER_FALLBACKS.map((m) => m.cityCode));
const overlap = collection.features.filter((f) => markerCodes.has(f.properties.cityCode));
check("no overlap between polygon features and marker fallbacks", overlap.length === 0);

// Every one of the 1747 municipalities is covered by either a polygon or a marker.
const coveredByPolygon = new Set(collection.features.map((f) => f.properties.cityCode));
const uncovered = MUNICIPALITIES.filter((m) => !coveredByPolygon.has(m.cityCode) && !markerCodes.has(m.cityCode));
check("every municipality has a polygon or a marker", uncovered.length === 0);
if (uncovered.length > 0) {
  for (const m of uncovered) console.log("  uncovered:", m.prefName, m.cityName, m.cityCode);
}

// Geographic sanity: Hokkaido (north) should render above (smaller y than)
// Okinawa (south) in standard SVG coordinates, confirming the projection
// isn't flipped or garbled.
const naha = MUNICIPALITIES.find((m) => m.cityName === "那覇市")!;
const sapporoFeature = collection.features.find((f) => f.properties.cityCode === sapporo.cityCode)!;
const nahaFeature = collection.features.find((f) => f.properties.cityCode === naha.cityCode)!;
const sapporoBounds = path.bounds(sapporoFeature);
const nahaBounds = path.bounds(nahaFeature);
console.log("sapporo bounds (y):", sapporoBounds[0][1], sapporoBounds[1][1]);
console.log("naha bounds (y):", nahaBounds[0][1], nahaBounds[1][1]);
check("Hokkaido (Sapporo) renders above Okinawa (Naha)", sapporoBounds[1][1] < nahaBounds[0][1]);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
