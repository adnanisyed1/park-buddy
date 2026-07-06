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

function read() {
  if (typeof window === "undefined") return [];
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  // Migrate legacy array-of-strings and coerce shapes.
  return raw
    .map((s) => (typeof s === "string" ? { name: s, nights: DEFAULT_NIGHTS } : s && s.name ? { name: String(s.name), nights: Number(s.nights) > 0 ? Number(s.nights) : DEFAULT_NIGHTS } : null))
    .filter(Boolean);
}

function write(stops) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(stops)); } catch {}
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
  const d = { tripName: "My national-parks trip", startDate: "", travelers: 2 };
  if (typeof window === "undefined") return d;
  try { return { ...d, ...(JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}) }; } catch { return d; }
}
export function setMeta(patch) {
  if (typeof window === "undefined") return;
  const next = { ...getMeta(), ...patch };
  try { localStorage.setItem(META_KEY, JSON.stringify(next)); } catch {}
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

export function clearTrip() { write([]); }

// Subscribe to any change (same tab). Returns an unsubscribe fn. Also picks up
// cross-tab writes via the storage event.
export function subscribeTrip(fn) {
  subs.add(fn);
  const onStorage = (e) => { if (!e || e.key === KEY || e.key === META_KEY) fn(); };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
