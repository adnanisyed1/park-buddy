// Park Buddy — places & recreation (RIDB / Recreation.gov + OpenStreetMap campgrounds).
// GET /api/places?lat=..&lng=..&q=..&radius=..  → nearby recreation areas, federal
// campgrounds & facilities (RIDB), PLUS state-park / private / dispersed campgrounds (OSM).
//
// A daily scheduled job (Vercel Cron → /api/cron/ingest → /api/ingest)
// already refreshes a Supabase cache (pb_places) for all 63 national parks. This
// route checks that cache FIRST — instant, no live API calls — and only falls
// back to live RIDB+OSM for areas not yet cached (uncached parks, or a random
// spot far from any park). Same response shape either way; a query param isn't
// needed to opt in.
//
// Needs RIDB_API_KEY (free, ridb.recreation.gov). OSM is free/no key.
// Credit: Recreation.gov / RIDB (federal agencies) + OpenStreetMap contributors.

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = "https://ridb.recreation.gov/api/v1";
const MIN_CACHE_HIT = 5; // below this, prefer a live fetch to avoid thin/partial coverage

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// Bounding box from a radius in MILES (this route's radius unit, matching RIDB).
async function cachedPlaces(lat, lng, radiusMi) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!sb || !key) return null;
  const dLat = radiusMi / 69;
  const dLng = radiusMi / (69 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const url =
    sb + "/rest/v1/pb_places?type=in.(campground,facility,recreation-area)" +
    "&lat=gte." + (lat - dLat) + "&lat=lte." + (lat + dLat) +
    "&lng=gte." + (lng - dLng) + "&lng=lte." + (lng + dLng) +
    "&select=name,type,lat,lng,url,detail&limit=100";
  try {
    const r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

async function ridb(path, params, key) {
  try {
    const url = BASE + path + "?" + new URLSearchParams(params).toString();
    const r = await fetch(url, { headers: { apikey: key, accept: "application/json" }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// State-park / private / dispersed campgrounds from OpenStreetMap. Bounded to 8s so it
// can NEVER stall the response; returns [] on any failure or timeout.
async function osmCamps(lat, lng, radiusMi) {
  try {
    const rM = Math.min(radiusMi, 60) * 1609;
    const A = "(around:" + rM + "," + lat + "," + lng + ")";
    const oq = "[out:json][timeout:8];(" +
      'node["tourism"="camp_site"]["name"]' + A + ";" +
      'way["tourism"="camp_site"]["name"]' + A + ");out tags center 50;";
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy" },
      body: "data=" + encodeURIComponent(oq),
      signal: AbortSignal.timeout(8500),
      next: { revalidate: 86400 },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.elements || []).map((el) => {
      const t = el.tags || {}, c = el.center || el;
      return { name: t.name, type: "campground", description: t.operator || "State / local / private campground", lat: num(c.lat), lng: num(c.lon), url: t.website || "", source: "OpenStreetMap" };
    }).filter((c) => c.name && c.lat != null && c.lng != null);
  } catch {
    return [];
  }
}

export async function GET(request) {
  const key = process.env.RIDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  const q = (searchParams.get("q") || "").trim();
  const radius = Math.min(parseInt(searchParams.get("radius") || "50", 10) || 50, 200);

  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }

  // Cache-first: instant if this area was already ingested (all 63 parks, daily).
  if (!q) {
    const cached = await cachedPlaces(lat, lng, radius);
    if (cached && cached.length >= MIN_CACHE_HIT) {
      const facilities = cached.filter((r) => r.type !== "recreation-area").map((r) => ({
        name: r.name, type: r.type === "campground" ? "Campground" : "Facility",
        description: r.detail || "", lat: r.lat, lng: r.lng, reservable: false, phone: "", url: r.url || "",
      }));
      const recAreas = cached.filter((r) => r.type === "recreation-area").map((r) => ({
        name: r.name, description: r.detail || "", lat: r.lat, lng: r.lng, phone: "", url: r.url || "",
      }));
      return Response.json({
        facilities: facilities.slice(0, 70),
        recAreas: recAreas.slice(0, 20),
        credit: "Recreation.gov / RIDB (federal) + OpenStreetMap contributors — cached",
      });
    }
  }

  const geo = { latitude: lat, longitude: lng, radius: radius, limit: "50" };

  // Everything runs in PARALLEL (RIDB passes + OSM), so total time = the slowest one,
  // not the sum. OSM is bounded to 8s and degrades to [] — never blocks RIDB pins.
  const [facD, facCampD, recD, osm] = await Promise.all([
    key ? ridb("/facilities", { ...geo, ...(q ? { query: q } : {}) }, key) : null,
    key ? ridb("/facilities", { ...geo, activity: "9" }, key) : null,
    key ? ridb("/recareas", { ...geo, ...(q ? { query: q } : {}) }, key) : null,
    osmCamps(lat, lng, radius),
  ]);

  const clean = (s, n) => String(s || "").replace(/<[^>]+>/g, "").slice(0, n || 200);
  const seenFac = {};

  const rawFac = [].concat((facCampD && facCampD.RECDATA) || [], (facD && facD.RECDATA) || []);
  const facilities = rawFac.map((f) => ({
    name: f.FacilityName,
    type: f.FacilityTypeDescription || "",
    description: clean(f.FacilityDescription, 220),
    lat: num(f.FacilityLatitude),
    lng: num(f.FacilityLongitude),
    reservable: !!f.Reservable,
    phone: f.FacilityPhone || "",
    url: f.FacilityID ? "https://www.recreation.gov/camping/campgrounds/" + f.FacilityID : "",
  })).filter((f) => {
    if (!f.name || f.lat == null || f.lng == null || (f.lat === 0 && f.lng === 0)) return false;
    const k = f.name.toLowerCase(); if (seenFac[k]) return false; seenFac[k] = 1; return true;
  });

  // Merge OSM campgrounds, skipping any already covered by RIDB (by name).
  const osmAdd = (osm || []).filter((c) => { const k = c.name.toLowerCase(); if (seenFac[k]) return false; seenFac[k] = 1; return true; }).slice(0, 30);

  const recAreas = ((recD && recD.RECDATA) || []).map((r) => ({
    name: r.RecAreaName,
    description: clean(r.RecAreaDescription, 220),
    lat: num(r.RecAreaLatitude),
    lng: num(r.RecAreaLongitude),
    phone: r.RecAreaPhone || "",
    url: r.RecAreaID ? "https://www.recreation.gov/gateways/" + r.RecAreaID : "",
  })).filter((r) => r.name && r.lat != null && r.lng != null);

  return Response.json({
    facilities: facilities.concat(osmAdd).slice(0, 70),
    recAreas: recAreas.slice(0, 20),
    credit: "Recreation.gov / RIDB (federal) + OpenStreetMap contributors (state/local/private campgrounds).",
  });
}
