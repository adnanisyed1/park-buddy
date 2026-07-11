"use client";

import { useRef } from "react";
import { usePhoto } from "../../components/PhotoThumb";

// A photo gallery built from the drive's real places — its towns and its marquee
// scenic POIs (passes, overlooks, lakes, waterfalls, peaks). Each name resolves to
// a Wikimedia Commons image through the shared photo pipeline, so it's the same
// license-clean source as the rest of the site. Tiles that don't resolve drop out.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

function Tile({ q, cap, kind }) {
  const ref = useRef(null);
  const photo = usePhoto(q, null, null, ref); // ref → only fetches when scrolled near
  return (
    <figure ref={ref} style={{ position: "relative", margin: 0, aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(217,183,121,.14)", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)", display: photo && photo.url ? "block" : "none" }}>
      {photo && photo.url && <img src={photo.url} alt={cap} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.02) 45%,rgba(9,24,16,.82) 100%)" }} />
      {kind && <span style={{ position: "absolute", left: 9, top: 9, background: "rgba(21,36,28,.82)", color: "var(--pb-gold-soft)", fontFamily: mono, fontSize: ".5rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", borderRadius: 999, padding: "3px 8px" }}>{kind}</span>}
      <figcaption style={{ position: "absolute", left: 11, right: 11, bottom: 10, fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: ".92rem", lineHeight: 1.15, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{cap}</figcaption>
    </figure>
  );
}

export default function RoutePhotos({ items }) {
  const list = (items || []).slice(0, 18);
  if (!list.length) return null;
  return (
    <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Photos along the drive</h2>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>The places you&rsquo;ll pass · via Wikimedia</span>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {list.map((it, i) => <Tile key={i} q={it.q} cap={it.cap} kind={it.kind} />)}
        </div>
      </div>
    </section>
  );
}
