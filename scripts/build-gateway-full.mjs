// Regenerate the FULL gateway-town set for a radius-driven experience: every real
// incorporated town within 150 mi of each park/forest (distance-sorted, junk-filtered,
// curated basecamp first, capped so metro-adjacent places stay sane). Writes a
// committed data file the /api/gateway-seed endpoint upserts into gateway_towns.
// USGS GNIS direct (reliable, no rate-limit dependency).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = "/private/tmp/claude-501/-Users-adnansyed-Documents-Park-Buddy-nextjs/8336892d-b650-4328-a419-ca723866ccea/scratchpad";
const OUT = path.join(ROOT, "public/gateway-seed.json");
const RADIUS_MI = 150, RADIUS_KM = 241, CAP = 50;

const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (s) => norm(s).replace(/ /g, "-");
const cKey = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
function parseArr(file, v) { const t = fs.readFileSync(path.join(ROOT, file), "utf8"); return JSON.parse(t.match(new RegExp(v + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"))[1]); }
function distMi(aLat, aLng, bLat, bLng) { const R = 3958.8, r = (d) => d * Math.PI / 180; const dLat = r(bLat - aLat), dLng = r(bLng - aLng); const s = Math.sin(dLat/2)**2 + Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.min(1, Math.sqrt(s))); }
const JUNK = /(justice of the peace|school district|\bdistrict\b|\bnumber\b|\bsur\b|\bsurvey\b|reservation|\blateral\b|\bprecinct\b|\bchapter\b|land grant|\bbaca\b|united state|\btownship\b|\bgrant\b|\bpueblo\b|\bcommunity\b|resettlement|administrative area|\btrust land\b)/i;

async function gnisInc(lat, lng, radiusKm) {
  const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const params = new URLSearchParams({ geometry: [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", where: "1=1", outFields: "gaz_name", returnGeometry: "true", outSR: "4326", resultRecordCount: "2000", f: "json" });
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/1/query?" + params, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      return (d.features || []).map((f) => { const raw = (f.attributes || {}).gaz_name; const name = raw ? String(raw).replace(/^((City|Town|Village|Township|Borough|Municipality)( and (County|Borough))? of )/i, "") : ""; const g = f.geometry || {}; const pt = (g.points && g.points[0]) || (g.x != null ? [g.x, g.y] : null); if (!name || !pt || pt[0] == null) return null; return { name, lat: pt[1], lon: pt[0] }; }).filter(Boolean);
    } catch (e) { if (a === 3) return []; await sleep(600 * a); }
  }
  return [];
}

async function townsFor(lat, lng, stateName) {
  const els = await gnisInc(lat, lng, RADIUS_KM);
  const rows = els.map((el) => ({ bare: el.name, distanceMi: Math.round(distMi(lat, lng, el.lat, el.lon)), lat: el.lat, lng: el.lon }))
    .filter((r) => r.bare && r.distanceMi <= RADIUS_MI && !JUNK.test(r.bare));
  rows.sort((a, b) => a.distanceMi - b.distanceMi);
  const seen = new Set(), uniq = [];
  for (const r of rows) { const k = r.bare.toLowerCase(); if (seen.has(k)) continue; seen.add(k); uniq.push(r); }
  const ab = ST_ABBR[stateName] || (stateName && stateName.includes("/") ? ST_ABBR[stateName.split("/")[0].trim()] : "");
  return uniq.slice(0, CAP).map((r) => ({ name: ab ? r.bare + ", " + ab : r.bare, bareName: r.bare, lat: r.lat, lng: r.lng, distanceMi: r.distanceMi, source: "gnis" }));
}

function loadCurated() { try { const t = fs.readFileSync(path.join(ROOT, "public/gateway-towns.js"), "utf8"); const m = t.match(/var T\s*=\s*(\{[\s\S]*?\});/); return m ? (0, eval)("(" + m[1] + ")") : {}; } catch { return {}; } }
const curated = loadCurated();

async function pool(items, worker, c) { let i = 0, done = 0; const run = async () => { while (i < items.length) { const k = i++; await worker(items[k]); if (++done % 15 === 0 || done === items.length) console.log(`  … ${done}/${items.length}`); } }; await Promise.all(Array.from({ length: c }, run)); }

// Build the place list: 63 parks (id nps:<slug>) + 118 forests (id from forests.json).
const parks = parseArr("public/trip-data.js", "window.TRIP_PARKS").map((p) => ({ place_id: "nps:" + slug(p.name), place_type: "national_park", name: p.name, lat: p.lat, lng: p.lng, state: p.state }));
const forests = JSON.parse(fs.readFileSync(path.join(SCRATCH, "forests.json"), "utf8")).map((f) => ({ place_id: f.id, place_type: "national_forest", name: f.name, lat: f.lat, lng: f.lng, state: f.state }));
const places = parks.concat(forests);

const out = { radiusMi: RADIUS_MI, cap: CAP, places: [] };
const flags = [];
console.log(`Full gateway sweep: ${places.length} places, within ${RADIUS_MI} mi, cap ${CAP} …`);
await pool(places, async (pl) => {
  let towns = await townsFor(pl.lat, pl.lng, pl.state);
  const c = curated[cKey(pl.name)];
  if (c) {
    let cur = [];
    if (Array.isArray(c.towns)) cur = c.towns.filter((t) => t.lat != null).map((t) => ({ name: t.name, bareName: String(t.name).split(",")[0].split("/")[0].trim(), lat: t.lat, lng: t.lng, distanceMi: Math.round(distMi(pl.lat, pl.lng, t.lat, t.lng)), source: "curated" }));
    else if (c.town && c.lat != null) cur = [{ name: c.town, bareName: c.town.split(",")[0].split("/")[0].trim(), lat: c.lat, lng: c.lng, distanceMi: Math.round(distMi(pl.lat, pl.lng, c.lat, c.lng)), source: "curated" }];
    if (cur.length) { const cb = new Set(cur.map((t) => t.bareName.toLowerCase())); towns = cur.concat(towns.filter((t) => !cb.has(t.bareName.toLowerCase()))).slice(0, CAP); }
  }
  towns.forEach((t, i) => { t.rank = i; t.lat = Math.round(t.lat * 1e5) / 1e5; t.lng = Math.round(t.lng * 1e5) / 1e5; });
  out.places.push({ place_id: pl.place_id, place_type: pl.place_type, towns });
  if (!towns.length) flags.push("NO TOWNS: " + pl.name);
}, 4);

fs.writeFileSync(OUT, JSON.stringify(out));
const total = out.places.reduce((n, p) => n + p.towns.length, 0);
console.log(`\n✓ Wrote ${OUT} — ${out.places.length} places, ${total} town rows (avg ${(total / out.places.length).toFixed(1)}/place)`);
flags.forEach((f) => console.log("  ⚠ " + f));
