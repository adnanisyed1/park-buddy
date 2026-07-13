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
    addSource, setAddSource, addMenuOpen, setAddMenuOpen,
    parksDb, addSel, setAddSel, addPark,
    bywaysDb, addBywaySel, setAddBywaySel, addByway,
    addrInput, setAddrInput, addAddress, addrMsg,
    coordInput, setCoordInput, addCoords,
    setupCollapsed, setSetupCollapsed, setupRows, onEditSetup, onSaveTrip, saveMsg,
    budgetOpen, setBudgetOpen, budgetLines, BudgetAmount, totalCost, perPerson, fmtUsd,
    routes, loadedRoute, loadRoute,
    savedTrips, loadSavedTrip, deleteSavedTrip,
    gmapsUrl, waUrl, copyLink,
    mapDivRef, keyOverlay, keyInputRef, saveKey, keyMsg, roadInfo, driveHrs, totalMiles,
    layers, setLayers, layersOpen, setLayersOpen,
    fieldBox,
  } = props;

  const DEST_LAYERS = [["np", "◈", "National Parks"], ["statePark", "◆", "State Parks"], ["forest", "▲", "National Forests"], ["byway", "⛰", "Scenic routes"]];
  const CTX_LAYERS = [["camp", "Campgrounds"], ["lake", "Lakes"], ["hiking", "Hiking"], ["offroad", "Off-road"], ["ski", "Ski"]];

  const sn = statNum || { stops: 0, days: 0, miles: 0, cost: 0 };
  const stat4 = [{ label: "Stops", num: sn.stops }, { label: "Days", num: sn.days }, { label: "Drive miles", num: sn.miles }, { label: "Est. cost", num: sn.cost, fmt: fmtUsd }];

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
        @media (max-width: 900px) {
          .ts-body { flex-direction: column !important; }
          .ts-modules { order: 1; flex: none !important; border-left: none !important; max-height: none !important; overflow: visible !important; }
          .ts-stage { order: 2; flex: none !important; height: 280px !important; border-top: 1px solid rgba(217,183,121,.25) !important; }
          .ts-switcher button { padding: 8px 11px !important; font-size: 11.5px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1360, margin: "0 auto", background: "#0a1712", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 22, overflow: "hidden", boxShadow: "0 40px 120px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(217,183,121,0.08)", display: "flex", flexDirection: "column" }}>

        {/* ── top bar ── */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderBottom: "1px solid rgba(217,183,121,0.12)", background: "linear-gradient(180deg, rgba(14,32,22,0.7), rgba(11,23,16,0.2))", backdropFilter: "blur(14px)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px -6px rgba(217,183,121,0.6)" }}>
              <div style={{ width: 14, height: 14, border: "2px solid #0a1712", borderRadius: "50%" }} />
            </div>
            <div style={{ lineHeight: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, color: "#f4f1ea", letterSpacing: ".01em" }}>Trip Studio</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".26em", textTransform: "uppercase", color: "#7f8a82", marginTop: 3 }}>Park Buddy</div>
            </div>
          </div>

          <div style={{ display: "flex", padding: 5, gap: 4, background: "rgba(8,19,13,0.7)", border: "1px solid rgba(217,183,121,0.16)", borderRadius: 999, order: 3, flex: "1 1 100%", justifyContent: "center" }} className="ts-switcher">
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

          {/* MAP STAGE (real Google map) */}
          <div className="ts-stage" style={{ flex: "1.62 1 0", position: "relative", overflow: "hidden", background: "radial-gradient(900px 620px at 60% 35%, #0d1f16, #08130d 70%)", minHeight: 520 }}>
            <div style={{ position: "absolute", inset: -64, opacity: 0.5, animation: "ts-gridDrift 26s linear infinite", pointerEvents: "none", backgroundImage: "linear-gradient(rgba(217,183,121,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(217,183,121,0.05) 1px, transparent 1px)", backgroundSize: "64px 64px", zIndex: 1 }} />
            <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

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

            {/* layers control — tap a map marker to add these to the trip */}
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
                  <button onClick={onEditSetup} style={{ width: "100%", marginTop: 14, padding: 11, borderRadius: 11, border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontFamily: SANS, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>◈ Set up your trip</button>
                </div>

                {/* itinerary filmstrip */}
                <div style={glass}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={kicker}>Itinerary</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: "#7f8a82" }}>{stops.length} stop{stops.length === 1 ? "" : "s"} · {totalMiles} mi</div>
                  </div>

                  {!stops.length && <div style={{ fontSize: 13, color: "#7f8a82", padding: "10px 2px 4px", lineHeight: 1.6 }}>No stops yet — hit <b style={{ color: "#e8cf9a" }}>Add a stop</b> below, or load a ready-made route.</div>}

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {stops.map((s, i) => {
                      const v = verdicts[s.name];
                      const st = STOP_STATUS[v ? v.status : "loading"];
                      const hov = hoverIdx === i;
                      return (
                        <div key={s.name} draggable onDragStart={onDragStart(i)} onDragOver={onDragOver} onDrop={onDrop(i)} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
                          style={{ display: "flex", gap: 13, alignItems: "center", padding: 12, borderRadius: 15, background: hov ? "rgba(14,32,22,0.7)" : "rgba(11,23,16,0.55)", border: "1px solid " + (hov ? "rgba(217,183,121,0.4)" : "rgba(217,183,121,0.16)"), boxShadow: hov ? "0 10px 30px -12px rgba(217,183,121,0.35), inset 0 1px 0 rgba(217,183,121,0.12)" : "none", transform: hov ? "translateY(-1px)" : "none", transition: "border-color .2s, box-shadow .2s, transform .2s" }}>
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
                      );
                    })}
                  </div>

                  {/* add a stop */}
                  <div style={{ position: "relative", marginTop: 14 }}>
                    <button onClick={() => { setAddMenuOpen(!addMenuOpen); setAddSource(null); }} style={{ width: "100%", padding: 13, borderRadius: 13, border: "1px solid rgba(217,183,121,0.3)", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>
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

                {/* setup (collapsible) */}
                <div style={{ ...glass, marginTop: 14 }}>
                  <div onClick={() => setSetupCollapsed(!setupCollapsed)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={kicker}>Setup</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span onClick={(e) => { e.stopPropagation(); onEditSetup(); }} style={{ fontFamily: SANS, fontSize: 11, color: "#c9a35f", cursor: "pointer" }}>Edit</span>
                      <span style={{ color: "#7f8a82", fontSize: 12, transition: "transform .2s", transform: setupCollapsed ? "rotate(-90deg)" : "none", display: "inline-block" }}>▾</span>
                    </div>
                  </div>
                  {!setupCollapsed && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                        {setupRows.map(([k, val]) => (
                          <div key={k} style={{ background: "rgba(8,19,13,0.6)", border: "1px solid rgba(217,183,121,0.12)", borderRadius: 11, padding: 12, minWidth: 0 }}>
                            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".18em", textTransform: "uppercase", color: "#7f8a82" }}>{k}</div>
                            <div style={{ fontSize: 13, color: "#f4f1ea", marginTop: 5, overflowWrap: "anywhere" }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                        <button onClick={onSaveTrip} style={{ cursor: "pointer", fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: "#0a1712", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", border: "none", borderRadius: 999, padding: "9px 18px" }}>💾 Save trip</button>
                        {saveMsg && <span style={{ fontSize: 11.5, fontWeight: 700, color: saveMsg.includes("first") ? "#c98a5a" : "#8fd6a6" }}>{saveMsg}</span>}
                      </div>
                    </>
                  )}
                </div>

                {/* budget + navigate */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                  <div style={{ ...glass, cursor: "pointer" }} onClick={() => setBudgetOpen(!budgetOpen)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={kicker}>Budget</div>
                      <span style={{ color: "#7f8a82", fontSize: 11 }}>{budgetOpen ? "▾" : "▸"}</span>
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: "#f4f1ea", marginTop: 10, lineHeight: 1 }}>{fmtUsd(totalCost)}</div>
                    <div style={{ height: 6, borderRadius: 6, background: "rgba(8,19,13,0.8)", marginTop: 12, overflow: "hidden" }}>
                      <div style={{ width: "64%", height: "100%", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: "#7f8a82", marginTop: 8 }}>≈ {fmtUsd(perPerson)} / person · tap to edit</div>
                    {budgetOpen && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, borderTop: "1px solid rgba(217,183,121,0.12)", paddingTop: 6 }}>
                        {budgetLines.map(({ label, k, show }) => (show === false ? null : (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5, color: "#aab0ba", borderTop: "1px solid rgba(217,183,121,0.08)" }}>
                            <span>{label}</span><BudgetAmount k={k} />
                          </div>
                        )))}
                      </div>
                    )}
                  </div>
                  <div style={{ ...glass, display: "flex", flexDirection: "column" }}>
                    <div style={kicker}>Navigate &amp; share</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                      <a href={gmapsUrl} target="_blank" rel="noreferrer" style={{ textAlign: "center", textDecoration: "none", padding: 10, borderRadius: 11, border: "1px solid rgba(217,183,121,0.3)", background: "transparent", color: "#e8cf9a", fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }}>Start navigation</a>
                      <button onClick={copyLink} style={{ padding: 10, borderRadius: 11, border: "1px solid rgba(217,183,121,0.16)", background: "transparent", color: "#aab0ba", fontFamily: SANS, fontSize: 12.5, cursor: "pointer" }}>Share trip</button>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <a href="/trip-print" style={navMini}>🖨 Print</a>
                        <a href="/trip-mode" style={navMini}>◉ Trip Mode</a>
                        <a href="/trip-book" style={navMini}>📖 Book</a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* reservations & tracking */}
                <div style={{ ...glass, marginTop: 14 }}>
                  <div style={kicker}>Reservations &amp; tracking</div>
                  <div style={{ marginTop: 14, border: "1px dashed rgba(217,183,121,0.4)", borderRadius: 13, padding: "18px 16px", textAlign: "center", background: "rgba(8,19,13,0.5)" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
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
                  <button onClick={addMyTrip} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 13, border: "none", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontFamily: SANS, fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: "0 12px 30px -12px rgba(217,183,121,0.6)" }}>+ Add my trip</button>
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
    </div>
  );
}

const addBtn = { width: 46, flex: "none", border: "none", borderRadius: 12, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", fontSize: "1.15rem", cursor: "pointer", fontWeight: 700 };
const stepBtn = { width: 22, height: 22, flex: "none", borderRadius: 7, border: "1px solid rgba(217,183,121,0.3)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontSize: 13, lineHeight: 1, cursor: "pointer", fontFamily: SANS };
const navMini = { flex: 1, textAlign: "center", textDecoration: "none", padding: "8px 4px", borderRadius: 9, border: "1px solid rgba(217,183,121,0.16)", background: "rgba(255,255,255,.03)", color: "#aab0ba", fontFamily: SANS, fontSize: 10.5, fontWeight: 600 };
