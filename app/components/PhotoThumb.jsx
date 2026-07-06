"use client";

import { useEffect, useRef, useState } from "react";

// Small photo thumbnail for list rows (nearby trails/lakes/campgrounds etc):
// name-candidate lookup first, then the geotagged-Commons fallback when coords
// are given — same pipeline as the big tiles, sized down. Shares one
// localStorage cache (v3 — v2 held entries poisoned by the pre-503-fix window).
// v4: v3 got poisoned in browsers by the pre-fix window where /api/photo returned
// a 200 `found:false` on a rate-limited (429) upstream instead of a 503 — the
// client cached that as a permanent no-photo. Bumping the key flushes it; the API
// now returns 503 on transient failures so it can't recur.
// v5: bump so returning visitors re-fetch at the new crisp resolution (v4 held
// the old 320px thumbs that looked blurry stretched across heroes/tiles).
export const PHOTO_CACHE_KEY = "pb_photo_cache_v5";
let cache = null;
export function readPhotoCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}"); } catch { cache = {}; }
  return cache;
}
export function savePhotoCache() {
  try { localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// Global concurrency gate for /api/photo. A photo-heavy page (e.g. the 141
// scenic-drive tiles) would otherwise fire every request at once on mount; the
// upstream photo source rate-limits that burst and returns 503s, so the first
// visit shows missing photos. Capping the in-flight count keeps every request
// under the limit — single fetches always succeed; only the stampede failed.
const PHOTO_MAX_CONCURRENT = 6;
let photoActive = 0;
const photoQueue = [];
function pumpPhotoQueue() {
  while (photoActive < PHOTO_MAX_CONCURRENT && photoQueue.length) {
    const { url, resolve, reject } = photoQueue.shift();
    photoActive++;
    fetch(url).then(resolve, reject).finally(() => { photoActive--; pumpPhotoQueue(); });
  }
}
function gatedPhotoFetch(url) {
  return new Promise((resolve, reject) => {
    photoQueue.push({ url, resolve, reject });
    pumpPhotoQueue();
  });
}

function cacheLookup(key, q) {
  if (!q) return null;
  const c = readPhotoCache();
  if (!(key in c)) return undefined; // never fetched → let the effect fetch
  const v = c[key];
  return v ? { url: v.u, geo: !!v.g, date: v.d || null } : null;
}

export function usePhoto(q, lat, lng, ref, w) {
  const key = q ? q + (lat != null ? "@" + Number(lat).toFixed(2) + "," + Number(lng).toFixed(2) : "") + (w ? "~" + w : "") : "";
  const [photo, setPhoto] = useState(() => cacheLookup(key, q));
  // Re-sync from cache when the KEY changes — e.g. q went from null → a real
  // query once the parent's data loaded (the park-status hero photo case). Without
  // this the fetch effect below (which only runs when photo === undefined) would
  // never fire for that case, leaving the photo blank forever.
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    setPhoto(cacheLookup(key, q));
  }, [key, q]);
  // Optional viewport gate: when the caller passes an element ref, defer the
  // fetch until that element scrolls near the screen. On a page with many tiles
  // (e.g. the 141 scenic drives) this spreads requests out as the user scrolls
  // instead of firing all at once — which the upstream photo source rate-limits.
  // Callers that pass no ref (list rows) stay eager, exactly as before.
  const [inView, setInView] = useState(() => !ref);
  useEffect(() => {
    if (!ref || inView) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, inView]);
  useEffect(() => {
    if (photo !== undefined || !q || !inView) return;
    let on = true;
    gatedPhotoFetch("/api/photo?q=" + encodeURIComponent(q) + (lat != null ? "&lat=" + lat + "&lng=" + lng : "") + (w ? "&w=" + w : "") + "&v=5")
      .then(async (r) => {
        // A transient upstream failure (503) or a network error must NOT be
        // cached — otherwise a momentary blip poisons this tile's localStorage
        // entry to `false` forever. Only a real 200 response is authoritative.
        if (!r.ok) { if (on) setPhoto(null); return; }
        const d = await r.json();
        const u = d && d.found ? d.thumb || d.image : null;
        const c = readPhotoCache(); c[key] = u ? { u, g: !!d.geo, d: d.photoDate || null } : false; savePhotoCache();
        if (on) setPhoto(u ? { url: u, geo: !!d.geo, date: d.photoDate || null } : null);
      })
      .catch(() => { if (on) setPhoto(null); });
    return () => { on = false; };
  }, [q, lat, lng, key, photo, inView]);
  return photo;
}

export default function PhotoThumb({ q, lat, lng, alt }) {
  const photo = usePhoto(q, lat, lng);
  return (
    <span style={{ position: "relative", width: 64, height: 48, flex: "none", borderRadius: 9, overflow: "hidden", display: "block", background: "repeating-linear-gradient(135deg,#ece5d4 0 8px,#e6dfcd 8px 16px)" }}>
      {photo && photo.url && (
        <img src={photo.url} alt={alt || ""} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </span>
  );
}
