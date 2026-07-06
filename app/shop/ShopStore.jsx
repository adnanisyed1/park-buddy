"use client";

// /shop — affiliate store, ported 1:1 from shop-preview.html. HONESTY ADAPTATION:
// the design showed prices on "Park Buddy Originals", but our print-on-demand
// store isn't live yet — showing a price would be inventing one, so Originals
// read "Coming soon" (no fabricated $). The DEPARTMENTS are affiliate hand-offs
// to real partners (REI, Garmin, Nat Geo, B&H, Recreation.gov) and deep-link to
// their real search. No invented reviews or ratings.

import { useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { usePhoto } from "../components/PhotoThumb";

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const ORIGINALS = [
  { t: "Zion WPA Poster", q: "Zion National Park", tag: "Print" },
  { t: "Yosemite WPA Poster", q: "Yosemite National Park", tag: "Print" },
  { t: "Trailhead Tee", q: "Hiking", tag: "Apparel" },
  { t: "Park Buddy Gift Card", q: "Rocky Mountain National Park", tag: "Gift" },
];

const DEPTS = [
  { ic: "🎟", t: "Passes", d: "America the Beautiful annual pass + park-specific passes.", q: "Grand Canyon National Park", cta: "Shop passes", partner: "Recreation.gov", url: "https://www.recreation.gov/collections/annualpasses" },
  { ic: "🎒", t: "Gear & apparel", d: "Packs, layers, rain shells and trail footwear.", q: "Backpacking", cta: "Shop gear", partner: "REI · Backcountry", url: "https://www.rei.com/c/backpacks" },
  { ic: "⛺", t: "Camp & cook", d: "Tents, sleeping bags, stoves and coolers.", q: "Camping", cta: "Shop camp", partner: "REI", url: "https://www.rei.com/c/camping-and-hiking" },
  { ic: "🧭", t: "Navigation & safety", d: "GPS units, satellite messengers, headlamps, first-aid, bear spray.", q: "Garmin inReach", cta: "Shop safety", partner: "Garmin", url: "https://www.garmin.com/en-US/c/outdoor-recreation/handheld-hiking-gps/" },
  { ic: "🗺", t: "Maps & guides", d: "Topo maps, park maps and trusted guidebooks.", q: "Topographic map", cta: "Shop maps", partner: "Nat Geo", url: "https://www.natgeomaps.com/" },
  { ic: "🔭", t: "Optics & cameras", d: "Binoculars, spotting scopes and trail cameras.", q: "Binoculars", cta: "Shop optics", partner: "B&H", url: "https://www.bhphotovideo.com/c/buy/Binoculars/ci/303/N/4294551149" },
];

function useReveal(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(".pb-rise");
    if (typeof IntersectionObserver === "undefined") { els.forEach((e) => e.classList.add("pb-rise-in")); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("pb-rise-in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  });
}

const hatch = "repeating-linear-gradient(135deg,#16321f 0 12px,#12291a 12px 24px)";

function OriginalCard({ o, i }) {
  const photo = usePhoto(o.q, null, null);
  return (
    <div className="pb-rise" style={{ transitionDelay: i * 0.05 + "s", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 18, overflow: "hidden" }}>
      <figure style={{ position: "relative", aspectRatio: "4 / 5", margin: 0, overflow: "hidden", background: hatch }}>
        {photo && photo.url && <img alt={o.t} src={photo.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <span style={{ position: "absolute", left: 10, top: 10, fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "3px 9px" }}>{o.tag}</span>
      </figure>
      <div style={{ padding: "13px 14px" }}>
        <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.12rem", lineHeight: 1.1, color: "var(--pb-ink)" }}>{o.t}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Park Buddy original</span>
          <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "4px 9px" }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}

function DeptCard({ c, i }) {
  const photo = usePhoto(c.q, null, null);
  return (
    <div className="pb-rise" style={{ transitionDelay: i * 0.05 + "s", display: "flex", flexDirection: "column", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 20, overflow: "hidden" }}>
      <figure style={{ position: "relative", aspectRatio: "16 / 9", margin: 0, overflow: "hidden", background: hatch }}>
        {photo && photo.url && <img alt={c.t} src={photo.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.1) 40%,rgba(8,19,13,.85))" }} />
        <span style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(10,23,18,.7)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{c.ic}</span>
          <b style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.35rem", color: "#f7f4ec", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{c.t}</b>
        </span>
      </figure>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ flex: 1, fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.55, fontWeight: 300 }}>{c.d}</p>
        <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 10 }}>via {c.partner}</div>
        <button onClick={() => window.open(c.url, "_blank", "noopener,noreferrer")} style={{ cursor: "pointer", width: "100%", marginTop: 12, fontSize: ".85rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: 11, fontFamily: "inherit" }}>{c.cta} ↗</button>
      </div>
    </div>
  );
}

export default function ShopStore() {
  const rootRef = useRef(null);
  useReveal(rootRef);

  return (
    <div ref={rootRef} style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        .pb-rise { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.16,.8,.24,1), transform .7s cubic-bezier(.16,.8,.24,1); }
        .pb-rise.pb-rise-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .pb-rise { opacity: 1; transform: none; } }
      `}</style>

      <SiteHeader active="shop" acctSlot />

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(90px,12vh,130px) clamp(16px,4vw,40px) clamp(28px,4vh,44px)", background: "radial-gradient(1100px 420px at 74% -10%,rgba(217,183,121,.12),transparent 60%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="pb-rise" style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".26em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>The Park Buddy shop</div>
          <h1 className="pb-rise" style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: 1, letterSpacing: "-.02em", marginTop: 12, maxWidth: "16ch" }}>Carry the wild <em style={{ fontStyle: "italic", color: "var(--pb-gold)" }}>home.</em></h1>
          <p className="pb-rise" style={{ maxWidth: 560, color: "var(--pb-ink-2)", fontSize: "1.02rem", lineHeight: 1.6, fontWeight: 300, marginTop: 14 }}>Gear tested on the trail, passes that open every gate, and prints worth framing. Curated, honest, and shipped by trusted partners.</p>
        </div>
      </section>

      {/* FEATURED ORIGINALS */}
      <section style={{ padding: "clamp(14px,2vh,26px) clamp(16px,4vw,40px) clamp(20px,3vh,36px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="pb-rise" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3vw,2rem)" }}>Park Buddy Originals</h2>
            <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Designed in-house</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            {ORIGINALS.map((o, i) => <OriginalCard key={o.t} o={o} i={i} />)}
          </div>
        </div>
      </section>

      {/* DEPARTMENTS */}
      <section style={{ padding: "clamp(20px,3vh,40px) clamp(16px,4vw,40px) clamp(30px,5vh,60px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="pb-rise" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3vw,2rem)" }}>Shop by department</h2>
            <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Affiliate · partner-fulfilled</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {DEPTS.map((c, i) => <DeptCard key={c.t} c={c} i={i} />)}
          </div>
          <p className="pb-rise" style={{ textAlign: "center", fontFamily: mono, fontSize: ".58rem", letterSpacing: ".05em", color: "var(--pb-muted)", marginTop: 22, lineHeight: 1.6 }}>Prices &amp; stock come live from each partner at checkout. Park Buddy may earn a commission — it never changes your price.<br />We show real products only; no invented reviews or ratings.</p>
        </div>
      </section>

      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px,4vh,44px) clamp(16px,4vw,40px)" }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 22, fontFamily: mono, fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", lineHeight: 1.7, textAlign: "center" }}>Fulfilled by REI · Garmin · Backcountry &amp; partners · America the Beautiful pass via Recreation.gov · Affiliate links disclosed · Park Buddy</div>
      </footer>
    </div>
  );
}
