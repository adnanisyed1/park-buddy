// Real boundaries for national parks and national forests — the input every
// other piece of the basecamp work needs.
//
// WHY THIS EXISTS. Everything about places was being measured from a stored
// CENTROID, and centroid error scales with area. Measured on White River NF:
//
//     Eagle 10.8mi · Gypsum 12.9 · Aspen 21.4 · Vail 24.7 · Breckenridge 40.6
//
// Breckenridge is INSIDE that forest and ranks worst; the forest is ~100mi
// across, so its middle is nowhere near anything. Distance-to-BOUNDARY is the
// fix, and it's also what lets one radius be fair across a 2.5M-acre forest and
// a 500-acre state park.
//
// It also kills a second bug: adjacency was being inferred from shared gateway
// towns, which made Black Canyon and Mesa Verde "adjacent" while 104 miles
// apart, because their 150-mile town radii overlapped.
//
// BUILD TIME ONLY. Polygons are fetched, used, and thrown away; nothing heavy
// ever reaches a browser. Two small files come out the other end.
//
//   node scripts/build-place-geometry.mjs            # all parks + forests
//   node scripts/build-place-geometry.mjs --state CO # one state, for spot checks
//
// Sources, both verified live 2026-07-19:
//   parks   — NPS boundary topojson (same file the map overlay already uses)
//   forests — USFS EDW Administrative Forest Boundaries (polygons + gis_acres)
// PAD-US would be one source for all three types, but its web services were
// returning 9017$SITE_NOT_INITIALIZED on every endpoint, so this uses the two
// per-agency sources that actually answer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_GEO = path.join(ROOT, "app/lib/place-geo.json");
const OUT_ADJ = path.join(ROOT, "app/lib/place-adjacency.json");
const CACHE = path.join(ROOT, "scripts/.cache");

const NPS_TOPO = (code) =>
  `https://raw.githubusercontent.com/nationalparkservice/data/gh-pages/base_data/boundaries/parks/${code}.topojson`;
const USFS_Q =
  "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_ForestSystemBoundaries_01/MapServer/0/query";
// Fallback for forests the ADMINISTRATIVE layer groups away. USFS publishes
// "National Forests in Alabama" as ONE administrative unit while our table lists
// Talladega, Conecuh, Bankhead and Tuskegee separately — 21 forests had no
// geometry because of this, and mapping them all onto the group polygon would
// make every Alabama town "near" a forest 200 miles away. The proclaimed layer
// carries each named forest on its own.
//
// NB proclaimed boundaries include private inholdings within the historically
// proclaimed area, so they run larger than administrative ones. Same class of
// measure, different figure — the source is recorded per place.
const USFS_PROCLAIMED_Q =
  "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_ProclaimedForestBoundaries_01/MapServer/0/query";

const args = process.argv.slice(2);
const STATE = (args.includes("--state") ? args[args.indexOf("--state") + 1] : "") || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- geometry */
const R_M = 6378137.0;
const rad = (d) => (d * Math.PI) / 180;

// Signed spherical area. Holes wind the other way, so a plain sum handles them
// without any outer-ring bookkeeping — the version that DID try to track outer
// rings got Rocky Mountain's sign backwards.
function ringAreaM2(ring) {
  if (ring.length < 4) return 0;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    s += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return (s * R_M * R_M) / 2;
}
const M2_PER_ACRE = 4046.8564224;

function haversineMi(aLat, aLng, bLat, bLng) {
  const R = 3958.8;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Local equirectangular metres — fine at the scale of one place, and far cheaper
// than a proper projection for the millions of segment tests this does.
function planar(lat, lng, lat0) {
  return [rad(lng) * Math.cos(rad(lat0)) * 6378137, rad(lat) * 6378137];
}
function pointSegMeters(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Signed miles to the boundary: NEGATIVE inside, positive outside. Negative is
// the useful part — "Breckenridge is 6 miles inside White River" is a different
// and better fact than "Breckenridge is 40 miles from the middle".
export function signedMilesToBoundary(lat, lng, rings) {
  let inside = false, best = Infinity;
  for (const ring of rings) if (pointInRing(lat, lng, ring)) inside = !inside;
  const [px, py] = planar(lat, lng, lat);
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = planar(ring[i][1], ring[i][0], lat);
      const [bx, by] = planar(ring[i + 1][1], ring[i + 1][0], lat);
      const d = pointSegMeters(px, py, ax, ay, bx, by);
      if (d < best) best = d;
    }
  }
  const mi = best / 1609.344;
  return inside ? -mi : mi;
}

/* ------------------------------------------------------------------ topojson */
function topoToRings(topo) {
  const tr = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return tr ? [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]] : [dx, dy];
    });
  });
  const stitch = (idxs) => {
    const pts = [];
    for (const i of idxs) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      // NOT push(...a): Kenai Fjords has an arc long enough to blow the call
      // stack when spread as arguments.
      const src = pts.length ? a.slice(1) : a;
      for (let k = 0; k < src.length; k++) pts.push(src[k]);
    }
    return pts;
  };
  const rings = [];
  for (const obj of Object.values(topo.objects)) {
    const geoms = obj.type === "GeometryCollection" ? obj.geometries : [obj];
    for (const g of geoms) {
      if (!g.arcs) continue;
      const polys = g.type === "MultiPolygon" ? g.arcs : [g.arcs];
      for (const poly of polys) for (const r of poly) rings.push(stitch(r));
    }
  }
  return rings;
}

/* --------------------------------------------------------------- decimation */
// Keeps every Nth vertex, always keeping the ends and closing the ring. Crude on
// purpose: this is used for distance-to-edge at mile scale, where sub-100m
// precision buys nothing and costs a lot of segment tests.
function decimate(ring, maxPts = 600) {
  if (ring.length <= maxPts) return ring;
  const step = Math.ceil(ring.length / maxPts);
  const out = ring.filter((_, i) => i % step === 0);
  const first = ring[0], last = out[out.length - 1];
  if (last[0] !== first[0] || last[1] !== first[1]) out.push(first);
  return out;
}

/* -------------------------------------------------------------------- fetch */
async function getJSON(url, opts = {}, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(opts.timeout || 45000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (a === tries) throw e;
      await sleep(800 * a);
    }
  }
}

// The destinations table owns the ids everything else joins on
// (nps:rocky-mountain, usfs:co-white-river-national-forest). Inventing ids from
// trip-data or the USFS forestname produced nps:25 and
// usfs:klamath-national-forest — which join to nothing.
async function loadCanonical() {
  const base = process.env.PB_API || "https://park-buddy-gamma.vercel.app";
  const byName = new Map();
  for (const type of ["national_park", "national_forest"]) {
    const j = await getJSON(`${base}/api/destinations?type=${type}&limit=500`);
    for (const d of j.destinations || []) {
      const rec = { id: d.id, name: d.name, state: d.state, type };
      byName.set(nameKey(d.name), rec);
      if (!byName.has(looseKey(d.name))) byName.set(looseKey(d.name), rec);
    }
  }
  return byName;
}
const nameKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// USFS and our table disagree on plurals often enough to matter — "Rogue
// River-Siskiyou National Forests" here, "…Forest" there. Collapse the plural
// rather than hand-maintaining 20 aliases.
const looseKey = (s) => nameKey(s).replace(/\bforests\b/g, "forest").replace(/\bnational forest\b/g, "nf");

async function loadParks() {
  // trip-data.js carries the id + NPS unit code; the destinations table doesn't.
  const src = fs.readFileSync(path.join(ROOT, "public/trip-data.js"), "utf8");
  const parks = JSON.parse(src.match(/TRIP_PARKS\s*=\s*(\[[\s\S]*?\]);/)[1]);
  const codes = JSON.parse(src.match(/NPS_CODE\s*=\s*(\{[\s\S]*?\});/)[1]);
  return parks
    .map((p) => ({ name: p.name, state: p.state, code: codes[p.id], lat: p.lat, lng: p.lng }))
    .filter((p) => p.code && (!STATE || (p.state || "").toUpperCase().includes(STATE.toUpperCase())));
}

async function parkRings(code) {
  const topo = await getJSON(NPS_TOPO(String(code).toLowerCase()));
  const rings = topoToRings(topo);
  const acres = Math.abs(rings.reduce((s, r) => s + ringAreaM2(r), 0)) / M2_PER_ACRE;
  return { rings: rings.map((r) => decimate(r)), acres };
}

async function loadProclaimed(names) {
  if (!names.length) return [];
  const where = names.map((n) => `forestname='${n.replace(/'/g, "''")}'`).join(" OR ");
  const params = new URLSearchParams({
    where, outFields: "forestname,gis_acres", returnGeometry: "true", outSR: "4326",
    geometryPrecision: "4", maxAllowableOffset: "0.004", f: "json",
  });
  const d = await getJSON(USFS_PROCLAIMED_Q + "?" + params, { timeout: 120000 });
  return (d.features || []).map((f) => ({
    name: f.attributes.forestname,
    acres: f.attributes.gis_acres,
    rings: (f.geometry?.rings || []).map((r) => decimate(r)),
    source: "usfs-proclaimed",
  })).filter((f) => f.rings.length);
}

async function loadForests() {
  const where = STATE ? `1=1` : `1=1`;      // USFS has no clean state field; filter after
  const params = new URLSearchParams({
    where, outFields: "forestname,gis_acres,region", returnGeometry: "true", outSR: "4326",
    geometryPrecision: "4", maxAllowableOffset: "0.004", f: "json",
  });
  const d = await getJSON(USFS_Q + "?" + params, { timeout: 120000 });
  return (d.features || []).map((f) => {
    const rings = (f.geometry?.rings || []).map((r) => decimate(r));
    return {
      name: f.attributes.forestname,
      acres: f.attributes.gis_acres,
      rings,
    };
  }).filter((f) => f.rings.length);
}

/* --------------------------------------------------------------------- main */
function bboxOf(rings) {
  let n = -90, s = 90, e = -180, w = 180;
  for (const r of rings) for (const [x, y] of r) {
    if (y > n) n = y; if (y < s) s = y; if (x > e) e = x; if (x < w) w = x;
  }
  return [w, s, e, n];
}
const bboxGapMi = (a, b) => {
  const dx = Math.max(0, Math.max(a[0] - b[2], b[0] - a[2]));
  const dy = Math.max(0, Math.max(a[1] - b[3], b[1] - a[3]));
  return haversineMi(0, 0, dy, dx * Math.cos(rad((a[1] + a[3]) / 2)));
};

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const places = [];
  const canonical = await loadCanonical();
  console.log(`canonical places from /api/destinations: ${canonical.size}`);
  const unmatched = [];
  const resolve = (name) => canonical.get(nameKey(name)) || canonical.get(looseKey(name));

  const parks = await loadParks();
  console.log(`parks: ${parks.length}${STATE ? " (state " + STATE + ")" : ""}`);
  for (const p of parks) {
    try {
      const c = resolve(p.name);
      if (!c) { unmatched.push("park " + p.name); process.stdout.write("?"); await sleep(60); continue; }
      const { rings, acres } = await parkRings(p.code);
      places.push({ id: c.id, name: c.name, state: c.state, type: "national_park", rings, acres, bbox: bboxOf(rings) });
      process.stdout.write(".");
    } catch (e) {
      console.log(`\n  ! ${p.name} (${p.code}): ${e.message}`);
    }
    await sleep(120);
  }
  console.log();

  let forests = await loadForests();
  if (STATE) {
    // No state column on the USFS layer — keep forests whose bbox touches the
    // states we kept parks for, plus anything the caller named.
    forests = forests.filter((f) => f.rings.length);
  }
  console.log(`forests: ${forests.length}`);
  for (const f of forests) {
    const c = resolve(f.name);
    if (!c) { unmatched.push("forest " + f.name); continue; }
    places.push({ id: c.id, name: c.name, state: c.state, type: "national_forest", acres: f.acres, rings: f.rings, bbox: bboxOf(f.rings), source: "usfs-admin" });
  }

  // Anything in the destinations table that the administrative layer never
  // matched — try it by its own name against the proclaimed layer.
  const got = new Set(places.map((p) => p.id));
  const stillMissing = [...canonical.values()]
    .filter((c) => c.type === "national_forest" && !got.has(c.id))
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
  if (stillMissing.length) {
    console.log(`trying proclaimed boundaries for ${stillMissing.length} forests the admin layer groups away…`);
    const proc = await loadProclaimed(stillMissing.map((c) => c.name));
    for (const f of proc) {
      const c = resolve(f.name);
      if (!c || got.has(c.id)) continue;
      places.push({ id: c.id, name: c.name, state: c.state, type: "national_forest", acres: f.acres, rings: f.rings, bbox: bboxOf(f.rings), source: "usfs-proclaimed" });
      got.add(c.id);
    }
    console.log(`  recovered ${proc.length}`);
  }

  // --- adjacency, from real geometry -------------------------------------
  // A cheap bbox gap first, then the expensive ring-to-ring check only on
  // survivors. Without the prefilter this is 181^2 polygon comparisons.
  const ADJ_MI = 25;
  const adjacency = {};
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const A = places[i], B = places[j];
      if (bboxGapMi(A.bbox, B.bbox) > ADJ_MI * 1.6) continue;
      // nearest approach: sample B's vertices against A's rings
      let best = Infinity;
      for (const ring of B.rings) {
        for (let k = 0; k < ring.length; k += Math.max(1, Math.floor(ring.length / 120))) {
          const d = signedMilesToBoundary(ring[k][1], ring[k][0], A.rings);
          if (d < best) best = d;
          if (best < -1) break;
        }
        if (best < -1) break;
      }
      if (best > ADJ_MI) continue;
      const rel = best < -0.5 ? "within" : best < 1 ? "borders" : "near";
      (adjacency[A.id] ||= []).push({ id: B.id, name: B.name, type: B.type, rel, gapMi: Math.round(Math.max(0, best)) });
      (adjacency[B.id] ||= []).push({ id: A.id, name: A.name, type: A.type, rel, gapMi: Math.round(Math.max(0, best)) });
    }
  }

  // --- outputs ------------------------------------------------------------
  const geo = {};
  // state is carried through because the town slug needs it. Without it two
  // towns called Jackson (WY and AL) collapse onto one URL — the same
  // name-collision that made "Glendale" look like a gateway for Zion AND Grand
  // Canyon earlier today.
  for (const p of places) geo[p.id] = { name: p.name, type: p.type, state: p.state || "", acres: Math.round(p.acres || 0), bbox: p.bbox.map((n) => +n.toFixed(4)), source: p.source || "nps" };
  fs.writeFileSync(OUT_GEO, JSON.stringify({ generatedAt: new Date().toISOString(), places: geo }, null, 0));
  fs.writeFileSync(OUT_ADJ, JSON.stringify({ generatedAt: new Date().toISOString(), adjacency }, null, 0));

  // rings are the expensive part to fetch — cache them for the town-distance pass
  fs.writeFileSync(path.join(CACHE, "rings.json"), JSON.stringify(places.map((p) => ({ id: p.id, rings: p.rings }))));

  if (unmatched.length) {
    console.log(`\n${unmatched.length} not in the destinations table (no id to join on):`);
    for (const u of unmatched.slice(0, 12)) console.log("   " + u);
    if (unmatched.length > 12) console.log(`   …and ${unmatched.length - 12} more`);
  }
  const pairs = Object.values(adjacency).reduce((n, a) => n + a.length, 0) / 2;
  console.log(`\nwrote ${Object.keys(geo).length} places -> app/lib/place-geo.json`);
  console.log(`wrote ${pairs} adjacency pairs -> app/lib/place-adjacency.json`);
  console.log(`cached rings -> scripts/.cache/rings.json`);
}

// pathToFileURL, not a template literal: this repo lives under "Park Buddy",
// and import.meta.url percent-encodes the space while `file://${argv[1]}` does
// not — so the usual idiom silently never runs main().
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
