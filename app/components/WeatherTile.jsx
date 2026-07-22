"use client";

// Live weather tile — built from design_handoff_weather_tiles (2026-07-19).
//
// A 236px card: a 130px animated sky scene with the place name over it, then a
// readout row of temperature, condition label, and a status chip with a pulsing
// dot. Five states: clear, cloudy, rain, snow, storm.
//
// Faithful to the handoff on geometry, timing and structure — sizes, offsets,
// particle counts and ranges, and the keyframes (copied verbatim into
// globals.css) are all as specified.
//
// ONE DELIBERATE DEPARTURE, and it's the reason to write it down: the handoff
// ships two fixed palettes, a dark set of hex and a light set. This app already
// has those as --pb-* tokens driven by the theme toggle. Hard-coding the hex
// would freeze the tile at today's two themes and make it the one component that
// ignores the switch. So surfaces, text and gold come from tokens; only the
// weather's own colours — rain blue, snow white, storm mauve, cloud greys — stay
// literal, because those describe the sky rather than the interface, and they
// read correctly on either ground.
//
// Particles are spawned per-instance with random x, delay, duration and (snow)
// size, exactly as the prototype does on mount. Generated once via useMemo: a
// re-render must not reshuffle the rain, or every state change makes the sky
// jump.
import { useMemo } from "react";

export const CONDITIONS = ["clear", "cloudy", "rain", "snow", "storm"];

// The handoff's status mapping. Passing `status` explicitly overrides it.
const STATUS = {
  clear:  { label: "GO",    tone: "go" },
  cloudy: { label: "MILD",  tone: "mild" },
  rain:   { label: "WET",   tone: "wet" },
  snow:   { label: "COLD",  tone: "cold" },
  storm:  { label: "WATCH", tone: "watch" },
};

// The sky reads from its own CSS variables (globals.css, "Weather-tile sky
// palette"), which are redefined for the light theme. The handoff ships a whole
// separate light palette because white flakes disappear on parchment and a glow
// tuned for a dark card floods a pale one — so this can't be one fixed set, and
// it can't be the UI tokens either.
const SKY = {
  rain:  { drop: "var(--wt-drop)", cloud: "var(--wt-cloud-rain)",  sky: "var(--wt-sky-rain)" },
  snow:  { flake: "var(--wt-flake)", cloud: "var(--wt-cloud-snow)", sky: "var(--wt-sky-snow)" },
  storm: { drop: "var(--wt-drop)", cloud: "var(--wt-cloud-storm)", sky: "var(--wt-sky-storm)" },
  cloudy:{ cloud: "var(--wt-cloud-fair)", sky: "var(--wt-sky-cloudy)" },
};

const CHIP_TONE = {
  go:    { fill: "var(--pb-grad-gold)", text: "var(--pb-bg)", dot: "var(--pb-bg)", border: "transparent" },
  mild:  { fill: "transparent", text: "var(--pb-gold)", dot: "var(--pb-gold)", border: "var(--pb-line-strong)" },
  wet:   { fill: "transparent", text: "var(--wt-wet)",   dot: "var(--wt-wet)",   border: "var(--wt-wet-line)" },
  cold:  { fill: "transparent", text: "var(--wt-cold)",  dot: "var(--wt-cold)",  border: "var(--wt-cold-line)" },
  watch: { fill: "transparent", text: "var(--wt-watch)", dot: "var(--wt-watch)", border: "var(--wt-watch-line)" },
};

// Deterministic per-instance randomness. Math.random() straight in render would
// re-roll on every parent update and make the rain twitch.
function makeParticles(kind, seedKey) {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  if (kind === "rain" || kind === "storm") {
    const n = kind === "rain" ? 22 : 16;                    // handoff counts
    return Array.from({ length: n }, () => ({
      // percent of stage width, not px: at width:"100%" the rain must fall
      // across the whole sky, not huddle in the handoff's 236px corner.
      left: (((12 + rnd() * (kind === "rain" ? 196 : 200)) / 236) * 100) + "%",
      delay: rnd() * (kind === "rain" ? 1.1 : 1.4),
      dur: kind === "rain" ? 0.8 + rnd() * 0.5 : 0.6 + rnd() * 0.4,
      top: kind === "rain" ? 56 : 58,
      h: kind === "rain" ? 12 : 14,
    }));
  }
  if (kind === "snow") {
    return Array.from({ length: 20 }, () => ({
      left: (((12 + rnd() * 198) / 236) * 100) + "%",
      delay: rnd() * 2,
      dur: 2 + rnd() * 1.6,
      size: 2 + rnd() * 2.5,
      top: 52,
    }));
  }
  return [];
}

// The cloud, with the prototype's real geometry — read out of the markup rather
// than guessed. Three things I had wrong: it's CENTRED in the scene (left:0;
// right:0 with the shape auto-margined), the bar is a vertical GRADIENT rather
// than a flat fill, and every condition has its own size and lobe offsets.
// Flat and left-pinned is what made mine read as a sticker.
const CLOUD_GEO = {
  cloudy: { top: 52, w: 96,  h: 34, barH: 22, drift: 6, l1: { s: 34, x: 16, b: 10 }, l2: { s: 30, x: 44, b: 12 } },
  rain:   { top: 30, w: 104, h: 34, barH: 24, drift: 7, l1: { s: 38, x: 18, b: 12 }, l2: { s: 32, x: 50, b: 14 } },
  snow:   { top: 30, w: 100, h: 32, barH: 22, drift: 8, l1: { s: 34, x: 18, b: 11 }, l2: { s: 30, x: 48, b: 13 } },
  storm:  { top: 26, w: 104, h: 34, barH: 24, drift: 6, l1: { s: 38, x: 18, b: 12 }, l2: { s: 32, x: 50, b: 14 } },
};

function Cloud({ kind }) {
  const g = CLOUD_GEO[kind];
  const top = `var(--wt-cloud-${kind === "cloudy" ? "fair" : kind})`;
  const bottom = `var(--wt-cloud-${kind === "cloudy" ? "fair" : kind}-2)`;
  return (
    <div style={{ position: "absolute", top: g.top, left: 0, right: 0,
      animation: `wt-drift ${g.drift}s ease-in-out infinite alternate` }}>
      <div style={{ position: "relative", width: g.w, height: g.h, margin: "0 auto" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: g.w, height: g.barH,
          borderRadius: 16, background: `linear-gradient(180deg, ${top}, ${bottom})` }} />
        <div style={{ position: "absolute", bottom: g.l1.b, left: g.l1.x, width: g.l1.s, height: g.l1.s,
          borderRadius: "50%", background: top }} />
        <div style={{ position: "absolute", bottom: g.l2.b, left: g.l2.x, width: g.l2.s, height: g.l2.s,
          borderRadius: "50%", background: top }} />
      </div>
    </div>
  );
}

function Scene({ condition, particles }) {
  const base = { position: "absolute", inset: 0, overflow: "hidden" };

  if (condition === "clear") {
    return (
      <div style={{ ...base, backgroundImage: "radial-gradient(90% 120% at 78% 24%, var(--wt-glow), transparent 60%), var(--wt-sky-clear)" }}>
        <div style={{ position: "absolute", top: 26, right: 34, width: 46, height: 46, animation: "wt-float 4s ease-in-out infinite" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--wt-sun)", boxShadow: "0 0 26px var(--wt-sun-glow)" }} />
          <div style={{
            position: "absolute", inset: -11, borderRadius: "50%", animation: "wt-spin 24s linear infinite",
            background: "conic-gradient(from 0deg, transparent 0 8%, var(--wt-ray) 8% 12%, transparent 12% 25%, var(--wt-ray) 25% 29%, transparent 29% 50%, var(--wt-ray) 50% 54%, transparent 54% 75%, var(--wt-ray) 75% 79%, transparent 79%)",
            WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)",
            mask: "radial-gradient(circle, transparent 62%, #000 63%)",
          }} />
        </div>
      </div>
    );
  }

  if (condition === "cloudy") {
    return (
      <div style={{ ...base, backgroundImage: "radial-gradient(90% 120% at 78% 24%, var(--wt-glow), transparent 62%), var(--wt-sky-cloudy)" }}>
        <div style={{ position: "absolute", top: 22, right: 44, width: 34, height: 34, borderRadius: "50%",
          background: "var(--wt-sun)", boxShadow: "0 0 20px var(--wt-sun-glow)", animation: "wt-float 5s ease-in-out infinite" }} />
        <Cloud kind="cloudy" />
      </div>
    );
  }

  if (condition === "rain" || condition === "storm") {
    const s = SKY[condition];
    return (
      <div style={{ ...base, backgroundImage: condition === "storm" ? "var(--wt-storm-wash), " + s.sky : s.sky }}>
        {condition === "storm" && (
          <div style={{ position: "absolute", inset: 0, background: "var(--wt-flash)", animation: "wt-flash 5s linear infinite", pointerEvents: "none" }} />
        )}
        <Cloud kind={condition} />
        {particles.map((p, i) => (
          <span key={i} className="wt-particle" style={{
            position: "absolute", top: p.top, left: p.left, width: 2, height: p.h, borderRadius: 2,
            background: `linear-gradient(180deg, rgba(${s.drop},0), rgba(${s.drop},.85))`,
            animation: `wt-rain ${p.dur}s linear ${p.delay}s infinite`,
          }} />
        ))}
        {condition === "storm" && (<>
          <div style={{
            position: "absolute", left: "50%", marginLeft: -9, top: 72, width: 0, height: 0,
            borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
            borderTop: "16px solid var(--wt-bolt)",
            filter: "drop-shadow(0 0 8px var(--wt-sun-glow))",
            animation: "wt-pulse 1.2s ease-in-out infinite",
          }} />
        </>)}
      </div>
    );
  }

  // snow
  return (
    <div style={{ ...base, backgroundImage: SKY.snow.sky }}>
      <Cloud kind="snow" />
      {particles.map((p, i) => (
        <span key={i} className="wt-particle" style={{
          position: "absolute", top: p.top, left: p.left, width: p.size, height: p.size, borderRadius: "50%",
          background: SKY.snow.flake, opacity: .9,
          animation: `wt-snow ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

export default function WeatherTile({ condition = "clear", temp, place, label, status, width = 236 }) {
  const cond = CONDITIONS.indexOf(condition) > -1 ? condition : "clear";
  const particles = useMemo(() => makeParticles(cond, (place || "") + cond), [cond, place]);
  const st = status || STATUS[cond].label;
  const tone = CHIP_TONE[(STATUS[cond] || {}).tone] || CHIP_TONE.mild;

  return (
    <div style={{
      width, borderRadius: 20, overflow: "hidden",
      background: "linear-gradient(160deg, var(--pb-surface-2), var(--pb-surface))",
      border: "1px solid var(--pb-line-strong)",
      boxShadow: "var(--pb-shadow)",
    }}>
      <div className="wt-scene" style={{ position: "relative", height: 130, overflow: "hidden" }}>
        <Scene condition={cond} particles={particles} />
        {place && (
          <span style={{
            position: "absolute", left: 16, top: 14, fontFamily: "var(--pb-mono)",
            fontSize: ".56rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-muted)",
          }}>{place}</span>
        )}
      </div>

      <div style={{ padding: "14px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--pb-serif)", fontSize: "1.9rem", fontWeight: 600, color: "var(--pb-ink)", lineHeight: 1 }}>
            {temp != null ? Math.round(temp) + "°" : "—"}
          </div>
          <div style={{ color: "var(--pb-ink-2)", fontSize: ".82rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label || ""}
          </div>
        </div>
        <span className="wt-chip" style={{
          display: "inline-flex", alignItems: "center", gap: 6, flex: "none",
          fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".12em", fontWeight: 700,
          padding: "5px 10px", borderRadius: 999,
          background: tone.fill, color: tone.text, border: "1px solid " + tone.border,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone.dot, animation: "wt-pulse 1.8s ease-in-out infinite" }} />
          {st}
        </span>
      </div>
    </div>
  );
}

// The dense variant from the handoff — one line for an itinerary row.
export function WeatherChip({ condition = "clear", temp, status }) {
  const cond = CONDITIONS.indexOf(condition) > -1 ? condition : "clear";
  const meta = STATUS[cond];
  const tone = CHIP_TONE[meta.tone];
  const particles = useMemo(() => makeParticles(cond, "chip" + cond), [cond]);

  return (
    <span className="wt-chip" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: 999,
      background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)",
    }}>
      <span style={{ position: "relative", width: 16, height: 16, flex: "none", overflow: "hidden" }}>
        {cond === "clear" || cond === "cloudy" ? (
          <span style={{ position: "absolute", inset: 4, borderRadius: "50%", background: tone.dot, animation: "wt-pulse 1.8s ease-in-out infinite" }} />
        ) : (<>
          <span style={{ position: "absolute", left: 1, top: 4, width: 14, height: 5, borderRadius: 999,
            background: (SKY[cond] && SKY[cond].cloud) || "var(--pb-muted)" }} />
          {particles.slice(0, 2).map((p, i) => cond === "snow" ? (
            <span key={i} style={{ position: "absolute", top: 9, left: 4 + i * 6, width: 3, height: 3, borderRadius: "50%",
              background: SKY.snow.flake, animation: `wt-snow ${1.8 + i * 0.5}s linear ${i * 0.5}s infinite` }} />
          ) : (
            <span key={i} style={{ position: "absolute", top: 9, left: 4 + i * 6, width: 1.5, height: 5, borderRadius: 2,
              background: tone.dot, animation: `wt-rain ${0.7 + i * 0.2}s linear ${i * 0.3}s infinite` }} />
          ))}
        </>)}
      </span>
      <span style={{ fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)" }}>
        {(status || meta.label)}{temp != null ? " · " + Math.round(temp) + "°F" : ""}
      </span>
    </span>
  );
}

// weather.gov shortForecast → the handoff's five conditions.
export function conditionFromSky(sky) {
  const s = String(sky || "");
  if (/thunder|t-?storm/i.test(s)) return "storm";
  if (/snow|flurr|sleet|wintry|blizzard|ice/i.test(s)) return "snow";
  if (/rain|shower|drizzle/i.test(s)) return "rain";
  if (/cloud|overcast|fog|haze|mist|smoke/i.test(s)) return "cloudy";
  if (/clear|sunny|fair/i.test(s)) return "clear";
  return null;
}
