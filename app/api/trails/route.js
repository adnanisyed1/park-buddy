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

const NPS_TRAILS_URL = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0/query";

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

function shapeTrail(a, longest) {
  const latLngPath = longest.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]);
  return {
    id: a.OBJECTID,
    name: (a.TRLNAME || "").trim(),
    difficulty: clean(a.TRLCLASS) || "",
    path: samplePath(latLngPath, 30),
    // extra detail for the trail's own detail panel (not needed for the map line itself)
    lengthMi: +pathLengthMi(latLngPath).toFixed(1),
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
  for (const p of paths) if (!longest || p.length > longest.length) longest = p;
  return longest;
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
    const idNum = parseInt(id, 10);
    if (!isFinite(idNum)) return Response.json({ trail: null });
    const params = new URLSearchParams({
      where: "OBJECTID=" + idNum,
      outFields: OUT_FIELDS,
      returnGeometry: "true",
      outSR: "4326",
      maxAllowableOffset: "0.0003",
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
      const trail = shapeTrail(f.attributes || {}, longest);
      return Response.json({ trail: { ...trail, category: categoryFor(f.attributes.TRLUSE) }, credit: "National Park Service (public domain)" });
    } catch {
      return Response.json({ trail: null });
    }
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

      seen[cat][key] = true;
      buckets[cat].push(shapeTrail(a, longest));
    }

    return Response.json({ hiking, offroad, ski, credit: "National Park Service (public domain)" });
  } catch {
    return Response.json({ hiking: [], offroad: [], ski: [], credit: "National Park Service" });
  }
}
