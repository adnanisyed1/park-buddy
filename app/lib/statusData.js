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

// Hero photo for any of the three status pages — same source /api/photo
// already uses client-side (TrailPhoto/CoverPhoto in ExploreApp.jsx), just
// called server-side here since these pages don't need it to be interactive.
export async function getPhoto(name, state) {
  if (!name) return null;
  try {
    const r = await fetch(origin() + "/api/photo?name=" + encodeURIComponent(name) + "&state=" + encodeURIComponent(state || ""), { next: { revalidate: 604800 } });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.found ? (d.thumb || d.image) : null;
  } catch {
    return null;
  }
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
