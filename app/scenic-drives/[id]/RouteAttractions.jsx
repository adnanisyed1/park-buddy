"use client";

import { useState } from "react";

// Every roadside attraction along the drive, from OpenStreetMap (ODbL) — overlooks,
// passes, campgrounds, waterfalls, lakes, peaks, trailheads — ordered by mile, with
// category filters. This is the scenic layer a road's junction list can't give you.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const CAT = {
  overlook: { color: "#e8cf9a", ic: "◉", label: "Overlooks" },
  pass: { color: "#d99a4e", ic: "▲", label: "Passes" },
  campground: { color: "#4f9d69", ic: "⌂", label: "Campgrounds" },
  waterfall: { color: "#5aa9d6", ic: "≋", label: "Waterfalls" },
  lake: { color: "#3f8fa0", ic: "◐", label: "Lakes" },
  peak: { color: "#a7adb3", ic: "△", label: "Peaks" },
  trailhead: { color: "#b3862d", ic: "⇡", label: "Trailheads" },
  "rest area": { color: "#7a5a2f", ic: "▤", label: "Rest areas" },
};
const meta = (t) => CAT[t] || CAT.overlook;

export default function RouteAttractions({ pois }) {
  const list = (pois || []).filter((p) => p && p.name && p.lat != null);
  const [off, setOff] = useState(() => new Set()); // categories toggled off
  if (list.length < 3) return null;

  const counts = {};
  list.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const shown = list.filter((p) => !off.has(p.type));
  const toggle = (c) => setOff((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  return (
    <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Scenic stops &amp; attractions</h2>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{list.length} points · from OpenStreetMap</span>
        </div>

        {/* category filter chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {cats.map((c) => {
            const m = meta(c), active = !off.has(c);
            return (
              <button key={c} onClick={() => toggle(c)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "6px 12px", fontFamily: "inherit", fontSize: ".76rem", fontWeight: 700, color: active ? "var(--pb-ink)" : "var(--pb-muted)", background: active ? "var(--pb-surface)" : "transparent", border: "1px solid " + (active ? m.color : "rgba(217,183,121,.18)"), opacity: active ? 1 : 0.55, transition: "all .15s" }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: m.color, flex: "none", boxShadow: "0 0 0 2px rgba(10,23,18,.5)" }} />
                {m.label}<span style={{ color: "var(--pb-muted)", fontWeight: 600 }}>{counts[c]}</span>
              </button>
            );
          })}
        </div>

        {/* mile-ordered list */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
          {shown.map((p, i) => {
            const m = meta(p.type);
            const ft = p.ele ? Math.round(p.ele * 3.281) : null;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.14)", borderRadius: 14, padding: "11px 14px" }}>
                <span aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: 10, background: m.color, color: "#0a1712", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 800 }}>{m.ic}</span>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <b style={{ fontFamily: serif, fontWeight: 700, fontSize: ".98rem", color: "var(--pb-ink)", lineHeight: 1.2, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</b>
                  <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 2 }}>
                    {meta(p.type).label.replace(/s$/, "")}{ft ? " · " + ft.toLocaleString() + " ft" : ""}
                  </div>
                </div>
                {p.mile != null && <span style={{ flex: "none", fontFamily: mono, fontSize: ".62rem", fontWeight: 700, color: "var(--pb-gold-soft)", background: "var(--pb-surface-2)", border: "1px solid rgba(217,183,121,.18)", borderRadius: 999, padding: "3px 9px" }}>MI {p.mile.toFixed(1)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
