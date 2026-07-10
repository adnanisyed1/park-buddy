// Build a SOLID, committed gateway-towns dataset so the app never depends on a live
// API call (OSM/GNIS) at request time for a known park or forest. Sweeps every
// national park (public/trip-data.js) + national forest (national-forests.json ∪
// forest-data.js) through the deployed /api/gateway (real OSM→GNIS ranking) once,
// with pacing + retries, and writes app/lib/gateway-data.json.
//
// Run:  PB_BASE=https://park-buddy-gamma.vercel.app node scripts/build-gateway-towns.mjs
// Re-run any time to refresh; it's idempotent and safe to commit the output.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.PB_BASE || "https://park-buddy-gamma.vercel.app";
const OUT = path.join(ROOT, "app/lib/gateway-data.json");
const PACE_MS = 500;      // delay between calls (be kind to the endpoint + upstream)
const RETRIES = 3;        // attempts per place
const TOP_N = 4;          // towns to keep per place

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-national-forests?$/, "");

function parseArr(file, varName) {
  const t = fs.readFileSync(path.join(ROOT, file), "utf8");
  const m = t.match(new RegExp(varName + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"));
  if (!m) throw new Error("Could not parse " + varName + " from " + file);
  return JSON.parse(m[1]);
}

// --- Sources -----------------------------------------------------------------
const parks = parseArr("public/trip-data.js", "window.TRIP_PARKS");

const nf = JSON.parse(fs.readFileSync(path.join(ROOT, "public/national-forests.json"), "utf8"));
const nfArr = Array.isArray(nf) ? nf : (nf.forests || []);
const fd = parseArr("public/forest-data.js", "window.FOREST_DATA");
// Union of both forest files, keyed by base slug (prefer national-forests.json,
// which is what the /forests/:slug pages resolve against).
const forestMap = new Map();
for (const f of [...nfArr, ...fd]) {
  const k = slug(f.name);
  if (k && !forestMap.has(k)) forestMap.set(k, f);
}
const forests = [...forestMap.entries()]; // [slug, {name,state,lat,lng}]

// --- Fetch one place. Retry only on a real error; an empty result is
// authoritative (the endpoint already fell back OSM→GNIS), so accept it at once. ---
async function gatewayFor(lat, lng, state) {
  const url = BASE + "/api/gateway?lat=" + lat + "&lng=" + lng + (state ? "&state=" + encodeURIComponent(state) : "");
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const towns = Array.isArray(d.towns) ? d.towns.slice(0, TOP_N) : [];
      const src = /gnis/i.test(d.credit || "") ? "gnis" : "osm";
      return { towns, townSource: towns.length ? src : "none" };
    } catch (e) {
      if (attempt === RETRIES) return { towns: [], townSource: "error", error: String(e.message || e) };
      await sleep(800 * attempt); // backoff only between error retries
    }
  }
  return { towns: [], townSource: "error" };
}

// Run tasks with a small concurrency pool so the slow remote (empty) calls overlap
// with the fast ones instead of blocking the whole sweep.
async function pool(items, worker, concurrency) {
  let idx = 0, done = 0;
  const total = items.length;
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
      done++;
      if (done % 10 === 0 || done === total) console.log(`  … ${done}/${total}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
}

// --- Sweep -------------------------------------------------------------------
// Merge into any existing file so a parks-only run doesn't wipe forests (and vice
// versa). PB_SCOPE = parks | forests | both (default both).
const SCOPE = process.env.PB_SCOPE || "both";
let out = { generatedAt: new Date().toISOString(), base: BASE, parks: {}, forests: {} };
try { const prev = JSON.parse(fs.readFileSync(OUT, "utf8")); out.parks = prev.parks || {}; out.forests = prev.forests || {}; } catch {}
const flags = [];
const save = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); };

function record(bucket, key, meta, res) {
  out[bucket][key] = { ...meta, towns: res.towns, townSource: res.townSource };
  const nearest = res.towns[0];
  if (!res.towns.length) flags.push(`⚠ NO TOWNS: ${meta.name} (${res.townSource})`);
  else if (nearest.distanceMi > 60) flags.push(`⚠ FAR (${nearest.distanceMi}mi): ${meta.name} → ${nearest.name}`);
}

console.log(`Sweeping (scope=${SCOPE}) via ${BASE} …`);

if (SCOPE === "parks" || SCOPE === "both") {
  console.log(`Parks (${parks.length}):`);
  await pool(parks, async (p) => {
    const res = await gatewayFor(p.lat, p.lng, p.state);
    record("parks", String(p.id), { name: p.name, state: p.state, lat: p.lat, lng: p.lng }, res);
  }, 4);
  save();
}

if (SCOPE === "forests" || SCOPE === "both") {
  console.log(`Forests (${forests.length}):`);
  await pool(forests, async ([key, f]) => {
    const res = await gatewayFor(f.lat, f.lng, f.state);
    record("forests", key, { name: f.name, state: f.state, lat: f.lat, lng: f.lng }, res);
  }, 4);
  save();
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const parkCov = Object.values(out.parks).filter((v) => v.towns.length).length;
const forestCov = Object.values(out.forests).filter((v) => v.towns.length).length;
console.log(`\n✓ Wrote ${OUT}`);
console.log(`Coverage — parks ${parkCov}/${parks.length}, forests ${forestCov}/${forests.length}`);
console.log(`\nFlags (${flags.length}):`);
flags.forEach((f) => console.log("  " + f));
