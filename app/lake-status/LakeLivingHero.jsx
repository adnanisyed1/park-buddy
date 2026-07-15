"use client";

import { useEffect, useState } from "react";
import { fetchPointElevationFt } from "../lib/elevationClient";

// Living hero for /lake-status — the animated CSS/SVG water scene from the v2
// spec (ripples, sun glint, drifting mist, ridge), palette cool for alpine lakes
// / warm for big water. All the copy is driven by REAL data: title/kind, live
// NWS weather (air temp + wind — honestly labeled, since water temp isn't gauged
// at ~any lake), USGS NHD surface area, and client-fetched elevation.

const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const KEYFRAMES = `
@keyframes lk-pulse{0%{box-shadow:0 0 0 0 rgba(228,190,120,.5)}70%{box-shadow:0 0 0 9px rgba(228,190,120,0)}100%{box-shadow:0 0 0 0 rgba(228,190,120,0)}}
@keyframes lk-fadeup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes lk-drift{from{transform:translateX(0)}to{transform:translateX(-70px)}}
@keyframes lk-ripple{0%,100%{transform:translateX(0)}50%{transform:translateX(26px)}}
@keyframes lk-glint{0%,100%{opacity:.22}50%{opacity:.5}}
@media(prefers-reduced-motion:reduce){.lk-anim{animation:none!important}}
`;

function Chip({ k, v }) {
  if (v == null || v === "") return null;
  return (
    <span style={{ background: "rgba(10,26,18,.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(251,246,234,.18)", borderRadius: 14, padding: "9px 14px" }}>
      <span style={{ display: "block", fontFamily: mono, fontSize: ".54rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(243,237,224,.65)" }}>{k}</span>
      <span style={{ display: "block", fontFamily: serif, fontWeight: 700, fontSize: "1.1rem", color: "#f4f1ea", marginTop: 3, lineHeight: 1 }}>{v}</span>
    </span>
  );
}

function Scene({ palette }) {
  const alpine = palette === "alpine";
  const sky1 = alpine ? "#0d2b35" : "#173527", sky2 = alpine ? "#1a5148" : "#3f6a4a";
  const w1 = alpine ? "#10404a" : "#1d4f44", w2 = alpine ? "#0a2b33" : "#123430";
  const ridge = alpine ? "#081d1c" : "#0b2118";
  const ripples = [0, 1, 2, 3].map((i) => {
    const y = 18 + i * 20;
    return <path key={i} className="lk-anim" d={`M-40 ${y} Q 90 ${y - 4}, 220 ${y} T 480 ${y} T 740 ${y}`} fill="none" stroke="rgba(251,246,234,.16)" strokeWidth="1.4" style={{ animation: `lk-ripple ${7 + i * 2}s ease-in-out infinite` }} />;
  });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${sky1} 0%,${sky2} 58%)` }} />
      <div className="lk-anim" style={{ position: "absolute", top: "9%", right: "14%", width: 76, height: 76, borderRadius: "50%", background: "radial-gradient(circle,#e8cf9a 0%,rgba(242,221,166,.4) 45%,transparent 70%)", animation: "lk-glint 6s ease-in-out infinite" }} />
      <svg viewBox="0 0 700 120" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: "41%", width: "100%", height: "24%" }}>
        <path d="M0 120 L0 74 L90 34 L150 66 L230 18 L300 58 L370 30 L450 70 L520 40 L610 78 L700 48 L700 120 Z" fill={ridge} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "42%", background: `linear-gradient(180deg,${w1} 0%,${w2} 100%)` }}>
        <svg viewBox="0 0 700 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>{ripples}</svg>
        <div className="lk-anim" style={{ position: "absolute", top: 0, right: "17%", width: 44, height: "100%", background: "linear-gradient(180deg,rgba(242,221,166,.30),transparent 75%)", filter: "blur(6px)", animation: "lk-glint 5s ease-in-out infinite" }} />
      </div>
      <div className="lk-anim" style={{ position: "absolute", left: "-10%", right: "-10%", bottom: "38%", height: 34, background: "rgba(243,237,224,.08)", filter: "blur(14px)", animation: "lk-drift 26s linear infinite alternate" }} />
    </div>
  );
}

export default function LakeLivingHero({ name, typeLabel, palette, weather, areaAcres, kind, parkName, parkDist, lat, lng, photoUrl, photoBadge }) {
  const [elevFt, setElevFt] = useState(null);
  useEffect(() => {
    let on = true;
    fetchPointElevationFt(lat, lng).then((ft) => { if (on) setElevFt(ft); });
    return () => { on = false; };
  }, [lat, lng]);

  return (
    <section style={{ position: "relative", overflow: "hidden", minHeight: 520, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "clamp(118px,13vh,140px) clamp(16px,4vw,40px) 56px", background: "#11281d" }}>
      <style>{KEYFRAMES}</style>
      {/* Real photo of the lake front and center in the header; the animated
          water scene is only the no-photo fallback. */}
      {photoUrl ? (
        <img src={photoUrl} alt={name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Scene palette={palette} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.28) 0%,rgba(9,24,16,.08) 40%,rgba(9,24,16,.58) 88%,rgba(9,24,16,.78) 100%)" }} />
      {photoUrl && photoBadge && (
        <span style={{ position: "absolute", top: 14, left: 16, zIndex: 3, background: "rgba(12,26,18,.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.22)", color: "rgba(243,237,224,.9)", fontFamily: mono, fontSize: ".58rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", borderRadius: 999, padding: "5px 11px" }}>{photoBadge}</span>
      )}
      <div style={{ position: "absolute", top: 14, right: 16, zIndex: 3, display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#15241c", fontSize: ".58rem", fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", borderRadius: 999, padding: "5px 12px" }}>● Live weather</div>
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1180, margin: "0 auto", width: "100%" }}>
        <div className="lk-anim" style={{ fontFamily: mono, fontSize: ".66rem", fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase", color: "#e8cf9a", animation: "lk-fadeup .5s ease both" }}>{typeLabel}</div>
        <h1 className="lk-anim" style={{ fontFamily: serif, fontWeight: 800, color: "#f4f1ea", fontSize: "clamp(2.4rem,6.5vw,4.4rem)", lineHeight: ".96", letterSpacing: "-.02em", textShadow: "0 4px 30px rgba(0,0,0,.45)", marginTop: 10, animation: "lk-fadeup .55s .05s ease both" }}>{name}</h1>
        <div className="lk-anim" style={{ display: "flex", alignItems: "stretch", gap: 11, flexWrap: "wrap", marginTop: 18, animation: "lk-fadeup .6s .1s ease both" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 13, background: "rgba(10,26,18,.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(251,246,234,.18)", borderRadius: 18, padding: "13px 18px" }}>
            <span className="lk-anim" style={{ width: 12, height: 12, borderRadius: "50%", background: "#e8cf9a", boxShadow: "0 0 10px 1px rgba(228,190,120,.7)", animation: "lk-pulse 2s infinite", flex: "none" }} />
            {weather ? (
              <>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <b style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.05rem", color: "#f4f1ea" }}>Air {weather.tempF}°F</b>
                  <span style={{ color: "rgba(243,237,224,.75)", fontSize: ".7rem", fontWeight: 600 }}>{weather.short}{weather.wind ? " · wind " + weather.wind : ""}</span>
                </span>
              </>
            ) : (
              <span style={{ color: "rgba(243,237,224,.8)", fontSize: ".8rem", fontWeight: 600 }}>Live weather unavailable here</span>
            )}
          </div>
        </div>
        <div className="lk-anim" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, animation: "lk-fadeup .65s .16s ease both" }}>
          <Chip k="Elevation" v={elevFt != null ? elevFt.toLocaleString() + " ft" : null} />
          <Chip k="Surface area" v={areaAcres != null ? areaAcres.toLocaleString() + " ac" : null} />
          <Chip k="Type" v={kind} />
          {parkName && <Chip k={"From " + parkName} v={parkDist != null ? Math.round(parkDist) + " mi" : null} />}
        </div>
      </div>
    </section>
  );
}
