"use client";

// /book — booking hub, ported 1:1 from book-preview.html onto the platform.
// Park-anchored: a picker swaps the hero photo + "Book near ___". Category cards
// are affiliate/partner hand-offs — LIVE ones deep-link to the real partner
// (Recreation.gov, Booking, Rentalcars, Viator); not-yet-live show an honest
// "Coming soon / Notify me". No invented inventory, prices, or ratings.

import { useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { usePhoto } from "../components/PhotoThumb";

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const PARKS = [
  { label: "Zion", q: "Zion National Park" },
  { label: "Yosemite", q: "Yosemite National Park" },
  { label: "Glacier", q: "Glacier National Park (U.S.)" },
  { label: "Rocky Mountain", q: "Rocky Mountain National Park" },
  { label: "Grand Canyon", q: "Grand Canyon National Park" },
  { label: "Acadia", q: "Acadia National Park" },
];

function partnerUrl(kind, parkLabel) {
  const g = encodeURIComponent(parkLabel + " National Park");
  switch (kind) {
    case "stays": return "https://www.booking.com/searchresults.html?ss=" + g;
    case "camp": return "https://www.recreation.gov/search?q=" + g;
    case "cars": return "https://www.rentalcars.com/";
    case "tours": return "https://www.viator.com/searchResults/all?text=" + g;
    case "permits": return "https://www.recreation.gov/search?q=" + g;
    default: return null;
  }
}

const CATS = [
  { ic: "🏡", t: "Stays", d: "In-park lodges, cabins, vacation rentals & glamping near the gateway.", cta: "Search stays", live: true, partner: "Booking.com · Expedia", kind: "stays" },
  { ic: "🏕", t: "Campgrounds & RV", d: "Recreation.gov campsites plus private RV parks — live availability.", cta: "Check campsites", live: true, partner: "Recreation.gov", kind: "camp" },
  { ic: "🚗", t: "Rental cars", d: "For the road trip and scenic drives. Pick up near the park or airport.", cta: "Find a car", live: true, partner: "Rentalcars.com", kind: "cars" },
  { ic: "⚓", t: "Cruises", d: "Reach the parks by sea — Glacier Bay, Kenai Fjords, the Inside Passage.", cta: "Browse cruises", live: false, partner: "", href: "/cruises" },
  { ic: "🧭", t: "Tours & experiences", d: "Guided hikes, rafting, climbing guides, dive charters, ranger programs.", cta: "See experiences", live: true, partner: "Viator · local outfitters", kind: "tours" },
  { ic: "🎫", t: "Permits & reservations", d: "Timed-entry and wilderness permits — required at many parks.", cta: "Get permits", live: true, partner: "Recreation.gov", kind: "permits" },
  { ic: "🚌", t: "Shuttles & transport", d: "Park shuttles and gateway-town transfers to skip the parking scramble.", cta: "Plan transport", live: false, partner: "" },
];

// Scroll-reveal, matching the design's .bk-rise fade-up.
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

function CatCard({ c, parkLabel, i }) {
  const [notified, setNotified] = useState(false);
  const open = () => { const u = partnerUrl(c.kind, parkLabel); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  return (
    <div className="pb-rise" style={{ transitionDelay: i * 0.05 + "s", display: "flex", flexDirection: "column", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 20, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <span style={{ width: 48, height: 48, borderRadius: 13, background: "linear-gradient(150deg,rgba(232,207,154,.2),rgba(201,163,95,.08))", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>{c.ic}</span>
        {c.live ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".52rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#7fe3a6" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4fd98a", boxShadow: "0 0 6px #4fd98a" }} />Live</span>
        ) : (
          <span style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "2px 8px" }}>Coming soon</span>
        )}
      </div>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.35rem", marginTop: 14, color: "var(--pb-ink)" }}>{c.t}</h3>
      <p style={{ flex: 1, fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.55, fontWeight: 300, marginTop: 6 }}>{c.d}</p>
      {c.partner && <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 10 }}>via {c.partner}</div>}
      <div style={{ marginTop: 14 }}>
        {c.live ? (
          <button onClick={open} style={{ cursor: "pointer", width: "100%", fontSize: ".85rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: 11, fontFamily: "inherit" }}>{c.cta} ↗</button>
        ) : c.href ? (
          <a href={c.href} style={{ display: "block", textAlign: "center", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, color: "var(--pb-ink)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: 11 }}>Notify me →</a>
        ) : (
          <button onClick={() => setNotified(true)} disabled={notified} style={{ cursor: notified ? "default" : "pointer", width: "100%", fontSize: ".85rem", fontWeight: 600, color: notified ? "var(--pb-go)" : "var(--pb-ink)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: 11, fontFamily: "inherit" }}>{notified ? "✓ You're on the list" : "Notify me"}</button>
        )}
      </div>
    </div>
  );
}

export default function BookHub() {
  const rootRef = useRef(null);
  const [park, setPark] = useState(PARKS[0]);
  const [tripCount, setTripCount] = useState(0);
  const hero = usePhoto(park.q, null, null);
  useReveal(rootRef);

  useEffect(() => {
    try { const t = JSON.parse(localStorage.getItem("pb_trip") || "[]"); if (Array.isArray(t)) setTripCount(t.length); } catch {}
  }, []);

  return (
    <div ref={rootRef} style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        @keyframes bk-ken { 0% { transform: scale(1.05); } 100% { transform: scale(1.13); } }
        .pb-rise { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.16,.8,.24,1), transform .7s cubic-bezier(.16,.8,.24,1); }
        .pb-rise.pb-rise-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .pb-rise { opacity: 1; transform: none; } }
      `}</style>

      <SiteHeader active="book" tripCount={tripCount} onTripClick={() => { window.location.href = "/explore"; }} acctSlot />

      {/* HERO + park anchor */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(96px,14vh,150px) clamp(16px,4vw,40px) clamp(36px,6vh,64px)" }}>
        {hero && hero.url && <img alt="" src={hero.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "bk-ken 22s ease-out both", filter: "brightness(.5)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.55),rgba(8,19,13,.3) 40%,rgba(8,19,13,.92))" }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".26em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Book your trip</div>
          <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: 1, letterSpacing: "-.02em", marginTop: 12, textShadow: "0 6px 40px rgba(0,0,0,.5)" }}>Everything you reserve,<br />in one place.</h1>
          <p style={{ maxWidth: 560, margin: "16px auto 0", color: "#d3d8d1", fontSize: "1.02rem", lineHeight: 1.6, fontWeight: 300 }}>Stays, campsites, cars, permits, tours — booked through trusted partners. We only show what&apos;s really available, and we tell you when something isn&apos;t live yet.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 26, background: "rgba(10,23,18,.6)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 8px 8px 18px" }}>
            <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#9aa7a0" }}>Plan around a park</span>
            <select value={park.q} onChange={(e) => setPark(PARKS.find((p) => p.q === e.target.value) || PARKS[0])} style={{ fontFamily: "inherit", fontSize: ".88rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.06)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 14px", outline: "none", cursor: "pointer" }}>
              {PARKS.map((p) => <option key={p.q} value={p.q}>{p.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* CATEGORY GRID */}
      <section style={{ padding: "clamp(20px,3vh,40px) clamp(16px,4vw,40px) clamp(30px,5vh,60px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="pb-rise" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.5rem,3.2vw,2.1rem)" }}>Book near <span style={{ color: "var(--pb-gold)" }}>{park.label}</span></h2>
            <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Partner-powered · honest availability</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
            {CATS.map((c, i) => <CatCard key={c.t} c={c} parkLabel={park.label} i={i} />)}
          </div>

          <div className="pb-rise" style={{ marginTop: 14, background: "linear-gradient(120deg,rgba(31,94,70,.16),rgba(9,22,15,.7))", border: "1px solid var(--pb-line-strong)", borderRadius: 20, padding: "clamp(18px,3vw,28px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: "1.6rem" }}>🛡</span>
              <div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.3rem" }}>Travel protection</div>
                <div style={{ fontSize: ".86rem", color: "var(--pb-ink-2)", fontWeight: 300, marginTop: 2 }}>Cover the trip against weather closures and the unexpected.</div>
              </div>
            </div>
            <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "6px 12px" }}>Coming soon</span>
          </div>

          <p className="pb-rise" style={{ textAlign: "center", fontFamily: mono, fontSize: ".58rem", letterSpacing: ".05em", color: "var(--pb-muted)", marginTop: 22, lineHeight: 1.6 }}>Park Buddy may earn a commission from partner bookings — it never changes your price.<br />Availability &amp; pricing come live from each partner. We never invent inventory or reviews.</p>
        </div>
      </section>

      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px,4vh,44px) clamp(16px,4vw,40px)" }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 22, fontFamily: mono, fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", lineHeight: 1.7, textAlign: "center" }}>Bookings via Recreation.gov &amp; travel partners · Affiliate links disclosed · Honest availability, always · Park Buddy</div>
      </footer>
    </div>
  );
}
