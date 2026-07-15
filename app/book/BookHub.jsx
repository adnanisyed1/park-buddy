"use client";

// /book — booking hub. Park-anchored: a picker swaps the hero photo + "Book near ___".
// Category cards are affiliate/partner hand-offs — LIVE ones deep-link to the real
// partner (Recreation.gov, Booking, Rentalcars, Viator); not-yet-live show an honest
// "Coming soon / Notify me". No invented inventory, prices, or ratings.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import AffiliateDisclosure from "../components/AffiliateDisclosure";
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

// Crafted gold line-icons (replace the old emoji tiles). 24×24, stroke = currentColor.
const ICONS = {
  stays: <><path d="M3.5 11.5 12 5l8.5 6.5" /><path d="M5.5 10.5V19h13v-8.5" /><path d="M10 19v-4.5h4V19" /></>,
  camp: <><path d="M3 19 11 6h2l8 13" /><path d="M12 6v13" /><path d="M8 19l4-6 4 6" /></>,
  cars: <><path d="M4 13l1.8-4.6A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.4L20 13" /><path d="M4 13h16v4H4z" /><circle cx="7.5" cy="17.6" r="1.5" /><circle cx="16.5" cy="17.6" r="1.5" /></>,
  cruises: <><path d="M4 15h16l-2.2 4H6.2z" /><path d="M6.5 15V9h6l3 3v3" /><path d="M12 9V5.5" /><path d="M2.5 21c1.4 0 1.4-1 2.8-1s1.4 1 2.8 1 1.4-1 2.8-1 1.4 1 2.8 1 1.4-1 2.8-1 1.4 1 2.8 1" /></>,
  tours: <><circle cx="12" cy="12" r="8.2" /><path d="M15.2 8.8 12.8 14 8.8 15.2 11.2 10z" /></>,
  permits: <><rect x="3" y="7" width="18" height="10" rx="2.2" /><path d="M9 7v10" strokeDasharray="1.6 2.4" /><path d="M13 11h4" /><path d="M13 13.4h2.5" /></>,
  shuttles: <><rect x="3.5" y="5" width="17" height="11.5" rx="2.2" /><path d="M3.5 12h17" /><path d="M8 5v7M12.5 5v7M17 5v7" /><circle cx="8" cy="18.4" r="1.4" /><circle cx="16" cy="18.4" r="1.4" /></>,
  book: <><path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.5z" /><path d="M20 5.5A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.5z" /><path d="M12 4v15" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
};

function Ico({ name, size = 22, sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const CATS = [
  { slug: "stays", ic: "stays", t: "Stays", d: "In-park lodges, cabins, vacation rentals & glamping near the gateway.", cta: "Search stays", live: true, partner: "Booking.com · Expedia", kind: "stays" },
  { slug: "camp", ic: "camp", t: "Campgrounds & RV", d: "Recreation.gov campsites plus private RV parks — live availability.", cta: "Check campsites", live: true, partner: "Recreation.gov", kind: "camp" },
  { slug: "cars", ic: "cars", t: "Rental cars", d: "For the road trip and scenic drives. Pick up near the park or airport.", cta: "Find a car", live: true, partner: "Rentalcars.com", kind: "cars" },
  { slug: "cruises", ic: "cruises", t: "Cruises", d: "Reach the parks by sea — Glacier Bay, Kenai Fjords, the Inside Passage.", cta: "Browse cruises", live: false, partner: "", href: "/cruises" },
  { slug: "tours", ic: "tours", t: "Tours & experiences", d: "Guided hikes, rafting, climbing guides, dive charters, ranger programs.", cta: "See experiences", live: true, partner: "Viator · local outfitters", kind: "tours" },
  { slug: "permits", ic: "permits", t: "Permits & reservations", d: "Timed-entry and wilderness permits — required at many parks.", cta: "Get permits", live: true, partner: "Recreation.gov", kind: "permits" },
  { slug: "shuttles", ic: "shuttles", t: "Shuttles & transport", d: "Park shuttles and gateway-town transfers to skip the parking scramble.", cta: "Plan transport", live: false, partner: "" },
];

// The category sub-nav (matches the Book ▾ header dropdown). "All" shows the full grid.
const CAT_TABS = [
  { slug: "all", label: "All" },
  { slug: "stays", label: "Stays" },
  { slug: "camp", label: "Campgrounds & RV" },
  { slug: "cars", label: "Cars" },
  { slug: "cruises", label: "Cruises" },
  { slug: "tours", label: "Tours" },
  { slug: "permits", label: "Permits" },
  { slug: "shuttles", label: "Shuttles" },
];

const TRUST = [
  "Official & trusted partners",
  "Real-time availability",
  "Affiliate links, always disclosed",
];

// Scroll-reveal, matching the design's fade-up.
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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = () => { const u = partnerUrl(c.kind, parkLabel); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  // Coming-soon categories capture real interest (reuses the pines_waitlist table).
  const notify = async (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/pines-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "book-" + (c.slug || c.t) }) });
      if (r.ok) setSent(true);
      else { const d = await r.json().catch(() => ({})); setErr(d.error || "Couldn't save just now — try again."); }
    } catch { setErr("Couldn't reach the list — try again."); }
    setBusy(false);
  };
  return (
    <div className={"pb-rise bk-card" + (c.live ? "" : " bk-soon")} style={{ transitionDelay: i * 0.05 + "s", display: "flex", flexDirection: "column", borderRadius: 20, padding: 24, position: "relative", overflow: "hidden" }}>
      <span className="bk-card-glow" aria-hidden="true" />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, position: "relative" }}>
        <span className="bk-icon" style={{ width: 52, height: 52, borderRadius: 15, color: "var(--pb-gold)", background: "radial-gradient(120% 120% at 30% 20%,rgba(232,207,154,.26),rgba(201,163,95,.05))", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Ico name={c.ic} size={26} />
        </span>
        {c.live ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".52rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#7fe3a6" }}><span className="bk-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4fd98a" }} />Live</span>
        ) : (
          <span style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "3px 9px" }}>Coming soon</span>
        )}
      </div>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.4rem", marginTop: 16, color: "var(--pb-ink)", position: "relative" }}>{c.t}</h3>
      <p style={{ flex: 1, fontSize: ".88rem", color: "var(--pb-ink-2)", lineHeight: 1.55, fontWeight: 300, marginTop: 7, position: "relative" }}>{c.d}</p>
      {c.partner && <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 12, position: "relative" }}>via {c.partner}</div>}
      <div style={{ marginTop: 16, position: "relative" }}>
        {c.live ? (
          <button className="bk-cta" onClick={open} style={{ cursor: "pointer", width: "100%", fontSize: ".86rem", fontWeight: 700, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: 12, fontFamily: "inherit" }}>{c.cta} ↗</button>
        ) : c.href ? (
          <a className="bk-cta-ghost" href={c.href} style={{ display: "block", textAlign: "center", textDecoration: "none", fontSize: ".86rem", fontWeight: 600, color: "var(--pb-ink)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: 12 }}>Notify me →</a>
        ) : sent ? (
          <div style={{ textAlign: "center", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-go)", padding: "10px 0" }}>✓ On the list — we&apos;ll email you when it opens.</div>
        ) : (
          <form onSubmit={notify} style={{ display: "flex", gap: 6 }}>
            <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }} placeholder="Email me when it's live" aria-label={"Email me when " + c.t + " is live"} style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "10px 12px", color: "var(--pb-ink)", fontFamily: "inherit", fontSize: ".82rem", outline: "none" }} />
            <button type="submit" disabled={busy} aria-label="Notify me" style={{ cursor: busy ? "default" : "pointer", flex: "none", fontWeight: 700, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "0 14px", fontFamily: "inherit" }}>{busy ? "…" : "→"}</button>
          </form>
        )}
        {err && <div style={{ marginTop: 8, color: "var(--pb-hold)", fontSize: ".76rem" }}>{err}</div>}
      </div>
    </div>
  );
}

export default function BookHub() {
  const rootRef = useRef(null);
  const [park, setPark] = useState(PARKS[0]);
  const hero = usePhoto(park.q, null, null);
  useReveal(rootRef);

  const search = useSearchParams();
  const [cat, setCat] = useState("all");
  useEffect(() => {
    const raw = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : search;
    const c = (raw.get("cat") || "all").toLowerCase();
    setCat(CAT_TABS.some((t) => t.slug === c) ? c : "all");
  }, [search]);
  const pick = (slug) => {
    setCat(slug);
    if (typeof window !== "undefined") window.history.replaceState(null, "", slug === "all" ? "/book" : "/book?cat=" + slug);
  };
  const shown = cat === "all" ? CATS : CATS.filter((c) => c.slug === cat);
  const liveCount = CATS.filter((c) => c.live).length;

  return (
    <div ref={rootRef} style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        @keyframes bk-ken { 0% { transform: scale(1.05); } 100% { transform: scale(1.13); } }
        @keyframes bk-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(79,217,138,.5);} 50% { opacity:.5; box-shadow:0 0 0 5px rgba(79,217,138,0);} }
        .bk-pulse { animation: bk-pulse 2s ease-in-out infinite; }
        .pb-rise { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.16,.8,.24,1), transform .7s cubic-bezier(.16,.8,.24,1); }
        .pb-rise.pb-rise-in { opacity: 1; transform: none; }
        .bk-card { background: linear-gradient(168deg,rgba(255,255,255,.045),rgba(255,255,255,.008)); border: 1px solid var(--pb-line); transition: transform .35s cubic-bezier(.16,.8,.24,1), border-color .35s, box-shadow .35s; }
        .bk-card .bk-card-glow { position:absolute; top:-40%; right:-30%; width:70%; height:80%; background: radial-gradient(circle,rgba(217,183,121,.14),transparent 70%); opacity:0; transition:opacity .4s; pointer-events:none; }
        .bk-card:hover { transform: translateY(-5px); border-color: var(--pb-gold-2); box-shadow: 0 26px 54px -26px rgba(0,0,0,.75); }
        .bk-card:hover .bk-card-glow { opacity:1; }
        .bk-card:hover .bk-icon { transform: scale(1.07) rotate(-4deg); border-color: var(--pb-gold-2); }
        .bk-soon { opacity: .9; }
        .bk-icon { transition: transform .4s cubic-bezier(.16,.8,.24,1), border-color .35s; }
        .bk-cta:hover { filter: brightness(1.07); }
        .bk-cta-ghost { transition: border-color .25s, background .25s; }
        .bk-cta-ghost:hover { border-color: var(--pb-gold); background: rgba(217,183,121,.06); }
        .bk-tab { transition: color .2s, background .2s, border-color .2s; }
        .bk-tab:not(.on):hover { color: var(--pb-ink); border-color: var(--pb-gold-2); }
        .bk-promo { transition: transform .35s cubic-bezier(.16,.8,.24,1), border-color .35s, box-shadow .35s; }
        .bk-promo:hover { transform: translateY(-3px); border-color: var(--pb-gold-2); box-shadow: 0 22px 46px -24px rgba(0,0,0,.7); }
        @media (prefers-reduced-motion: reduce) {
          .pb-rise, .bk-card, .bk-promo, .bk-icon { transition: none; }
          .pb-rise { opacity: 1; transform: none; }
          .bk-pulse, .bk-hero-img { animation: none !important; }
          .bk-card:hover, .bk-promo:hover { transform: none; }
        }
      `}</style>

      <SiteHeader active="book" acctSlot />

      {/* HERO + park anchor */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(122px,17vh,158px) clamp(16px,4vw,40px) clamp(44px,7vh,76px)" }}>
        {hero && hero.url && <img alt="" className="bk-hero-img" src={hero.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "bk-ken 22s ease-out both", filter: "brightness(.46)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.5),rgba(8,19,13,.25) 38%,rgba(8,19,13,.95))" }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".28em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Book your trip</div>
          <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: 1, letterSpacing: "-.02em", marginTop: 14, textShadow: "0 6px 40px rgba(0,0,0,.5)" }}>Everything you reserve,<br />in one place.</h1>
          <p style={{ maxWidth: 560, margin: "18px auto 0", color: "#d8ddd6", fontSize: "1.04rem", lineHeight: 1.6, fontWeight: 300 }}>Stays, campsites, cars, permits, tours — booked through trusted partners. We only show what&apos;s really available, and tell you when something isn&apos;t live yet.</p>

          {/* park picker */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 28, background: "rgba(10,23,18,.62)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 8px 8px 20px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mono, fontSize: ".58rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#9aa7a0" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="2.6" /></svg>
              Plan around a park
            </span>
            <select value={park.q} onChange={(e) => setPark(PARKS.find((p) => p.q === e.target.value) || PARKS[0])} style={{ fontFamily: "inherit", fontSize: ".9rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.07)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "10px 16px", outline: "none", cursor: "pointer" }}>
              {PARKS.map((p) => <option key={p.q} value={p.q}>{p.label}</option>)}
            </select>
          </div>

          {/* trust chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
            {TRUST.map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: ".72rem", color: "#c4cbc4", background: "rgba(10,23,18,.5)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: "6px 13px 6px 11px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--pb-gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-11" /></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORY SUB-NAV — sticks below the floating header island (≈98px to its base). */}
      <div style={{ position: "sticky", top: 106, zIndex: 40, background: "rgba(8,19,13,.86)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", borderRadius: 14, border: "1px solid var(--pb-line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, overflowX: "auto", padding: "11px clamp(16px,4vw,40px)", scrollbarWidth: "none" }}>
          {CAT_TABS.map((t) => {
            const on = cat === t.slug;
            return (
              <button
                key={t.slug}
                onClick={() => pick(t.slug)}
                aria-pressed={on}
                className={"bk-tab" + (on ? " on" : "")}
                style={{ cursor: "pointer", flex: "none", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 600, whiteSpace: "nowrap", color: on ? "#0b1710" : "var(--pb-ink-2)", background: on ? "var(--pb-grad-gold)" : "transparent", border: on ? "1px solid transparent" : "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 15px" }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CATEGORY GRID */}
      <section style={{ padding: "clamp(24px,3.5vh,44px) clamp(16px,4vw,40px) clamp(30px,5vh,60px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="pb-rise" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.5rem,3.2vw,2.1rem)" }}>{cat === "all" ? <>Book near <span style={{ color: "var(--pb-gold)" }}>{park.label}</span></> : <><span style={{ color: "var(--pb-gold)" }}>{(CAT_TABS.find((t) => t.slug === cat) || {}).label}</span> near {park.label}</>}</h2>
            <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{cat === "all" ? liveCount + " live now · honest availability" : "Partner-powered · honest availability"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: cat === "all" ? "repeat(auto-fit,minmax(280px,1fr))" : "repeat(auto-fit,minmax(280px,360px))", gap: 16 }}>
            {shown.map((c, i) => <CatCard key={c.t} c={c} parkLabel={park.label} i={i} />)}
          </div>

          {/* Trip Book lives in the Shop — cross-linked here for hikers planning a trip. */}
          {cat === "all" && (
            <Link href="/trip-book" className="pb-rise bk-promo" style={{ textDecoration: "none", marginTop: 16, background: "linear-gradient(120deg,rgba(217,183,121,.16),rgba(9,22,15,.7))", border: "1px solid var(--pb-line-strong)", borderRadius: 20, padding: "clamp(20px,3vw,30px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ width: 52, height: 52, borderRadius: 15, flex: "none", color: "var(--pb-gold)", background: "radial-gradient(120% 120% at 30% 20%,rgba(232,207,154,.26),rgba(201,163,95,.05))", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico name="book" size={26} /></span>
                <div>
                  <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.35rem", color: "var(--pb-ink)" }}>Turn the trip into a book</div>
                  <div style={{ fontSize: ".88rem", color: "var(--pb-ink-2)", fontWeight: 300, marginTop: 3 }}>After you travel, print your photos &amp; stops as a keepsake Trip Book — in the Shop.</div>
                </div>
              </div>
              <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold)", border: "1px solid var(--pb-gold-2)", borderRadius: 999, padding: "7px 13px", flex: "none" }}>Open Trip Book →</span>
            </Link>
          )}

          <div className="pb-rise bk-promo" style={{ marginTop: 16, background: "linear-gradient(120deg,rgba(31,94,70,.16),rgba(9,22,15,.7))", border: "1px solid var(--pb-line-strong)", borderRadius: 20, padding: "clamp(20px,3vw,30px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, flex: "none", color: "#7fe3a6", background: "radial-gradient(120% 120% at 30% 20%,rgba(79,217,138,.22),rgba(31,94,70,.05))", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico name="shield" size={26} /></span>
              <div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.35rem" }}>Travel protection</div>
                <div style={{ fontSize: ".88rem", color: "var(--pb-ink-2)", fontWeight: 300, marginTop: 3 }}>Cover the trip against weather closures and the unexpected.</div>
              </div>
            </div>
            <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 13px", flex: "none" }}>Coming soon</span>
          </div>

          <div className="pb-rise" style={{ marginTop: 24 }}><AffiliateDisclosure variant="mono" /></div>
        </div>
      </section>

      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px,4vh,44px) clamp(16px,4vw,40px)" }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 22, fontFamily: mono, fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", lineHeight: 1.7, textAlign: "center" }}>Bookings via Recreation.gov &amp; travel partners · Affiliate links disclosed · Honest availability, always · Park Buddy</div>
      </footer>
    </div>
  );
}
