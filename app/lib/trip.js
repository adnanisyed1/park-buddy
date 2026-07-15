"use client";

// ---------------------------------------------------------------------------
// The ONE trip store for the whole platform.
//
// Before this, "your trip" lived in three incompatible places: `pb_trip` (an
// array of park names, used by Explore + the park pages + the header badge),
// `pp_trip2` (a {s:[{pid,ni,lo}]} schema written by AddToTripButton), and
// BuildTripApp's own preset itineraries (which read NEITHER). So adding a park
// never reached Build My Trip. This module is the single source of truth every
// surface now goes through.
//
// Storage (localStorage):
//   pb_trip      → [{ name, nights }]   (the stops, in order)
//   pb_trip_meta → { tripName, startDate, travelers }
//
// Back-compat: an older `pb_trip` was a plain array of name strings — we migrate
// that to [{name, nights:2}] on first read. `.length` still equals the stop
// count, so naive `JSON.parse(pb_trip).length` readers keep working during the
// transition.
// ---------------------------------------------------------------------------

const KEY = "pb_trip";
const META_KEY = "pb_trip_meta";
const DEFAULT_NIGHTS = 2;

const subs = new Set();

// A byway stop carries its route's "stops along the way" (reference list, shown nested on
// the tile — not dumped into the day flow). Kept lean + capped so it survives localStorage.
function coerceWaypoints(arr) {
  return (Array.isArray(arr) ? arr : [])
    .slice(0, 60)
    .map((w) => {
      const o = { place: String((w && (w.place || w.name)) || "").slice(0, 80), mile: w && w.mile != null ? Number(w.mile) : (w && w.mileFromStart != null ? Number(w.mileFromStart) : null) };
      if (w && w.lat != null && w.lng != null) { o.lat = Number(w.lat); o.lng = Number(w.lng); }
      return o;
    })
    .filter((w) => w.place);
}

function read() {
  if (typeof window === "undefined") return [];
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  // Migrate legacy array-of-strings and coerce shapes. Optional lat/lng/state/custom
  // are preserved so custom (geocoded) stops re-hydrate without a name lookup.
  return raw
    .map((s) => {
      if (typeof s === "string") return { name: s, nights: DEFAULT_NIGHTS };
      if (!s || !s.name) return null;
      const o = { name: String(s.name), nights: Number(s.nights) >= 0 ? Number(s.nights) : DEFAULT_NIGHTS };
      if (s.lat != null && s.lng != null) { o.lat = Number(s.lat); o.lng = Number(s.lng); }
      if (s.state) o.state = String(s.state);
      if (s.custom) o.custom = true;
      if (s.kind) o.kind = String(s.kind);       // e.g. "byway" — a scenic drive, not a park
      if (s.slug) o.slug = String(s.slug);       // links a byway stop back to /scenic-drives/<slug>
      if (Array.isArray(s.waypoints) && s.waypoints.length) o.waypoints = coerceWaypoints(s.waypoints); // byway: stops-along-the-route, shown nested (not dumped into the day flow)
      return o;
    })
    .filter(Boolean);
}

// Persist a key; if storage is full, free space by dropping the OLDEST saved-trip
// snapshots (recomputable, less precious than the live plan or photos) and retry, so the
// active trip never silently fails to save. Fires pb:storage-full if it truly can't fit.
function safeSet(key, value) {
  if (typeof window === "undefined") return false;
  try { localStorage.setItem(key, value); return true; } catch {}
  for (let i = 0; i < 50; i++) {
    let a; try { a = JSON.parse(localStorage.getItem("pb_saved_trips") || "[]"); } catch { a = []; }
    if (!Array.isArray(a) || !a.length) break;
    a.sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0)); a.pop();
    try { localStorage.setItem("pb_saved_trips", JSON.stringify(a)); window.dispatchEvent(new Event("pb:saved-trips")); } catch {}
    try { localStorage.setItem(key, value); return true; } catch {}
  }
  try { window.dispatchEvent(new Event("pb:storage-full")); } catch {}
  return false;
}

function write(stops) {
  if (typeof window === "undefined") return;
  safeSet(KEY, JSON.stringify(stops));
  notify();
}

function notify(added) {
  subs.forEach((fn) => { try { fn(); } catch {} });
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new CustomEvent("pb:trip", { detail: { added: added || null } })); } catch {}
  }
}

// ---- reads ----
export function getStops() { return read(); }
export function tripCount() { return read().length; }
export function inTrip(name) { return read().some((s) => s.name === name); }

export function getMeta() {
  const d = { tripName: "My national-parks trip", startDate: "", endDate: "", travelers: 2, adults: 2, infants: 0, arrivalMode: "drive", tripScope: "regional" };
  if (typeof window === "undefined") return d;
  try { return { ...d, ...(JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}) }; } catch { return d; }
}
export function setMeta(patch) {
  if (typeof window === "undefined") return;
  const next = { ...getMeta(), ...patch };
  safeSet(META_KEY, JSON.stringify(next));
  notify();
}

// ---- writes ----  (all return the resulting stops)
// Adds a stop if not already present. Returns { added, already, stops }.
export function addStop(name, nights) {
  const nm = (name || "").trim();
  if (!nm) return { added: false, already: false, stops: read() };
  const stops = read();
  if (stops.some((s) => s.name === nm)) return { added: false, already: true, stops };
  stops.push({ name: nm, nights: Number(nights) > 0 ? Number(nights) : DEFAULT_NIGHTS });
  write(stops);
  notify(nm); // fire the "added" signal so the trip modal can pop
  return { added: true, already: false, stops };
}

export function removeStop(name) {
  const stops = read().filter((s) => s.name !== name);
  write(stops);
  return stops;
}

export function setNights(name, nights) {
  const n = Math.max(0, Math.round(Number(nights) || 0));
  const stops = read().map((s) => (s.name === name ? { ...s, nights: n } : s));
  write(stops);
  return stops;
}

// Move a stop up (-1) or down (+1) in the itinerary order.
export function moveStop(name, dir) {
  const stops = read();
  const i = stops.findIndex((s) => s.name === name);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= stops.length) return stops;
  const [it] = stops.splice(i, 1);
  stops.splice(j, 0, it);
  write(stops);
  return stops;
}

// Replace the whole itinerary at once (Build My Trip writes its edits back here so
// they survive a refresh). Coerces to the {name,nights} shape.
export function setStops(list) {
  const stops = (Array.isArray(list) ? list : [])
    .map((s) => {
      if (!s || !s.name) return null;
      const o = { name: String(s.name), nights: Number(s.nights) >= 0 ? Number(s.nights) : DEFAULT_NIGHTS };
      if (s.lat != null && s.lng != null) { o.lat = Number(s.lat); o.lng = Number(s.lng); }
      if (s.state) o.state = String(s.state);
      if (s.custom) o.custom = true;
      if (s.kind) o.kind = String(s.kind);
      if (s.slug) o.slug = String(s.slug);
      if (Array.isArray(s.waypoints) && s.waypoints.length) o.waypoints = coerceWaypoints(s.waypoints);
      return o;
    })
    .filter(Boolean);
  write(stops);
  return stops;
}

export function clearTrip() { write([]); }

// Subscribe to any change (same tab). Returns an unsubscribe fn. Also picks up
// cross-tab writes via the storage event.
export function subscribeTrip(fn) {
  subs.add(fn);
  const onStorage = (e) => { if (!e || e.key === KEY || e.key === META_KEY) fn(); };
  // `pb:trip` also fires from the account-sync pull (auth.js) after it writes remote
  // trip data into localStorage in this tab, so the UI refreshes on sign-in.
  const onEvt = () => fn();
  if (typeof window !== "undefined") { window.addEventListener("storage", onStorage); window.addEventListener("pb:trip", onEvt); }
  return () => {
    subs.delete(fn);
    if (typeof window !== "undefined") { window.removeEventListener("storage", onStorage); window.removeEventListener("pb:trip", onEvt); }
  };
}
