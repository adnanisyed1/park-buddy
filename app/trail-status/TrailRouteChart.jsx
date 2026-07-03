"use client";

import { useEffect, useRef, useState } from "react";
import { fetchElevationProfile } from "../lib/elevationClient";
import { SectionTitle } from "../components/StatusShell";

const ACCENT = "#b3862d";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Project the real lat/lng path into an SVG viewBox — aspect-corrected (a
// degree of longitude is shorter than a degree of latitude away from the
// equator), NOT the decorative bezier curve from the original prototype.
function projectPath(path, W, H, pad) {
  const lats = path.map((p) => p[0]), lngs = path.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2, midLng = (minLng + maxLng) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const spanLat = Math.max(maxLat - minLat, 1e-5);
  const spanLng = Math.max((maxLng - minLng) * lngScale, 1e-5);
  const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
  return path.map(([lat, lng]) => [
    W / 2 + (lng - midLng) * lngScale * scale,
    H / 2 - (lat - midLat) * scale,
  ]);
}

function elevAt(points, mi) {
  if (!points.length) return null;
  for (let i = 1; i < points.length; i++) {
    if (mi <= points[i].mi) {
      const span = points[i].mi - points[i - 1].mi || 1;
      const t = (mi - points[i - 1].mi) / span;
      return points[i - 1].ft + (points[i].ft - points[i - 1].ft) * t;
    }
  }
  return points[points.length - 1].ft;
}

// Generic real checkpoints (distance + elevation) — no landmark names, since
// NPS's dataset has none generically. One per mile for longer trails, three
// evenly-spaced points for short ones, capped so the list stays scannable.
function buildMileMarkers(points) {
  if (!points.length) return [];
  const maxMi = points[points.length - 1].mi;
  if (maxMi <= 0) return [{ mi: 0, ft: points[0].ft }];
  let marks;
  if (maxMi < 2) {
    marks = [0, maxMi / 2, maxMi].map((mi) => ({ mi, ft: elevAt(points, mi) }));
  } else {
    marks = [];
    for (let mi = 0; mi <= Math.floor(maxMi); mi++) marks.push({ mi, ft: elevAt(points, mi) });
    if (Math.floor(maxMi) < maxMi - 0.05) marks.push({ mi: maxMi, ft: elevAt(points, maxMi) });
  }
  if (marks.length > 7) {
    const step = Math.ceil(marks.length / 7);
    marks = marks.filter((_, i) => i % step === 0 || i === marks.length - 1);
  }
  return marks;
}

export default function TrailRouteChart({ trailKey, path }) {
  const [profile, setProfile] = useState(undefined);
  const [scrubMi, setScrubMi] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    let on = true;
    fetchElevationProfile(trailKey, path).then((p) => { if (on) setProfile(p); });
    return () => { on = false; };
  }, [trailKey, path]);

  if (profile === undefined) {
    return (
      <div style={{ background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 24, padding: 24, textAlign: "center", color: "#8a8471", fontSize: ".84rem", marginBottom: 22 }}>Loading route &amp; elevation…</div>
    );
  }
  const { points } = profile;
  if (!points.length || path.length < 2) return null; // Elevation API unavailable — omit rather than show a broken chart

  const routePts = projectPath(path, 400, 320, 30);
  const maxMi = points[points.length - 1].mi;
  const W = 560, H = 220, L = 46, R = 10, T = 14, B = 26;
  const fts = points.map((p) => p.ft);
  const ymin = Math.min(...fts) - 40, ymax = Math.max(...fts) + 40;
  const X = (mi) => L + (mi / (maxMi || 1)) * (W - L - R);
  const Y = (ft) => T + (1 - (ft - ymin) / (ymax - ymin)) * (H - T - B);

  const line = points.map((p, i) => (i ? "L" : "M") + X(p.mi).toFixed(1) + " " + Y(p.ft).toFixed(1)).join(" ");
  const area = line + " L " + X(maxMi).toFixed(1) + " " + (H - B) + " L " + X(0).toFixed(1) + " " + (H - B) + " Z";
  const routeLine = routePts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  function handleMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const mi = Math.max(0, Math.min(maxMi, ((x - L) / (W - L - R)) * maxMi));
    setScrubMi(mi);
  }

  const scrubFt = scrubMi != null ? elevAt(points, scrubMi) : null;
  // path[i] and points[i] correspond 1:1 (same source array), so interpolate
  // the route-map position at the same index/fraction as the elevation scrub.
  let routeDot = null;
  if (scrubMi != null) {
    let idx = 0;
    for (let i = 1; i < points.length; i++) { if (scrubMi >= points[i - 1].mi) idx = i - 1; }
    const p0 = points[idx], p1 = points[idx + 1] || p0;
    const span = p1.mi - p0.mi || 1;
    const t = Math.max(0, Math.min(1, (scrubMi - p0.mi) / span));
    const [x0, y0] = routePts[idx], [x1, y1] = routePts[idx + 1] || routePts[idx];
    routeDot = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  }

  const markers = buildMileMarkers(points);

  return (
    <div style={{ background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 24, overflow: "hidden", marginBottom: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <div style={{ padding: "20px 20px 12px", borderRight: "1px solid #efe8d8" }}>
          <SectionTitle>Route</SectionTitle>
          <svg viewBox="0 0 400 320" style={{ width: "100%", height: "auto", display: "block" }}>
            <path d={routeLine} fill="none" stroke="#e6dfd0" strokeWidth="7" strokeLinecap="round" />
            <path d={routeLine} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
            {routeDot && <circle cx={routeDot[0]} cy={routeDot[1]} r="6" fill={ACCENT} stroke="#fffdf8" strokeWidth="2.5" />}
          </svg>
        </div>
        <div style={{ padding: "20px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <SectionTitle>Elevation profile</SectionTitle>
            <span style={{ fontFamily: mono, fontSize: ".68rem", color: "#4c5443", fontWeight: 600, whiteSpace: "nowrap" }}>
              {scrubMi != null ? "MI " + scrubMi.toFixed(1) + " · " + Math.round(scrubFt).toLocaleString() + " FT" : "MI 0.0 – " + maxMi.toFixed(1)}
            </span>
          </div>
          <svg
            ref={svgRef} viewBox={"0 0 " + W + " " + H}
            style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", marginTop: 6 }}
            onMouseMove={handleMove} onMouseLeave={() => setScrubMi(null)}
          >
            <path d={area} fill={ACCENT} opacity=".12" />
            <path d={line} fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {scrubMi != null && (
              <>
                <line x1={X(scrubMi)} y1={T} x2={X(scrubMi)} y2={H - B} stroke="#22261f" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={X(scrubMi)} cy={Y(scrubFt)} r="5" fill={ACCENT} stroke="#fffdf8" strokeWidth="2" />
              </>
            )}
          </svg>
        </div>
      </div>
      {markers.length > 0 && (
        <div style={{ borderTop: "1px solid #efe8d8", padding: "16px 20px 20px" }}>
          <SectionTitle>Mile by mile</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {markers.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "10px 0", borderTop: i ? "1px solid #efe8d8" : "none" }}>
                <span style={{ fontFamily: mono, fontSize: ".72rem", fontWeight: 700, color: ACCENT, flex: "none", width: 60 }}>MI {m.mi.toFixed(1)}</span>
                <span style={{ flex: 1, fontSize: ".8rem", color: "#6d7263" }}>{i === 0 ? "Trailhead" : i === markers.length - 1 ? "End of trail" : "Along the trail"}</span>
                <span style={{ fontFamily: mono, fontSize: ".7rem", color: "#8a8471", flex: "none" }}>{Math.round(m.ft).toLocaleString()} FT</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
