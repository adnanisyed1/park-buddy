"use client";

// Forecast strip tile — design_handoff_forecast_strip_tiles (2026-07-19).
//
// The small companion to the 236x130 WeatherTile, DRAWN AT SIZE rather than
// scaled from it. That distinction is the whole point of the component: at 88x46
// a scaled 2px rain streak lands at 0.75px and a snowflake at 0.75-1.7px, so the
// motion — the only thing these tiles are for — disappears. I shipped a scaled
// version first and it looked exactly as bad as the arithmetic predicted.
//
// So at this size:
//   · rain strokes are a fixed 2.5px and never scale
//   · 4-5 particles, not 22; snowflakes 3.5-4.7px round
//   · the cloud keeps its silhouette but loses detail before it loses weight
//   · particles fall ~30px over 1.4s — a large share of a 46px tile, so it reads
//     as weather rather than flicker
//
// Two footprints, both re-drawn: 88x46 (hourly) and 78x42 (7-day). Only the
// counts drop between them; particle sizes and the 2.5px stroke are identical.
//
// The handoff states the markup is authoritative over its own README, so every
// number here is transcribed from the prototype.
import { useMemo } from "react";

export const FS_CONDITIONS = ["clear", "cloudy", "rain", "snow", "storm", "unknown"];

// Per-footprint geometry. Re-drawn, not derived — 78 is not 78/88 of 88.
const GEO = {
  88: {
    w: 88, h: 46, r: 12,
    sun:      { s: 20, top: 12, left: 34, float: 4 },
    sunSmall: { s: 14, top: 8,  right: 20, float: 5 },
    cloudy: { w: 46, h: 16, bottom: 8, drift: 6, bar: { w: 46, h: 12, r: 8 },  a: { s: 18, b: 5, l: 8 },  b: { s: 15, b: 6, l: 24 } },
    rain:   { w: 50, h: 16, top: 6,    drift: 7, bar: { w: 50, h: 13, r: 9 },  a: { s: 19, b: 5, l: 9 },  b: { s: 16, b: 6, l: 26 } },
    snow:   { w: 48, h: 15, top: 6,    drift: 8, bar: { w: 48, h: 12, r: 8 },  a: { s: 18, b: 5, l: 9 },  b: { s: 15, b: 6, l: 25 } },
    storm:  { w: 50, h: 16, top: 5,    drift: 6, bar: { w: 50, h: 13, r: 9 },  a: { s: 19, b: 5, l: 9 },  b: { s: 16, b: 6, l: 26 } },
    bolt: { top: 26, side: 5, tall: 11 },
    empty: { ring: 18, dash: 8 },
    n: { rain: 5, snow: 4, storm: 3 },
  },
  78: {
    w: 78, h: 42, r: 11,
    sun:      { s: 18, top: 11, left: 30, float: 4 },
    sunSmall: { s: 13, top: 7,  right: 18, float: 5 },
    cloudy: { w: 42, h: 15, bottom: 7, drift: 6, bar: { w: 42, h: 11, r: 8 },  a: { s: 16, b: 5, l: 7 },  b: { s: 13, b: 6, l: 22 } },
    rain:   { w: 44, h: 15, top: 5,    drift: 7, bar: { w: 44, h: 12, r: 8 },  a: { s: 17, b: 5, l: 8 },  b: { s: 14, b: 6, l: 24 } },
    snow:   { w: 42, h: 14, top: 5,    drift: 8, bar: { w: 42, h: 11, r: 8 },  a: { s: 16, b: 5, l: 8 },  b: { s: 13, b: 6, l: 23 } },
    storm:  { w: 44, h: 15, top: 4,    drift: 6, bar: { w: 44, h: 12, r: 8 },  a: { s: 17, b: 5, l: 8 },  b: { s: 14, b: 6, l: 24 } },
    bolt: { top: 23, side: 5, tall: 10 },
    empty: { ring: 16, dash: 7 },
    n: { rain: 4, snow: 3, storm: 3 },
  },
};

// Colours live in globals.css as --fs-* with a light-theme block, for the same
// reason the big tile needed one: a particle tuned for a dark card is invisible
// on parchment. The alphas are load-bearing — the handoff flags the storm flash
// explicitly as a translucent wash, and substituting a solid there is exactly
// how I flooded the big tile earlier.
const CLOUD_VAR = { cloudy: "--fs-cloud-fair", rain: "--fs-cloud-rain", snow: "--fs-cloud-snow", storm: "--fs-cloud-storm" };

// Seeded so a re-render doesn't reshuffle the rain. The prototype rolls these
// once on mount; in React, Math.random() in render re-rolls on every update.
function particles(kind, n, w, seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return Array.from({ length: n }, () => {
    const x = 12 + rnd() * (w - 24);
    const delay = rnd() * 1.6;
    if (kind === "snow") return { x, delay, size: 3.5 + rnd() * 1.2, dur: 2.8 + rnd() * 0.9 };
    return { x, delay, h: 9 + rnd() * 3, dur: (kind === "storm" ? 1.1 : 1.4) + rnd() * 0.4 };
  });
}

function Cloud({ g, kind }) {
  const c = `var(${CLOUD_VAR[kind]})`;
  const pos = g.top != null ? { top: g.top } : { bottom: g.bottom };
  return (
    <div style={{ position: "absolute", left: 0, right: 0, ...pos,
      animation: `fs-drift ${g.drift}s ease-in-out infinite alternate` }}>
      <div style={{ position: "relative", width: g.w, height: g.h, margin: "0 auto" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: g.bar.w, height: g.bar.h,
          borderRadius: g.bar.r, background: c }} />
        <div style={{ position: "absolute", bottom: g.a.b, left: g.a.l, width: g.a.s, height: g.a.s,
          borderRadius: "50%", background: c }} />
        <div style={{ position: "absolute", bottom: g.b.b, left: g.b.l, width: g.b.s, height: g.b.s,
          borderRadius: "50%", background: c }} />
      </div>
    </div>
  );
}

export default function ForecastTile({ condition = "unknown", size = 88, seed = "", label }) {
  const g = GEO[size] || GEO[88];
  const cond = FS_CONDITIONS.indexOf(condition) > -1 ? condition : "unknown";
  const n = g.n[cond] || 0;
  const drops = useMemo(
    () => (n ? particles(cond, n, g.w, seed + cond + size) : []),
    [cond, n, g.w, seed, size]
  );

  const shell = {
    position: "relative", width: g.w, height: g.h, borderRadius: g.r, overflow: "hidden", flex: "none",
    background: cond === "unknown" ? "var(--fs-shell-empty)" : "var(--fs-shell)",
    border: cond === "unknown" ? "1px dashed var(--fs-border-empty)" : "1px solid var(--fs-border)",
  };

  // A deliberately still tile. Nothing animates, and it does not resemble a sky —
  // a forecast we don't have must not look like a forecast we do.
  if (cond === "unknown") {
    return (
      <div className="fs-tile" style={shell} role="img" aria-label={label || "Forecast unavailable"} title={label || "Forecast unavailable"}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: g.empty.ring, height: g.empty.ring, borderRadius: "50%",
            border: "1.5px dashed var(--fs-empty-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: g.empty.dash, height: 2, borderRadius: 2, background: "var(--fs-empty-dash)" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fs-tile" style={shell} role="img" aria-label={label || cond} title={label || cond}>
      <div style={{ position: "absolute", inset: 0, background: `var(--fs-sky-${cond})` }} />

      {cond === "clear" && (
        <div style={{ position: "absolute", top: g.sun.top, left: g.sun.left, width: g.sun.s, height: g.sun.s,
          borderRadius: "50%", background: "var(--fs-sun)", boxShadow: "var(--fs-sun-glow)",
          animation: `fs-float ${g.sun.float}s ease-in-out infinite` }} />
      )}

      {cond === "cloudy" && (<>
        <div style={{ position: "absolute", top: g.sunSmall.top, right: g.sunSmall.right,
          width: g.sunSmall.s, height: g.sunSmall.s, borderRadius: "50%",
          background: "var(--fs-sun)", boxShadow: "var(--fs-sun-glow)",
          animation: `fs-float ${g.sunSmall.float}s ease-in-out infinite` }} />
        <Cloud g={g.cloudy} kind="cloudy" />
      </>)}

      {(cond === "rain" || cond === "snow" || cond === "storm") && <Cloud g={g[cond]} kind={cond} />}

      {(cond === "rain" || cond === "storm") && drops.map((p, i) => (
        <div key={i} style={{
          position: "absolute", top: 18, left: p.x, width: 2.5, height: p.h, borderRadius: 2,
          background: `linear-gradient(180deg, transparent, var(--fs-p-${cond}))`,
          animation: `fs-rain ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}

      {cond === "snow" && drops.map((p, i) => (
        <div key={i} style={{
          position: "absolute", top: 16, left: p.x, width: p.size, height: p.size, borderRadius: "50%",
          background: "var(--fs-p-snow)", opacity: .92,
          animation: `fs-snow ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}

      {cond === "storm" && (<>
        <div style={{ position: "absolute", inset: 0, background: "var(--fs-flash)",
          animation: "fs-flash 5s linear infinite", pointerEvents: "none" }} />
        <div style={{
          position: "absolute", left: "50%", top: g.bolt.top, transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: `${g.bolt.side}px solid transparent`,
          borderRight: `${g.bolt.side}px solid transparent`,
          borderTop: `${g.bolt.tall}px solid var(--fs-bolt)`,
          filter: "drop-shadow(0 0 5px var(--fs-bolt-glow))",
          animation: "fs-pulse 2.4s ease-in-out infinite",
        }} />
      </>)}
    </div>
  );
}
