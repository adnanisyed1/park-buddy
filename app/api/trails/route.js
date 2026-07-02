// Park Buddy — trails, off-road & ski routes (OpenStreetMap via Overpass API).
// GET /api/trails?lat=..&lng=..&radius=..(km)  → named hiking trails, 4x4/OHV
// tracks, and ski pistes near a point. FREE, no key.
//
// Data credit: \u00a9 OpenStreetMap contributors (ODbL). We attribute OSM wherever shown.

import { overpass } from "../_overpass";

export const runtime = "nodejs";
export const revalidate = 86400; // 1 day cache (trail geometry is static)

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }
  const radiusM = Math.min((parseInt(searchParams.get("radius") || "25", 10) || 25), 60) * 1000;

  const A = "(around:" + radiusM + "," + lat + "," + lng + ")";
  const query =
    "[out:json][timeout:20];(" +
    'way["highway"="path"]["name"]' + A + ";" +
    'way["route"="hiking"]["name"]' + A + ";" +
    'relation["route"="hiking"]["name"]' + A + ";" +
    'way["highway"="track"]["name"]["tracktype"]' + A + ";" +
    'way["4wd_only"="yes"]["name"]' + A + ";" +
    'way["piste:type"]["name"]' + A + ";" +
    ");out tags geom 120;";

  const data = await overpass(query);
  if (!data || !Array.isArray(data.elements)) {
    const body = { hiking: [], offroad: [], ski: [], credit: "\u00a9 OpenStreetMap contributors" };
    if (searchParams.get("debug")) body.debug = overpass.lastErr || "no data";
    return Response.json(body);
  }

  const seen = {}, hiking = [], offroad = [], ski = [];
  for (const el of data.elements) {
    const t = el.tags || {};
    const name = t.name;
    if (!name || seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = 1;
    // Sample the geometry down to <=40 points to keep the payload small.
    let path = null;
    if (Array.isArray(el.geometry) && el.geometry.length) {
      const g = el.geometry, step = Math.max(1, Math.floor(g.length / 40));
      path = g.filter((_, i) => i % step === 0 || i === g.length - 1).map((pt) => [pt.lat, pt.lon]);
    }
    const item = { name, difficulty: t.sac_scale || t["piste:difficulty"] || t.tracktype || "", path };
    if (t["piste:type"]) { if (ski.length < 12) ski.push(item); }
    else if (t["4wd_only"] === "yes" || (t.highway === "track" && t.tracktype)) { if (offroad.length < 12) offroad.push(item); }
    else { if (hiking.length < 16) hiking.push(item); }
  }

  return Response.json({
    hiking, offroad, ski,
    credit: "\u00a9 OpenStreetMap contributors (ODbL)",
  });
}
