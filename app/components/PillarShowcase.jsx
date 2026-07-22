"use client";

// "One place for the whole trip" — the landing page's product tour. Four
// pillars (Explore · Build Trips · Book · Trip Books), each advertised by a
// small animated vignette that DEMONSTRATES the feature instead of describing
// it: pins drop onto a live map, an itinerary assembles, a booking confirms,
// a trip book opens. Built on the Emil Kowalski / Apple-motion playbook:
//   · marketing animation is the one place delight is allowed (rare-view,
//     purpose = explanation) — so entrances are choreographed, then calm
//   · transform/opacity/clip-path only (compositor-friendly), custom easing
//     curves (built-in CSS easings are too weak), stagger 60-90ms
//   · nothing enters from scale(0); entrances are ease-out; the tab progress
//     bar is the only linear motion (constant motion → linear)
//   · auto-advance cycles the pillars until the user takes over (agency:
//     one manual tab click stops the tour), pauses off-screen and when the
//     tab is hidden, and is disabled entirely under prefers-reduced-motion
//   · reduced motion = instant final states + plain crossfade, not a lockout
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const serif = "var(--pb-serif)", sans = "var(--pb-sans)", mono = "var(--pb-mono)";
const V = { GO: "#4fd98a", PREPARE: "#e8cf9a", HOLD: "#e08a6a" };
const GOLD = "linear-gradient(120deg,#e8cf9a,#c9a35f)";
const CYCLE_MS = 5200; // per-pillar dwell; entrance choreography is ~2s, then calm

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(!!m.matches);
    on();
    m.addEventListener ? m.addEventListener("change", on) : m.addListener(on);
    return () => (m.removeEventListener ? m.removeEventListener("change", on) : m.removeListener(on));
  }, []);
  return reduced;
}

const PILLARS = [
  {
    key: "explore", label: "Explore", tag: "Live verdicts on a breathing map", href: "/explore",
    cta: "Open the live map", caption: "Every park, forest and state park — one honest go / no-go call each.",
    icon: <><circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 1 8 8c0 5.3-8 12-8 12S4 15.3 4 10a8 8 0 0 1 8-8z" /></>,
  },
  {
    key: "plan", label: "Build Trips", tag: "Itineraries on real roads", href: "/build-trip",
    cta: "Open Trip Studio", caption: "Real drive times, daylight-fit pacing, shareable plans.",
    icon: <><path d="M4 19V8l5-3 6 3 5-3v11l-5 3-6-3-5 3z" /><path d="M9 5v11M15 8v11" /></>,
  },
  {
    key: "book", label: "Book", tag: "Stays, tours & permits", href: "/book",
    cta: "Browse bookings", caption: "Cabins, campgrounds, guided tours — only what's actually available.",
    icon: <><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-6h4v6" /></>,
  },
  {
    key: "tripbook", label: "Trip Books", tag: "Your adventure, printed", href: "/trip-book",
    cta: "Design your book", caption: "The whole trip — stops, photos, stamps — printed and bound.",
    icon: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M5 4v13a3 3 0 0 0 3 3" /><path d="M9 8h6M9 11h4" /></>,
  },
];

/* ── vignettes ─────────────────────────────────────────────────────────── */

// Explore: teardrop pins drop onto a night map with stagger, then a verdict
// card rises. Pins keep a barely-there float afterwards so the map "breathes".
function ExploreVignette() {
  const pins = [
    { x: 22, y: 34, t: "72°", v: "GO" }, { x: 44, y: 22, t: "58°", v: "PREPARE" },
    { x: 63, y: 40, t: "81°", v: "GO" }, { x: 36, y: 58, t: "66°", v: "GO" }, { x: 76, y: 62, t: "94°", v: "HOLD" },
  ];
  return (
    <div className="pbx-scene" style={{ background: "radial-gradient(120% 120% at 50% 0%, #12241a, #0a1712)" }}>
      <div aria-hidden className="pbx-dots" />
      {pins.map((p, i) => (
        <div key={i} className="pbx-float" style={{ position: "absolute", left: p.x + "%", top: p.y + "%", animationDelay: 1.2 + i * 0.35 + "s" }}>
          <div className="pbx-pin" style={{ animationDelay: i * 0.07 + "s" }}>
            <span className="pbx-pin-body" style={{ borderColor: V[p.v] + "aa" }}>
              <b style={{ color: V[p.v] }}>{p.t}</b>
            </span>
          </div>
        </div>
      ))}
      <div className="pbx-vcard">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <b style={{ fontFamily: serif, fontSize: ".98rem", color: "#f4f1ea" }}>Yellowstone</b>
          <span style={{ fontFamily: mono, fontSize: ".76rem", color: "var(--pb-gold)" }}>72°F</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
          <span className="pbx-glow" style={{ width: 7, height: 7, borderRadius: "50%", background: V.GO }} />
          <span style={{ fontFamily: mono, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".1em", color: V.GO }}>GO — great day to be out</span>
        </div>
      </div>
    </div>
  );
}

// Build Trips: itinerary rows slide in, the dashed drive-line draws itself
// downward (clip-path), then the plan's summary chip settles in.
function PlanVignette() {
  const stops = [["Yosemite Valley", "GO", "Clear · 76°F"], ["Death Valley", "PREPARE", "Extreme heat · 112°F"], ["Zion Canyon", "GO", "Sunny · 84°F"]];
  return (
    <div className="pbx-scene" style={{ background: "var(--pb-surface)", padding: "clamp(16px,4%,30px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", color: "var(--pb-gold-soft)", marginBottom: 10 }} className="pbx-row" >ROUTE ITINERARY · 5 DAYS</div>
      {stops.map(([n, v, d], i) => (
        <div key={n}>
          <div className="pbx-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", animationDelay: 0.12 + i * 0.22 + "s" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "1px solid " + V[v] + "88", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, color: V[v], fontSize: ".8rem" }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <b style={{ fontSize: ".88rem", color: "var(--pb-ink)", whiteSpace: "nowrap" }}>{n}</b>
                <span style={{ fontFamily: mono, fontSize: ".5rem", fontWeight: 700, letterSpacing: ".08em", color: V[v], border: "1px solid " + V[v] + "66", background: V[v] + "14", borderRadius: 999, padding: "2px 7px" }}>{v}</span>
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", marginTop: 1 }}>{d}</div>
            </div>
          </div>
          {i < stops.length - 1 && (
            <div style={{ marginLeft: 14, height: 22, display: "flex", alignItems: "center", gap: 14 }}>
              <span className="pbx-drawline" style={{ animationDelay: 0.3 + i * 0.22 + "s" }} />
              <span className="pbx-fadein" style={{ fontFamily: mono, fontSize: ".56rem", color: "var(--pb-muted)", animationDelay: 0.55 + i * 0.22 + "s" }}>↓ {i === 0 ? "Drive 4h 15m" : "Drive 5h 40m"}</span>
            </div>
          )}
        </div>
      ))}
      <div className="pbx-fadein" style={{ display: "inline-flex", alignSelf: "flex-start", gap: 10, marginTop: 12, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--pb-line-strong)", background: "rgba(217,183,121,.07)", animationDelay: "1.25s" }}>
        <span style={{ fontFamily: mono, fontSize: ".58rem", color: "var(--pb-gold)" }}>5 days · 612 mi · fits daylight</span>
      </div>
    </div>
  );
}

// Book: three cards fan in, then the middle one's button morphs Book → Booked
// with a blur-masked crossfade (two states never read as two objects).
function BookVignette() {
  const cards = [
    { l: "Cabin · Estes Park", d: "2 nights · sleeps 4", r: -5, dy: 12, tone: "#1c3527" },
    { l: "Guided rafting", d: "Half-day · from $89", r: 0, dy: 0, tone: "#233a2c", main: true },
    { l: "Timed entry permit", d: "Sunrise window", r: 5, dy: 12, tone: "#1c3527" },
  ];
  return (
    <div className="pbx-scene" style={{ background: "radial-gradient(110% 110% at 50% 10%, #142a1d, #0b1a12)", display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(8px,2%,16px)", padding: "6%" }}>
      {cards.map((c, i) => (
        <div key={c.l} className="pbx-fan" style={{ "--r": c.r + "deg", "--dy": c.dy + "px", animationDelay: 0.1 + i * 0.09 + "s", width: "31%", maxWidth: 190, background: "rgba(9,17,12,.88)", border: "1px solid " + (c.main ? "rgba(217,183,121,.45)" : "var(--pb-line)"), borderRadius: 14, padding: "13px 13px 12px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
          <div style={{ height: 44, borderRadius: 9, background: "linear-gradient(150deg," + c.tone + ",#0d1d13)", marginBottom: 9, border: "1px solid rgba(255,255,255,.05)" }} />
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: ".82rem", color: "#f4f1ea", lineHeight: 1.15 }}>{c.l}</div>
          <div style={{ fontSize: ".64rem", color: "rgba(244,241,234,.55)", margin: "3px 0 9px" }}>{c.d}</div>
          {c.main ? (
            <span className="pbx-morph" style={{ display: "block", position: "relative", height: 28 }}>
              <span className="pbx-morph-a" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 700, fontSize: ".7rem", color: "#0a1712", background: GOLD, borderRadius: 8 }}>Book now →</span>
              <span className="pbx-morph-b" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: sans, fontWeight: 700, fontSize: ".7rem", color: V.GO, background: "rgba(79,217,138,.1)", border: "1px solid " + V.GO + "55", borderRadius: 8 }}>✓ Booked</span>
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 28, fontFamily: sans, fontWeight: 600, fontSize: ".68rem", color: "rgba(244,241,234,.75)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8 }}>View →</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Trip Books: the cover swings open in 3D from the spine, revealing the
// printed page — photo tiles settle, then a passport stamp presses in.
function TripBookVignette() {
  return (
    <div className="pbx-scene" style={{ background: "radial-gradient(110% 110% at 50% 0%, #16281c, #0b1811)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ perspective: 1100, width: "min(56%,300px)", aspectRatio: "4/3", position: "relative" }}>
        {/* the open page underneath */}
        <div style={{ position: "absolute", inset: 0, background: "#f4efe4", borderRadius: "4px 12px 12px 4px", boxShadow: "0 18px 50px -18px rgba(0,0,0,.65)", padding: "9% 8%", overflow: "hidden" }}>
          <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".18em", color: "#8a7d5f", marginBottom: 8 }} className="pbx-fadein">DAY 3 — ROCKY MOUNTAIN NP</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 7 }}>
            <div className="pbx-settle" style={{ aspectRatio: "4/3", borderRadius: 6, background: "linear-gradient(150deg,#3e6a4e,#1d3a28)", animationDelay: ".75s" }} />
            <div className="pbx-settle" style={{ aspectRatio: "4/3", borderRadius: 6, background: "linear-gradient(150deg,#7d9bb8,#3d5871)", animationDelay: ".9s" }} />
          </div>
          <div className="pbx-fadein" style={{ marginTop: 8, animationDelay: "1.05s" }}>
            {[92, 70].map((w, i) => <div key={i} style={{ height: 4, width: w + "%", borderRadius: 2, background: "#d9d0bc", marginTop: 5 }} />)}
          </div>
          {/* passport stamp presses in */}
          <div className="pbx-stamp" aria-hidden>
            <span style={{ fontFamily: mono, fontSize: ".44rem", letterSpacing: ".1em" }}>ROCKY MTN</span>
            <span style={{ fontFamily: serif, fontSize: ".62rem", fontWeight: 700 }}>JUL 21</span>
          </div>
        </div>
        {/* the cover, opening from the spine */}
        <div className="pbx-cover" style={{ position: "absolute", inset: 0, transformOrigin: "left center", background: "linear-gradient(150deg,#1e3a29,#0f2318)", border: "1px solid rgba(217,183,121,.4)", borderRadius: "4px 12px 12px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, backfaceVisibility: "hidden" }}>
          <img src="/brand/the-park-buddy-badge.png" alt="" width={54} height={54} style={{ objectFit: "contain" }} />
          <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".85rem", color: "#e8cf9a" }}>Our Summer Out West</span>
          <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".22em", color: "rgba(232,207,154,.6)" }}>THE PARK BUDDY PRESS</span>
        </div>
      </div>
    </div>
  );
}

const VIGNETTES = { explore: ExploreVignette, plan: PlanVignette, book: BookVignette, tripbook: TripBookVignette };

/* ── the showcase ──────────────────────────────────────────────────────── */
export default function PillarShowcase() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true); // one manual click hands the wheel to the user
  const [inView, setInView] = useState(false);
  const rootRef = useRef(null);

  // Play only while visible; browsers throttle timers in hidden tabs anyway,
  // but re-keying animations off-screen would waste the choreography.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || reduced || !inView) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % PILLARS.length), CYCLE_MS);
    return () => clearTimeout(t);
  }, [auto, reduced, inView, active]);

  const p = PILLARS[active];
  const Vignette = VIGNETTES[p.key];

  return (
    <section ref={rootRef} className={"pbx" + (reduced ? " pbx-reduced" : "") + (inView ? " pbx-inview" : "")}
      style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(72px,10vw,120px) clamp(20px,5vw,40px)" }}>
      <div className="pbx-head" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>One place</div>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2rem,4.6vw,3.1rem)", lineHeight: 1.04, color: "var(--pb-ink)", margin: "10px 0 0", textWrap: "balance" }}>
          The whole trip lives here.
        </h2>
        <p style={{ fontSize: ".96rem", lineHeight: 1.6, color: "var(--pb-ink-2)", marginTop: 14 }}>
          Check conditions, plan the route, book the real thing, then print the memory. Four tools, one Buddy.
        </p>
      </div>

      <div className="pbx-grid" style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 18, marginTop: 42, alignItems: "stretch" }}>
        {/* pillar rail */}
        <div role="tablist" aria-label="What Park Buddy does" className="pbx-rail" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PILLARS.map((pl, i) => (
            <button key={pl.key} role="tab" aria-selected={i === active}
              onClick={() => { setActive(i); setAuto(false); }}
              className={"pbx-tab" + (i === active ? " pbx-tab-on" : "")}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>{pl.icon}</svg>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: serif, fontWeight: 600, fontSize: "1.02rem", lineHeight: 1.1 }}>{pl.label}</span>
                <span className="pbx-tab-tag" style={{ display: "block", fontSize: ".68rem", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pl.tag}</span>
              </span>
              {i === active && auto && !reduced && inView && <span key={active} className="pbx-progress" aria-hidden />}
            </button>
          ))}
        </div>

        {/* stage — re-keyed per pillar so each vignette replays its choreography */}
        <div role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div key={p.key} className="pbx-stagein" style={{ position: "relative", flex: 1, minHeight: 340, borderRadius: 20, overflow: "hidden", border: "1px solid var(--pb-line-strong)" }}>
            <Vignette />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span key={p.key + "-cap"} className="pbx-fadein" style={{ fontSize: ".84rem", color: "var(--pb-ink-2)" }}>{p.caption}</span>
            <Link href={p.href} className="pbx-cta" style={{ fontFamily: sans, fontWeight: 700, fontSize: ".86rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "11px 22px", textDecoration: "none", flex: "none" }}>
              {p.cta} →
            </Link>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .pbx { --pbx-out: cubic-bezier(0.23, 1, 0.32, 1); --pbx-inout: cubic-bezier(0.77, 0, 0.175, 1); }

        /* section entrance — once, subtle */
        .pbx .pbx-head, .pbx .pbx-grid { opacity: 0; transform: translateY(14px); transition: opacity .6s var(--pbx-out), transform .6s var(--pbx-out); }
        .pbx.pbx-inview .pbx-head, .pbx.pbx-inview .pbx-grid { opacity: 1; transform: translateY(0); }
        .pbx.pbx-inview .pbx-grid { transition-delay: .08s; }

        .pbx-tab { display: flex; align-items: center; gap: 12; text-align: left; position: relative; overflow: hidden;
          gap: 12px; padding: 14px 16px; border-radius: 14px; cursor: pointer;
          background: var(--pb-surface); border: 1px solid var(--pb-line); color: var(--pb-ink-2);
          transition: transform .16s var(--pbx-out), border-color .22s ease, background .22s ease, color .22s ease; }
        .pbx-tab .pbx-tab-tag { color: var(--pb-muted); transition: color .22s ease; }
        .pbx-tab:active { transform: scale(0.97); }
        @media (hover: hover) and (pointer: fine) {
          .pbx-tab:hover { border-color: rgba(217,183,121,.45); color: var(--pb-ink); }
        }
        .pbx-tab-on { background: rgba(217,183,121,.09); border-color: rgba(217,183,121,.55); color: var(--pb-ink); }
        .pbx-tab-on svg { color: var(--pb-gold); }
        .pbx-tab-on .pbx-tab-tag { color: var(--pb-ink-2); }
        .pbx-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
          background: linear-gradient(90deg, #e8cf9a, #c9a35f); transform-origin: left;
          animation: pbxProgress ${CYCLE_MS}ms linear forwards; }
        @keyframes pbxProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }

        .pbx-cta { transition: transform .16s var(--pbx-out), box-shadow .22s ease; box-shadow: 0 10px 30px -12px rgba(217,183,121,.55); }
        .pbx-cta:active { transform: scale(0.97); }

        .pbx-scene { position: absolute; inset: 0; }
        .pbx-stagein { animation: pbxStage .45s var(--pbx-out) both; }
        @keyframes pbxStage { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: scale(1); } }

        /* shared entrance atoms */
        .pbx-fadein { opacity: 0; animation: pbxFade .5s var(--pbx-out) forwards; }
        @keyframes pbxFade { to { opacity: 1; } }
        .pbx-row { opacity: 0; transform: translateX(-10px); animation: pbxRow .5s var(--pbx-out) forwards; }
        @keyframes pbxRow { to { opacity: 1; transform: translateX(0); } }
        .pbx-settle { opacity: 0; transform: translateY(8px) scale(0.96); animation: pbxSettle .55s var(--pbx-out) forwards; }
        @keyframes pbxSettle { to { opacity: 1; transform: translateY(0) scale(1); } }

        /* Explore */
        .pbx-dots { position: absolute; inset: 0; opacity: .5;
          background-image: radial-gradient(rgba(217,183,121,.14) 1px, transparent 1.4px); background-size: 26px 26px; }
        .pbx-pin { opacity: 0; transform: translateY(-14px) scale(0.9); animation: pbxDrop .55s var(--pbx-out) forwards; }
        @keyframes pbxDrop { 60% { transform: translateY(2px) scale(1); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .pbx-pin-body { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;
          background: rgba(9,17,12,.92); border: 1.5px solid; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
          box-shadow: 0 8px 20px -8px rgba(0,0,0,.6); }
        .pbx-pin-body b { transform: rotate(45deg); font-family: var(--pb-mono); font-size: .58rem; }
        .pbx-float { animation: pbxFloat 4.5s ease-in-out infinite alternate; }
        @keyframes pbxFloat { from { transform: translateY(0); } to { transform: translateY(-4px); } }
        .pbx-vcard { position: absolute; right: 5%; bottom: 8%; width: 200px; padding: 13px 14px; border-radius: 14px;
          background: rgba(9,17,12,.9); border: 1px solid rgba(79,217,138,.35);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          opacity: 0; transform: translateY(10px); animation: pbxRise .55s var(--pbx-out) .95s forwards; }
        @keyframes pbxRise { to { opacity: 1; transform: translateY(0); } }
        .pbx-glow { box-shadow: 0 0 10px ${V.GO}; }

        /* Build Trips: the drive-line draws top-to-bottom */
        .pbx-drawline { width: 1px; height: 100%; border-left: 1px dashed var(--pb-line-strong);
          clip-path: inset(0 0 100% 0); animation: pbxDraw .5s var(--pbx-inout) forwards; }
        @keyframes pbxDraw { to { clip-path: inset(0 0 0 0); } }

        /* Book: cards fan in; the CTA morphs with a blur-masked crossfade */
        .pbx-fan { opacity: 0; transform: translateY(26px) rotate(0deg); animation: pbxFan .6s var(--pbx-out) forwards; }
        @keyframes pbxFan { to { opacity: 1; transform: translateY(var(--dy)) rotate(var(--r)); } }
        .pbx-morph-a { animation: pbxBlurOut .35s ease 1.7s forwards; }
        .pbx-morph-b { opacity: 0; filter: blur(2px); animation: pbxBlurIn .35s ease 1.75s forwards; }
        @keyframes pbxBlurOut { to { opacity: 0; filter: blur(2px); } }
        @keyframes pbxBlurIn { to { opacity: 1; filter: blur(0); } }

        /* Trip Books: cover opens from the spine; stamp presses in */
        .pbx-cover { transform: rotateY(0deg); animation: pbxOpen 1s var(--pbx-inout) .35s forwards; }
        @keyframes pbxOpen { to { transform: rotateY(-142deg); opacity: .0; } }
        .pbx-stamp { position: absolute; right: 7%; bottom: 9%; width: 64px; height: 64px; border-radius: 50%;
          border: 2px solid rgba(176,58,46,.65); color: rgba(176,58,46,.8); display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 1px; transform: rotate(-8deg) scale(1.25); opacity: 0;
          animation: pbxStamp .4s var(--pbx-out) 1.25s forwards; }
        @keyframes pbxStamp { to { opacity: 1; transform: rotate(-8deg) scale(1); } }

        /* reduced motion: instant final states, plain crossfades, no float */
        .pbx-reduced * { animation-duration: .01ms !important; animation-delay: 0ms !important; }
        .pbx-reduced .pbx-float { animation: none !important; }
        .pbx-reduced .pbx-stagein { animation: pbxFade .2s ease both !important; }
        .pbx-reduced .pbx-head, .pbx-reduced .pbx-grid { transform: none; transition: opacity .25s ease; }

        @media (max-width: 900px) {
          .pbx-grid { grid-template-columns: 1fr !important; }
          .pbx-rail { flex-direction: row !important; overflow-x: auto; padding-bottom: 6px;
            scrollbar-width: none; -webkit-overflow-scrolling: touch; }
          .pbx-rail::-webkit-scrollbar { display: none; }
          .pbx-tab { flex: 0 0 auto; }
          .pbx-tab .pbx-tab-tag { display: none; }
        }
      ` }} />
    </section>
  );
}
