// Deterministic day-time engine — the "time brain" shared by Trip Studio, the PDF
// and (via a tool) the AI agent.
//
// Everything here is PURE MATH: no network, no LLM, no Date.now(). That's the whole
// point — estimating how long a hike takes, how long the drive between two stops is,
// and whether a day's plan fits before dark must be cheap, reproducible and work
// offline. The AI's job is to interpret messy intent ("take it easy, we love
// waterfalls") and then CALL this; it should never do the arithmetic itself.
//
// Assumptions (documented so they're honest, not hidden):
//   HIKE_MPH 2   — moving pace incl. elevation + photo stops; parks aren't flat.
//   DRIVE_MPH 40 — park + mountain-road average between in-park activities.
//   ROAD_FACTOR 1.25 — straight-line → real road distance (same factor the PDF uses).
// These are estimates and are labelled as such everywhere they surface ("~", "Est.").

export const HIKE_MPH = 2;
export const DRIVE_MPH = 40;
export const ROAD_FACTOR = 1.25;
const COMFORT_MIN = 10 * 60; // a day whose active+drive time tops ~10 h reads as "packed"

// Great-circle miles between two {lat,lng}.
export function milesBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const R = 3958.8, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Estimated on-site minutes for one activity block. A hike scales with its distance
// (pulled from `lengthMi` or a "· 4.2 mi" suffix in the name); everything else uses a
// sensible per-type baseline.
export function activityMinutes(block) {
  const b = block || {};
  const m = /([\d.]+)\s*mi\b/i.exec(b.name || "");
  const miles = b.lengthMi != null ? Number(b.lengthMi) : (m ? parseFloat(m[1]) : null);
  switch (b.type) {
    case "hike": return Math.round((miles && miles > 0 ? miles : 3) / HIKE_MPH * 60) + 20;
    case "meal": return 60;
    case "scenic": return 90;   // a scenic drive / byway segment
    case "sight": return 40;    // viewpoint, arch, waterfall, ranger program
    case "stay": return 0;      // a lodging checkpoint, not time on the clock
    default: return 45;
  }
}

// Driving minutes between two geolocated points (0 when either lacks coords).
export function driveMinutes(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const mi = milesBetween(a, b) * ROAD_FACTOR;
  return Math.round((mi / DRIVE_MPH) * 60);
}

const toMin = (hhmm) => { const p = String(hhmm || "").split(":"); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); };
export function toHHMM(min) {
  let x = Math.max(0, Math.round(min));
  const h = Math.floor(x / 60) % 24, m = x % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
// "8:40 AM" style for human copy.
export function fmtClock(min) {
  let x = Math.max(0, Math.round(min));
  let h = Math.floor(x / 60) % 24; const m = x % 60;
  const ap = h < 12 ? "AM" : "PM"; h = h % 12; if (h === 0) h = 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}

// Lay a day's activities on a timeline from a start time, inserting a drive leg before
// each geolocated activity that has a different location than the previous one. Returns
// the scheduled items (each stamped with start/end + the drive that precedes it) and a
// summary the UI/PDF can show honestly.
//
//   scheduleDay(activities, { startTime | startMin, sunset (Date) | sunsetMin, origin })
export function scheduleDay(activities, opts = {}) {
  const list = Array.isArray(activities) ? activities : [];
  const startMin = opts.startMin != null ? opts.startMin : toMin(opts.startTime || "08:30");
  const sunsetMin = opts.sunsetMin != null ? opts.sunsetMin
    : (opts.sunset instanceof Date ? opts.sunset.getHours() * 60 + opts.sunset.getMinutes() : null);

  let cursor = startMin, driveMin = 0, activeMin = 0;
  let prev = opts.origin && opts.origin.lat != null ? opts.origin : null;
  const items = list.map((a) => {
    const d = prev ? driveMinutes(prev, a) : 0;
    cursor += d; driveMin += d;
    const dur = activityMinutes(a);
    const startM = cursor, endM = cursor + dur;
    cursor = endM; activeMin += dur;
    if (a && a.lat != null) prev = a;
    return { ...a, driveMinBefore: d, startMin: startM, endMin: endM, time: toHHMM(startM), endTime: toHHMM(endM), estMin: dur };
  });

  const endMin = cursor;
  return {
    items,
    summary: {
      startMin, endMin,
      startTime: toHHMM(startMin), endTime: toHHMM(endMin), endClock: fmtClock(endMin),
      activeMin, driveMin, totalMin: endMin - startMin,
      sunsetMin, sunsetClock: sunsetMin != null ? fmtClock(sunsetMin) : null,
      endsAfterSunset: sunsetMin != null && endMin > sunsetMin,
      packed: (activeMin + driveMin) > COMFORT_MIN,
    },
  };
}

// A short, honest one-liner for a scheduled day (used by the pacing chip).
export function pacingNote(summary) {
  if (!summary) return null;
  const h = (m) => (m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "") : m + "m");
  if (summary.endsAfterSunset) return "Runs past sunset (" + summary.sunsetClock + ") — ends ~" + summary.endClock + ". Trim a stop or start earlier.";
  if (summary.packed) return "Packed day — ~" + h(summary.activeMin + summary.driveMin) + " of activity + driving. Leave some slack.";
  return "Wraps ~" + summary.endClock + (summary.driveMin >= 30 ? " · ~" + h(summary.driveMin) + " driving between stops" : "");
}
