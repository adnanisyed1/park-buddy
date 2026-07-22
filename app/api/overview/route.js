// GET /api/overview?lat=..&lng=.. — the Park Buddy overview for the place at
// this point, from the build-time-generated dataset (scripts/build-overviews).
// Served by API rather than bundled: 180 editorials would be ~200KB of client
// JS nobody asked to download. Place recovery = smallest containing bbox,
// the same trick /api/water uses, so no caller needs to know our place ids.
import OVERVIEWS from "../../lib/overview-data.json";
import GEO from "../../lib/place-geo.json";

export const revalidate = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  if (!isFinite(lat) || !isFinite(lng)) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  let best = null, bestArea = Infinity;
  for (const [id, p] of Object.entries(GEO.places)) {
    const b = p.bbox;
    if (!b || lat < b[1] || lat > b[3] || lng < b[0] || lng > b[2]) continue;
    const o = OVERVIEWS.places[id];
    if (!o) continue;
    const area = (b[2] - b[0]) * (b[3] - b[1]);
    if (area < bestArea) { best = { id, name: p.name, overview: o }; bestArea = area; }
  }
  return Response.json(best || { overview: null });
}
