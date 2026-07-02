// Park Buddy — lakes & water bodies (OpenStreetMap via Overpass API).
// GET /api/water?lat=..&lng=..&radius=..(km)  → named lakes & reservoirs near a point.
// FREE, no key. Data credit: \u00a9 OpenStreetMap contributors (ODbL).

export const runtime = "nodejs";
export const revalidate = 86400;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

async function overpass(query) {
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy" },
        body: "data=" + encodeURIComponent(query),
        next: { revalidate: 86400 },
      });
      if (r.ok) return await r.json();
    } catch { /* next mirror */ }
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }
  const radiusM = Math.min((parseInt(searchParams.get("radius") || "35", 10) || 35), 80) * 1000;
  const A = "(around:" + radiusM + "," + lat + "," + lng + ")";
  const query =
    "[out:json][timeout:25];(" +
    'way["natural"="water"]["name"]' + A + ";" +
    'relation["natural"="water"]["name"]' + A + ";" +
    'way["water"="lake"]["name"]' + A + ";" +
    'way["water"="reservoir"]["name"]' + A + ";" +
    ");out tags center 80;";

  const data = await overpass(query);
  if (!data || !Array.isArray(data.elements)) {
    return Response.json({ lakes: [], credit: "\u00a9 OpenStreetMap contributors" });
  }

  const seen = {}, lakes = [];
  for (const el of data.elements) {
    const t = el.tags || {};
    const name = t.name;
    if (!name || seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = 1;
    const c = el.center || {};
    const la = num(c.lat), ln = num(c.lon);
    if (la == null || ln == null) continue;
    lakes.push({ name, lat: la, lng: ln, kind: t.water || t.natural || "water" });
    if (lakes.length >= 24) break;
  }

  return Response.json({ lakes, credit: "\u00a9 OpenStreetMap contributors (ODbL)" });
}
