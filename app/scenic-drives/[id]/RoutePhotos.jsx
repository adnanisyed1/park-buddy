"use client";

import { useEffect, useState } from "react";

// Photo gallery built at generation time from the byway's Wikimedia Commons category
// (+ file search) — real, on-topic images of the drive, stored as URLs. Click a photo
// to open a lightbox with the full image, its Commons description, and credit.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

export default function RoutePhotos({ photos }) {
  const list = (photos || []).filter((p) => p && p.url).slice(0, 18);
  const [open, setOpen] = useState(null); // index of the open photo, or null
  const cur = open != null ? list[open] : null;

  useEffect(() => {
    if (open == null) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(null); else if (e.key === "ArrowRight") setOpen((i) => (i + 1) % list.length); else if (e.key === "ArrowLeft") setOpen((i) => (i - 1 + list.length) % list.length); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, list.length]);

  if (list.length < 3) return null;
  return (
    <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Photos along the drive</h2>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{list.length} photos · tap to enlarge · Wikimedia Commons</span>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {list.map((p, i) => (
            <figure key={i} onClick={() => setOpen(i)} style={{ position: "relative", margin: 0, aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(217,183,121,.14)", cursor: "zoom-in", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }}>
              <img src={p.url} alt={p.cap || ""} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.02) 45%,rgba(9,24,16,.84) 100%)" }} />
              {p.cap && <figcaption style={{ position: "absolute", left: 11, right: 11, bottom: 9, fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: ".9rem", lineHeight: 1.15, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{p.cap}</figcaption>}
              <span style={{ position: "absolute", right: 9, top: 9, width: 26, height: 26, borderRadius: "50%", background: "rgba(15,32,24,.72)", color: "var(--pb-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", fontWeight: 700 }}>⤢</span>
            </figure>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 12 }}>Photos via Wikimedia Commons — licensed to their respective authors.</div>
      </div>

      {/* LIGHTBOX */}
      {cur && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(6,14,10,.92)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px,3vw,40px)" }}>
          <button onClick={(e) => { e.stopPropagation(); setOpen(null); }} aria-label="Close" style={{ position: "absolute", top: 16, right: 18, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)", background: "rgba(15,32,24,.6)", color: "var(--pb-ink)", fontSize: "1.3rem", cursor: "pointer", zIndex: 2 }}>✕</button>
          {list.length > 1 && <button onClick={(e) => { e.stopPropagation(); setOpen((i) => (i - 1 + list.length) % list.length); }} aria-label="Previous" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)", background: "rgba(15,32,24,.6)", color: "var(--pb-ink)", fontSize: "1.4rem", cursor: "pointer" }}>‹</button>}
          {list.length > 1 && <button onClick={(e) => { e.stopPropagation(); setOpen((i) => (i + 1) % list.length); }} aria-label="Next" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)", background: "rgba(15,32,24,.6)", color: "var(--pb-ink)", fontSize: "1.4rem", cursor: "pointer" }}>›</button>}
          <figure onClick={(e) => e.stopPropagation()} style={{ margin: 0, maxWidth: "min(1100px,94vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 100px -30px rgba(0,0,0,.8)" }}>
            <img src={cur.full || cur.url} alt={cur.cap || ""} style={{ maxHeight: "70vh", width: "100%", objectFit: "contain", background: "#0a1712" }} />
            <figcaption style={{ padding: "clamp(14px,2.2vw,20px)", overflowY: "auto" }}>
              <div style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.1rem,2.2vw,1.4rem)", color: "var(--pb-ink)", lineHeight: 1.2 }}>{cur.cap}</div>
              {cur.desc && <p style={{ fontSize: ".92rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 8 }}>{cur.desc}</p>}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: ".76rem", color: "var(--pb-muted)" }}>
                {cur.credit && <span>© {cur.credit}</span>}
                {cur.pageUrl && <a href={cur.pageUrl} target="_blank" rel="noreferrer" style={{ color: "var(--pb-gold)", fontWeight: 700, textDecoration: "none" }}>View on Wikimedia Commons ↗</a>}
                <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: ".62rem" }}>{open + 1} / {list.length}</span>
              </div>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
