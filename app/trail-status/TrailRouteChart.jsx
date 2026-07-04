"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchElevationProfile } from "../lib/elevationClient";
import { ensureMapsLoaded } from "../lib/googleMapsLoader";
import { SectionTitle } from "../components/StatusShell";
import { nearestPointOnPath, pointAtMile, bearingTo, compassLabel } from "../lib/trailStats";

const ACCENT = "#b3862d";
const NAV_COLOR = "#2c7a9e"; // distinct from ACCENT so "where you are" never looks like "where your mouse is"
const TRAIL_STYLE = { hiking: "#3f7a34", offroad: "#a15a2a", ski: "#2a6f9e" }; // same convention as app/explore/ExploreApp.jsx
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const serif = "var(--font-spectral), 'Spectral', Georgia, serif";
const ON_TRAIL_MI = 0.02; // ~100 ft
const LOOKAHEAD_MI = 0.1;
const MAP_W = 800, MAP_H = 440, MAP_MINH = 420;
const CHART_W = 1000, CHART_H = 300;
// A photo may only be added while standing at the exact waypoint. ~60 m is
// tight enough to mean "you're here" yet realistic for a phone GPS in the open.
const AT_WAYPOINT_MI = 60 / 1609.34;
const GPS_TOO_ROUGH_M = 80; // reject readings too imprecise to confirm the spot

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad, dLng = (bLng - aLng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Aspect-corrected lat/lng -> SVG-coordinate projector (used only by the offline
// SVG fallback; the live map is a real Google map). Built ONCE from the trail's
// own path bounds so the route line and a live dot always agree.
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
  project.milesPerPixel = 69 / scale;
  return project;
}
function niceScaleBar(milesPerPixel, targetPx) {
  const targetMi = milesPerPixel * targetPx;
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  let mi = steps[0];
  for (const v of steps) { if (v <= targetMi) mi = v; else break; }
  return { mi, px: mi / milesPerPixel };
}
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

// A note describing a real OSM feature type — honest context, no invention.
function featureNote(type) {
  return ({
    peak: "A named summit on the route.", saddle: "A saddle on the ridge.",
    pass: "A named pass along the way.", water: "A named lake beside the trail.",
    waterfall: "A waterfall near the trail.", glacier: "A glacier along the route.",
    spring: "A spring near the trail.", viewpoint: "A marked viewpoint.",
    ridge: "A named ridge on the route.", cliff: "A named cliff near the trail.",
    arch: "A natural arch nearby.",
  })[type] || "A named landmark on the route.";
}

// Build up to ~6 milestones from the trail's OWN data. Real named features
// (peaks, ridges, passes, lakes — OSM or USGS GNIS) that sit ON the route are
// projected onto the path and become milestones AT THEIR REAL MILE-MARK (the
// way "Tombstone Ridge · MI 0.7" works on a paper map) — not forced onto
// preset mile points. Trailhead and Trail's end anchor both ends; the high
// point and honest descriptive labels fill in only where no named feature
// exists. Nothing invented, nothing hardcoded per-trail.
function buildMilestones(points, path, features) {
  if (!points.length || !Array.isArray(path) || path.length < 2) return [];
  const maxMi = points[points.length - 1].mi;
  if (maxMi <= 0) return [];
  let hp = points[0];
  for (const p of points) if (p.ft > hp.ft) hp = p;
  const minGap = Math.max(0.2, maxMi * 0.1);

  // Named features within ~0.25 mi of the route, at their projected mile-mark.
  const onRoute = [];
  const seenName = new Set();
  for (const f of features || []) {
    if (!f.name || seenName.has(f.name.toLowerCase())) continue;
    const near = nearestPointOnPath(f.lat, f.lng, path);
    if (near && near.distMi <= 0.25) {
      seenName.add(f.name.toLowerCase());
      onRoute.push({ name: f.name, type: f.type, mi: near.mileMark, distMi: near.distMi });
    }
  }
  // Closest-to-the-trail wins a contested stretch: when a diffuse feature (a
  // ridge) and a precise one (the pass the trail actually crosses) project to
  // nearly the same mile, keep the one the trail truly touches.
  onRoute.sort((a, b) => a.distMi - b.distMi);

  // Up to 3 interior feature milestones, away from the endpoints, ≥0.15 mi apart.
  const interior = [];
  for (const f of onRoute) {
    if (f.mi < minGap || f.mi > maxMi - minGap) continue;
    if (interior.some((m) => Math.abs(m.mi - f.mi) < 0.15)) continue;
    interior.push({ mi: f.mi, name: f.name, note: featureNote(f.type) });
    if (interior.length >= 3) break;
  }
  interior.sort((a, b) => a.mi - b.mi);
  // No named features on this route → honest elevation-derived waypoints.
  if (!interior.length) {
    for (const mi of [maxMi * 0.3, hp.mi, maxMi * 0.7]) {
      if (mi < minGap || mi > maxMi - minGap) continue;
      if (interior.some((m) => Math.abs(m.mi - mi) < minGap)) continue;
      const ft = elevAt(points, mi), prevFt = elevAt(points, Math.max(0, mi - maxMi * 0.15));
      let name = "Along the trail", note = "A waypoint on the route.";
      if (ft != null && Math.round(ft) === Math.round(hp.ft)) { name = "High point"; note = "Highest point on the route."; }
      else if (ft != null && prevFt != null && ft < prevFt - 60) { name = "Descending"; note = "The trail drops from here."; }
      else if (ft != null && prevFt != null && ft > prevFt + 60) { name = "Climbing"; note = "A sustained climb ahead."; }
      interior.push({ mi, name, note });
    }
    interior.sort((a, b) => a.mi - b.mi);
  } else if (hp.mi > minGap && hp.mi < maxMi - minGap && !interior.some((m) => Math.abs(m.mi - hp.mi) < minGap)) {
    // Keep the high point alongside named features when it's distinct.
    interior.push({ mi: hp.mi, name: "High point", note: "Highest point on the route." });
    interior.sort((a, b) => a.mi - b.mi);
  }

  const ms = [{ mi: 0, name: "Trailhead", note: "Start of the trail." }]
    .concat(interior.slice(0, 4))
    .concat([{ mi: maxMi, name: "Trail's end", note: "End of the trail." }]);
  return ms.map((m) => {
    // Coordinates are the ON-PATH point at that mile (markers sit on the line;
    // the GPS photo gate expects the hiker standing on the trail).
    const ll = pointAtMile(path, m.mi) || { lat: path[0][0], lng: path[0][1] };
    return { mi: m.mi, ft: elevAt(points, m.mi), name: m.name, note: m.note, lat: ll.lat, lng: ll.lng };
  });
}

// err.code from the Geolocation API: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
const GEO_ERROR_MESSAGES = {
  1: "Location access was denied — allow it in your browser's site settings.",
  2: "Couldn't get your location — GPS may be unavailable here.",
  3: "Location request timed out — try again in the open, away from heavy tree cover.",
};

export default function TrailRouteChart({ trailKey, path, category }) {
  const [profile, setProfile] = useState(undefined);
  const [scrubMi, setScrubMi] = useState(null);
  const [navPos, setNavPos] = useState(null);
  const [navError, setNavError] = useState(null);
  const [navWatching, setNavWatching] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [features, setFeatures] = useState([]);
  const [selected, setSelected] = useState(0);
  // Flat list of stamped photo records {url,lat,lng,accuracyFt,ts}. Photos are
  // bound to WHERE THEY WERE TAKEN (their stamped coordinates), and matched to
  // milestones by proximity at render time — never by array index, since
  // milestone positions/count re-derive when the named-features fetch lands
  // and an index-keyed photo would silently reattach to the wrong waypoint.
  const [photoRecs, setPhotoRecs] = useState([]);
  const [toast, setToast] = useState(null);

  const svgRef = useRef(null);
  const navWatchIdRef = useRef(null);
  const mapDivRef = useRef(null);
  const mapObjRef = useRef(null);
  const scrubMarkerRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const msMarkersRef = useRef([]);
  const fileRef = useRef(null);
  const pendingRef = useRef(null); // stamped GPS coords for a photo being added
  const panelRef = useRef(null);
  const toastTimer = useRef(null);

  const milestones = useMemo(() => buildMilestones(profile?.points || [], path, features), [profile, path, features]);

  useEffect(() => {
    let on = true;
    fetchElevationProfile(trailKey, path).then((p) => { if (on) setProfile(p); });
    return () => { on = false; };
  }, [trailKey, path]);

  useEffect(() => {
    try {
      const flat = JSON.parse(localStorage.getItem("pb_photos2_" + trailKey) || "null");
      if (Array.isArray(flat)) { setPhotoRecs(flat); return; }
      // Migrate the legacy index-keyed store — records already carry their
      // stamped capture coordinates, so flattening loses nothing.
      const legacy = JSON.parse(localStorage.getItem("pb_photos_" + trailKey) || "null");
      if (legacy && typeof legacy === "object") {
        const migrated = Object.values(legacy).flat().filter((r) => r && r.url);
        setPhotoRecs(migrated);
        localStorage.setItem("pb_photos2_" + trailKey, JSON.stringify(migrated));
      } else {
        setPhotoRecs([]);
      }
    } catch { setPhotoRecs([]); }
  }, [trailKey]);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  useEffect(() => {
    let on = true;
    if (!navigator.onLine) { setMapsLoaded(false); return; }
    ensureMapsLoaded().then((ok) => { if (on) setMapsLoaded(ok); });
    return () => { on = false; };
  }, []);

  // Real named features near the trail (for milestone names). Best-effort — if
  // Overpass is slow/down, milestones fall back to descriptive labels.
  useEffect(() => {
    if (!Array.isArray(path) || path.length < 2 || !navigator.onLine) return;
    const lats = path.map((p) => p[0]), lngs = path.map((p) => p[1]);
    const pad = 0.005;
    const bbox = [Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad].map((v) => v.toFixed(5)).join(",");
    let on = true;
    fetch("/api/waypoints?bbox=" + bbox).then((r) => (r.ok ? r.json() : null)).then((d) => { if (on && d && d.features) setFeatures(d.features); }).catch(() => {});
    return () => { on = false; };
  }, [path]);

  // Instantiate the real map once (guards StrictMode double-invoke).
  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || !Array.isArray(path) || path.length < 2 || mapObjRef.current) return;
    const g = window.google;
    const map = new g.maps.Map(mapDivRef.current, {
      mapTypeId: "hybrid", mapTypeControl: true, gestureHandling: "cooperative",
      streetViewControl: false, fullscreenControl: false, scaleControl: true,
    });
    mapObjRef.current = map;
    const trailColor = (category && TRAIL_STYLE[category]) || ACCENT;
    new g.maps.Polyline({
      path: path.map(([lat, lng]) => ({ lat, lng })),
      strokeOpacity: 0, map,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: trailColor, strokeWeight: 6, scale: 4 }, offset: "0", repeat: "16px" }],
    });
    const bounds = new g.maps.LatLngBounds();
    path.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds, 30);
  }, [mapsLoaded, path, category]);

  // Numbered milestone markers on the map; clicking one selects it in the panel.
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    msMarkersRef.current.forEach((m) => m.setMap(null));
    msMarkersRef.current = [];
    milestones.forEach((ms, i) => {
      const sel = i === selected;
      const mk = new window.google.maps.Marker({
        position: { lat: ms.lat, lng: ms.lng }, map, zIndex: sel ? 9 : 6,
        label: { text: String(i + 1), color: "#15241c", fontSize: "11px", fontWeight: "800" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: sel ? 12 : 10, fillColor: sel ? "#e4be78" : "#fbf6ea", fillOpacity: 1, strokeColor: "#15241c", strokeWeight: 2 },
      });
      mk.addListener("click", () => setSelected(i));
      msMarkersRef.current.push(mk);
    });
    return () => { msMarkersRef.current.forEach((m) => m.setMap(null)); msMarkersRef.current = []; };
  }, [milestones, selected, mapsLoaded]);

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    if (scrubMi == null) { if (scrubMarkerRef.current) scrubMarkerRef.current.setMap(null); return; }
    const pt = pointAtMile(path, scrubMi);
    if (!pt) return;
    if (!scrubMarkerRef.current) {
      scrubMarkerRef.current = new window.google.maps.Marker({
        position: pt, map, zIndex: 12,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: ACCENT, fillOpacity: 1, strokeColor: "#fffdf8", strokeWeight: 2 },
      });
    } else { scrubMarkerRef.current.setPosition(pt); scrubMarkerRef.current.setMap(map); }
  }, [scrubMi, path]);

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    if (!navPos) { if (liveMarkerRef.current) liveMarkerRef.current.setMap(null); return; }
    const pos = { lat: navPos.lat, lng: navPos.lng };
    if (!liveMarkerRef.current) {
      liveMarkerRef.current = new window.google.maps.Marker({
        position: pos, map, zIndex: 15,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: NAV_COLOR, fillOpacity: 1, strokeColor: "#fffdf8", strokeWeight: 2.5 },
      });
    } else { liveMarkerRef.current.setPosition(pos); liveMarkerRef.current.setMap(map); }
    map.panTo(pos);
  }, [navPos]);

  useEffect(() => () => { if (navWatchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(navWatchIdRef.current); }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }
  function stopNav() {
    if (navWatchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(navWatchIdRef.current);
    navWatchIdRef.current = null;
    setNavWatching(false);
    setNavPos(null);
  }
  function startNav() {
    setNavError(null);
    if (!navigator.geolocation) { setNavError("Geolocation isn't available in this browser."); return; }
    setNavWatching(true);
    navWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setNavPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => { setNavError(GEO_ERROR_MESSAGES[err.code] || "Couldn't get your location."); stopNav(); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  function selectMilestone(i) {
    setSelected(i);
    if (panelRef.current) panelRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // "Add yours" — a photo is only accepted while the hiker is physically AT this
  // milestone. We check the device's precise location against THIS waypoint's
  // coordinates; if they're actually at a different milestone we say which; on
  // acceptance the capture coordinates are stamped onto the photo record.
  // Production: this same check re-runs server-side on upload before moderation.
  function addPhoto() {
    const ms = milestones[selected];
    if (!ms) return;
    if (!navigator.geolocation) { showToast("Geolocation isn't available — can't verify you're at this spot."); return; }
    showToast("Checking you're at " + ms.name + "…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        if (accuracy != null && accuracy > GPS_TOO_ROUGH_M) {
          showToast("Your GPS is too rough (~" + Math.round(accuracy) + " m) to confirm you're here — try again in the open.");
          return;
        }
        const d = milesBetween(lat, lng, ms.lat, ms.lng);
        if (d > AT_WAYPOINT_MI) {
          let nearestIdx = -1, nearestD = AT_WAYPOINT_MI;
          milestones.forEach((m, i) => { const dd = milesBetween(lat, lng, m.lat, m.lng); if (dd < nearestD) { nearestD = dd; nearestIdx = i; } });
          if (nearestIdx >= 0 && nearestIdx !== selected) showToast("You're at milestone " + (nearestIdx + 1) + " (" + milestones[nearestIdx].name + "), not this one. Select it to add a photo there.");
          else showToast("You need to be at " + ms.name + " to add a photo here — you're about " + Math.round(d * 5280) + " ft away.");
          return;
        }
        pendingRef.current = { lat, lng, accuracyFt: accuracy != null ? Math.round(accuracy * 3.28084) : null };
        if (fileRef.current) fileRef.current.click();
      },
      (err) => showToast(GEO_ERROR_MESSAGES[err.code] || "Couldn't get your location."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }
  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    const coords = pendingRef.current;
    pendingRef.current = null;
    if (!file || !coords) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const w = Math.min(640, img.width);
        c.width = w; c.height = Math.round((img.height * w) / img.width);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.8);
        const rec = { url, lat: coords.lat, lng: coords.lng, accuracyFt: coords.accuracyFt, ts: Date.now() };
        setPhotoRecs((prev) => {
          const next = [...prev, rec];
          try { localStorage.setItem("pb_photos2_" + trailKey, JSON.stringify(next)); } catch {}
          return next;
        });
        showToast("Photo added at " + (milestones[selected]?.name || "this spot") + " ✓");
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  if (profile === undefined) {
    return <div style={{ background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 24, padding: 24, textAlign: "center", color: "#8a8471", fontSize: ".84rem", marginBottom: 22 }}>Loading route &amp; elevation…</div>;
  }
  const { points } = profile;
  if (!points.length || path.length < 2) return null;

  const routePts = projectPath(path, MAP_W, MAP_H, 40);
  const projectLive = makeProjector(path, MAP_W, MAP_H, 40);
  const scaleBar = niceScaleBar(projectLive.milesPerPixel, 90);

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
  const netFt = Math.round(points[points.length - 1].ft - points[0].ft);
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

  // Milestone numbered dots for the SVG fallback.
  const msDots = milestones.map((ms) => ({ pt: projectLive(ms.lat, ms.lng) }));
  const sel = milestones[selected];
  // Match photos to a milestone by their STAMPED capture coordinates (small
  // slop over the gate radius for GPS jitter) — index-independent, so photos
  // stay at the spot they were taken even if milestones re-derive.
  const photosFor = (ms) => (ms ? photoRecs.filter((r) => r.lat != null && milesBetween(r.lat, r.lng, ms.lat, ms.lng) <= AT_WAYPOINT_MI * 1.5) : []);
  const selPhotos = photosFor(sel);

  return (
    <div style={{ background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 24, overflow: "hidden", marginBottom: 22 }}>
      {/* Live navigation bar */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #efe8d8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          {isOffline && (
            <div style={{ background: "#fdf3e4", border: "1px solid #eeddc0", color: "#8a6a2f", fontSize: ".76rem", fontWeight: 600, borderRadius: 10, padding: "7px 11px", marginBottom: 8, maxWidth: 360 }}>
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
                <b style={{ fontSize: ".88rem", color: "#22261f", display: "block" }}>{nav.onTrail ? "On trail — mi " + nav.mileMark.toFixed(1) + " of " + maxMi.toFixed(1) : nav.distFt + " ft off trail"}</b>
                <span style={{ fontSize: ".76rem", color: "#6d7263" }}>{nav.onTrail ? "Keep going " + nav.compass : "Head " + nav.compass + " to rejoin the trail"}{nav.accuracyFt != null && " · ~" + nav.accuracyFt + " ft accuracy"}</span>
              </div>
            </div>
          )}
          {navWatching && !nav && <div style={{ fontSize: ".8rem", color: "#6d7263" }}>Finding your location…</div>}
        </div>
        <button onClick={navWatching ? stopNav : startNav} style={{ border: "none", borderRadius: 999, padding: "9px 16px", fontSize: ".78rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flex: "none", background: navWatching ? "#22261f" : "linear-gradient(120deg,#e4be78,#c79a4b)", color: navWatching ? "#f3efe7" : "#15241c" }}>{navWatching ? "■ Stop navigation" : "▶ Start navigation"}</button>
      </div>

      {/* Map + Milestone photos side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        <div style={{ position: "relative", minHeight: MAP_MINH, borderRight: "1px solid #efe8d8" }}>
          {mapsLoaded ? (
            <>
              <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
              <span style={{ position: "absolute", left: 12, top: 12, zIndex: 2, background: "rgba(21,36,28,.85)", color: "#f3ede0", fontFamily: mono, fontSize: ".58rem", letterSpacing: ".14em", textTransform: "uppercase", borderRadius: 999, padding: "5px 11px" }}>Satellite · tap a number</span>
              <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 34, height: 46, background: "rgba(255,253,248,.85)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: ".68rem", fontWeight: 700, color: "#4c5443", pointerEvents: "none" }}>
                <span>N</span><span style={{ fontSize: ".78rem", lineHeight: 1 }}>↑</span>
              </div>
            </>
          ) : (
            <svg viewBox={"0 0 " + MAP_W + " " + MAP_H} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", background: "#f0ead9" }}>
              <path d={routeLine} fill="none" stroke="#e6dfd0" strokeWidth="11" strokeLinecap="round" />
              <path d={routeLine} fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" strokeDasharray="10 9" />
              {msDots.map((d, i) => (
                <g key={i} onClick={() => setSelected(i)} style={{ cursor: "pointer" }}>
                  <circle cx={d.pt[0]} cy={d.pt[1]} r={i === selected ? 13 : 11} fill={i === selected ? "#e4be78" : "#fbf6ea"} stroke="#15241c" strokeWidth="2" />
                  <text x={d.pt[0]} y={d.pt[1] + 4} textAnchor="middle" fontFamily={mono} fontSize="12" fontWeight="800" fill="#15241c">{i + 1}</text>
                </g>
              ))}
              {routeDot && <circle cx={routeDot[0]} cy={routeDot[1]} r="7" fill={ACCENT} stroke="#fffdf8" strokeWidth="2.5" />}
              {liveDot && <circle cx={liveDot[0]} cy={liveDot[1]} r="8" fill={NAV_COLOR} stroke="#fffdf8" strokeWidth="2.5" />}
              <g fontFamily={mono} fontSize="13" fill="#8a8471">
                <text x="30" y="40">N</text>
                <line x1="35" y1="47" x2="35" y2="78" stroke="#8a8471" strokeWidth="1.6" />
                <path d="M35 45 l-5 9 h10 Z" fill="#8a8471" />
              </g>
              <g fontFamily={mono} fontSize="12" fill="#8a8471">
                <line x1={MAP_W - 24 - scaleBar.px} y1={MAP_H - 24} x2={MAP_W - 24} y2={MAP_H - 24} stroke="#8a8471" strokeWidth="1.6" />
                <text x={MAP_W - 24 - scaleBar.px} y={MAP_H - 32} textAnchor="start">0</text>
                <text x={MAP_W - 24} y={MAP_H - 32} textAnchor="end">{scaleBar.mi} mi</text>
              </g>
            </svg>
          )}
        </div>

        {/* Milestone photos panel */}
        <div ref={panelRef} style={{ position: "relative", minHeight: MAP_MINH, display: "flex", flexDirection: "column", padding: "18px 18px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.1rem", margin: 0, color: "#163a2b" }}>Milestone photos</h2>
            <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#8a8471" }}>Tap a numbered marker</span>
          </div>
          {sel && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: 10 }}>
              <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".16em", textTransform: "uppercase", color: ACCENT }}>Milestone {selected + 1} · MI {sel.mi.toFixed(1)}{sel.ft != null ? " · " + Math.round(sel.ft).toLocaleString() + " FT" : ""}</div>
              <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.15rem", marginTop: 4, color: "#22261f" }}>{sel.name}</div>
              <div style={{ fontSize: ".8rem", color: "#6d7263", marginTop: 3, lineHeight: 1.5 }}>{sel.note}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
                {selPhotos.slice().reverse().map((p, i) => (
                  <figure key={i} style={{ position: "relative", aspectRatio: "1/1", margin: 0, overflow: "hidden", borderRadius: 12, background: "#ece5d4" }}>
                    <img src={p.url} alt="Your photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    <span style={{ position: "absolute", left: 7, top: 7, background: "linear-gradient(120deg,#e4be78,#c79a4b)", color: "#15241c", fontFamily: mono, fontSize: ".54rem", fontWeight: 700, letterSpacing: ".08em", borderRadius: 999, padding: "2px 7px" }}>YOU</span>
                  </figure>
                ))}
                <button onClick={addPhoto} style={{ aspectRatio: "1/1", border: "1.5px dashed #c79a4b", borderRadius: 12, background: "#fdf8ec", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", padding: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b3862d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <span style={{ fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".1em", color: "#8a6a2f" }}>ADD YOURS</span>
                </button>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 12, fontSize: ".72rem", color: "#8a8471", lineHeight: 1.5 }}>
                {selPhotos.length > 0 ? selPhotos.length + " photo" + (selPhotos.length === 1 ? "" : "s") + " here · " : "No photos here yet · "}
                photos are accepted only when you&apos;re standing at this waypoint (GPS-verified).
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </div>
      </div>

      {/* Elevation profile — full width */}
      <div style={{ padding: "20px 22px 18px", borderTop: "1px solid #efe8d8" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <SectionTitle>Elevation profile</SectionTitle>
          <span style={{ fontFamily: mono, fontSize: ".68rem", color: "#4c5443", fontWeight: 600, whiteSpace: "nowrap" }}>
            {scrubMi != null ? "MI " + scrubMi.toFixed(1) + " · " + Math.round(scrubFt).toLocaleString() + " FT" : "MI 0.0 – " + maxMi.toFixed(1) + " · " + (netFt >= 0 ? "+" : "−") + Math.abs(netFt).toLocaleString() + " FT NET"}
          </span>
        </div>
        <svg ref={svgRef} viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", marginTop: 6 }} onMouseMove={handleMove} onMouseLeave={() => setScrubMi(null)}>
          <path d={area} fill={ACCENT} opacity=".12" />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {scrubMi != null && (
            <>
              <line x1={X(scrubMi)} y1={T} x2={X(scrubMi)} y2={H - B} stroke="#22261f" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={X(scrubMi)} cy={Y(scrubFt)} r="6" fill={ACCENT} stroke="#fffdf8" strokeWidth="2" />
            </>
          )}
        </svg>
        <div style={{ fontSize: ".74rem", color: "#6d7263", marginTop: 8 }}>Hover the profile — the dot traces your position on the map.</div>
      </div>

      {/* Mile by mile — real milestone names + photo chips */}
      {milestones.length > 0 && (
        <div style={{ borderTop: "1px solid #efe8d8", padding: "16px 22px 22px" }}>
          <SectionTitle>Mile by mile</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {milestones.map((m, i) => {
              const n = photosFor(m).length;
              return (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "12px 0", borderTop: i ? "1px solid #efe8d8" : "none" }}>
                  <span style={{ fontFamily: mono, fontSize: ".72rem", fontWeight: 700, color: ACCENT, flex: "none", width: 52 }}>MI {m.mi.toFixed(1)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: ".95rem", color: "#22261f" }}>{m.name}</b>
                    <button onClick={() => selectMilestone(i)} style={{ marginLeft: 8, cursor: "pointer", fontFamily: mono, fontSize: ".6rem", fontWeight: 700, color: ACCENT, background: "#fdf3e4", border: "1px solid #eeddc0", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{n > 0 ? n + " PHOTO" + (n === 1 ? "" : "S") + " →" : "ADD PHOTO →"}</button>
                    {m.note && <div style={{ fontSize: ".8rem", color: "#6d7263", marginTop: 2 }}>{m.note}</div>}
                  </div>
                  {m.ft != null && <span style={{ fontFamily: mono, fontSize: ".7rem", color: "#8a8471", flex: "none" }}>{Math.round(m.ft).toLocaleString()} FT</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 120, background: "#15241c", color: "#f3efe7", fontSize: ".84rem", fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 16px 40px -16px rgba(0,0,0,.5)", maxWidth: "90vw", textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
