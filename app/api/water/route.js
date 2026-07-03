// Park Buddy — lakes & water bodies, served LIVE from USGS GNIS.
// GET /api/water?lat=..&lng=..&radius=..(km)  → named lakes & reservoirs near a point.
//
// This used to call OpenStreetMap/Overpass, which rate-limits and blocks
// datacenter/serverless IPs — calls from Netlify reliably failed (429/504,
// timeouts), and even a local seed-then-cache workaround kept getting
// throttled mid-run. USGS GNIS (Geographic Names Information System) is the
// U.S. government's official named-features database — a public ArcGIS REST
// service, not a volunteer-run rate-limited one — and it answers bbox queries
// in well under a second with no auth, no key, and no seeding required.
// Source: The National Map, U.S. Geological Survey (public domain).

export const runtime = "nodejs";
export const revalidate = 3600;

const GNIS_URL = "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/7/query";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }
  const radiusKm = Math.min(parseInt(searchParams.get("radius") || "35", 10) || 35, 80);

  // Bounding box from a radius in km (degrees-per-km varies with latitude for longitude).
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const envelope = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(",");

  const params = new URLSearchParams({
    where: "gaz_featureclass IN ('Lake','Reservoir')",
    geometry: envelope,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "gaz_name,gaz_featureclass",
    returnGeometry: "true",
    resultRecordCount: "60",
    f: "json",
  });

  try {
    const r = await fetch(GNIS_URL + "?" + params.toString(), { next: { revalidate: 3600 } });
    if (!r.ok) return Response.json({ lakes: [], credit: "USGS GNIS / The National Map" });
    const data = await r.json();
    const seen = {}, lakes = [];
    for (const f of data.features || []) {
      const a = f.attributes || {}, g = f.geometry || {};
      const name = a.gaz_name;
      if (!name || seen[name.toLowerCase()]) continue;
      seen[name.toLowerCase()] = 1;
      const la = num(g.y), ln = num(g.x);
      if (la == null || ln == null) continue;
      lakes.push({ name, lat: la, lng: ln, kind: a.gaz_featureclass === "Reservoir" ? "reservoir" : "lake" });
      if (lakes.length >= 40) break;
    }
    return Response.json({ lakes, credit: "USGS GNIS / The National Map (public domain)" });
  } catch {
    return Response.json({ lakes: [], credit: "USGS GNIS / The National Map" });
  }
}
