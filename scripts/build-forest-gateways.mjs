// Gateway towns for national forests. A forest is a huge polygon, so its basecamps
// RING the perimeter — we take the nearest incorporated towns within a WIDE radius of
// the centroid (that ring = the real gateways). USGS GNIS direct (reliable, fast),
// incorporated-only + junk-filtered, with the curated multi-town overlay
// (public/gateway-towns.js — White River → Aspen/Vail/Glenwood/Breckenridge, etc.).
// Reads the exact DB forest rows (scratchpad/forests.json) so gateway FKs match.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = "/private/tmp/claude-501/-Users-adnansyed-Documents-Park-Buddy-nextjs/8336892d-b650-4328-a419-ca723866ccea/scratchpad";
const CHUNK = 150, TOP_N = 4;

const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function distMi(aLat, aLng, bLat, bLng) { const R = 3958.8, r = (d) => d * Math.PI / 180; const dLat = r(bLat - aLat), dLng = r(bLng - aLng); const s = Math.sin(dLat/2)**2 + Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.min(1, Math.sqrt(s))); }
const JUNK = /(justice of the peace|school district|\bdistrict\b|\bnumber\b|\bsur\b|\bsurvey\b|reservation|\blateral\b|\bprecinct\b|\bchapter\b|land grant|\bbaca\b|united state|\btownship\b)/i;

async function gnisInc(lat, lng, radiusKm) {
  const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const params = new URLSearchParams({ geometry: [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", where: "1=1", outFields: "gaz_name", returnGeometry: "true", outSR: "4326", resultRecordCount: "1000", f: "json" });
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/1/query?" + params, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      return (d.features || []).map((f) => { const raw = (f.attributes || {}).gaz_name; const name = raw ? String(raw).replace(/^((City|Town|Village|Township|Borough|Municipality)( and (County|Borough))? of )/i, "") : ""; const g = f.geometry || {}; const pt = (g.points && g.points[0]) || (g.x != null ? [g.x, g.y] : null); if (!name || !pt || pt[0] == null) return null; return { name, lat: pt[1], lon: pt[0] }; }).filter(Boolean);
    } catch (e) { if (a === 3) return []; await sleep(600 * a); }
  }
  return [];
}

async function forestTowns(lat, lng, stateName) {
  let els = await gnisInc(lat, lng, 140);            // ring of incorporated towns around the forest
  if (els.filter((e) => !JUNK.test(e.name)).length < 2) els = await gnisInc(lat, lng, 230); // remote → widen
  const rows = els.map((el) => ({ bare: el.name, distanceMi: Math.round(distMi(lat, lng, el.lat, el.lon)), lat: el.lat, lng: el.lon }))
    .filter((r) => r.bare && r.distanceMi <= 230 && !JUNK.test(r.bare));
  rows.sort((a, b) => a.distanceMi - b.distanceMi);
  const seen = new Set(), uniq = [];
  for (const r of rows) { const k = r.bare.toLowerCase(); if (seen.has(k)) continue; seen.add(k); uniq.push(r); }
  const ab = ST_ABBR[stateName] || "";
  return uniq.slice(0, TOP_N).map((r) => ({ name: ab ? r.bare + ", " + ab : r.bare, bareName: r.bare, lat: r.lat, lng: r.lng, distanceMi: r.distanceMi, source: "gnis" }));
}

function loadCurated() { try { const t = fs.readFileSync(path.join(ROOT, "public/gateway-towns.js"), "utf8"); const m = t.match(/var T\s*=\s*(\{[\s\S]*?\});/); return m ? (0, eval)("(" + m[1] + ")") : {}; } catch { return {}; } }
const curated = loadCurated();
const cKey = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

async function pool(items, worker, c) { let i = 0, done = 0; const run = async () => { while (i < items.length) { const k = i++; await worker(items[k]); if (++done % 15 === 0 || done === items.length) console.log(`  … ${done}/${items.length}`); } }; await Promise.all(Array.from({ length: c }, run)); }

const forests = JSON.parse(fs.readFileSync(path.join(SCRATCH, "forests.json"), "utf8"));
const q = (s) => (s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'");
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const out = {};
const flags = [];

console.log(`Forest gateways for ${forests.length} forests (GNIS) …`);
await pool(forests, async (f) => {
  let towns = await forestTowns(f.lat, f.lng, f.state);
  const c = curated[cKey(f.name)];
  if (c && Array.isArray(c.towns) && c.towns.length) {           // curated multi-town basecamps (White River…)
    const cur = c.towns.filter((t) => t.lat != null).map((t) => ({ name: t.name, bareName: String(t.name).split(",")[0].trim(), lat: t.lat, lng: t.lng, distanceMi: Math.round(distMi(f.lat, f.lng, t.lat, t.lng)), source: "curated" }));
    const curBare = new Set(cur.map((t) => t.bareName.toLowerCase()));
    towns = cur.concat(towns.filter((t) => !curBare.has(t.bareName.toLowerCase()))).slice(0, TOP_N);
  }
  out[f.id] = { name: f.name, towns };
  if (!towns.length) flags.push("NO TOWNS: " + f.name);
  else if (towns[0].distanceMi > 80) flags.push(`FAR (${towns[0].distanceMi}mi): ${f.name} → ${towns[0].name}`);
}, 4);

// emit gateway_towns SQL chunks
const rows = [];
for (const [id, f] of Object.entries(out)) f.towns.forEach((t, i) => rows.push(`(${q(id)},'national_forest',${q(t.name)},${q(t.bareName)},${r5(t.lat)},${r5(t.lng)},${t.distanceMi},${i},${q(t.source)},now())`));
const header = "insert into gateway_towns (place_id,place_type,name,bare_name,lat,lng,distance_mi,rank,source,updated_at) values\n";
const footer = ";";
let files = 0;
for (let i = 0; i < rows.length; i += CHUNK) { fs.writeFileSync(path.join(SCRATCH, `forest-gw-${files + 1}.sql`), header + rows.slice(i, i + CHUNK).join(",\n") + footer); files++; }
fs.writeFileSync(path.join(SCRATCH, "forest-gw-delete.sql"), "delete from gateway_towns where place_type='national_forest';");
const cov = Object.values(out).filter((v) => v.towns.length).length;
console.log(`\n✓ forests with towns: ${cov}/${forests.length} | town rows: ${rows.length} | ${files} chunk(s)`);
flags.forEach((f) => console.log("  ⚠ " + f));
