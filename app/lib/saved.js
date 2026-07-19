"use client";

// ---------------------------------------------------------------------------
// Saved places + Trip Buckets — the Airbnb-wishlist half of the platform.
//
// This is deliberately NOT part of app/lib/trip.js, and the reason matters.
// The trip store identifies a stop by its **name string**: addStop(name, nights)
// takes a name and nothing else, and inTrip/removeStop/setNights/moveStop all
// compare `s.name`. That is survivable for an itinerary you are actively editing
// on one screen. It is not survivable for a shelf of places that has to sit for
// months and then redraw itself — two different things share a name (a lake and
// the town beside it; "Emerald Lake" in three states), and a saved card has to
// render its own photo, type and distance without a name lookup that may fail.
//
// So a saved item carries a real record and a stable id, and the bridge to the
// trip is explicit (see toStops / the caller that feeds tripSetStops).
//
// Storage (localStorage), one key so a save is a single atomic write:
//   pb_saved → { v:1, items: { [id]: Item }, buckets: [ Bucket ] }
//
//   Item   = { id, kind, name, sub?, state?, lat?, lng?, href?, photo?, ref?, savedAt }
//   Bucket = { id, name, createdAt, itemIds: [id] }
//
// An item can sit in several buckets, or in none — "none" is the default shelf
// the UI calls "Saved places", so the first tap never has to ask a question.
//
// NOTE FOR WHOEVER ADDS A KEY HERE: pb_saved is registered in auth.js TRACK, so
// it mirrors into Supabase `user_data` for signed-in users. That mirror is a
// whole-blob, last-writer-wins copy — there is no merge. Two devices editing
// buckets at once will have one of them win. Fine for now; it is the same deal
// the trip already has, and it is written down here so it isn't a surprise later.
// ---------------------------------------------------------------------------

const KEY = "pb_saved";
const subs = new Set();

// Kinds a saved item can be. Lakes and campgrounds are in this list on purpose:
// they have no add-to-trip control anywhere in the app today, and saving is what
// finally lets them exist in a plan at all.
export const KINDS = ["park", "forest", "statePark", "town", "trail", "camp", "water", "drive", "place"];

const KIND_LABEL = {
  park: "National park", forest: "National forest", statePark: "State park",
  town: "Town", trail: "Trail", camp: "Campground", water: "Lake",
  drive: "Scenic drive", place: "Place",
};
export function kindLabel(kind) { return KIND_LABEL[kind] || "Place"; }

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// A DETERMINISTIC id, not a random one — the same place saved from the map, the
// park page and a search result must collapse to one entry rather than three.
// `ref` is whatever discriminator the caller actually has (parkCode, byway slug,
// a facility id, or the state); pass the most specific one available. Without a
// ref, two same-named things of the same kind WILL collide — which is why every
// call site should pass one.
export function makeId({ kind, name, ref, state }) {
  const k = KINDS.indexOf(kind) > -1 ? kind : "place";
  const disc = ref || state;
  return k + ":" + (disc ? slug(disc) + ":" : "") + slug(name);
}

// ---------------------------------------------------------------------------
// storage
// ---------------------------------------------------------------------------
// Always a FRESH object. A shared `EMPTY` constant spread with `{...EMPTY}` is a
// shallow copy — `items` would be the same object every time, so the first write
// against an empty store would permanently poison the constant.
const empty = () => ({ v: 1, items: {}, buckets: [] });

function read() {
  if (typeof window === "undefined") return empty();
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return empty(); }
  if (!raw || typeof raw !== "object") return empty();

  const items = {};
  const src = raw.items && typeof raw.items === "object" ? raw.items : {};
  for (const id of Object.keys(src)) {
    const it = src[id];
    if (!it || !it.name) continue;
    const o = {
      id: String(it.id || id),
      kind: KINDS.indexOf(it.kind) > -1 ? it.kind : "place",
      name: String(it.name),
      savedAt: Number(it.savedAt) || 0,
    };
    if (it.sub) o.sub = String(it.sub).slice(0, 120);
    if (it.state) o.state = String(it.state);
    if (it.lat != null && it.lng != null) { o.lat = Number(it.lat); o.lng = Number(it.lng); }
    if (it.href) o.href = String(it.href);
    if (it.photo) o.photo = String(it.photo);
    if (it.ref) o.ref = String(it.ref);
    items[o.id] = o;
  }

  const buckets = (Array.isArray(raw.buckets) ? raw.buckets : [])
    .map((b) => {
      if (!b || !b.name) return null;
      const ids = (Array.isArray(b.itemIds) ? b.itemIds : [])
        .map(String)
        .filter((id) => items[id]);          // drop references to deleted items
      return {
        id: String(b.id || "b_" + slug(b.name)),
        name: String(b.name).slice(0, 60),
        createdAt: Number(b.createdAt) || 0,
        itemIds: Array.from(new Set(ids)),
      };
    })
    .filter(Boolean);

  return { v: 1, items, buckets };
}

// Mirrors trip.js's safeSet: if storage is full, shed the oldest saved-trip
// snapshots (recomputable) rather than silently losing what the user just saved.
function safeSet(value) {
  if (typeof window === "undefined") return false;
  try { localStorage.setItem(KEY, value); return true; } catch {}
  for (let i = 0; i < 50; i++) {
    let a; try { a = JSON.parse(localStorage.getItem("pb_saved_trips") || "[]"); } catch { a = []; }
    if (!Array.isArray(a) || !a.length) break;
    a.sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0)); a.pop();
    try {
      localStorage.setItem("pb_saved_trips", JSON.stringify(a));
      window.dispatchEvent(new Event("pb:saved-trips"));
    } catch {}
    try { localStorage.setItem(KEY, value); return true; } catch {}
  }
  try { window.dispatchEvent(new Event("pb:storage-full")); } catch {}
  return false;
}

function write(state, saved) {
  if (typeof window === "undefined") return;
  safeSet(JSON.stringify(state));
  notify(saved);
}

function notify(saved) {
  subs.forEach((fn) => { try { fn(); } catch {} });
  if (typeof window !== "undefined") {
    // `saved` is non-null only on a save — that's the signal the toast listens for,
    // the same shape pb:trip uses for its auto-open.
    //
    // `internal` marks this as our own broadcast. subscribeSaved already ran every
    // callback via `subs` above, so it must ignore the echo or each subscriber
    // fires twice per change. Outside dispatchers (auth.js pullCloud) omit the
    // flag, which is exactly how they reach subscribers.
    try {
      window.dispatchEvent(new CustomEvent("pb:saved", {
        detail: { saved: saved || null, internal: true },
      }));
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------
export function getSaved() {
  const { items } = read();
  return Object.values(items).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
export function savedCount() { return Object.keys(read().items).length; }
export function getItem(id) { return read().items[id] || null; }
export function isSaved(id) { return !!read().items[id]; }

export function getBuckets() {
  return read().buckets.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
export function getBucket(id) { return read().buckets.find((b) => b.id === id) || null; }

export function bucketItems(bucketId) {
  const { items, buckets } = read();
  const b = buckets.find((x) => x.id === bucketId);
  if (!b) return [];
  return b.itemIds.map((id) => items[id]).filter(Boolean);
}

// The default shelf: everything not filed into a bucket yet.
export function unfiled() {
  const { items, buckets } = read();
  const filed = new Set();
  for (const b of buckets) for (const id of b.itemIds) filed.add(id);
  return Object.values(items)
    .filter((i) => !filed.has(i.id))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export function bucketsHolding(itemId) {
  return read().buckets.filter((b) => b.itemIds.indexOf(itemId) > -1);
}

// ---------------------------------------------------------------------------
// writes — items
// ---------------------------------------------------------------------------

// Save a place. Saving is instant and never asks which bucket — filing is a
// separate, optional act (see addToBucket). Re-saving an existing id refreshes
// the record's details but keeps the original savedAt, so the shelf doesn't
// reshuffle just because someone revisited a page.
export function savePlace(place) {
  if (!place || !place.name) return { ok: false, reason: "no name" };
  const id = place.id || makeId(place);
  const state = read();
  const prev = state.items[id];

  // MERGE, don't replace. The same place gets saved from surfaces with wildly
  // different detail — the map knows its coordinates, the park page knows its
  // description, a search result may know neither. Overwriting would let a
  // thin re-save silently delete the coordinates an earlier rich save captured,
  // and coordinates are what let a saved card place itself on a map later.
  const item = {
    ...(prev || {}),
    id,
    kind: KINDS.indexOf(place.kind) > -1 ? place.kind : (prev ? prev.kind : "place"),
    name: String(place.name),
    savedAt: prev ? prev.savedAt : Date.now(),
  };
  if (place.sub) item.sub = String(place.sub).slice(0, 120);
  if (place.state) item.state = String(place.state);
  if (place.lat != null && place.lng != null) { item.lat = Number(place.lat); item.lng = Number(place.lng); }
  if (place.href) item.href = String(place.href);
  if (place.photo) item.photo = String(place.photo);
  if (place.ref) item.ref = String(place.ref);

  state.items[id] = item;
  write(state, item);
  return { ok: true, id, item, already: !!prev };
}

export function unsave(id) {
  const state = read();
  if (!state.items[id]) return { ok: false };
  delete state.items[id];
  for (const b of state.buckets) b.itemIds = b.itemIds.filter((x) => x !== id);
  write(state);
  return { ok: true, id };
}

export function toggleSave(place) {
  const id = place.id || makeId(place);
  return isSaved(id) ? { ...unsave(id), saved: false } : { ...savePlace(place), saved: true };
}

// ---------------------------------------------------------------------------
// writes — buckets
// ---------------------------------------------------------------------------
export function createBucket(name, seedItemIds) {
  const nm = String(name || "").trim();
  if (!nm) return { ok: false, reason: "no name" };
  const state = read();
  if (state.buckets.some((b) => b.name.toLowerCase() === nm.toLowerCase())) {
    return { ok: false, reason: "exists" };
  }
  const bucket = {
    id: "b_" + slug(nm) + "_" + Date.now().toString(36),
    name: nm.slice(0, 60),
    createdAt: Date.now(),
    itemIds: (Array.isArray(seedItemIds) ? seedItemIds : []).filter((id) => state.items[id]),
  };
  state.buckets.push(bucket);
  write(state);
  return { ok: true, bucket };
}

export function renameBucket(id, name) {
  const nm = String(name || "").trim();
  if (!nm) return { ok: false };
  const state = read();
  const b = state.buckets.find((x) => x.id === id);
  if (!b) return { ok: false };
  b.name = nm.slice(0, 60);
  write(state);
  return { ok: true };
}

// Deleting a bucket does NOT delete the places in it — they fall back to the
// default shelf. Losing saved places because a folder was tidied away would be
// the worst possible surprise in this feature.
export function deleteBucket(id) {
  const state = read();
  const before = state.buckets.length;
  state.buckets = state.buckets.filter((b) => b.id !== id);
  if (state.buckets.length === before) return { ok: false };
  write(state);
  return { ok: true };
}

export function addToBucket(bucketId, itemIds) {
  const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
  const state = read();
  const b = state.buckets.find((x) => x.id === bucketId);
  if (!b) return { ok: false };
  const add = ids.filter((id) => state.items[id] && b.itemIds.indexOf(id) === -1);
  b.itemIds = b.itemIds.concat(add);
  write(state);
  return { ok: true, added: add.length };
}

export function removeFromBucket(bucketId, itemIds) {
  const ids = new Set(Array.isArray(itemIds) ? itemIds : [itemIds]);
  const state = read();
  const b = state.buckets.find((x) => x.id === bucketId);
  if (!b) return { ok: false };
  const before = b.itemIds.length;
  b.itemIds = b.itemIds.filter((id) => !ids.has(id));
  write(state);
  return { ok: true, removed: before - b.itemIds.length };
}

// ---------------------------------------------------------------------------
// the bridge to Trip Studio
// ---------------------------------------------------------------------------

// Convert saved items into trip-stop shapes (app/lib/trip.js setStops). Kept here
// rather than in trip.js so the trip store stays unaware of saving.
//
// Two deliberate mappings:
//  - `drive` becomes kind "byway", the one kind the trip store already understands.
//  - a stop's identity in the trip is still its NAME, so anything without a name
//    is dropped rather than written as a broken stop.
export function toStops(itemIds, nightsFor) {
  const { items } = read();
  return (Array.isArray(itemIds) ? itemIds : [itemIds])
    .map((id) => items[id])
    .filter((i) => i && i.name)
    .map((i) => {
      const stop = {
        name: i.name,
        nights: typeof nightsFor === "function" ? nightsFor(i) : defaultNights(i.kind),
      };
      if (i.lat != null && i.lng != null) { stop.lat = i.lat; stop.lng = i.lng; }
      if (i.state) stop.state = i.state;
      if (i.kind === "drive") { stop.kind = "byway"; if (i.ref) stop.slug = i.ref; }
      else if (i.kind === "forest") stop.kind = "forest";
      // Anything that isn't a park/forest/byway is a geocoded point as far as the
      // trip is concerned — flag it so the trip rehydrates from coords, not a
      // name lookup against the parks dataset (which would fail for a trail).
      if (["trail", "camp", "water", "town", "place", "statePark"].indexOf(i.kind) > -1) stop.custom = true;
      return stop;
    });
}

function defaultNights(kind) {
  if (kind === "park" || kind === "forest" || kind === "statePark") return 2;
  if (kind === "town") return 1;
  return 0;   // a trail, campground, lake or drive is something you do, not sleep at
}

// ---------------------------------------------------------------------------
// subscribe
// ---------------------------------------------------------------------------
export function subscribeSaved(fn) {
  subs.add(fn);
  const onStorage = (e) => { if (!e || e.key === KEY) fn(); };
  // Skip our own broadcast — `subs` already delivered it (see notify).
  const onEvent = (e) => { if (!(e && e.detail && e.detail.internal)) fn(); };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);   // another tab
    window.addEventListener("pb:saved", onEvent);    // this tab, incl. auth pullCloud
  }
  return () => {
    subs.delete(fn);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pb:saved", onEvent);
    }
  };
}
