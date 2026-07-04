"use client";

import { useEffect, useRef, useState } from "react";
import { fetchElevationProfile } from "../lib/elevationClient";
import { ensureMapsLoaded } from "../lib/googleMapsLoader";
import { SectionTitle } from "../components/StatusShell";
import { nearestPointOnPath, pointAtMile, bearingTo, compassLabel } from "../lib/trailStats";

const ACCENT = "#b3862d";
const NAV_COLOR = "#2c7a9e"; // distinct from ACCENT so "where you are" never looks like "where your mouse is"
const TRAIL_STYLE = { hiking: "#3f7a34", offroad: "#a15a2a", ski: "#2a6f9e" }; // same convention as app/explore/ExploreApp.jsx
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const ON_TRAIL_MI = 0.02; // ~100 ft
const LOOKAHEAD_MI = 0.1;
// Map and elevation chart are stacked full-width sections now (not squeezed
// into two half-width columns, which mismatched heights and wasted space) —
// both get the full card width and a genuinely bigger, clearer size.
const MAP_W = 800, MAP_H = 440;
const CHART_W = 800, CHART_H = 300;

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
  const project = (lat, lng) => [W / 2 + (lng - midLng) * lngScale * scale, H / 2 - (lat - midLat) * scale];
  project.milesPerPixel = 1 / (scale * 69); // 1° latitude ≈ 69 mi; scale is px per degree-lat
  return project;
}
// A round, human-friendly scale bar length (e.g. "0.5 mi") that fits within
// a target pixel width, for the SVG fallback's real distance reference.
function niceScaleBar(milesPerPixel, targetPx) {
  const targetMi = milesPerPixel * targetPx;
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  let mi = steps[0];
  for (const v of steps) { if (v <= targetMi) mi = v; else break; }
  return { mi, px: mi / milesPerPixel };
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

export default function TrailRouteChart({ trailKey, path, category }) {
  const [profile, setProfile] = useState(undefined);
  const [scrubMi, setScrubMi] = useState(null);
  const [navPos, setNavPos] = useState(null); // { lat, lng, accuracy } while navigating
  const [navError, setNavError] = useState(null);
  const [navWatching, setNavWatching] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(null); // null = loading, true = ready, false = failed/unavailable
  const [isOffline, setIsOffline] = useState(false); // corrected from navigator.onLine on mount (server has no navigator)
  const svgRef = useRef(null);
  const navWatchIdRef = useRef(null);
  const mapDivRef = useRef(null);
  const mapObjRef = useRef(null);
  const scrubMarkerRef = useRef(null);
  const liveMarkerRef = useRef(null);

  useEffect(() => {
    let on = true;
    fetchElevationProfile(trailKey, path).then((p) => { if (on) setProfile(p); });
    return () => { on = false; };
  }, [trailKey, path]);

  // Track connectivity so we can (a) skip a doomed Maps-tile fetch and go
  // straight to the offline-safe SVG line, and (b) tell the user plainly
  // what still works rather than leaving a half-broken map unexplained.
  // Live navigation itself needs none of this — GPS + the trail's own path
  // (already in this component's props) work with zero network.
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // A real map is far more useful than an abstract line — load it in parallel
  // with the elevation fetch. Falls back to the SVG route rendering below if
  // offline, the key is missing/blocked (mapsLoaded === false), or still
  // loading (mapsLoaded === null) — never a blank panel. Checks
  // navigator.onLine directly (not the isOffline state, which may not have
  // been corrected from its default yet on the very first render) so an
  // already-offline page load doesn't even attempt a doomed script fetch.
  useEffect(() => {
    let on = true;
    if (!navigator.onLine) { setMapsLoaded(false); return; }
    ensureMapsLoaded().then((ok) => { if (on) setMapsLoaded(ok); });
    return () => { on = false; };
  }, []);

  // Instantiate the real map once it's loaded and the div exists (only once —
  // guards against React StrictMode's double-invoke re-creating it).
  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || !Array.isArray(path) || path.length < 2 || mapObjRef.current) return;
    const g = window.google;
    const map = new g.maps.Map(mapDivRef.current, {
      mapTypeId: "hybrid", mapTypeControl: true, gestureHandling: "cooperative",
      streetViewControl: false, fullscreenControl: false, scaleControl: true,
    });
    mapObjRef.current = map;
    const trailColor = (category && TRAIL_STYLE[category]) || ACCENT;
    // Dashed trail-marker look (matches topo-map convention) — Maps draws
    // dashes via a repeated line symbol "icon" rather than a strokeDasharray.
    new g.maps.Polyline({
      path: path.map(([lat, lng]) => ({ lat, lng })),
      strokeOpacity: 0, map,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: trailColor, strokeWeight: 6, scale: 4 }, offset: "0", repeat: "16px" }],
    });
    const bounds = new g.maps.LatLngBounds();
    path.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds, 30);
  }, [mapsLoaded, path, category]);

  // Elevation-chart hover scrub -> a real marker on the map at that mile.
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    if (scrubMi == null) {
      if (scrubMarkerRef.current) scrubMarkerRef.current.setMap(null);
      return;
    }
    const pt = pointAtMile(path, scrubMi);
    if (!pt) return;
    if (!scrubMarkerRef.current) {
      scrubMarkerRef.current = new window.google.maps.Marker({
        position: pt, map, zIndex: 5,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: ACCENT, fillOpacity: 1, strokeColor: "#fffdf8", strokeWeight: 2 },
      });
    } else {
      scrubMarkerRef.current.setPosition(pt);
      scrubMarkerRef.current.setMap(map);
    }
  }, [scrubMi, path]);

  // Live navigation position -> a real marker, map gently pans to follow
  // (never forces zoom — respects whatever the user has set).
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    if (!navPos) {
      if (liveMarkerRef.current) liveMarkerRef.current.setMap(null);
      return;
    }
    const pos = { lat: navPos.lat, lng: navPos.lng };
    if (!liveMarkerRef.current) {
      liveMarkerRef.current = new window.google.maps.Marker({
        position: pos, map, zIndex: 10,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: NAV_COLOR, fillOpacity: 1, strokeColor: "#fffdf8", strokeWeight: 2.5 },
      });
    } else {
      liveMarkerRef.current.setPosition(pos);
      liveMarkerRef.current.setMap(map);
    }
    map.panTo(pos);
  }, [navPos]);

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

  const routePts = projectPath(path, MAP_W, MAP_H, 40);
  const projectLive = makeProjector(path, MAP_W, MAP_H, 40);
  const scaleBar = niceScaleBar(projectLive.milesPerPixel, 90);

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
  const W = CHART_W, H = CHART_H, L = 56, R = 16, T = 20, B = 32;
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
          {isOffline && (
            <div style={{ background: "#fdf3e4", border: "1px solid #eeddc0", color: "#8a6a2f", fontSize: ".76rem", fontWeight: 600, borderRadius: 10, padding: "7px 11px", marginBottom: 8, maxWidth: 340 }}>
              You&apos;re offline — trail imagery isn&apos;t available, but live navigation still works.
            </div>
          )}
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
      <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #efe8d8" }}>
        <SectionTitle>Trail map</SectionTitle>
        {mapsLoaded ? (
          <div style={{ position: "relative" }}>
            <div ref={mapDivRef} style={{ width: "100%", height: MAP_H, borderRadius: 12, overflow: "hidden" }} />
            {/* Compass rose — google.maps.Map has no heading/tilt set here, so it's always north-up and a static "N" is accurate. Top-right, clear of the map-type control at top-left. */}
            <div style={{ position: "absolute", top: 10, right: 10, width: 34, height: 46, background: "rgba(255,253,248,.85)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: ".68rem", fontWeight: 700, color: "#4c5443", pointerEvents: "none" }}>
              <span>N</span>
              <span style={{ fontSize: ".78rem", lineHeight: 1 }}>↑</span>
            </div>
          </div>
        ) : (
          <svg viewBox={"0 0 " + MAP_W + " " + MAP_H} style={{ width: "100%", height: "auto", display: "block" }}>
            <path d={routeLine} fill="none" stroke="#e6dfd0" strokeWidth="11" strokeLinecap="round" />
            <path d={routeLine} fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" strokeDasharray="10 9" />
            {routeDot && <circle cx={routeDot[0]} cy={routeDot[1]} r="7" fill={ACCENT} stroke="#fffdf8" strokeWidth="2.5" />}
            {liveDot && <circle cx={liveDot[0]} cy={liveDot[1]} r="8" fill={NAV_COLOR} stroke="#fffdf8" strokeWidth="2.5" />}
            {/* Compass rose — the map is always north-up (no rotation applied), so a static "N" is accurate. */}
            <g fontFamily={mono} fontSize="13" fill="#8a8471">
              <text x="30" y="40">N</text>
              <line x1="35" y1="47" x2="35" y2="78" stroke="#8a8471" strokeWidth="1.6" />
              <path d="M35 45 l-5 9 h10 Z" fill="#8a8471" />
            </g>
            {/* Real distance scale, computed from the same projection the route line uses. */}
            <g fontFamily={mono} fontSize="12" fill="#8a8471">
              <line x1={MAP_W - 24 - scaleBar.px} y1={MAP_H - 24} x2={MAP_W - 24} y2={MAP_H - 24} stroke="#8a8471" strokeWidth="1.6" />
              <text x={MAP_W - 24 - scaleBar.px} y={MAP_H - 32} textAnchor="start">0</text>
              <text x={MAP_W - 24} y={MAP_H - 32} textAnchor="end">{scaleBar.mi} mi</text>
            </g>
          </svg>
        )}
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
          <path d={line} fill="none" stroke={ACCENT} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          {scrubMi != null && (
            <>
              <line x1={X(scrubMi)} y1={T} x2={X(scrubMi)} y2={H - B} stroke="#22261f" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={X(scrubMi)} cy={Y(scrubFt)} r="6" fill={ACCENT} stroke="#fffdf8" strokeWidth="2" />
            </>
          )}
        </svg>
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
