// Server-side helpers shared by the /trail-status, /lake-status and
// /campground-status pages: building an absolute origin for internal fetches
// (Server Components need one — relative fetch doesn't work server-side),
// looking up the 63 national parks (from the browser-global public/trip-data.js,
// parsed once via a self-fetch since it's a script, not an importable module),
// and fetching "what else is nearby" from the same live government APIs the
// map already uses (/api/trails, /api/water, /api/places).

import { headers } from "next/headers";

export function origin() {
  const h = headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return proto + "://" + host;
}

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad, dLng = (bLng - aLng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function safeJson(p) {
  try { const r = await p; return r && r.ok ? await r.json() : null; } catch { return null; }
}
function midpoint(path) {
  if (!Array.isArray(path) || !path.length) return null;
  const p = path[Math.floor(path.length / 2)];
  return { lat: p[0], lng: p[1] };
}

// TRIP_PARKS/NPS_CODE are set as `window.X = ...` side effects in a plain
// browser script — not a module — so we self-fetch the raw file and pull the
// JSON literals out rather than duplicating the dataset here.
export async function getParks() {
  try {
    const r = await fetch(origin() + "/trip-data.js", { next: { revalidate: 86400 } });
    if (!r.ok) return [];
    const text = await r.text();
    const parksM = text.match(/window\.TRIP_PARKS\s*=\s*(\[.*?\]);/);
    const codesM = text.match(/window\.NPS_CODE\s*=\s*(\{.*?\});/);
    const parks = parksM ? JSON.parse(parksM[1]) : [];
    const codes = codesM ? JSON.parse(codesM[1]) : {};
    return parks.map((p) => ({ ...p, npsCode: codes[String(p.id)] || "" }));
  } catch {
    return [];
  }
}

export function parkByUnitCode(parks, unitCode) {
  const uc = String(unitCode || "").toLowerCase();
  if (!uc) return null;
  return parks.find((p) => p.npsCode === uc) || null;
}

export function nearestPark(parks, lat, lng) {
  if (!parks.length || lat == null || lng == null) return null;
  let best = null, bestDist = Infinity;
  for (const p of parks) {
    const d = milesBetween(lat, lng, p.lat, p.lng);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best ? { ...best, dist: bestDist } : null;
}

// America's Byways (scenic drives) — same self-fetch pattern as getParks(),
// from public/byways-data.js. Core fields are real FHWA designation data.
export async function getByways() {
  try {
    const r = await fetch(origin() + "/byways-data.js", { next: { revalidate: 86400 } });
    if (!r.ok) return [];
    const text = await r.text();
    const m = text.match(/window\.BYWAYS_DATA\s*=\s*(\[[\s\S]*?\]);/);
    return m ? JSON.parse(m[1]) : [];
  } catch {
    return [];
  }
}
export async function getByway(id) {
  if (!id) return null;
  const list = await getByways();
  return list.find((d) => d.id === id) || null;
}

// Scenic drives related to a point — any whose parkCode matches, plus the
// nearest byways within a wide radius (drives are regional, so 120 mi). Used to
// showcase drives on park/trail/lake pages. Returns light tile items.
export async function getNearbyByways(lat, lng, opts = {}) {
  const list = await getByways();
  const pc = (opts.parkCode || "").toLowerCase();
  const scored = list.map((d) => ({
    d, isPark: pc && d.parkCode === pc,
    distMi: lat != null && lng != null && d.lat != null ? milesBetween(lat, lng, d.lat, d.lng) : null,
  }));
  return scored
    .filter((s) => s.isPark || (s.distMi != null && s.distMi <= (opts.radiusMi || 120)))
    .sort((a, b) => (b.isPark ? 1 : 0) - (a.isPark ? 1 : 0) || (a.distMi ?? 9999) - (b.distMi ?? 9999))
    .slice(0, opts.limit || 6)
    .map(({ d, distMi, isPark }) => ({
      id: d.id, name: d.name, tier: d.tier, length: d.length, states: d.states,
      regionLabel: d.regionLabel, lat: d.lat, lng: d.lng, wiki: d.wiki,
      distMi: distMi != null ? Math.round(distMi) : null, isPark,
    }));
}

// US national forests (name + approximate centroid) — same self-fetch pattern
// as getParks(), from public/forest-data.js. Used for the "forests near me"
// section on /trail-status; centroids are approximate (forests are huge), so
// distances are ballpark, matching how the UI labels them.
export async function getForests() {
  try {
    const r = await fetch(origin() + "/forest-data.js", { next: { revalidate: 86400 } });
    if (!r.ok) return [];
    const text = await r.text();
    const m = text.match(/window\.FOREST_DATA\s*=\s*(\[[\s\S]*?\]);/);
    return m ? JSON.parse(m[1]) : [];
  } catch {
    return [];
  }
}

// "What else is near this point" — same live sources the map uses, just
// queried directly for a single reference point instead of via the client.
export async function getNearby(lat, lng, opts = {}) {
  const empty = { trails: [], lakes: [], camps: [] };
  if (lat == null || lng == null) return empty;
  const o = origin();
  const [trailsR, waterR, placesR] = await Promise.allSettled([
    fetch(o + "/api/trails?lat=" + lat + "&lng=" + lng + "&radius=15", { cache: "no-store" }),
    fetch(o + "/api/water?lat=" + lat + "&lng=" + lng + "&radius=15", { cache: "no-store" }),
    fetch(o + "/api/places?lat=" + lat + "&lng=" + lng + "&radius=10", { cache: "no-store" }),
  ]);
  const trailsD = trailsR.status === "fulfilled" && trailsR.value.ok ? await trailsR.value.json() : null;
  const waterD = waterR.status === "fulfilled" && waterR.value.ok ? await waterR.value.json() : null;
  const placesD = placesR.status === "fulfilled" && placesR.value.ok ? await placesR.value.json() : null;

  const trails = trailsD
    ? ["hiking", "offroad", "ski"].flatMap((cat) => (trailsD[cat] || []).map((t) => ({ ...t, category: cat })))
    : [];

  return {
    trails: trails.filter((t) => t.id !== opts.excludeTrailId).slice(0, 6),
    lakes: (waterD?.lakes || []).filter((l) => l.name !== opts.excludeName).slice(0, 6),
    camps: (placesD?.facilities || []).filter((c) => c.name !== opts.excludeName).slice(0, 6),
  };
}

// Real lake surface area from USGS NHD (National Hydrography Dataset) waterbody
// polygons — a lake's own point usually falls inside its polygon. Returns acres.
// (Depth/shoreline aren't in NHD or any public API for arbitrary lakes.)
export async function getWaterbody(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const params = new URLSearchParams({
      geometry: lng + "," + lat, geometryType: "esriGeometryPoint", inSR: "4326",
      spatialRel: "esriSpatialRelIntersects", outFields: "gnis_name,areasqkm",
      returnGeometry: "false", f: "json",
    });
    const r = await fetch("https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query?" + params.toString(), { next: { revalidate: 604800 }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const d = await r.json();
    const f = (d.features || [])[0];
    const a = f && f.attributes;
    if (!a) return null;
    // ArcGIS returns the actual field names (UPPERCASE) regardless of the
    // lowercase outFields we requested — read case-insensitively.
    const km2 = a.AREASQKM ?? a.areasqkm;
    const gnis = a.GNIS_NAME ?? a.gnis_name;
    return { name: gnis || null, areaAcres: km2 ? Math.round(km2 * 247.105) : null };
  } catch {
    return null;
  }
}

// Real ACCESS facilities near a lake (boat ramps, marinas, swim beaches, day-use,
// docks) from RIDB + OSM via /api/places. Existence is real; live status (waits,
// lot %, hours) is NOT published anywhere, so the UI never claims open/closed.
export async function getLakeAccess(lat, lng) {
  if (lat == null || lng == null) return [];
  const d = await safeJson(fetch(origin() + "/api/places?lat=" + lat + "&lng=" + lng + "&radius=8", { cache: "no-store", signal: AbortSignal.timeout(9000) }));
  const fac = (d && d.facilities) || [];
  const re = /boat|ramp|launch|marina|beach|swim|day.?use|picnic|dock|fishing pier|watercraft/i;
  return fac
    .filter((f) => re.test((f.type || "") + " " + (f.name || "")))
    .slice(0, 6)
    .map((f) => ({ name: f.name, type: f.type || "Facility", url: f.url || "", lat: f.lat, lng: f.lng }));
}

// NPS returns phones as bare digits ("9705861206") — format for display.
export function formatPhone(p) {
  const d = String(p || "").replace(/[^0-9]/g, "");
  if (d.length === 10) return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  if (d.length === 11 && d[0] === "1") return "(" + d.slice(1, 4) + ") " + d.slice(4, 7) + "-" + d.slice(7);
  return String(p || "");
}

// Park contact info for the leaf "get the details" endpoints: HQ phone +
// official site. Same /api/nps fetch the fees already use (ISR-cached).
export async function getParkContact(parkCode) {
  if (!parkCode) return null;
  const d = await safeJson(fetch(origin() + "/api/nps?parkCode=" + encodeURIComponent(parkCode), { next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) }));
  const p = d && d.park;
  if (!p) return null;
  return { phone: p.phone || "", url: p.url || "", fullName: p.fullName || "" };
}

// Live NPS webcams for a park, nearest to a reference point first. Existence,
// titles, and live-view links are real (NPS runs the cameras); we never claim
// a snapshot is current — the link goes to NPS's own live player.
export async function getWebcams(parkCode, lat, lng) {
  if (!parkCode) return [];
  const d = await safeJson(fetch(origin() + "/api/webcams?parkCode=" + encodeURIComponent(parkCode), { next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) }));
  const cams = (d && d.webcams) || [];
  return cams
    .map((w) => ({ ...w, distMi: lat != null && lng != null && w.lat != null && w.lng != null ? milesBetween(lat, lng, w.lat, w.lng) : null }))
    .sort((a, b) => (a.distMi ?? 9999) - (b.distMi ?? 9999))
    .slice(0, 4);
}

// NPS's own curated "things to do" for a park, nearest-first when items carry
// coordinates (park-wide items without coords sort last but still show).
export async function getThingsToDo(parkCode, lat, lng) {
  if (!parkCode) return [];
  const d = await safeJson(fetch(origin() + "/api/thingstodo?parkCode=" + encodeURIComponent(parkCode), { next: { revalidate: 21600 }, signal: AbortSignal.timeout(9000) }));
  const items = (d && d.items) || [];
  return items
    .map((t) => ({ ...t, distMi: lat != null && lng != null && t.lat != null && t.lng != null ? milesBetween(lat, lng, t.lat, t.lng) : null }))
    .sort((a, b) => (a.distMi ?? 9999) - (b.distMi ?? 9999))
    .slice(0, 6);
}

// Richer "near this trailhead" for /trail-status: five categories — trails,
// lakes, national parks, national forests, gateway towns — each normalized to
// { name, distMi, href|null, q, lat, lng, badge }. `q` is a pipe-separated
// photo-candidate list resolved CLIENT-side per tile (NearbyExplorer) via
// /api/photo + the shared localStorage cache, so this stays a light data call.
// Distances are precomputed so the client radius chips (10/25/50/Any) filter in
// place with no refetch. Parks/forests come from the in-memory datasets (nearest
// 8 by distance, any distance — so "Any" surfaces far units); trails/lakes/towns
// come from the same live APIs the map uses, within a ~50 mi superset.
export async function getTrailNearby(ref, opts = {}) {
  const empty = { trails: [], lakes: [], parks: [], forests: [], places: [] };
  const lat = ref?.lat, lng = ref?.lng;
  if (lat == null || lng == null) return empty;
  const o = origin();
  const state = opts.state || "";

  // Trails/water are fast; parks/forests are in-memory. Gateway TOWNS (Overpass)
  // can take ~20s cold, so "places" is NOT fetched here — NearbyExplorer loads it
  // client-side after paint so the page never blocks on a slow upstream. Each
  // live fetch is still capped so one slow source can't stall the render.
  const timed = (url, ms) => safeJson(fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) }));
  const [trailsD, waterD, parksData, forestsData] = await Promise.all([
    timed(o + "/api/trails?lat=" + lat + "&lng=" + lng + "&radius=80", 9000),
    timed(o + "/api/water?lat=" + lat + "&lng=" + lng + "&radius=80", 9000),
    getParks(),
    getForests(),
  ]);

  const trailItems = trailsD
    ? ["hiking", "offroad", "ski"].flatMap((cat) => (trailsD[cat] || []).map((t) => ({ ...t, category: cat })))
    : [];
  const trails = trailItems
    .filter((t) => t.id !== opts.excludeTrailId && t.name)
    .map((t) => {
      const mp = midpoint(t.path);
      return {
        name: t.name,
        distMi: mp ? milesBetween(lat, lng, mp.lat, mp.lng) : null,
        href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || opts.currentUnitCode || ""),
        q: [t.name, t.unitName || ""].filter(Boolean).join("|"),
        sub: t.lengthMi > 0 ? t.lengthMi + " mi" : null,
        lat: mp?.lat, lng: mp?.lng,
      };
    })
    .filter((t) => t.distMi == null || t.distMi <= 60)
    .sort((a, b) => (a.distMi ?? 999) - (b.distMi ?? 999))
    .slice(0, 8);

  const lakes = (waterD?.lakes || [])
    .filter((l) => l.name && l.name !== opts.excludeName)
    .map((l) => ({
      name: l.name,
      distMi: milesBetween(lat, lng, l.lat, l.lng),
      href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
      q: [l.name, l.name + " " + state].filter(Boolean).join("|"),
      lat: l.lat, lng: l.lng,
    }))
    .sort((a, b) => a.distMi - b.distMi)
    .slice(0, 8);

  const parks = (parksData || [])
    .map((p) => {
      const full = /national park/i.test(p.name) ? p.name : p.name + " National Park";
      return {
        name: full,
        distMi: milesBetween(lat, lng, p.lat, p.lng),
        href: "/parks/" + p.id,
        q: [full, p.name].join("|"),
        lat: p.lat, lng: p.lng,
        badge: opts.currentParkId && p.id === opts.currentParkId ? "YOU'RE HERE" : null,
      };
    })
    .sort((a, b) => a.distMi - b.distMi)
    .slice(0, 8);

  const forests = (forestsData || [])
    .map((f) => ({
      name: f.name,
      distMi: milesBetween(lat, lng, f.lat, f.lng),
      href: null,
      q: [f.name, f.name.replace(/s$/i, "")].join("|"),
      lat: f.lat, lng: f.lng,
    }))
    .sort((a, b) => a.distMi - b.distMi)
    .slice(0, 8);

  // places (gateway towns) intentionally omitted here — loaded client-side.
  return { trails, lakes, parks, forests, places: [] };
}

// Hero photo for any of the three status pages — same source /api/photo
// already uses client-side (TrailPhoto/CoverPhoto in ExploreApp.jsx), just
// called server-side here since these pages don't need it to be interactive.
// Full photo lookup: name/state chain first; when `coords` is given and no
// name-based photo exists, /api/photo falls back to a real geotagged Commons
// photo taken at those coordinates (geo:true + photoDate so the UI can label
// it honestly). Returns { url, geo, photoDate, pageUrl } or null.
export async function getPhotoInfo(name, state, coords) {
  if (!name && !coords) return null;
  try {
    // v=2 busts data-cache entries poisoned during the window when upstream
    // failures were still cached as empty 200s (fixed in 08fb4e0).
    const qs = new URLSearchParams({ name: name || "", state: state || "", v: "4" });
    if (coords && coords.lat != null && coords.lng != null) {
      qs.set("lat", coords.lat);
      qs.set("lng", coords.lng);
    }
    // Bounded: the geo fallback inside /api/photo can take ~12s worst case —
    // never let a photo lookup hold the whole SSR page render hostage.
    const r = await fetch(origin() + "/api/photo?" + qs.toString(), { next: { revalidate: 604800 }, signal: AbortSignal.timeout(14000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.found) return null;
    return { url: d.thumb || d.image, geo: !!d.geo, photoDate: d.photoDate || null, pageUrl: d.pageUrl || "" };
  } catch {
    return null;
  }
}

export async function getPhoto(name, state, coords) {
  const info = await getPhotoInfo(name, state, coords);
  return info ? info.url : null;
}

// Real current conditions near a point, via the National Weather Service
// (free, no key — same family of source as app/api/conditions/route.js's
// weatherAlerts()). Replaces the mockup's fabricated "Open/Caution/Closed"
// status pill and "Typical conditions · July" climate-normals card with
// something genuinely live, just not framed as trail-specific open/closed.
export async function getPointWeather(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const pt = await fetch("https://api.weather.gov/points/" + lat.toFixed(4) + "," + lng.toFixed(4), {
      headers: { "User-Agent": "ParkBuddy (trail-status)", Accept: "application/geo+json" },
      next: { revalidate: 1800 },
    }).then((r) => (r.ok ? r.json() : null));
    const forecastUrl = pt && pt.properties && pt.properties.forecast;
    if (!forecastUrl) return null;
    const fc = await fetch(forecastUrl, {
      headers: { "User-Agent": "ParkBuddy (trail-status)", Accept: "application/geo+json" },
      next: { revalidate: 1800 },
    }).then((r) => (r.ok ? r.json() : null));
    const period = fc && fc.properties && fc.properties.periods && fc.properties.periods[0];
    if (!period) return null;
    return {
      tempF: period.temperature,
      short: period.shortForecast,
      wind: period.windSpeed,
      isDaytime: !!period.isDaytime,
    };
  } catch {
    return null;
  }
}

// Real park-level entrance fees/passes from /api/nps (already fetched
// elsewhere in the app) — not the mockup's trail-specific "Bear Lake Road
// corridor" timed-entry detail, which isn't in any generic API, but genuinely
// real at the park level.
export async function getParkFees(unitCode) {
  if (!unitCode) return null;
  try {
    const r = await fetch(origin() + "/api/nps?parkCode=" + encodeURIComponent(unitCode), { next: { revalidate: 900 } });
    if (!r.ok) return null;
    const d = await r.json();
    const fees = (d.park && d.park.entranceFees) || [];
    const passes = (d.park && d.park.entrancePasses) || [];
    if (!fees.length && !passes.length) return null;
    return { fees, passes };
  } catch {
    return null;
  }
}

// Read-only reviews for a trail, straight from Supabase's REST API with the
// anon key (RLS already makes reviews public-read — see
// supabase-trail-reviews.sql). No write UI here: writing needs a signed-in
// session, which only exists client-side (in the interactive map panel).
export async function getTrailReviews(trailId) {
  if (trailId == null) return { reviews: [], avg: null };
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) return { reviews: [], avg: null };
  try {
    const url = sb + "/rest/v1/trail_reviews?trail_id=eq." + encodeURIComponent(String(trailId)) +
      "&select=rating,review_text,author_name,created_at&order=created_at.desc&limit=20";
    const r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key }, cache: "no-store" });
    if (!r.ok) return { reviews: [], avg: null };
    const reviews = await r.json();
    const avg = reviews.length ? reviews.reduce((s, x) => s + x.rating, 0) / reviews.length : null;
    return { reviews, avg };
  } catch {
    return { reviews: [], avg: null };
  }
}
