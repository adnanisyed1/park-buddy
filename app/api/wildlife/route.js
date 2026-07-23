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

// Species a hiker should give room — matched against what's ACTUALLY observed
// nearby, so a Florida page warns about gators and a Colorado page about
// moose, never a generic scare list. Notes follow NPS distance guidance.
const HAZARD_EXACT = {
  "Ursus arctos": "Grizzly bear — carry bear spray, make noise, never run",
  "Ursus americanus": "Black bear — store food properly; make yourself heard",
  "Puma concolor": "Mountain lion — don't crouch or run; look big, back away",
  "Canis lupus": "Gray wolf — keep 100 yards, never feed",
  "Alces alces": "Moose — charges more people than bears; give it the trail",
  "Bison bison": "Bison — the #1 wildlife injury in parks; stay 25 yards",
  "Cervus canadensis": "Elk — unpredictable in fall rut and spring calving",
  "Alligator mississippiensis": "Alligator — keep 30 feet, never feed",
  "Heloderma suspectum": "Gila monster — venomous; look, don't touch",
  "Agkistrodon contortrix": "Copperhead — venomous; watch where you step",
  "Agkistrodon piscivorus": "Cottonmouth — venomous; mind wetland edges",
};
const HAZARD_GENUS = {
  Crotalus: "Rattlesnake — venomous; give it room and it will warn you",
  Sistrurus: "Massasauga rattlesnake — venomous; watch sunny rock edges",
  Micrurus: "Coral snake — venomous; never handle",
};
function hazardNote(sci) {
  if (HAZARD_EXACT[sci]) return HAZARD_EXACT[sci];
  const genus = String(sci).split(" ")[0];
  return HAZARD_GENUS[genus] || null;
}

async function group(lat, lng, radiusKm, taxa, perPage = 10) {
  const u = "https://api.inaturalist.org/v1/observations/species_counts" +
    "?lat=" + lat + "&lng=" + lng + "&radius=" + radiusKm +
    "&iconic_taxa=" + taxa + "&quality_grade=research&per_page=" + perPage;
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
    // Mammals fetched deep (100) so the hazard scan sees past the top ten —
    // a grizzly with 40 sightings matters more than its rank. Reptiles are
    // fetched ONLY for the hazard scan (rattlers, copperheads, gators).
    const [mammalsAll, birds, reptiles] = await Promise.all([
      group(lat, lng, radiusKm, "Mammalia", 100),
      group(lat, lng, radiusKm, "Aves"),
      group(lat, lng, radiusKm, "Reptilia", 100),
    ]);
    // Upstream failure ≠ "no wildlife here" — 503 so empties aren't cached as truth.
    if (mammalsAll === null && birds === null) return Response.json({ mammals: [], birds: [], caution: [], degraded: true }, { status: 503 });
    const mammals = (mammalsAll || []).slice(0, 10).map((s) => ({ ...s, caution: hazardNote(s.sci) }));
    const shown = new Set(mammals.map((s) => s.sci));
    // Dangerous species already in the top ten get a badge there instead of
    // a second card; the caution row is what the top ten DIDN'T surface.
    // obs >= 5 keeps out the lone escaped/captive record — one bison sighting
    // near RMNP is a ranch, not a warning.
    const caution = [...(mammalsAll || []), ...(reptiles || [])]
      .filter((s) => hazardNote(s.sci) && !shown.has(s.sci) && s.obs >= 5)
      .map((s) => ({ ...s, note: hazardNote(s.sci) }))
      .sort((a, b) => b.obs - a.obs)
      .slice(0, 8);
    const data = { mammals, birds: birds || [], caution, radiusMi };
    CACHE.set(key, { at: Date.now(), data });
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=604800" } });
  } catch {
    return Response.json({ mammals: [], birds: [], caution: [], degraded: true }, { status: 503 });
  }
}
