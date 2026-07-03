// Browser-only elevation lookups via google.maps.ElevationService (part of the
// core Maps JS API, no extra `libraries=` param needed). Only ever called from
// client components (the in-app trail panel, and /trail-status's route/chart
// island) — never import this from a Server Component.
//
// Requires the Elevation API to be enabled for the Maps key in Google Cloud
// Console (a separate toggle from the Maps JavaScript API itself) — callers
// should treat a null result as "unavailable" and degrade gracefully rather
// than erroring.

import { ensureMapsLoaded } from "./googleMapsLoader";

let elevCache = null;
function getElevCache() {
  if (elevCache) return elevCache;
  try { elevCache = JSON.parse(localStorage.getItem("pb_elev_cache_v2") || "{}"); } catch { elevCache = {}; }
  return elevCache;
}
function saveElevCache() {
  try { localStorage.setItem("pb_elev_cache_v2", JSON.stringify(elevCache)); } catch {}
}

// Returns { gainFt, points: [{mi, ft}, ...] } or { gainFt: null, points: [] }
// if elevation data isn't available. Cached in localStorage per trail `key` so
// repeat views (panel + status page, or reloading either) don't re-hit the API.
export async function fetchElevationProfile(key, path) {
  const cache = getElevCache();
  if (cache[key] !== undefined) return cache[key];
  if (!Array.isArray(path) || path.length < 2) return { gainFt: null, points: [] };
  const loaded = await ensureMapsLoaded();
  if (!loaded || !window.google || !window.google.maps) return { gainFt: null, points: [] };
  return new Promise((resolve) => {
    const svc = new window.google.maps.ElevationService();
    svc.getElevationForLocations({ locations: path.map(([lat, lng]) => ({ lat, lng })) }, (results, status) => {
      let profile = { gainFt: null, points: [] };
      if (status === "OK" && results && results.length > 1) {
        // Real cumulative distance per point, not an equal-fraction assumption —
        // the downsampled path (samplePath in /api/trails) steps by array index,
        // not by even arc-length, so points are NOT evenly spaced by mile.
        let gainM = 0, cumMi = 0;
        const points = results.map((r, i) => {
          if (i > 0) {
            const d = r.elevation - results[i - 1].elevation;
            if (d > 0) gainM += d;
            cumMi += milesBetween(path[i - 1], path[i]);
          }
          return { mi: +cumMi.toFixed(2), ft: Math.round(r.elevation * 3.28084) };
        });
        profile = { gainFt: Math.round(gainM * 3.28084), points };
      }
      const c = getElevCache();
      c[key] = profile;
      saveElevCache();
      resolve(profile);
    });
  });
}

function milesBetween(a, b) {
  const R = 3958.8, toRad = Math.PI / 180;
  const [lat1, lng1] = a, [lat2, lng2] = b;
  const dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
