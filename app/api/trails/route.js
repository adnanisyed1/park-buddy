// Park Buddy — hiking / off-road / ski trails, served LIVE from the National
// Park Service's own trails GIS dataset (NPS_Public_Trails).
// GET /api/trails?parkCode=romo              → precise, all trails in that park unit
// GET /api/trails?lat=..&lng=..&radius=..(km) → bbox fallback (no park code known)
//
// This used to call OpenStreetMap/Overpass, which rate-limits and blocks
// datacenter/serverless IPs, and even a seed-then-cache workaround kept getting
// throttled. NPS_Public_Trails is the Park Service's own authoritative trails
// database — "lines representing formal and informal trails... within and
// across National Park Units" — served from a public ArcGIS REST API
// (mapservices.nps.gov) with no auth, no key, no rate limiting, and it's a
// BETTER fit than OSM ever was: filterable by the same park unit codes we
// already use (UNITCODE), and it only returns trails actually inside park units.
// Source: National Park Service (public domain).

export const runtime = "nodejs";
export const revalidate = 3600;

// Stored OSM trail geometry, keyed by NPS UNITCODE (scripts/build-trails.mjs).
// Starts as {} and grows park-by-park; the route is stored-FIRST with a live
// NPS fallback, so a partial file is always additive and never a regression —
// parks not in the store keep serving from live NPS below. This is the fix for
// nameless-NPS parks like Acadia (860 segments, 859 unnamed) where OSM has the
// real named trails. Data © OpenStreetMap contributors (ODbL).
import TRAIL_DATA from "../../lib/trail-data.json";

// Group a stored park's flat trail list into the {hiking,offroad,ski} buckets
// the frontend expects, honoring the same per-bucket caps as the live path.
function bucketsFromStore(list) {
  const seen = { hiking: {}, offroad: {}, ski: {} };
  const hiking = [], offroad = [], ski = [];
  const buckets = { hiking, offroad, ski };
  const caps = { hiking: 16, offroad: 10, ski: 10 };
  for (const t of list || []) {
    const cat = buckets[t.category] ? t.category : "hiking";
    const key = (t.name || "").toLowerCase();
    if (!key || seen[cat][key] || buckets[cat].length >= caps[cat]) continue;
    seen[cat][key] = true;
    buckets[cat].push(t);
  }
  return { hiking, offroad, ski };
}

const NPS_TRAILS_URL = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0/query";

// The stored path is simplified (~9 pts/mi) to keep the whole-country file
// small — great for list thumbnails, but on the single-trail detail map it cut
// across switchbacks and read as "off" against Google's basemap. For an
// osm-… id lookup (one trail, dedicated map) we fetch that object's FULL node
// geometry from the OSM API — crisp, no bloat to trail-data.json. Cached
// per-instance + a week at the edge; any failure falls back to the stored path.
const OSM_API = "https://api.openstreetmap.org/api/0.6";
const _fineCache = new Map();
function stitchWays(ways) {
  if (!ways.length) return null;
  const near = (a, b) => Math.abs(a[0] - b[0]) < 0.0006 && Math.abs(a[1] - b[1]) < 0.0006;
  const used = new Array(ways.length).fill(false);
  let cur = ways[0].slice(); used[0] = true;
  let added = true;
  while (added) {
    added = false;
    for (let i = 0; i < ways.length; i++) {
      if (used[i]) continue;
      const w = ways[i], head = cur[0], tail = cur[cur.length - 1];
      if (near(tail, w[0])) { cur = cur.concat(w.slice(1)); used[i] = added = true; }
      else if (near(tail, w[w.length - 1])) { cur = cur.concat(w.slice().reverse().slice(1)); used[i] = added = true; }
      else if (near(head, w[w.length - 1])) { cur = w.slice(0, -1).concat(cur); used[i] = added = true; }
      else if (near(head, w[0])) { cur = w.slice().reverse().slice(0, -1).concat(cur); used[i] = added = true; }
    }
  }
  return cur;
}
async function fetchOsmFine(osmId) {
  if (_fineCache.has(osmId)) return _fineCache.get(osmId);
  const m = /^osm-([wr])(\d+)$/.exec(osmId);
  if (!m) return null;
  const type = m[1] === "w" ? "way" : "relation";
  try {
    const r = await fetch(OSM_API + "/" + type + "/" + m[2] + "/full.json", {
      headers: { "User-Agent": "ParkBuddy/1.0 (theparkbuddy.com)" },
      next: { revalidate: 604800 }, signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) { _fineCache.set(osmId, null); return null; }
    const d = await r.json();
    const nodes = {};
    for (const el of d.elements || []) if (el.type === "node") nodes[el.id] = [+el.lat.toFixed(6), +el.lon.toFixed(6)];
    let path;
    if (type === "way") {
      const w = (d.elements || []).find((e) => e.type === "way");
      path = w ? w.nodes.map((n) => nodes[n]).filter(Boolean) : null;
    } else {
      const ways = (d.elements || []).filter((e) => e.type === "way").map((w) => w.nodes.map((n) => nodes[n]).filter(Boolean)).filter((a) => a.length > 1);
      path = stitchWays(ways);
    }
    if (!path || path.length < 2) { _fineCache.set(osmId, null); return null; }
    if (path.length > 3000) { const step = Math.ceil(path.length / 3000); path = path.filter((_, i) => i % step === 0 || i === path.length - 1); }
    _fineCache.set(osmId, path);
    return path;
  } catch { _fineCache.set(osmId, null); return null; }
}

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// TRLUSE is free text (not a clean coded domain) — e.g. "Hiker/Pedestrian",
// "ATV | Bike | Hike | Motorcycle", "Cross-Country Ski", "Non-Motorized". Map it
// to our three map layers; default to hiking (matches the old Overpass logic,
// which also treated "everything else" as a hiking way).
function categoryFor(trluse) {
  const v = String(trluse || "").toLowerCase();
  if (/non-motorized|non motorized/.test(v)) return "hiking";
  if (/\bski\b|snowmobile|snowshoe/.test(v)) return "ski";
  if (/\batv\b|all-terrain|four-wheel|motorcycle|motorized/.test(v)) return "offroad";
  return "hiking";
}
// Not real trails for our purposes (boat routes) — skip them.
function isWaterRoute(trluse) {
  return /watercraft|paddling|\bferry\b/i.test(String(trluse || ""));
}

// Many attribute fields are unpopulated per-trail (data readiness varies by
// park unit) and come back as literal "Unknown"/"NA" strings rather than null.
// Hide those rather than showing a placeholder in the UI.
function clean(v) {
  const s = String(v || "").trim();
  return !s || /^(unknown|na|n\/a|none)$/i.test(s) ? null : s;
}

// Downsample a path to <=maxPts points, keeping the first/last. The API's own
// maxAllowableOffset already generalizes server-side (some trails have 100k+
// raw vertices), this is just a final safety net to keep the map payload small.
function samplePath(path, maxPts) {
  if (!Array.isArray(path) || path.length <= maxPts) return path;
  const step = Math.max(1, Math.floor(path.length / maxPts));
  return path.filter((_, i) => i % step === 0 || i === path.length - 1);
}

// Real length from the (server-simplified but not yet downsampled) path —
// computed before samplePath() so the stat stays accurate even though the map
// rendering uses fewer points.
function pathLengthMi(path) {
  const R = 3958.8, toRad = Math.PI / 180;
  let mi = 0;
  for (let i = 1; i < path.length; i++) {
    const [lat1, lng1] = path[i - 1], [lat2, lng2] = path[i];
    const dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
    mi += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return mi;
}

// Shared field list + row-shaping so the bulk (parkCode/bbox) and single-id
// lookup modes stay in sync.
const OUT_FIELDS = "OBJECTID,TRLNAME,TRLUSE,TRLSURFACE,TRLCLASS,SEASONAL,SEASDESC,ACCESSNOTES,NOTES,UNITCODE,UNITNAME";

// Even after longestContinuousRun() splits out the biggest single obvious
// jump, a handful of smaller-but-still-implausible jumps can sum to a total
// that's clearly not one real named trail (seen live: 152.6mi -> 85.4mi after
// the jump-split alone, still absurd — RMNP's ENTIRE trail network is only
// ~355mi). No single NPS-catalogued trail feature legitimately runs this
// long; better to drop it than show fabricated-looking geometry.
const MAX_PLAUSIBLE_TRAIL_MI = 30;

function shapeTrail(a, longest, maxPts = 30) {
  const latLngPath = longest.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]);
  const lengthMi = +pathLengthMi(latLngPath).toFixed(1);
  if (lengthMi > MAX_PLAUSIBLE_TRAIL_MI) return null;
  return {
    id: a.OBJECTID,
    name: (a.TRLNAME || "").trim(),
    difficulty: clean(a.TRLCLASS) || "",
    path: samplePath(latLngPath, maxPts),
    // extra detail for the trail's own detail panel (not needed for the map line itself)
    lengthMi,
    surface: clean(a.TRLSURFACE),
    trailClass: clean(a.TRLCLASS),
    seasonal: a.SEASONAL === "Yes",
    seasonNote: clean(a.SEASDESC),
    notes: clean(a.NOTES) || clean(a.ACCESSNOTES),
    unitCode: clean(a.UNITCODE),
    unitName: clean(a.UNITNAME),
  };
}

function longestPath(f) {
  const paths = (f.geometry && f.geometry.paths) || [];
  let longest = null;
  for (const p of paths) {
    const run = longestContinuousRun(p);
    if (!longest || run.length > longest.length) longest = run;
  }
  return longest;
}

function milesBetweenXY(x1, y1, x2, y2) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (y2 - y1) * toRad, dLng = (x2 - x1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(y1 * toRad) * Math.cos(y2 * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// NPS_Public_Trails occasionally miscodes disconnected segments as one
// continuous line — seen live: a trail that came back as 152.6 mi, physically
// implausible for a single named trail. The signature is a multi-mile jump
// between two consecutive vertices (real trails wind continuously; even long
// straight stretches keep intermediate vertices at this simplification
// level). Split at any such jump and keep the longest contiguous run, rather
// than showing the whole broken line or discarding the trail entirely.
const MAX_JUMP_MI = 1;
function longestContinuousRun(path) {
  if (path.length < 3) return path;
  let bestStart = 0, bestLen = 1, curStart = 0, curLen = 1;
  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = path[i - 1], [x2, y2] = path[i];
    if (milesBetweenXY(x1, y1, x2, y2) > MAX_JUMP_MI) {
      if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
      curStart = i;
      curLen = 1;
    } else {
      curLen++;
    }
  }
  if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
  return path.slice(bestStart, bestStart + bestLen);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const parkCode = (searchParams.get("parkCode") || "").trim().toUpperCase();
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  const radiusKm = Math.min(parseInt(searchParams.get("radius") || "25", 10) || 25, 60);

  // Single-trail lookup by its NPS ArcGIS OBJECTID (stable per feature) — used
  // by /trail-status for a deep-linkable page instead of a bbox/park re-fetch.
  if (id) {
    // Stored OSM trails carry an "osm-…" id — resolve them from the store, not NPS.
    if (String(id).startsWith("osm-")) {
      for (const list of Object.values(TRAIL_DATA)) {
        const t = (list || []).find((x) => x.id === id);
        if (t) {
          const fine = await fetchOsmFine(id); // crisp line for the zoomed-in detail map
          return Response.json({ trail: { ...t, category: t.category || "hiking", path: fine || t.path }, credit: "© OpenStreetMap contributors (ODbL)" });
        }
      }
      return Response.json({ trail: null });
    }
    const idNum = parseInt(id, 10);
    if (!isFinite(idNum)) return Response.json({ trail: null });
    const params = new URLSearchParams({
      where: "OBJECTID=" + idNum,
      outFields: OUT_FIELDS,
      returnGeometry: "true",
      outSR: "4326",
      // Finer than the bulk query's 0.0003 (~30m) — this endpoint only ever
      // renders ONE trail (its own dedicated page/map), so there's no reason
      // to sacrifice contour fidelity for payload size the way the bulk
      // endpoint (up to 16+ trails at once) needs to.
      maxAllowableOffset: "0.00003",
      resultRecordCount: "1",
      f: "json",
    });
    try {
      const r = await fetch(NPS_TRAILS_URL + "?" + params.toString(), { next: { revalidate: 3600 } });
      if (!r.ok) return Response.json({ trail: null });
      const data = await r.json();
      const f = (data.features || [])[0];
      const longest = f && longestPath(f);
      if (!f || !longest || longest.length < 2) return Response.json({ trail: null });
      const trail = shapeTrail(f.attributes || {}, longest, 400);
      if (!trail) return Response.json({ trail: null });
      return Response.json({ trail: { ...trail, category: categoryFor(f.attributes.TRLUSE) }, credit: "National Park Service (public domain)" });
    } catch {
      return Response.json({ trail: null });
    }
  }

  // Stored-first: if we've ingested this park's OSM trails, serve them and skip
  // the live NPS call entirely. Any park NOT in the store falls through to the
  // live path below, so the store is purely additive.
  if (parkCode && Array.isArray(TRAIL_DATA[parkCode]) && TRAIL_DATA[parkCode].length) {
    return Response.json({ ...bucketsFromStore(TRAIL_DATA[parkCode]), credit: "© OpenStreetMap contributors (ODbL)" });
  }

  let where, geometryParams = {};
  if (parkCode) {
    where = "UNITCODE='" + parkCode.replace(/'/g, "") + "'";
  } else if (lat != null && lng != null) {
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    where = "1=1";
    geometryParams = {
      geometry: [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
    };
  } else {
    return Response.json({ error: "parkCode, or lat and lng, are required." }, { status: 400 });
  }

  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.0003", // ~30m simplification server-side
    resultRecordCount: "150",
    f: "json",
    ...geometryParams,
  });

  try {
    const r = await fetch(NPS_TRAILS_URL + "?" + params.toString(), { next: { revalidate: 3600 } });
    if (!r.ok) return Response.json({ hiking: [], offroad: [], ski: [], credit: "National Park Service" });
    const data = await r.json();
    const seen = { hiking: {}, offroad: {}, ski: {} };
    const hiking = [], offroad = [], ski = [];
    const buckets = { hiking, offroad, ski };
    const caps = { hiking: 16, offroad: 10, ski: 10 };

    for (const f of data.features || []) {
      const a = f.attributes || {};
      if (isWaterRoute(a.TRLUSE)) continue;
      const name = (a.TRLNAME || "").trim();
      if (!name) continue;
      const cat = categoryFor(a.TRLUSE);
      const key = name.toLowerCase();
      if (seen[cat][key] || buckets[cat].length >= caps[cat]) continue;

      const longest = longestPath(f);
      if (!longest || longest.length < 2) continue;

      const shaped = shapeTrail(a, longest);
      if (!shaped) continue;

      seen[cat][key] = true;
      buckets[cat].push(shaped);
    }

    return Response.json({ hiking, offroad, ski, credit: "National Park Service (public domain)" });
  } catch {
    return Response.json({ hiking: [], offroad: [], ski: [], credit: "National Park Service" });
  }
}
