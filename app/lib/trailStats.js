// Shared trail-stat estimates — used by both the in-app trail detail panel
// (app/explore/ExploreApp.jsx) and the standalone /trail-status page. NPS's
// own trail dataset has no difficulty rating, time estimate, or route-type
// field (only geometry + surface/class/etc), so these are computed. All are
// clearly labeled "Est." in the UI since they're derived, not authoritative
// trail-agency ratings.

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad, dLng = (bLng - aLng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Naismith's-rule-style estimate: ~2 mph base pace + 30 min per 1000 ft of gain.
export function estimateTimeLabel(mi, gainFt) {
  const minutes = mi * 30 + (gainFt / 1000) * 30;
  if (minutes < 60) return Math.round(minutes / 5) * 5 + " min";
  const h = Math.floor(minutes / 60), m = Math.round((minutes % 60) / 5) * 5;
  return h + "h" + (m ? " " + m + "m" : "");
}

export function estimateDifficulty(mi, gainFt) {
  if (mi <= 3 && gainFt <= 500) return "Easy";
  if (mi <= 8 && gainFt <= 1500) return "Moderate";
  return "Hard";
}

// Geometric guess only — a real point-to-point (shuttle) trail looks identical
// to an out-and-back in pure geometry, so this can only reliably detect loops.
export function routeTypeFor(path) {
  if (!Array.isArray(path) || path.length < 3) return "Out & back";
  const [lat1, lng1] = path[0], [lat2, lng2] = path[path.length - 1];
  return milesBetween(lat1, lng1, lat2, lng2) < 0.15 ? "Loop" : "Out & back";
}
