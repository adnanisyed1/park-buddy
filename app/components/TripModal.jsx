"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getStops, getMeta, setMeta, removeStop, setNights, moveStop, subscribeTrip } from "../lib/trip";

// The platform-wide trip planner, in a dialog. It opens automatically whenever
// anything is added to the trip (the `pb:trip` event with detail.added), and on
// demand when the header's "My Trip" pill dispatches `pb:trip-open`. Inline it
// carries the real planner essentials — reorder stops, set nights, name the trip,
// pick a start date + travellers — and links out to /build-trip for the full
// map + budget + share view. One store (app/lib/trip.js) backs both.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

function nightsLabel(n) { return n === 1 ? "1 night" : n + " nights"; }

export default function TripModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stops, setStops] = useState([]);
  const [meta, setMetaState] = useState({ tripName: "", startDate: "", travelers: 2 });
  const [justAdded, setJustAdded] = useState(null);

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
