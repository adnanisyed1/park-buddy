// OSM POI enrichment for scenic drives. For a byway, fetch the actual road-line
// geometry from OpenStreetMap (Overpass) and every roadside attraction along the
// corridor — overlooks, mountain passes, campgrounds, waterfalls, roadside lakes,
// named peaks, trailheads, rest areas — filtered to within ~1 mile of the road and
// ordered by distance along the route. Writes `routeLine`, `routeSource`, and
// `pois[]` into public/byways/detail/<id>.json.
//
// This is the "scenic layer" the Wikipedia junction table can't provide (junctions
// are road intersections, not attractions). OSM data is ODbL — attribute it.
//
// Usage: PB_ONLY=beartooth-highway node scripts/enrich-byway-pois.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DETAIL_DIR = path.join(ROOT, "public/byways/detail");
const UA = "ParkBuddy/1.0 (byway POI enrichment; contact adnansyed899@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function parseArr(file, v) { const t = fs.readFileSync(path.join(ROOT, file), "utf8"); return JSON.parse(t.match(new RegExp(v + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"))[1]); }
function distMi(aLat, aLng, bLat, bLng) { const R = 3958.8, r = (d) => d * Math.PI / 180; const dLat = r(bLat - aLat), dLng = r(bLng - aLng); const s = Math.sin(dLat/2)**2 + Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.min(1, Math.sqrt(s))); }
const round5 = (n) => Math.round(n * 1e5) / 1e5;

const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
async function overpass(q) {
  for (let m = 0; m < MIRRORS.length; m++) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await fetch(MIRRORS[m], { method: "POST", body: q, headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } catch (e) { if (attempt === 2 && m === MIRRORS.length - 1) throw e; await sleep(1500); }
    }
  }
}

function lineMiles(line) { let m = 0; for (let i = 1; i < line.length; i++) m += distMi(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]); return m; }

// Stitch member ways into connected polylines (shared endpoints), then return the
// LONGEST connected chain — the main road, not a stray fragment.
function stitchLongest(ways) {
  const segs = ways.map((w) => (w.geometry || []).map((p) => [p.lat, p.lon])).filter((s) => s.length > 1);
  if (!segs.length) return [];
  const key = (p) => p[0].toFixed(6) + "," + p[1].toFixed(6);
  const used = new Array(segs.length).fill(false);
  const chains = [];
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    let line = segs[start].slice(); used[start] = true;
    let extended = true;
    while (extended) {
      extended = false;
      const head = line[0], tail = line[line.length - 1];
      for (let i = 0; i < segs.length; i++) {
        if (used[i]) continue;
        const s = segs[i], a = s[0], b = s[s.length - 1];
        if (key(tail) === key(a)) { line = line.concat(s.slice(1)); }
        else if (key(tail) === key(b)) { line = line.concat(s.slice().reverse().slice(1)); }
        else if (key(head) === key(b)) { line = s.slice().concat(line.slice(1)); }
        else if (key(head) === key(a)) { line = s.slice().reverse().concat(line.slice(1)); }
        else continue;
        used[i] = true; extended = true; break;
      }
    }
    chains.push(line);
  }
  return chains.sort((x, y) => lineMiles(y) - lineMiles(x))[0] || [];
}

function cumulativeMiles(line) {
  const m = [0];
  for (let i = 1; i < line.length; i++) m[i] = m[i - 1] + distMi(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
  return m;
}
// nearest vertex on the line → { dist(mi), mile }
function projectToLine(lat, lng, line, miles) {
  let best = Infinity, mile = null;
  for (let i = 0; i < line.length; i++) {
    const d = distMi(lat, lng, line[i][0], line[i][1]);
    if (d < best) { best = d; mile = miles[i]; }
  }
  return { dist: best, mile };
}
// Decimate for storage: keep points ≥ ~0.04 mi apart.
function decimate(line) {
  if (line.length < 3) return line;
  const out = [line[0]]; let last = line[0];
  for (let i = 1; i < line.length - 1; i++) { if (distMi(last[0], last[1], line[i][0], line[i][1]) >= 0.04) { out.push(line[i]); last = line[i]; } }
  out.push(line[line.length - 1]);
  return out.map((p) => [round5(p[0]), round5(p[1])]);
}

// POI category rules: keyword → { type label, radius(mi) to the road, cap }.
const CATS = [
  { type: "overlook", cap: 16, radius: 0.6, match: (t) => t.tourism === "viewpoint" },
  { type: "pass", cap: 12, radius: 1.0, match: (t) => t.mountain_pass === "yes" || t.natural === "saddle" },
  { type: "campground", cap: 16, radius: 1.0, match: (t) => t.tourism === "camp_site" },
  { type: "rest area", cap: 8, radius: 0.6, match: (t) => t.highway === "rest_area" },
  { type: "waterfall", cap: 10, radius: 1.0, match: (t) => t.waterway === "waterfall" },
  { type: "trailhead", cap: 16, radius: 0.4, match: (t) => t.highway === "trailhead" || t.tourism === "information" && t.information === "trailhead" },
  { type: "lake", cap: 14, radius: 0.5, match: (t) => t.natural === "water" || t.water },
  { type: "peak", cap: 8, radius: 0.6, match: (t) => t.natural === "peak" },
];
function categorize(tags) { for (const c of CATS) if (c.match(tags)) return c; return null; }

async function enrich(drive, detail) {
  const stops = (detail.itinerary || []).filter((s) => s.lat != null);
  if (stops.length < 2) return { skip: "no geocoded itinerary" };
  const lats = stops.map((s) => s.lat), lngs = stops.map((s) => s.lng);
  const pad = 0.12;
  const bbox = [Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad].map((n) => n.toFixed(4)).join(",");
  // DISTINCTIVE road-name keywords (drop generic words that match half of OSM).
  const GENERIC = /^(highway|byway|scenic|historic|road|route|parkway|skyway|trail|drive|national|state|memorial|coastal|loop|tour|the|of|county|us|interstate)$/i;
  const roadName = ((detail.source && detail.source.roadArticle) || drive.name).replace(/\s*\([^)]*\)/g, "");
  const kwList = roadName.split(/\s+/).filter((w) => /[A-Za-z]/.test(w) && w.length > 3 && !GENERIC.test(w));
  const kw = (kwList.length ? kwList : [drive.name.split(/\s+/)[0]]).join("|");

  // 1) road geometry: first pull named segments, learn their ref (e.g. "US 212"),
  //    then pull ALL segments with that ref (catches unnamed pieces) and stitch.
  const namedJ = await overpass(`[out:json][timeout:60];way["highway"]["name"~"${kw}",i](${bbox});out geom tags;`);
  let ways = (namedJ.elements || []).filter((e) => e.type === "way" && e.geometry && e.geometry.length > 1);
  const refs = [...new Set(ways.map((w) => (w.tags || {}).ref).filter(Boolean))].map((r) => r.replace(/[^A-Za-z0-9 ]/g, "").trim()).filter(Boolean);
  if (refs.length) {
    const refJ = await overpass(`[out:json][timeout:60];way["highway"]["ref"~"^(${refs.join("|")})$"](${bbox});out geom tags;`);
    const have = new Set(ways.map((w) => w.id));
    for (const e of (refJ.elements || [])) if (e.type === "way" && e.geometry && e.geometry.length > 1 && !have.has(e.id)) ways.push(e);
  }
  let line = stitchLongest(ways);
  if (line.length < 2) return { skip: "no road geometry (kw=" + kw + ")" };
  // orient start→end to match the itinerary direction
  if (distMi(line[0][0], line[0][1], stops[0].lat, stops[0].lng) > distMi(line[line.length - 1][0], line[line.length - 1][1], stops[0].lat, stops[0].lng)) line.reverse();
  const miles = cumulativeMiles(line);

  // 2) POI sweep
  const poiQ = `[out:json][timeout:80];
( node["tourism"="viewpoint"](${bbox});
  node["mountain_pass"="yes"](${bbox}); node["natural"="saddle"]["name"](${bbox});
  node["tourism"="camp_site"]["name"](${bbox});
  node["highway"="rest_area"]["name"](${bbox});
  node["waterway"="waterfall"]["name"](${bbox}); way["waterway"="waterfall"]["name"](${bbox});
  node["highway"="trailhead"]["name"](${bbox}); node["information"="trailhead"]["name"](${bbox});
  node["natural"="water"]["name"](${bbox}); way["natural"="water"]["name"](${bbox});
  node["natural"="peak"]["name"](${bbox});
);out center tags 400;`;
  const poiJ = await overpass(poiQ);

  const buckets = {};
  for (const el of (poiJ.elements || [])) {
    const t = el.tags || {}; const cat = categorize(t); if (!cat) continue;
    const lat = el.lat ?? (el.center && el.center.lat), lng = el.lon ?? (el.center && el.center.lon);
    if (lat == null) continue;
    let name = t.name || (cat.type === "overlook" ? "Scenic overlook" : null);
    if (!name) continue;
    const { dist, mile } = projectToLine(lat, lng, line, miles);
    if (dist > cat.radius) continue; // not roadside
    (buckets[cat.type] ||= []).push({ name, type: cat.type, lat: round5(lat), lng: round5(lng), mile: Math.round(mile * 10) / 10, ele: t.ele ? Math.round(+t.ele) : undefined, _d: dist });
  }
  // cap per category (closest-to-road first), then flatten + order by mile
  let pois = [];
  for (const c of CATS) {
    const arr = (buckets[c.type] || []);
    // de-dup by name
    const seen = new Set(); const uniq = arr.filter((p) => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.sort((a, b) => a._d - b._d);
    pois.push(...uniq.slice(0, c.cap));
  }
  pois.sort((a, b) => a.mile - b.mile);
  pois.forEach((p) => delete p._d);

  return { routeLine: decimate(line), routeSource: "OpenStreetMap", routeMiles: Math.round(miles[miles.length - 1]), pois, counts: pois.reduce((m, p) => ((m[p.type] = (m[p.type] || 0) + 1), m), {}) };
}

// ── main ──────────────────────────────────────────────────────────────────────
const all = parseArr("public/byways-data.js", "window.BYWAYS_DATA");
const only = (process.env.PB_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!only.length) { console.error("Set PB_ONLY=<id[,id...]>"); process.exit(1); }

for (const id of only) {
  const drive = all.find((d) => d.id === id);
  const file = path.join(DETAIL_DIR, id + ".json");
  if (!drive || !fs.existsSync(file)) { console.log("⚠ skip " + id + " (no drive/detail)"); continue; }
  const detail = JSON.parse(fs.readFileSync(file, "utf8"));
  try {
    const res = await enrich(drive, detail);
    if (res.skip) { console.log("⚠ " + id + ": " + res.skip); continue; }
    detail.routeLine = res.routeLine; detail.routeSource = res.routeSource; detail.routeMiles = res.routeMiles; detail.pois = res.pois;
    if (!detail.sources.some((s) => s.src === "osm")) detail.sources.push({ name: "OpenStreetMap contributors (ODbL)", src: "osm", url: "https://www.openstreetmap.org/copyright", retrievedAt: detail.generatedAt });
    fs.writeFileSync(file, JSON.stringify(detail));
    console.log(`✓ ${id}: route ${res.routeLine.length}pts / ~${res.routeMiles}mi · ${res.pois.length} POIs ` + JSON.stringify(res.counts));
  } catch (e) { console.log("⚠ " + id + ": " + (e.message || e)); }
}
