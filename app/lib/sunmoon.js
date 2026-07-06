// Compact, dependency-free solar + lunar calculations (trimmed port of the
// well-known SunCalc algorithm by Vladimir Agafonkin, BSD-2). Everything here is
// REAL math for a given date + lat/lng — used by the park-status "Sun & sky" card
// (sunrise / sunset / golden hour / moon phase / dark-sky hint). No fabrication.

const rad = Math.PI / 180;
const dayMs = 86400000;
const J1970 = 2440588, J2000 = 2451545;

function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
function fromJulian(j) { return new Date((j + 0.5 - J1970) * dayMs); }
function toDays(date) { return toJulian(date) - J2000; }

const e = rad * 23.4397; // obliquity of the Earth
function rightAscension(l, b) { return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)); }
function declination(l, b) { return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)); }
function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }
function eclipticLongitude(M) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372;
  return M + C + P + Math.PI;
}
function sunCoords(d) { const M = solarMeanAnomaly(d), L = eclipticLongitude(M); return { dec: declination(L, 0), ra: rightAscension(L, 0) }; }

const J0 = 0.0009;
function julianCycle(d, lw) { return Math.round(d - J0 - lw / (2 * Math.PI)); }
function approxTransit(Ht, lw, n) { return J0 + (Ht + lw) / (2 * Math.PI) + n; }
function solarTransitJ(ds, M, L) { return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L); }
function hourAngle(h, phi, d) { return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d))); }
function getSetJ(h, lw, phi, dec, n, M, L) {
  const w = hourAngle(h, phi, dec), a = approxTransit(w, lw, n);
  return solarTransitJ(a, M, L);
}

// Returns { sunrise, sunset, goldenHour, dawn, dusk, night } as Date objects (or
// null when the sun doesn't cross that angle, e.g. polar day/night).
export function getSunTimes(date, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(date);
  const n = julianCycle(d, lw), ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);
  const mk = (angle) => {
    const jset = getSetJ(angle * rad, lw, phi, dec, n, M, L);
    if (isNaN(jset)) return { rise: null, set: null };
    const jrise = Jnoon - (jset - Jnoon);
    return { rise: fromJulian(jrise), set: fromJulian(jset) };
  };
  const official = mk(-0.833);
  const golden = mk(6);   // golden hour ends (morning) / begins (evening)
  const civil = mk(-6);   // dawn / dusk
  const astro = mk(-18);  // astronomical twilight → "true dark"
  return {
    sunrise: official.rise, sunset: official.set,
    goldenHour: golden.set,             // evening golden hour begin
    goldenHourMorning: golden.rise,
    dawn: civil.rise, dusk: civil.set,
    night: astro.set,                    // astronomical dusk → dark sky begins
  };
}

// Moon illumination fraction + phase name for a given date.
export function getMoon(date) {
  const d = toDays(date);
  const M = rad * (134.963 + 13.064993 * d);
  const M0 = solarMeanAnomaly(d);
  // Phase angle approximation via elongation of the moon from the sun.
  const D = rad * (297.85 + 12.190749 * d);          // mean elongation
  const phaseAngle = Math.PI - D;                     // 0 = new, PI = full (approx)
  const fraction = (1 + Math.cos(phaseAngle)) / 2;    // illuminated fraction
  // Synodic-age based phase name (0..29.53 days).
  const synodic = 29.530588853;
  const age = ((d - 6.75) % synodic + synodic) % synodic; // ref new moon 2000-01-06
  let name;
  if (age < 1.85) name = "New";
  else if (age < 5.5) name = "Waxing crescent";
  else if (age < 9.2) name = "First quarter";
  else if (age < 12.9) name = "Waxing gibbous";
  else if (age < 16.6) name = "Full";
  else if (age < 20.3) name = "Waning gibbous";
  else if (age < 24) name = "Last quarter";
  else if (age < 27.7) name = "Waning crescent";
  else name = "New";
  const waxing = age < synodic / 2;
  return { fraction: Math.max(0, Math.min(1, fraction)), name, waxing, age };
}

// Small formatter for a Date → "6:12 AM" in a given IANA time zone (falls back to
// local). Returns "—" for null (no event).
export function fmtTime(date, timeZone) {
  if (!date || isNaN(date.valueOf())) return "—";
  try {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}
