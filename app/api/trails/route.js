// Park Buddy — hiking / off-road / ski trails, served from the pre-seeded
// Supabase cache. GET /api/trails?lat=..&lng=..&radius=..(km)
//
// This used to call OpenStreetMap/Overpass live, but Overpass rate-limits and
// blocks datacenter/serverless IPs — calls from Netlify reliably failed. Data is
// now pre-fetched by scripts/seed-nearby.mjs (run from a network Overpass
// allows) and stored in Supabase (`pb_trails`) via /api/ingest-overpass. This
// route just reads that table — fast and reliable.
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
  const radiusKm = Math.min(parseInt(searchParams.get("radius") || "25", 10) || 25, 60);

  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!sb || !key) return Response.json({ hiking: [], offroad: [], ski: [], credit: "© OpenStreetMap contributors" });

  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const url =
    sb + "/rest/v1/pb_trails" +
    "?lat=gte." + (lat - dLat) + "&lat=lte." + (lat + dLat) +
    "&lng=gte." + (lng - dLng) + "&lng=lte." + (lng + dLng) +
    "&select=name,category,difficulty,path&limit=100";

  try {
    const r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key }, next: { revalidate: 3600 } });
    if (!r.ok) return Response.json({ hiking: [], offroad: [], ski: [], credit: "© OpenStreetMap contributors" });
    const rows = await r.json();
    const hiking = [], offroad = [], ski = [];
    (Array.isArray(rows) ? rows : []).forEach((t) => {
      const item = { name: t.name, difficulty: t.difficulty || "", path: t.path };
      if (t.category === "ski") ski.push(item);
      else if (t.category === "offroad") offroad.push(item);
      else hiking.push(item);
    });
    return Response.json({ hiking, offroad, ski, credit: "© OpenStreetMap contributors (ODbL)" });
  } catch {
    return Response.json({ hiking: [], offroad: [], ski: [], credit: "© OpenStreetMap contributors" });
  }
}
