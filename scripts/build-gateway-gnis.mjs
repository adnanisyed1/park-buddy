// Self-contained gateway-town generator using USGS GNIS directly (government
// ArcGIS — reliable, no OSM rate-limit dependency). For a park's well-defined
// point, nearest incorporated + populated places = the real gateway towns.
// Reuses the ranking from app/api/gateway/route.js. PB_SCOPE=parks (default).
// Writes/merges app/lib/gateway-data.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "app/lib/gateway-data.json");
const TOP_N = 4;

const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function parseArr(file, v) { const t = fs.readFileSync(path.join(ROOT, file), "utf8"); return JSON.parse(t.match(new RegExp(v + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"))[1]); }
function distMi(aLat, aLng, bLat, bLng) { const R = 3958.8, r = (d) => d * Math.PI / 180; const dLat = r(bLat - aLat), dLng = r(bLng - aLng); const s = Math.sin(dLat/2)**2 + Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.min(1, Math.sqrt(s))); }

async function gnisLayer(layer, lat, lng, radiusKm, place) {
  const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const params = new URLSearchParams({
    geometry: [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", where: "1=1", outFields: "gaz_name", returnGeometry: "true", outSR: "4326", resultRecordCount: "1000", f: "json",
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/" + layer + "/query?" + params, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      return (d.features || []).map((f) => {
        const raw = (f.attributes || {}).gaz_name;
        const name = raw ? String(raw).replace(/^((City|Town|Village|Township|Borough|Municipality)( and (County|Borough))? of )/i, "") : "";
        const g = f.geometry || {}; const pt = (g.points && g.points[0]) || (g.x != null ? [g.x, g.y] : null);
        if (!name || !pt || pt[0] == null) return null;
        return { name, place, lat: pt[1], lon: pt[0] };
      }).filter(Boolean);
    } catch (e) { if (attempt === 3) return []; await sleep(600 * attempt); }
  }
  return [];
}

async function townsFor(lat, lng, stateName) {
  // Incorporated places (real towns) wide; unincorporated populated places tighter.
  let [inc, pop] = await Promise.all([gnisLayer(1, lat, lng, 90, "city"), gnisLayer(3, lat, lng, 45, "town")]);
  let els = inc.concat(pop);
  if (!els.length) els = await gnisLayer(1, lat, lng, 160, "city"); // remote parks: widen
  // GNIS "populated places" include administrative/legal features that aren't towns
  // (JP & school districts, land grants, survey lots, Navajo chapters, reservations).
  // Drop those so a real town lands at the top. (Keeps island "Estate …"/village
  // names, which ARE the only places in USVI / American Samoa.)
  const JUNK = /(justice of the peace|school district|\bdistrict\b|\bnumber\b|\bsur\b|\bsurvey\b|reservation|\blateral\b|\bprecinct\b|\bchapter\b|land grant|\bbaca\b|united state|\btownship\b)/i;
  const RANK = { city: 0, town: 1 };
  const rows = els.map((el) => ({ bare: el.name, place: el.place, distanceMi: Math.round(distMi(lat, lng, el.lat, el.lon)), lat: el.lat, lng: el.lon }))
    .filter((r) => r.bare && r.distanceMi <= 160 && !JUNK.test(r.bare));
  // Sort by score FIRST, then keep one row per name (nearest/best) — the old logic
  // let a closer duplicate slip through as a second entry (Tusayan ×2).
  rows.sort((a, b) => (a.distanceMi + RANK[a.place] * 18) - (b.distanceMi + RANK[b.place] * 18));
  const seen = new Set(); const uniq = [];
  for (const r of rows) { const k = r.bare.toLowerCase(); if (seen.has(k)) continue; seen.add(k); uniq.push(r); }
  const ab = ST_ABBR[stateName] || (stateName && stateName.includes("/") ? ST_ABBR[stateName.split("/")[0].trim()] : "");
  return uniq.slice(0, TOP_N).map((r) => ({ name: ab ? r.bare + ", " + ab : r.bare, bareName: r.bare, lat: r.lat, lng: r.lng, distanceMi: r.distanceMi, source: "gnis" }));
}

async function pool(items, worker, c) {
  let i = 0, done = 0;
  const run = async () => { while (i < items.length) { const k = i++; await worker(items[k]); if (++done % 10 === 0 || done === items.length) console.log(`  … ${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: c }, run));
}

// Hand-verified editorial gateways (public/gateway-towns.js). These are the RIGHT
// basecamp per marquee park (Bar Harbor, Jackson, West Yellowstone…) and take rank 0.
function loadCurated() {
  try {
    const t = fs.readFileSync(path.join(ROOT, "public/gateway-towns.js"), "utf8");
    const m = t.match(/var T\s*=\s*(\{[\s\S]*?\});/);
    if (!m) return {};
    // eslint-disable-next-line no-eval
    return (0, eval)("(" + m[1] + ")");
  } catch { return {}; }
}
const curated = loadCurated();
const curatedKey = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const parks = parseArr("public/trip-data.js", "window.TRIP_PARKS");
let out = { generatedAt: new Date().toISOString(), source: "usgs-gnis+curated", parks: {}, forests: {} };
try { const prev = JSON.parse(fs.readFileSync(OUT, "utf8")); out.parks = prev.parks || {}; out.forests = prev.forests || {}; } catch {}
const flags = [];

console.log(`GNIS gateway towns for ${parks.length} parks …`);
await pool(parks, async (p) => {
  let towns = await townsFor(p.lat, p.lng, p.state);
  // Prepend the curated editorial gateway (rank 0) when we have one, and drop any
  // GNIS duplicate of it so it isn't listed twice.
  const c = curated[curatedKey(p.name)];
  if (c && c.town && c.lat != null) {
    const bare = c.town.split(",")[0].split("/")[0].trim();
    towns = towns.filter((t) => t.bareName.toLowerCase() !== bare.toLowerCase());
    towns.unshift({ name: c.town, bareName: bare, lat: c.lat, lng: c.lng, distanceMi: Math.round(distMi(p.lat, p.lng, c.lat, c.lng)), source: "curated" });
    towns = towns.slice(0, TOP_N);
  }
  out.parks[String(p.id)] = { name: p.name, state: p.state, lat: p.lat, lng: p.lng, towns };
  if (!towns.length) flags.push("NO TOWNS: " + p.name);
  else if (towns[0].distanceMi > 60) flags.push(`FAR (${towns[0].distanceMi}mi): ${p.name} → ${towns[0].name}`);
}, 4);
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const cov = Object.values(out.parks).filter((v) => v.towns.length).length;
console.log(`\n✓ parks with towns: ${cov}/${parks.length}`);
flags.forEach((f) => console.log("  ⚠ " + f));
