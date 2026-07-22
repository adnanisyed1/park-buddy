"use client";

// The React landing page (replaces the legacy public/embed/home). Built from the
// Figma handoff (fileKey JJlqqcU2BXe2A4WzwS6Oqv) on the shared platform shell —
// SiteHeader (top nav + mobile bubble) + PbTabBar (mobile bottom bar) come from
// <SiteHeader/>, so a single nav change hits the whole platform. Section imagery is
// the set of tiles generated for the Figma light frame (12:4) — hero, the scenic-
// route illustration, Pines reels, shop products, close band — served from
// /public/media/landing (see CoverImg). The graphical bits (verdict chips, passport
// stamps, Bortle badge) are SVG/CSS. Copy is 1:1 with the design. Honesty: live
// sections link to real routes; Pines is "early access", the "Your Edge" trio "coming".
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import PillarShowcase from "./components/PillarShowcase";
import ScrollTrail from "./components/ScrollTrail";
import { useTheme } from "./lib/theme";

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
      {/* One fade mechanism only, driven by onLoad — a mount-time keyframe used to
          race slow networks and make late photos pop in instead of fading. */}
      {url && <img src={url} alt={alt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0, transition: "opacity .5s var(--pb-ease-out)" }} onLoad={(e) => (e.currentTarget.style.opacity = 1)} />}
      {overlay && <div style={{ position: "absolute", inset: 0, background: overlay }} />}
    </div>
  );
}
/* Static cover image — the real generated tiles from the Figma light frame (12:4),
   stored under /public/media/landing. Used where the design ships a specific asset
   (hero, the scenic-route illustration, Pines reels, shop products, close band). */
function CoverImg({ src, alt = "", style, imgStyle, overlay }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(160deg,#16321f,#0c1c12)", ...style }}>
      <img src={src} alt={alt} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...imgStyle }} />
      {overlay && <div style={{ position: "absolute", inset: 0, background: overlay }} />}
    </div>
  );
}

/* ── Animated tiles ──────────────────────────────────────────────────────────
   Runway loops live in /public/media/landing as <name>.mp4 (mp4/H.264 plays
   everywhere; no webm since there's no local transcoder yet). MotionTile lazy-
   loads each clip as it nears the viewport. Live now: map-band, reel-glacier,
   reel-sequoia, reel-teton. Hero is intentionally still (user is remaking its
   video) — set the Hero MotionTile's `video` prop back to "/media/landing/hero"
   once hero.mp4 is dropped in. */
const MOTION_READY = true;

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

// A cover tile that plays a muted, looping video when one is available (and the
// user hasn't asked for reduced motion), falling back to the still — which also
// serves as the video's poster so nothing flashes on load. The clip is LAZY: its
// src is only attached (and playback started) once the tile scrolls near the
// viewport, and it pauses when scrolled away — so the (uncompressed) videos don't
// download until needed and don't burn CPU/battery off-screen.
function MotionTile({ img, video, alt = "", style, imgStyle, overlay }) {
  const reduced = usePrefersReducedMotion();
  const useVideo = MOTION_READY && video && !reduced;
  const vidRef = useRef(null);
  useEffect(() => {
    const v = vidRef.current;
    if (!useVideo || !v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.src) v.src = video + ".mp4"; // attach on first approach → defers the download
          v.play && v.play().catch(() => {});
        } else if (v.src) {
          v.pause && v.pause();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [useVideo, video]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(160deg,#16321f,#0c1c12)", ...style }}>
      {useVideo ? (
        <video ref={vidRef} muted loop playsInline preload="none" poster={img} aria-label={alt}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...imgStyle }} />
      ) : (
        <img src={img} alt={alt} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...imgStyle }} />
      )}
      {overlay && <div style={{ position: "absolute", inset: 0, background: overlay }} />}
    </div>
  );
}

/* Counts a stat up from 0 the first time it's seen — the "live tally" should
   feel live. One-shot, rAF-driven, cubic ease-out; reduced motion (or no IO)
   renders the final number immediately. */
function CountUp({ to }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = parseInt(to, 10) || 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = String(target); return; }
    let raf, started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      started = true;
      io.disconnect();
      const t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>0</span>;
}

/* Once-only scroll reveal for card grids — the arrival beat the showcase set,
   extended to its neighbors so adjacent sections share one personality.
   Decorative: content is in the DOM throughout; only paint is deferred. */
function Reveal({ children, delay = 0, style }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      ...style,
      opacity: on ? 1 : 0,
      transform: reduced ? "none" : on ? "none" : "translateY(14px)",
      transition: `opacity .6s var(--pb-ease-out) ${delay}ms, transform .6s var(--pb-ease-out) ${delay}ms`,
    }}>{children}</div>
  );
}

/* One tile at a time, advanced by a TIMER (owner ask 2026-07-22): auto-cycles
   with a linear progress bar while on screen, one manual action hands over
   control (dots or chevrons), pauses off-screen, disabled under reduced
   motion. Used by the Explore tools, Trip Studio moves, Shop and Your Edge. */
function TimerDeck({ slides, cycle = 5200, minHeight = 300 }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || reduced || !inView) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % slides.length), cycle);
    return () => clearTimeout(t);
  }, [auto, reduced, inView, active, cycle, slides.length]);
  const go = (i) => { setActive((i + slides.length) % slides.length); setAuto(false); };
  return (
    <div ref={rootRef} style={{ width: "100%", maxWidth: 660, margin: "0 auto" }}>
      <div style={{ position: "relative", minHeight }}>
        <div key={active} className="pbl-deckin">{slides[active]}</div>
        <button className="pbl-deckbtn" aria-label="Previous" onClick={() => go(active - 1)} style={{ left: -18 }}>‹</button>
        <button className="pbl-deckbtn" aria-label="Next" onClick={() => go(active + 1)} style={{ right: -18 }}>›</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 18 }}>
        {auto && !reduced && inView && (
          <span className="pbl-deckprog"><span key={active} className="pbl-deckprog-fill" style={{ animationDuration: cycle + "ms" }} /></span>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {slides.map((_, i) => (
            <button key={i} className="pbl-deckdot" data-on={i === active ? "1" : "0"} aria-label={"Slide " + (i + 1)} onClick={() => go(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* One tile at a time, advanced by YOUR SCROLL (owner ask 2026-07-22 for the
   verdict engine): the section pins while the wrapper scrolls beneath, a
   vertical rail's gold fill mirrors scroll 1:1 (ref transform, no re-render),
   and each third of the scroll distance swaps in the next tile. Reduced
   motion = plain stacked tiles, no pinning. */
function ScrollStory({ slides }) {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef(null), fillRef = useRef(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    // Paint synchronously on scroll — the browser already coalesces scroll
    // events per frame, and routing through rAF adds a frame of lag (and
    // stalls entirely in throttled/background rendering contexts).
    const paint = () => {
      const el = wrapRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(1, total)));
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
      const i = Math.min(slides.length - 1, Math.floor(p * slides.length));
      setIdx((prev) => (prev === i ? prev : i));
    };
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", paint);
    paint();
    return () => { window.removeEventListener("scroll", paint); window.removeEventListener("resize", paint); };
  }, [reduced, slides.length]);
  if (reduced) {
    return <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620, margin: "0 auto" }}>{slides.map((s, i) => <div key={i}>{s.tile}</div>)}</div>;
  }
  return (
    <div ref={wrapRef} style={{ height: slides.length * 85 + "vh", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <div style={{ display: "flex", gap: 26, alignItems: "stretch", width: "min(640px, 92vw)" }}>
          {/* the scroll-tracking rail */}
          <div style={{ position: "relative", width: 2, flex: "none", background: "var(--pb-line)", borderRadius: 1 }}>
            <span ref={fillRef} style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#e8cf9a,#c9a35f)", transformOrigin: "top", transform: "scaleY(0)", borderRadius: 1, boxShadow: "0 0 8px rgba(217,183,121,.5)" }} />
            {slides.map((_, i) => (
              <span key={i} style={{ position: "absolute", left: "50%", top: ((i + 0.5) / slides.length) * 100 + "%", width: 9, height: 9, margin: "-4.5px 0 0 -4.5px", borderRadius: "50%", background: i <= idx ? "#c9a35f" : "var(--pb-surface)", border: "1.5px solid " + (i <= idx ? "#e8cf9a" : "var(--pb-line-strong)"), transition: "background .3s, border-color .3s" }} />
            ))}
          </div>
          <div style={{ flex: 1, position: "relative", minHeight: 300 }}>
            <div key={idx} className="pbl-deckin">{slides[idx].tile}</div>
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".2em", color: "var(--pb-muted)" }}>
          {String(idx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")} — KEEP SCROLLING
        </div>
      </div>
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
  const hero = "/media/landing/hero.jpg"; // Figma light frame (12:4) hero render
  return (
    <header style={{ position: "relative", minHeight: "min(100vh,860px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "120px 20px 90px", overflow: "hidden" }}>
      <MotionTile img={hero} video="/media/landing/hero" alt="" imgStyle={{ transform: "scale(1.05)" }} />
      {/* Two-part scrim: a light legibility wash up top (fades out by ~58%), then a
          long dissolve to the page that ramps through the page's OWN hue at 0→full
          alpha (var(--pb-bg-0) → var(--pb-bg)) so there's no muddy dark→cream band. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,23,18,.5) 0%,rgba(10,23,18,.24) 30%,rgba(10,23,18,.08) 56%,var(--pb-bg-0) 66%,var(--pb-bg) 99%)" }} />
      <div style={{ position: "relative", maxWidth: 820 }}>
        {/* One-time staggered entrance (badge → headline → sub → tally → CTAs).
            First visit is the "rare/delight" frequency bucket — the one place a
            hero is allowed choreography. 110ms steps, strong ease-out. */}
        <div className="pbl-in" style={{ animationDelay: ".05s", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: mono, fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#e7e3d8", border: "1px solid rgba(217,183,121,.4)", borderRadius: 999, padding: "7px 16px", background: "rgba(9,17,12,.35)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: V.GO, boxShadow: "0 0 8px " + V.GO }} /> The honest national park companion
        </div>
        <h1 className="pbl-in" style={{ animationDelay: ".16s", fontFamily: serif, fontWeight: 500, fontSize: "clamp(2.9rem,8vw,5.4rem)", lineHeight: 1.0, color: "#fff", margin: "22px 0 0", textShadow: "0 4px 30px rgba(0,0,0,.5)", textWrap: "balance" }}>
            Know if today's <span style={{ fontStyle: "italic", color: "var(--pb-gold)" }}>the day.</span>
        </h1>
        <p className="pbl-in" style={{ animationDelay: ".27s", fontFamily: sans, fontSize: "clamp(1rem,1.6vw,1.2rem)", lineHeight: 1.6, color: "rgba(244,241,234,.9)", margin: "20px auto 0", maxWidth: 560, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
          One honest go / no‑go call for every U.S. national park — live weather, alerts, air and fire — plus everything to plan, book and live the trip.
        </p>
        {/* live verdict tally — numbers count up on first view */}
        <div className="pbl-in" style={{ animationDelay: ".38s", display: "inline-flex", gap: 18, margin: "26px auto 0", padding: "10px 20px", borderRadius: 16, background: "rgba(9,17,12,.42)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", border: "1px solid var(--pb-line)" }}>
          {[["47", "GO", V.GO], ["11", "PREPARE", V.PREPARE], ["5", "HOLD", V.HOLD]].map(([n, l, c]) => (
            <span key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <b style={{ fontFamily: serif, fontSize: "1.5rem", color: c, fontVariantNumeric: "tabular-nums" }}><CountUp to={n} /></b>
              <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".14em", color: "#c9cec6" }}>{l}</span>
            </span>
          ))}
        </div>
        <div className="pbl-in" style={{ animationDelay: ".5s", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 30 }}>
          <Link href="/explore" className="pbl-btn" style={{ fontFamily: sans, fontSize: ".95rem", fontWeight: 700, color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "14px 26px", textDecoration: "none", boxShadow: "0 10px 30px -10px rgba(217,183,121,.7)" }}>Open the Live Map →</Link>
          <Link href="/build-trip" className="pbl-btn" style={{ fontFamily: sans, fontSize: ".95rem", fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "14px 26px", textDecoration: "none", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>Plan a Trip</Link>
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
      {/* One tile at a time, driven by YOUR scroll (owner ask 2026-07-22): the
          section pins, the rail's gold fill tracks the scroll 1:1, and each
          third of the journey swaps in the next stage of the pipeline. */}
      <ScrollStory slides={cards.map((c, i) => ({ tile: (
        <div style={{ position: "relative", background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 18, padding: "26px 24px", minHeight: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: mono, fontSize: ".6rem", color: "var(--pb-gold)", border: "1px solid var(--pb-line-strong)", borderRadius: 6, padding: "3px 7px" }}>{"0" + (i + 1)}</span>
            <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", color: "var(--pb-ink)" }}>{c.t}</span>
          </div>
          {c.verdicts ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {[["GO", "Perfect conditions. Go today."], ["PREPARE", "Conditions changing. Plan carefully."], ["HOLD", "Stay out — closures or hazards."]].map(([v, d]) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <VChip v={v} /><span style={{ fontSize: ".92rem", color: "var(--pb-ink-2)" }}>{d}</span>
                </div>
              ))}
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 11 }}>
              {c.items.map((it) => (
                <li key={it} style={{ display: "flex", gap: 10, fontSize: ".94rem", color: "var(--pb-ink-2)", lineHeight: 1.45 }}>
                  <span style={{ color: "var(--pb-gold)", flex: "none" }}>›</span>{it}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) }))} />
      <p style={{ textAlign: "center", fontFamily: mono, fontSize: ".64rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 28 }}>
        Updated every 15 minutes from federal data sources. No opinions. No guesses. Just data.
      </p>
    </section>
  );
}

/* ====================== TRUSTED SOURCES ====================== */
// Every chip is a feed the platform actually calls (lodging/photo partners
// excluded on purpose — this section is about the DATA the verdicts and
// pages are built from). The streams are SVG dashes flowing along curved
// paths into the badge: constant motion, so the easing is linear — the one
// place linear is correct. pathLength=100 normalizes speed across curves.
const SOURCES = [
  { n: "NWS", d: "National Weather Service" },
  { n: "NPS", d: "National Park Service" },
  { n: "USFS", d: "US Forest Service" },
  { n: "USGS", d: "Hydrography & place names" },
  { n: "USACE", d: "Army Corps — dams & lakes" },
  { n: "EPA AirNow", d: "Air quality index" },
  { n: "NIFC", d: "Wildfire intelligence" },
  { n: "Recreation.gov", d: "Campsites & permits" },
  { n: "ERA5", d: "Climate reanalysis" },
  { n: "OpenStreetMap", d: "Trails & places" },
];

function TrustedSources() {
  const streams = [
    { d: "M0 20 C 150 20, 250 150, 396 178", dur: 3.2, delay: 0 },
    { d: "M0 95 C 140 95, 260 165, 396 180", dur: 2.7, delay: -0.9 },
    { d: "M0 180 C 160 180, 260 180, 396 182", dur: 3.6, delay: -1.7 },
    { d: "M0 265 C 140 265, 260 200, 396 184", dur: 2.9, delay: -0.4 },
    { d: "M0 340 C 150 340, 250 215, 396 186", dur: 3.4, delay: -2.2 },
  ];
  return (
    <section style={{ ...section }}>
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <Eyebrow>Sources we answer to</Eyebrow>
        <H2>We only trust the trustworthy.</H2>
        <p style={{ fontSize: ".96rem", lineHeight: 1.6, color: "var(--pb-ink-2)", marginTop: 14 }}>
          No scraped blogs. No vibes. Every verdict our Buddies see is distilled from official
          federal feeds and open data — flowing in all day, weighed every 15 minutes.
        </p>
      </div>

      <div className="pbl-flowgrid" style={{ display: "grid", gridTemplateColumns: "270px 1fr 170px", gap: 18, alignItems: "center", marginTop: 44 }}>
        {/* the sources */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {SOURCES.map((s, i) => (
            <Reveal key={s.n} delay={i * 45}>
              <div title={s.d} style={{ padding: "9px 11px", borderRadius: 11, background: "var(--pb-surface)", border: "1px solid var(--pb-line)" }}>
                <div style={{ fontFamily: mono, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-gold)" }}>{s.n}</div>
                <div style={{ fontSize: ".62rem", color: "var(--pb-muted)", marginTop: 2, lineHeight: 1.3 }}>{s.d}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* the flow — data streaming toward the badge */}
        <svg className="pbl-flowsvg" viewBox="0 0 400 360" preserveAspectRatio="none" aria-hidden style={{ width: "100%", height: 260 }}>
          {streams.map((s, i) => (
            <g key={i}>
              <path d={s.d} pathLength="100" fill="none" stroke="var(--pb-line-strong)" strokeWidth="1" />
              <path className="pbl-flow" d={s.d} pathLength="100" fill="none" stroke="var(--pb-gold)" strokeWidth="1.8" strokeLinecap="round"
                strokeDasharray="3 17" style={{ animationDuration: s.dur + "s", animationDelay: s.delay + "s" }} />
            </g>
          ))}
        </svg>

        {/* the Buddy — in: ten feeds, out: one call */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 108, height: 108 }}>
            <div className="pbl-flowring" style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "1.5px solid var(--pb-line-strong)", borderTopColor: "var(--pb-gold)" }} />
            <img src="/brand/the-park-buddy-badge.png" alt="The Park Buddy" width={108} height={108} style={{ position: "relative", objectFit: "contain", filter: "drop-shadow(0 6px 18px rgba(0,0,0,.35))" }} />
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, border: "1px solid " + V.GO + "55", background: V.GO + "12" }}>
            <span className="pbl-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: V.GO }} />
            <span style={{ fontFamily: mono, fontSize: ".58rem", fontWeight: 700, letterSpacing: ".1em", color: V.GO }}>ONE HONEST CALL</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ====================== EXPLORE (map) ====================== */
// Every tile is a SHIPPED /explore capability (inventoried from ExploreApp.jsx
// 2026-07-22) — the honesty rule applies to marketing too: no tile for
// anything that isn't live on the map today.
const EXPLORE_FEATURES = [
  { t: "Live verdicts", d: "One honest GO / PREPARE / HOLD on every pin, refreshed every 15 minutes.", pulse: true,
    ic: <circle cx="12" cy="12" r="5" /> },
  { t: "Temps on every pin", d: "Teardrop markers carry the current temperature — read the map like a dashboard.",
    ic: <><path d="M12 3a2 2 0 0 1 2 2v7a4 4 0 1 1-4 0V5a2 2 0 0 1 2-2z" /><path d="M12 9v6" /></> },
  { t: "Three systems, one map", d: "63 National Parks, National Forests and State Parks — layered together.",
    ic: <><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></> },
  { t: "Trail drill-downs", d: "Elevation profiles, difficulty, time estimates and hiker reviews per trail.",
    ic: <><path d="M3 20l6-9 4 5 3-4 5 8z" /><circle cx="17" cy="5" r="2" /></> },
  { t: "Campgrounds that book", d: "Live site availability, straight through to Recreation.gov.",
    ic: <><path d="M12 5 4 19h16z" /><path d="M12 5v14M8 19l4-6 4 6" /></> },
  { t: "Live webcams", d: "See the trailhead sky before you commit to the drive.",
    ic: <><rect x="3" y="6" width="14" height="11" rx="2" /><path d="M17 10l4-2v7l-4-2" /></> },
  { t: "Alerts & closures", d: "Official NPS alert feeds, right on the pin that they affect.",
    ic: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></> },
  { t: "Air & fire", d: "AirNow air quality and active-wildfire proximity, weighed into the verdict.",
    ic: <><path d="M12 20a6 6 0 0 0 6-6c0-4-3-6-6-11-3 5-6 7-6 11a6 6 0 0 0 6 6z" /></> },
  { t: "Basecamp towns", d: "A layer that shows which town serves which park — and where to stay.",
    ic: <><path d="M4 20V9l5-4 5 4M9 20v-6h4v6" /><path d="M14 20V11l6-3v12" /></> },
  { t: "Scenic drives", d: "America's byways drawn as real routes you can add to a trip.",
    ic: <><path d="M4 19c5 0 3-12 8-12s3 12 8 12" /><path d="M12 5v1.5M12 10v1.5M12 15v1.5" /></> },
  { t: "Search that thinks", d: "Type-grouped, state-aware search — filter the whole map to your state.",
    ic: <><circle cx="10" cy="10" r="6" /><path d="M15 15l5 5" /></> },
  { t: "Build as you browse", d: "One tap adds any park, trail or campground to your trip.",
    ic: <><path d="M12 5v14M5 12h14" /></> },
];
// Four themed tiles of three tools each (indexes into EXPLORE_FEATURES).
const EXPLORE_GROUPS = [
  { title: "Know before you go", items: [0, 6, 7] },
  { title: "One map, every place", items: [2, 8, 9] },
  { title: "Look closer", items: [3, 4, 5] },
  { title: "Browse like a local", items: [1, 10, 11] },
];

function ExploreSection() {
  return (
    // THE band recipe (one pattern, used by Explore, Plan and Pines alike —
    // owner call 2026-07-22): page bg → deep green #0c1f15 → page bg. The
    // ends resolve to the CURRENT theme's bg (this gradient sits outside the
    // .pb-forcedark subtree), so in Dark the band matches the Figma page 1:1
    // and in Light it dissolves from cream — same three swells either way.
    <section style={{ position: "relative", overflow: "hidden" }}>
     <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, var(--pb-bg), #0c1f15, var(--pb-bg))" }} />
     <div className="pb-forcedark" style={{ position: "relative" }}>
     <div style={{ ...section }}>
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
          {/* Real "map that breathes" render from the Figma light frame (glowing US
              outline on the console table); the verdict card floats over it. */}
          <MotionTile img="/media/landing/map-band.jpg" video="/media/landing/map-band" alt="Live national-park map" />
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

      {/* Everything on the map — twelve tools as FOUR themed tiles on a timer
          (owner ask 2026-07-22). Each tile carries three tools; the deck
          auto-advances with a progress bar and yields to dots/chevrons. */}
      <div style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 34px" }}>
          <Eyebrow>Everything on the map</Eyebrow>
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.5rem,3vw,2.1rem)", lineHeight: 1.1, color: "var(--pb-ink)", margin: "10px 0 0", textWrap: "balance" }}>
            Twelve tools hiding in one map.
          </h3>
        </div>
        <TimerDeck minHeight={330} slides={EXPLORE_GROUPS.map((grp) => (
          <div key={grp.title} style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line-strong)", borderRadius: 18, padding: "24px 26px" }}>
            <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".18em", color: "var(--pb-gold-soft)", marginBottom: 16 }}>{grp.title.toUpperCase()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {grp.items.map((idx2) => { const f = EXPLORE_FEATURES[idx2]; return (
                <div key={f.t} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                  <span style={{ position: "relative", flex: "none", width: 34, height: 34, borderRadius: 10, background: "rgba(217,183,121,.08)", border: "1px solid var(--pb-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--pb-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{f.ic}</svg>
                    {f.pulse && <span className="pbl-pulse" aria-hidden style={{ position: "absolute", right: -3, top: -3, width: 8, height: 8, borderRadius: "50%", background: V.GO }} />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "var(--pb-ink)", lineHeight: 1.15 }}>{f.t}</b>
                    <span style={{ fontSize: ".8rem", lineHeight: 1.45, color: "var(--pb-ink-2)" }}>{f.d}</span>
                  </span>
                </div>
              ); })}
            </div>
          </div>
        ))} />
        <p style={{ textAlign: "center", marginTop: 26 }}>
          <Link href="/explore" className="pbl-btn" style={{ display: "inline-block", fontFamily: sans, fontWeight: 700, fontSize: ".88rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "12px 24px", textDecoration: "none" }}>Try them all on the live map →</Link>
        </p>
      </div>
     </div>
     </div>
    </section>
  );
}

/* ====================== TRIP STUDIO ====================== */
// Same rule as the Explore tiles: every feature here is SHIPPED in Trip
// Studio today (time engine, day planner, exports — all live on /build-trip).
const TRIP_FEATURES = [
  { t: "Seven ways in", d: "Add parks, forests, state parks, trails, campgrounds, scenic drives and basecamp towns.",
    ic: <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="9" /></> },
  { t: "Real drive times", d: "Every leg is measured on real roads — not straight lines on a map.",
    ic: <><path d="M4 13l2-6h12l2 6M4 13h16v4H4z" /><path d="M7 17v2M17 17v2" /></> },
  { t: "Daylight-fit pacing", d: "Days are planned against actual sunrise and sunset, so you're never hiking out in the dark.",
    ic: <><circle cx="12" cy="14" r="4" /><path d="M12 6V4M6 14H4M20 14h-2M7 9l-1.5-1.5M17 9l1.5-1.5M4 19h16" /></> },
  { t: "Plan all my days", d: "One tap schedules every stop into days — durations, drives between stops, pacing.",
    ic: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4M8 14h3M8 17h6" /></> },
  { t: "Optimize the order", d: "Reorders your stops to cut backtracking and wasted miles.",
    ic: <><path d="M4 7h11M4 12h7M4 17h13" /><path d="M18 5l3 2-3 2M14 10l3 2-3 2M20 15l-3 2 3 2" /></> },
  { t: "Conditions, per day", d: "Each day's stops carry their live verdict and forecast — replan before the weather does.",
    ic: <><path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z" /><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" /></> },
  { t: "Byways, folded in", d: "A scenic drive joins as one stop with its waypoints tucked inside — no itinerary spam.",
    ic: <><path d="M4 19c5 0 3-12 8-12s3 12 8 12" /><circle cx="12" cy="7" r="1.6" /></> },
  { t: "Take it anywhere", d: "Share a link, sync days to your calendar, print a PDF — or bind it as a Trip Book.",
    ic: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5" /></> },
  { t: "Trip Mode", d: "Day-of, hit Start Trip Mode — your plan becomes a live guide, stop to stop.",
    ic: <><circle cx="12" cy="12" r="8" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" /><path d="M10 14l5-5-3 6z" /></> },
  { t: "Pack & Go checklist", d: "A trip-aware checklist — pack, grab, do — that follows you into Trip Mode and the PDF.",
    ic: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 8.5l1.5 1.5 3-3M8.5 14.5l1.5 1.5 3-3" /></> },
  { t: "Ask Buddy, mid-plan", d: "Describe your trip in a sentence — the Buddy fills your checklist and answers as you build.",
    ic: <><path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H10l-4 4v-4H7a3 3 0 0 1-3-3z" /><path d="M9 9h6M9 12h4" /></> },
  { t: "Route ⇄ Explore", d: "Flip the studio map between your route and the full live Explore map.",
    ic: <><path d="M7 8h10l-3-3M17 16H7l3 3" /></> },
];
// Four themed tiles of three moves each (indexes into TRIP_FEATURES).
const TRIP_GROUPS = [
  { title: "Build it", items: [0, 6, 10] },
  { title: "Let it plan itself", items: [1, 2, 3] },
  { title: "Tune it", items: [4, 5, 11] },
  { title: "Live it", items: [8, 9, 7] },
];

function TripStudioSection() {
  return (
    // The SAME dissolve as the Pines band below it (owner call 2026-07-22:
    // Plan and Pines read as one family) — page bg → deep green → page bg.
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, var(--pb-bg), #0c1f15, var(--pb-bg))" }} />
      <div style={{ ...section, position: "relative" }}>
      <div className="pbl-split" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center" }}>
        <div className="pbl-swap pbl-tripcard" style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid var(--pb-line-strong)", background: "var(--pb-surface)", padding: 18, display: "grid", gridTemplateColumns: "1fr 0.9fr", gap: 16, alignItems: "center" }}>
          <div>
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
          {/* THE REAL PRODUCT (owner ask 2026-07-22): a screenshot of Trip
              Studio's actual itinerary UI — Utah's Mighty 5, captured from
              /build-trip — replaces the illustrated scenic route. */}
          <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 14, overflow: "hidden", border: "1px solid var(--pb-line)" }}>
            <CoverImg src="/media/landing/trip-itinerary-real.jpg" alt="Trip Studio itinerary — Utah's Mighty 5" imgStyle={{ objectFit: "cover", objectPosition: "top" }} />
          </div>
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

      {/* Inside Trip Studio — twelve moves as FOUR themed tiles on a timer,
          mirroring the Explore deck so the two pillars read identically. */}
      <div style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 34px" }}>
          <Eyebrow>Inside Trip Studio</Eyebrow>
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.5rem,3vw,2.1rem)", lineHeight: 1.1, color: "var(--pb-ink)", margin: "10px 0 0", textWrap: "balance" }}>
            Twelve moves from wishlist to trail.
          </h3>
        </div>
        <TimerDeck minHeight={330} slides={TRIP_GROUPS.map((grp) => (
          <div key={grp.title} style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 18, padding: "24px 26px" }}>
            <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".18em", color: "var(--pb-gold-soft)", marginBottom: 16 }}>{grp.title.toUpperCase()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {grp.items.map((idx2) => { const f = TRIP_FEATURES[idx2]; return (
                <div key={f.t} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                  <span style={{ flex: "none", width: 34, height: 34, borderRadius: 10, background: "rgba(217,183,121,.08)", border: "1px solid var(--pb-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--pb-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{f.ic}</svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "var(--pb-ink)", lineHeight: 1.15 }}>{f.t}</b>
                    <span style={{ fontSize: ".8rem", lineHeight: 1.45, color: "var(--pb-ink-2)" }}>{f.d}</span>
                  </span>
                </div>
              ); })}
            </div>
          </div>
        ))} />
        <p style={{ textAlign: "center", marginTop: 26 }}>
          <Link href="/build-trip" className="pbl-btn" style={{ display: "inline-block", fontFamily: sans, fontWeight: 700, fontSize: ".88rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "12px 24px", textDecoration: "none" }}>Plan a trip in Trip Studio →</Link>
        </p>
      </div>
      </div>
    </section>
  );
}

/* ====================== BOOK ====================== */
/* BookSection removed 2026-07-22: its five category cards repeated what the
   pillar showcase's Book vignette and the site nav already advertise — the
   audit's "repeatable content" cut. `git log` has it if it's ever missed. */

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
        {/* Desktop: reels row (3) + early-access card. Phone: reels become a
            swipeable strip showing ~2 at a time (see .pbl-reels/.pbl-reel CSS),
            with the early-access card stacked below. */}
        <div className="pbl-pines" style={{ display: "grid", gridTemplateColumns: "3fr 1.1fr", gap: 14, marginTop: 40, alignItems: "stretch" }}>
          <div className="pbl-reels" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[["Glacier", "GO", "reel-glacier"], ["Sequoia", null, "reel-sequoia"], ["Grand Teton", "PREPARE", "reel-teton"]].map(([name, v, base]) => (
              <div key={name} className="pbl-reel" style={{ position: "relative", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", border: "1px solid var(--pb-line)" }}>
                <MotionTile img={`/media/landing/${base}.jpg`} video={`/media/landing/${base}`} alt={name} overlay="linear-gradient(180deg,rgba(6,14,10,.15) 0%,transparent 40%,rgba(6,14,10,.85))" />
                {v && <span style={{ position: "absolute", right: 10, top: 10 }}><VChip v={v} small /></span>}
                {/* play affordance (Pines is short video) */}
                <span style={{ position: "absolute", top: "44%", left: "50%", transform: "translate(-50%,-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(10,17,12,.5)", border: "1px solid rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span style={{ position: "absolute", left: 12, bottom: 12, fontFamily: serif, fontWeight: 600, color: "#fff", fontSize: "1rem", textShadow: "0 2px 8px #000" }}>📍 {name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: "22px 20px", borderRadius: 16, background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)" }}>
            <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", color: "var(--pb-gold-soft)" }}>EARLY ACCESS</div>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", lineHeight: 1.1 }}>Get behind the Pines before anyone else.</div>
            {/* keyed wrapper so form → success crossfades instead of hard-cutting */}
            {done ? (
              <div key="done" className="pbl-swapin" style={{ fontSize: ".85rem", color: V.GO, display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span className="pbl-pop" style={{ flex: "none", width: 18, height: 18, borderRadius: "50%", background: "rgba(79,217,138,.15)", border: "1px solid " + V.GO + "66", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".62rem" }}>✓</span>
                You're on the list — we'll email you the moment Pines opens.
              </div>
            ) : (
              <form key="form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="email" className="pbl-input" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@email.com" aria-label="Email" style={{ background: "rgba(255,255,255,.04)", border: "1px solid " + (err ? V.HOLD : "var(--pb-line-strong)"), borderRadius: 10, padding: "11px 14px", color: "var(--pb-ink)", fontFamily: sans, fontSize: ".88rem", outline: "none" }} />
                <button type="submit" className="pbl-btn" style={{ cursor: "pointer", fontFamily: sans, fontWeight: 700, fontSize: ".88rem", color: "var(--pb-bg)", background: GOLD, border: "none", borderRadius: 10, padding: "11px" }}>Get Early Access</button>
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
  { l: "Trail Badges Collection", d: "Heavyweight embroidered t‑shirt", price: "$38", src: "/media/landing/shop-badges-tee.jpg" },
  { l: "Tribes Hoodie", d: "Deep forest fleece, oversized fit", price: "$72", src: "/media/landing/shop-tribes-hoodie.jpg" },
  { l: "Trip Book", d: "Custom‑printed adventure logbook", price: "$45", src: "/media/landing/shop-trip-book.jpg", href: "/trip-book" },
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
        <Link href="/shop" className="pbl-btn" style={{ fontFamily: sans, fontWeight: 700, fontSize: ".85rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "11px 22px", textDecoration: "none", flex: "none" }}>Shop Now</Link>
      </div>
      {/* One product at a time on the shared timer deck (owner ask 2026-07-22) */}
      <div style={{ marginTop: 34 }}>
        <TimerDeck minHeight={460} slides={PRODUCTS.map((p) => (
          <Link key={p.l} href={p.href || "/shop"} className="pbl-card" style={{ display: "block", borderRadius: 18, overflow: "hidden", border: "1px solid var(--pb-line-strong)", background: "var(--pb-surface)", textDecoration: "none" }}>
            <div style={{ position: "relative", aspectRatio: "16/10", background: "#f2f0ec" }}><CoverImg src={p.src} alt={p.l} style={{ background: "#f2f0ec" }} imgStyle={{ objectFit: "cover" }} /></div>
            <div style={{ padding: "16px 18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.3rem", color: "var(--pb-ink)" }}>{p.l}</div>
                <div style={{ fontSize: ".82rem", color: "var(--pb-muted)", marginTop: 2 }}>{p.d}</div>
              </div>
              <span style={{ fontFamily: mono, fontSize: ".9rem", fontWeight: 700, color: "var(--pb-gold)", flex: "none", marginTop: 4 }}>{p.price}</span>
            </div>
          </Link>
        ))} />
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
      {/* One upcoming edge at a time on the shared timer deck */}
      <div style={{ marginTop: 40 }}>
        <TimerDeck minHeight={280} slides={[
          <div key="sky" className="pbl-vcard" style={vcard}>
            <SoonTag />
            <div style={vIcon}>✦</div>
            <h3 style={vTitle}>Dark Sky Forecast</h3>
            <p style={vDesc}>Bortle rating, moon phase, Milky Way visibility and cloud cover for every park. Know exactly when to look up.</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%,#fff,#7fa8ff)" }} />
              <span style={{ fontFamily: mono, fontSize: ".62rem", color: "var(--pb-ink-2)" }}>Bortle 2 — Excellent</span>
            </div>
          </div>,
          <div key="pass" className="pbl-vcard" style={vcard}>
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
          </div>,
          <div key="sos" className="pbl-vcard" style={vcard}>
            <SoonTag />
            <div style={vIcon}>⛑</div>
            <h3 style={vTitle}>Trip Check‑In & SOS</h3>
            <p style={vDesc}>Auto‑share your itinerary with an emergency contact. One‑tap SOS with the nearest ranger station and your precise location — because someone should always know where you are.</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(79,217,138,.06)", border: "1px solid " + V.GO + "44" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: V.GO, boxShadow: "0 0 8px " + V.GO }} />
              <span style={{ fontFamily: mono, fontSize: ".6rem", color: "var(--pb-ink-2)" }}>Last check‑in: 2h ago · Contact notified</span>
            </div>
          </div>,
        ]} />
        <p style={{ textAlign: "center", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 24 }}>
          …and that's just what's on the bench. The map, the studio and the book keep growing every week.
        </p>
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
  const bg = "/media/landing/close.jpg"; // Figma light frame (12:4) closing band
  return (
    <section style={{ position: "relative", minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "clamp(80px,12vw,140px) 24px", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${bg || "/media/hero-loop-poster.jpg"})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,var(--pb-bg),rgba(10,23,18,.72),var(--pb-bg))" }} />
      <div style={{ position: "relative", maxWidth: 640 }}>
        <h2 style={{ fontFamily: serif, fontWeight: 500, fontStyle: "italic", fontSize: "clamp(2.2rem,5.5vw,3.6rem)", color: "#fff", margin: 0, textShadow: "0 3px 20px rgba(0,0,0,.6)" }}>Adventure's better with a Buddy.</h2>
        <p style={{ fontSize: "1rem", color: "rgba(244,241,234,.85)", margin: "16px auto 26px", maxWidth: 440 }}>Join thousands of park lovers who check their verdict every morning.</p>
        <Link href="/explore" className="pbl-btn" style={{ fontFamily: sans, fontWeight: 700, fontSize: "1rem", color: "var(--pb-bg)", background: GOLD, borderRadius: 999, padding: "15px 34px", textDecoration: "none", boxShadow: "0 12px 34px -12px rgba(217,183,121,.7)" }}>Start Exploring →</Link>
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
  // BOTH themes, ONE pattern (owner call 2026-07-22, second pass): the light
  // theme stays — Dark mode renders the exact Figma continuous-dark story,
  // Light mode renders the cream story. Consistency comes from the shared
  // band recipe (bg → #0c1f15 → bg): its ENDS are var(--pb-bg), so the same
  // three green swells dissolve into whichever page color the theme sets.
  const theme = useTheme();
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = theme === "light" ? "#faf8f4" : "#0a1712";
    return () => { document.body.style.background = prev; };
  }, [theme]);
  // Head start for the most-clicked CTA: prefetch Explore's boot data while
  // the visitor is still reading (idle-time, cache-only — Explore's own
  // loadScript calls then hit the HTTP cache instead of the network). The
  // showcase's real map already warms the Google Maps script itself.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    const id = idle(() => {
      for (const href of ["/trip-data.js", "/pb-verdict.js", "/gateway-towns.js"]) {
        if (document.querySelector(`link[href="${href}"]`)) continue;
        const l = document.createElement("link");
        l.rel = "prefetch"; l.as = "script"; l.href = href;
        document.head.appendChild(l);
      }
    });
    return () => { (window.cancelIdleCallback || clearTimeout)(id); };
  }, []);
  return (
    <div className="pb-theme">
      <div aria-hidden style={{ position: "fixed", inset: 0, background: "var(--pb-bg)", zIndex: -1 }} />
      <SiteHeader active={null} />
      {/* overflow-x CLIP, not hidden: hidden turns main into a scroll container
          and silently kills every position:sticky inside (the verdict scroll
          story pins on sticky). clip clips without the scroll context. */}
      <main style={{ fontFamily: sans, color: "var(--pb-ink)", overflowX: "clip" }}>
        <Hero />
        <div data-trail-stop="One place"><PillarShowcase /></div>
        <div data-trail-stop="The verdict engine"><VerdictEngine /></div>
        <div data-trail-stop="Trusted sources"><TrustedSources /></div>
        <div data-trail-stop="Explore"><ExploreSection /></div>
        <div data-trail-stop="Build Trips"><TripStudioSection /></div>
        <div data-trail-stop="Pines"><PinesSection /></div>
        <div data-trail-stop="Shop"><ShopSection /></div>
        <div data-trail-stop="Your edge"><VisionSection /></div>
        <CloseSection />
        <Footer />
        <ScrollTrail />
      </main>
      {/* dangerouslySetInnerHTML is LOAD-BEARING: a plain <style>{`…`}</style>
          child gets HTML-escaped on the server but not the client (apostrophes
          → &#x27;), which kills hydration for the whole page. Same scar as
          ParkStatusV2. Never convert this back to a text child. */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* hero entrance — one-time stagger, strong ease-out */
        .pbl-in { opacity: 0; transform: translateY(14px); animation: pblIn .7s var(--pb-ease-out) forwards; }
        @keyframes pblIn { to { opacity: 1; transform: translateY(0); } }

        /* every gold CTA: press compresses, hover lifts (fine pointers only) */
        .pbl-btn { transition: transform .16s var(--pb-ease-out), box-shadow .25s ease; will-change: transform; }
        .pbl-btn:active { transform: scale(0.97); }
        @media (hover:hover) and (pointer:fine){ .pbl-btn:hover { transform: translateY(-1px); } .pbl-btn:active { transform: scale(0.97); } }

        .pbl-card { transition: transform .18s var(--pb-ease-out), border-color .22s, background .22s; }
        .pbl-card:active { transform: scale(0.98); }
        @media (hover:hover){ .pbl-card:hover{ transform: translateY(-3px); border-color: rgba(217,183,121,.5); } .pbl-vcard:hover{ border-color: rgba(217,183,121,.4); } }

        /* keyboard focus is visible — outline:none was hiding it */
        .pbl-input:focus-visible { border-color: rgba(217,183,121,.65) !important; box-shadow: 0 0 0 3px rgba(217,183,121,.22); }

        /* Pines form → success crossfade + check pop */
        .pbl-swapin { animation: pblIn .3s var(--pb-ease-out) both; }
        .pbl-pop { animation: pblPop .35s var(--pb-ease-out) .12s both; }
        @keyframes pblPop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }

        /* deck primitives: keyed slide entrance, chevrons, dots, timer bar */
        .pbl-deckin { animation: pblDeckIn .45s var(--pb-ease-out) both; }
        @keyframes pblDeckIn { from { opacity: 0; transform: translateY(14px) scale(.99); } to { opacity: 1; transform: none; } }
        .pbl-deckbtn { position: absolute; top: 50%; margin-top: -17px; width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.05rem; line-height: 1;
          background: var(--pb-surface); border: 1px solid var(--pb-line-strong); color: var(--pb-gold);
          transition: transform .16s var(--pb-ease-out), border-color .22s ease; z-index: 2; }
        .pbl-deckbtn:active { transform: scale(0.92); }
        @media (hover:hover) and (pointer:fine){ .pbl-deckbtn:hover { border-color: rgba(217,183,121,.6); } }
        .pbl-deckdot { width: 8px; height: 8px; border-radius: 50%; padding: 0; cursor: pointer;
          background: var(--pb-surface); border: 1.5px solid var(--pb-line-strong);
          transition: transform .16s var(--pb-ease-out), background .25s, border-color .25s; }
        .pbl-deckdot[data-on="1"] { background: #c9a35f; border-color: #e8cf9a; }
        .pbl-deckdot:active { transform: scale(0.8); }
        @media (hover:hover) and (pointer:fine){ .pbl-deckdot:hover { transform: scale(1.4); } }
        .pbl-deckprog { width: 130px; height: 2px; border-radius: 1px; background: var(--pb-line); overflow: hidden; display: block; }
        .pbl-deckprog-fill { display: block; height: 100%; background: linear-gradient(90deg,#e8cf9a,#c9a35f);
          transform-origin: left; animation: pblDeckProg linear forwards; }
        @keyframes pblDeckProg { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce){ .pbl-deckin { animation: pblFadeOnly .2s ease both; } .pbl-deckprog { display: none; } }

        /* trusted-sources streams: dashes flow along normalized paths (pathLength=100,
           period 3+17=20 → offset -20 loops seamlessly). Constant motion = linear. */
        .pbl-flow { animation: pblFlow 3s linear infinite; }
        @keyframes pblFlow { to { stroke-dashoffset: -20; } }
        .pbl-flowring { animation: pblSpin 9s linear infinite; }
        @keyframes pblSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce){
          .pbl-flow, .pbl-flowring { animation: none; }
        }
        @media (max-width: 900px){
          .pbl-flowgrid { grid-template-columns: 1fr !important; }
          .pbl-flowsvg { display: none; }
        }

        /* the verdict tile's live dot — a slow, subtle breath (scale+opacity only) */
        .pbl-pulse { animation: pblPulse 2.6s ease-in-out infinite; box-shadow: 0 0 8px rgba(79,217,138,.8); }
        @keyframes pblPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(0.78); } }

        /* verdict strip: hidden scrollbar + soft edge fades */
        .pbl-vstrip { scrollbar-width: none;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 22px, #000 calc(100% - 22px), transparent);
          mask-image: linear-gradient(90deg, transparent, #000 22px, #000 calc(100% - 22px), transparent); }
        .pbl-vstrip::-webkit-scrollbar { display: none; }

        @media (prefers-reduced-motion: reduce){
          .pbl-in { transform: none; animation: pblFadeOnly .3s ease forwards; }
          .pbl-card:hover, .pbl-btn:hover { transform: none !important; }
          .pbl-pulse { animation: none; }
        }
        @keyframes pblFadeOnly { to { opacity: 1; } }

        @media (max-width: 900px){
          .pbl-split { grid-template-columns: 1fr !important; }
          .pbl-swap { order: 2; }
          .pbl-pines { grid-template-columns: 1fr !important; }
          .pbl-4 { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 680px){
          .pbl-3 { grid-template-columns: 1fr !important; }
          .pbl-4 { grid-template-columns: 1fr 1fr !important; }
          .pbl-tripcard { grid-template-columns: 1fr !important; }
          /* Pines reels → swipeable strip, ~2 in view with a peek of the next */
          .pbl-reels {
            display: flex !important;
            grid-template-columns: none !important;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            gap: 12px;
            padding-bottom: 8px;
            scrollbar-width: none;
          }
          .pbl-reels::-webkit-scrollbar { display: none; }
          .pbl-reel { flex: 0 0 46%; scroll-snap-align: start; }
        }
      ` }} />
    </div>
  );
}
