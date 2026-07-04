// Park Buddy — named natural features along a trail, for real milestone names.
// GET /api/waypoints?bbox=south,west,north,east
//   → { features: [{ name, type, lat, lng }] } from live OpenStreetMap data.
//
// NPS's trails dataset has geometry but no named waypoints. Rather than invent
// names, we pull the real named natural features that sit near a trail — peaks,
// saddles, passes, lakes, waterfalls, glaciers, springs, viewpoints — and the
// client matches the nearest one to each milestone point (falling back to a
// descriptive elevation-role label where OSM has nothing). Same free Overpass
// source + mirror/timeout pattern as /api/gateway. Credit: OpenStreetMap (ODbL).

export const runtime = "nodejs";
export const revalidate = 86400; // named features don't move — cache a day

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

async function osmFeatures(bbox) {
  const b = "(" + bbox + ")"; // south,west,north,east
  const oq = "[out:json][timeout:15];(" +
    'node["natural"="peak"]["name"]' + b + ";" +
    'node["natural"="saddle"]["name"]' + b + ";" +
    'node["mountain_pass"]["name"]' + b + ";" +
    'node["natural"="water"]["name"]' + b + ";" +
    'way["natural"="water"]["name"]' + b + ";" +
    'node["waterway"="waterfall"]["name"]' + b + ";" +
    'node["natural"="glacier"]["name"]' + b + ";" +
    'way["natural"="glacier"]["name"]' + b + ";" +
    'node["natural"="spring"]["name"]' + b + ";" +
    'node["tourism"="viewpoint"]["name"]' + b + ");out center tags 250;";
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy" },
        body: "data=" + encodeURIComponent(oq),
        signal: AbortSignal.timeout(9000),
        next: { revalidate: 86400 },
      });
      if (!r.ok) continue;
      const d = await r.json();
      return d.elements || [];
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

function typeOf(t) {
  if (t.natural === "peak") return "peak";
  if (t.natural === "saddle") return "saddle";
  if (t.mountain_pass) return "pass";
  if (t.waterway === "waterfall") return "waterfall";
  if (t.natural === "water") return "water";
  if (t.natural === "glacier") return "glacier";
  if (t.natural === "spring") return "spring";
  if (t.tourism === "viewpoint") return "viewpoint";
  return "feature";
}

// ---- USGS GNIS fallback -------------------------------------------------
// Overpass rate-limits/blocks many server IPs (the reason trails and lakes
// left Overpass), so when it returns nothing we fall back to the government's
// own place-name database — same carto.nationalmap.gov service the water API
// already uses, reliable from datacenter IPs. Landforms (layer 5) carry the
// names hikers actually use ("Tombstone Ridge", "Timberline Pass"); layer 7
// adds falls/springs/lakes/glaciers.
const GNIS_TYPE = {
  Summit: "peak", Ridge: "ridge", Gap: "pass", Cliff: "cliff", Arch: "arch",
  Pillar: "feature", Falls: "waterfall", Spring: "spring", Lake: "water",
  Reservoir: "water", Glacier: "glacier",
};

async function gnisLayer(layer, classes, envelope) {
  try {
    const params = new URLSearchParams({
      geometry: envelope, geometryType: "esriGeometryEnvelope", inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      where: "gaz_featureclass IN (" + classes.map((c) => "'" + c + "'").join(",") + ")",
      outFields: "gaz_name,gaz_featureclass", returnGeometry: "true", outSR: "4326",
      resultRecordCount: "80", f: "json",
    });
    const r = await fetch("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/" + layer + "/query?" + params.toString(), {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.features || []).map((f) => {
      const a = f.attributes || {};
      const name = a.gaz_name ?? a.GAZ_NAME;
      const cls = a.gaz_featureclass ?? a.GAZ_FEATURECLASS;
      // Points arrive as esriGeometryMultipoint: geometry.points[0] = [lng, lat].
      const g = f.geometry || {};
      const pt = (g.points && g.points[0]) || (g.x != null ? [g.x, g.y] : null);
      if (!name || !pt || pt[0] == null) return null;
      return { name, type: GNIS_TYPE[cls] || "feature", lat: pt[1], lng: pt[0] };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function gnisFeatures(parts) {
  // parts = [south, west, north, east]; ArcGIS envelope = west,south,east,north.
  const envelope = [parts[1], parts[0], parts[3], parts[2]].join(",");
  const [landforms, hydro] = await Promise.all([
    gnisLayer(5, ["Summit", "Ridge", "Gap", "Cliff", "Arch"], envelope),
    gnisLayer(7, ["Falls", "Spring", "Lake", "Glacier"], envelope),
  ]);
  return landforms.concat(hydro);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bbox = (searchParams.get("bbox") || "").trim();
  const parts = bbox.split(",").map(num);
  if (parts.length !== 4 || parts.some((v) => v == null)) {
    return Response.json({ error: "bbox=south,west,north,east required" }, { status: 400 });
  }

  const els = await osmFeatures(bbox);
  const seen = new Set();
  let features = [];
  for (const el of els) {
    const t = el.tags || {};
    const name = (t.name || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    const lat = el.lat ?? (el.center && el.center.lat);
    const lng = el.lon ?? (el.center && el.center.lon);
    if (lat == null || lng == null) continue;
    seen.add(name.toLowerCase());
    features.push({ name, type: typeOf(t), lat, lng });
  }
  let credit = "Features: OpenStreetMap contributors (ODbL).";

  // Overpass empty (usually rate-limited from this server IP) → USGS GNIS.
  if (!features.length) {
    const gnis = await gnisFeatures(parts);
    for (const f of gnis) {
      if (seen.has(f.name.toLowerCase())) continue;
      seen.add(f.name.toLowerCase());
      features.push(f);
    }
    if (features.length) credit = "Features: USGS Geographic Names Information System (public domain).";
  }

  return Response.json({ features, credit });
}
