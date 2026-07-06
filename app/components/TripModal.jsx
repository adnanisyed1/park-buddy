"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getStops, getMeta, setMeta, removeStop, setNights, moveStop, subscribeTrip } from "../lib/trip";
import loadScript from "./load-script";
import { ensureMapsLoaded } from "../lib/googleMapsLoader";

// Cache the driving route geometry per trip signature so re-opening the modal
// doesn't re-hit Directions. Plain {lat,lng} arrays → reusable across map instances.
const modalRouteCache = {};

// The platform-wide trip planner, in a dialog. It opens automatically whenever
// anything is added to the trip (the `pb:trip` event with detail.added), and on
// demand when the header's "My Trip" pill dispatches `pb:trip-open`. Inline it
// carries the real planner essentials — reorder stops, set nights, name the trip,
// pick a start date + travellers — and links out to /build-trip for the full
// map + budget + share view. One store (app/lib/trip.js) backs both.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

function nightsLabel(n) { return n === 1 ? "1 night" : n + " nights"; }

// Fit a set of {lat,lng} points into a W×H box (aspect-preserving, mid-latitude
// longitude correction) for the mini route map. Returns each point with x,y added.
function fitProject(pts, W, H, pad) {
  if (!pts.length) return [];
  if (pts.length === 1) return [{ ...pts[0], x: W / 2, y: H / 2 }];
  const lats = pts.map((p) => p.lat);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180) || 1; // squash longitude toward real proportions
  const X = pts.map((p) => p.lng * k);
  const Y = pts.map((p) => -p.lat);
  const minX = Math.min(...X), maxX = Math.max(...X), minY = Math.min(...Y), maxY = Math.max(...Y);
  const spanX = maxX - minX || 1e-6, spanY = maxY - minY || 1e-6;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - scale * spanX) / 2 - scale * minX;
  const offY = (H - scale * spanY) / 2 - scale * minY;
  return pts.map((p) => ({ ...p, x: scale * (p.lng * k) + offX, y: scale * (-p.lat) + offY }));
}

export default function TripModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stops, setStops] = useState([]);
  const [meta, setMetaState] = useState({ tripName: "", startDate: "", travelers: 2 });
  const [justAdded, setJustAdded] = useState(null);
  const [coordMap, setCoordMap] = useState(null); // name → {lat,lng} for the mini map
  const [mapFail, setMapFail] = useState(false); // true → fall back to the SVG sketch
  const mapDivRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkersRef = useRef([]);
  const mapLinesRef = useRef([]);
  const dirServiceRef = useRef(null);

  // Portal to <body> so the fixed overlay isn't trapped by an ancestor's
  // backdrop-filter / transform (SiteHeader's <nav> creates such a containing
  // block, which otherwise confines the modal to the header strip).
  useEffect(() => { setMounted(true); }, []);

  // Keep local state in sync with the store.
  useEffect(() => {
    const sync = () => { setStops(getStops()); setMetaState(getMeta()); };
    sync();
    const unsub = subscribeTrip(sync);
    return unsub;
  }, []);

  // Auto-open on add; open on demand from the header pill.
  useEffect(() => {
    const onTrip = (e) => {
      const added = e && e.detail && e.detail.added;
      if (added) { setJustAdded(added); setOpen(true); clearTimeout(window.__pbAddedT); window.__pbAddedT = setTimeout(() => setJustAdded(null), 3200); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("pb:trip", onTrip);
    window.addEventListener("pb:trip-open", onOpen);
    return () => { window.removeEventListener("pb:trip", onTrip); window.removeEventListener("pb:trip-open", onOpen); };
  }, []);

  // Load coordinates for the mini route map the first time the modal opens:
  // the 63 parks from trip-data.js + the national forests from the curated JSON,
  // keyed by the exact name we store stops under.
  useEffect(() => {
    if (!open || coordMap) return;
    let on = true;
    (async () => {
      const map = {};
      try {
        await loadScript("/trip-data.js");
        (typeof window !== "undefined" && window.TRIP_PARKS || []).forEach((p) => { if (p && p.name) map[p.name] = { lat: p.lat, lng: p.lng }; });
      } catch {}
      try {
        const fd = await fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        ((fd && fd.forests) || []).forEach((f) => { if (f && f.name) map[f.name] = { lat: f.lat, lng: f.lng }; });
      } catch {}
      if (on) setCoordMap(map);
    })();
    return () => { on = false; };
  }, [open, coordMap]);

  // Real Google map of the trip (view-only — adding locations happens on /build-trip).
  // Numbered stop pins + the driving route; falls back to the SVG sketch if Maps can't
  // load (no key). Standard light theme; no browse/add markers here by design.
  useEffect(() => {
    if (!open || !coordMap) return;
    const pts = stops.map((s) => { const c = (s.lat != null && s.lng != null) ? s : coordMap[s.name]; return c ? { name: s.name, lat: c.lat, lng: c.lng } : null; }).filter(Boolean);
    if (!pts.length) return;
    let cancelled = false;
    ensureMapsLoaded().then((loaded) => {
      if (cancelled) return;
      if (!loaded || typeof window === "undefined" || !window.google || !mapDivRef.current) { setMapFail(true); return; }
      setMapFail(false);
      const g = window.google;
      let map = mapInstanceRef.current;
      if (!map || map.getDiv() !== mapDivRef.current) {
        map = new g.maps.Map(mapDivRef.current, { disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative", clickableIcons: false, backgroundColor: "#e8eae4" });
        mapInstanceRef.current = map;
      }
      mapMarkersRef.current.forEach((m) => m.setMap(null)); mapMarkersRef.current = [];
      mapLinesRef.current.forEach((l) => l.setMap(null)); mapLinesRef.current = [];
      const bounds = new g.maps.LatLngBounds();
      pts.forEach((p, i) => {
        bounds.extend({ lat: p.lat, lng: p.lng });
        mapMarkersRef.current.push(new g.maps.Marker({
          position: { lat: p.lat, lng: p.lng }, map, title: p.name,
          icon: { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="12" fill="#1d3941" stroke="#e4be78" stroke-width="2.5"/><text x="17" y="21.5" font-family="sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">' + (i + 1) + "</text></svg>"), scaledSize: new g.maps.Size(34, 34), anchor: new g.maps.Point(17, 17) },
        }));
      });
      if (pts.length > 1) map.fitBounds(bounds, 34); else { map.setCenter({ lat: pts[0].lat, lng: pts[0].lng }); map.setZoom(8); }
      if (pts.length < 2) return;
      const sig = pts.map((p) => p.name).join(">");
      const drawLegs = (legs) => {
        legs.forEach((path, i) => {
          const a = pts[i], b = pts[i + 1];
          if (path && path.length) mapLinesRef.current.push(new g.maps.Polyline({ path, map, strokeColor: "#c79a4b", strokeOpacity: 0.95, strokeWeight: 4 }));
          else mapLinesRef.current.push(new g.maps.Polyline({ path: [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], map, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: "#c79a4b", scale: 3 }, offset: "0", repeat: "12px" }] }));
        });
      };
      if (modalRouteCache[sig]) { drawLegs(modalRouteCache[sig]); return; }
      if (!dirServiceRef.current) dirServiceRef.current = new g.maps.DirectionsService();
      (async () => {
        const legs = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const path = await new Promise((resolve) => {
            dirServiceRef.current.route({ origin: { lat: a.lat, lng: a.lng }, destination: { lat: b.lat, lng: b.lng }, travelMode: g.maps.TravelMode.DRIVING }, (res, status) => {
              resolve(status === "OK" && res.routes && res.routes[0] ? res.routes[0].overview_path.map((ll) => ({ lat: ll.lat(), lng: ll.lng() })) : null);
            });
          });
          if (cancelled) return;
          legs.push(path);
        }
        modalRouteCache[sig] = legs;
        if (!cancelled && mapInstanceRef.current === map) drawLegs(legs);
      })();
    });
    return () => { cancelled = true; };
  }, [open, coordMap, stops]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open || !mounted) return null;

  const totalNights = stops.reduce((a, s) => a + (s.nights || 0), 0);
  const days = totalNights; // match Build My Trip's day count (nights-based)

  const patchMeta = (p) => { setMeta(p); setMetaState(getMeta()); };

  // Project the stops that have known coordinates for the mini route map.
  const MAP_W = 320, MAP_H = 168;
  const mapSource = coordMap
    ? stops.map((s, i) => { const c = (s.lat != null && s.lng != null) ? s : coordMap[s.name]; return c ? { name: s.name, lat: c.lat, lng: c.lng, i } : null; }).filter(Boolean)
    : [];
  const mapPts = fitProject(mapSource, MAP_W, MAP_H, 26);

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,8,13,.72)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(12px,4vh,60px) 14px", overflowY: "auto", fontFamily: "var(--pb-sans)" }}
    >
      <div style={{ width: "100%", maxWidth: 620, background: "linear-gradient(180deg,rgba(16,34,24,.98),rgba(9,20,14,.98))", border: "1px solid var(--pb-line-strong)", borderRadius: 22, boxShadow: "0 40px 100px -40px rgba(0,0,0,.9)", overflow: "hidden" }}>
        {/* header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--pb-line)", position: "relative" }}>
          <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Your trip</div>
          <input
            value={meta.tripName}
            onChange={(e) => patchMeta({ tripName: e.target.value })}
            placeholder="Name your trip"
            style={{ display: "block", width: "100%", marginTop: 4, fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", color: "var(--pb-ink)", background: "transparent", border: "none", outline: "none", boxSizing: "border-box" }}
          />
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "rgba(9,22,15,.7)", color: "#c3c8d0", fontSize: "1.1rem", lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>

        {/* route map — the selected stops on a real map (view-only; add locations on
            Build My Trip). Falls back to an SVG sketch if Google Maps can't load. */}
        {mapPts.length > 0 && (
          <div style={{ margin: "14px 16px 0", borderRadius: 14, overflow: "hidden", border: "1px solid var(--pb-line)", position: "relative", height: 190, background: "#e8eae4" }}>
            <div ref={mapDivRef} style={{ position: "absolute", inset: 0, display: mapFail ? "none" : "block" }} />
            {mapFail && (
              <svg viewBox={"0 0 " + MAP_W + " " + MAP_H} style={{ display: "block", width: "100%", height: "100%", background: "radial-gradient(120% 100% at 50% 0%,#12271c,#0a1710)" }} role="img" aria-label="Map of your trip route" preserveAspectRatio="xMidYMid slice">
                {[0.25, 0.5, 0.75].map((f) => (<line key={"h" + f} x1="0" y1={MAP_H * f} x2={MAP_W} y2={MAP_H * f} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />))}
                {[0.2, 0.4, 0.6, 0.8].map((f) => (<line key={"v" + f} x1={MAP_W * f} y1="0" x2={MAP_W * f} y2={MAP_H} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />))}
                {mapPts.length > 1 && (<polyline points={mapPts.map((p) => p.x + "," + p.y).join(" ")} fill="none" stroke="#e4be78" strokeWidth="2.2" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />)}
                {mapPts.map((p) => (
                  <g key={p.i}>
                    <circle cx={p.x} cy={p.y} r="11" fill="#e4be78" stroke="#0a1710" strokeWidth="2" />
                    <text x={p.x} y={p.y + 3.6} textAnchor="middle" fontFamily="var(--pb-mono)" fontSize="10.5" fontWeight="800" fill="#0a1710">{p.i + 1}</text>
                  </g>
                ))}
              </svg>
            )}
            {mapSource.length < stops.length && (
              <div style={{ position: "absolute", bottom: 6, right: 9, zIndex: 2, fontFamily: mono, fontSize: ".52rem", letterSpacing: ".08em", textTransform: "uppercase", color: "#5a6b62", background: "rgba(255,255,255,.75)", borderRadius: 6, padding: "2px 6px" }}>{mapSource.length} of {stops.length} mapped</div>
            )}
          </div>
        )}

        {justAdded && (
          <div style={{ margin: "12px 16px 0", padding: "9px 13px", borderRadius: 12, background: "rgba(79,217,138,.1)", border: "1px solid rgba(79,217,138,.3)", color: "#7fe3a6", fontSize: ".82rem", fontWeight: 600 }}>Added {justAdded} to your trip ✓</div>
        )}

        {/* stops */}
        <div style={{ padding: "14px 16px 4px", display: "flex", flexDirection: "column", gap: 9 }}>
          {stops.length === 0 && (
            <div style={{ textAlign: "center", padding: "26px 12px", color: "var(--pb-muted)", fontSize: ".9rem" }}>
              Your trip is empty. Add parks, forests and drives as you explore — they’ll collect here.
            </div>
          )}
          {stops.map((s, i) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 14, background: justAdded === s.name ? "rgba(217,183,121,.1)" : "rgba(255,255,255,.03)", border: "1px solid " + (justAdded === s.name ? "rgba(217,183,121,.4)" : "var(--pb-line)") }}>
              <span style={{ width: 26, height: 26, flex: "none", borderRadius: 8, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", fontFamily: mono, fontWeight: 800, fontSize: ".78rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, color: "var(--pb-ink)", fontSize: ".96rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
              </span>
              {/* nights stepper */}
              <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                <button onClick={() => setNights(s.name, (s.nights || 0) - 1)} aria-label="Fewer nights" style={stepBtn}>−</button>
                <span style={{ minWidth: 62, textAlign: "center", fontSize: ".76rem", color: "var(--pb-ink-2)", fontWeight: 600 }}>{nightsLabel(s.nights || 0)}</span>
                <button onClick={() => setNights(s.name, (s.nights || 0) + 1)} aria-label="More nights" style={stepBtn}>+</button>
              </span>
              {/* reorder + remove */}
              <span style={{ display: "flex", flexDirection: "column", flex: "none" }}>
                <button onClick={() => moveStop(s.name, -1)} disabled={i === 0} aria-label="Move up" style={{ ...tinyBtn, opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => moveStop(s.name, 1)} disabled={i === stops.length - 1} aria-label="Move down" style={{ ...tinyBtn, opacity: i === stops.length - 1 ? 0.3 : 1 }}>▼</button>
              </span>
              <button onClick={() => removeStop(s.name)} aria-label="Remove" style={{ ...tinyBtn, width: 28, height: 28, color: "#e0906a", fontSize: "1rem" }}>×</button>
            </div>
          ))}
        </div>

        {/* trip settings */}
        {stops.length > 0 && (
          <div style={{ padding: "12px 16px 4px", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={fieldWrap}>
              <span style={fieldLabel}>Start date</span>
              <input type="date" value={meta.startDate} onChange={(e) => patchMeta({ startDate: e.target.value })} style={fieldBox} />
            </label>
            <label style={fieldWrap}>
              <span style={fieldLabel}>Travellers</span>
              <input type="number" min="1" max="12" value={meta.travelers} onChange={(e) => patchMeta({ travelers: Math.max(1, Number(e.target.value) || 1) })} style={fieldBox} />
            </label>
            <div style={{ ...fieldWrap, justifyContent: "flex-end" }}>
              <span style={fieldLabel}>Itinerary</span>
              <span style={{ fontFamily: serif, fontSize: "1.05rem", color: "var(--pb-ink)", fontWeight: 600 }}>{stops.length} stop{stops.length > 1 ? "s" : ""} · {days} day{days > 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        {/* actions */}
        <div style={{ padding: "16px", display: "flex", gap: 10, borderTop: "1px solid var(--pb-line)", marginTop: 8 }}>
          <button onClick={() => setOpen(false)} style={{ flex: "none", cursor: "pointer", fontFamily: "inherit", fontSize: ".86rem", fontWeight: 600, color: "#c3c8d0", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "12px 18px" }}>Keep exploring</button>
          <Link href="/build-trip" onClick={() => setOpen(false)} style={{ flex: 1, textAlign: "center", textDecoration: "none", fontSize: ".86rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "12px 18px" }}>
            Open full planner — map & budget →
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

const stepBtn = { width: 26, height: 26, borderRadius: 8, border: "1px solid var(--pb-line-strong)", background: "rgba(255,255,255,.04)", color: "var(--pb-ink)", fontSize: "1rem", lineHeight: 1, cursor: "pointer", fontFamily: "inherit" };
const tinyBtn = { width: 22, height: 18, border: "none", background: "transparent", color: "#8a938b", fontSize: ".6rem", cursor: "pointer", lineHeight: 1, padding: 0 };
const fieldWrap = { flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 4 };
const fieldLabel = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" };
const fieldBox = { padding: "9px 11px", border: "1px solid var(--pb-line-strong)", borderRadius: 10, fontSize: ".86rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.04)", fontFamily: "inherit", boxSizing: "border-box", width: "100%", colorScheme: "dark" };
