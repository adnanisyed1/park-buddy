// Flagship lakes per place — the lakes a visitor would actually drive to,
// stored as fixed data so no page ever waits on a federal server at request
// time.
//
//   node scripts/build-flagship-lakes.mjs            # crawl + write
//   node scripts/build-flagship-lakes.mjs --emit     # rebuild output from cache only
//
// WHY STORED: NHD (the only source that knows a lake's SIZE) answered in ~2s
// one morning and 50-60s the same evening. Request-time dependence on that is
// a coin flip per cache window — Broken Bow Lake appearing and disappearing
// from Ouachita's page with federal server load. Lakes don't move; this is
// fixed data, and fixed data gets generated and committed (same reasoning as
// place-geo.json and gateway-ranked.json).
//
// WHY GATED: "40 named waterbodies" is noise. The owner's rule (2026-07-21,
// from the shore of Broken Bow Lake): show a lake if people can GO there and
// there's evidence of it — a government-operated recreation presence on the
// water. Evidence, not opinion:
//   · RIDB (Recreation.gov) campgrounds / rec areas / facilities within 4mi
//     of the lake's center — queried through OUR deployed /api/places, which
//     holds the key and layers the Supabase pb_places cache + OSM camps.
//   · OR the lake is huge (>= 15 km²). RIDB is federal-only; a big
//     state-managed reservoir is still a destination even when RIDB is
//     silent about it.
// The gate is binary and the evidence is stored on the lake, so the UI can
// say "2 campgrounds · marina" instead of implying a ranking.
//
// Overpass-crawl etiquette applies to NHD too: one request at a time, a pause
// between places, generous timeouts, and a per-place checkpoint cache so a
// crash or a slow evening never loses finished work. Re-running skips places
// already cached; --emit rebuilds the output without any network at all.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEO = JSON.parse(readFileSync(join(HERE, "../app/lib/place-geo.json"), "utf8"));
const OUT = join(HERE, "../app/lib/lake-data.json");
const CACHE_DIR = join(HERE, ".lake-cache");

const NHD_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query";
// The deployed preview carries RIDB_API_KEY + the Supabase cache; local dev
// usually doesn't. Point PLACES_BASE elsewhere (e.g. http://localhost:3001)
// if you have keys locally.
const PLACES_BASE =
  process.env.PLACES_BASE ||
  "https://park-buddy-git-trip-studio-redesign-the-park-buddy.vercel.app";

const MIN_LAKE_KM2 = 2;    // below this GNIS "nearest ponds" already covers it
const BIG_ANYWAY_KM2 = 15; // a lake this size is a destination with or without RIDB
const REC_RADIUS_MI = 4;   // "on the shore", allowing for big lakes' size
const PER_PLACE = 15;      // NHD fetch depth; the gate decides what survives

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = (id) => id.replace(/[^a-z0-9-]+/gi, "_");

async function fetchJson(url, { tries = 3, timeoutMs = 120000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) return await r.json();
      // 5xx: worth another try after a pause; 4xx: it won't get better.
      if (r.status < 500) return null;
    } catch { /* timeout or network — retry */ }
    await sleep(3000 * (i + 1));
  }
  return null;
}

async function nhdLakes(bbox) {
  const pad = 0.1; // a flagship ON the boundary still belongs to the place
  const env = [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad].join(",");
  const p = new URLSearchParams({
    where: `AREASQKM>${MIN_LAKE_KM2} AND GNIS_NAME <> ' '`,
    geometry: env,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326", outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GNIS_NAME,AREASQKM,FTYPE",
    returnGeometry: "true",
    geometryPrecision: "3",
    maxAllowableOffset: "0.01",
    orderByFields: "AREASQKM DESC",
    resultRecordCount: String(PER_PLACE),
    f: "json",
  });
  const data = await fetchJson(NHD_URL + "?" + p);
  if (!data || data.error) return null; // null = "failed", distinct from "no lakes"
  const seen = new Set();
  const lakes = [];
  for (const f of data.features || []) {
    const a = f.attributes || {};
    const rings = f.geometry?.rings;
    const name = (a.GNIS_NAME || "").trim();
    if (!name || !rings?.length || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const ring of rings) for (const pt of ring) {
      if (pt[0] < minx) minx = pt[0];
      if (pt[0] > maxx) maxx = pt[0];
      if (pt[1] < miny) miny = pt[1];
      if (pt[1] > maxy) maxy = pt[1];
    }
    lakes.push({
      name,
      lat: Math.round(((miny + maxy) / 2) * 1e4) / 1e4,
      lng: Math.round(((minx + maxx) / 2) * 1e4) / 1e4,
      kind: a.FTYPE === "Reservoir" ? "reservoir" : "lake",
      sizeKm2: Math.round(a.AREASQKM * 10) / 10,
    });
  }
  return lakes;
}

// Government-operated recreation on this shore, via our own API (RIDB +
// pb_places cache + OSM camps behind it). Counts only — the gate is binary
// and the UI states facts.
async function recEvidence(lake) {
  const u = `${PLACES_BASE}/api/places?lat=${lake.lat}&lng=${lake.lng}&radius=${REC_RADIUS_MI}`;
  const data = await fetchJson(u, { tries: 2, timeoutMs: 30000 });
  // Response shape verified on Broken Bow Lake itself: {facilities:[],
  // recAreas:[]} — and RIDB knows that lake BY NAME as a rec area, with three
  // USACE facilities on the shore. Exactly the evidence the gate wants.
  const facilities = (data && data.facilities) || [];
  const recAreas = (data && data.recAreas) || [];
  return {
    facilities: facilities.length,
    recAreas: recAreas.length,
    // A rec area named after the lake is the strongest possible signal;
    // stored so the UI can lead with it.
    namedRecArea: recAreas.some((r) =>
      String(r.name || "").toLowerCase().includes(lake.name.toLowerCase())),
    total: facilities.length + recAreas.length,
  };
}

export async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const emitOnly = process.argv.includes("--emit");
  const ids = Object.keys(GEO.places);
  let done = 0, failed = 0;

  if (!emitOnly) {
    for (const id of ids) {
      const cacheFile = join(CACHE_DIR, safe(id) + ".json");
      if (existsSync(cacheFile)) { done++; continue; }
      const place = GEO.places[id];
      if (!place.bbox) { writeFileSync(cacheFile, JSON.stringify({ id, lakes: [] })); done++; continue; }

      const lakes = await nhdLakes(place.bbox);
      if (lakes === null) {
        // No checkpoint written: a rerun retries this place. A written empty
        // result would be indistinguishable from "genuinely no lakes".
        failed++;
        console.log(`✗ ${id} — NHD failed, will retry on next run`);
        await sleep(2000);
        continue;
      }
      for (const lake of lakes) {
        lake.rec = await recEvidence(lake);
        await sleep(300);
      }
      writeFileSync(cacheFile, JSON.stringify({ id, lakes }, null, 1));
      done++;
      const kept = lakes.filter(passesGate).length;
      console.log(`✓ ${id} — ${lakes.length} lakes fetched, ${kept} pass the gate (${done}/${ids.length})`);
      await sleep(1500);
    }
  }

  // Emit from cache — the only step --emit runs.
  const out = { generatedAt: new Date().toISOString(), places: {} };
  let total = 0;
  for (const id of ids) {
    const cacheFile = join(CACHE_DIR, safe(id) + ".json");
    if (!existsSync(cacheFile)) continue;
    const { lakes } = JSON.parse(readFileSync(cacheFile, "utf8"));
    const kept = (lakes || []).filter(passesGate);
    if (kept.length) { out.places[id] = kept; total += kept.length; }
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\nWrote ${OUT}: ${Object.keys(out.places).length} places, ${total} lakes` +
    (failed ? ` — ${failed} places failed, rerun to retry them` : ""));
}

function passesGate(lake) {
  return (lake.rec && lake.rec.total >= 1) || lake.sizeKm2 >= BIG_ANYWAY_KM2;
}

// pathToFileURL, not a template literal: the repo path contains a space.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
