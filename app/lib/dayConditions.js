// Per-day weather for the Trip Studio day planner. Reuses the shared verdict engine's
// forecast (window.PBVerdict.fetchForecast returns the full ~7-day NWS periods array in
// one call per base) — we just pick out the periods that fall on a given calendar date.
//
// dayWeather(periods, dateISO) → { hi, lo, sky, wind, verdict } | null
//   null means that date is outside the ~7-day NWS forecast window (or before today),
//   so the caller shows sun times only and no invented weather.

export function dayWeather(periods, dateISO) {
  if (!periods || !periods.length || !dateISO) return null;
  let dayIdx = -1, hi = null, lo = null, sky = "", wind = "";
  for (let k = 0; k < periods.length; k++) {
    const p = periods[k];
    // NWS startTime is local to the point, e.g. "2026-07-15T06:00:00-06:00"; the date
    // portion is the calendar day, which is what we match the trip day against.
    if (!p || !p.startTime || p.startTime.slice(0, 10) !== dateISO) continue;
    if (p.isDaytime) {
      if (dayIdx < 0) { dayIdx = k; sky = p.shortForecast || ""; wind = p.windSpeed || ""; }
      if (hi == null) hi = p.temperature;
    } else if (lo == null) {
      lo = p.temperature;
    }
  }
  // A day with only a nighttime period left (e.g. late "today") — use it so we still show something.
  if (dayIdx < 0) {
    for (let k = 0; k < periods.length; k++) {
      const p = periods[k];
      if (p && p.startTime && p.startTime.slice(0, 10) === dateISO) {
        dayIdx = k; if (hi == null) hi = p.temperature; if (!sky) sky = p.shortForecast || ""; if (!wind) wind = p.windSpeed || ""; break;
      }
    }
  }
  if (dayIdx < 0) return null; // beyond the forecast window
  const verdict = (typeof window !== "undefined" && window.PBVerdict)
    ? window.PBVerdict.evaluate(periods.slice(dayIdx), 0, 0) // scores this day's daytime period
    : null;
  return { hi, lo, sky, wind, verdict };
}

// A compact weather glyph for a short-forecast string.
export function skyIcon(sky) {
  const s = (sky || "").toLowerCase();
  if (/thunder|storm|tornado/.test(s)) return "⛈";
  if (/blizzard|sleet|ice|freezing/.test(s)) return "🌨";
  if (/snow|flurr/.test(s)) return "❄️";
  if (/heavy rain|rain/.test(s)) return "🌧";
  if (/shower|drizzle/.test(s)) return "🌦";
  if (/smoke|fog|haze|mist/.test(s)) return "🌫";
  if (/partly (sunny|cloudy)|mostly (sunny|cloudy)|partly clear/.test(s)) return "⛅";
  if (/sunny|clear/.test(s)) return "☀️";
  if (/cloud|overcast/.test(s)) return "☁️";
  return "🌡";
}
