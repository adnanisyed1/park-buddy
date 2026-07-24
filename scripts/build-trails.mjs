// Build a SOLID, committed NAMED-TRAIL dataset from OpenStreetMap so the app
// never depends on the live NPS_Public_Trails feed for trail NAMES. That feed
// has geometry but is almost entirely nameless per-park (Acadia: 860 segments,
// 859 with no TRLNAME), which leaves the "Trails & permits" tab and the
// /trail-status pages empty. OSM, by contrast, has richly NAMED trail geometry
// (Precipice, Beehive, Jordan Pond, Bald Peak …). We ingest it ONCE, here, and
// store named + stitched polylines in app/lib/trail-data.json keyed by NPS
// UNITCODE — the exact key /api/trails already serves against.
//
// Run:  node scripts/build-trails.mjs      (10–20 min; paces itself)
// Re-run any time; idempotent, safe to commit the output. Parks that return
// nothing are simply left out (the route falls back to the live NPS feed).
//
// Data: © OpenStreetMap contributors (ODbL). UNITNAME labels from the National
// Park Service NPS_Public_Trails index (public domain).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "app/lib/trail-data.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Park list + authoritative unit codes -----------------------------------
// window.NPS_CODE maps park id -> the 4-letter unit code; uppercased it IS the
// UNITCODE that /api/trails queries, so keying the output by it means the serve
// path needs no name matching at all.
function parseVar(file, varName) {
  const t = fs.readFileSync(path.join(ROOT, file), "utf8");
  const m = t.match(new RegExp(varName + "\\s*=\\s*([\\[{][\\s\\S]*?[\\]}]);"));
  if (!m) throw new Error("Could not parse " + varName + " from " + file);
  return JSON.parse(m[1]);
}
const PARKS = parseVar("public/trip-data.js", "window\\.TRIP_PARKS");
const NPS_CODE = parseVar("public/trip-data.js", "window\\.NPS_CODE");

// --- NPS UNITCODE -> UNITNAME index (for the display label only) ------------
async function fetchUnitNames() {
  const url =
    "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0/query" +
    "?where=1%3D1&outFields=UNITCODE,UNITNAME&returnGeometry=false&returnDistinctValues=true&f=json";
  const map = {};
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const j = await r.json();
    for (const f of j.features || []) {
      const a = f.attributes || {};
      if (a.UNITCODE && a.UNITNAME) map[a.UNITCODE.toUpperCase()] = a.UNITNAME;
    }
  } catch (e) {
    console.warn("  (NPS unit-name index unavailable — falling back to park names)", e.message);
  }
  return map;
}

// --- Overpass client: failover across endpoints, backoff on 429/504 ---------
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const BACKOFF = [8000, 16000, 32000];
let epRotate = 0;

async function overpass(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ep = OVERPASS[(epRotate + attempt) % OVERPASS.length];
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: {
          "User-Agent": "ParkBuddy/1.0 (trails ingest)",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(180000),
      });
      if (r.status === 429 || r.status === 504) {
        epRotate++;
        await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
        continue;
      }
      if (!r.ok) {
        epRotate++;
        await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
        continue;
      }
      return await r.json();
    } catch {
      epRotate++;
      await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
    }
  }
  return null; // unreachable after 4 tries across all endpoints
}

// Exact OSM boundary names for parks whose auto-generated candidates miss —
// diacritics/format quirks Overpass matches literally (verified via Overpass).
// Keyed by NPS UNITCODE; these are tried FIRST.
const NAME_OVERRIDE = {
  HAVO: ["Hawaiʻi Volcanoes National Park", "Volcanoes National Park"],
  WRST: ["Wrangell-Saint Elias National Park", "Wrangell - St Elias National Park and Preserve"],
};

// Candidate OSM area names for a park, most-likely first.
function candidates(name) {
  const base = name.trim();
  const out = [];
  const push = (s) => { s = (s || "").trim(); if (s && !out.includes(s)) out.push(s); };
  const noApos = base.replace(/['’ʻ]/g, "");
  const natExp = base.replace(/^Nat\.\s*Park/i, "National Park"); // "Nat. Park of American Samoa"
  push(base + " National Park");
  push(base + " National Park and Preserve");
  push(base + " National Park & Preserve");
  push(natExp);
  push(natExp + " National Park");
  push(base);
  push(noApos + " National Park");
  push(noApos + " National Park and Preserve");
  push(noApos);
  if (base.includes("&")) { const v = base.replace(/&/g, "and"); push(v + " National Park"); push(v + " National Park and Preserve"); push(v); }
  if (/\band\b/.test(base)) { const v = base.replace(/\band\b/g, "&"); push(v + " National Park"); push(v); }
  if (base.includes("–")) { const v = base.replace(/–/g, "-"); push(v + " National Park and Preserve"); push(v + " National Park"); push(v); }
  return out;
}

function buildQuery(osmName) {
  const n = osmName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[out:json][timeout:120];
area["boundary"~"national_park|protected_area"]["name"="${n}"]->.a;
(
  way(area.a)["highway"~"^(path|footway|track|steps|bridleway)$"]["name"];
  relation(area.a)["route"="hiking"]["name"];
);
out geom;`;
}

// --- Geometry helpers --------------------------------------------------------
function haversineMi(a, b) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad, dLng = (b[1] - a[1]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function pathLenMi(p) { let mi = 0; for (let i = 1; i < p.length; i++) mi += haversineMi(p[i - 1], p[i]); return mi; }
const near35m = (a, b) => haversineMi(a, b) * 1609.34 <= 35;

// Stitch a set of ways (each [[lat,lng]]) into one ordered polyline, starting
// from the longest and repeatedly joining any way whose endpoint is within 35m
// of the current line's start or end (flipping as needed). Pieces that never
// connect are dropped — the longest single way is always retained.
function stitch(ways) {
  if (ways.length === 1) return ways[0];
  const pool = ways.slice().sort((a, b) => b.length - a.length);
  let line = pool.shift().slice();
  let joined = true;
  while (joined && pool.length) {
    joined = false;
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      const ls = line[0], le = line[line.length - 1];
      const ws = w[0], we = w[w.length - 1];
      if (near35m(le, ws)) line = line.concat(w.slice(1));
      else if (near35m(le, we)) line = line.concat(w.slice().reverse().slice(1));
      else if (near35m(ls, we)) line = w.slice(0, -1).concat(line);
      else if (near35m(ls, ws)) line = w.slice().reverse().slice(0, -1).concat(line);
      else continue;
      pool.splice(i, 1); joined = true; break;
    }
  }
  return line;
}

// Concatenate relation member ways in order, flipping each member to align its
// nearer end to the growing line's tail (keeps the drawn line continuous).
function concatMembers(members) {
  let line = [];
  for (const m of members) {
    const g = (m.geometry || []).filter((pt) => pt && isFinite(pt.lat) && isFinite(pt.lon)).map((pt) => [pt.lat, pt.lon]);
    if (g.length < 2) continue;
    if (!line.length) { line = g; continue; }
    const tail = line[line.length - 1];
    const dStart = haversineMi(tail, g[0]);
    const dEnd = haversineMi(tail, g[g.length - 1]);
    line = line.concat(dEnd < dStart ? g.slice().reverse() : g);
  }
  return line;
}

function round5(p) { return p.map(([la, ln]) => [+la.toFixed(5), +ln.toFixed(5)]); }

// Ramer–Douglas–Peucker (iterative, degree-space) + hard point cap.
function perpDeg(p, a, b) {
  const dx = b[1] - a[1], dy = b[0] - a[0];
  if (dx === 0 && dy === 0) return Math.hypot(p[1] - a[1], p[0] - a[0]);
  const t = ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / (dx * dx + dy * dy);
  const cy = a[0] + t * dy, cx = a[1] + t * dx;
  return Math.hypot(p[1] - cx, p[0] - cy);
}
function rdp(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let dmax = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDeg(points[i], points[s], points[e]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps && idx !== -1) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}
function downsample(p, maxPts) {
  if (p.length <= maxPts) return p;
  const step = (p.length - 1) / (maxPts - 1);
  const out = [];
  for (let i = 0; i < maxPts; i++) out.push(p[Math.round(i * step)]);
  out[out.length - 1] = p[p.length - 1];
  return out;
}
function simplify(p, eps, maxPts) {
  let q = p.length > 3000 ? downsample(p, 3000) : p;
  q = rdp(q, eps);
  return downsample(q, maxPts);
}

// --- Category detection ------------------------------------------------------
function categoryForWay(tags) {
  const t = tags || {};
  const name = String(t.name || "").toLowerCase();
  if (t.route === "ski" || t["piste:type"] || /\bski\b|piste/.test(name)) return "ski";
  const motor = String(t.motor_vehicle || t["4wd_only"] || "").toLowerCase();
  if (t.route === "atv" || (t.highway === "track" && (motor === "yes" || t["4wd_only"] === "yes" || /4wd/.test(motor)))) return "offroad";
  return "hiking";
}

// --- Assemble one park's trails from an Overpass response --------------------
function assemble(elements, unitCode, unitName) {
  const ways = elements.filter((e) => e.type === "way" && Array.isArray(e.geometry));
  const rels = elements.filter((e) => e.type === "relation" && Array.isArray(e.members));

  const trails = [];
  const relNames = new Set();

  // Relations (route=hiking) first — they're the authoritative full route.
  for (const rel of rels) {
    const name = String((rel.tags || {}).name || "").trim();
    if (!name) continue;
    const memberWays = (rel.members || []).filter((m) => m.type === "way" && Array.isArray(m.geometry));
    const line = concatMembers(memberWays);
    if (line.length < 2) continue;
    relNames.add(name.toLowerCase());
    trails.push({ name, osmType: "r", osmId: rel.id, category: "hiking", raw: line });
  }

  // Ways grouped by name (skip names already covered by a relation).
  const byName = new Map();
  for (const w of ways) {
    const name = String((w.tags || {}).name || "").trim();
    if (!name || relNames.has(name.toLowerCase())) continue;
    const g = w.geometry.filter((pt) => pt && isFinite(pt.lat) && isFinite(pt.lon)).map((pt) => [pt.lat, pt.lon]);
    if (g.length < 2) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push({ id: w.id, tags: w.tags, geom: g });
  }
  for (const [name, group] of byName) {
    const line = stitch(group.map((g) => g.geom));
    if (line.length < 2) continue;
    // Longest contributing way supplies the stable id + the category vote.
    const longest = group.slice().sort((a, b) => b.geom.length - a.geom.length)[0];
    let cat = categoryForWay(longest.tags);
    // If any segment is clearly offroad/ski, prefer that classification.
    for (const g of group) { const c = categoryForWay(g.tags); if (c !== "hiking") { cat = c; break; } }
    trails.push({ name, osmType: "w", osmId: longest.id, category: cat, raw: line });
  }

  // Round, measure, drop tiny, keep raw for the later size-driven simplify pass.
  const out = [];
  for (const t of trails) {
    const rounded = round5(t.raw);
    const lengthMi = +pathLenMi(rounded).toFixed(2);
    if (lengthMi < 0.1) continue;
    out.push({
      id: "osm-" + t.osmType + t.osmId,
      name: t.name,
      _raw: rounded,
      lengthMi,
      category: t.category,
      difficulty: "",
      surface: null,
      trailClass: null,
      seasonal: false,
      seasonNote: null,
      notes: null,
      unitCode,
      unitName,
      source: "osm",
      osmId: t.osmId,
    });
  }
  out.sort((a, b) => b.lengthMi - a.lengthMi);
  return out;
}

// Render final paths from _raw at a given simplification + caps, then measure.
function render(rawData, { cap, eps, maxPts }) {
  const final = {};
  for (const [code, list] of Object.entries(rawData)) {
    final[code] = list.slice(0, cap).map((t) => {
      const { _raw, ...rest } = t;
      return { ...rest, path: simplify(_raw, eps, maxPts) };
    });
  }
  const json = JSON.stringify(final);
  return { final, bytes: Buffer.byteLength(json) };
}

// --- Main --------------------------------------------------------------------
(async () => {
  console.log("Building OSM trail dataset for", PARKS.length, "parks …\n");
  const unitNames = await fetchUnitNames();

  // Resumable + incremental (owner call — the first run wrote only at the end,
  // so a rate-limit stall lost everything). Load whatever's already stored,
  // fetch only the missing parks, and write after EACH park. Flags:
  //   --only=ACAD,YOSE  restrict to these unit codes (do the nameless ones first)
  //   --force           re-fetch parks already in the store
  const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const FORCE = process.argv.includes("--force");
  const PROFILE = { cap: 40, eps: 0.00012, maxPts: 250 };
  const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const skipped = [];
  const writeStore = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(store, null, 0)); };

  for (const p of PARKS) {
    const code = String(NPS_CODE[p.id] || "").toUpperCase();
    if (!code) { skipped.push(`${p.name} (no unit code)`); continue; }
    if (ONLY.length && !ONLY.includes(code)) continue;
    if (store[code] && store[code].length && !FORCE) { console.log(`  ⏭ ${p.name} [${code}] — already have ${store[code].length} trails`); continue; }
    const unitName = unitNames[code] || `${p.name} National Park`;

    let matchedName = null, elements = null, unreachable = false;
    for (const cand of [...(NAME_OVERRIDE[code] || []), ...candidates(p.name)]) {
      const res = await overpass(buildQuery(cand));
      if (res === null) { unreachable = true; break; } // total overpass failure
      const els = res.elements || [];
      if (els.length > 0) { matchedName = cand; elements = els; break; }
      await sleep(3000); // gentle pacing between candidate misses
    }

    if (unreachable) {
      console.log(`  ⚠ ${p.name} [${code}] — Overpass unreachable, skipped`);
      skipped.push(`${p.name} [${code}] (overpass unreachable)`);
      await sleep(4000);
      continue;
    }
    if (!elements) {
      console.log(`  – ${p.name} [${code}] — no OSM area/trails matched, skipped`);
      skipped.push(`${p.name} [${code}] (no OSM match)`);
      await sleep(4000);
      continue;
    }

    const trails = assemble(elements, code, unitName);
    if (trails.length) {
      store[code] = render({ [code]: trails }, PROFILE).final[code];
      writeStore(); // incremental — a later stall can no longer lose this park
      console.log(`  ✓ ${p.name} [${code}] — "${matchedName}" → ${store[code].length} trails (store: ${Object.keys(store).length} parks)`);
    } else {
      console.log(`  – ${p.name} [${code}] — "${matchedName}" matched but 0 usable trails, skipped`);
      skipped.push(`${p.name} [${code}] (0 usable trails)`);
    }
    await sleep(4000); // be kind to Overpass between parks
  }

  writeStore(); // final flush (no-op if nothing new)
  const bytes = Buffer.byteLength(JSON.stringify(store));
  const nParks = Object.keys(store).length;
  const nTrails = Object.values(store).reduce((s, l) => s + l.length, 0);
  console.log(`\n✓ ${OUT}`);
  console.log(`  parks with trails: ${nParks} · total trails: ${nTrails} · size: ${(bytes / 1048576).toFixed(2)} MB`);
  if (bytes > 6 * 1024 * 1024) console.log("  ⚠ over 6MB — tighten PROFILE (cap/eps/maxPts) and re-render.");
  console.log(`\nSkipped (${skipped.length}) — left to live NPS fallback:`);
  skipped.forEach((s) => console.log("  · " + s));
})();
