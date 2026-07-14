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
// A hike's time is DATA-DRIVEN — its real length + elevation gain, so a flat 3-mi lake
// loop and a 3-mi climb get very different estimates. Returns whole minutes.
export function estimateHikeMinutes(mi, gainFt) {
  const m = Math.max(0, Number(mi) || 0), g = Math.max(0, Number(gainFt) || 0);
  return Math.round(m * 30 + (g / 1000) * 30);
}
export function estimateTimeLabel(mi, gainFt) {
  const minutes = estimateHikeMinutes(mi, gainFt);
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

/* ---------------- live on-trail navigation math ---------------- */
// Used by /trail-status's "Start navigation" feature (app/trail-status/TrailRouteChart.jsx).
// Pure functions, no browser APIs — the actual navigator.geolocation calls live
// in the client component; this file just does the geometry.

// Closest point on the trail's polyline to a given lat/lng, via point-to-
// segment projection over every segment (locally-planar approximation, scaling
// longitude by cos(latitude) so x/y are comparable units — fine at trail
// scale). Returns the projected point, distance to it in miles, and how far
// along the trail (in miles) that point is — the same cumulative-distance
// convention used by app/lib/elevationClient.js's profile.
export function nearestPointOnPath(lat, lng, path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  if (path.length === 1) {
    const [pLat, pLng] = path[0];
    return { lat: pLat, lng: pLng, distMi: milesBetween(lat, lng, pLat, pLng), mileMark: 0 };
  }
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best = null, cumMi = 0;
  for (let i = 1; i < path.length; i++) {
    const [aLat, aLng] = path[i - 1], [bLat, bLng] = path[i];
    const segMi = milesBetween(aLat, aLng, bLat, bLng);
    const ax = aLng * cosLat, ay = aLat, bx = bLng * cosLat, by = bLat, px = lng * cosLat, py = lat;
    const abx = bx - ax, aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq > 0 ? ((px - ax) * abx + (py - ay) * aby) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const projLat = aLat + t * (bLat - aLat), projLng = aLng + t * (bLng - aLng);
    const distMi = milesBetween(lat, lng, projLat, projLng);
    const mileMark = cumMi + segMi * t;
    if (!best || distMi < best.distMi) best = { lat: projLat, lng: projLng, distMi, mileMark };
    cumMi += segMi;
  }
  return best;
}

// A lat/lng interpolated at a given cumulative mile along the path — used to
// find a "keep going this way" lookahead point once the user is on-trail.
export function pointAtMile(path, mile) {
  if (!Array.isArray(path) || path.length === 0) return null;
  if (path.length === 1) return { lat: path[0][0], lng: path[0][1] };
  let cumMi = 0;
  for (let i = 1; i < path.length; i++) {
    const [aLat, aLng] = path[i - 1], [bLat, bLng] = path[i];
    const segMi = milesBetween(aLat, aLng, bLat, bLng);
    if (mile <= cumMi + segMi || i === path.length - 1) {
      const t = segMi > 0 ? Math.max(0, Math.min(1, (mile - cumMi) / segMi)) : 0;
      return { lat: aLat + t * (bLat - aLat), lng: aLng + t * (bLng - aLng) };
    }
    cumMi += segMi;
  }
  const last = path[path.length - 1];
  return { lat: last[0], lng: last[1] };
}

// Initial great-circle compass bearing (degrees, 0-360, 0 = north) from one
// point to another.
export function bearingTo(lat1, lng1, lat2, lng2) {
  const toRad = Math.PI / 180, toDeg = 180 / Math.PI;
  const phi1 = lat1 * toRad, phi2 = lat2 * toRad, dLambda = (lng2 - lng1) * toRad;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (((Math.atan2(y, x) * toDeg) % 360) + 360) % 360;
}

const COMPASS_LABELS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
export function compassLabel(bearingDeg) {
  const idx = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return COMPASS_LABELS[idx];
}
