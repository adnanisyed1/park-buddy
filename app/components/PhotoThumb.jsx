"use client";

import { useEffect, useState } from "react";

// Small photo thumbnail for list rows (nearby trails/lakes/campgrounds etc):
// name-candidate lookup first, then the geotagged-Commons fallback when coords
// are given — same pipeline as the big tiles, sized down. Shares one
// localStorage cache (v3 — v2 held entries poisoned by the pre-503-fix window).
export const PHOTO_CACHE_KEY = "pb_photo_cache_v3";
let cache = null;
export function readPhotoCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}"); } catch { cache = {}; }
  return cache;
}
export function savePhotoCache() {
  try { localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

export function usePhoto(q, lat, lng) {
  const key = q + (lat != null ? "@" + Number(lat).toFixed(2) + "," + Number(lng).toFixed(2) : "");
  const [photo, setPhoto] = useState(() => {
    if (!q) return null;
    const c = readPhotoCache();
    if (!(key in c)) return undefined;
    const v = c[key];
    if (!v) return null;
    return { url: v.u, geo: !!v.g, date: v.d || null };
  });
  useEffect(() => {
    if (photo !== undefined || !q) return;
    let on = true;
    fetch("/api/photo?q=" + encodeURIComponent(q) + (lat != null ? "&lat=" + lat + "&lng=" + lng : "") + "&v=3")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u = d && d.found ? d.thumb || d.image : null;
        const c = readPhotoCache(); c[key] = u ? { u, g: !!d.geo, d: d.photoDate || null } : false; savePhotoCache();
        if (on) setPhoto(u ? { url: u, geo: !!d.geo, date: d.photoDate || null } : null);
      })
      .catch(() => { if (on) setPhoto(null); });
    return () => { on = false; };
  }, [q, lat, lng, key, photo]);
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
