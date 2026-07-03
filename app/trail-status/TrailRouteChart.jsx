"use client";

import { useEffect, useRef, useState } from "react";
import { fetchElevationProfile } from "../lib/elevationClient";
import { SectionTitle } from "../components/StatusShell";
import { nearestPointOnPath, pointAtMile, bearingTo, compassLabel } from "../lib/trailStats";

const ACCENT = "#b3862d";
const NAV_COLOR = "#2c7a9e"; // distinct from ACCENT so "where you are" never looks like "where your mouse is"
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const ON_TRAIL_MI = 0.02; // ~100 ft
const LOOKAHEAD_MI = 0.1;

// Aspect-corrected lat/lng -> SVG-coordinate projector (a degree of longitude
// is shorter than a degree of latitude away from the equator) — built ONCE
// from the trail's own path bounds so the route line and a live position dot
// always agree, even though the live position usually falls outside those
// bounds while off-trail.
function makeProjector(path, W, H, pad) {
  const lats = path.map((p) => p[0]), lngs = path.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2, midLng = (minLng + maxLng) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const spanLat = Math.max(maxLat - minLat, 1e-5);
  const spanLng = Math.max((maxLng - minLng) * lngScale, 1e-5);
  const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
  return (lat, lng) => [W / 2 + (lng - midLng) * lngScale * scale, H / 2 - (lat - midLat) * scale];
}
// NOT the decorative bezier curve from the original prototype — a real
// projection of the trail's actual geometry.
function projectPath(path, W, H, pad) {
  const project = makeProjector(path, W, H, pad);
  return path.map(([lat, lng]) => project(lat, lng));
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

// err.code from the Geolocation API: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
const GEO_ERROR_MESSAGES = {
  1: "Location access was denied — allow it in your browser's site settings to use live navigation.",
  2: "Couldn't get your location — GPS may be unavailable here.",
  3: "Location request timed out — try again, especially if you're indoors or under heavy tree cover.",
};

export default function TrailRouteChart({ trailKey, path }) {
  const [profile, setProfile] = useState(undefined);
  const [scrubMi, setScrubMi] = useState(null);
  const [navPos, setNavPos] = useState(null); // { lat, lng, accuracy } while navigating
  const [navError, setNavError] = useState(null);
  const [navWatching, setNavWatching] = useState(false);
  const svgRef = useRef(null);
  const navWatchIdRef = useRef(null);

  useEffect(() => {
    let on = true;
    fetchElevationProfile(trailKey, path).then((p) => { if (on) setProfile(p); });
    return () => { on = false; };
  }, [trailKey, path]);

  function stopNav() {
    if (navWatchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
    }
    navWatchIdRef.current = null;
    setNavWatching(false);
    setNavPos(null);
  }
  function startNav() {
    setNavError(null);
    if (!navigator.geolocation) {
      setNavError("Geolocation isn't available in this browser.");
      return;
    }
    setNavWatching(true);
    navWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setNavPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => { setNavError(GEO_ERROR_MESSAGES[err.code] || "Couldn't get your location."); stopNav(); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }
  // Stop watching on unmount (e.g. navigating away from the page) — never
  // leave GPS polling running in the background.
  useEffect(() => () => { if (navWatchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(navWatchIdRef.current); }, []);

  if (profile === undefined) {
    return (
      <div style={{ background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 24, padding: 24, textAlign: "center", color: "#8a8471", fontSize: ".84rem", marginBottom: 22 }}>Loading route &amp; elevation…</div>
    );
  }
  const { points } = profile;
  if (!points.length || path.length < 2) return null; // Elevation API unavailable — omit rather than show a broken chart

  const routePts = projectPath(path, 400, 320, 30);
  const projectLive = makeProjector(path, 400, 320, 30);

  // Off-trail: distance + bearing back to the nearest point. On-trail:
  // progress + bearing toward a lookahead point (assumes forward = increasing
  // mile-mark along the stored path — a real v1 simplification, doesn't infer
  // which direction the hiker is actually walking).
  let nav = null;
  if (navPos) {
    const nearest = nearestPointOnPath(navPos.lat, navPos.lng, path);
    if (nearest) {
      const onTrail = nearest.distMi <= ON_TRAIL_MI;
      const target = onTrail ? pointAtMile(path, Math.min(nearest.mileMark + LOOKAHEAD_MI, points[points.length - 1].mi)) : nearest;
      const bearing = bearingTo(navPos.lat, navPos.lng, target.lat, target.lng);
      nav = { onTrail, distFt: Math.round(nearest.distMi * 5280), mileMark: nearest.mileMark, bearing, compass: compassLabel(bearing), accuracyFt: navPos.accuracy != null ? Math.round(navPos.accuracy * 3.28084) : null };
    }
  }
  const liveDot = navPos ? projectLive(navPos.lat, navPos.lng) : null;
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
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #efe8d8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: ".62rem", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#8a8471", marginBottom: 4 }}>Live navigation</div>
          {!navWatching && !navError && <div style={{ fontSize: ".8rem", color: "#6d7263" }}>Get a compass direction to stay on this trail while you hike.</div>}
          {navError && <div style={{ fontSize: ".8rem", color: "#a8473c" }}>{navError}</div>}
          {navWatching && nav && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "inline-block", transform: "rotate(" + nav.bearing + "deg)", fontSize: "1.4rem", lineHeight: 1, color: NAV_COLOR }}>↑</span>
              <div>
                <b style={{ fontSize: ".88rem", color: "#22261f", display: "block" }}>
                  {nav.onTrail ? "On trail — mi " + nav.mileMark.toFixed(1) + " of " + maxMi.toFixed(1) : nav.distFt + " ft off trail"}
                </b>
                <span style={{ fontSize: ".76rem", color: "#6d7263" }}>
                  {nav.onTrail ? "Keep going " + nav.compass : "Head " + nav.compass + " to rejoin the trail"}
                  {nav.accuracyFt != null && " · ~" + nav.accuracyFt + " ft accuracy"}
                </span>
              </div>
            </div>
          )}
          {navWatching && !nav && <div style={{ fontSize: ".8rem", color: "#6d7263" }}>Finding your location…</div>}
        </div>
        <button
          onClick={navWatching ? stopNav : startNav}
          style={{ border: "none", borderRadius: 999, padding: "9px 16px", fontSize: ".78rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flex: "none", background: navWatching ? "#22261f" : "linear-gradient(120deg,#e4be78,#c79a4b)", color: navWatching ? "#f3efe7" : "#15241c" }}
        >
          {navWatching ? "■ Stop navigation" : "▶ Start navigation"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <div style={{ padding: "20px 20px 12px", borderRight: "1px solid #efe8d8" }}>
          <SectionTitle>Route</SectionTitle>
          <svg viewBox="0 0 400 320" style={{ width: "100%", height: "auto", display: "block" }}>
            <path d={routeLine} fill="none" stroke="#e6dfd0" strokeWidth="7" strokeLinecap="round" />
            <path d={routeLine} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
            {routeDot && <circle cx={routeDot[0]} cy={routeDot[1]} r="6" fill={ACCENT} stroke="#fffdf8" strokeWidth="2.5" />}
            {liveDot && <circle cx={liveDot[0]} cy={liveDot[1]} r="7" fill={NAV_COLOR} stroke="#fffdf8" strokeWidth="2.5" />}
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
