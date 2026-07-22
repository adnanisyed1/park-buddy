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
// NHD large-scale waterbodies — the layer that knows how BIG a lake is. GNIS
// (below) knows only names and points, so "nearest 40" over a 100-mile box
// fills with ponds near the center while Broken Bow Lake (57 km², 98km out)
// never makes the cut. Discovered standing on that lake. The small-scale NHD
// layer is no substitute: its biggest features carry blank GNIS_NAMEs.
const NHD_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// The region's major lakes by surface area, largest first. Geometry comes back
// generalized (maxAllowableOffset) and we only need a marker position, so the
// ring bounds' center is plenty. Best-effort: any failure returns [] and the
// caller falls back to pure GNIS, which is exactly the old behavior.
async function flagshipLakes(envelope) {
  const p = new URLSearchParams({
    where: "AREASQKM>2 AND GNIS_NAME <> ' '",
    geometry: envelope,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GNIS_NAME,AREASQKM,FTYPE",
    returnGeometry: "true",
    geometryPrecision: "3",
    maxAllowableOffset: "0.01",
    orderByFields: "AREASQKM DESC",
    resultRecordCount: "15",
    f: "json",
  });
  try {
    // NHD's response time swings from ~2s to 60s+ with server load. Eight
    // seconds is the budget: past that the page ships GNIS-only (the old
    // behavior) rather than hanging every park page on a federal server's
    // bad evening. Healthy responses are cached an hour, so one good fetch
    // covers a place for a while.
    const r = await fetch(NHD_URL + "?" + p.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.features || [])
      .map((f) => {
        const a = f.attributes || {};
        const rings = f.geometry && f.geometry.rings;
        const name = (a.GNIS_NAME || "").trim();
        if (!name || !rings || !rings.length) return null;
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for (const ring of rings) for (const pt of ring) {
          if (pt[0] < minx) minx = pt[0];
          if (pt[0] > maxx) maxx = pt[0];
          if (pt[1] < miny) miny = pt[1];
          if (pt[1] > maxy) maxy = pt[1];
        }
        return {
          name,
          lat: (miny + maxy) / 2,
          lng: (minx + maxx) / 2,
          kind: a.FTYPE === "Reservoir" ? "reservoir" : "lake",
          sizeKm2: Math.round(a.AREASQKM * 10) / 10,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }
  // Cap at 161km (100mi) — the largest radius any caller uses (the park/forest
  // status page). This was 80, which SILENTLY halved that request: a 2.7M-acre
  // forest like Ouachita had its far corners cut off, and a visitor standing on
  // Broken Bow Lake (98km from the stored center) couldn't find it on the
  // forest's own page. GNIS bbox queries answer in well under a second at this
  // size, and the result cap below bounds the payload regardless.
  const radiusKm = Math.min(parseInt(searchParams.get("radius") || "35", 10) || 35, 161);

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
    resultRecordCount: "150",
    f: "json",
  });

  try {
    const r = await fetch(GNIS_URL + "?" + params.toString(), { next: { revalidate: 3600 } });
    if (!r.ok) return Response.json({ lakes: [], credit: "USGS GNIS / The National Map" });
    const data = await r.json();
    // GNIS returns features in arbitrary order, so "first 40 in the box" could
    // be the far corner of a lake-dense region while the lake you're standing
    // on misses the cut. Sort by distance to the query point first — the cap
    // then means "the 40 NEAREST named lakes", which is what every caller wants.
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const feats = (data.features || [])
      .map((f) => {
        const a = f.attributes || {}, g = f.geometry || {};
        const la = num(g.y), ln = num(g.x);
        if (!a.gaz_name || la == null || ln == null) return null;
        const d2 = (la - lat) ** 2 + ((ln - lng) * cosLat) ** 2;
        return { name: a.gaz_name, lat: la, lng: ln, kind: a.gaz_featureclass === "Reservoir" ? "reservoir" : "lake", d2 };
      })
      .filter(Boolean)
      .sort((x, y) => x.d2 - y.d2);
    // For big-place queries (the park/forest status page), lead with the
    // region's MAJOR lakes by size, then fill with the nearest small ones.
    // A 2.7M-acre forest's page should open its water list with Lake Ouachita
    // and Broken Bow Lake, not forty anonymous ponds around the centroid.
    const flags = radiusKm >= 60 ? await flagshipLakes(envelope) : [];
    const seen = {}, lakes = [];
    for (const f of flags) {
      if (seen[f.name.toLowerCase()]) continue;
      seen[f.name.toLowerCase()] = 1;
      lakes.push({ name: f.name, lat: f.lat, lng: f.lng, kind: f.kind, sizeKm2: f.sizeKm2 });
    }
    for (const f of feats) {
      if (seen[f.name.toLowerCase()]) continue;
      seen[f.name.toLowerCase()] = 1;
      lakes.push({ name: f.name, lat: f.lat, lng: f.lng, kind: f.kind });
      if (lakes.length >= 40) break;
    }
    return Response.json({ lakes, credit: "USGS GNIS / The National Map (public domain)" });
  } catch {
    return Response.json({ lakes: [], credit: "USGS GNIS / The National Map" });
  }
}
