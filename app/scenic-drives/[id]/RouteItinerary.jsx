"use client";

// Traveler-friendly route timeline built from a byway's Wikipedia junction list
// (parsed + transformed by scripts/build-byway-details.mjs). Reads as "what you
// pass, in order" — towns and landmarks down the road with cumulative miles and
// distance-to-next — deliberately NOT the raw engineering junction table.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const KIND = {
  terminus: { dot: "#e8cf9a", ring: "#0a1712", label: "Start / End", chip: "rgba(232,207,154,.16)", chipInk: "var(--pb-gold-soft)" },
  "park-entrance": { dot: "#1d4a37", ring: "#e8cf9a", label: "Park entrance", chip: "rgba(29,74,55,.34)", chipInk: "#8fe0b4" },
  crossing: { dot: "#2f6d7a", ring: "#0a1712", label: "Crossing", chip: "rgba(47,109,122,.28)", chipInk: "#8fd3e0" },
  town: { dot: "#b3862d", ring: "#0a1712", label: "Town", chip: "rgba(179,134,45,.2)", chipInk: "var(--pb-gold-soft)" },
};

export default function RouteItinerary({ itinerary, hoverKey, onHover }) {
  const stops = (itinerary || []).filter((s) => s && s.place);
  if (stops.length < 2) return null;
  const total = stops[stops.length - 1].mileFromStart;
  const hover = (k) => onHover && onHover(k);

  return (
    <div style={{ marginTop: 16, position: "relative", background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 24, padding: "clamp(18px,2.6vw,28px)", boxShadow: "0 22px 54px -34px rgba(28,46,34,.5)" }}>
      <div style={{ position: "relative" }}>
        {/* the road line */}
        <div style={{ position: "absolute", left: 15, top: 14, bottom: 14, width: 2, background: "linear-gradient(180deg,rgba(217,183,121,.5),rgba(217,183,121,.12))" }} />
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {stops.map((s, i) => {
            const k = KIND[s.kind] || KIND.town;
            const onMap = s.lat != null;
            const active = hoverKey != null && s.seq === hoverKey;
            return (
              <li key={i}
                onMouseEnter={() => onMap && hover(s.seq)} onMouseLeave={() => onMap && hover(null)}
                style={{ position: "relative", display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, alignItems: "start", padding: "10px 12px", margin: "0 -12px", borderRadius: 14, cursor: onMap ? "default" : "auto", background: active ? "rgba(232,207,154,.1)" : "transparent", transition: "background .18s" }}>
                <span aria-hidden style={{ position: "relative", zIndex: 1, width: 32, height: 32, borderRadius: "50%", background: active ? "#1d4a37" : k.dot, border: "2px solid " + (active ? "#e8cf9a" : k.ring), color: active ? "#fff" : "var(--pb-bg)", fontFamily: mono, fontSize: ".72rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? "0 0 0 4px rgba(232,207,154,.25)" : "0 4px 12px -4px rgba(0,0,0,.5)", transition: "background .18s,box-shadow .18s" }}>{s.seq}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <b style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.12rem", color: "var(--pb-ink)", lineHeight: 1.15 }}>{s.place}</b>
                    {s.mileFromStart != null && (
                      <span style={{ fontFamily: mono, fontSize: ".62rem", fontWeight: 700, letterSpacing: ".06em", color: "var(--pb-gold-soft)", background: "var(--pb-surface-2)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 999, padding: "2px 9px" }}>MI {s.mileFromStart.toFixed(1)}</span>
                    )}
                    <span style={{ fontFamily: mono, fontSize: ".52rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: k.chipInk, background: k.chip, borderRadius: 999, padding: "3px 9px" }}>{k.label}</span>
                  </div>
                  {s.note && <div style={{ fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.5, marginTop: 4 }}>{s.note}</div>}
                  {s.control && s.control.length > 0 && s.kind !== "terminus" && (
                    <div style={{ fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 3 }}>Toward {s.control.slice(0, 3).join(" · ")}</div>
                  )}
                  {s.toNextMi != null && (
                    <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ opacity: .5 }}>↓</span>{s.toNextMi.toFixed(1)} mi to next
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {total != null && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(217,183,121,.14)", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)" }}>
          {stops.length} stops · ~{Math.round(total)} miles end to end
        </div>
      )}
    </div>
  );
}
