// GET /api/wildlife?lat=&lng=[&radius=30] — the top wildlife & birds actually
// SEEN near a place: research-grade community observations from iNaturalist
// (no key needed), ranked by observation count. Real sightings, not a species
// checklist — "5,600 elk sightings within 30 miles" is a promise we can keep.
//
// Two groups per call (mammals + birds), 10 each. iNaturalist asks for
// attribution: each photo carries its attribution string and the section UI
// credits iNaturalist. Radius is MILES here, converted to km for the API.

export const runtime = "nodejs";
export const revalidate = 604800; // species mix near a park barely moves week to week

const CACHE = new Map(); // key -> { at, data }
const TTL = 7 * 24 * 3600 * 1000;

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

async function group(lat, lng, radiusKm, taxa) {
  const u = "https://api.inaturalist.org/v1/observations/species_counts" +
    "?lat=" + lat + "&lng=" + lng + "&radius=" + radiusKm +
    "&iconic_taxa=" + taxa + "&quality_grade=research&per_page=10";
  const r = await fetch(u, {
    headers: { "User-Agent": "ParkBuddy/1.0 (theparkbuddy.com)" },
    next: { revalidate: 604800 },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.results || []).map((row) => {
    const t = row.taxon || {};
    const p = t.default_photo || {};
    return {
      name: t.preferred_common_name || t.name || "",
      sci: t.name || "",
      obs: row.count || 0,
      photo: p.medium_url || p.square_url || "",
      credit: p.attribution || "",
    };
  }).filter((s) => s.name);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat")), lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) return Response.json({ error: "lat/lng required" }, { status: 400 });
  const radiusMi = Math.min(Math.max(num(searchParams.get("radius")) || 30, 5), 80);
  const radiusKm = Math.round(radiusMi * 1.609);

  const key = lat.toFixed(2) + "," + lng.toFixed(2) + "," + radiusMi;
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) return Response.json(hit.data, { headers: { "Cache-Control": "public, s-maxage=604800" } });

  try {
    const [mammals, birds] = await Promise.all([
      group(lat, lng, radiusKm, "Mammalia"),
      group(lat, lng, radiusKm, "Aves"),
    ]);
    // Upstream failure ≠ "no wildlife here" — 503 so empties aren't cached as truth.
    if (mammals === null && birds === null) return Response.json({ mammals: [], birds: [], degraded: true }, { status: 503 });
    const data = { mammals: mammals || [], birds: birds || [], radiusMi };
    CACHE.set(key, { at: Date.now(), data });
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=604800" } });
  } catch {
    return Response.json({ mammals: [], birds: [], degraded: true }, { status: 503 });
  }
}
