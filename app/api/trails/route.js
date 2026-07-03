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

// Downsample a path to <=maxPts points, keeping the first/last. The API's own
// maxAllowableOffset already generalizes server-side (some trails have 100k+
// raw vertices), this is just a final safety net to keep the payload small.
function samplePath(path, maxPts) {
  if (!Array.isArray(path) || path.length <= maxPts) return path;
  const step = Math.max(1, Math.floor(path.length / maxPts));
  return path.filter((_, i) => i % step === 0 || i === path.length - 1);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parkCode = (searchParams.get("parkCode") || "").trim().toUpperCase();
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  const radiusKm = Math.min(parseInt(searchParams.get("radius") || "25", 10) || 25, 60);

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
    outFields: "TRLNAME,TRLUSE",
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

      const paths = (f.geometry && f.geometry.paths) || [];
      // A feature can have multiple disconnected segments; use the longest.
      let longest = null;
      for (const p of paths) if (!longest || p.length > longest.length) longest = p;
      if (!longest || longest.length < 2) continue;

      seen[cat][key] = true;
      buckets[cat].push({
        name,
        difficulty: "",
        path: samplePath(longest.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]), 30),
      });
    }

    return Response.json({ hiking, offroad, ski, credit: "National Park Service (public domain)" });
  } catch {
    return Response.json({ hiking: [], offroad: [], ski: [], credit: "National Park Service" });
  }
}
