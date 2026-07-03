// Park Buddy — lakes & water bodies, served from the pre-seeded Supabase cache.
// GET /api/water?lat=..&lng=..&radius=..(km)  → named lakes & reservoirs near a point.
//
// This used to call OpenStreetMap/Overpass live, but Overpass rate-limits and
// blocks datacenter/serverless IPs — calls from Netlify reliably failed (504s,
// timeouts). Data is now pre-fetched by scripts/seed-nearby.mjs (run from a
// network Overpass allows) and stored in Supabase (`pb_places`, type=water) via
// /api/ingest-overpass. This route just reads that table — fast and reliable.
// Credit: © OpenStreetMap contributors (ODbL) — the data's origin, even cached.

export const runtime = "nodejs";
export const revalidate = 3600;

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }
  const radiusKm = Math.min(parseInt(searchParams.get("radius") || "35", 10) || 35, 80);

  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!sb || !key) return Response.json({ lakes: [], credit: "© OpenStreetMap contributors" });

  // Bounding box from a radius in km (degrees-per-km varies with latitude for longitude).
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const url =
    sb + "/rest/v1/pb_places?type=eq.water" +
    "&lat=gte." + (lat - dLat) + "&lat=lte." + (lat + dLat) +
    "&lng=gte." + (lng - dLng) + "&lng=lte." + (lng + dLng) +
    "&select=name,lat,lng&limit=40";

  try {
    const r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key }, next: { revalidate: 3600 } });
    if (!r.ok) return Response.json({ lakes: [], credit: "© OpenStreetMap contributors" });
    const rows = await r.json();
    const lakes = (Array.isArray(rows) ? rows : []).map((x) => ({ name: x.name, lat: x.lat, lng: x.lng, kind: "water" }));
    return Response.json({ lakes, credit: "© OpenStreetMap contributors (ODbL)" });
  } catch {
    return Response.json({ lakes: [], credit: "© OpenStreetMap contributors" });
  }
}
