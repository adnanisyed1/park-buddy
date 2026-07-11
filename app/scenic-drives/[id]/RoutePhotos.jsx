"use client";

// Photo gallery built at generation time from the byway's Wikimedia Commons category
// (+ file search) — real, on-topic images of the drive, stored as URLs so they always
// render (no client-side lookup that can silently resolve to nothing). Commons CC.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

export default function RoutePhotos({ photos }) {
  const list = (photos || []).filter((p) => p && p.url).slice(0, 18);
  if (list.length < 3) return null;
  return (
    <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Photos along the drive</h2>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{list.length} photos · Wikimedia Commons</span>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {list.map((p, i) => (
            <figure key={i} style={{ position: "relative", margin: 0, aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(217,183,121,.14)", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }}>
              <img src={p.url} alt={p.cap || ""} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.02) 45%,rgba(9,24,16,.84) 100%)" }} />
              {p.cap && <figcaption style={{ position: "absolute", left: 11, right: 11, bottom: 9, fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: ".9rem", lineHeight: 1.15, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{p.cap}</figcaption>}
              {p.credit && <span style={{ position: "absolute", right: 8, top: 8, background: "rgba(15,32,24,.7)", color: "rgba(240,225,190,.85)", fontSize: ".5rem", borderRadius: 6, padding: "2px 6px", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>© {p.credit}</span>}
            </figure>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 12 }}>Photos via Wikimedia Commons — licensed to their respective authors.</div>
      </div>
    </section>
  );
}
