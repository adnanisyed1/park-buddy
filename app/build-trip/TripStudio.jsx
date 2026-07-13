"use client";

import { useEffect, useRef, useState } from "react";

// Trip Studio — the futuristic reskin of Build My Trip, ported from the Claude
// Design prototype (Downloads/Trip Studio.dc.html). PRESENTATIONAL ONLY: every
// piece of state + every handler is passed in from BuildTripApp, which still owns
// the Google map, drag-reorder, live verdicts, saved trips, scenic routes and the
// setup wizard. The design's decorative SVG map is replaced by the real Google
// map (mapDivRef); the topo grid, glass HUD and gold accents are kept.

const SERIF = "var(--pb-serif)";
const SANS = "var(--pb-sans)";
const MONO = "var(--pb-mono)";

const kicker = { fontFamily: MONO, fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: "#d9b779" };
const glass = { background: "rgba(14,32,22,0.5)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 18, padding: 18, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(217,183,121,0.06)" };
const THUMBS = ["linear-gradient(140deg,#2a3826,#12211a)", "linear-gradient(140deg,#3a2f1f,#141f18)", "linear-gradient(140deg,#3a241c,#161d15)", "linear-gradient(140deg,#3a2a1a,#181c14)", "linear-gradient(140deg,#26342a,#101d16)"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const filterField = { background: "rgba(8,19,13,0.7)", border: "1px solid rgba(217,183,121,0.22)", borderRadius: 9, padding: "7px 10px", color: "#e8cf9a", fontFamily: SANS, fontSize: 11.5, outline: "none", colorScheme: "dark" };
const miniBtn = { cursor: "pointer", fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.16)", background: "transparent", color: "#7f8a82" };
const navTile = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", textDecoration: "none", padding: "11px 8px", borderRadius: 11, border: "1px solid rgba(217,183,121,0.2)", background: "rgba(255,255,255,.03)", color: "#e8cf9a", fontFamily: SANS, fontSize: 12.5, fontWeight: 500 };
// hex (#rrggbb) + alpha → rgba() string, for tinted budget icon tiles.
function hexA(hex, a) { const h = hex.replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return "rgba(" + r + "," + g + "," + b + "," + a + ")"; }

// Animate 0→value on first mount (ease-out cubic, ~1.1s); reflect later changes instantly.
function CountUp({ value, format }) {
  const [n, setN] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    const target = Number(value) || 0;
    if (mounted.current) { setN(target); return; }
    mounted.current = true;
    let raf; const t0 = performance.now(), dur = 1100;
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur); setN(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format ? format(n) : Math.round(n)}</>;
}

// Route/Explore glyphs as inline SVG (system fonts tofu the unicode crosshair).
function ModeIcon({ id }) {
  const common = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "route") {
    return <svg {...common}><circle cx="5" cy="19" r="2.4" /><circle cx="19" cy="5" r="2.4" /><path d="M7 17.5 17 6.5" strokeDasharray="1.5 3" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
}

// Monochrome line-icon set (Lucide geometry) — replaces emoji in the budget +
// navigate tiles. stroke=currentColor so each takes its parent's color/tint.
function TSIcon({ name, size = 16 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "plane": return <svg {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>;
    case "car": return <svg {...p}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12 1 13v3c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>;
    case "caravan": return <svg {...p}><path d="M2 9a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v8h3v1a1 1 0 0 1-1 1h-2" /><path d="M2 17V9" /><rect width="6" height="4" x="5" y="10" rx="1" /><circle cx="10" cy="17" r="2" /><path d="M2 17h6" /></svg>;
    case "fuel": return <svg {...p}><line x1="3" x2="15" y1="22" y2="22" /><line x1="4" x2="14" y1="9" y2="9" /><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5" /></svg>;
    case "bed": return <svg {...p}><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M2 18h20" /><path d="M12 4v6" /></svg>;
    case "utensils": return <svg {...p}><path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>;
    case "ticket": return <svg {...p}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></svg>;
    case "pin": return <svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
    case "apple": return <svg {...p}><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" /><path d="M10 2c1 .5 2 2 2 5" /></svg>;
    case "chat": return <svg {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
    case "link": return <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
    case "printer": return <svg {...p}><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><rect width="12" height="8" x="6" y="14" /></svg>;
    case "book": return <svg {...p}><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>;
    case "fileup": return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3-3 3 3" /></svg>;
    default: return null;
  }
}

function ModeBtn({ id, label, mode, setMode }) {
  const on = mode === id;
  return (
    <button onClick={() => setMode(id)} style={{ cursor: "pointer", fontFamily: SANS, fontSize: 12.5, fontWeight: 600, letterSpacing: ".01em", padding: "8px 15px", borderRadius: 999, border: "none", whiteSpace: "nowrap", color: on ? "#0a1712" : "#aab0ba", background: on ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "transparent", boxShadow: on ? "0 6px 18px -8px rgba(217,183,121,.6)" : "none" }}>{label}</button>
  );
}

export default function TripStudio(props) {
  const {
    mode, setMode, onNewTrip,
    stat, statNum, tripName, setTripName,
    stops, dayRanges, verdicts, STOP_STATUS,
    onDragStart, onDragOver, onDrop, removeStop, setStopNights, addMyTrip, hoverIdx, setHoverIdx,
    expandedStop, toggleDayPlan, dayPlans, addActivity, removeActivity,
    addSource, setAddSource, addMenuOpen, setAddMenuOpen,
    parksDb, addSel, setAddSel, addPark,
    bywaysDb, addBywaySel, setAddBywaySel, addByway,
    addrInput, setAddrInput, addAddress, addrMsg,
    coordInput, setCoordInput, addCoords,
    setupCollapsed, setSetupCollapsed, setupRows, onEditSetup, onSaveTrip, saveMsg, showOnMap, setShowOnMap,
    budgetOpen, setBudgetOpen, budgetLines, BudgetAmount, totalCost, perPerson, fmtUsd,
    routes, loadedRoute, loadRoute,
    savedTrips, loadSavedTrip, deleteSavedTrip,
    gmapsUrl, appleUrl, waUrl, copyLink,
    mapDivRef, keyOverlay, keyInputRef, saveKey, keyMsg, roadInfo, driveHrs, totalMiles,
    layers, setLayers, layersOpen, setLayersOpen,
    mapView, setMapView, browseState, setBrowseState, browseQuery, setBrowseQuery, radius, setRadius,
    fieldBox,
  } = props;

  const DEST_LAYERS = [["np", "◈", "National Parks"], ["statePark", "◆", "State Parks"], ["forest", "▲", "National Forests"], ["byway", "⛰", "Scenic routes"]];
  const DEST_DOT = { np: "#5fbf86", statePark: "#5aa9d6", forest: "#6f9e5a", byway: "#e4be78" }; // marker-matched chip dots
  const CTX_LAYERS = [["camp", "Campgrounds"], ["lake", "Lakes"], ["hiking", "Hiking"], ["offroad", "Off-road"], ["ski", "Ski"]];

  const sn = statNum || { stops: 0, days: 0, miles: 0, cost: 0 };
  const stat4 = [{ label: "Stops", num: sn.stops }, { label: "Days", num: sn.days }, { label: "Drive miles", num: sn.miles }, { label: "Est. cost", num: sn.cost, fmt: fmtUsd }];

  // Mobile: the map becomes a pull-up bottom sheet + the "+ Add a stop" button
  // opens a search-first popup (spec §7 / §7a). Detected client-side to keep SSR stable.
  const [isMobile, setIsMobile] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => setIsMobile(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // Nudge the Google map to re-measure after the sheet finishes animating.
  useEffect(() => {
    if (!isMobile) return;
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 430);
    return () => clearTimeout(t);
  }, [sheetOpen, isMobile]);

  return (
    <div style={{ background: "radial-gradient(1200px 700px at 20% -10%, rgba(217,183,121,0.06), transparent 60%), radial-gradient(900px 600px at 100% 110%, rgba(217,183,121,0.05), transparent 55%), #050c09", padding: "clamp(14px,2.4vw,40px)", minHeight: "70vh" }}>
      <style>{`
        @keyframes ts-gridDrift { from { transform: translate(0,0); } to { transform: translate(-64px,-64px); } }
        @keyframes ts-softFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes ts-shimmer { 0% { background-position: -140% 0; } 100% { background-position: 240% 0; } }
        .ts-skel { background: linear-gradient(90deg, rgba(217,183,121,0.06) 25%, rgba(217,183,121,0.16) 50%, rgba(217,183,121,0.06) 75%); background-size: 220% 100%; animation: ts-shimmer 1.3s linear infinite; border-radius: 999px; }
        .ts-scroll::-webkit-scrollbar { width: 8px; }
        .ts-scroll::-webkit-scrollbar-thumb { background: rgba(217,183,121,.18); border-radius: 8px; }
        .ts-hoverline:hover { border-color: rgba(217,183,121,.4) !important; }
        .ts-navtile { transition: border-color .18s, background .18s, color .18s, transform .08s; }
        .ts-navtile:hover { border-color: rgba(217,183,121,.5) !important; background: rgba(217,183,121,.09) !important; color: #f4f1ea !important; }
        .ts-navtile:active { transform: translateY(1px); }
        .ts-budrow { transition: background .15s; border-radius: 10px; }
        .ts-budrow:hover { background: rgba(217,183,121,.05); }
        .ts-goldbtn { transition: transform .12s, box-shadow .22s, filter .22s; }
        .ts-goldbtn:hover { filter: brightness(1.05); box-shadow: 0 16px 42px -12px rgba(217,183,121,.75) !important; transform: translateY(-1px); }
        .ts-goldbtn:active { transform: translateY(0); filter: brightness(.98); }
        @media (max-width: 900px) {
          .ts-body { flex-direction: column !important; }
          .ts-modules { order: 1; flex: none !important; border-left: none !important; max-height: none !important; overflow: visible !important; padding-bottom: 120px !important; }
          .ts-switcher button { padding: 8px 11px !important; font-size: 11.5px !important; }
        }`}</style>
      <style>{`
        @keyframes ts-sheetGrab { 0%,100% { opacity:.55; } 50% { opacity:1; } }
      `}</style>

      <div style={{ maxWidth: 1360, margin: "0 auto", background: "#0a1712", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 22, overflow: "hidden", boxShadow: "0 40px 120px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(217,183,121,0.08)", display: "flex", flexDirection: "column" }}>

        {/* ── top bar ── */}
        <div style={{ flex: "none", position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderBottom: "1px solid rgba(217,183,121,0.12)", background: "linear-gradient(180deg, rgba(14,32,22,0.7), rgba(11,23,16,0.2))", backdropFilter: "blur(14px)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px -6px rgba(217,183,121,0.6)" }}>
              <div style={{ width: 14, height: 14, border: "2px solid #0a1712", borderRadius: "50%" }} />
            </div>
            <div style={{ lineHeight: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, color: "#f4f1ea", letterSpacing: ".01em" }}>Trip Studio</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".26em", textTransform: "uppercase", color: "#7f8a82", marginTop: 3 }}>Park Buddy</div>
            </div>
          </div>

          <div style={{ display: "flex", padding: 5, gap: 4, background: "rgba(8,19,13,0.7)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 999, ...(isMobile ? { order: 3, flex: "1 1 100%", justifyContent: "center" } : { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }) }} className="ts-switcher">
            <ModeBtn id="new" label="New trip" mode={mode} setMode={setMode} />
            <ModeBtn id="premade" label="Ready-made routes" mode={mode} setMode={setMode} />
            <ModeBtn id="mine" label={"My trips" + (savedTrips.length ? " · " + savedTrips.length : "")} mode={mode} setMode={setMode} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", color: "#8fd6a6", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8fd6a6", boxShadow: "0 0 10px #8fd6a6" }} />LIVE
            </div>
            <button onClick={onNewTrip} title="Start a blank trip" style={{ cursor: "pointer", fontFamily: SANS, fontSize: 12, fontWeight: 700, color: "#e8cf9a", background: "rgba(255,255,255,.04)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 999, padding: "7px 14px" }}>＋ Blank</button>
          </div>
        </div>

        {/* ── body: map stage + modules ── */}
        <div className="ts-body" style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* MAP STAGE (real Google map) — desktop panel / mobile pull-up sheet */}
          <div className="ts-stage" style={isMobile
            ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, height: sheetOpen ? "74vh" : 106, minHeight: 0, overflow: "hidden", background: "radial-gradient(900px 620px at 60% 35%, #0d1f16, #08130d 70%)", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: "1px solid rgba(217,183,121,0.3)", boxShadow: "0 -22px 60px -22px rgba(0,0,0,0.85)", transition: "height .38s cubic-bezier(.4,0,.2,1)" }
            : { flex: "1.62 1 0", position: "relative", overflow: "hidden", background: "radial-gradient(900px 620px at 60% 35%, #0d1f16, #08130d 70%)", minHeight: 520 }}>
            <div style={{ position: "absolute", inset: -64, opacity: 0.5, animation: "ts-gridDrift 26s linear infinite", pointerEvents: "none", backgroundImage: "linear-gradient(rgba(217,183,121,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(217,183,121,0.05) 1px, transparent 1px)", backgroundSize: "64px 64px", zIndex: 1 }} />
            <div ref={mapDivRef} style={{ position: "absolute", inset: 0, top: isMobile ? (sheetOpen ? 40 : 106) : 0 }} />

            {/* mobile grabber / peek header */}
            {isMobile && (
              <div onClick={() => setSheetOpen((o) => !o)} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 9, height: sheetOpen ? 40 : 106, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: sheetOpen ? "linear-gradient(180deg, rgba(6,14,10,0.96), rgba(6,14,10,0))" : "rgba(11,23,16,0.94)" }}>
                <div style={{ width: 46, height: 5, borderRadius: 999, background: "rgba(217,183,121,0.55)", animation: sheetOpen ? "none" : "ts-sheetGrab 2.4s ease-in-out infinite" }} />
                {!sheetOpen && <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: "#e8cf9a" }}>Map · pull up ↑ · {totalMiles || 0} mi · {driveHrs || 0} h</div>}
                {sheetOpen && <button onClick={(e) => { e.stopPropagation(); setSheetOpen(false); }} style={{ position: "absolute", top: 6, right: 12, width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(11,23,16,0.8)", color: "#e8cf9a", fontSize: 15, lineHeight: 1, cursor: "pointer" }}>✕</button>}
              </div>
            )}

            {/* google-key overlay */}
            <div style={{ display: keyOverlay ? "flex" : "none", position: "absolute", inset: 0, zIndex: 6, background: "rgba(5,12,9,.78)", backdropFilter: "blur(3px)", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ background: "var(--pb-surface)", borderRadius: 16, padding: 22, maxWidth: 340, boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
                <b style={{ fontFamily: SERIF, fontSize: "1.1rem", color: "var(--pb-ink)", display: "block", marginBottom: 6 }}>Load the live map</b>
                <p style={{ fontSize: ".82rem", color: "var(--pb-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>{keyMsg}</p>
                <input ref={keyInputRef} placeholder="AIza…" style={{ width: "100%", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 12px", fontSize: ".86rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,.04)", color: "var(--pb-ink)", colorScheme: "dark" }} />
                <button onClick={saveKey} style={{ width: "100%", marginTop: 10, border: "none", cursor: "pointer", borderRadius: 10, padding: 12, fontWeight: 800, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", fontFamily: "inherit" }}>Load map</button>
              </div>
            </div>

            {/* corner label */}
            <div style={{ position: "absolute", top: 22, left: 26, zIndex: 3, fontFamily: MONO, fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: "#aab0ba", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none", textShadow: "0 1px 8px rgba(0,0,0,.7)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9a35f" }} />{tripName || "Your route"}
            </div>

            {/* Route ⇄ Explore toggle — a standalone floating pill, top-left, in both modes. */}
            {setMapView && (
              <div style={{ position: "absolute", top: isMobile ? 52 : 50, left: 26, zIndex: 8, display: "flex", padding: 4, gap: 3, background: "rgba(11,23,16,0.72)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 999, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "0 8px 24px -12px rgba(0,0,0,0.8)" }}>
                {["route", "explore"].map((id) => {
                  const on = (mapView || "route") === id;
                  return (
                    <button key={id} onClick={() => setMapView(id)} style={{ cursor: "pointer", fontFamily: SANS, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, padding: "7px 15px", borderRadius: 999, border: "none", color: on ? "#0a1712" : "#aab0ba", background: on ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "transparent" }}>
                      <ModeIcon id={id} />{id === "route" ? "Route" : "Explore"}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Explore — floating search card, sits below the toggle (matches the design). */}
            {mapView === "explore" && (
              <div style={{ position: "absolute", top: isMobile ? 100 : 96, left: 22, right: 22, maxWidth: 620, zIndex: 7, padding: 12, borderRadius: 18, background: "rgba(10,20,14,0.92)", border: "1px solid rgba(217,183,121,0.24)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 24px 60px -22px rgba(0,0,0,0.85)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: "1 1 220px", minWidth: 160 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7f8a82", fontSize: 13, pointerEvents: "none" }}>⌕</span>
                    <input value={browseQuery || ""} onChange={(e) => setBrowseQuery && setBrowseQuery(e.target.value)} placeholder="Search parks, towns, trails, byways…" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 32px", borderRadius: 11, border: "1px solid rgba(217,183,121,0.22)", background: "rgba(8,19,13,0.7)", color: "#f4f1ea", fontFamily: SANS, fontSize: 13, outline: "none" }} />
                  </div>
                  <select value={browseState || ""} onChange={(e) => setBrowseState && setBrowseState(e.target.value)} style={{ ...filterField, padding: "9px 11px", fontSize: 12 }}>
                    <option value="">All states</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "none" }}>
                    <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8a82" }}>Radius</span>
                    <input type="range" min="10" max="150" step="5" value={radius || 50} onChange={(e) => setRadius && setRadius(+e.target.value)} style={{ width: 92, accentColor: "#d9b779" }} />
                    <span style={{ fontFamily: MONO, fontSize: 9.5, color: "#aab0ba", minWidth: 38 }}>{radius || 50} mi</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                  {DEST_LAYERS.map(([k, ic, label]) => (
                    <button key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} style={{ cursor: "pointer", fontFamily: SANS, fontSize: 11.5, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, border: "1px solid " + (layers[k] ? "rgba(217,183,121,0.5)" : "rgba(217,183,121,0.16)"), background: layers[k] ? "rgba(217,183,121,0.12)" : "transparent", color: layers[k] ? "#f4f1ea" : "#7f8a82" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: layers[k] ? DEST_DOT[k] : "rgba(255,255,255,0.18)", boxShadow: layers[k] ? "0 0 7px " + DEST_DOT[k] : "none" }} />{label}
                    </button>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <button onClick={() => setLayers((l) => ({ ...l, np: true, statePark: true, forest: true, byway: true }))} style={miniBtn}>All</button>
                    <button onClick={() => setLayers((l) => ({ ...l, np: false, statePark: false, forest: false, byway: false }))} style={miniBtn}>None</button>
                  </div>
                </div>
              </div>
            )}

            {/* Route mode — layers control (button + dropdown), top-right. */}
            {mapView !== "explore" && (
              <div style={{ position: "absolute", top: 18, right: 18, zIndex: 4 }}>
                <button onClick={() => setLayersOpen(!layersOpen)} style={{ cursor: "pointer", fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: layersOpen ? "#0a1712" : "#e8cf9a", background: layersOpen ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(11,23,16,0.72)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 999, padding: "7px 13px", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", gap: 7 }}>◈ Layers</button>
                {layersOpen && (
                  <div style={{ marginTop: 8, width: 210, background: "rgba(14,32,22,0.97)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 14, padding: 12, backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.9)" }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".16em", textTransform: "uppercase", color: "#7f8a82", marginBottom: 8 }}>Tap a map marker to add</div>
                    {DEST_LAYERS.map(([k, ic, label]) => (
                      <label key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 4px", cursor: "pointer", fontSize: 12.5, color: "#f4f1ea" }}>
                        <span style={{ width: 30, height: 17, flex: "none", borderRadius: 999, background: layers[k] ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.12)", position: "relative", transition: "background .15s" }}>
                          <span style={{ position: "absolute", top: 2, left: layers[k] ? 15 : 2, width: 13, height: 13, borderRadius: "50%", background: layers[k] ? "#0a1712" : "#e7e3d8", transition: "left .15s" }} />
                        </span>
                        <span style={{ color: "#d9b779", width: 14 }}>{ic}</span>{label}
                      </label>
                    ))}
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".16em", textTransform: "uppercase", color: "#7f8a82", margin: "10px 0 6px", borderTop: "1px solid rgba(217,183,121,0.12)", paddingTop: 9 }}>Show around each stop</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {CTX_LAYERS.map(([k, label]) => (
                        <span key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} style={{ cursor: "pointer", fontSize: 10.5, padding: "4px 10px", borderRadius: 999, border: "1px solid " + (layers[k] ? "rgba(217,183,121,0.5)" : "rgba(217,183,121,0.16)"), background: layers[k] ? "rgba(217,183,121,0.14)" : "transparent", color: layers[k] ? "#e8cf9a" : "#7f8a82" }}>{label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Explore mode — open "Layers" panel bottom-right (matches the design). */}
            {mapView === "explore" && !isMobile && (
              <div style={{ position: "absolute", right: 18, bottom: 22, zIndex: 4, width: 208, background: "rgba(14,32,22,0.95)", border: "1px solid rgba(217,183,121,0.28)", borderRadius: 15, padding: "12px 14px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.9)" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#d9b779", marginBottom: 10 }}>Layers</div>
                {[["camp", "Campgrounds"], ["lake", "Lakes"], ["hiking", "Hiking trails"], ["offroad", "Off-road / 4×4"], ["ski", "Ski routes"]].map(([k, label]) => (
                  <label key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, padding: "6px 0", cursor: "pointer", fontFamily: SANS, fontSize: 12.5, color: "#f4f1ea" }}>
                    {label}
                    <span style={{ width: 32, height: 18, flex: "none", borderRadius: 999, background: layers[k] ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.12)", position: "relative", transition: "background .15s" }}>
                      <span style={{ position: "absolute", top: 2, left: layers[k] ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: layers[k] ? "#0a1712" : "#e7e3d8", transition: "left .15s" }} />
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* floating glass HUD */}
            <div style={{ position: "absolute", left: 26, bottom: 26, zIndex: 3, display: "flex", gap: 2, padding: 4, background: "rgba(11,23,16,0.62)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 16, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(217,183,121,0.12)", animation: "ts-softFloat 6s ease-in-out infinite", flexWrap: "wrap" }}>
              {stat4.map((s, i) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <div style={{ width: 1, alignSelf: "stretch", background: "rgba(217,183,121,0.16)", margin: "8px 0" }} />}
                  <div style={{ padding: "10px 18px", textAlign: "center" }}>
                    <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: i === 3 ? "#e8cf9a" : "#f4f1ea", lineHeight: 1 }}><CountUp value={s.num} format={s.fmt} /></div>
                    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase", color: "#7f8a82", marginTop: 6 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* live drive chip */}
            <div style={{ position: "absolute", bottom: 26, right: 26, zIndex: 3, fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: "#e8cf9a", background: "rgba(11,23,16,0.62)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 999, padding: "8px 14px", backdropFilter: "blur(14px)" }}>{roadInfo ? roadInfo.miles + " mi · " + (roadInfo.mins >= 60 ? Math.floor(roadInfo.mins / 60) + "h " + (roadInfo.mins % 60) + "m" : roadInfo.mins + "m") : totalMiles + " mi · " + driveHrs + "h"}</div>
          </div>

          {/* RIGHT MODULES */}
          <div className="ts-modules ts-scroll" style={{ flex: "1 1 0", minWidth: 0, maxWidth: 560, borderLeft: "1px solid rgba(217,183,121,0.12)", background: "linear-gradient(180deg,#0b1710,#08130d)", overflowY: "auto", maxHeight: "82vh", padding: 22 }}>

            {mode === "new" && (
              <div>
                {/* trip header — editable name + count-up stat bar + setup button */}
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={kicker}>Trip name</div>
                  <input value={tripName || ""} onChange={(e) => setTripName && setTripName(e.target.value)} placeholder="Name your trip"
                    style={{ width: "100%", marginTop: 6, background: "transparent", border: "none", borderBottom: "1px dashed rgba(217,183,121,0.35)", color: "#f4f1ea", fontFamily: SERIF, fontSize: 26, fontWeight: 600, outline: "none", padding: "2px 0 6px", boxSizing: "border-box" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 14 }}>
                    {stat4.map((s, i) => (
                      <div key={s.label} style={{ background: "rgba(8,19,13,0.6)", border: "1px solid rgba(217,183,121,0.12)", borderRadius: 11, padding: "10px 6px", textAlign: "center", minWidth: 0 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: i === 3 ? "#e8cf9a" : "#f4f1ea", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis" }}><CountUp value={s.num} format={s.fmt} /></div>
                        <div style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8a82", marginTop: 6 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={onEditSetup} className="ts-goldbtn" style={{ width: "100%", marginTop: 14, padding: 11, borderRadius: 11, border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontFamily: SANS, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>◈ Set up your trip</button>
                </div>

                {/* your trip setup — summary card, above the itinerary (matches the design) */}
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={kicker}>Your trip setup</div>
                    <span onClick={onEditSetup} style={{ fontFamily: SANS, fontSize: 11.5, color: "#c9a35f", cursor: "pointer" }}>Edit</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 18px", marginTop: 16 }}>
                    {setupRows.map(([k, val]) => (
                      <div key={k} style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#7f8a82" }}>{k}</div>
                        <div style={{ fontFamily: SANS, fontSize: 13.5, color: "#f4f1ea", marginTop: 5, overflowWrap: "anywhere" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={onSaveTrip} className="ts-goldbtn" style={{ width: "100%", marginTop: 18, padding: 13, borderRadius: 13, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 13.5, boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>Save trip</button>
                  {saveMsg && <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: saveMsg.includes("first") ? "#c98a5a" : "#8fd6a6", marginTop: 9 }}>{saveMsg}</div>}
                </div>

                {/* edit itinerary */}
                <div style={glass}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={kicker}>Edit itinerary</div>
                    {setShowOnMap ? (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <span style={{ fontFamily: SANS, fontSize: 11.5, color: "#aab0ba" }}>Show on map</span>
                        <span onClick={() => setShowOnMap((v) => !v)} style={{ width: 32, height: 18, flex: "none", borderRadius: 999, background: showOnMap ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.12)", position: "relative", transition: "background .15s" }}>
                          <span style={{ position: "absolute", top: 2, left: showOnMap ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: showOnMap ? "#0a1712" : "#e7e3d8", transition: "left .15s" }} />
                        </span>
                      </label>
                    ) : (
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: "#7f8a82" }}>{stops.length} stop{stops.length === 1 ? "" : "s"} · {totalMiles} mi</div>
                    )}
                  </div>

                  {!stops.length && <div style={{ fontSize: 13, color: "#7f8a82", padding: "10px 2px 4px", lineHeight: 1.6 }}>No stops yet — hit <b style={{ color: "#e8cf9a" }}>Add a stop</b> below, or load a ready-made route.</div>}

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {stops.map((s, i) => {
                      const v = verdicts[s.name];
                      const st = STOP_STATUS[v ? v.status : "loading"];
                      const hov = hoverIdx === i;
                      return (
                        <div key={s.name} draggable onDragStart={onDragStart(i)} onDragOver={onDragOver} onDrop={onDrop(i)} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
                          style={{ display: "flex", flexDirection: "column", padding: 12, borderRadius: 15, background: hov ? "rgba(14,32,22,0.7)" : "rgba(11,23,16,0.55)", border: "1px solid " + (hov ? "rgba(217,183,121,0.4)" : "rgba(217,183,121,0.16)"), boxShadow: hov ? "0 10px 30px -12px rgba(217,183,121,0.35), inset 0 1px 0 rgba(217,183,121,0.12)" : "none", transform: hov ? "translateY(-1px)" : "none", transition: "border-color .2s, box-shadow .2s, transform .2s" }}>
                          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                          <div style={{ width: 58, height: 58, flex: "none", borderRadius: 12, overflow: "hidden", position: "relative", border: "1px solid rgba(217,183,121,0.18)", background: THUMBS[i % THUMBS.length] }}>
                            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(217,183,121,0.14) 0 2px, transparent 2px 9px)" }} />
                            <div style={{ position: "absolute", bottom: 4, left: 5, fontFamily: MONO, fontSize: 7, letterSpacing: ".12em", color: "rgba(244,241,234,0.72)" }}>{(s.name || "").slice(0, 9).toUpperCase()}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {s.kind === "byway" && <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".08em", color: "#e8cf9a" }}>⛰ SCENIC</span>}
                              <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".16em", textTransform: "uppercase", color: "#c9a35f" }}>{dayRanges[i] ? dayRanges[i].label : ""}</span>
                            </div>
                            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: "#f4f1ea", lineHeight: 1.15, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: SANS, fontSize: 11, color: "#7f8a82" }}>{
                                i === 0
                                  ? (dayRanges[i] && dayRanges[i].arrive ? "Arrive " + new Date(dayRanges[i].arrive + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" }) : (s.state || "Start"))
                                  : [(s.legMi != null ? s.legMi + " mi from " + (stops[i - 1] ? stops[i - 1].name : "prev") : null), s.state].filter(Boolean).join(" · ")
                              }</span>
                              {v
                                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: st.chipBg, border: "1px solid " + st.chipBorder, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".08em", color: st.chipText }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot, boxShadow: "0 0 6px " + st.dot }} />{st.label}{v.note ? " · " + v.note.split(" · ")[0] : ""}
                                  </span>
                                : <span className="ts-skel" style={{ display: "inline-block", width: 104, height: 15 }} title="Checking live conditions…" />}
                              {s.kind === "byway"
                                ? <a href={"/scenic-drives/" + (s.slug || "")} onClick={(e) => e.stopPropagation()} style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: "#e8cf9a", textDecoration: "none", marginLeft: "auto" }}>view drive →</a>
                                : (setStopNights && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                                    <button onClick={(e) => { e.stopPropagation(); setStopNights(i, -1); }} style={stepBtn}>−</button>
                                    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", color: "#aab0ba", minWidth: 46, textAlign: "center" }}>{(s.nights || 0)} night{(s.nights || 0) === 1 ? "" : "s"}</span>
                                    <button onClick={(e) => { e.stopPropagation(); setStopNights(i, 1); }} style={stepBtn}>+</button>
                                  </span>
                                ))}
                            </div>
                          </div>
                          <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <span onClick={() => removeStop(i)} title="Remove" style={{ cursor: "pointer", color: "#b06a4a", fontSize: 15, lineHeight: 1, opacity: hov ? 1 : 0.35 }}>×</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, cursor: "grab", opacity: 0.5 }}>
                              <span style={{ width: 14, height: 1.5, background: "#aab0ba", borderRadius: 2 }} />
                              <span style={{ width: 14, height: 1.5, background: "#aab0ba", borderRadius: 2 }} />
                              <span style={{ width: 14, height: 1.5, background: "#aab0ba", borderRadius: 2 }} />
                            </div>
                          </div>
                          </div>
                          {/* Plan this day — per-stop activity timeline */}
                          {toggleDayPlan && (() => {
                            const acts = (dayPlans && dayPlans[s.name]) || [];
                            const open = expandedStop === s.name;
                            return (
                              <div style={{ marginTop: 10, borderTop: "1px solid rgba(217,183,121,0.12)", paddingTop: 9 }}>
                                <button onClick={(e) => { e.stopPropagation(); toggleDayPlan(s.name); }} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: open ? "#e8cf9a" : "#8f9a90" }}>
                                  <span style={{ display: "inline-block", transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>▸</span>
                                  Plan this day{acts.length ? " · " + acts.length : ""}
                                </button>
                                {open && (
                                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {acts.length === 0 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: "#7f8a82", padding: "2px 0" }}>No activities yet — add your first below.</div>}
                                    {acts.map((a) => (
                                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,0.12)" }}>
                                        <span style={{ fontFamily: MONO, fontSize: 10, color: "#c9a35f", minWidth: 40 }}>{a.time || "—"}</span>
                                        <span style={{ fontSize: 14, lineHeight: 1 }}>{a.icon}</span>
                                        <span style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: 12.5, color: "#f4f1ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                                        <span onClick={() => removeActivity(s.name, a.id)} title="Remove" style={{ cursor: "pointer", color: "#b06a4a", fontSize: 13, lineHeight: 1, opacity: 0.55 }}>×</span>
                                      </div>
                                    ))}
                                    <DayPlanAdd onAdd={(act) => addActivity(s.name, act)} fieldBox={fieldBox} />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>

                  {/* add a stop */}
                  <div style={{ position: "relative", marginTop: 14 }}>
                    <button onClick={() => { if (isMobile) { setMobileAddOpen(true); } else { setAddMenuOpen(!addMenuOpen); setAddSource(null); } }} className="ts-goldbtn" style={{ width: "100%", padding: 13, borderRadius: 13, border: "1px solid rgba(217,183,121,0.3)", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>
                      <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Add a stop
                    </button>
                    {addMenuOpen && !addSource && (
                      <div style={{ position: "absolute", left: 0, right: 0, top: 52, zIndex: 20, background: "rgba(14,32,22,0.97)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 14, padding: 6, backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.9)" }}>
                        {[["park", "◈", "National park"], ["statePark", "◆", "State park"], ["scenic", "⟿", "Scenic route"], ["lake", "≈", "Lake"], ["coord", "⌖", "Coordinates"], ["address", "⌂", "Address"], ["place", "✦", "Any place"]].map(([src, ic, label]) => (
                          <div key={src} onClick={() => setAddSource(src)} className="ts-menuitem" style={{ padding: "11px 13px", borderRadius: 9, color: "#f4f1ea", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 11 }}>
                            <span style={{ color: "#d9b779" }}>{ic}</span> {label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* inline add controls */}
                  {addSource === "park" && (
                    <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
                      <select value={addSel} onChange={(e) => setAddSel(e.target.value)} style={{ ...fieldBox, flex: 1, color: addSel ? "#1a2b21" : "var(--pb-muted)" }}>
                        <option value="">Choose a park…</option>
                        {parksDb.filter((p) => !stops.some((s) => s.name === p.name)).map((p) => <option key={p.id} value={p.name}>{p.name} — {p.state}</option>)}
                      </select>
                      <button onClick={() => { addPark(); setAddMenuOpen(false); setAddSource(null); }} style={addBtn}>＋</button>
                    </div>
                  )}
                  {addSource === "scenic" && (
                    <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
                      <select value={addBywaySel} onChange={(e) => setAddBywaySel(e.target.value)} style={{ ...fieldBox, flex: 1, color: addBywaySel ? "#1a2b21" : "var(--pb-muted)" }}>
                        <option value="">Choose a scenic drive…</option>
                        {[["all-american", "All-American Roads"], ["national-scenic-byway", "National Scenic Byways"], ["*", "Other scenic drives"]].map(([tier, label]) => {
                          const rows = bywaysDb.filter((b) => (tier === "*" ? !["all-american", "national-scenic-byway"].includes(b.tier) : b.tier === tier) && !stops.some((s) => s.name === b.name));
                          if (!rows.length) return null;
                          return <optgroup key={tier} label={label}>{rows.slice().sort((a, b) => a.name.localeCompare(b.name)).map((b) => <option key={b.id} value={b.id}>{b.name} — {b.states || b.state || ""}</option>)}</optgroup>;
                        })}
                      </select>
                      <button onClick={() => { addByway(); setAddMenuOpen(false); setAddSource(null); }} style={addBtn}>＋</button>
                    </div>
                  )}
                  {/* State park / Lake / Address / Any place — all resolve by geocoding a name. */}
                  {["statePark", "lake", "address", "place"].includes(addSource) && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", gap: 9 }}>
                        <input value={addrInput} onChange={(e) => setAddrInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addAddress(); }}
                          placeholder={{ statePark: "State park name…", lake: "Lake name…", address: "123 Main St, a town…", place: "'Zion Lodge', a landmark…" }[addSource]} style={{ ...fieldBox, flex: 1 }} />
                        <button onClick={addAddress} style={addBtn}>＋</button>
                      </div>
                      {addrMsg && <div style={{ fontSize: 12, color: "var(--pb-ink-2)", marginTop: 7 }}>{addrMsg}</div>}
                    </div>
                  )}
                  {addSource === "coord" && addCoords && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", gap: 9 }}>
                        <input value={coordInput || ""} onChange={(e) => setCoordInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCoords(); }} placeholder="37.29, -113.05" style={{ ...fieldBox, flex: 1 }} />
                        <button onClick={addCoords} style={addBtn}>＋</button>
                      </div>
                      {addrMsg && <div style={{ fontSize: 12, color: "var(--pb-ink-2)", marginTop: 7 }}>{addrMsg}</div>}
                    </div>
                  )}
                </div>

                {/* budget — full-width, itemized (matches the design) */}
                <div style={{ ...glass, marginTop: 14 }}>
                  <div style={kicker}>Budget</div>
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
                    {budgetLines.map(({ label, icon, tint, sub, k, show }) => (show === false ? null : (
                      <div key={k} className="ts-budrow" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", margin: "0 -8px", borderTop: "1px solid rgba(217,183,121,0.09)" }}>
                        <div style={{ width: 34, height: 34, flex: "none", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: tint, background: hexA(tint, 0.14), border: "1px solid " + hexA(tint, 0.3) }}><TSIcon name={icon} size={17} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: "#f4f1ea", lineHeight: 1.2 }}>{label}</div>
                          <div style={{ fontFamily: SANS, fontSize: 11, color: "#7f8a82", marginTop: 2 }}>{sub}</div>
                        </div>
                        <div style={{ flex: "none", fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: "#f4f1ea" }}><BudgetAmount k={k} /></div>
                      </div>
                    )))}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 15, paddingTop: 15, borderTop: "1px solid rgba(217,183,121,0.16)" }}>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#7f8a82" }}>Estimated total</div>
                      <div style={{ fontFamily: SANS, fontSize: 11.5, color: "#aab0ba", marginTop: 5 }}>≈ {fmtUsd(perPerson)} per person</div>
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 600, color: "#e8cf9a", lineHeight: 1 }}>{fmtUsd(totalCost)}</div>
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 11, fontStyle: "italic", color: "#7f8a82", marginTop: 10 }}>Tap any amount to enter your real price.</div>
                </div>

                {/* navigate & share — full-width, 6 links + Start Trip Mode */}
                <div style={{ ...glass, marginTop: 14 }}>
                  <div style={kicker}>Navigate &amp; share</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 14 }}>
                    <a href={gmapsUrl} target="_blank" rel="noreferrer" className="ts-navtile" style={navTile}><TSIcon name="pin" size={14} />Google Maps</a>
                    <a href={appleUrl} target="_blank" rel="noreferrer" className="ts-navtile" style={navTile}><TSIcon name="apple" size={14} />Apple Maps</a>
                    <a href={waUrl} target="_blank" rel="noreferrer" className="ts-navtile" style={navTile}><TSIcon name="chat" size={14} />WhatsApp</a>
                    <button onClick={copyLink} className="ts-navtile" style={{ ...navTile, cursor: "pointer" }}><TSIcon name="link" size={14} />Copy link</button>
                    <a href="/trip-print" className="ts-navtile" style={navTile}><TSIcon name="printer" size={14} />Print / PDF</a>
                    <a href="/trip-book" className="ts-navtile" style={navTile}><TSIcon name="book" size={14} />Trip Book</a>
                  </div>
                  <a href="/trip-mode" className="ts-goldbtn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", width: "100%", marginTop: 12, padding: 13, borderRadius: 13, border: "none", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 13.5, boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>
                    <span style={{ display: "inline-flex", width: 8, height: 8, borderRadius: "50%", border: "2px solid #0a1712" }} />Start Trip Mode
                  </a>
                </div>

                {/* reservations & tracking */}
                <div style={{ ...glass, marginTop: 14 }}>
                  <div style={kicker}>Reservations &amp; tracking</div>
                  <div style={{ marginTop: 14, border: "1px dashed rgba(217,183,121,0.4)", borderRadius: 13, padding: "18px 16px", textAlign: "center", background: "rgba(8,19,13,0.5)" }}>
                    <div style={{ display: "flex", justifyContent: "center", color: "#c9a35f", marginBottom: 8 }}><TSIcon name="fileup" size={24} /></div>
                    <div style={{ fontSize: 12.5, color: "#aab0ba", lineHeight: 1.5 }}>Already booked? Drop your rental-car reservation PDF and we&apos;ll auto-fill the car, dates &amp; price.</div>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#c9a35f", marginTop: 8 }}>Coming soon</div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
                    {["Confirmations", "Weather alerts", "Check-in reminders"].map((c) => (
                      <span key={c} style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", padding: "5px 11px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.16)", color: "#7f8a82" }}>{c}</span>
                    ))}
                  </div>
                </div>

                {/* add my trip → My trips */}
                {addMyTrip && (
                  <button onClick={addMyTrip} className="ts-goldbtn" style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 13, border: "none", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>+ Add my trip</button>
                )}
              </div>
            )}

            {mode === "premade" && (
              <div>
                <div style={{ ...kicker, marginBottom: 16 }}>Ready-made routes · tap to load</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {routes.map((r, i) => (
                    <div key={r.id} onClick={() => loadRoute(r)} className="ts-hoverline" style={{ display: "flex", gap: 14, background: loadedRoute === r.id ? "rgba(14,32,22,0.8)" : "rgba(14,32,22,0.5)", border: "1px solid " + (loadedRoute === r.id ? "rgba(217,183,121,0.45)" : "rgba(217,183,121,0.16)"), borderRadius: 16, padding: 14, backdropFilter: "blur(10px)", cursor: "pointer" }}>
                      <div style={{ width: 96, height: 82, flex: "none", borderRadius: 12, position: "relative", overflow: "hidden", border: "1px solid rgba(217,183,121,0.18)", background: THUMBS[i % THUMBS.length] }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(217,183,121,0.14) 0 2px, transparent 2px 9px)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: "#f4f1ea", lineHeight: 1.1 }}>{r.emoji} {r.name}</div>
                        <div style={{ fontSize: 11.5, color: "#aab0ba", marginTop: 5, lineHeight: 1.4 }}>{r.desc}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                          {[r.stops.length + " stops", r.days + " days", r.miles + " mi"].map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{t}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === "mine" && (
              <div>
                <div style={{ ...kicker, marginBottom: 16 }}>My trips · tap to reload</div>
                {!savedTrips.length && <div style={{ border: "1px dashed rgba(217,183,121,0.3)", borderRadius: 16, padding: 18, color: "#aab0ba", fontSize: 13, lineHeight: 1.55 }}><b style={{ fontFamily: SERIF, color: "#f4f1ea", fontSize: 16, display: "block", marginBottom: 5 }}>No saved trips yet</b>Build a trip under <b style={{ color: "#e8cf9a" }}>New trip</b>, then hit Save trip.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {savedTrips.map((t, i) => {
                    const n = (t.stops || []).length;
                    const nights = (t.stops || []).reduce((a, s) => a + (Number(s.nights) || 0), 0);
                    return (
                      <div key={t.id} onClick={() => loadSavedTrip(t)} className="ts-hoverline" style={{ display: "flex", gap: 14, alignItems: "center", position: "relative", background: "rgba(14,32,22,0.5)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 16, padding: 14, backdropFilter: "blur(10px)", cursor: "pointer" }}>
                        <button onClick={(e) => { e.stopPropagation(); deleteSavedTrip(t.id); }} title="Delete" style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(9,20,14,0.8)", color: "#b06a4a", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
                        <div style={{ width: 96, height: 82, flex: "none", borderRadius: 12, position: "relative", overflow: "hidden", border: "1px solid rgba(217,183,121,0.18)", background: THUMBS[i % THUMBS.length] }}>
                          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(217,183,121,0.14) 0 2px, transparent 2px 9px)" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: "#f4f1ea", lineHeight: 1.1, paddingRight: 24 }}>{t.name}</div>
                          <div style={{ fontSize: 11.5, color: "#aab0ba", marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n ? (t.stops || []).slice(0, 4).map((s) => s.name).join(" · ") : "No stops"}</div>
                          <span style={{ display: "inline-block", fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, marginTop: 10, background: "rgba(143,214,166,0.12)", color: "#8fd6a6" }}>{n} stop{n === 1 ? "" : "s"} · {nights} night{nights === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* mobile: search-first add-a-stop popup (spec §7a) */}
      {mobileAddOpen && (
        <MobileAddPopup
          onClose={() => setMobileAddOpen(false)}
          stops={stops} dayRanges={dayRanges}
          parksDb={parksDb} bywaysDb={bywaysDb}
          addActivity={addActivity}
          addrInput={addrInput} setAddrInput={setAddrInput} addAddress={addAddress}
          coordInput={coordInput} setCoordInput={setCoordInput} addCoords={addCoords}
          addrMsg={addrMsg} fieldBox={fieldBox}
        />
      )}
    </div>
  );
}

// "+ Add to this day" — pick an activity type (the same 8 sources), name it, time it.
const DAY_ACT_TYPES = [["park", "◈", "National park"], ["statePark", "◆", "State park"], ["scenic", "⟿", "Scenic route"], ["lake", "≈", "Lake"], ["hike", "🥾", "Hike"], ["viewpoint", "🔭", "Viewpoint"], ["coord", "⌖", "Coordinates"], ["place", "✦", "Any place"]];
function DayPlanAdd({ onAdd, fieldBox }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("hike");
  const [name, setName] = useState("");
  const [time, setTime] = useState("09:00");
  const cur = DAY_ACT_TYPES.find((t) => t[0] === type) || DAY_ACT_TYPES[0];
  function commit() {
    const nm = name.trim(); if (!nm) return;
    onAdd({ icon: cur[1], type, name: nm, time });
    setName(""); setOpen(false);
  }
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ marginTop: 2, alignSelf: "flex-start", padding: "7px 12px", borderRadius: 9, border: "1px dashed rgba(217,183,121,0.35)", background: "rgba(255,255,255,.03)", color: "#c9a35f", fontFamily: SANS, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>+ Add to this day</button>
  );
  return (
    <div style={{ marginTop: 2, padding: 10, borderRadius: 11, border: "1px solid rgba(217,183,121,0.18)", background: "rgba(255,255,255,.02)" }}>
      <div style={{ display: "flex", gap: 7 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...fieldBox, flex: 1, color: "#1a2b21" }}>
          {DAY_ACT_TYPES.map(([v, ic, label]) => <option key={v} value={v}>{ic}  {label}</option>)}
        </select>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...fieldBox, width: 104, flex: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} placeholder="What's the plan?" style={{ ...fieldBox, flex: 1 }} />
        <button onClick={commit} style={addBtn}>＋</button>
      </div>
    </div>
  );
}

// Mobile add-a-stop popup (spec §7a): search → filter chips → "add to Day · time"
// → suggested rows (one tap logs a timed activity on the chosen day) → precise entry.
const ADD_FILTERS = [["all", "All"], ["park", "Parks"], ["statePark", "State"], ["forest", "Forest"], ["scenic", "Scenic"], ["lake", "Lake"]];
const TYPE_DOT = { park: "#8fd6a6", statePark: "#9ecbe8", forest: "#c9a35f", scenic: "#e8cf9a", lake: "#7fd2d6" };
function MobileAddPopup({ onClose, stops, dayRanges, parksDb, bywaysDb, addActivity, addrInput, setAddrInput, addAddress, coordInput, setCoordInput, addCoords, addrMsg, fieldBox }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState("09:00");
  const [precise, setPrecise] = useState(null); // "coord" | "address" | "pin" | null
  const [added, setAdded] = useState("");

  // Suggestion pool from our real datasets: parks + scenic drives.
  const pool = [
    ...(parksDb || []).map((p) => ({ name: p.name, type: "park", icon: "◈", region: p.state, cat: "National park" })),
    ...(bywaysDb || []).map((b) => ({ name: b.name, type: "scenic", icon: "⟿", region: b.states || b.state || "", cat: "Scenic route" })),
  ];
  const ql = q.trim().toLowerCase();
  const results = pool
    .filter((r) => (filter === "all" || r.type === filter))
    .filter((r) => !ql || r.name.toLowerCase().includes(ql) || (r.region || "").toLowerCase().includes(ql))
    .filter((r) => !stops.some((s) => s.name === r.name && false)) // keep dupes visible; day-activities can repeat
    .slice(0, 14);

  const day = stops[dayIdx];
  function pick(r) {
    if (!day) { setAdded("Add a stop first — use precise entry below."); return; }
    addActivity(day.name, { icon: r.icon, type: r.type, name: r.name, time });
    setAdded(r.name + " → " + day.name + " · " + time);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(4,9,7,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -30px 80px -20px rgba(0,0,0,0.9)" }}>
        {/* header */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: "#f4f1ea" }}>Add a stop</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 15, cursor: "pointer" }}>✕</button>
        </div>
        {/* search */}
        <div style={{ flex: "none", padding: "0 18px" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search parks, towns, trails, byways…" style={{ ...fieldBox, width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 14 }} />
        </div>
        {/* filter chips */}
        <div style={{ flex: "none", display: "flex", gap: 7, padding: "12px 18px 6px", overflowX: "auto" }}>
          {ADD_FILTERS.map(([k, label]) => {
            const on = filter === k;
            return <button key={k} onClick={() => setFilter(k)} style={{ flex: "none", cursor: "pointer", fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 999, border: "1px solid " + (on ? "transparent" : "rgba(217,183,121,0.22)"), color: on ? "#0a1712" : "#aab0ba", background: on ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "transparent" }}>{label}</button>;
          })}
        </div>
        {/* add-to bar */}
        <div style={{ flex: "none", display: "flex", gap: 8, alignItems: "center", padding: "8px 18px 10px", borderBottom: "1px solid rgba(217,183,121,0.12)" }}>
          <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82", flex: "none" }}>Add to</span>
          <select value={dayIdx} onChange={(e) => setDayIdx(+e.target.value)} style={{ ...fieldBox, flex: 1, minWidth: 0 }}>
            {stops.length === 0 && <option value={0}>No days yet</option>}
            {stops.map((s, i) => <option key={s.name} value={i}>{(dayRanges[i] ? dayRanges[i].label : "Day " + (i + 1)) + " · " + s.name}</option>)}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...fieldBox, width: 100, flex: "none" }} />
        </div>
        {/* results */}
        <div className="ts-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 18px" }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".16em", textTransform: "uppercase", color: "#7f8a82", margin: "2px 0 8px" }}>{ql ? "Matches" : "Suggested near your route"}</div>
          {results.length === 0 && <div style={{ fontFamily: SANS, fontSize: 13, color: "#7f8a82", padding: "6px 0 12px", lineHeight: 1.5 }}>No matches in this category — try the precise entry below.</div>}
          {results.map((r, i) => (
            <div key={r.type + r.name + i} onClick={() => pick(r)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 4px", borderBottom: "1px solid rgba(217,183,121,0.08)", cursor: "pointer" }}>
              <span style={{ width: 9, height: 9, flex: "none", borderRadius: "50%", background: TYPE_DOT[r.type] || "#c9a35f", boxShadow: "0 0 8px " + (TYPE_DOT[r.type] || "#c9a35f") }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 16, color: "#f4f1ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", color: "#7f8a82", marginTop: 2 }}>{r.cat}{r.region ? " · " + r.region : ""}</div>
              </div>
              <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontSize: 18, fontWeight: 700 }}>+</span>
            </div>
          ))}
        </div>
        {/* precise entry footer */}
        <div style={{ flex: "none", padding: "10px 18px 18px", borderTop: "1px solid rgba(217,183,121,0.12)", background: "rgba(6,14,10,0.6)" }}>
          {added && <div style={{ fontFamily: SANS, fontSize: 12, color: "#8fd6a6", marginBottom: 9 }}>Added {added}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            {[["coord", "⌖ Coordinates"], ["address", "⌂ Address"], ["pin", "✦ Pin"]].map(([k, label]) => (
              <button key={k} onClick={() => setPrecise(precise === k ? null : k)} style={{ flex: 1, cursor: "pointer", fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: "9px 6px", borderRadius: 10, border: "1px solid " + (precise === k ? "rgba(217,183,121,0.5)" : "rgba(217,183,121,0.2)"), background: precise === k ? "rgba(217,183,121,0.12)" : "rgba(255,255,255,.03)", color: precise === k ? "#e8cf9a" : "#aab0ba" }}>{label}</button>
            ))}
          </div>
          {precise === "coord" && (
            <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
              <input value={coordInput || ""} onChange={(e) => setCoordInput(e.target.value)} placeholder="37.29, -113.05" style={{ ...fieldBox, flex: 1 }} />
              <button onClick={() => { addCoords(); onClose(); }} style={{ ...addBtn, width: 120, fontSize: 12, fontWeight: 700, fontFamily: SANS }}>+ Add these</button>
            </div>
          )}
          {(precise === "address" || precise === "pin") && (
            <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
              <input value={addrInput} onChange={(e) => setAddrInput(e.target.value)} placeholder={precise === "pin" ? "'Zion Lodge', a landmark…" : "123 Main St, a town…"} style={{ ...fieldBox, flex: 1 }} />
              <button onClick={() => { addAddress(); onClose(); }} style={{ ...addBtn, width: 120, fontSize: 12, fontWeight: 700, fontFamily: SANS }}>+ Add this</button>
            </div>
          )}
          {precise && addrMsg && <div style={{ fontSize: 12, color: "#aab0ba", marginTop: 7 }}>{addrMsg}</div>}
        </div>
      </div>
    </div>
  );
}

const addBtn = { width: 46, flex: "none", border: "none", borderRadius: 12, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", fontSize: "1.15rem", cursor: "pointer", fontWeight: 700 };
const stepBtn = { width: 22, height: 22, flex: "none", borderRadius: 7, border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 13, lineHeight: 1, cursor: "pointer", fontFamily: SANS };
const navMini = { flex: 1, textAlign: "center", textDecoration: "none", padding: "8px 4px", borderRadius: 9, border: "1px solid rgba(217,183,121,0.16)", background: "rgba(255,255,255,.03)", color: "#aab0ba", fontFamily: SANS, fontSize: 10.5, fontWeight: 600 };
