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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bbox = (searchParams.get("bbox") || "").trim();
  const parts = bbox.split(",").map(num);
  if (parts.length !== 4 || parts.some((v) => v == null)) {
    return Response.json({ error: "bbox=south,west,north,east required" }, { status: 400 });
  }

  const els = await osmFeatures(bbox);
  const seen = new Set();
  const features = [];
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

  return Response.json({ features, credit: "Features: OpenStreetMap contributors (ODbL)." });
}
