"use client";

// A small animated weather tile: cloud with rain falling out of it, fog bands
// sliding past each other, a sun with turning rays, a crescent with stars.
//
// It sits BESIDE the temperature rather than over the photograph. The photo is
// how someone judges whether they want to go somewhere, and washing it in
// animation both hides the place and makes every card look like the same day.
//
// The condition comes from the forecast the tile already has — weather.gov's
// shortForecast, "Patchy Fog" / "Scattered Showers And Thunderstorms". Never
// invented: no forecast, no tile.
//
// Day vs night is the forecast period's own isDaytime flag, not a guess from the
// word "Clear". weather.gov says "Sunny" by day and "Clear" by night as a
// convention, and a convention is not a guarantee — getting it wrong puts a sun
// on a midnight card.
//
// Styling lives in globals.css under "Animated weather tile" so the keyframes
// are parsed once, not once per card. It scales off font-size, so the same
// component works at tile size and hero size.

// First match wins, so the more consequential condition takes the tile: snow
// before rain, because "Rain And Snow" is a snow day to whoever walks in it.
const RULES = [
  [/thunder|t-?storm/i, "storm"],
  [/snow|flurr|sleet|wintry|blizzard|ice/i, "snow"],
  [/rain|shower|drizzle/i, "rain"],
  [/smoke|ash/i, "smoke"],
  [/fog|haze|mist/i, "fog"],
  [/cloud|overcast/i, "cloud"],
  [/clear|sunny|fair/i, "clearsky"],
];

export function skyKind(sky, wind, isDay) {
  const s = String(sky || "");
  if (s) {
    for (const [re, kind] of RULES) {
      if (re.test(s)) return kind === "clearsky" ? (isDay === false ? "night" : "sun") : kind;
    }
  }
  if (wind >= 20) return "wind";     // no readable sky, but a real gust is worth showing
  return null;
}

// Colour per condition, so a storm doesn't read the same as a clear morning.
const TINT = {
  rain: "#9fc4e8", storm: "#c8b3e6", snow: "#e8f1f7", fog: "#c3cdd0",
  smoke: "#cbab84", cloud: "#c6ced6", sun: "#f0c568", night: "#dfe6f2", wind: "#b8c8c2",
};

function Scene({ kind }) {
  switch (kind) {
    case "rain":
      return (<>
        <i className="wx-cloud wx-drift" />
        <i className="wx-drop wx-i1" /><i className="wx-drop wx-i2" /><i className="wx-drop wx-i3" />
      </>);
    case "storm":
      return (<>
        <i className="wx-cloud wx-drift" />
        <i className="wx-drop wx-i1" /><i className="wx-drop wx-i3" />
        <i className="wx-bolt" />
      </>);
    case "snow":
      return (<>
        <i className="wx-cloud wx-drift" />
        <i className="wx-flake wx-i1" /><i className="wx-flake wx-i2" /><i className="wx-flake wx-i3" />
      </>);
    case "fog":
    case "smoke":
      return (<><i className="wx-band wx-b1" /><i className="wx-band wx-b2" /><i className="wx-band wx-b3" /></>);
    case "cloud":
      return <i className="wx-cloud wx-drift" />;
    case "sun":
      return (<><i className="wx-rays" /><i className="wx-sun" /></>);
    case "night":
      return (<><i className="wx-star wx-s1" /><i className="wx-star wx-s2" /><i className="wx-moon" /></>);
    case "wind":
      return (<><i className="wx-gust wx-g1" /><i className="wx-gust wx-g2" /><i className="wx-gust wx-g3" /></>);
    default:
      return null;
  }
}

const LABEL = {
  rain: "Rain", storm: "Thunderstorms", snow: "Snow", fog: "Fog", smoke: "Smoke",
  cloud: "Cloudy", sun: "Clear", night: "Clear night", wind: "Windy",
};

// `cut` is the background the crescent bites out of — it has to match whatever
// the tile is sitting on or the moon shows a coloured notch.
// `always` is for slots that are guaranteed to HAVE a forecast — a row of hourly
// tiles, a 7-day strip. There, an unrecognised phrase ("Areas Of Blowing Dust")
// should still draw something rather than leave a hole in the row. On a card that
// may not have fetched a forecast yet, leave it off: absent is honest, a guessed
// cloud is not.
export default function WeatherFX({ sky, wind, isDay, size = "1rem", cut, always = false }) {
  const kind = skyKind(sky, wind, isDay) || (always && sky ? "cloud" : null);
  if (!kind) return null;
  return (
    <span
      className="wx"
      role="img"
      aria-label={sky || LABEL[kind]}
      title={sky || LABEL[kind]}
      style={{ fontSize: size, color: TINT[kind] || "currentColor", "--wx-cut": cut || "var(--pb-surface-2)" }}
    >
      <Scene kind={kind} />
    </span>
  );
}
