"use client";

import { useState } from "react";
import Link from "next/link";
import { usePhoto } from "./PhotoThumb";
import SiteHeader from "./SiteHeader";
import { Button, Tag } from "./ui";

// Reusable category landing for filter choices that don't have a global dataset
// yet. Two honest modes:
//   mode="map"  — the data exists per-location (Lakes, Campgrounds); CTA sends to
//                 the live map, with a note that a curated index is coming.
//   mode="soon" — genuinely not built yet (Off-road/OHV, Ski); "Coming soon" +
//                 an email notify capture.
// Built on the design tokens + SiteHeader + UI kit, so every filter choice has a
// real, on-brand page today. Photos are name-only (no geo junk).

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

export default function CategoryPage({ eyebrow, title, emphasis, blurb, photoQ, mode = "soon", mapHref = "/explore", features = [] }) {
  const hero = usePhoto(photoQ, null, null);
  const [sent, setSent] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader active="explore" />

      <section style={{ position: "relative", minHeight: "min(84vh,720px)", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden", padding: "120px clamp(16px,4vw,54px) 64px" }}>
        <div style={{ position: "absolute", inset: 0, background: "var(--pb-surface)" }}>
          {hero && hero.url && <img alt="" src={hero.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: .5, filter: "saturate(1.1)" }} />}
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,23,18,.55),rgba(10,23,18,.35) 40%,rgba(10,23,18,.82))" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 12%,transparent 40%,rgba(7,10,16,.6) 100%)" }} />

        <div style={{ position: "relative", zIndex: 3, maxWidth: 900, margin: "0 auto", width: "100%", textAlign: "center" }}>
          {mode === "soon" && <div style={{ marginBottom: 18 }}><Tag>Coming soon</Tag></div>}
          <div style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".28em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>{eyebrow}</div>
          <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2.6rem,7vw,5.4rem)", lineHeight: 1, letterSpacing: "-.02em", marginTop: 18 }}>
            {title} {emphasis && <em style={{ fontStyle: "italic", background: "linear-gradient(110deg,#f0dcae,#c9a35f)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{emphasis}</em>}
          </h1>
          <p style={{ maxWidth: 560, margin: "22px auto 0", fontSize: "clamp(1rem,1.5vw,1.15rem)", lineHeight: 1.7, color: "var(--pb-ink-2)", fontWeight: 300 }}>{blurb}</p>

          {features.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 24 }}>
              {features.map((f) => <span key={f} style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-ink-2)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 14px" }}>{f}</span>)}
            </div>
          )}

          <div style={{ marginTop: 34, display: "flex", justifyContent: "center" }}>
            {mode === "map" ? (
              <Button as={Link} href={mapHref}>Explore on the live map →</Button>
            ) : sent ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 9, color: "var(--pb-go)", fontWeight: 600 }}>✓ You&apos;re on the list — we&apos;ll tell you the moment it opens.</div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <input type="email" required placeholder="Email me when it's live" className="pb-input" style={{ width: "min(280px,70vw)", borderRadius: 999 }} />
                <Button type="submit">Notify me</Button>
              </form>
            )}
          </div>
          {mode === "map" && <div style={{ marginTop: 14, fontFamily: mono, fontSize: ".6rem", letterSpacing: ".06em", color: "var(--pb-muted)" }}>A curated index is on the way — for now, browse them live on the map.</div>}
        </div>
      </section>
    </div>
  );
}
