"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

// Step-by-step trip SETUP wizard (popup). Phase 1: Trip Details → Transportation.
// It answers the "fixed settings before we start the trip" questions one at a time,
// then hands the values back to BuildTripApp (which wires them into dates + budget).
// Roadmap (later phases): AI reservation-PDF extraction, per-state lodging tax,
// restaurants by point, interests from Park Buddy data, day-structured itinerary.

// Approximate average regular-gas price ($/gal) — editable in the UI. A rough
// regional guide, not a live quote (labelled "approx" everywhere it's shown).
const GAS = { _def: 3.35, CA: 4.75, HI: 4.70, WA: 4.35, OR: 4.05, NV: 4.15, AK: 3.95, AZ: 3.55, ID: 3.60, UT: 3.45, CO: 3.40, MT: 3.45, WY: 3.35, NM: 3.30, TX: 3.05, FL: 3.35, NY: 3.55, PA: 3.55, IL: 3.65, ME: 3.45, MI: 3.45 };
// Rough combined MPG by vehicle type (RV/truck are thirsty; used for fuel math).
const CAR_MPG = { Compact: 32, "Midsize SUV": 25, "Full-size SUV": 18, Minivan: 22, "Pickup truck": 18, "RV / Camper": 8, "My own car": 26 };
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const TYPES = [
  { id: "own", ic: "🚗", label: "My own car", sub: "Just estimate fuel" },
  { id: "rental", ic: "🚙", label: "Rental car", sub: "Day rate + fuel" },
  { id: "fly", ic: "✈️", label: "Fly in, then rent", sub: "Flight + rental" },
  { id: "rv", ic: "🚐", label: "RV / Camper", sub: "Higher fuel use" },
];

export default function TripSetupWizard({ open, onClose, initial, miles, mainState, onSave }) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [v, setV] = useState(initial);
  useEffect(() => { setMounted(true); }, []);
  // Re-seed from the latest values whenever the wizard is (re)opened.
  useEffect(() => { if (open) { setV(initial); setStep(0); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const set = (patch) => setV((s) => ({ ...s, ...patch }));

  const days = useMemo(() => {
    if (!v.startDate || !v.endDate) return 0;
    const a = new Date(v.startDate + "T12:00:00"), b = new Date(v.endDate + "T12:00:00");
    return Math.max(0, Math.round((b - a) / 86400000)) + 1;
  }, [v.startDate, v.endDate]);

  const fuelState = v.fuelState || mainState || "";
  const gas = GAS[fuelState] || GAS._def;
  const mpg = v.transportType === "rv" ? CAR_MPG["RV / Camper"] : (CAR_MPG[v.carType] || 25);
  const estFuel = miles && mpg ? Math.round((miles / mpg) * gas) : 0;

  if (!open || !mounted) return null;

  const STEPS = ["Trip details", "Transportation"];
  const last = step === STEPS.length - 1;

  const finish = () => {
    onSave({ ...v, fuelState, fuelEstimate: v.fuelManual != null ? v.fuelManual : estFuel, days });
    onClose();
  };

  const kicker = { fontFamily: "var(--pb-mono,monospace)", fontSize: ".56rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-gold-soft)" };
  const label = { fontSize: ".66rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--pb-muted)", display: "block", marginBottom: 6 };
  const box = { padding: "11px 13px", border: "1.5px solid var(--pb-line-strong)", borderRadius: 12, fontSize: ".9rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.04)", fontFamily: "inherit", boxSizing: "border-box", width: "100%", colorScheme: "dark" };
  const field = { display: "block" };

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,10,8,.72)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(12px,5vh,60px) 14px", overflowY: "auto", fontFamily: "var(--pb-sans)" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "linear-gradient(180deg,var(--pb-surface),var(--pb-bg))", border: "1px solid var(--pb-line-strong)", borderRadius: 22, boxShadow: "0 40px 100px -40px rgba(0,0,0,.9)", overflow: "hidden" }}>
        {/* header + progress */}
        <div style={{ padding: "18px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={kicker}>Set up your trip · step {step + 1} of {STEPS.length}</div>
            <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "rgba(255,255,255,.04)", color: "var(--pb-ink-2)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? "var(--pb-grad-gold)" : "rgba(255,255,255,.08)" }} />
            ))}
          </div>
          <h2 style={{ fontFamily: "var(--pb-serif)", fontWeight: 800, fontSize: "1.5rem", color: "var(--pb-ink)", marginTop: 14 }}>{STEPS[step]}</h2>
        </div>

        <div style={{ padding: "6px 20px 4px", display: "flex", flexDirection: "column", gap: 14 }}>
          {step === 0 && (
            <>
              <label style={field}><span style={label}>Trip name</span>
                <input value={v.tripName || ""} onChange={(e) => set({ tripName: e.target.value })} placeholder="Name your trip" style={box} />
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={{ ...field, flex: "1 1 150px" }}><span style={label}>Start date</span>
                  <input type="date" value={v.startDate || ""} onChange={(e) => set({ startDate: e.target.value })} style={box} />
                </label>
                <label style={{ ...field, flex: "1 1 150px" }}><span style={label}>End date</span>
                  <input type="date" min={v.startDate || undefined} value={v.endDate || ""} onChange={(e) => set({ endDate: e.target.value })} style={box} />
                </label>
              </div>
              <div style={{ fontSize: ".82rem", color: days ? "var(--pb-gold-soft)" : "var(--pb-muted)", fontWeight: 600 }}>
                {days ? days + " day" + (days === 1 ? "" : "s") + " on the road" : "Pick your start and end dates."}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {TYPES.map((t) => {
                  const on = v.transportType === t.id;
                  return (
                    <button key={t.id} onClick={() => set({ transportType: t.id })} style={{ cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 14, border: "1.5px solid " + (on ? "var(--pb-gold)" : "var(--pb-line-strong)"), background: on ? "linear-gradient(145deg,rgba(232,207,154,.14),rgba(217,183,121,.05))" : "rgba(255,255,255,.03)", fontFamily: "inherit" }}>
                      <span style={{ fontSize: "1.35rem" }}>{t.ic}</span>
                      <span style={{ lineHeight: 1.2 }}><b style={{ display: "block", color: "var(--pb-ink)", fontSize: ".9rem" }}>{t.label}</b><span style={{ fontSize: ".72rem", color: "var(--pb-muted)" }}>{t.sub}</span></span>
                    </button>
                  );
                })}
              </div>

              {v.transportType === "fly" && (
                <label style={field}><span style={label}>Flight number(s)</span>
                  <input value={v.flightNo || ""} onChange={(e) => set({ flightNo: e.target.value })} placeholder="e.g. DL1423, AS12" style={box} />
                  <span style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 5, display: "block" }}>We'll use this to send checklist reminders and flag schedule changes before you fly. (Notifications coming soon.)</span>
                </label>
              )}

              {(v.transportType === "rental" || v.transportType === "fly") && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ ...field, flex: "1 1 120px" }}><span style={label}>Rate / day</span>
                    <input type="number" min="0" value={v.rentalDaily ?? ""} onChange={(e) => set({ rentalDaily: e.target.value === "" ? null : Math.max(0, +e.target.value) })} placeholder="$" style={box} />
                  </label>
                  <label style={{ ...field, flex: "1 1 150px" }}><span style={label}>Booked where</span>
                    <input value={v.rentalWhere || ""} onChange={(e) => set({ rentalWhere: e.target.value })} placeholder="Hertz, Turo…" style={box} />
                  </label>
                </div>
              )}

              {(v.transportType === "own" || v.transportType === "rental" || v.transportType === "fly") && (
                <label style={field}><span style={label}>Vehicle type</span>
                  <select value={v.carType || "Midsize SUV"} onChange={(e) => set({ carType: e.target.value, fuelManual: null })} style={box}>
                    {["Compact", "Midsize SUV", "Full-size SUV", "Minivan", "Pickup truck"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              )}

              {(v.transportType === "rental" || v.transportType === "fly") && (
                <div style={{ fontSize: ".74rem", color: "var(--pb-muted)", background: "rgba(255,255,255,.03)", border: "1px dashed var(--pb-line-strong)", borderRadius: 10, padding: "9px 11px" }}>
                  📄 Already booked? Uploading the reservation PDF to auto-fill the car, dates and price is <b style={{ color: "var(--pb-gold-soft)" }}>coming soon</b>.
                </div>
              )}

              {/* Fuel estimate — for every mode. */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ ...field, flex: "1 1 130px" }}><span style={label}>Fuel region (state)</span>
                  <select value={fuelState} onChange={(e) => set({ fuelState: e.target.value })} style={box}>
                    <option value="">National avg</option>
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label style={{ ...field, flex: "1 1 130px" }}><span style={label}>Est. fuel (whole trip)</span>
                  <input type="number" min="0" value={v.fuelManual != null ? v.fuelManual : estFuel} onChange={(e) => set({ fuelManual: e.target.value === "" ? null : Math.max(0, +e.target.value) })} style={box} />
                </label>
              </div>
              <div style={{ fontSize: ".72rem", color: "var(--pb-muted)" }}>
                Approx from {miles || 0} mi ÷ {mpg} mpg × ${gas.toFixed(2)}/gal{fuelState ? " (" + fuelState + ")" : ""}. Editable — it feeds your budget.
              </div>
            </>
          )}
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--pb-line)", marginTop: 10 }}>
          {step > 0
            ? <button onClick={() => setStep(step - 1)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".85rem", fontWeight: 700, color: "var(--pb-ink-2)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "11px 18px" }}>← Back</button>
            : <button onClick={onClose} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".85rem", fontWeight: 700, color: "var(--pb-ink-2)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "11px 18px" }}>Skip for now</button>}
          <button onClick={() => (last ? finish() : setStep(step + 1))} style={{ flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: ".85rem", fontWeight: 800, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "11px 18px" }}>
            {last ? "Done — build my trip ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
