// Park Buddy — unified "Places & Conditions" layer (reconciliation foundation).
// GET /api/explore?lat=..&lng=..  → ONE normalized, de-duplicated, source-stamped
// payload aggregating every source we have, so the app reads a single clean dataset
// instead of juggling sources per-feature.
//
// This is step #1 of the accuracy roadmap: ingest many sources, reconcile them
// (dedupe by name + proximity), and stamp each record with {source, fetchedAt}.
// It calls our own sibling endpoints so each source's key handling stays in one place.
//
// NOTE: this version reconciles LIVE on request (cached 10 min). The next step is to
// run the same reconciliation on a schedule into a database for full offline coverage.

export const runtime = "nodejs";
export const revalidate = 600;

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// Haversine distance in meters (for proximity dedupe).
function metersBetween(a, b, c, d) {
  const R = 6371000, t = (x) => (x * Math.PI) / 180;
  const dLat = t(c - a), dLng = t(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

async function get(origin, path) {
  try {
    const r = await fetch(origin + path);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const ll = "lat=" + lat + "&lng=" + lng;
  const now = new Date().toISOString();

  // 1) Fast path: serve pre-ingested, reconciled rows from Supabase if available.
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""), anon = process.env.SUPABASE_ANON_KEY;
  if (sb && anon) {
    try {
      // bounding box ~0.5° around the point
      const d = 0.5;
      const url = sb + "/rest/v1/pb_places?select=name,type,lat,lng,url,detail,sources,fetched_at" +
        "&lat=gte." + (lat - d) + "&lat=lte." + (lat + d) +
        "&lng=gte." + (lng - d) + "&lng=lte." + (lng + d) + "&limit=200";
      const r = await fetch(url, { headers: { apikey: anon, Authorization: "Bearer " + anon }, next: { revalidate: 600 } });
      if (r.ok) {
        const cached = await r.json();
        if (Array.isArray(cached) && cached.length) {
          return Response.json({ query: { lat, lng }, places: cached, fromCache: true, count: cached.length,
            sources: ["Recreation.gov / RIDB", "OpenStreetMap (ODbL)", "NWS/NIFC/AirNow"], servedAt: now });
        }
      }
    } catch (e) { /* fall through to live */ }
  }

  // Pull every source in parallel (each already cached at its own layer).
  const [places, water, trails, conditions] = await Promise.all([
    get(origin, "/api/places?" + ll),
    get(origin, "/api/water?" + ll),
    get(origin, "/api/trails?" + ll),
    get(origin, "/api/conditions?" + ll),
  ]);

  // --- Normalize every "place" into one shape with a source + freshness stamp ---
  const stamp = (source) => ({ source, fetchedAt: now });
  const raw = [];
  const push = (o, type, source) => {
    if (!o || o.lat == null || o.lng == null) return;
    raw.push({ name: o.name, type, lat: o.lat, lng: o.lng, url: o.url || "", detail: o.type || o.description || o.kind || "", ...stamp(source) });
  };
  (places?.recAreas || []).forEach((r) => push(r, "recreation-area", "Recreation.gov/RIDB"));
  (places?.facilities || []).forEach((f) => push(f, /camp/i.test(f.type || "") ? "campground" : "facility", "Recreation.gov/RIDB"));
  (water?.lakes || []).forEach((l) => push(l, "water", "OpenStreetMap"));

  // --- Reconcile: dedupe by normalized name within 250m (same place, two sources) ---
  const merged = [];
  for (const r of raw) {
    const dup = merged.find((m) => normName(m.name) === normName(r.name) && metersBetween(m.lat, m.lng, r.lat, r.lng) < 250);
    if (dup) {
      if (!dup.sources.includes(r.source)) dup.sources.push(r.source);
      if (!dup.url && r.url) dup.url = r.url;
      continue;
    }
    merged.push({ ...r, sources: [r.source] });
  }

  // Trails stay as their own list (lines, not points) but carry a source stamp.
  const trailLayer = {
    hiking: (trails?.hiking || []).map((t) => ({ ...t, ...stamp("OpenStreetMap") })),
    offroad: (trails?.offroad || []).map((t) => ({ ...t, ...stamp("OpenStreetMap") })),
    ski: (trails?.ski || []).map((t) => ({ ...t, ...stamp("OpenStreetMap") })),
  };

  return Response.json({
    query: { lat, lng },
    places: merged,
    trails: trailLayer,
    conditions: conditions && !conditions.error ? { ...conditions, ...stamp("NWS/NIFC/AirNow") } : null,
    counts: {
      places: merged.length,
      hiking: trailLayer.hiking.length,
      offroad: trailLayer.offroad.length,
      ski: trailLayer.ski.length,
    },
    sources: [
      "Recreation.gov / RIDB \u2014 federal land agencies",
      "OpenStreetMap contributors (ODbL)",
      "NOAA/NWS, NIFC, AirNow (EPA & state/local/tribal agencies)",
    ],
    reconciledAt: now,
  });
}
