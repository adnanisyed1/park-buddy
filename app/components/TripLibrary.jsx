"use client";

import { useEffect, useState } from "react";
import { getSavedTrips, subscribeSavedTrips, saveCurrentTrip, openSavedTrip, deleteSavedTrip, duplicateSavedTrip, renameSavedTrip } from "../lib/savedTrips";
import { getMeta, getStops } from "../lib/trip";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const ghost = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".76rem", color: "var(--pb-ink-2)", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "6px 12px" };

function fmtDates(meta) {
  const s = meta && meta.startDate, e = meta && meta.endDate;
  try {
    if (!s) return "";
    const a = new Date(s + "T12:00:00"), o = { month: "short", day: "numeric" };
    if (e) { const b = new Date(e + "T12:00:00"); return a.toLocaleDateString([], o) + " – " + b.toLocaleDateString([], { ...o, year: "numeric" }); }
    return a.toLocaleDateString([], { ...o, year: "numeric" });
  } catch { return ""; }
}
function fmtSaved(ts) { try { return "Saved " + new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" }); } catch { return ""; } }

// Named-itinerary library: save the current trip, search saved ones, open/duplicate/
// rename/delete. Shared by the account panel ("My Itineraries") and the /trips page.
export default function TripLibrary({ onNavigate }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [cur, setCur] = useState({ name: "", count: 0 });

  useEffect(() => {
    const sync = () => setList(getSavedTrips());
    sync();
    const un = subscribeSavedTrips(sync);
    try { setCur({ name: (getMeta() || {}).tripName || "Current trip", count: (getStops() || []).length }); } catch {}
    return un;
  }, []);

  const filtered = list.filter((t) => (t.name || "").toLowerCase().includes(q.trim().toLowerCase()));
  const saveNow = () => { const e = saveCurrentTrip(); setMsg("Saved “" + e.name + "”"); setTimeout(() => setMsg(""), 2600); };
  const open = (id) => { if (openSavedTrip(id)) { if (onNavigate) onNavigate(); if (typeof window !== "undefined") window.location.href = "/build-trip"; } };
  const doRename = (id) => { renameSavedTrip(id, renameVal); setRenameId(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Save the current trip */}
      <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 16, padding: "14px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Current trip</div>
            <div style={{ fontFamily: serif, fontSize: "1.1rem", fontWeight: 700, color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur.name || "Untitled trip"}</div>
            <div style={{ fontSize: ".74rem", color: "var(--pb-muted)" }}>{cur.count} stop{cur.count === 1 ? "" : "s"}</div>
          </div>
          <button onClick={saveNow} style={{ flex: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: ".82rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "10px 18px" }}>💾 Save trip</button>
        </div>
        {msg && <div style={{ fontSize: ".78rem", color: "var(--pb-go)", fontWeight: 600, marginTop: 8 }}>{msg} ✓</div>}
      </div>

      {/* Search */}
      {list.length > 0 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={"Search your " + list.length + " saved trip" + (list.length === 1 ? "" : "s") + "…"}
          style={{ width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 11, padding: "11px 13px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".9rem", outline: "none", boxSizing: "border-box" }} />
      )}

      {/* Saved list */}
      {list.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--pb-muted)", fontSize: ".9rem", lineHeight: 1.6, padding: "18px 8px" }}>
          No saved trips yet. Build an itinerary, then tap <b style={{ color: "var(--pb-gold-soft)" }}>Save trip</b> above to keep it here and reopen it anytime.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--pb-muted)", fontSize: ".88rem", padding: "12px" }}>No trips match “{q}”.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((t) => {
            const stops = t.stops || [];
            const names = stops.map((s) => s.name).filter(Boolean);
            return (
              <div key={t.id} style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 14, padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  {renameId === t.id ? (
                    <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doRename(t.id); if (e.key === "Escape") setRenameId(null); }} onBlur={() => doRename(t.id)}
                      style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-gold)", borderRadius: 8, padding: "5px 9px", color: "var(--pb-ink)", fontFamily: serif, fontSize: "1.02rem", fontWeight: 700, outline: "none" }} />
                  ) : (
                    <button onClick={() => open(t.id)} title="Open this itinerary" style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", background: "transparent", border: "none", padding: 0, fontFamily: serif, fontSize: "1.08rem", fontWeight: 700, color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</button>
                  )}
                  <button onClick={() => open(t.id)} style={{ flex: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".76rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "6px 13px" }}>Open →</button>
                </div>
                <div style={{ fontSize: ".76rem", color: "var(--pb-muted)", marginTop: 5 }}>
                  {stops.length} stop{stops.length === 1 ? "" : "s"}{fmtDates(t.meta) ? " · " + fmtDates(t.meta) : ""} · {fmtSaved(t.savedAt)}
                </div>
                {names.length > 0 && (
                  <div style={{ fontSize: ".78rem", color: "var(--pb-ink-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.slice(0, 5).join(" → ")}{names.length > 5 ? " …" : ""}</div>
                )}
                <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
                  <button onClick={() => { setRenameId(t.id); setRenameVal(t.name); }} style={ghost}>Rename</button>
                  <button onClick={() => duplicateSavedTrip(t.id)} style={ghost}>Duplicate</button>
                  <button onClick={() => { if (typeof window === "undefined" || window.confirm("Delete “" + t.name + "”?")) deleteSavedTrip(t.id); }} style={{ ...ghost, color: "var(--pb-hold)", marginLeft: "auto" }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
