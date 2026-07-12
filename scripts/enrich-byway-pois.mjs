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
        const r = await fetch(MIRRORS[m], { method: "POST", body: q, headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120000) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } catch (e) { if (attempt === 2 && m === MIRRORS.length - 1) throw e; await sleep(3000); }
    }
  }
}

function lineMiles(line) { let m = 0; for (let i = 1; i < line.length; i++) m += distMi(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]); return m; }

// ── Wikimedia Commons photo gallery ─────────────────────────────────────────
async function commons(params) {
  const u = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", formatversion: "2", ...params });
  for (let a = 1; a <= 3; a++) {
    try { const r = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    catch { if (a === 3) return null; await sleep(800 * a); }
  }
}
const BAD_FILE = /\b(map|locator|diagram|logo|seal|sign|marker|plaque|nrhp|haer|lccn|survey|document|elevation profile|route)\b|\.(svg|tif|tiff|pdf|gif)$/i;
function filePhotos(pages, roadName) {
  const out = [];
  for (const p of (pages || [])) {
    const t = p.title || "";
    if (!/\.(jpe?g|png)$/i.test(t) || BAD_FILE.test(t)) continue;
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii || !ii.thumburl) continue;
    const m = ii.extmetadata || {};
    let artist = (m.Artist && m.Artist.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/unknown|not prov|^$/i.test(artist)) artist = ""; // messy/absent author → credit the license only
    const lic = (m.LicenseShortName && m.LicenseShortName.value) || "Wikimedia Commons";
    const cap = t.replace(/^File:/, "").replace(/\.[^.]+$/, "").replace(new RegExp(roadName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "")
      .replace(/\b(NARA|LCCN|HAER|WY|MT)\b[\s\d-]*$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    // the Commons file's own description (for the lightbox) — HTML stripped, deduped vs caption
    let desc = (m.ImageDescription && m.ImageDescription.value || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
    desc = desc.replace(/^.*?Original Caption:\s*/i, "").replace(/^Scope and content:\s*/i, "").trim(); // drop NARA archival boilerplate
    if (desc.toLowerCase() === cap.toLowerCase()) desc = "";
    // full-resolution image for the lightbox (drop the /thumb/…/NNNpx- wrapper)
    const full = (ii.url || ii.thumburl);
    out.push({ url: ii.thumburl, full, cap: (cap.slice(0, 70) || roadName), desc: desc.slice(0, 400), credit: (artist ? artist.slice(0, 60) + " · " : "") + lic, pageUrl: ii.descriptionurl });
  }
  return out;
}
async function commonsGallery(roadName, driveName) {
  const seen = new Set(); const gallery = [];
  const add = (arr) => { for (const p of arr) { if (seen.has(p.url)) continue; seen.add(p.url); gallery.push(p); } };
  // 1) the byway's own Commons category (the richest, on-topic source)
  for (const name of [...new Set([roadName, driveName])]) {
    if (gallery.length >= 18) break;
    const j = await commons({ action: "query", generator: "categorymembers", gcmtitle: "Category:" + name, gcmtype: "file", gcmlimit: "40", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1000" });
    add(filePhotos((j && j.query && j.query.pages) || [], name));
  }
  // 2) fallback: Commons file search on the road name
  if (gallery.length < 6) {
    const j = await commons({ action: "query", generator: "search", gsrsearch: roadName, gsrnamespace: "6", gsrlimit: "30", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1000" });
    add(filePhotos((j && j.query && j.query.pages) || [], roadName));
  }
  return gallery.slice(0, 18);
}

// Stitch member ways into connected polylines (shared endpoints), then bridge
// chains whose endpoints are within GAP_MI (OSM splits a road at junctions and
// name changes — e.g. Beartooth Hwy → "Broadway Ave" in Red Lodge — leaving tiny
// breaks), and return the longest resulting chain: the full road, terminus to terminus.
function stitchLongest(ways) {
  const segs = ways.map((w) => (w.geometry || []).map((p) => [p.lat, p.lon])).filter((s) => s.length > 1);
  if (!segs.length) return [];
  const key = (p) => p[0].toFixed(6) + "," + p[1].toFixed(6);
  const used = new Array(segs.length).fill(false);
  let chains = [];
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
  // bridge near-touching chains (small junction/name-change gaps)
  const GAP = 0.6;
  let merged = true;
  while (merged && chains.length > 1) {
    merged = false;
    outer: for (let i = 0; i < chains.length; i++) for (let j = i + 1; j < chains.length; j++) {
      const A = chains[i], B = chains[j];
      const combos = [[A[A.length - 1], B[0], false, false], [A[A.length - 1], B[B.length - 1], false, true], [A[0], B[0], true, false], [A[0], B[B.length - 1], true, true]];
      for (const [pa, pb, revA, revB] of combos) {
        if (distMi(pa[0], pa[1], pb[0], pb[1]) < GAP) {
          const a = revA ? A.slice().reverse() : A, b = revB ? B.slice().reverse() : B;
          chains[i] = a.concat(b); chains.splice(j, 1); merged = true; break outer;
        }
      }
    }
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

// natural=water also tags fountains, swimming pools, stock tanks, borrow pits and
// sewage/retention basins — tiny non-lakes that drop a "lake" pin on a street or
// pullout. Filter them out (by tag + name) so only real lakes/ponds/reservoirs show.
// Keep the famous exception "…Blue Pool" (Tamolitch).
const JUNK_WATER_NAME = /\b(fountains?|tanks?|(?:borrow|gravel|sand)\s*pits?|sewage|treatment|retention|detention|wastewater|settling|effluent|clarifier|stormwater|storage|sediment|reclaimed|(?:reflecting|reflection|sports|swimming|lap)\s*pools?)\b/i;
function isJunkWater(t) {
  if (t.amenity === "fountain" || t.leisure === "swimming_pool" || t.landuse === "basin") return true;
  const n = t.name || "";
  return JUNK_WATER_NAME.test(n) && !/blue\s*pool/i.test(n);
}

async function enrich(drive, detail) {
  const roadName0 = ((detail.source && detail.source.roadArticle) || drive.name).replace(/\s*\([^)]*\)/g, "");
  // Photo gallery is independent of route geometry — fetch it first so even
  // history-only byways (no junction table) and giant parkways (route too big for
  // one Overpass call) still get a Commons photo gallery.
  const gallery = await commonsGallery(roadName0, drive.name);
  // Only a Wikipedia junction-table itinerary counts as "real" — an OSM-synthesized
  // one (from a prior run) must not block re-synthesis, so exclude src=openstreetmap.
  const stops = (detail.itinerary || []).filter((s) => s.lat != null && s.src !== "openstreetmap");
  const hasItin = stops.length >= 2;
  // Without a junction-table itinerary we can still build a route straight from OSM
  // by the road's name/number, anchored on the drive's own coordinate — as long as
  // it has a real point (not a state-centroid approxLoc).
  if (!hasItin && (drive.lat == null || drive.approxLoc)) return { gallery, routeLine: null, routeSource: null, routeMiles: null, pois: [], counts: {} };
  try {
  let bbox;
  if (hasItin) {
    const lats = stops.map((s) => s.lat), lngs = stops.map((s) => s.lng), pad = 0.12;
    bbox = [Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad].map((n) => n.toFixed(4)).join(",");
  } else {
    // search box around the drive's anchor; the route RELATION's full geometry is
    // returned regardless, so this only needs to intersect the road, not contain it.
    const pad = 0.85;
    bbox = [drive.lat - pad, drive.lng - pad, drive.lat + pad, drive.lng + pad].map((n) => n.toFixed(4)).join(",");
  }
  // DISTINCTIVE road-name keywords (drop generic words that match half of OSM).
  const GENERIC = /^(highway|byway|scenic|historic|road|route|parkway|skyway|trail|drive|national|state|memorial|coastal|loop|tour|the|of|county|us|interstate)$/i;
  const roadName = ((detail.source && detail.source.roadArticle) || drive.name).replace(/\s*\([^)]*\)/g, "");
  const kwWords = [...new Set((roadName + " " + drive.name).split(/\s+/).filter((w) => /[A-Za-z]/.test(w) && w.length > 3 && !GENERIC.test(w)))];
  const kw = (kwWords.length ? kwWords : [drive.name.split(/\s+/)[0]]).join("|");
  // Route NUMBER (e.g. "12" from "Utah State Route 12" / "Scenic Byway 12") — when the
  // name is all generic words + a number, the number is the only distinctive handle.
  const numM = (roadName + " " + drive.name).match(/\b(?:route|highway|byway|sr|us|hwy|road|state)\s*(\d{1,3})\b/i) || roadName.match(/\b(\d{1,3})\b/);
  const roadNum = numM ? numM[1] : null;

  // 1) road geometry — PREFER the OSM route RELATION (the authoritative, byway-bounded
  //    ordered set of member ways, incl. name-changed segments like a town's main
  //    street). Match by name, then by route ref/number. Fall back to named + ref'd ways.
  let ways = [];
  const safeOP = async (q) => { try { return await overpass(q); } catch { return null; } }; // a slow relation shouldn't kill the drive — fall through to ways
  // Pick the relation whose NAME best matches this byway (a keyword query can return
  // several coast/scenic relations — e.g. "Big Sur…" vs "…North Coast Byway" — so
  // score by distinctive shared tokens, not just member count).
  const wantTokens = [...new Set((drive.name + " " + roadName0).toLowerCase().split(/[^a-z0-9]+/))].filter((w) => w.length >= 3 && !GENERIC.test(w) && w !== "coast");
  const relScore = (r) => { const n = ((r.tags || {}).name || "").toLowerCase(); return wantTokens.filter((w) => n.includes(w)).length; };
  const pickRel = (j) => {
    const rels = (j && j.elements || []).filter((e) => e.type === "relation" && (e.members || []).length);
    if (!rels.length) return null;
    return rels.sort((a, b) => relScore(b) - relScore(a) || (b.members.length - a.members.length))[0];
  };
  let rel = pickRel(await safeOP(`[out:json][timeout:120];relation["type"="route"]["route"="road"]["name"~"${kw}",i](${bbox});out geom;`));
  // A relation whose NAME clearly matches this byway (≥2 distinctive tokens) IS the
  // byway — trust its full geometry as-is (no length trim, no fragment rejection,
  // even if our stored lengthMi is wrong, e.g. inherited from the parent highway).
  let bywayRelation = !!(rel && relScore(rel) >= 2);
  if (!rel && roadNum) rel = pickRel(await safeOP(`[out:json][timeout:120];relation["type"="route"]["route"="road"]["ref"~"(^| )${roadNum}$"](${bbox});out geom;`));
  if (rel) ways = rel.members.filter((m) => m.type === "way" && m.geometry && m.geometry.length > 1).map((m) => ({ geometry: m.geometry }));
  if (ways.length < 2) {
    // fallback: named segments → learn their ref (e.g. "US 212") → pull all ref'd ways
    const namedJ = await overpass(`[out:json][timeout:120];way["highway"]["name"~"${kw}",i](${bbox});out geom tags;`);
    ways = (namedJ.elements || []).filter((e) => e.type === "way" && e.geometry && e.geometry.length > 1);
    const refs = [...new Set(ways.map((w) => (w.tags || {}).ref).filter(Boolean))].map((r) => r.replace(/[^A-Za-z0-9 ]/g, "").trim()).filter(Boolean);
    if (!refs.length && roadNum) refs.push(".* " + roadNum, roadNum);
    if (refs.length) {
      const refJ = await overpass(`[out:json][timeout:120];way["highway"]["ref"~"^(${refs.join("|")})$"](${bbox});out geom tags;`);
      const have = new Set(ways.map((w) => w.id));
      for (const e of (refJ.elements || [])) if (e.type === "way" && e.geometry && e.geometry.length > 1 && !have.has(e.id)) ways.push(e);
    }
  }
  let line = stitchLongest(ways);
  if (line.length < 2) return { gallery, routeLine: null, routeSource: null, routeMiles: null, pois: [], counts: {}, note: "no road geometry (kw=" + kw + ")" };
  // reject stray pieces beyond the byway: trim the line to the span between the
  // itinerary termini is unnecessary if the relation is byway-bounded, but guard by
  // checking the last stop is reachable below.
  // orient start→end to match the itinerary direction (when we have one)
  if (hasItin && distMi(line[0][0], line[0][1], stops[0].lat, stops[0].lng) > distMi(line[line.length - 1][0], line[line.length - 1][1], stops[0].lat, stops[0].lng)) line.reverse();
  let miles = cumulativeMiles(line);

  // Trim to the byway's OWN extent so a route-number match that pulled the whole
  // numbered highway (e.g. all of US-30, or A1A end to end) is cut to just the byway.
  // With an itinerary: span the first→last stop. Without one: a length-sized window
  // around the drive's anchor. Only trim when it removes a meaningful chunk.
  const projIdx = (lat, lng) => { let bd = Infinity, bi = 0; for (let i = 0; i < line.length; i++) { const d = distMi(lat, lng, line[i][0], line[i][1]); if (d < bd) { bd = d; bi = i; } } return bi; };
  let i0 = 0, i1 = line.length - 1;
  if (hasItin) {
    const gi = (detail.itinerary || []).filter((s) => s.lat != null);
    i0 = projIdx(gi[0].lat, gi[0].lng); i1 = projIdx(gi[gi.length - 1].lat, gi[gi.length - 1].lng);
    if (i0 > i1) { const t = i0; i0 = i1; i1 = t; }
  } else if (!bywayRelation && drive.lengthMi > 0 && miles[miles.length - 1] > drive.lengthMi * 1.4) {
    // only when the match is a whole numbered highway, far longer than the byway —
    // NOT when we matched the byway's own relation (already the right length).
    const c = projIdx(drive.lat, drive.lng), half = drive.lengthMi / 2;
    while (i0 < c && miles[c] - miles[i0] > half) i0++;
    while (i1 > c && miles[i1] - miles[c] > half) i1--;
  }
  const dropStart = miles[i0], dropEnd = miles[miles.length - 1] - miles[i1];
  if (i1 - i0 >= 1 && (dropStart > 4 || dropEnd > 4)) { line = line.slice(i0, i1 + 1); miles = cumulativeMiles(line); }

  // Reject a route built straight from OSM (no itinerary to bound it) when it comes
  // out far shorter than the byway's real length — that's a stub near the anchor, not
  // the road. Better an honest pointer + gallery than a misleading fragment. (Diffuse
  // multi-road routes like Route 66 / Great River Road / a ferry system land here.)
  if (!hasItin && !bywayRelation && drive.lengthMi > 0 && miles[miles.length - 1] < 0.4 * drive.lengthMi) {
    return { gallery, routeLine: null, routeSource: null, routeMiles: null, pois: [], counts: {}, note: "route fragment " + Math.round(miles[miles.length - 1]) + "mi ≪ byway " + drive.lengthMi + "mi" };
  }

  // Snap itinerary pins ONTO the real road line so every numbered marker sits on the
  // drawn route (and pin the two termini to the road's ends). Only when there IS an
  // itinerary — routes built straight from OSM have no stops to snap.
  if (hasItin) {
    const nearestOnLine = (lat, lng) => { let bd = Infinity, bp = null; for (const p of line) { const d = distMi(lat, lng, p[0], p[1]); if (d < bd) { bd = d; bp = p; } } return bp; };
    const geoIdx = (detail.itinerary || []).map((s, i) => (s.lat != null ? i : -1)).filter((i) => i >= 0);
    for (const i of geoIdx) { const s = detail.itinerary[i]; const bp = nearestOnLine(s.lat, s.lng); if (bp) { s.lat = round5(bp[0]); s.lng = round5(bp[1]); } }
    if (geoIdx.length) {
      const f = detail.itinerary[geoIdx[0]], l = detail.itinerary[geoIdx[geoIdx.length - 1]];
      f.lat = round5(line[0][0]); f.lng = round5(line[0][1]); delete f.snapped;
      l.lat = round5(line[line.length - 1][0]); l.lng = round5(line[line.length - 1][1]); delete l.snapped;
    }
  }

  // 2) POI sweep — query AROUND the route line (within ~1 mi), not a giant bounding
  //    box. On a 400-mi byway the bbox is enormous and Overpass times out; an
  //    around-the-polyline query only looks near the road, so it's fast at any length.
  const spacing = Math.max(0.7, lineMiles(line) / 250); // cap the around polyline at ~250 pts
  const ap = []; let lastP = null;
  for (const p of line) { if (!lastP || distMi(lastP[0], lastP[1], p[0], p[1]) >= spacing) { ap.push(p[0].toFixed(5), p[1].toFixed(5)); lastP = p; } }
  const around = "around:1700," + ap.join(",");
  const poiQ = `[out:json][timeout:120];
( node["tourism"="viewpoint"](${around});
  node["mountain_pass"="yes"](${around}); node["natural"="saddle"]["name"](${around});
  node["tourism"="camp_site"]["name"](${around});
  node["highway"="rest_area"]["name"](${around});
  node["waterway"="waterfall"]["name"](${around}); way["waterway"="waterfall"]["name"](${around});
  node["highway"="trailhead"]["name"](${around}); node["information"="trailhead"]["name"](${around});
  node["natural"="water"]["name"](${around}); way["natural"="water"]["name"](${around});
  node["natural"="peak"]["name"](${around});
);out center tags 500;`;
  const poiJ = await overpass(poiQ);

  const buckets = {};
  for (const el of (poiJ.elements || [])) {
    const t = el.tags || {}; const cat = categorize(t); if (!cat) continue;
    if (cat.type === "lake" && isJunkWater(t)) continue; // fountains, pools, stock tanks, sewage basins → not lakes
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

  // No junction table → synthesize a stop flow from the towns along the road + the
  // two termini, so the page shows the same numbered "stop by stop" itinerary as the
  // junction-based drives (fixes routed drives that had a route but no stops).
  if (!hasItin) {
    const total = miles[miles.length - 1];
    let towns = [];
    try {
      const tj = await overpass(`[out:json][timeout:120];( node["place"~"^(city|town|village)$"]["name"](${around}); );out tags 300;`);
      for (const el of (tj.elements || [])) {
        const nm = (el.tags || {}).name; if (!nm) continue;
        const pr = projectToLine(el.lat, el.lon, line, miles); if (pr.dist > 1.3) continue;
        towns.push({ place: nm, mileFromStart: Math.round(pr.mile * 10) / 10, kind: "town", lat: round5(el.lat), lng: round5(el.lon) });
      }
    } catch {}
    towns.sort((a, b) => a.mileFromStart - b.mileFromStart);
    const nearestTown = (m) => towns.slice().sort((a, b) => Math.abs(a.mileFromStart - m) - Math.abs(b.mileFromStart - m))[0];
    const cleanName = roadName0.replace(/ *(Scenic Byway|All-?American Road|Historic( and)?|Coastal|National|Byway).*$/i, "").trim() || drive.name;
    const term = (pt, m, first) => ({ place: (nearestTown(m) || {}).place || (cleanName + (first ? " (start)" : " (end)")), mileFromStart: Math.round(m * 10) / 10, kind: "terminus", lat: round5(pt[0]), lng: round5(pt[1]) });
    // marquee POIs are the real "stops" on a park road with no towns (overlooks,
    // passes, waterfalls) — include them so the flow isn't just two generic termini.
    const marquee = pois.filter((p) => ["overlook", "pass", "waterfall"].includes(p.type))
      .map((p) => ({ place: p.name, mileFromStart: p.mile, kind: p.type === "overlook" ? "overlook" : "crossing", lat: p.lat, lng: p.lng }));
    const seenM = new Set();
    let mid = [...towns.filter((t) => t.mileFromStart > 1 && t.mileFromStart < total - 1),
      ...marquee.filter((m) => m.mileFromStart > 0.5 && m.mileFromStart < total - 0.5)]
      .sort((a, b) => a.mileFromStart - b.mileFromStart)
      .filter((s) => { const k = s.place.toLowerCase(); if (seenM.has(k) || !/[A-Za-z]/.test(s.place)) return false; seenM.add(k); return true; })
      .slice(0, 14);
    let flow = [term(line[0], 0, true), ...mid, term(line[line.length - 1], total, false)];
    flow.forEach((s, i) => { s.seq = i + 1; s.src = "openstreetmap"; s.control = []; s.note = s.kind === "terminus" ? (i === 0 ? "The drive begins here" : "The drive ends here") : ""; });
    for (let i = 0; i < flow.length - 1; i++) if (flow[i].mileFromStart != null && flow[i + 1].mileFromStart != null) flow[i].toNextMi = Math.round((flow[i + 1].mileFromStart - flow[i].mileFromStart) * 10) / 10;
    if (flow.length >= 3) detail.itinerary = flow; // ≥1 real stop between the termini
  }

  return { routeLine: decimate(line), routeSource: "OpenStreetMap", routeMiles: Math.round(miles[miles.length - 1]), pois, gallery, counts: pois.reduce((m, p) => ((m[p.type] = (m[p.type] || 0) + 1), m), {}) };
  } catch (e) {
    // Overpass timeout/failure on a giant route → keep the gallery, drop the route.
    return { gallery, routeLine: null, routeSource: null, routeMiles: null, pois: [], counts: {}, note: "osm error: " + (e.message || e) };
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
const all = parseArr("public/byways-data.js", "window.BYWAYS_DATA");
// PB_ONLY=<id[,id...]> for a hand-picked set, or PB_TIER=<tier> to sweep a whole
// FHWA tier (e.g. national-scenic-byway). Drives with no detail file are skipped
// (need a Wikipedia base-ingest first); resume is cheap via the done/gallery skip.
const tier = (process.env.PB_TIER || "").trim();
let only = (process.env.PB_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!only.length && tier) only = all.filter((d) => d.tier === tier).map((d) => d.id);
if (!only.length) { console.error("Set PB_ONLY=<id[,id...]> or PB_TIER=<tier>"); process.exit(1); }

for (const id of only) {
  const drive = all.find((d) => d.id === id);
  const file = path.join(DETAIL_DIR, id + ".json");
  if (!drive || !fs.existsSync(file)) { console.log("⚠ skip " + id + " (no drive/detail)"); continue; }
  const detail = JSON.parse(fs.readFileSync(file, "utf8"));
  const done = detail.routeLine && detail.pois && detail.gallery;
  const noItin = !(detail.itinerary || []).some((s) => s.lat != null);
  const cantRoute = drive.approxLoc || drive.lat == null; // no anchor to build a route from either
  const galleryTerminal = detail.gallery && detail.gallery.length && noItin && cantRoute;
  if (!process.env.PB_FORCE && (done || galleryTerminal)) { console.log("· skip (done) " + id); continue; }
  try {
    const res = await enrich(drive, detail);
    if (res.skip) { console.log("⚠ " + id + ": " + res.skip); continue; }
    detail.routeLine = res.routeLine; detail.routeSource = res.routeSource; detail.routeMiles = res.routeMiles; detail.pois = res.pois; detail.gallery = res.gallery;
    if (!detail.sources.some((s) => s.src === "osm")) detail.sources.push({ name: "OpenStreetMap contributors (ODbL)", src: "osm", url: "https://www.openstreetmap.org/copyright", retrievedAt: detail.generatedAt });
    fs.writeFileSync(file, JSON.stringify(detail));
    console.log(`✓ ${id}: ` + (res.routeLine ? `route ${res.routeLine.length}pts / ~${res.routeMiles}mi · ${res.pois.length} POIs · ` : "gallery-only · ") + `${(res.gallery || []).length} photos` + (res.note ? ` (${res.note})` : ""));
  } catch (e) { console.log("⚠ " + id + ": " + (e.message || e)); }
}
