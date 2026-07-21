// Viator Partner API — the first affiliate whose CATALOG we may render on our
// own pages: photos, prices, ratings, licensed via the partner API rather than
// scraped. Booking still happens on Viator; every productUrl the API returns
// already carries our partner tracking, so there are no links to mint. Server
// only — the key must never reach the browser.
//
// Shape of the integration:
//   1. Viator's world is destination ids, not coordinates. GET /destinations
//      returns the full taxonomy (~5k places, each with a center lat/lng);
//      we cache it in memory for a day and resolve town → nearest destination.
//   2. POST /products/search by destination id, top-rated first.
//
// Everything is defensive about response shapes: this file was written before
// the first live call (key pending), so it trusts nothing it hasn't seen.
const BASE = "https://api.viator.com/partner";

function headers() {
  return {
    "exp-api-key": process.env.VIATOR_API_KEY,
    Accept: "application/json;version=2.0",
    "Accept-Language": "en-US",
    "Content-Type": "application/json",
  };
}

export function viatorConfigured() {
  return !!process.env.VIATOR_API_KEY;
}

// ---- destination taxonomy ---------------------------------------------------
// One fetch a day for the whole process. 5k rows is small; the alternative —
// hitting /destinations per request — would burn the rate limit for nothing.
let DESTS = null; // { at: ms, list: [{id, name, type, lat, lng}] }
const DEST_TTL = 24 * 3600 * 1000;

async function destinations() {
  if (DESTS && Date.now() - DESTS.at < DEST_TTL) return DESTS.list;
  const res = await fetch(`${BASE}/destinations`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    // Viator's error body says WHY (invalid key vs inactive vs wrong header).
    // Also fingerprint the key — length + ends only, safe for private logs —
    // so a bad paste in the env vault is distinguishable from a dead key.
    const body = (await res.text().catch(() => "")).slice(0, 300);
    const k = process.env.VIATOR_API_KEY || "";
    console.error(`[viator] key fingerprint: len=${k.length} "${k.slice(0, 2)}…${k.slice(-2)}" trimmed=${k === k.trim()}`);
    throw new Error(`viator /destinations ${res.status} :: ${body}`);
  }
  const data = await res.json();
  const rows = Array.isArray(data.destinations) ? data.destinations : [];
  const list = rows
    .map((d) => ({
      id: d.destinationId ?? d.ref ?? null,
      name: d.name || "",
      type: d.type || "",
      lat: Number(d.center?.latitude ?? d.latitude),
      lng: Number(d.center?.longitude ?? d.longitude),
    }))
    .filter((d) => d.id != null && isFinite(d.lat) && isFinite(d.lng));
  if (list.length) DESTS = { at: Date.now(), list };
  return list;
}

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Nearest CITY-level destinations to a point. Countries and states also live
// in the taxonomy with centers of their own; matching those would hand Ouray
// the whole of Colorado, so anything region-shaped is skipped.
const REGIONY = /^(country|state|province|region|territory)$/i;
export async function nearestDestinations(lat, lng, { max = 3, withinMi = 60 } = {}) {
  const all = await destinations();
  return all
    .filter((d) => !REGIONY.test(d.type))
    .map((d) => ({ ...d, distMi: milesBetween(lat, lng, d.lat, d.lng) }))
    .filter((d) => d.distMi <= withinMi)
    .sort((a, b) => a.distMi - b.distMi)
    .slice(0, max);
}

// ---- products ----------------------------------------------------------------
export async function searchProducts(destId, { count = 8, currency = "USD" } = {}) {
  const res = await fetch(`${BASE}/products/search`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({
      filtering: { destination: String(destId) },
      sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
      pagination: { start: 1, count },
      currency,
    }),
  });
  if (!res.ok) throw new Error(`viator /products/search ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data.products) ? data.products : []).map(normalize).filter(Boolean);
}

// One tour, in our vocabulary. Never expose Viator's raw shape to components —
// when the API changes, this is the only place that notices.
function normalize(p) {
  if (!p || !p.title || !p.productUrl) return null;
  // images[].variants[] come in many sizes; take the variant closest to card
  // size rather than the original (multi-MB) or the thumbnail (blurry).
  let photo = null;
  const variants = p.images?.[0]?.variants;
  if (Array.isArray(variants) && variants.length) {
    const scored = variants
      .filter((v) => v?.url && isFinite(Number(v.width)))
      .sort((a, b) => Math.abs(a.width - 720) - Math.abs(b.width - 720));
    photo = scored[0]?.url || null;
  }
  const hours = durationHours(p.duration);
  return {
    code: p.productCode || null,
    title: p.title,
    url: p.productUrl, // already carries our partner tracking
    photo,
    rating: round1(p.reviews?.combinedAverageRating),
    reviews: p.reviews?.totalReviews ?? null,
    fromPrice: p.pricing?.summary?.fromPrice ?? null,
    currency: p.pricing?.currency || "USD",
    durationHours: hours,
    flags: Array.isArray(p.flags) ? p.flags : [],
  };
}

function durationHours(d) {
  const mins = d?.fixedDurationInMinutes ?? d?.variableDurationToMinutes ?? null;
  if (!isFinite(Number(mins)) || mins == null) return null;
  return Math.round((Number(mins) / 60) * 10) / 10;
}
function round1(n) {
  return isFinite(Number(n)) ? Math.round(Number(n) * 10) / 10 : null;
}
