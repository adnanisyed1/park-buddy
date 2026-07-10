"use client";

// /shop — the Park Buddy store. HONESTY: nothing here is live for purchase yet.
// The Park Buddy Store (our own prints/merch, print-on-demand) and every affiliate
// department are shown as "Coming soon" with a real notify-me capture (stored via
// pines_waitlist, source shop-<slug>) — no fabricated prices, no outbound partner
// links until we've actually joined those programs. Trip Book is the one working
// owned product (the reserve flow), so it stays featured. Categories mirror /book:
// a Shop ▾ header dropdown + an on-page sticky category bar filter (?cat=…).

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import AffiliateDisclosure from "../components/AffiliateDisclosure";
import { usePhoto } from "../components/PhotoThumb";

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const ORIGINALS = [
  { t: "Zion WPA Poster", q: "Zion National Park", tag: "Print" },
  { t: "Yosemite WPA Poster", q: "Yosemite National Park", tag: "Print" },
  { t: "Trailhead Tee", q: "Hiking", tag: "Apparel" },
  { t: "Park Buddy Gift Card", q: "Rocky Mountain National Park", tag: "Gift" },
];

// Affiliate departments — each its own "store", all Coming soon until the programs
// are joined and IDs added. `q` drives the cover photo.
const DEPTS = [
  { slug: "passes", ic: "🎟", t: "Passes", d: "America the Beautiful annual pass + park-specific passes.", q: "Grand Canyon National Park" },
  { slug: "gear", ic: "🎒", t: "Gear & Apparel", d: "Packs, layers, rain shells and trail footwear.", q: "Backpacking" },
  { slug: "camp", ic: "⛺", t: "Camp & Cook", d: "Tents, sleeping bags, stoves and coolers.", q: "Camping" },
  { slug: "nav", ic: "🧭", t: "Navigation & Safety", d: "GPS units, satellite messengers, headlamps and first-aid.", q: "Garmin inReach" },
  { slug: "maps", ic: "🗺", t: "Maps & Guides", d: "Topo maps, park maps and trusted guidebooks.", q: "Topographic map" },
  { slug: "optics", ic: "🔭", t: "Optics & Cameras", d: "Binoculars, spotting scopes and trail cameras.", q: "Binoculars" },
];

// The store sub-nav (matches the Shop ▾ header dropdown). "All" shows everything.
const CAT_TABS = [
  { slug: "all", label: "All" },
  { slug: "store", label: "The Park Buddy Store" },
  { slug: "passes", label: "Passes" },
  { slug: "gear", label: "Gear & Apparel" },
  { slug: "camp", label: "Camp & Cook" },
  { slug: "nav", label: "Navigation & Safety" },
  { slug: "maps", label: "Maps & Guides" },
  { slug: "optics", label: "Optics & Cameras" },
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

// Shared "notify me when this opens" capture — stores the email in pines_waitlist
// with a per-store source. Replaces the old fake local-only toggle / live deep-link.
function NotifyForm({ source }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/pines-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), source }) });
      if (r.ok) setSent(true);
      else { const d = await r.json().catch(() => ({})); setErr(d.error || "Couldn't save just now — try again."); }
    } catch { setErr("Couldn't reach the list — try again."); }
    setBusy(false);
  };
  if (sent) return <div style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--pb-go)" }}>✓ On the list — we&apos;ll email you when it opens.</div>;
  return (
    <div>
      <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
        <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }} placeholder="Email me when it's live" aria-label="Email me when this store is live" style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "10px 12px", color: "var(--pb-ink)", fontFamily: "inherit", fontSize: ".82rem", outline: "none" }} />
        <button type="submit" disabled={busy} aria-label="Notify me" style={{ cursor: busy ? "default" : "pointer", flex: "none", fontWeight: 700, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "0 14px", fontFamily: "inherit" }}>{busy ? "…" : "→"}</button>
      </form>
      {err && <div style={{ marginTop: 8, color: "var(--pb-hold)", fontSize: ".76rem" }}>{err}</div>}
    </div>
  );
}

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
        <span style={{ position: "absolute", right: 12, top: 12, fontFamily: mono, fontSize: ".5rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", background: "rgba(10,23,18,.6)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "3px 9px" }}>Coming soon</span>
        <span style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(10,23,18,.7)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{c.ic}</span>
          <b style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.35rem", color: "#f7f4ec", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{c.t}</b>
        </span>
      </figure>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ flex: 1, fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.55, fontWeight: 300 }}>{c.d}</p>
        <div style={{ marginTop: 12 }}><NotifyForm source={"shop-" + c.slug} /></div>
      </div>
    </div>
  );
}

export default function ShopStore() {
  const rootRef = useRef(null);
  useReveal(rootRef);

  // Active store category from ?cat= (set by the Shop ▾ dropdown) + the on-page bar.
  // Read from window.location.search so ?cat=… applies on a hard load (a statically
  // prerendered page's useSearchParams can come back empty); `search` stays as the
  // client-nav trigger. Clicking a tab updates the URL in place.
  const search = useSearchParams();
  const [cat, setCat] = useState("all");
  useEffect(() => {
    const raw = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : search;
    const c = (raw.get("cat") || "all").toLowerCase();
    setCat(CAT_TABS.some((t) => t.slug === c) ? c : "all");
  }, [search]);
  const pick = (slug) => {
    setCat(slug);
    if (typeof window !== "undefined") window.history.replaceState(null, "", slug === "all" ? "/shop" : "/shop?cat=" + slug);
  };
  const isDept = DEPTS.some((d) => d.slug === cat);
  const showStore = cat === "all" || cat === "store";
  const showDepts = cat === "all" || isDept;
  const shownDepts = cat === "all" ? DEPTS : DEPTS.filter((d) => d.slug === cat);

  return (
    <div ref={rootRef} style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        .pb-rise { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.16,.8,.24,1), transform .7s cubic-bezier(.16,.8,.24,1); }
        .pb-rise.pb-rise-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .pb-rise { opacity: 1; transform: none; } }
      `}</style>

      <SiteHeader active="shop" acctSlot />

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(90px,12vh,130px) clamp(16px,4vw,40px) clamp(24px,3.5vh,38px)", background: "radial-gradient(1100px 420px at 74% -10%,rgba(217,183,121,.12),transparent 60%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="pb-rise" style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".26em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>The Park Buddy shop</div>
          <h1 className="pb-rise" style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: 1, letterSpacing: "-.02em", marginTop: 12, maxWidth: "16ch" }}>Carry the wild <em style={{ fontStyle: "italic", color: "var(--pb-gold)" }}>home.</em></h1>
          <p className="pb-rise" style={{ maxWidth: 560, color: "var(--pb-ink-2)", fontSize: "1.02rem", lineHeight: 1.6, fontWeight: 300, marginTop: 14 }}>Prints and merch made by us, plus gear and passes from trusted partners. The store is opening in stages — Trip Book is live now; everything else, we&apos;ll tell you the moment it opens.</p>
        </div>
      </section>

      {/* FEATURED: TRIP BOOK — the one owned product that's actually live */}
      <section style={{ padding: "clamp(6px,1.2vh,14px) clamp(16px,4vw,40px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Link href="/trip-book" className="pb-rise" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", background: "linear-gradient(120deg,rgba(217,183,121,.2),rgba(31,94,70,.14) 55%,rgba(9,22,15,.75))", border: "1px solid var(--pb-line-strong)", borderRadius: 22, padding: "clamp(20px,3.4vw,34px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
              <span style={{ flex: "none", width: 60, height: 74, borderRadius: 8, background: "var(--pb-grad-gold)", boxShadow: "0 10px 30px -10px rgba(217,183,121,.6), inset -6px 0 12px -6px rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.9rem" }}>📖</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Park Buddy original · live now</div>
                <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.5rem,3.2vw,2.2rem)", lineHeight: 1.05, marginTop: 6, color: "var(--pb-ink)" }}>Your trip, printed &amp; bound.</h2>
                <p style={{ fontSize: ".9rem", color: "var(--pb-ink-2)", fontWeight: 300, lineHeight: 1.5, marginTop: 6, maxWidth: "52ch" }}>Turn the parks you visited, the photos you took and the stops you saved into a real keepsake book — laid out for you, shipped to your door.</p>
              </div>
            </div>
            <span style={{ flex: "none", fontSize: ".9rem", fontWeight: 700, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 12, padding: "12px 22px" }}>Start your Trip Book →</span>
          </Link>
        </div>
      </section>

      {/* CATEGORY SUB-NAV — sticks below the header; mirrors the Shop ▾ dropdown */}
      <div style={{ position: "sticky", top: 60, zIndex: 40, background: "rgba(8,19,13,.82)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--pb-line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, overflowX: "auto", padding: "11px clamp(16px,4vw,40px)", scrollbarWidth: "none" }}>
          {CAT_TABS.map((t) => {
            const on = cat === t.slug;
            return (
              <button key={t.slug} onClick={() => pick(t.slug)} aria-pressed={on} style={{ cursor: "pointer", flex: "none", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 600, whiteSpace: "nowrap", color: on ? "#0b1710" : "var(--pb-ink-2)", background: on ? "var(--pb-grad-gold)" : "transparent", border: on ? "1px solid transparent" : "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 15px", transition: "color .2s, background .2s" }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* THE PARK BUDDY STORE — owned originals, coming soon */}
      {showStore && (
        <section id="shop-originals" style={{ scrollMarginTop: 84, padding: "clamp(18px,2.6vh,30px) clamp(16px,4vw,40px) clamp(20px,3vh,36px)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="pb-rise" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3vw,2rem)" }}>The Park Buddy <span style={{ color: "var(--pb-gold)" }}>Store</span></h2>
              <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Designed in-house · Coming soon</span>
            </div>
            <p className="pb-rise" style={{ maxWidth: 560, fontSize: ".92rem", color: "var(--pb-ink-2)", fontWeight: 300, lineHeight: 1.6 }}>WPA-style park posters, prints and trail-worn apparel — made by us, shipped to your door. Opening soon; get first dibs:</p>
            <div className="pb-rise" style={{ maxWidth: 420, margin: "12px 0 20px" }}><NotifyForm source="shop-store" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
              {ORIGINALS.map((o, i) => <OriginalCard key={o.t} o={o} i={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* DEPARTMENTS — affiliate stores, all coming soon (notify capture per store) */}
      {showDepts && (
        <section id="shop-depts" style={{ scrollMarginTop: 84, padding: "clamp(18px,2.6vh,30px) clamp(16px,4vw,40px) clamp(30px,5vh,60px)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="pb-rise" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3vw,2rem)" }}>{cat === "all" ? "Shop by department" : <span style={{ color: "var(--pb-gold)" }}>{(CAT_TABS.find((t) => t.slug === cat) || {}).label}</span>}</h2>
              <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Curated · coming soon</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: cat === "all" ? "repeat(auto-fit,minmax(260px,1fr))" : "repeat(auto-fit,minmax(260px,420px))", gap: 14 }}>
              {shownDepts.map((c, i) => <DeptCard key={c.t} c={c} i={i} />)}
            </div>
            <div className="pb-rise" style={{ marginTop: 22 }}><AffiliateDisclosure variant="mono" /></div>
          </div>
        </section>
      )}

      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px,4vh,44px) clamp(16px,4vw,40px)" }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 22, fontFamily: mono, fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", lineHeight: 1.7, textAlign: "center" }}>Prints &amp; merch by Park Buddy · Gear &amp; passes via trusted partners when live · Affiliate links disclosed · Park Buddy</div>
      </footer>
    </div>
  );
}
