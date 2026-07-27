// Generates src/data/map.generated.ts — a trimmed TopoJSON topology (each
// geometry's properties reduced to just `cityCode`) plus marker-fallback
// coordinates for the handful of municipalities with no polygon coverage.
// One-time build step — the app itself never fetches this at runtime.
// Run: npm run generate-map-data

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const TOPOLOGY_URL =
  "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0001/N03-21_210101.json";
const LOCALGOVJP_URL = "https://code4fukui.github.io/localgovjp/localgovjp.json";

// Major lakes aren't holes in the N03 municipality polygons — their surfaces
// are already allocated to the surrounding municipalities, so without these
// they just render as ordinary land. Drawn as separate decorative water
// overlays instead. Coordinates are pre-simplified and embedded directly
// (not fetched at generation time) since each is a one-off, stable shape.

// Lake Biwa (Shiga). Source: Natural Earth's public-domain 10m lakes dataset
// (feature name "Biwa Ko"), https://github.com/martynafford/natural-earth-geojson
// (10m/physical/ne_10m_lakes.json) — already simplified to 64 points there.
const LAKE_BIWA_POLYGON = {
  type: "Polygon",
  coordinates: [
    [
      [136.22097775777314, 35.38503677231577], [136.2489423498506, 35.37679457675608],
      [136.27867312669093, 35.36472564754368], [136.27661257780102, 35.336761055466184],
      [136.25276908350332, 35.28406987670962], [136.23981706190955, 35.270823490988676],
      [136.1632823888553, 35.225785779537546], [136.10499829168322, 35.20547465476545],
      [136.07791679198715, 35.190462084281734], [136.0602549443592, 35.16455804109415],
      [136.07850552024138, 35.15867075855152], [136.07379569420726, 35.14925110648332],
      [136.05642821070654, 35.140420182669345], [136.03641145006156, 35.13659344901666],
      [136.0184552383065, 35.135415992508115], [135.9999102982972, 35.13188362298254],
      [135.98313154305072, 35.125407612185654], [135.97076824971117, 35.11598796011742],
      [135.96458660304143, 35.12334706329571], [135.95722749986317, 35.103624666777904],
      [135.95310640208328, 35.07830935184458], [135.94515857065073, 35.056820770563974],
      [135.92661363064144, 35.047695482622885], [135.91925452746318, 35.03886455880894],
      [135.91925452746318, 34.99529866799344], [135.90954051126783, 34.97881427687406],
      [135.8983546744368, 34.979991733382604], [135.88481392458874, 34.99029447783221],
      [135.8733337236306, 35.005895776570185], [135.86832953346936, 35.02355762419808],
      [135.87362808775777, 35.03886455880894], [135.9216094404802, 35.10509648741356],
      [135.92808545127713, 35.11922596551588], [135.93220654905696, 35.171328416018184],
      [135.93691637509107, 35.186340986501904], [135.95722749986317, 35.219015404613515],
      [136.0163946894166, 35.266702393208845], [136.02610870561193, 35.27729950178559],
      [136.03405653704453, 35.29231207226931], [136.06790841166463, 35.307619006880145],
      [136.07438442246155, 35.32145412085532], [136.04288746085848, 35.38650859295143],
      [136.0431818249856, 35.39769442978243], [136.05142402054526, 35.41094081550335],
      [136.05848875959646, 35.43655049456382], [136.07085205293595, 35.45421234219171],
      [136.09498991136076, 35.44420396186925], [136.11353485137005, 35.47658401585372],
      [136.122365775184, 35.486592396176206], [136.12648687296382, 35.47157982569249],
      [136.12825305772662, 35.45568416282737], [136.13472906852354, 35.44332086948785],
      [136.15268528027855, 35.438022315199476], [136.15739510631266, 35.445381418377764],
      [136.16033874758398, 35.4624545377514], [136.1632823888553, 35.49954441776998],
      [136.17770623108476, 35.49512895586301], [136.1897751602972, 35.48688676030332],
      [136.19683989934833, 35.474817831090945], [136.19742862760256, 35.45862780409868],
      [136.19742862760256, 35.46598690727697], [136.19890044823825, 35.43507867392816],
      [136.20537645903516, 35.406230989469265], [136.22097775777314, 35.38503677231577],
    ],
  ],
};

// Lake Kasumigaura / 西浦 (Ibaraki), the main basin. Source: OpenStreetMap
// relation 253637 (© OpenStreetMap contributors, ODbL), fetched via
// https://polygons.openstreetmap.fr/get_geojson.py?id=253637 and simplified
// from ~3,800 points down to 119 with Douglas-Peucker (epsilon 0.0015) —
// the five other tiny fragments in that relation (small islets) are dropped.
const LAKE_KASUMIGAURA_POLYGON = {
  type: "Polygon",
  coordinates: [
    [
      [140.2213722, 36.0605369], [140.2198763, 36.0741351],
      [140.2060755, 36.0738939], [140.2188113, 36.0765126],
      [140.2180699, 36.08034], [140.2089395, 36.0776384],
      [140.209071, 36.079589], [140.2232815, 36.0860888],
      [140.2371526, 36.0820786], [140.2422005, 36.0699972],
      [140.2757311, 36.0672405], [140.2931505, 36.0605032],
      [140.3056584, 36.0689023], [140.3313169, 36.0605353],
      [140.3476425, 36.0630513], [140.3679787, 36.0619344],
      [140.3895892, 36.0811711], [140.3938688, 36.0888953],
      [140.3754231, 36.0972566], [140.3745684, 36.1000788],
      [140.3808646, 36.1012764], [140.3821139, 36.1040472],
      [140.3594164, 36.1173782], [140.3367347, 36.1244485],
      [140.3328098, 36.1291226], [140.3362589, 36.1366692],
      [140.324375, 36.1463374], [140.3209779, 36.1443496],
      [140.3066145, 36.1506008], [140.3094063, 36.1563283],
      [140.3054143, 36.1599781], [140.3167512, 36.1608457],
      [140.3247642, 36.1533417], [140.3345758, 36.1498245],
      [140.3409009, 36.1401184], [140.343935, 36.1391435],
      [140.3522588, 36.1400252], [140.3523192, 36.1458261],
      [140.357086, 36.1498347], [140.3675274, 36.1489893],
      [140.3822864, 36.1382357], [140.3867945, 36.1295043],
      [140.3951255, 36.1230861], [140.399648, 36.114358],
      [140.3964165, 36.1052518], [140.4010713, 36.1024313],
      [140.4023364, 36.0937053], [140.4157612, 36.087156],
      [140.4168472, 36.0755731], [140.4208276, 36.0663223],
      [140.4371336, 36.0507983], [140.4466116, 36.0365418],
      [140.4539341, 36.0300259], [140.4516366, 36.0291286],
      [140.4620493, 36.0120113], [140.4649338, 36.0131594],
      [140.4668209, 36.0103099], [140.4744807, 35.9858982],
      [140.4855835, 35.9842544], [140.4961936, 35.9792575],
      [140.501011, 35.9725286], [140.5025399, 35.9651725],
      [140.5089704, 35.9611622], [140.5072115, 35.9593507],
      [140.5000548, 35.9619249], [140.4978676, 35.9567453],
      [140.4900044, 35.9529453], [140.4835238, 35.957442],
      [140.4751275, 35.9589817], [140.462558, 35.956792],
      [140.4534414, 35.9418165], [140.4537718, 35.9448116],
      [140.4498313, 35.9449712], [140.4524738, 35.9457379],
      [140.4573814, 35.9587208], [140.4581854, 35.9569793],
      [140.4691046, 35.959246], [140.4463488, 35.9696317],
      [140.4450037, 35.9741813], [140.4499527, 35.9741382],
      [140.4487923, 35.9771705], [140.4034855, 35.9908888],
      [140.3992461, 35.9898072], [140.3965918, 35.9841127],
      [140.3886712, 35.9823886], [140.365393, 35.9837167],
      [140.3541058, 35.9880006], [140.3501248, 35.9763612],
      [140.3541199, 35.9730763], [140.3534765, 35.9703263],
      [140.3452257, 35.9684568], [140.3400736, 35.9594844],
      [140.3320509, 35.9549093], [140.3335402, 35.9576233],
      [140.324315, 35.9577491], [140.3257188, 35.9608132],
      [140.3370262, 35.9590259], [140.3450418, 35.9698836],
      [140.353292, 35.9722396], [140.3461634, 35.977423],
      [140.3463108, 35.9906591], [140.3628493, 35.9966669],
      [140.3636303, 35.9950383], [140.3717674, 36.0017015],
      [140.3765577, 36.0025377], [140.3729102, 36.009627],
      [140.3623197, 36.0155523], [140.3540121, 36.0237677],
      [140.3531297, 36.0278045], [140.3472569, 36.0300397],
      [140.3227058, 36.0261816], [140.3152156, 36.0315465],
      [140.2963985, 36.0270173], [140.2783816, 36.0345385],
      [140.259535, 36.034485], [140.2511654, 36.0389023],
      [140.2333841, 36.0427729], [140.2279108, 36.046125],
      [140.2213722, 36.0605369],
    ],
  ],
};

const LAKES = [LAKE_BIWA_POLYGON, LAKE_KASUMIGAURA_POLYGON];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, "..");

async function loadMunicipalities() {
  const src = await fs.readFile(
    path.join(REPO_ROOT, "src", "data", "municipalities.generated.ts"),
    "utf-8",
  );
  const marker = "MUNICIPALITIES: Municipality[] = ";
  const start = src.indexOf(marker);
  if (start === -1) throw new Error("could not find MUNICIPALITIES array in municipalities.generated.ts");
  const jsonText = src.slice(start + marker.length).trim().replace(/;$/, "");
  return JSON.parse(jsonText);
}

async function main() {
  const municipalities = await loadMunicipalities();
  const byPrefAndCity = new Map(municipalities.map((m) => [`${m.prefName}|${m.cityName}`, m.cityCode]));
  const byCode5 = new Map(municipalities.map((m) => [m.cityCode.slice(0, 5), m.cityCode]));
  const prefCodeByCityCode = new Map(municipalities.map((m) => [m.cityCode, m.prefCode]));

  const topoRes = await fetch(TOPOLOGY_URL);
  if (!topoRes.ok) throw new Error(`fetch failed: ${topoRes.status} ${topoRes.statusText}`);
  const topology = await topoRes.json();

  const objectKeys = Object.keys(topology.objects);
  if (objectKeys.length !== 1) {
    throw new Error(`expected exactly one topojson object, got: ${objectKeys.join(", ")}`);
  }
  const rawGeometries = topology.objects[objectKeys[0]].geometries;

  let wardResolved = 0;
  let directResolved = 0;
  const resolvedCodes = new Set();
  const outGeometries = [];
  for (const g of rawGeometries) {
    const p = g.properties ?? {};
    let cityCode = null;

    if (p.N03_003) {
      cityCode = byPrefAndCity.get(`${p.N03_001}|${p.N03_003}`) ?? null;
      if (cityCode) wardResolved++;
    }
    if (!cityCode && p.N03_007) {
      cityCode = byCode5.get(p.N03_007) ?? null;
      if (cityCode) directResolved++;
    }

    if (!cityCode) {
      if (p.N03_004 !== "所属未定地") {
        console.warn("WARNING: unresolved topology geometry (not the expected '所属未定地'):", p);
      }
      continue;
    }

    resolvedCodes.add(cityCode);
    outGeometries.push({ ...g, properties: { cityCode, prefCode: prefCodeByCityCode.get(cityCode) } });
  }

  console.log(`ward-resolved geometries: ${wardResolved}`);
  console.log(`direct-resolved geometries: ${directResolved}`);
  console.log(`total geometries kept: ${outGeometries.length} / ${rawGeometries.length}`);
  console.log(`distinct municipalities with a polygon: ${resolvedCodes.size} / ${municipalities.length}`);

  const missing = municipalities.filter((m) => !resolvedCodes.has(m.cityCode));
  console.log(`municipalities with NO polygon (need marker fallback): ${missing.length}`);
  for (const m of missing) console.log(`  ${m.prefName} ${m.cityName} (${m.cityCode})`);
  if (missing.length !== 8) {
    console.warn(
      `WARNING: expected exactly 8 municipalities without polygon coverage (the known island villages), got ${missing.length}. Upstream data may have changed — review the list above.`,
    );
  }

  const rawRes = await fetch(LOCALGOVJP_URL);
  if (!rawRes.ok) throw new Error(`fetch failed: ${rawRes.status} ${rawRes.statusText}`);
  const rawRecords = await rawRes.json();
  const latLngByCode = new Map(rawRecords.map((r) => [r.lgcode, { lat: Number(r.lat), lng: Number(r.lng) }]));

  const markerFallbacks = missing.map((m) => {
    const coords = latLngByCode.get(m.cityCode);
    if (!coords) throw new Error(`no lat/lng found for fallback municipality ${m.cityName} (${m.cityCode})`);
    return { cityCode: m.cityCode, lat: coords.lat, lng: coords.lng };
  });

  const outTopology = {
    type: "Topology",
    bbox: topology.bbox,
    transform: topology.transform,
    arcs: topology.arcs,
    objects: {
      municipalities: {
        type: "GeometryCollection",
        geometries: outGeometries,
      },
    },
  };

  const header = `// AUTO-GENERATED by scripts/generate-map-data.mjs — do not hand-edit.
// Run: npm run generate-map-data
//
// Boundary source: 国土数値情報（行政区域データ、国土交通省）, via
// smartnews-smri/japan-topography (N03-21_210101, 0.1% simplified).
// Each geometry's properties are trimmed to just { cityCode, prefCode },
// already resolved against src/data/municipalities.generated.ts at
// generation time (including merging designated-city wards into their
// parent city) — no runtime join logic is needed. prefCode is included so
// prefecture borders can be drawn distinctly (via topojson-client's mesh())
// without a second lookup.
//
// LAKES is a separate decorative overlay (see the LAKE_*_POLYGON comments in
// generate-map-data.mjs for provenance) — these lakes' surfaces are already
// part of the surrounding municipalities' polygons above, so without this
// overlay they render as ordinary land instead of water.

import type { Topology } from "topojson-specification";
import type { Polygon } from "geojson";

export interface MapMarkerFallback {
  cityCode: string;
  lat: number;
  lng: number;
}

// Municipalities with no polygon in the source data (small remote islands) —
// rendered as point markers instead.
export const MAP_MARKER_FALLBACKS: MapMarkerFallback[] = `;

  const footer = `;

export const MAP_TOPOLOGY: Topology = ${JSON.stringify(outTopology)};

export const LAKES: Polygon[] = ${JSON.stringify(LAKES)};
`;

  const outPath = path.join(REPO_ROOT, "src", "data", "map.generated.ts");
  await fs.writeFile(outPath, header + JSON.stringify(markerFallbacks, null, 2) + footer, "utf-8");
  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
