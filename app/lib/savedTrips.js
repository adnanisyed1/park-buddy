// A library of MULTIPLE named itineraries. The single ACTIVE trip still lives in
// trip.js (pb_trip / pb_trip_meta); this stores snapshots you can name, search and
// reopen. localStorage key `pb_saved_trips` = [{ id, name, savedAt, stops, meta }].
// Added to auth.js TRACK so saved trips sync to the signed-in account.
import { getStops, getMeta, setStops, setMeta } from "./trip";

const KEY = "pb_saved_trips";
const has = () => typeof window !== "undefined";
function read() { if (!has()) return []; try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
function write(list) { if (!has()) return; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} if (has()) window.dispatchEvent(new Event("pb:saved-trips")); }
function uid() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function getSavedTrips() { return read().slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)); }

export function subscribeSavedTrips(fn) {
  if (!has()) return () => {};
  const local = () => fn();
  const cross = (e) => { if (!e || e.key === KEY || e.key === null) fn(); };
  window.addEventListener("pb:saved-trips", local);
  window.addEventListener("storage", cross);
  return () => { window.removeEventListener("pb:saved-trips", local); window.removeEventListener("storage", cross); };
}

// Snapshot the current active trip. Re-saving under a name that already exists updates
// that entry in place (no pile-up of duplicates); otherwise creates a new one.
export function saveCurrentTrip(name) {
  const stops = getStops() || [];
  const meta = getMeta() || {};
  const nm = ((name || meta.tripName || "Untitled trip") + "").trim() || "Untitled trip";
  const list = read();
  const existing = list.find((t) => (t.name || "").toLowerCase() === nm.toLowerCase());
  const entry = { id: existing ? existing.id : uid(), name: nm, savedAt: Date.now(), stops: stops.map((s) => ({ ...s })), meta: { ...meta, tripName: nm } };
  write(existing ? list.map((t) => (t.id === existing.id ? entry : t)) : [entry, ...list]);
  return entry;
}

// Upsert the active trip into My trips BY ID (not name). Used by the "document"
// model: the questionnaire creates an entry (pass id=null → new), and every later
// edit syncs into that same entry regardless of renames. Creates even when empty.
export function upsertActiveTrip(id, name) {
  const stops = getStops() || [];
  const meta = getMeta() || {};
  const nm = ((name || meta.tripName || "Untitled trip") + "").trim() || "Untitled trip";
  const list = read();
  const existing = id ? list.find((t) => t.id === id) : null;
  const entry = { id: existing ? existing.id : uid(), name: nm, savedAt: Date.now(), stops: stops.map((s) => ({ ...s })), meta: { ...meta, tripName: nm } };
  write(existing ? list.map((t) => (t.id === existing.id ? entry : t)) : [entry, ...list]);
  return entry;
}

// Load a saved itinerary back into the active trip (trip.js), so the whole app —
// modal, planner, Trip Mode — reflects it.
export function openSavedTrip(id) {
  const t = read().find((x) => x.id === id);
  if (!t) return false;
  setStops((t.stops || []).map((s) => ({ ...s })));
  setMeta(t.meta || {});
  return true;
}

export function deleteSavedTrip(id) { write(read().filter((t) => t.id !== id)); }
export function renameSavedTrip(id, name) { const nm = (name || "").trim(); if (!nm) return; write(read().map((t) => (t.id === id ? { ...t, name: nm, meta: { ...(t.meta || {}), tripName: nm } } : t))); }
export function duplicateSavedTrip(id) {
  const t = read().find((x) => x.id === id);
  if (!t) return null;
  const nm = t.name + " (copy)";
  const copy = { ...t, id: uid(), name: nm, savedAt: Date.now(), meta: { ...(t.meta || {}), tripName: nm } };
  write([copy, ...read()]);
  return copy;
}
