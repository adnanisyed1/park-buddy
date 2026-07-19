"use client";

// A bench for the weather tiles — every state, both themes, next to the numbers
// from the handoff. Not linked from anywhere; it exists so the tiles can be
// judged by eye instead of by element count, which is how the last two attempts
// went wrong.
import { useRef, useState } from "react";
import WeatherTile, { WeatherChip, CONDITIONS } from "../components/WeatherTile";
import ForecastTile, { FS_CONDITIONS } from "../components/ForecastTile";
import { useThemedBody, setTheme, useTheme } from "../lib/theme";

const SAMPLES = [
  { condition: "clear",  place: "Zion",         temp: 72, label: "Clear sky" },
  { condition: "cloudy", place: "Bryce",        temp: 61, label: "Partly cloudy" },
  { condition: "rain",   place: "Capitol Reef", temp: 54, label: "Light rain" },
  { condition: "snow",   place: "Arches",       temp: 29, label: "Snow flurries" },
  { condition: "storm",  place: "Canyonlands",  temp: 66, label: "Thunderstorm" },
];

export default function WeatherTilesBench() {
  const ref = useRef(null);
  useThemedBody(ref);
  const theme = useTheme();

  return (
    <div ref={ref} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", padding: "48px 32px 80px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-gold)" }}>
          Park Buddy · component bench
        </div>
        <h1 style={{ fontFamily: "var(--pb-serif)", fontWeight: 300, fontSize: "2.6rem", margin: "10px 0 6px" }}>Live Weather Tiles</h1>
        <p style={{ color: "var(--pb-muted)", maxWidth: "60ch", margin: 0 }}>
          Five states from the design handoff. Colours come from the platform theme tokens
          rather than the handoff&rsquo;s fixed hex, so the tiles follow the toggle.
        </p>

        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{ cursor: "pointer", marginTop: 20, padding: "10px 18px", borderRadius: 999,
            background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)",
            color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".85rem" }}>
          Currently {theme} — switch to {theme === "dark" ? "light" : "dark"}
        </button>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 32 }}>
          {SAMPLES.map((s) => <WeatherTile key={s.condition} {...s} />)}
        </div>

        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-muted)", margin: "52px 0 16px" }}>
          Compact chips — itinerary rows
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SAMPLES.map((s) => <WeatherChip key={s.condition} condition={s.condition} temp={s.temp} />)}
        </div>

        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-muted)", margin: "52px 0 6px" }}>
          Forecast columns — the same scene, scaled
        </div>
        <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", marginBottom: 16, maxWidth: "56ch" }}>
          88&times;46 hourly and 78&times;42 for the 7-day, from the forecast-strip handoff.
          Drawn at size, not scaled: 2.5px strokes that never shrink, 3&ndash;5 large
          particles, and a still &ldquo;unknown&rdquo; state for when there is no forecast.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          {FS_CONDITIONS.map((c) => (
            <div key={c} style={{ textAlign: "center" }}>
              <ForecastTile condition={c} size={88} seed={c} />
              <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".54rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 6 }}>{c}</div>
            </div>
          ))}
          <div style={{ width: 20 }} />
          {FS_CONDITIONS.map((c) => (
            <div key={c + "s"} style={{ textAlign: "center" }}>
              <ForecastTile condition={c} size={78} seed={c + "s"} />
            </div>
          ))}
        </div>

        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-muted)", margin: "52px 0 16px" }}>
          Every condition, no place label
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {CONDITIONS.map((c) => <WeatherTile key={c} condition={c} temp={60} label={c} width={200} />)}
        </div>
      </div>
    </div>
  );
}
