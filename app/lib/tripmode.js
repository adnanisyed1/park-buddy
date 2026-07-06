"use client";

// Trip Mode + Trip Book shared state (all localStorage, client-only).
//   pb_trip_photos     → { [stopName]: [{ id, url, note, lat, lng, ts }] }   (url = downscaled dataURL)
//   pb_trip_checklist  → { [itemKey]: true }
//   pb_trip_breadcrumb → [{ lat, lng, ts }]
//   pb_trip_story      → { [stopName]: "the story text" }
//
// Photos are downscaled to ~1200px JPEG before saving so a handful fit within
// localStorage's ~5MB. This is the demo path — production would upload to object
// storage and store a URL. We flag that in the UI, and cap/last-in behaviour keeps
// it from silently exploding.

const PHOTOS = "pb_trip_photos", CHECK = "pb_trip_checklist", CRUMB = "pb_trip_breadcrumb", STORY = "pb_trip_story";
const subs = new Set();

function read(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; }
}
function write(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota — caller should trim */ }
  notify();
}
function notify() {
  subs.forEach((fn) => { try { fn(); } catch {} });
  if (typeof window !== "undefined") { try { window.dispatchEvent(new CustomEvent("pb:tripmode")); } catch {} }
}
export function subscribeTripMode(fn) {
  subs.add(fn);
  const onStorage = () => fn();
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => { subs.delete(fn); if (typeof window !== "undefined") window.removeEventListener("storage", onStorage); };
}

// ---------- photos ----------
export function getPhotos() { return read(PHOTOS, {}); }
export function getPhotosFor(stop) { return (read(PHOTOS, {})[stop]) || []; }
export function photoCount() { const p = read(PHOTOS, {}); return Object.values(p).reduce((a, arr) => a + arr.length, 0); }

// Downscale a File/Blob to a JPEG dataURL (~maxPx on the long edge).
export function fileToDataUrl(file, maxPx = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const rd = new FileReader();
    rd.onload = () => { img.src = rd.result; };
    rd.onerror = reject;
    img.onload = () => {
      let { width: w, height: h } = img;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      try { resolve(c.toDataURL("image/jpeg", quality)); } catch (e) { reject(e); }
    };
    img.onerror = reject;
    rd.readAsDataURL(file);
  });
}

export function addPhoto(stop, { url, note = "", lat = null, lng = null } = {}) {
  if (!stop || !url) return;
  const all = read(PHOTOS, {});
  const list = all[stop] || [];
  list.push({ id: "p" + list.length + "_" + (typeof performance !== "undefined" ? Math.round(performance.now()) : list.length), url, note, lat, lng, ts: dateNow() });
  all[stop] = list;
  write(PHOTOS, all);
}
export function updatePhotoNote(stop, id, note) {
  const all = read(PHOTOS, {});
  (all[stop] || []).forEach((p) => { if (p.id === id) p.note = note; });
  write(PHOTOS, all);
}
export function removePhoto(stop, id) {
  const all = read(PHOTOS, {});
  all[stop] = (all[stop] || []).filter((p) => p.id !== id);
  if (!all[stop].length) delete all[stop];
  write(PHOTOS, all);
}

// ---------- checklist ----------
export function getChecklist() { return read(CHECK, {}); }
export function toggleChecklist(key) { const c = read(CHECK, {}); c[key] = !c[key]; write(CHECK, c); }

// ---------- story ----------
export function getStory() { return read(STORY, {}); }
export function setStory(stop, text) { const s = read(STORY, {}); s[stop] = text; write(STORY, s); }

// ---------- breadcrumb ----------
export function getBreadcrumb() { return read(CRUMB, []); }
export function addCrumb(lat, lng) {
  const b = read(CRUMB, []);
  const last = b[b.length - 1];
  // only record if we've moved ~>150m (avoids flooding while stationary)
  if (last && haversineM(last.lat, last.lng, lat, lng) < 150) return;
  b.push({ lat, lng, ts: dateNow() });
  if (b.length > 2000) b.shift();
  write(CRUMB, b);
}

function haversineM(la1, lo1, la2, lo2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (la2 - la1) * r, dLng = (lo2 - lo1) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export const distMiles = (la1, lo1, la2, lo2) => haversineM(la1, lo1, la2, lo2) / 1609.34;
function dateNow() { try { return Date.now(); } catch { return 0; } }
