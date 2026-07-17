"use client";

// The React landing page (replaces the legacy public/embed/home). Built from the
// Figma handoff (fileKey JJlqqcU2BXe2A4WzwS6Oqv) on the shared platform shell —
// SiteHeader (top nav + mobile bubble) + PbTabBar (mobile bottom bar) come from
// <SiteHeader/>, so a single nav change hits the whole platform. Scenery is real,
// licensed park photography via /api/photo; the graphical bits (map, verdict chips,
// passport stamps, Bortle badge) are SVG/CSS. Copy is 1:1 with the design. Honesty:
// live sections link to real routes; Pines is "early access", the "Your Edge" trio
// is framed "coming".
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import useDarkBody from "./lib/useDarkBody";

const GOLD = "linear-gradient(120deg,#e8cf9a,#c9a35f)";
const serif = "var(--pb-serif)", sans = "var(--pb-sans)", mono = "var(--pb-mono)";
const V = { GO: "#4fd98a", PREPARE: "#e8cf9a", HOLD: "#e08a6a" };

/* ---- real park photos via our pipeline, with cache + fade ---- */
const photoCache = {};
function usePhoto(q) {
  const key = q || "";
  const [url, setUrl] = useState(photoCache[key] || null);
  useEffect(() => {
    if (!key || photoCache[key] !== undefined) { if (photoCache[key]) setUrl(photoCache[key]); return; }
    let on = true;
    fetch("/api/photo?q=" + encodeURIComponent(key) + "&w=1200")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const u = d && (d.image || d.thumb); photoCache[key] = u || ""; if (on && u) setUrl(u); })
      .catch(() => {});
    return () => { on = false; };
  }, [key]);
  return url;
}
function Photo({ q, alt = "", style, overlay }) {
  const url = usePhoto(q);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(160deg,#16321f,#0c1c12)", ...style }}>
      {url && <img src={url} alt={alt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0, transition: "opacity .6s", animation: "pbFadeIn .6s forwards" }} onLoad={(e) => (e.currentTarget.style.opacity = 1)} />}
      {overlay && <div style={{ position: "absolute", inset: 0, background: overlay }} />}
    </div>
  );
}

const Eyebrow = ({ children, style }) => (
  <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--pb-gold-soft)", ...style }}>{children}</div>
);
const H2 = ({ children, style }) => (
  <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2rem,4.6vw,3.1rem)", lineHeight: 1.04, color: "var(--pb-ink)", margin: "10px 0 0", textWrap: "balance", ...style }}>{children}</h2>
);
const VChip = ({ v, small }) => (
  <span style={{ fontFamily: mono, fontSize: small ? ".5rem" : ".6rem", fontWeight: 700, letterSpacing: ".08em", color: V[v], border: "1px solid " + V[v] + "66", background: V[v] + "14", borderRadius: 999, padding: small ? "2px 7px" : "3px 10px" }}>{v}</span>
);
const section = { maxWidth: 1120, margin: "0 auto", padding: "clamp(72px,10vw,120px) clamp(20px,5vw,40px)" };

/* ============================= HERO ============================= */
function Hero() {
  const hero = usePhoto("Grand Teton National Park");
  return (
    <header style={{ position: "relative", minHeight: "min(100vh,860px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "120px 20px 90px", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${hero || "/media/hero-loop-poster.jpg"})`, backgroundSize: "cover", backgroundPosition: "center", transform: "scale(1.05)" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,23,18,.55) 0%,rgba(10,23,18,.35) 35%,rgba(10,23,18,.85) 78%,var(--pb-bg) 100%)" }} />
      <div style={{ position: "relative", maxWidth: 820 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, ...{}, fontFamily: mono, fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#e7e3d8", border: "1px solid rgba(217,183,121,.4)", borderRadius: 999, padding: "7px 16px", background: "rgba(9,17,12,.35)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: V.GO, boxShadow: "0 0 8px " + V.GO }} /> The honest national park companion
        </div>
        <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2.9rem,8vw,5.4rem)", lineHeight: 1.0, color: "#fff", margin: "22px 0 0", textShadow: "0 4px 30px rgba(0,0,0,.5)", textWrap: "balance" }}>
            Know if today's <span style={{ fontStyle: "italic", color: "var(--pb-gold)" }}>the day.</span>
        </h1>
        <p style={{ fontFamily: sans, fontSize: "clamp(1rem,1.6vw,1.2rem)", lineHeight: 1.6, color: "rgba(244,241,234,.9)", margin: "20px auto 0", maxWidth: 560, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
          One honest go / no‑go call for every U.S. national park — live weather, alerts, air and fire — plus everything to plan, book and live the trip.
        </p>
        {/* live verdict tally */}
        <div style={{ display: "inline-flex", gap: 18, margin: "26px auto 0", padding: "10px 20px", borderRadius: 16, background: "rgba(9,17,12,.42)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", border: "1px solid var(--pb-line)" }}>
          {[["47", "GO", V.GO], ["11", "PREPARE", V.PREPARE], ["5", "HOLD", V.HOLD]].map(([n, l, c]) => (
            <span key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <b style={{ fontFamily: serif, fontSize: "1.5rem", color: c }}>{n}</b>
              <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".14em", color: "#c9cec6" }}>{l}</span>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 30 }}>
          <Link href="/explore" style={{ fontFamily: sans, fontSize: ".95rem", fontWeight: 700, color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "14px 26px", textDecoration: "none", boxShadow: "0 10px 30px -10px rgba(217,183,121,.7)" }}>Open the Live Map →</Link>
          <Link href="/build-trip" style={{ fontFamily: sans, fontSize: ".95rem", fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "14px 26px", textDecoration: "none", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>Plan a Trip</Link>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(244,241,234,.55)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        Scroll to explore
        <span style={{ width: 1, height: 26, background: "linear-gradient(rgba(217,183,121,.7),transparent)" }} />
      </div>
    </header>
  );
}

/* ====================== VERDICT ENGINE ====================== */
function VerdictEngine() {
  const cards = [
    { t: "Real Data In", items: ["National Weather Service feeds", "Active NPS alert logs", "AirNow environmental AQI", "NIFC wildfire satellites"] },
    { t: "Algorithm Weighs", items: ["Temperature comfort windows", "Air‑quality health indexes", "Alert & closure severity", "Fire & smoke proximity"] },
    { t: "Verdict Out", verdicts: true },
  ];
  return (
    <section style={{ ...section }}>
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <Eyebrow>The verdict engine</Eyebrow>
        <H2>One honest answer. Zero guesswork.</H2>
      </div>
      <div className="pbl-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 40 }}>
        {cards.map((c, i) => (
          <div key={c.t} style={{ position: "relative", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 18, padding: "22px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontFamily: mono, fontSize: ".56rem", color: "var(--pb-gold)", border: "1px solid var(--pb-line-strong)", borderRadius: 6, padding: "3px 6px" }}>{"0" + (i + 1)}</span>
              <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.2rem", color: "var(--pb-ink)" }}>{c.t}</span>
            </div>
            {c.verdicts ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["GO", "Perfect conditions. Go today."], ["PREPARE", "Conditions changing. Plan carefully."], ["HOLD", "Stay out — closures or hazards."]].map(([v, d]) => (
                  <div key={v} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <VChip v={v} /><span style={{ fontSize: ".82rem", color: "var(--pb-ink-2)" }}>{d}</span>
                  </div>
                ))}
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                {c.items.map((it) => (
                  <li key={it} style={{ display: "flex", gap: 9, fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.4 }}>
                    <span style={{ color: "var(--pb-gold)", flex: "none" }}>›</span>{it}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", fontFamily: mono, fontSize: ".64rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 28 }}>
        Updated every 15 minutes from federal data sources. No opinions. No guesses. Just data.
      </p>
    </section>
  );
}

/* ====================== EXPLORE (map) ====================== */
const PINS = [
  { name: "Olympic", x: 8, y: 22, v: "GO" }, { name: "Yosemite", x: 12, y: 52, v: "PREPARE" },
  { name: "Zion", x: 26, y: 58, v: "GO" }, { name: "Yellowstone", x: 40, y: 30, v: "PREPARE" },
  { name: "Grand Canyon", x: 30, y: 62, v: "GO" }, { name: "Smoky Mtns", x: 74, y: 60, v: "GO" },
  { name: "Acadia", x: 90, y: 26, v: "HOLD" },
];
function ExploreSection() {
  return (
    <section style={{ ...section }}>
      <div className="pbl-split" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 40, alignItems: "center" }}>
        <div>
          <Eyebrow>Explore</Eyebrow>
          <H2>The map that breathes.</H2>
          <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--pb-ink-2)", margin: "16px 0 24px", maxWidth: 460 }}>
            Every national park, national forest and state park — alive with real‑time verdicts, current temperatures and active alerts. Tap any teardrop pin for conditions, trails, campgrounds and webcams.
          </p>
          <Link href="/explore" style={{ fontFamily: sans, fontWeight: 700, fontSize: ".9rem", color: "var(--pb-gold)", textDecoration: "none" }}>Open the live map →</Link>
        </div>
        <div style={{ position: "relative", aspectRatio: "16/11", borderRadius: 20, overflow: "hidden", border: "1px solid var(--pb-line-strong)", background: "radial-gradient(120% 100% at 50% 0%,#12241a,#0a1712)" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(217,183,121,.09) 1px,transparent 1px)", backgroundSize: "26px 26px", opacity: .5 }} />
          {PINS.map((p) => (
            <span key={p.name} style={{ position: "absolute", left: p.x + "%", top: p.y + "%", transform: "translate(-50%,-100%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <svg width="20" height="26" viewBox="0 0 24 30"><path d="M12 0C6 0 1.5 4.6 1.5 10.5 1.5 18 12 30 12 30S22.5 18 22.5 10.5C22.5 4.6 18 0 12 0Z" fill={V[p.v]} stroke="rgba(0,0,0,.35)" /><circle cx="12" cy="10.5" r="3.6" fill="#0a1712" /></svg>
              <span style={{ fontFamily: mono, fontSize: ".44rem", color: "#cfd6cf", marginTop: 2, whiteSpace: "nowrap", textShadow: "0 1px 3px #000" }}>{p.name}</span>
            </span>
          ))}
          {/* verdict card */}
          <div style={{ position: "absolute", right: 14, top: 14, width: 190, background: "rgba(9,17,12,.9)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)", border: "1px solid " + V.PREPARE + "55", borderRadius: 14, padding: "12px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <b style={{ fontFamily: serif, fontSize: "1.05rem", color: "var(--pb-ink)" }}>Yellowstone</b>
              <span style={{ fontFamily: mono, fontSize: ".8rem", color: "var(--pb-gold)" }}>72°F</span>
            </div>
            <div style={{ margin: "6px 0 8px" }}><VChip v="PREPARE" small /></div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {["Afternoon thunder risk", "Lamar Valley road open", "2 campsites available"].map((t) => (
                <li key={t} style={{ fontSize: ".68rem", color: "var(--pb-ink-2)", display: "flex", gap: 5 }}><span style={{ color: "var(--pb-gold-soft)" }}>•</span>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ====================== TRIP STUDIO ====================== */
function TripStudioSection() {
  return (
    <section style={{ ...section }}>
      <div className="pbl-split" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center" }}>
        <div className="pbl-swap" style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid var(--pb-line-strong)", background: "var(--pb-surface)", padding: 18 }}>
          <div style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".14em", color: "var(--pb-gold-soft)", marginBottom: 12 }}>ROUTE ITINERARY · 4 DAYS</div>
          {[["Yosemite Valley", "GO", "Clear sky · 76°F"], ["Death Valley", "PREPARE", "Extreme heat · 112°F"]].map(([n, v, d], i) => (
            <div key={n}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "1px solid " + V[v] + "88", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, color: V[v], fontSize: ".85rem" }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ fontSize: ".95rem", color: "var(--pb-ink)" }}>{n}</b><VChip v={v} small /></div>
                  <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 1 }}>{d}</div>
                </div>
              </div>
              {i === 0 && <div style={{ marginLeft: 15, paddingLeft: 20, borderLeft: "1px dashed var(--pb-line-strong)", fontFamily: mono, fontSize: ".6rem", color: "var(--pb-muted)", padding: "4px 0 4px 20px" }}>↓ Drive 4h 15m</div>}
            </div>
          ))}
        </div>
        <div>
          <Eyebrow>Plan</Eyebrow>
          <H2>Your road trip, on real roads.</H2>
          <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--pb-ink-2)", margin: "16px 0 20px", maxWidth: 440 }}>
            Add parks, trails, scenic drives and campgrounds. Get real drive times, daylight‑fit pacing and shareable itineraries. Not a Pinterest board — an actual plan.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
            {["Real drive times", "Daylight pacing", "Optimize order"].map((t) => (
              <span key={t} style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".06em", color: "var(--pb-ink-2)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: "6px 12px" }}>{t}</span>
            ))}
          </div>
          <Link href="/build-trip" style={{ fontFamily: sans, fontWeight: 700, fontSize: ".9rem", color: "var(--pb-gold)", textDecoration: "none" }}>Open Trip Studio →</Link>
        </div>
      </div>
    </section>
  );
}

/* ====================== BOOK ====================== */
const BOOK = [
  { l: "Stays", d: "Cabins & glamping", href: "/book?cat=stays", ic: <path d="M4 11 12 4l8 7M6 10v10h12V10" /> },
  { l: "Campgrounds & RV", d: "Wilderness sites", href: "/book?cat=camp", ic: <path d="M12 4 3 20h18zM12 4v16" /> },
  { l: "Rental Cars", d: "For the drive", href: "/book?cat=cars", ic: <><path d="M4 13l2-6h12l2 6M4 13h16v4H4z" /><path d="M7 17v2M17 17v2" /></> },
  { l: "Permits & Passes", d: "Timed entry", href: "/book?cat=permits", ic: <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4H5a2 2 0 0 1 0-4 2 2 0 0 0 0-4z" /> },
  { l: "Tours & Experiences", d: "Guided expeditions", href: "/book?cat=tours", ic: <path d="M6 3v18M6 4h11l-2 3 2 3H6" /> },
];
function BookSection() {
  return (
    <section style={{ ...section }}>
      <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
        <Eyebrow>Book</Eyebrow>
        <H2>Everything for the trip. Honestly.</H2>
        <p style={{ fontSize: ".96rem", lineHeight: 1.6, color: "var(--pb-ink-2)", marginTop: 14 }}>Cabins, glamping, campgrounds, rental cars, permits & tours — we only show what's actually available, and tell you when something isn't live yet.</p>
      </div>
      <div className="pbl-5" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginTop: 36 }}>
        {BOOK.map((b) => (
          <Link key={b.l} href={b.href} className="pbl-card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 16px", borderRadius: 16, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", textDecoration: "none" }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--pb-gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{b.ic}</svg>
            <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "var(--pb-ink)", lineHeight: 1.1 }}>{b.l}</span>
            <span style={{ fontSize: ".72rem", color: "var(--pb-muted)" }}>{b.d}</span>
          </Link>
        ))}
      </div>
      <p style={{ textAlign: "center", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".06em", color: "var(--pb-muted)", marginTop: 22 }}>Powered by Recreation.gov, Hipcamp and verified partners.</p>
    </section>
  );
}

/* ====================== PINES ====================== */
function PinesSection() {
  const [email, setEmail] = useState(""), [done, setDone] = useState(false), [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email."); return; }
    setErr("");
    try { await fetch("/api/pines-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "landing" }) }); } catch {}
    setDone(true);
  };
  return (
    <section style={{ position: "relative", padding: "clamp(72px,10vw,120px) clamp(20px,5vw,40px)", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,var(--pb-bg),#0c1f15,var(--pb-bg))" }} />
      <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
          <Eyebrow style={{ color: V.PREPARE }}>Coming soon · early access</Eyebrow>
          <H2>Reels, but for the wild.</H2>
          <p style={{ fontSize: ".96rem", lineHeight: 1.6, color: "var(--pb-ink-2)", marginTop: 14 }}>Short videos & photos of real, GPS‑verified adventures — pinned to the exact place, shown next to today's conditions. No stock. No fakes.</p>
        </div>
        <div className="pbl-pines" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.1fr", gap: 14, marginTop: 40, alignItems: "stretch" }}>
          {["Grand Teton National Park", "Sequoia National Park", "Zion National Park"].map((p) => (
            <div key={p} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", border: "1px solid var(--pb-line)" }}>
              <Photo q={p} overlay="linear-gradient(180deg,transparent 50%,rgba(6,14,10,.85))" />
              <span style={{ position: "absolute", left: 12, bottom: 12, fontFamily: serif, fontWeight: 600, color: "#fff", fontSize: "1rem", textShadow: "0 2px 8px #000" }}>📍 {p.replace(" National Park", "")}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: "22px 20px", borderRadius: 16, background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)" }}>
            <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", color: "var(--pb-gold-soft)" }}>EARLY ACCESS</div>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", lineHeight: 1.1 }}>Get behind the Pines before anyone else.</div>
            {done ? (
              <div style={{ fontSize: ".85rem", color: V.GO }}>✓ You're on the list — we'll email you the moment Pines opens.</div>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" aria-label="Email" style={{ background: "rgba(255,255,255,.04)", border: "1px solid " + (err ? V.HOLD : "var(--pb-line-strong)"), borderRadius: 10, padding: "11px 14px", color: "var(--pb-ink)", fontFamily: sans, fontSize: ".88rem", outline: "none" }} />
                <button type="submit" style={{ cursor: "pointer", fontFamily: sans, fontWeight: 700, fontSize: ".88rem", color: "var(--pb-bg)", background: GOLD, border: "none", borderRadius: 10, padding: "11px" }}>Get Early Access</button>
                {err && <span style={{ fontSize: ".72rem", color: V.HOLD }}>{err}</span>}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ====================== SHOP ====================== */
const PRODUCTS = [
  { l: "Trail Badges Collection", d: "Heavyweight embroidered t‑shirt", q: "Yosemite National Park" },
  { l: "Tribes Hoodie", d: "Deep forest fleece, oversized fit", q: "Sequoia National Park" },
  { l: "Trip Book", d: "Custom‑printed adventure logbook", q: "Grand Canyon National Park", href: "/trip-book" },
];
function ShopSection() {
  return (
    <section style={{ ...section }}>
      <div className="pbl-split" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ maxWidth: 560 }}>
          <Eyebrow>Gear up</Eyebrow>
          <H2>Wear the wild.</H2>
          <p style={{ fontSize: ".96rem", lineHeight: 1.6, color: "var(--pb-ink-2)", marginTop: 14 }}>Exclusive Park Buddy apparel, original park art, and Trip Book — your adventure, printed and bound.</p>
        </div>
        <Link href="/shop" style={{ fontFamily: sans, fontWeight: 700, fontSize: ".85rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "11px 22px", textDecoration: "none", flex: "none" }}>Shop Now</Link>
      </div>
      <div className="pbl-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 34 }}>
        {PRODUCTS.map((p) => (
          <Link key={p.l} href={p.href || "/shop"} className="pbl-card" style={{ borderRadius: 18, overflow: "hidden", border: "1px solid var(--pb-line)", background: "var(--pb-surface)", textDecoration: "none" }}>
            <div style={{ position: "relative", aspectRatio: "4/3" }}><Photo q={p.q} overlay="linear-gradient(180deg,rgba(10,23,18,.1),rgba(10,23,18,.55))" /></div>
            <div style={{ padding: "14px 16px 18px" }}>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.15rem", color: "var(--pb-ink)" }}>{p.l}</div>
              <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 2 }}>{p.d}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ====================== YOUR EDGE (vision) ====================== */
function VisionSection() {
  return (
    <section style={{ ...section }}>
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <Eyebrow>Your edge</Eyebrow>
        <H2>Features no other park app has.</H2>
        <p style={{ fontSize: ".96rem", lineHeight: 1.6, color: "var(--pb-ink-2)", marginTop: 14 }}>Built on real data. Designed for real adventures. <span style={{ color: "var(--pb-gold-soft)" }}>In the works.</span></p>
      </div>
      <div className="pbl-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 40 }}>
        {/* Dark Sky */}
        <div className="pbl-vcard" style={vcard}>
          <SoonTag />
          <div style={vIcon}>✦</div>
          <h3 style={vTitle}>Dark Sky Forecast</h3>
          <p style={vDesc}>Bortle rating, moon phase, Milky Way visibility and cloud cover for every park. Know exactly when to look up.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%,#fff,#7fa8ff)" }} />
            <span style={{ fontFamily: mono, fontSize: ".62rem", color: "var(--pb-ink-2)" }}>Bortle 2 — Excellent</span>
          </div>
        </div>
        {/* Passport */}
        <div className="pbl-vcard" style={vcard}>
          <SoonTag />
          <div style={vIcon}>◎</div>
          <h3 style={vTitle}>Digital Passport</h3>
          <p style={vDesc}>GPS check‑in at every park earns a collectible stamp. Build your collection, track your journey, share your adventures.</p>
          <div style={{ display: "flex", gap: 7, marginTop: 14, alignItems: "center" }}>
            {["YOS", "ZIO", "GLA", "YEL"].map((s, i) => (
              <span key={s} style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid " + (i < 2 ? "var(--pb-gold-2)" : "var(--pb-line-strong)"), color: i < 2 ? "var(--pb-gold)" : "var(--pb-muted)", background: i < 2 ? "rgba(217,183,121,.08)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: ".5rem" }}>{s}</span>
            ))}
            <span style={{ fontFamily: mono, fontSize: ".56rem", color: "var(--pb-muted)", marginLeft: 4 }}>12 / 63</span>
          </div>
        </div>
        {/* SOS */}
        <div className="pbl-vcard" style={vcard}>
          <SoonTag />
          <div style={vIcon}>⛑</div>
          <h3 style={vTitle}>Trip Check‑In & SOS</h3>
          <p style={vDesc}>Auto‑share your itinerary with an emergency contact. One‑tap SOS with the nearest ranger station and your precise location — because someone should always know where you are.</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(79,217,138,.06)", border: "1px solid " + V.GO + "44" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.GO, boxShadow: "0 0 8px " + V.GO }} />
            <span style={{ fontFamily: mono, fontSize: ".6rem", color: "var(--pb-ink-2)" }}>Last check‑in: 2h ago · Contact notified</span>
          </div>
        </div>
      </div>
    </section>
  );
}
const vcard = { position: "relative", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 18, padding: "24px 22px" };
const vIcon = { width: 42, height: 42, borderRadius: 12, background: "rgba(217,183,121,.1)", border: "1px solid var(--pb-line)", color: "var(--pb-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", marginBottom: 14 };
const vTitle = { fontFamily: serif, fontWeight: 600, fontSize: "1.35rem", color: "var(--pb-ink)", margin: 0 };
const vDesc = { fontSize: ".85rem", lineHeight: 1.55, color: "var(--pb-ink-2)", margin: "8px 0 0" };
const SoonTag = () => <span style={{ position: "absolute", top: 16, right: 16, fontFamily: mono, fontSize: ".48rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "3px 8px" }}>Coming</span>;

/* ====================== CLOSE ====================== */
function CloseSection() {
  const bg = usePhoto("Grand Canyon National Park");
  return (
    <section style={{ position: "relative", minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "clamp(80px,12vw,140px) 24px", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${bg || "/media/hero-loop-poster.jpg"})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,var(--pb-bg),rgba(10,23,18,.72),var(--pb-bg))" }} />
      <div style={{ position: "relative", maxWidth: 640 }}>
        <h2 style={{ fontFamily: serif, fontWeight: 500, fontStyle: "italic", fontSize: "clamp(2.2rem,5.5vw,3.6rem)", color: "#fff", margin: 0, textShadow: "0 3px 20px rgba(0,0,0,.6)" }}>Adventure's better with a Buddy.</h2>
        <p style={{ fontSize: "1rem", color: "rgba(244,241,234,.85)", margin: "16px auto 26px", maxWidth: 440 }}>Join thousands of park lovers who check their verdict every morning.</p>
        <Link href="/explore" style={{ fontFamily: sans, fontWeight: 700, fontSize: "1rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "15px 34px", textDecoration: "none", boxShadow: "0 12px 34px -12px rgba(217,183,121,.7)" }}>Start Exploring →</Link>
      </div>
    </section>
  );
}

/* ====================== FOOTER ====================== */
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--pb-line)", padding: "40px clamp(20px,5vw,40px)", maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/brand/the-park-buddy-badge.png" alt="The Park Buddy" width={48} height={48} style={{ width: 48, height: 48, objectFit: "contain" }} />
          <span style={{ fontFamily: mono, fontSize: ".62rem", color: "var(--pb-muted)" }}>© 2025 The Park Buddy. Real data. Real adventures.</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {["National Weather Service", "National Park Service", "Recreation.gov", "OpenStreetMap", "AirNow", "USFS"].map((s) => (
            <span key={s} style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".04em", color: "var(--pb-muted)" }}>{s}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/terms" style={{ fontFamily: mono, fontSize: ".58rem", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--pb-muted)", textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ fontFamily: mono, fontSize: ".58rem", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--pb-muted)", textDecoration: "none" }}>Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useDarkBody();
  return (
    <>
      <div aria-hidden style={{ position: "fixed", inset: 0, background: "var(--pb-bg)", zIndex: -1 }} />
      <SiteHeader active={null} />
      <main style={{ fontFamily: sans, color: "var(--pb-ink)", overflowX: "hidden" }}>
        <Hero />
        <VerdictEngine />
        <ExploreSection />
        <TripStudioSection />
        <BookSection />
        <PinesSection />
        <ShopSection />
        <VisionSection />
        <CloseSection />
        <Footer />
      </main>
      <style>{`
        @keyframes pbFadeIn { to { opacity: 1; } }
        .pbl-card { transition: transform .18s ease, border-color .22s, background .22s; }
        @media (hover:hover){ .pbl-card:hover{ transform: translateY(-3px); border-color: rgba(217,183,121,.5); } .pbl-vcard:hover{ border-color: rgba(217,183,121,.4); } }
        @media (max-width: 900px){
          .pbl-split { grid-template-columns: 1fr !important; }
          .pbl-swap { order: 2; }
          .pbl-5 { grid-template-columns: 1fr 1fr !important; }
          .pbl-pines { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 680px){
          .pbl-3 { grid-template-columns: 1fr !important; }
          .pbl-5 { grid-template-columns: 1fr 1fr !important; }
          .pbl-pines { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </>
  );
}
