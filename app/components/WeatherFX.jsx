"use client";

import { useId } from "react";

// A small animated weather icon, drawn as SVG.
//
// Used on the Explore place tiles and on the park page's hourly and 7-day
// strips. It replaced emoji there for a concrete reason: U+1F32B (fog) and
// U+1F324 (sun behind small cloud) have no glyph in plenty of system fonts, so
// a foggy morning rendered as a grey tofu box while a sunny one looked fine.
// Drawn shapes can't fail that way, they carry the condition in colour as well
// as form, and they can move.
//
// The condition comes from weather.gov's shortForecast — "Patchy Fog",
// "Scattered Showers And Thunderstorms". Never invented: no forecast, no icon
// (unless `always`, below).
//
// Day vs night is the forecast period's own isDaytime flag, not a guess from the
// word "Clear". weather.gov says "Sunny" by day and "Clear" by night as a
// convention, and a convention is not a guarantee — getting it wrong puts a sun
// on a midnight card.
//
// Keyframes live in globals.css under "Animated weather icons", so they're
// parsed once rather than once per icon. Everything animates transform or
// opacity only, so a screenful stays on the compositor.

// First match wins: the more consequential condition takes the icon. Snow before
// rain, because "Rain And Snow" is a snow day to whoever walks in it, and thunder
// above everything, because "Mostly Sunny then Chance Showers And Thunderstorms"
// is a day you want warned about, not a sunny one.
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

const TINT = {
  rain: "#8fb8e0", storm: "#b9a3e0", snow: "#e6f0f7", fog: "#b9c4c8",
  smoke: "#c8a67c", cloud: "#bcc6d0", sun: "#f0c04e", night: "#dbe3f2", wind: "#a9bdb6",
};

const LABEL = {
  rain: "Rain", storm: "Thunderstorms", snow: "Snow", fog: "Fog", smoke: "Smoke",
  cloud: "Cloudy", sun: "Clear", night: "Clear night", wind: "Windy",
};

// One cloud silhouette, shared. Three lobes over a flat base — the shape reads as
// a cloud at 20px, which a row of blobs does not.
const CLOUD = "M9.2 22.5h13.4a4.6 4.6 0 0 0 .5-9.16 6.3 6.3 0 0 0-11.77-2.2 4.9 4.9 0 0 0-2.13 11.36Z";

function Scene({ kind, uid }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (kind) {
    case "rain":
      return (<>
        <path className="wx-cloud" d={CLOUD} fill="currentColor" opacity=".9" />
        {[["wx-d1", 12], ["wx-d2", 16.5], ["wx-d3", 21]].map(([c, x]) => (
          <path key={c} className={c} d={`M${x} 24.5c0 0 1.5 1.9 1.5 2.9a1.5 1.5 0 0 1-3 0c0-1 1.5-2.9 1.5-2.9Z`} fill="currentColor" />
        ))}
      </>);
    case "storm":
      return (<>
        <path className="wx-cloud" d={CLOUD} fill="currentColor" opacity=".9" />
        <path className="wx-d1" d="M11.5 24.5c0 0 1.4 1.8 1.4 2.8a1.4 1.4 0 0 1-2.8 0c0-1 1.4-2.8 1.4-2.8Z" fill="currentColor" />
        <path className="wx-d3" d="M21.5 24.5c0 0 1.4 1.8 1.4 2.8a1.4 1.4 0 0 1-2.8 0c0-1 1.4-2.8 1.4-2.8Z" fill="currentColor" />
        <path className="wx-zap" d="M17.4 23.2 14 28.2h2.7l-1.1 3.6 4.1-5.4h-2.8Z" fill="currentColor" />
      </>);
    case "snow":
      return (<>
        <path className="wx-cloud" d={CLOUD} fill="currentColor" opacity=".9" />
        {[["wx-f1", 12], ["wx-f2", 16.5], ["wx-f3", 21]].map(([c, x]) => (
          <g key={c} className={c} {...stroke} strokeWidth="1.1" opacity=".95">
            <line x1={x} y1="25" x2={x} y2="29" />
            <line x1={x - 1.7} y1="26" x2={x + 1.7} y2="28" />
            <line x1={x - 1.7} y1="28" x2={x + 1.7} y2="26" />
          </g>
        ))}
      </>);
    case "fog":
    case "smoke":
      return (<g {...stroke} strokeWidth="2.6" opacity=".95">
        <line className="wx-l1" x1="6.5" y1="11" x2="25.5" y2="11" />
        <line className="wx-l2" x1="9" y1="17" x2="23" y2="17" />
        <line className="wx-l3" x1="7" y1="23" x2="24" y2="23" />
      </g>);
    case "cloud":
      return <path className="wx-cloud" d={CLOUD} fill="currentColor" opacity=".92" />;
    case "sun":
      return (<>
        <g className="wx-rays" {...stroke} strokeWidth="2">
          {[0, 45, 90, 135].map((a) => (
            <line key={a} x1="16" y1="2.5" x2="16" y2="6.5" transform={`rotate(${a} 16 16)`} />
          ))}
          {[180, 225, 270, 315].map((a) => (
            <line key={a} x1="16" y1="2.5" x2="16" y2="6.5" transform={`rotate(${a} 16 16)`} />
          ))}
        </g>
        <circle className="wx-disc" cx="16" cy="16" r="6.6" fill="currentColor" />
      </>);
    case "night":
      // A crescent cut from one disc by another — no background colour to match,
      // which is what the old div version got wrong. The mask id MUST be unique
      // per instance: SVG resolves url(#id) to the first match in the document,
      // so a shared id makes every moon on the page depend on one card staying
      // mounted, and turns the rest into solid squares the moment it doesn't.
      return (<>
        <defs>
          <mask id={uid}>
            <rect width="32" height="32" fill="#000" />
            <circle cx="17" cy="16" r="8.6" fill="#fff" />
            <circle cx="21.6" cy="12.4" r="7.6" fill="#000" />
          </mask>
        </defs>
        <rect width="32" height="32" fill="currentColor" mask={`url(#${uid})`} />
        <circle className="wx-t1" cx="7" cy="9" r="1.5" fill="currentColor" />
        <circle className="wx-t2" cx="9.5" cy="23" r="1.2" fill="currentColor" />
      </>);
    case "wind":
      return (<g {...stroke} strokeWidth="2.2">
        <path className="wx-g1" d="M5 11h11a3 3 0 1 0-3-3" />
        <path className="wx-g2" d="M4 17h16a3.2 3.2 0 1 1-3.2 3.2" />
        <path className="wx-g3" d="M6 23h8a2.6 2.6 0 1 0-2.6-2.6" />
      </g>);
    default:
      return null;
  }
}

// `always` is for slots guaranteed to HAVE a forecast — an hourly row, a 7-day
// strip. There an unrecognised phrase ("Areas Of Blowing Dust") should still draw
// something rather than leave a hole in the row. Deliberately not the default: on
// a card that hasn't fetched yet, absent is honest and a guessed cloud is not.
export default function WeatherFX({ sky, wind, isDay, size = "1rem", always = false }) {
  const uid = "wx" + useId().replace(/:/g, "");   // useId emits colons, invalid in a URL fragment
  const kind = skyKind(sky, wind, isDay) || (always && sky ? "cloud" : null);
  if (!kind) return null;
  return (
    <svg
      className="wx"
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      role="img"
      aria-label={sky || LABEL[kind]}
      style={{ fontSize: size, color: TINT[kind] || "currentColor" }}
    >
      <title>{sky || LABEL[kind]}</title>
      <Scene kind={kind} uid={uid} />
    </svg>
  );
}
