"use client";

// The weather on the photo, from the forecast the tile already has.
//
// weather.gov gives a shortForecast string — "Patchy Fog", "Chance Light Rain",
// "Scattered Showers And Thunderstorms" — and that's what picks the effect. It is
// never invented: no forecast, no animation. A tile still loading its verdict shows
// a plain photo rather than a guess at the sky.
//
// Day vs night comes from the forecast period's own isDaytime flag, not from
// reading "Clear" and assuming. weather.gov does say "Sunny" by day and "Clear" by
// night, but that's a convention, not a guarantee, and getting it wrong puts a sun
// on a midnight photo.
//
// All the styling lives in globals.css under "Weather effects for place tiles" so
// the keyframes are parsed once instead of once per card.

// Ordered: the first match wins, so the more consequential condition takes the
// tile. Snow before rain because "Rain And Snow" is a snow day to a hiker.
const RULES = [
  [/thunder|t-?storm/i, "storm"],
  [/snow|flurr|sleet|wintry|blizzard|ice/i, "snow"],
  [/rain|shower|drizzle/i, "rain"],
  [/smoke|ash/i, "smoke"],
  [/fog|haze|mist/i, "fog"],
  [/cloud|overcast/i, "cloud"],
  [/clear|sunny|fair/i, "clearsky"],
];

export function skyEffect(sky, wind, isDay) {
  const s = String(sky || "");
  if (s) {
    for (const [re, kind] of RULES) {
      if (re.test(s)) return kind === "clearsky" ? (isDay === false ? "stars" : "sun") : kind;
    }
  }
  // No recognisable sky, but a real wind reading is still worth showing.
  if (wind >= 20) return "wind";
  return null;
}

const LAYERS = {
  rain:  ["pbfx-rain-a", "pbfx-rain-b"],
  storm: ["pbfx-rain-a", "pbfx-rain-b", "pbfx-flash"],
  snow:  ["pbfx-snow-a", "pbfx-snow-b"],
  fog:   ["pbfx-fog-a", "pbfx-fog-b"],
  smoke: ["pbfx-smoke-a", "pbfx-smoke-b"],
  cloud: ["pbfx-cloud-a", "pbfx-cloud-b"],
  sun:   ["pbfx-sun-a"],
  stars: ["pbfx-star-a", "pbfx-star-b"],
  wind:  ["pbfx-wind-a"],
};

// `strength` scales the whole thing down on small tiles and up on a hero.
export default function WeatherFX({ sky, wind, isDay, strength = 1 }) {
  const kind = skyEffect(sky, wind, isDay);
  if (!kind) return null;
  const layers = LAYERS[kind];
  if (!layers) return null;

  return (
    <span className="pbfx" aria-hidden="true" style={{ opacity: strength }}>
      {layers.map((c) => <i key={c} className={c} />)}
    </span>
  );
}
