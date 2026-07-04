// Park Buddy — scenic drives (America's Byways) related to a point, for
// showcasing on the legacy park-status embed. GET /api/byways?lat&lng&parkCode
import { getNearbyByways } from "../../lib/statusData";

export const runtime = "nodejs";
export const revalidate = 86400;

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat")), lng = num(searchParams.get("lng"));
  const parkCode = (searchParams.get("parkCode") || "").trim();
  const drives = await getNearbyByways(lat, lng, { parkCode, limit: 6 });
  return Response.json({ drives, credit: "Scenic drives: FHWA America's Byways." });
}
