// Park Buddy — destinations read API (for the map & search).
// GET /api/destinations?lat=..&lng=..&radius=120     nearby destinations (miles)
//     /api/destinations?bbox=minLng,minLat,maxLng,maxLat
//     /api/destinations?q=roxborough                  name search
//     &type=state_park|national_forest                optional filter
//
// Reads the Supabase `destinations` table via the public anon key (read-only, RLS-protected).
// If Supabase isn't configured it returns an empty list so the app keeps working.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MI = 1 / 69; // ~degrees per mile (lat)

export async function GET(request) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!sb || !key) return Response.json({ destinations: [], note: "destinations table not configured" });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const id = searchParams.get("id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500);

  let filter = "";
  if (id) {
    // Exact lookup by namespaced id (e.g. usfs:co-white-river-national-forest).
    // Used by the park-status page to resolve a destination on direct navigation.
    filter = "&id=eq." + encodeURIComponent(id);
  } else if (q) {
    filter = "&name=ilike.*" + encodeURIComponent(q) + "*";
  } else if (searchParams.get("bbox")) {
    const [minLng, minLat, maxLng, maxLat] = searchParams.get("bbox").split(",").map(Number);
    filter = `&lat=gte.${minLat}&lat=lte.${maxLat}&lng=gte.${minLng}&lng=lte.${maxLng}`;
  } else {
    const lat = parseFloat(searchParams.get("lat")), lng = parseFloat(searchParams.get("lng"));
    const radius = parseFloat(searchParams.get("radius") || "120");
    if (isFinite(lat) && isFinite(lng)) {
      const dLat = radius * MI, dLng = radius * MI / Math.max(Math.cos(lat * Math.PI / 180), 0.2);
      filter = `&lat=gte.${(lat - dLat).toFixed(4)}&lat=lte.${(lat + dLat).toFixed(4)}&lng=gte.${(lng - dLng).toFixed(4)}&lng=lte.${(lng + dLng).toFixed(4)}`;
    }
  }
  if (type) filter += "&type=eq." + encodeURIComponent(type);

  const url = sb + "/rest/v1/destinations?select=id,name,type,source,lat,lng,state,url,tier" + filter + "&order=tier.asc&limit=" + limit;
  try {
    const r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key } });
    if (!r.ok) return Response.json({ destinations: [], error: "supabase " + r.status });
    const rows = await r.json();
    return Response.json({
      destinations: rows,
      count: rows.length,
      credit: "PAD-US / OpenStreetMap contributors (ODbL) · USGS · state agencies",
    });
  } catch (e) {
    return Response.json({ destinations: [], error: String(e.message || e).slice(0, 120) });
  }
}
