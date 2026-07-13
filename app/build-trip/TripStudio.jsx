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
    case "route": return <svg {...p}><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></svg>;
    case "hike": return <svg {...p}><path d="m8 2 1.5 3.5L8 9l2.5 2 1.5 5" /><circle cx="9" cy="4" r="1" /><path d="M13 8.5 15 11l4 2" /><path d="M4 22l3-7" /><path d="M14 22l-2-6" /></svg>;
    case "camera": return <svg {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></svg>;
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
    mode, setMode, onNewTrip, editing,
    stat, statNum, tripName, setTripName,
    stops, dayRanges, verdicts, STOP_STATUS,
    onDragStart, onDragOver, onDrop, removeStop, setStopNights, addMyTrip, hoverIdx, setHoverIdx,
    expandedStop, toggleDayPlan, dayPlans, addActivity, removeActivity,
    addSource, setAddSource, addMenuOpen, setAddMenuOpen,
    parksDb, addSel, setAddSel, addPark,
    bywaysDb, addBywaySel, setAddBywaySel, addByway,
    addrInput, setAddrInput, addAddress, addrMsg, addDestination,
    coordInput, setCoordInput, addCoords,
    setupCollapsed, setSetupCollapsed, setupRows, onEditSetup, onSaveTrip, saveMsg, showOnMap, setShowOnMap,
    budgetOpen, setBudgetOpen, budgetLines, BudgetAmount, totalCost, perPerson, fmtUsd,
    routes, loadedRoute, loadRoute, insertRouteAt, cloneRoute, previewRoute, setPreviewRoute, bywayDetail, insertScenicDrive,
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
  // Switching rail tabs exits any open route preview.
  const switchMode = (id) => { if (setPreviewRoute) setPreviewRoute(null); setPickTrip(false); setMode(id); };

  // Mobile: the map becomes a pull-up bottom sheet + the "+ Add a stop" button
  // opens a search-first popup (spec §7 / §7a). Detected client-side to keep SSR stable.
  const [isMobile, setIsMobile] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null); // ready-made route awaiting an insertion point
  const [scenicAdd, setScenicAdd] = useState(null); // scenic drive awaiting drag/click placement into the trip
  const [scenicExpanded, setScenicExpanded] = useState(false); // add ALL waypoints (vs start & end) to Plan this day
  const [scenicDropPos, setScenicDropPos] = useState(null); // gap index currently under the dragged drive tile
  const [scenicDragging, setScenicDragging] = useState(false);
  const [viewRoute, setViewRoute] = useState(null); // ready-made route open in read-only view
  const [pickTrip, setPickTrip] = useState(false); // show the My-trips picklist inside the view popup
  const [confirmDelete, setConfirmDelete] = useState(null); // saved trip pending a delete confirmation
  const [viewSaved, setViewSaved] = useState(null); // saved trip open in read-only preview
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
              <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 22, color: "#f4f1ea", letterSpacing: ".01em" }}>Trip Studio</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".26em", textTransform: "uppercase", color: "#7f8a82", marginTop: 3 }}>Park Buddy</div>
            </div>
          </div>

          <div style={{ display: "flex", padding: 5, gap: 4, background: "rgba(8,19,13,0.7)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 999, ...(isMobile ? { order: 3, flex: "1 1 100%", justifyContent: "center" } : { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }) }} className="ts-switcher">
            <ModeBtn id="new" label="Edit trip" mode={previewRoute ? "" : mode} setMode={switchMode} />
            <ModeBtn id="premade" label="Ready-made routes" mode={previewRoute ? "" : mode} setMode={switchMode} />
            <ModeBtn id="mine" label={"My trips" + (savedTrips.length ? " · " + savedTrips.length : "")} mode={previewRoute ? "" : mode} setMode={switchMode} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", color: "#8fd6a6", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8fd6a6", boxShadow: "0 0 10px #8fd6a6" }} />LIVE
            </div>
            <button onClick={onNewTrip} title="Start a fresh trip — answer the quick setup" className="ts-goldbtn" style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "#e8cf9a", background: "rgba(255,255,255,.04)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 999, padding: "8px 15px" }}>＋ Add a new trip</button>
            <div title="Account" style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "radial-gradient(circle at 30% 30%, #16281d, #0b1710)" }} />
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

            {/* map stays locked until a trip exists — on any rail tab (not while previewing a route) */}
            {!editing && !stops.length && !previewRoute && (
              <div style={{ position: "absolute", inset: 0, zIndex: 12, background: "rgba(6,13,10,0.72)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
                <div style={{ display: "inline-flex", width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", color: "#c9a35f", background: "rgba(217,183,121,0.1)", border: "1px solid rgba(217,183,121,0.28)", marginBottom: 14 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: "#f4f1ea" }}>Your map appears here</div>
                <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#aab0ba", marginTop: 6, maxWidth: 280, lineHeight: 1.5 }}>Add a trip to plot your route, stops and live conditions.</div>
              </div>
            )}

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
                  <div style={{ flex: "1 1 220px", minWidth: 160 }}>
                    <GeoAutocomplete
                      placeholder="Search a park, town or address…"
                      onType={(v) => setBrowseQuery && setBrowseQuery(v)}
                      onPick={(s) => { addDestination && addDestination({ name: s.name, state: s.state, lat: s.lat, lng: s.lng, custom: true }); setBrowseQuery && setBrowseQuery(""); }}
                      inputStyle={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 11, border: "1px solid rgba(217,183,121,0.22)", background: "rgba(8,19,13,0.7)", color: "#f4f1ea", fontFamily: SANS, fontSize: 13, outline: "none" }}
                      fieldBox={fieldBox}
                    />
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
                    <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 500, color: i === 3 ? "#e8cf9a" : "#f4f1ea", lineHeight: 1 }}><CountUp value={s.num} format={s.fmt} /></div>
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

            {/* PREVIEW MODE — SCENIC BYWAY: a single All-American Road shown read-only on the map + details here */}
            {previewRoute && previewRoute.__byway && (() => {
              const via = Array.isArray(previewRoute.endpoints?.via) ? previewRoute.endpoints.via : [];
              const legs = [
                previewRoute.endpoints?.from && { label: previewRoute.endpoints.from, role: "Start" },
                ...via.map((v) => ({ label: v, role: "Along the way" })),
                previewRoute.endpoints?.to && { label: previewRoute.endpoints.to, role: "End" },
              ].filter(Boolean);
              const lenChip = previewRoute.length || (previewRoute.lengthMi ? previewRoute.lengthMi + " mi" : "");
              // Full named itinerary from the enriched record (every stop down the road),
              // when it's loaded for THIS drive; otherwise the minimal from → via → to.
              const detail = bywayDetail && bywayDetail.id === previewRoute.id ? bywayDetail : null;
              const itin = detail ? (detail.itinerary || []).filter((s) => s && s.place) : [];
              const KIND = { terminus: "Start / End", "park-entrance": "Park entrance", crossing: "Crossing", overlook: "Overlook", town: "Town" };
              return (
                <div>
                  <button onClick={() => { setPreviewRoute(null); setPickTrip(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7f8a82", fontFamily: SANS, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Back to ready-made routes</button>
                  <div style={{ ...glass }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#c9a35f" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c9a35f" }} />Read-only preview · Scenic route</span>
                    <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 500, color: "#f4f1ea", marginTop: 8, lineHeight: 1.15 }}>{previewRoute.name}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {["ALL-AMERICAN ROAD", previewRoute.states, lenChip].filter(Boolean).map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{t}</span>)}
                    </div>
                    {previewRoute.blurb && <div style={{ fontFamily: SANS, fontSize: 13, color: "#aab0ba", marginTop: 12, lineHeight: 1.55 }}>{previewRoute.blurb}</div>}
                  </div>
                  {itin.length >= 2 ? (
                    <div style={{ ...glass, marginTop: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                        <div style={kicker}>The drive · every stop</div>
                        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", color: "#7f8a82" }}>{itin.length} STOPS</span>
                      </div>
                      <div style={{ marginTop: 12, position: "relative" }}>
                        <div style={{ position: "absolute", left: 13, top: 10, bottom: 10, width: 2, background: "linear-gradient(180deg,rgba(217,183,121,0.5),rgba(217,183,121,0.1))" }} />
                        {itin.map((s, idx) => (
                          <div key={idx} style={{ position: "relative", display: "grid", gridTemplateColumns: "28px 1fr", gap: 12, alignItems: "start", padding: "9px 0" }}>
                            <span style={{ position: "relative", zIndex: 1, width: 28, height: 28, flex: "none", borderRadius: "50%", background: s.kind === "park-entrance" ? "#1d4a37" : "#e8cf9a", border: "2px solid #0a1712", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, fontWeight: 800, color: s.kind === "park-entrance" ? "#e8cf9a" : "#0a1712" }}>{s.seq}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: SERIF, fontSize: 16.5, color: "#f4f1ea", lineHeight: 1.2 }}>{s.place}</span>
                                {s.mileFromStart != null && <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".05em", color: "#d9b779", border: "1px solid rgba(217,183,121,0.25)", borderRadius: 999, padding: "1px 7px" }}>MI {s.mileFromStart.toFixed(1)}</span>}
                                {KIND[s.kind] && <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#7f8a82" }}>{KIND[s.kind]}</span>}
                              </div>
                              {s.note && <div style={{ fontFamily: SANS, fontSize: 12, color: "#aab0ba", lineHeight: 1.45, marginTop: 3 }}>{s.note}</div>}
                              {s.toNextMi != null && idx < itin.length - 1 && <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", color: "#7f8a82", marginTop: 5 }}>↓ {s.toNextMi.toFixed(1)} mi to next</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : legs.length > 0 && (
                    <div style={{ ...glass, marginTop: 14 }}>
                      <div style={kicker}>The drive</div>
                      <div style={{ marginTop: 12 }}>
                        {legs.map((leg, idx) => (
                          <div key={leg.label + idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: idx ? "1px solid rgba(217,183,121,0.08)" : "none" }}>
                            <span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", border: "1px solid rgba(217,183,121,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 12, color: "#e8cf9a" }}>{idx + 1}</span>
                            <span style={{ fontFamily: SERIF, fontSize: 17, color: "#f4f1ea" }}>{leg.label}</span>
                            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, color: "#7f8a82", textTransform: "uppercase", letterSpacing: ".08em" }}>{leg.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const openScenicAdd = () => {
                      const b = previewRoute, d = bywayDetail && bywayDetail.id === previewRoute.id ? bywayDetail : null;
                      setScenicExpanded(false); setScenicDropPos(null); setScenicDragging(false);
                      setScenicAdd({ drive: { id: b.id, name: b.name, states: b.states, lat: b.lat, lng: b.lng, endpoints: b.endpoints, lengthMi: b.lengthMi, length: b.length }, detail: d });
                    };
                    return (
                      <div style={{ ...glass, marginTop: 14 }}>
                        {!pickTrip ? (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <button onClick={() => setPickTrip(true)} className="ts-goldbtn" style={{ padding: 13, borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5 }}>Add to a trip</button>
                            <a href={"/scenic-drives/" + previewRoute.id} className="ts-navtile" style={{ ...navTile, justifyContent: "center", textDecoration: "none" }}>View full drive →</a>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82", marginBottom: 8 }}>Add this drive to which trip?</div>
                            {stops.length > 0 && (
                              <button onClick={() => { setPickTrip(false); openScenicAdd(); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "space-between", marginBottom: 8 }}><span>{tripName || "Current trip"}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: "#8fd6a6" }}>ON CANVAS · {stops.length} STOP{stops.length === 1 ? "" : "S"}</span></button>
                            )}
                            {savedTrips.filter((t) => t.name !== tripName || !stops.length).map((t) => (
                              <button key={t.id} onClick={() => { setPickTrip(false); loadSavedTrip(t); openScenicAdd(); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "space-between", marginBottom: 8 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: "#7f8a82" }}>{(t.stops || []).length} stops</span></button>
                            ))}
                            {!savedTrips.length && !stops.length && <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#7f8a82", padding: "4px 0 10px", lineHeight: 1.5 }}>No trips yet — add a new trip first, then drop this drive in.</div>}
                            <button onClick={() => setPickTrip(false)} style={{ marginTop: 4, background: "none", border: "none", color: "#7f8a82", fontFamily: SANS, fontSize: 12, cursor: "pointer" }}>← Back</button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* PREVIEW MODE — a ready-made route shown read-only on the map (left) + details here */}
            {previewRoute && !previewRoute.__byway && (
              <div>
                <button onClick={() => { setPreviewRoute(null); setPickTrip(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7f8a82", fontFamily: SANS, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Back to ready-made routes</button>
                <div style={{ ...glass }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#7f8a82" }} />Read-only preview</span>
                  <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 500, color: "#f4f1ea", marginTop: 8, lineHeight: 1.1 }}>{previewRoute.emoji} {previewRoute.name}</div>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: "#aab0ba", marginTop: 6, lineHeight: 1.5 }}>{previewRoute.desc}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {[previewRoute.stops.length + " stops", previewRoute.days + " days", previewRoute.miles + " mi"].map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{t}</span>)}
                  </div>
                </div>
                <div style={{ ...glass, marginTop: 14 }}>
                  <div style={kicker}>The route</div>
                  <div style={{ marginTop: 12 }}>
                    {previewRoute.stops.map((name, idx) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: idx ? "1px solid rgba(217,183,121,0.08)" : "none" }}>
                        <span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", border: "1px solid rgba(217,183,121,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 12, color: "#e8cf9a" }}>{idx + 1}</span>
                        <span style={{ fontFamily: SERIF, fontSize: 17, color: "#f4f1ea" }}>{name}</span>
                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, color: "#7f8a82" }}>{previewRoute.nights[idx]} night{previewRoute.nights[idx] === 1 ? "" : "s"}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ ...glass, marginTop: 14 }}>
                  {!pickTrip ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button onClick={() => { const r = previewRoute; setPreviewRoute(null); cloneRoute(r); }} className="ts-goldbtn" style={{ padding: 13, borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5 }}>Clone as a new trip</button>
                      <button onClick={() => setPickTrip(true)} className="ts-navtile" style={{ ...navTile, justifyContent: "center" }}>Add to an existing trip</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82", marginBottom: 8 }}>Add to which trip?</div>
                      {editing && stops.length > 0 && (
                        <button onClick={() => { const r = previewRoute; setPreviewRoute(null); setPickTrip(false); setPendingRoute(r); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "space-between", marginBottom: 8 }}><span>{tripName || "Current trip"}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: "#8fd6a6" }}>EDITING NOW</span></button>
                      )}
                      {savedTrips.filter((t) => !(editing && t.name === tripName)).map((t) => (
                        <button key={t.id} onClick={() => { const r = previewRoute; setPreviewRoute(null); setPickTrip(false); loadSavedTrip(t); setPendingRoute(r); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "space-between", marginBottom: 8 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: "#7f8a82" }}>{(t.stops || []).length} stops</span></button>
                      ))}
                      {!savedTrips.length && !(editing && stops.length) && <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#7f8a82", padding: "4px 0 10px", lineHeight: 1.5 }}>No trips yet — clone this one to start.</div>}
                      <button onClick={() => setPickTrip(false)} style={{ marginTop: 4, background: "none", border: "none", color: "#7f8a82", fontFamily: SANS, fontSize: 12, cursor: "pointer" }}>← Back</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!previewRoute && mode === "new" && !editing && !stops.length && (
              <div style={{ ...glass, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ display: "inline-flex", width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", color: "#c9a35f", background: "rgba(217,183,121,0.1)", border: "1px solid rgba(217,183,121,0.28)", marginBottom: 16 }}><TSIcon name="pin" size={24} /></div>
                <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: "#f4f1ea" }}>No trip yet</div>
                <div style={{ fontFamily: SANS, fontSize: 13.5, color: "#aab0ba", lineHeight: 1.6, margin: "10px auto 22px", maxWidth: 320 }}>Add a new trip and answer a few quick questions, or pick one you&apos;ve saved or a ready-made itinerary.</div>
                <button onClick={onNewTrip} className="ts-goldbtn" style={{ width: "100%", padding: 13, borderRadius: 13, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 13.5, boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>＋ Add a new trip</button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 10 }}>
                  <button onClick={() => setMode("mine")} className="ts-navtile" style={navTile}>My trips{savedTrips.length ? " · " + savedTrips.length : ""}</button>
                  <button onClick={() => setMode("premade")} className="ts-navtile" style={navTile}>Ready-made routes</button>
                </div>
              </div>
            )}

            {!previewRoute && mode === "new" && (editing || stops.length > 0) && (
              <div>
                {/* trip header — editable name + count-up stat bar + setup button */}
                <div style={{ ...glass, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={kicker}>Trip name</div>
                    {editing && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#8fd6a6", background: "rgba(143,214,166,0.1)", border: "1px solid rgba(143,214,166,0.3)", borderRadius: 999, padding: "4px 10px" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#8fd6a6", boxShadow: "0 0 6px #8fd6a6" }} />Edit mode · saved
                      </span>
                    )}
                  </div>
                  <input value={tripName || ""} onChange={(e) => setTripName && setTripName(e.target.value)} placeholder="Name your trip"
                    style={{ width: "100%", marginTop: 6, background: "transparent", border: "none", borderBottom: "1px dashed rgba(217,183,121,0.35)", color: "#f4f1ea", fontFamily: SERIF, fontSize: 26, fontWeight: 500, outline: "none", padding: "2px 0 6px", boxSizing: "border-box" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 14 }}>
                    {stat4.map((s, i) => (
                      <div key={s.label} style={{ background: "rgba(8,19,13,0.6)", border: "1px solid rgba(217,183,121,0.12)", borderRadius: 11, padding: "10px 6px", textAlign: "center", minWidth: 0 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: i === 3 ? "#e8cf9a" : "#f4f1ea", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis" }}><CountUp value={s.num} format={s.fmt} /></div>
                        <div style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8a82", marginTop: 6 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={onEditSetup} className="ts-goldbtn" style={{ width: "100%", marginTop: 14, padding: 11, borderRadius: 11, border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontFamily: SANS, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>◈ Edit your trip</button>
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
                            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: "#f4f1ea", lineHeight: 1.15, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
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
                          {/* Plan your days — the stop is a BASE; each night it anchors
                              becomes its own day bucket of typed blocks. */}
                          {toggleDayPlan && (() => {
                            const all = (dayPlans && dayPlans[s.name]) || [];
                            const open = expandedStop === s.name;
                            const dayCount = Math.max(1, s.nights || 1);
                            const arriveISO = dayRanges[i] && dayRanges[i].arrive;
                            const globalStart = stops.slice(0, i).reduce((a, x) => a + Math.max(1, x.nights || 1), 0) + 1;
                            const dateFor = (d) => { if (!arriveISO) return ""; const dt = new Date(arriveISO + "T12:00:00"); dt.setDate(dt.getDate() + d); return dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); };
                            const sortByTime = (list) => list.slice().sort((x, y) => (x.time || "~").localeCompare(y.time || "~"));
                            return (
                              <div style={{ marginTop: 10, borderTop: "1px solid rgba(217,183,121,0.12)", paddingTop: 9 }}>
                                <button onClick={(e) => { e.stopPropagation(); toggleDayPlan(s.name); }} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: open ? "#e8cf9a" : "#8f9a90" }}>
                                  <span style={{ display: "inline-block", transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>▸</span>
                                  Plan your days{all.length ? " · " + all.length + " planned" : ""}
                                </button>
                                {open && (
                                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".08em", textTransform: "uppercase", color: "#8fd6a6", background: "rgba(143,214,166,0.1)", border: "1px solid rgba(143,214,166,0.3)", borderRadius: 999, padding: "3px 9px" }}>
                                      <TSIcon name="bed" size={11} />Base · {s.name} · {dayCount} day{dayCount === 1 ? "" : "s"}
                                    </div>
                                    {Array.from({ length: dayCount }).map((_, d) => {
                                      const acts = sortByTime(all.filter((a) => (a.day || 0) === d));
                                      return (
                                        <div key={d} style={{ borderRadius: 11, border: "1px solid rgba(217,183,121,0.12)", background: "rgba(255,255,255,.02)", padding: "9px 11px" }}>
                                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: acts.length ? 8 : 4 }}>
                                            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#c9a35f" }}>Day {globalStart + d}</span>
                                            <span style={{ fontFamily: SANS, fontSize: 11, color: "#8f9a90" }}>{dateFor(d)}</span>
                                          </div>
                                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {acts.length === 0 && <div style={{ fontFamily: SANS, fontSize: 11.5, color: "#7f8a82", padding: "1px 0 3px" }}>Nothing planned yet.</div>}
                                            {acts.map((a) => (
                                              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,0.12)" }}>
                                                <span style={{ fontFamily: MONO, fontSize: 10, color: "#c9a35f", minWidth: 38 }}>{a.time || "—"}</span>
                                                <span style={{ color: "#e0b978", display: "inline-flex", flex: "none" }}>{a.type ? <TSIcon name={blockIcon(a.type)} size={15} /> : <span style={{ fontSize: 14 }}>{a.icon}</span>}</span>
                                                <span style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: 12.5, color: "#f4f1ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}<span style={{ color: "#7f8a82", fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", marginLeft: 7, textTransform: "uppercase" }}>{TYPE_LABEL[a.type] || ""}</span></span>
                                                <span onClick={() => removeActivity(s.name, a.id)} title="Remove" style={{ cursor: "pointer", color: "#b06a4a", fontSize: 13, lineHeight: 1, opacity: 0.55 }}>×</span>
                                              </div>
                                            ))}
                                            <DayPlanAdd onAdd={(act) => addActivity(s.name, { ...act, day: d })} fieldBox={fieldBox} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>

                  {/* add a stop — opens a popup (never clipped by the scrolling rail) */}
                  <div style={{ marginTop: 14 }}>
                    <button onClick={() => { if (isMobile) { setMobileAddOpen(true); } else { setAddSource(null); setAddMenuOpen(true); } }} className="ts-goldbtn" style={{ width: "100%", padding: 13, borderRadius: 13, border: "1px solid rgba(217,183,121,0.3)", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>
                      <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Add a stop
                    </button>
                  </div>
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
                        <div style={{ flex: "none", fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: "#f4f1ea" }}><BudgetAmount k={k} /></div>
                      </div>
                    )))}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 15, paddingTop: 15, borderTop: "1px solid rgba(217,183,121,0.16)" }}>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#7f8a82" }}>Estimated total</div>
                      <div style={{ fontFamily: SANS, fontSize: 11.5, color: "#aab0ba", marginTop: 5 }}>≈ {fmtUsd(perPerson)} per person</div>
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 500, color: "#e8cf9a", lineHeight: 1 }}>{fmtUsd(totalCost)}</div>
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

            {!previewRoute && mode === "premade" && (
              <div>
                <div style={{ ...kicker, marginBottom: 16 }}>Ready-made routes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {routes.map((r, i) => (
                    <div key={r.id} className="ts-hoverline" style={{ display: "flex", flexDirection: "column", gap: 12, background: loadedRoute === r.id ? "rgba(14,32,22,0.8)" : "rgba(14,32,22,0.5)", border: "1px solid " + (loadedRoute === r.id ? "rgba(217,183,121,0.45)" : "rgba(217,183,121,0.16)"), borderRadius: 16, padding: 14, backdropFilter: "blur(10px)" }}>
                      <div style={{ display: "flex", gap: 14 }}>
                        <div style={{ width: 96, height: 82, flex: "none", borderRadius: 12, position: "relative", overflow: "hidden", border: "1px solid rgba(217,183,121,0.18)", background: THUMBS[i % THUMBS.length] }}>
                          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(217,183,121,0.14) 0 2px, transparent 2px 9px)" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: "#f4f1ea", lineHeight: 1.1 }}>{r.emoji} {r.name}</div>
                          <div style={{ fontSize: 11.5, color: "#aab0ba", marginTop: 5, lineHeight: 1.4 }}>{r.desc}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                            {[r.stops.length + " stops", r.days + " days", r.miles + " mi"].map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{t}</span>)}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => { setPreviewRoute(r); setPickTrip(false); }} className="ts-goldbtn" style={{ width: "100%", padding: 11, borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5, boxShadow: "0 10px 26px -12px rgba(217,183,121,0.6)" }}>View itinerary</button>
                    </div>
                  ))}
                </div>

                {/* Scenic routes by Park Buddy — the All-American Roads, addable as stops */}
                {(() => {
                  const scenic = (bywaysDb || []).filter((b) => b.tier === "all-american" && b.lat != null).slice().sort((a, b) => a.name.localeCompare(b.name));
                  if (!scenic.length) return null;
                  return (
                    <div style={{ marginTop: 26 }}>
                      <div style={{ ...kicker, marginBottom: 4 }}>Scenic routes by Park Buddy</div>
                      <div style={{ fontFamily: SANS, fontSize: 11.5, color: "#7f8a82", marginBottom: 14 }}>America&apos;s All-American Roads — add one to your trip or open the full drive.</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {scenic.map((b) => (
                          <div key={b.id} onClick={() => { setPreviewRoute({ __byway: true, id: b.id, name: b.name, states: b.states || b.state || "", lengthMi: b.lengthMi, length: b.length, blurb: b.blurb, endpoints: b.endpoints, lat: b.lat, lng: b.lng }); setPickTrip(false); }} className="ts-hoverline" style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(14,32,22,0.5)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 14, padding: "11px 13px", backdropFilter: "blur(10px)", cursor: "pointer" }}>
                            <span style={{ fontSize: 15, flex: "none" }}>⟿</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: SERIF, fontSize: 16, color: "#f4f1ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".08em", color: "#7f8a82", marginTop: 3 }}>ALL-AMERICAN ROAD{(b.states || b.state) ? " · " + (b.states || b.state) : ""}</div>
                            </div>
                            <span style={{ flex: "none", fontFamily: SANS, fontSize: 11, fontWeight: 600, color: "#c9a35f" }}>View →</span>
                            <button onClick={(e) => { e.stopPropagation(); addDestination && addDestination({ name: b.name, state: b.states || b.state || "", lat: b.lat, lng: b.lng, kind: "byway", slug: b.id }); }} title="Add to your trip" style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontSize: 17, fontWeight: 700, lineHeight: 1 }}>＋</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {!previewRoute && mode === "mine" && (
              <div>
                <div style={{ ...kicker, marginBottom: 16 }}>My trips · tap to open</div>
                {!savedTrips.length && <div style={{ border: "1px dashed rgba(217,183,121,0.3)", borderRadius: 16, padding: 18, color: "#aab0ba", fontSize: 13, lineHeight: 1.55 }}><b style={{ fontFamily: SERIF, color: "#f4f1ea", fontSize: 16, display: "block", marginBottom: 5 }}>No saved trips yet</b>Hit <b style={{ color: "#e8cf9a" }}>＋ Add a new trip</b> to start one — it saves here automatically.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {savedTrips.map((t, i) => {
                    const n = (t.stops || []).length;
                    const nights = (t.stops || []).reduce((a, s) => a + (Number(s.nights) || 0), 0);
                    return (
                      <div key={t.id} className="ts-hoverline" style={{ display: "flex", flexDirection: "column", gap: 12, background: "rgba(14,32,22,0.5)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 16, padding: 14, backdropFilter: "blur(10px)" }}>
                        <div onClick={() => setViewSaved(t)} style={{ display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}>
                          <div style={{ width: 96, height: 82, flex: "none", borderRadius: 12, position: "relative", overflow: "hidden", border: "1px solid rgba(217,183,121,0.18)", background: THUMBS[i % THUMBS.length] }}>
                            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(217,183,121,0.14) 0 2px, transparent 2px 9px)" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: "#f4f1ea", lineHeight: 1.1 }}>{t.name}</div>
                            <div style={{ fontSize: 11.5, color: "#aab0ba", marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n ? (t.stops || []).slice(0, 4).map((s) => s.name).join(" · ") : "No stops"}</div>
                            <span style={{ display: "inline-block", fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, marginTop: 10, background: "rgba(143,214,166,0.12)", color: "#8fd6a6" }}>{n} stop{n === 1 ? "" : "s"} · {nights} night{nights === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                          <button onClick={() => loadSavedTrip(t)} className="ts-goldbtn" style={{ padding: 10, borderRadius: 11, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5 }}>Edit</button>
                          <button onClick={() => setConfirmDelete(t)} className="ts-navtile" style={{ ...navTile, color: "#c98a6a", justifyContent: "center", borderColor: "rgba(176,106,74,0.4)" }}>Delete</button>
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

      {/* My-trips — read-only preview + Edit / Delete */}
      {viewSaved && (() => {
        const st = viewSaved.stops || [];
        const nn = st.reduce((a, s) => a + (Number(s.nights) || 0), 0);
        return (
          <div onClick={() => setViewSaved(null)} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,9,7,0.74)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 20, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}>
              <div style={{ flex: "none", padding: "18px 20px 14px", borderBottom: "1px solid rgba(217,183,121,0.12)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#7f8a82" }} />Trip preview</span>
                  <button onClick={() => setViewSaved(null)} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 15, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 500, color: "#f4f1ea", marginTop: 8 }}>{viewSaved.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{st.length} stop{st.length === 1 ? "" : "s"}</span>
                  <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{nn} night{nn === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className="ts-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
                {!st.length && <div style={{ fontFamily: SANS, fontSize: 13, color: "#7f8a82", padding: "8px 0" }}>No stops yet in this trip.</div>}
                {st.map((s, idx) => (
                  <div key={s.name + idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: idx ? "1px solid rgba(217,183,121,0.08)" : "none" }}>
                    <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", border: "1px solid rgba(217,183,121,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, color: "#e8cf9a" }}>{idx + 1}</span>
                    <span style={{ fontFamily: SERIF, fontSize: 16, color: "#f4f1ea" }}>{s.name}</span>
                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, color: "#7f8a82" }}>{(s.nights || 0)} night{(s.nights || 0) === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 20px 18px", borderTop: "1px solid rgba(217,183,121,0.12)", background: "rgba(6,14,10,0.6)" }}>
                <button onClick={() => { const t = viewSaved; setViewSaved(null); loadSavedTrip(t); }} className="ts-goldbtn" style={{ padding: 12, borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5 }}>Edit this trip</button>
                <button onClick={() => { const t = viewSaved; setViewSaved(null); setConfirmDelete(t); }} className="ts-navtile" style={{ ...navTile, justifyContent: "center", color: "#c98a6a", borderColor: "rgba(176,106,74,0.4)" }}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ready-made itinerary — read-only view + Clone / Add-to-a-trip */}
      {viewRoute && (
        <div onClick={() => { setViewRoute(null); setPickTrip(false); }} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,9,7,0.74)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 20, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}>
            <div style={{ flex: "none", padding: "18px 20px 14px", borderBottom: "1px solid rgba(217,183,121,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#7f8a82" }} />Read-only itinerary</span>
                <button onClick={() => { setViewRoute(null); setPickTrip(false); }} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 15, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 500, color: "#f4f1ea", marginTop: 8 }}>{viewRoute.emoji} {viewRoute.name}</div>
              <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#aab0ba", marginTop: 5, lineHeight: 1.4 }}>{viewRoute.desc}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {[viewRoute.stops.length + " stops", viewRoute.days + " days", viewRoute.miles + " mi"].map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{t}</span>)}
              </div>
            </div>
            <div className="ts-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
              {viewRoute.stops.map((name, idx) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: idx ? "1px solid rgba(217,183,121,0.08)" : "none" }}>
                  <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", border: "1px solid rgba(217,183,121,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, color: "#e8cf9a" }}>{idx + 1}</span>
                  <span style={{ fontFamily: SERIF, fontSize: 16, color: "#f4f1ea" }}>{name}</span>
                  <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, color: "#7f8a82" }}>{viewRoute.nights[idx]} night{viewRoute.nights[idx] === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: "none", padding: "12px 20px 18px", borderTop: "1px solid rgba(217,183,121,0.12)", background: "rgba(6,14,10,0.6)" }}>
              {!pickTrip ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => { const r = viewRoute; setViewRoute(null); cloneRoute(r); }} className="ts-goldbtn" style={{ padding: 12, borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5 }}>Clone as a new trip</button>
                  <button onClick={() => setPickTrip(true)} className="ts-navtile" style={{ ...navTile, justifyContent: "center" }}>Add to a trip</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8a82", marginBottom: 8 }}>Add to which trip?</div>
                  <div style={{ maxHeight: 180, overflowY: "auto" }} className="ts-scroll">
                    {editing && stops.length > 0 && (
                      <button onClick={() => { const r = viewRoute; setViewRoute(null); setPickTrip(false); setPendingRoute(r); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "space-between", marginBottom: 8 }}><span>{tripName || "Current trip"}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: "#8fd6a6" }}>EDITING NOW</span></button>
                    )}
                    {savedTrips.filter((t) => !(editing && t.name === tripName)).map((t) => (
                      <button key={t.id} onClick={() => { const r = viewRoute; setViewRoute(null); setPickTrip(false); loadSavedTrip(t); setPendingRoute(r); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "space-between", marginBottom: 8 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span><span style={{ fontFamily: MONO, fontSize: 8.5, color: "#7f8a82" }}>{(t.stops || []).length} stops</span></button>
                    ))}
                    {!savedTrips.length && !(editing && stops.length) && <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#7f8a82", padding: "4px 0 10px", lineHeight: 1.5 }}>No trips yet — clone this itinerary to start one.</div>}
                  </div>
                  <button onClick={() => setPickTrip(false)} style={{ marginTop: 4, background: "none", border: "none", color: "#7f8a82", fontFamily: SANS, fontSize: 12, cursor: "pointer" }}>← Back</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete a saved trip — confirm first */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(4,9,7,0.74)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 20, padding: 24, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)", textAlign: "center" }}>
            <div style={{ display: "inline-flex", width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", color: "#c98a6a", background: "rgba(176,106,74,0.12)", border: "1px solid rgba(176,106,74,0.35)", marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6M14 11v6" /></svg>
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: "#f4f1ea" }}>Delete this trip?</div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: "#aab0ba", marginTop: 8, lineHeight: 1.55 }}>“{confirmDelete.name}” will be permanently removed from your trips. This can’t be undone.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
              <button onClick={() => setConfirmDelete(null)} className="ts-navtile" style={{ ...navTile, justifyContent: "center" }}>Cancel</button>
              <button onClick={() => { deleteSavedTrip(confirmDelete.id); setConfirmDelete(null); }} style={{ padding: "11px 8px", borderRadius: 11, border: "none", cursor: "pointer", background: "linear-gradient(120deg,#c98a6a,#b06a4a)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 12.5 }}>Delete trip</button>
            </div>
          </div>
        </div>
      )}

      {/* Ready-made itinerary → choose where to slot it into the current trip */}
      {pendingRoute && (
        <div onClick={() => setPendingRoute(null)} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,9,7,0.74)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "86vh", display: "flex", flexDirection: "column", background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 20, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}>
            <div style={{ flex: "none", padding: "18px 20px 12px", borderBottom: "1px solid rgba(217,183,121,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={kicker}>Add to your trip</div>
                <button onClick={() => setPendingRoute(null)} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 15, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: "#f4f1ea", marginTop: 8 }}>{pendingRoute.emoji} {pendingRoute.name}</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: "#7f8a82", marginTop: 5 }}>Adds {pendingRoute.stops.filter((n) => !stops.some((s) => s.name === n)).length || pendingRoute.stops.length} stop{pendingRoute.stops.length === 1 ? "" : "s"} — pick where they go in your trip.</div>
            </div>
            <div className="ts-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 20px 18px" }}>
              {Array.from({ length: stops.length + 1 }).map((_, pos) => {
                const label = pos === 0
                  ? (stops.length ? "At the very start · before " + stops[0].name : "Start my trip with it")
                  : pos === stops.length
                    ? "At the end · after " + stops[stops.length - 1].name
                    : "Between " + stops[pos - 1].name + " and " + stops[pos].name;
                return (
                  <button key={pos} onClick={() => { insertRouteAt(pendingRoute, pos); setPendingRoute(null); }} className="ts-navtile" style={{ ...navTile, width: "100%", justifyContent: "flex-start", textAlign: "left", marginBottom: 8, padding: "12px 14px", fontSize: 13 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#c9a35f", marginRight: 4 }}>{pos + 1}.</span>{label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SCENIC DRIVE → trip: drag (or tap) the drive tile into a gap in the trip.
          Collapsed = start & end into Plan this day; Expanded = every waypoint. */}
      {scenicAdd && (() => {
        const sd = scenicAdd;
        const itin = sd.detail ? (sd.detail.itinerary || []).filter((s) => s && s.place) : [];
        const ep = sd.drive.endpoints || (sd.detail && sd.detail.endpoints) || null;
        const count = itin.length || (ep ? (ep.via ? ep.via.length : 0) + 2 : 0);
        const lenChip = sd.drive.length || (sd.drive.lengthMi ? sd.drive.lengthMi + " mi" : "");
        const already = stops.some((s) => s.name === sd.drive.name);
        const doAdd = (pos) => {
          if (already) return;
          insertScenicDrive && insertScenicDrive(sd.drive, pos, { expanded: scenicExpanded, detail: sd.detail });
          setScenicAdd(null); setScenicDropPos(null); setScenicDragging(false); setPreviewRoute && setPreviewRoute(null); setMode && setMode("new");
        };
        const gapStyle = (pos) => {
          const active = scenicDropPos === pos;
          return { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: active ? 44 : 26, borderRadius: 10, cursor: already ? "not-allowed" : "pointer", border: "1.5px dashed " + (active ? "#e8cf9a" : "rgba(217,183,121,0.28)"), background: active ? "rgba(232,207,154,0.12)" : "transparent", color: active ? "#f4f1ea" : "#7f8a82", fontFamily: MONO, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", transition: "all .15s", margin: "5px 0" };
        };
        const Gap = (pos, label) => (
          <div key={"gap" + pos}
            onDragOver={(e) => { e.preventDefault(); if (scenicDropPos !== pos) setScenicDropPos(pos); }}
            onDragLeave={() => { if (scenicDropPos === pos) setScenicDropPos(null); }}
            onDrop={(e) => { e.preventDefault(); doAdd(pos); }}
            onClick={() => doAdd(pos)}
            style={gapStyle(pos)}>
            {scenicDropPos === pos ? "⟿ Drop " + sd.drive.name + " here" : (label || "+ place here")}
          </div>
        );
        return (
          <div onClick={() => { setScenicAdd(null); setScenicDropPos(null); }} style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(4,9,7,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 780, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 20, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)" }}>
              <div style={{ flex: "none", padding: "18px 20px 12px", borderBottom: "1px solid rgba(217,183,121,0.12)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={kicker}>Add scenic drive to {tripName || "your trip"}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: "#f4f1ea", marginTop: 6 }}>{sd.drive.name}</div>
                  <div style={{ fontFamily: SANS, fontSize: 12, color: "#7f8a82", marginTop: 4 }}>Drag the drive into your itinerary — or tap a spot — to choose where it goes.</div>
                </div>
                <button onClick={() => { setScenicAdd(null); setScenicDropPos(null); }} style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 15, cursor: "pointer" }}>✕</button>
              </div>
              <div className="ts-scroll" style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 288px", gap: 16, padding: 20 }}>
                {/* LEFT — the trip, with drop gaps */}
                <div>
                  <div style={{ ...kicker, marginBottom: 6 }}>Your trip{stops.length ? " · " + stops.length + " stop" + (stops.length === 1 ? "" : "s") : ""}</div>
                  {!stops.length && <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#7f8a82", padding: "6px 0" }}>This trip has no stops yet — drop the drive to start it.</div>}
                  {Gap(0, stops.length ? "At the very start" : "Start my trip with it")}
                  {stops.map((s, i) => (
                    <div key={s.name}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12, background: "rgba(11,23,16,0.6)", border: "1px solid rgba(217,183,121,0.16)" }}>
                        <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", border: "1px solid rgba(217,183,121,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, color: "#e8cf9a" }}>{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".14em", textTransform: "uppercase", color: "#c9a35f" }}>{dayRanges[i] ? dayRanges[i].label : ""}{s.kind === "byway" ? " · scenic" : ""}</div>
                          <div style={{ fontFamily: SERIF, fontSize: 16, color: "#f4f1ea", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                        </div>
                      </div>
                      {Gap(i + 1, i + 1 === stops.length ? "At the end" : null)}
                    </div>
                  ))}
                </div>
                {/* RIGHT — the scenic drive bucket (drag source) */}
                <div>
                  <div style={{ ...kicker, marginBottom: 6 }}>This scenic drive</div>
                  <div
                    draggable={!already}
                    onDragStart={(e) => { setScenicDragging(true); try { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", sd.drive.id); } catch {} }}
                    onDragEnd={() => { setScenicDragging(false); setScenicDropPos(null); }}
                    style={{ border: "1px solid rgba(217,183,121,0.35)", borderRadius: 14, background: "linear-gradient(160deg,rgba(232,207,154,0.12),rgba(11,23,16,0.5))", padding: 14, cursor: already ? "default" : "grab", opacity: scenicDragging ? 0.5 : 1, boxShadow: "0 14px 34px -18px rgba(217,183,121,0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, color: "#e8cf9a" }}>⟿</span>
                      <span style={{ fontFamily: SERIF, fontSize: 16, color: "#f4f1ea", lineHeight: 1.15 }}>{sd.drive.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                      {["ALL-AMERICAN ROAD", sd.drive.states, lenChip, count ? count + " stops" : null].filter(Boolean).map((t) => <span key={t} style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".08em", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.3)", color: "#d9b779" }}>{t}</span>)}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".08em", color: "#8fd6a6", marginTop: 11, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12 }}>⠿</span>{already ? "Already in this trip" : (isMobile ? "Tap a spot in your trip →" : "Drag me into your trip ←")}
                    </div>
                  </div>
                  {/* expand — swap start&end for all waypoints */}
                  {itin.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 12, border: "1px solid " + (scenicExpanded ? "rgba(217,183,121,0.4)" : "rgba(217,183,121,0.16)"), background: scenicExpanded ? "rgba(232,207,154,0.08)" : "transparent" }}>
                        <input type="checkbox" checked={scenicExpanded} onChange={(e) => setScenicExpanded(e.target.checked)} style={{ marginTop: 2, accentColor: "#c9a35f", width: 15, height: 15 }} />
                        <div>
                          <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: "#f4f1ea" }}>Expand — add every stop</div>
                          <div style={{ fontFamily: SANS, fontSize: 11, color: "#7f8a82", marginTop: 2, lineHeight: 1.45 }}>{scenicExpanded ? "All " + itin.length + " waypoints go under the drive in “Plan this day.”" : "Off: only the start & end go into “Plan this day.”"}</div>
                        </div>
                      </label>
                      {scenicExpanded && (
                        <div className="ts-scroll" style={{ marginTop: 8, maxHeight: 168, overflowY: "auto", border: "1px solid rgba(217,183,121,0.12)", borderRadius: 10, padding: "6px 4px" }}>
                          {itin.map((s, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 8px" }}>
                              <span style={{ fontFamily: MONO, fontSize: 8.5, color: "#c9a35f", minWidth: 16 }}>{s.seq}</span>
                              <span style={{ fontFamily: SANS, fontSize: 12, color: "#e6e2d8", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.place}</span>
                              {s.mileFromStart != null && <span style={{ fontFamily: MONO, fontSize: 7.5, color: "#7f8a82" }}>MI {s.mileFromStart.toFixed(0)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* desktop: add-a-stop popup (7 sources) — a real popup so it isn't clipped */}
      {addMenuOpen && (
        <div onClick={() => { setAddMenuOpen(false); setAddSource(null); }} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,9,7,0.74)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#0a1712", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 20, boxShadow: "0 40px 90px -24px rgba(0,0,0,0.9)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: "#f4f1ea" }}>Add a stop</div>
              <button onClick={() => { setAddMenuOpen(false); setAddSource(null); }} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 15, cursor: "pointer" }}>✕</button>
            </div>
            {!addSource && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["park", "◈", "National park"], ["statePark", "◆", "State park"], ["scenic", "⟿", "Scenic route"], ["lake", "≈", "Lake"], ["coord", "⌖", "Coordinates"], ["address", "⌂", "Address"], ["place", "✦", "Any place"]].map(([src, ic, label]) => (
                  <button key={src} onClick={() => setAddSource(src)} className="ts-navtile" style={{ ...navTile, justifyContent: "flex-start", padding: "12px 13px", fontSize: 13 }}><span style={{ color: "#d9b779", marginRight: 4 }}>{ic}</span>{label}</button>
                ))}
              </div>
            )}
            {addSource === "park" && (
              <div style={{ display: "flex", gap: 9 }}>
                <select value={addSel} onChange={(e) => setAddSel(e.target.value)} style={{ ...fieldBox, flex: 1, color: addSel ? "#1a2b21" : "var(--pb-muted)" }}>
                  <option value="">Choose a park…</option>
                  {parksDb.filter((p) => !stops.some((s) => s.name === p.name)).map((p) => <option key={p.id} value={p.name}>{p.name} — {p.state}</option>)}
                </select>
                <button onClick={() => { addPark(); setAddMenuOpen(false); setAddSource(null); }} style={addBtn}>＋</button>
              </div>
            )}
            {addSource === "scenic" && (
              <div style={{ display: "flex", gap: 9 }}>
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
            {["statePark", "lake", "address", "place"].includes(addSource) && (
              <GeoAutocomplete
                placeholder={{ statePark: "Start typing a state park…", lake: "Start typing a lake…", address: "Start typing an address or town…", place: "Start typing a place or landmark…" }[addSource]}
                onPick={(s) => { addDestination && addDestination({ name: s.name, state: s.state, lat: s.lat, lng: s.lng, custom: true }); setAddMenuOpen(false); setAddSource(null); }}
                fieldBox={fieldBox}
              />
            )}
            {addSource === "coord" && addCoords && (
              <div>
                <div style={{ display: "flex", gap: 9 }}>
                  <input value={coordInput || ""} onChange={(e) => setCoordInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCoords(); }} placeholder="37.29, -113.05" style={{ ...fieldBox, flex: 1 }} />
                  <button onClick={addCoords} style={addBtn}>＋</button>
                </div>
                {addrMsg && <div style={{ fontSize: 12, color: "var(--pb-ink-2)", marginTop: 7 }}>{addrMsg}</div>}
              </div>
            )}
            {addSource && <button onClick={() => setAddSource(null)} style={{ marginTop: 12, background: "none", border: "none", color: "#7f8a82", fontFamily: SANS, fontSize: 12, cursor: "pointer" }}>← All sources</button>}
          </div>
        </div>
      )}

      {/* mobile: search-first add-a-stop popup (spec §7a) */}
      {mobileAddOpen && (
        <MobileAddPopup
          onClose={() => setMobileAddOpen(false)}
          stops={stops} dayRanges={dayRanges}
          parksDb={parksDb} bywaysDb={bywaysDb}
          addActivity={addActivity}
          addrInput={addrInput} setAddrInput={setAddrInput} addAddress={addAddress} addDestination={addDestination}
          coordInput={coordInput} setCoordInput={setCoordInput} addCoords={addCoords}
          addrMsg={addrMsg} fieldBox={fieldBox}
        />
      )}
    </div>
  );
}

// The six day-block types. A day is a bucket; each block inside it has a type,
// an optional time, and (via TYPE_ICON) a monochrome line icon.
const BLOCK_TYPES = [["drive", "car", "Drive"], ["stay", "bed", "Stay"], ["meal", "utensils", "Meal"], ["scenic", "route", "Scenic drive"], ["hike", "hike", "Hike"], ["sight", "camera", "Sight"]];
const TYPE_ICON = { drive: "car", stay: "bed", meal: "utensils", scenic: "route", hike: "hike", sight: "camera",
  // legacy day-plan types, mapped onto the new icon set
  park: "pin", statePark: "pin", lake: "pin", viewpoint: "camera", coord: "pin", place: "pin" };
const TYPE_LABEL = { drive: "Drive", stay: "Stay", meal: "Meal", scenic: "Scenic drive", hike: "Hike", sight: "Sight" };
const blockIcon = (t) => TYPE_ICON[t] || "pin";

// "+ Add to this day" — pick a block type, name it, time it. Time is optional
// (leave blank for an unscheduled block that keeps manual order).
function DayPlanAdd({ onAdd, fieldBox, defaultType = "hike" }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(defaultType);
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  function commit() {
    const nm = name.trim(); if (!nm) return;
    onAdd({ type, name: nm, time });
    setName(""); setTime(""); setOpen(false);
  }
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ marginTop: 2, alignSelf: "flex-start", padding: "7px 12px", borderRadius: 9, border: "1px dashed rgba(217,183,121,0.35)", background: "rgba(255,255,255,.03)", color: "#c9a35f", fontFamily: SANS, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>+ Add to this day</button>
  );
  return (
    <div style={{ marginTop: 2, padding: 10, borderRadius: 11, border: "1px solid rgba(217,183,121,0.18)", background: "rgba(255,255,255,.02)" }}>
      <div style={{ display: "flex", gap: 7 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...fieldBox, flex: 1, color: "#1a2b21" }}>
          {BLOCK_TYPES.map(([v, , label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...fieldBox, width: 104, flex: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} placeholder={{ drive: "Where to?", stay: "Where are you staying?", meal: "Where are you eating?", scenic: "Which scenic drive?", hike: "Which trail?", sight: "What are you seeing?" }[type] || "What's the plan?"} style={{ ...fieldBox, flex: 1 }} />
        <button onClick={commit} style={addBtn}>＋</button>
      </div>
    </div>
  );
}

// Mobile add-a-stop popup (spec §7a): search → filter chips → "add to Day · time"
// → suggested rows (one tap logs a timed activity on the chosen day) → precise entry.
const ADD_FILTERS = [["all", "All"], ["park", "Parks"], ["statePark", "State"], ["forest", "Forest"], ["scenic", "Scenic"], ["lake", "Lake"]];
const TYPE_DOT = { park: "#8fd6a6", statePark: "#9ecbe8", forest: "#c9a35f", scenic: "#e8cf9a", lake: "#7fd2d6" };
function MobileAddPopup({ onClose, stops, dayRanges, parksDb, bywaysDb, addActivity, addrInput, setAddrInput, addAddress, addDestination, coordInput, setCoordInput, addCoords, addrMsg, fieldBox }) {
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
          <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: "#f4f1ea" }}>Add a stop</div>
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
            <div style={{ marginTop: 9 }}>
              <GeoAutocomplete
                placeholder={precise === "pin" ? "Start typing a place or landmark…" : "Start typing an address or town…"}
                onPick={(s) => { addDestination && addDestination({ name: s.name, state: s.state, lat: s.lat, lng: s.lng, custom: true }); onClose(); }}
                fieldBox={fieldBox}
              />
            </div>
          )}
          {precise && addrMsg && <div style={{ fontSize: 12, color: "#aab0ba", marginTop: 7 }}>{addrMsg}</div>}
        </div>
      </div>
    </div>
  );
}

// Geocoding autocomplete input — as you type it queries /api/geocode?suggest=1 and
// shows a live dropdown; picking one adds it as a stop. Used for State park / Lake /
// Address / Any place. Debounced so we don't hammer Nominatim.
function GeoAutocomplete({ placeholder, onPick, onType, inputStyle, fieldBox }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const tRef = useRef(null);
  const seqRef = useRef(0);
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    const term = q.trim();
    if (term.length < 3) { setList([]); setLoading(false); return; }
    setLoading(true);
    const seq = ++seqRef.current;
    tRef.current = setTimeout(() => {
      fetch("/api/geocode?suggest=1&q=" + encodeURIComponent(term))
        .then((r) => r.json()).then((d) => { if (seq === seqRef.current) { setList((d && d.suggestions) || []); setOpen(true); setLoading(false); } })
        .catch(() => { if (seq === seqRef.current) { setList([]); setLoading(false); } });
    }, 300);
    return () => tRef.current && clearTimeout(tRef.current);
  }, [q]);
  const pick = (s) => { onPick(s); setQ(""); setList([]); setOpen(false); if (onType) onType(""); };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 9 }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); if (onType) onType(e.target.value); }} onFocus={() => list.length && setOpen(true)} placeholder={placeholder} style={inputStyle || { ...fieldBox, flex: 1 }} />
        {loading && <span className="ts-skel" style={{ width: 30, borderRadius: 10 }} />}
      </div>
      {open && list.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 30, background: "rgba(14,32,22,0.98)", border: "1px solid rgba(217,183,121,0.3)", borderRadius: 12, padding: 6, maxHeight: 240, overflowY: "auto", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.9)" }} className="ts-scroll">
          {list.map((s, i) => (
            <div key={i} onClick={() => pick(s)} className="ts-menuitem" style={{ padding: "9px 11px", borderRadius: 9, cursor: "pointer" }}>
              <div style={{ fontFamily: SANS, fontSize: 13, color: "#f4f1ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#7f8a82", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.fullName || s.state}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const addBtn = { width: 46, flex: "none", border: "none", borderRadius: 12, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", fontSize: "1.15rem", cursor: "pointer", fontWeight: 700 };
const stepBtn = { width: 22, height: 22, flex: "none", borderRadius: 7, border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 13, lineHeight: 1, cursor: "pointer", fontFamily: SANS };
const navMini = { flex: 1, textAlign: "center", textDecoration: "none", padding: "8px 4px", borderRadius: 9, border: "1px solid rgba(217,183,121,0.16)", background: "rgba(255,255,255,.03)", color: "#aab0ba", fontFamily: SANS, fontSize: 10.5, fontWeight: 600 };
