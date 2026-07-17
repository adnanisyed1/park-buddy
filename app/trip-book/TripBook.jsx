"use client";

// Book Studio — the workspace that turns a finished trip into a printed hardcover
// keepsake. Rebuilt on the Park Buddy design system from the delivered Figma
// (file 1IuuEX2vq8RVRnyGaEUlMl): a 3-step workspace (Diary → Theme → Preview) with
// an Author/Reader toggle, an open-book spread + pager, per-stop Stop Tools
// (GPS + live distance, edit story, swap photo), cover layouts + palettes, and an
// Order step wired to the existing reservation + Stripe/Lulu checkout. It composes
// from the user's REAL trip (trip.js stops + Trip Mode photos/stories), falling back
// to a Yosemite sample when there's no trip yet. Follows the platform light/dark theme.

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import "./studio.css"; // .tbres-* styles for the reservation modal
import SiteHeader from "../components/SiteHeader";
import { useTheme } from "../lib/theme";
import { getStops, getMeta, subscribeTrip, addStop, removeStop, moveStop } from "../lib/trip";
import {
  getPhotosFor, getStory, setStory, addPhoto, fileToDataUrl,
  distMiles, addCrumb, subscribeTripMode,
} from "../lib/tripmode";

const serif = "var(--pb-serif)", sans = "var(--pb-sans)", mono = "var(--pb-mono)";
const GOLD = "linear-gradient(120deg,#e8cf9a,#c9a35f)";

/* ---------------- real park photos via our pipeline ---------------- */
const photoCache = {};
function usePhoto(candidates) {
  const key = Array.isArray(candidates) ? candidates.join("|") : (candidates || "");
  const first = Array.isArray(candidates) ? candidates[0] : candidates;
  const [url, setUrl] = useState(photoCache[key] || null);
  useEffect(() => {
    if (!first) return;
    if (photoCache[key] !== undefined) { if (photoCache[key]) setUrl(photoCache[key]); return; }
    let on = true;
    (async () => {
      for (const q of (Array.isArray(candidates) ? candidates : [candidates])) {
        try {
          const r = await fetch("/api/photo?q=" + encodeURIComponent(q) + "&w=1200");
          if (!r.ok) continue;
          const d = await r.json();
          const u = d && (d.image || d.thumb);
          if (u) { photoCache[key] = u; if (on) setUrl(u); return; }
        } catch {}
      }
      photoCache[key] = "";
    })();
    return () => { on = false; };
  }, [key]); // eslint-disable-line
  return url;
}

/* ---------------- static config ---------------- */
const LAYOUTS = [
  { key: "centered", name: "Centered", desc: "Gold title centered with fine text layout" },
  { key: "split", name: "Split Photo", desc: "Top-half photo, title beneath" },
  { key: "minimal", name: "Minimal", desc: "Small debossed gold type, corner aligned" },
  { key: "editorial", name: "Editorial", desc: "Big headline spanning the cover" },
  { key: "manuscript", name: "Manuscript", desc: "Botanical bookplate imprint" },
];
const PALETTES = {
  dark: [
    { key: "forest", name: "Forest Dark", base: "#0A1712", ink: "#f4f1ea" },
    { key: "charcoal", name: "Charcoal", base: "#17181a", ink: "#f2f2f0" },
    { key: "navy", name: "Midnight Navy", base: "#0f1a2e", ink: "#eef2f8" },
    { key: "oxblood", name: "Oxblood", base: "#2a1416", ink: "#f4e9e6" },
    { key: "espresso", name: "Espresso", base: "#241a12", ink: "#f2e8dc" },
    { key: "slate", name: "Slate Blue", base: "#141b22", ink: "#e8eef4" },
    { key: "plum", name: "Deep Plum", base: "#1e1420", ink: "#f2e6f0" },
    { key: "pine", name: "Black Pine", base: "#0c1410", ink: "#e9f0ea" },
  ],
  light: [
    { key: "parchment", name: "Parchment", base: "#FAF8F4", ink: "#1a3a2a" },
    { key: "sage", name: "Sage", base: "#eef1ea", ink: "#1f3326" },
    { key: "blush", name: "Blush", base: "#f6efe9", ink: "#3a2a24" },
    { key: "mist", name: "Mist", base: "#eef1f6", ink: "#20303f" },
    { key: "linen", name: "Linen", base: "#f4efe6", ink: "#3a3226" },
    { key: "cloud", name: "Cloud", base: "#f2f4f6", ink: "#2a3138" },
    { key: "rose", name: "Rose Quartz", base: "#f6eef0", ink: "#3a2830" },
    { key: "meadow", name: "Meadow", base: "#eef3ec", ink: "#25352a" },
  ],
};

// ── Physical print options (real Lulu SKUs) ──────────────────────────────────
// The pod_package_id is TRIM.COLOR.QUALITY.BIND.PAPER.FINISH(+linen+foil). All
// options are premium full color on 80# coated white (photo stock). Retail prices
// are guided tiers (Lulu print cost + margin + shipping); wire live /api/lulu-cost
// before charging real money. base + perStop drive the running total.
const SIZES = [
  { key: "square", name: 'Square · 8.5 × 8.5"', trim: "0850X0850", base: 44, perStop: 5, note: "Classic keepsake — sits beautifully on a shelf." },
  { key: "landscape", name: 'Landscape · 11 × 8.5"', trim: "1100X0850", base: 54, perStop: 6, note: "Wider pages — best for sweeping scenery shots." },
];
const COVERS = [
  { key: "casewrap", name: "Photo Hardcover", bind: "CW", add: 0, note: "Your cover photo printed edge-to-edge.", guide: "Most popular" },
  { key: "linen", name: "Linen + Gold Foil", bind: "LW", add: 20, note: "Forest linen wrap with a gold-foil-stamped spine.", guide: "Heirloom" },
];
const FINISHES = [
  { key: "matte", name: "Matte", code: "M", add: 0, note: "Soft, glare-free — our default." },
  { key: "gloss", name: "Gloss", code: "G", add: 0, note: "Punchy, high-shine color." },
];
// Compose the Lulu pod_package_id from the current selection. (Validate each combo
// in the Lulu sandbox before go-live — see /api/lulu-cost.)
function skuFor(sizeKey, coverKey, finishKey) {
  const sz = SIZES.find((s) => s.key === sizeKey) || SIZES[0];
  const cv = COVERS.find((c) => c.key === coverKey) || COVERS[0];
  const fin = FINISHES.find((f) => f.key === finishKey) || FINISHES[0];
  // linen wrap → forest linen (F) + gold foil (G); casewrap → no linen/foil (XX)
  const suffix = cv.key === "linen" ? "M" + "FG" : fin.code + "XX";
  return `${sz.trim}.FC.PRE.${cv.bind}.080CW444.${suffix}`;
}

// Yosemite sample shown when the visitor has no trip yet (matches the Figma demo).
const DEMO = {
  title: "The Great Valley Journey",
  author: "A Park Buddy Traveler",
  region: "California",
  stops: [
    { name: "Tunnel View Entrance", park: "Yosemite National Park", q: ["Tunnel View Yosemite", "Yosemite National Park"], story: "The first look — the whole valley opening at once, El Capitan on the left, Bridalveil Fall thin and bright on the right.", lat: 37.7156, lng: -119.6774 },
    { name: "Glacier Point Overlook", park: "Yosemite National Park", q: ["Glacier Point Yosemite", "Yosemite National Park"], story: "Three thousand feet straight down to the valley floor, Half Dome eye to eye across the gap.", lat: 37.7286, lng: -119.5734 },
    { name: "Half Dome Crest Peak", park: "Yosemite National Park", q: ["Half Dome Yosemite", "Yosemite National Park"], story: "The granite walls of the valley rose vertically into the evening sky. Standing near the base, the scale makes you feel small but incredibly grounded.", lat: 37.7459, lng: -119.5332 },
    { name: "Tuolumne Meadows", park: "Yosemite National Park", q: ["Tuolumne Meadows Yosemite", "Yosemite National Park"], story: "High country — the air thinner and cooler, the river braiding slow through the grass.", lat: 37.8731, lng: -119.3559 },
    { name: "Mariposa Grove Giants", park: "Yosemite National Park", q: ["Mariposa Grove sequoia Yosemite", "Yosemite National Park"], story: "Standing under the Grizzly Giant — two thousand years old, wider than the trail.", lat: 37.5145, lng: -119.6017 },
  ],
};

function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }); }
  catch { return ""; }
}
const fmtCoord = (lat, lng) =>
  (lat == null || lng == null) ? "" :
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;

// Compose the book's spreads from the real trip (or the demo).
function useBook() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const a = subscribeTrip(() => setTick((t) => t + 1));
    const b = subscribeTripMode(() => setTick((t) => t + 1));
    return () => { a && a(); b && b(); };
  }, []);

  let stops = [], meta = {};
  try { stops = getStops() || []; } catch {}
  try { meta = getMeta() || {}; } catch {}
  const stories = (() => { try { return getStory() || {}; } catch { return {}; } })();

  const hasTrip = stops.length > 0;
  if (!hasTrip) {
    const spreads = DEMO.stops.map((s, i) => ({
      name: s.name, park: s.park, q: s.q, userImg: null, story: s.story,
      date: "", lat: s.lat, lng: s.lng, chapter: i + 1,
    }));
    return { isDemo: true, tick, title: DEMO.title, author: DEMO.author, region: DEMO.region, spreads };
  }

  const spreads = stops.map((s, i) => {
    const photos = (() => { try { return getPhotosFor(s.name) || []; } catch { return []; } })();
    const p0 = photos[0];
    return {
      name: s.name,
      park: s.state ? s.name + " · " + s.state : s.name,
      q: [s.name + " National Park", s.name],
      userImg: p0 ? p0.url : null,
      story: stories[s.name] || "",
      date: p0 && p0.ts ? fmtDate(p0.ts) : "",
      lat: s.lat != null ? s.lat : (p0 ? p0.lat : null),
      lng: s.lng != null ? s.lng : (p0 ? p0.lng : null),
      chapter: i + 1,
    };
  });
  const states = [...new Set(stops.map((s) => s.state).filter(Boolean))];
  return {
    isDemo: false, tick,
    title: meta.tripName || "Your Trip Book",
    author: "",
    region: states.length ? states.join(" · ") : "A Park Buddy Trip",
    spreads,
  };
}

/* ---------------- shared pieces ---------------- */
const Eyebrow = ({ children, style }) => (
  <div style={{ fontFamily: mono, fontSize: ".55rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--pb-gold-soft)", ...style }}>{children}</div>
);

// The photo half of a spread — user's own photo, else a licensed park photo.
function SpreadPhoto({ spread, rounded = true, showBadge = true }) {
  const fetched = usePhoto(spread.userImg ? null : spread.q);
  const src = spread.userImg || fetched;
  const coord = fmtCoord(spread.lat, spread.lng);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: rounded ? 6 : 0, background: "linear-gradient(160deg,#16321f,#0c1c12)" }}>
      {src && <img src={src} alt={spread.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(6,14,10,.15) 0%,transparent 30%,rgba(6,14,10,.72))" }} />
      {showBadge && coord && (
        <span style={{ position: "absolute", left: 12, top: 12, fontFamily: mono, fontSize: ".52rem", letterSpacing: ".08em", color: "#e9e3d5", background: "rgba(10,17,12,.6)", border: "1px solid rgba(217,183,121,.4)", borderRadius: 6, padding: "4px 8px", WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)" }}>{coord}</span>
      )}
      <div style={{ position: "absolute", left: 14, bottom: 12, right: 14 }}>
        <div style={{ fontFamily: serif, fontWeight: 600, color: "#fff", fontSize: "1.05rem", lineHeight: 1.15, textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>{spread.name}</div>
        <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".06em", color: "rgba(233,227,213,.85)", marginTop: 3 }}>{spread.park}</div>
      </div>
    </div>
  );
}

// The story half of a spread.
function SpreadStory({ spread }) {
  return (
    <div style={{ padding: "10px 6px" }}>
      <Eyebrow>Chapter {spread.chapter}</Eyebrow>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", color: "var(--pb-ink)", margin: "8px 0 0", lineHeight: 1.1 }}>{spread.name}</h3>
      <div style={{ width: 40, height: 1, background: "var(--pb-line-strong)", margin: "12px 0 14px" }} />
      <p style={{ fontFamily: serif, fontSize: "1rem", lineHeight: 1.7, color: "var(--pb-ink-2)" }}>
        {spread.story || <span style={{ color: "var(--pb-muted)", fontStyle: "italic" }}>No story yet — add one in Stop Tools, or this becomes a clean typographic page in print.</span>}
      </p>
      {spread.date && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".85rem", color: "var(--pb-muted)", marginTop: 16 }}>{spread.date}</div>}
    </div>
  );
}

// The full open-book spread (photo page ‖ story page) used on desktop.
function Spread({ spread }) {
  return (
    <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, boxShadow: "var(--pb-shadow)", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 720, width: "100%" }}>
      <div style={{ aspectRatio: "3/4" }}><SpreadPhoto spread={spread} /></div>
      <SpreadStory spread={spread} />
    </div>
  );
}

function Pager({ i, n, label, onPrev, onNext, dots }) {
  const btn = { cursor: "pointer", width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 20 }}>
      <button style={btn} onClick={onPrev} aria-label="Previous">‹</button>
      {dots ? (
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: n }).map((_, k) => (
            <span key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 999, background: k === i ? "var(--pb-gold)" : "var(--pb-line-strong)", transition: "width .2s" }} />
          ))}
        </div>
      ) : (
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".95rem", color: "var(--pb-ink-2)", minWidth: 90, textAlign: "center" }}>{label}</span>
      )}
      <button style={btn} onClick={onNext} aria-label="Next">›</button>
    </div>
  );
}

/* ---------------- cover preview (Theme step) ---------------- */
function CoverPreview({ title, author, region, layout, palette, dateLabel }) {
  const base = palette.base, ink = palette.ink;
  return (
    <div style={{ width: 340, maxWidth: "80%", aspectRatio: "17/22", background: base, color: ink, border: "1px solid var(--pb-line)", boxShadow: "0 40px 90px -50px rgba(0,0,0,.8)", borderRadius: 4, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* gold frame rule */}
      <div aria-hidden style={{ position: "absolute", inset: 16, border: "1px solid rgba(217,183,121,.45)", borderRadius: 2, pointerEvents: "none" }} />
      {layout.key === "split" ? (
        <>
          <div style={{ flex: "0 0 46%", position: "relative", margin: 22, marginBottom: 0, overflow: "hidden", borderRadius: 2 }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#2a4a38,#12241a)" }} />
          </div>
          <CoverText title={title} author={author} region={region} ink={ink} dateLabel={dateLabel} compact />
        </>
      ) : (
        <div style={{ margin: "auto", textAlign: "center", padding: "0 26px" }}>
          <CoverText title={title} author={author} region={region} ink={ink} dateLabel={dateLabel} />
        </div>
      )}
    </div>
  );
}
function CoverText({ title, author, region, ink, dateLabel, compact }) {
  return (
    <div style={{ textAlign: "center", padding: compact ? "18px 26px 26px" : 0 }}>
      <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".3em", textTransform: "uppercase", color: "rgba(217,183,121,.9)" }}>Vol. I</div>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", lineHeight: 1.1, margin: "12px 0 0", color: ink }}>{title}</h3>
      {region && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".85rem", opacity: .75, marginTop: 8, color: ink }}>A journey through {region}</div>}
      <div aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,.6)", margin: "22px auto", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(217,183,121,.9)", fontSize: ".7rem" }}>✦</div>
      {author && <div style={{ fontFamily: mono, fontSize: ".55rem", letterSpacing: ".14em", textTransform: "uppercase", color: ink, opacity: .85 }}>{author}</div>}
      {dateLabel && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".75rem", opacity: .6, marginTop: 6, color: ink }}>{dateLabel}</div>}
    </div>
  );
}

/* ==================================================================== */
export default function TripBook() {
  useTheme(); // re-render on theme change so tokens flip
  const book = useBook();
  const [step, setStep] = useState("diary"); // diary | theme | preview
  const [role, setRole] = useState("author"); // author | reader
  const [sel, setSel] = useState(0);
  const [layoutKey, setLayoutKey] = useState("split");
  const [pal, setPal] = useState("forest");
  const [isPhone, setIsPhone] = useState(false);
  const [reserve, setReserve] = useState(null);
  const [mobilePage, setMobilePage] = useState("photo"); // photo | story
  const [toolsOpen, setToolsOpen] = useState(true);
  const [sizeKey, setSizeKey] = useState("square");
  const [coverKey, setCoverKey] = useState("casewrap");
  const [finishKey, setFinishKey] = useState("matte");
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(max-width: 860px)");
    const on = () => setIsPhone(m.matches); on();
    m.addEventListener ? m.addEventListener("change", on) : m.addListener(on);
    return () => (m.removeEventListener ? m.removeEventListener("change", on) : m.removeListener(on));
  }, []);

  const spreads = book.spreads;
  const n = spreads.length;
  const cur = spreads[Math.min(sel, n - 1)] || spreads[0];
  const layout = LAYOUTS.find((l) => l.key === layoutKey) || LAYOUTS[0];
  const palette = [...PALETTES.dark, ...PALETTES.light].find((p) => p.key === pal) || PALETTES.dark[0];
  const isLightPal = PALETTES.light.some((p) => p.key === pal);
  const size = SIZES.find((s) => s.key === sizeKey) || SIZES[0];
  const cover = COVERS.find((c) => c.key === coverKey) || COVERS[0];
  const finish = FINISHES.find((f) => f.key === finishKey) || FINISHES[0];
  const sizeName = size.name.replace(/·/, "").replace(/\s+/g, " ").trim() + " Hardcover";
  const sku = skuFor(sizeKey, coverKey, finishKey);
  const pages = 4 + n * 4;
  const priceNum = size.base + n * size.perStop + cover.add;
  const price = "$" + priceNum;

  const prev = () => setSel((s) => (s - 1 + n) % n);
  const next = () => setSel((s) => (s + 1) % n);

  const openReserve = () => setReserve({
    theme: palette.name, size: sizeName, price, title: book.title, dates: "", dedication: "",
    pages, stops: n, cover: cover.name, finish: finish.name, sku,
    entries: spreads.map((s) => ({ type: "Chapter", place: s.name, cap: s.story, userImg: s.userImg, q: s.q })),
  });

  const fmtProps = { size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, priceNum };
  const commonProps = { book, spreads, sel, setSel, cur, n, prev, next, role, openManage: () => setManageOpen(true) };

  return (
    <>
      <SiteHeader acctSlot mobileChromeless hideTabBar />
      <div className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: sans, paddingTop: isPhone ? 0 : 90 }}>
        {isPhone
          ? <MobilePhone {...commonProps} {...fmtProps} step={step} setStep={setStep} setRole={setRole} layout={layout} setLayoutKey={setLayoutKey} pal={pal} setPal={setPal} palette={palette} isLightPal={isLightPal} pages={pages} price={price} openReserve={openReserve} mobilePage={mobilePage} setMobilePage={setMobilePage} toolsOpen={toolsOpen} setToolsOpen={setToolsOpen} />
          : <Desktop {...commonProps} {...fmtProps} step={step} setStep={setStep} setRole={setRole} layout={layout} setLayoutKey={setLayoutKey} pal={pal} setPal={setPal} palette={palette} isLightPal={isLightPal} pages={pages} price={price} openReserve={openReserve} />}
      </div>
      {reserve && <ReserveModal data={reserve} onClose={() => setReserve(null)} />}
      {manageOpen && <ManageStops spreads={spreads} onClose={() => setManageOpen(false)} />}
      <style>{`
        .bs-stopcard:hover{ border-color: var(--pb-line-strong) !important; }
        .bs-btn:hover{ border-color: var(--pb-gold-2) !important; }
        .bs-reels::-webkit-scrollbar{ display:none; }
      `}</style>
    </>
  );
}

/* ---------------- top bar (desktop) ---------------- */
function TopBar({ step, setStep, role, setRole }) {
  const steps = [["diary", "Diary"], ["theme", "Theme"], ["preview", "Preview"]];
  return (
    <div style={{ position: "sticky", top: 90, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", height: 64, borderBottom: "1px solid var(--pb-line)", background: "var(--pb-glass)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--pb-gold)" }}>♟</span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.15rem", color: "var(--pb-ink)" }}>Book Studio</span>
        <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".1em", color: "var(--pb-muted)" }}>· The Park Buddy</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        {steps.map(([k, label], i) => (
          <button key={k} onClick={() => setStep(k)} style={{ cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, color: step === k ? "var(--pb-ink)" : "var(--pb-muted)" }}>
            <span style={{ fontFamily: mono, fontSize: ".56rem", color: step === k ? "var(--pb-gold)" : "var(--pb-muted)" }}>{"0" + (i + 1)}</span>
            <span style={{ fontSize: ".92rem", fontWeight: step === k ? 700 : 500 }}>{label}</span>
            {step === k && <span style={{ width: 14, height: 1, background: "var(--pb-gold)" }} />}
          </button>
        ))}
      </div>
      <RoleToggle role={role} setRole={setRole} />
    </div>
  );
}
function RoleToggle({ role, setRole }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Workspace Role</span>
      <div style={{ display: "flex", background: "var(--pb-tint)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: 3 }}>
        {["author", "reader"].map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".76rem", fontWeight: role === r ? 700 : 500, textTransform: "capitalize", border: "none", borderRadius: 999, padding: "5px 14px", background: role === r ? GOLD : "transparent", color: role === r ? "#0a1712" : "var(--pb-ink-2)" }}>{r}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- desktop steps ---------------- */
function Desktop(props) {
  const { step } = props;
  return (
    <>
      <TopBar step={step} setStep={props.setStep} role={props.role} setRole={props.setRole} />
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {step === "diary" && <DiaryDesktop {...props} />}
        {step === "theme" && <ThemeDesktop {...props} />}
        {step === "preview" && <PreviewDesktop {...props} />}
      </div>
    </>
  );
}

function DiaryDesktop({ spreads, sel, setSel, cur, n, prev, next, role, book, openManage }) {
  const author = role === "author";
  return (
    <div style={{ display: "grid", gridTemplateColumns: author ? "300px 1fr 320px" : "1fr", minHeight: "calc(100vh - 160px)" }}>
      {author && (
        <aside style={{ borderRight: "1px solid var(--pb-line)", padding: "28px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Eyebrow>Your Stops ({n})</Eyebrow>
            <button onClick={openManage} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".7rem", fontWeight: 600, color: "var(--pb-gold)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "5px 11px" }}>Manage</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {spreads.map((s, i) => (
              <button key={i} className="bs-stopcard" onClick={() => setSel(i)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: i === sel ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (i === sel ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: mono, fontSize: ".5rem", color: "var(--pb-muted)" }}>{"0" + (i + 1)}</span>
                  <span style={{ fontFamily: mono, fontSize: ".5rem", color: s.userImg ? "var(--pb-go)" : "var(--pb-muted)" }}>{s.userImg ? "✓ Photo" : "＋ Add photo"}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: ".9rem", color: "var(--pb-ink)", marginTop: 4 }}>{s.name}</div>
                <div style={{ fontSize: ".72rem", color: "var(--pb-muted)" }}>{s.park}</div>
              </button>
            ))}
          </div>
        </aside>
      )}
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 30px" }}>
        <Spread spread={cur} />
        <Pager i={sel} n={n} label={cur.name} onPrev={prev} onNext={next} />
      </main>
      {author && <StopTools spread={cur} />}
    </div>
  );
}

function StopTools({ spread }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(spread.story || "");
  const [dist, setDist] = useState(null);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { setDraft(spread.story || ""); setEditing(false); }, [spread.name]);

  const saveStory = () => { try { setStory(spread.name, draft); } catch {} setEditing(false); };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const url = await fileToDataUrl(f); addPhoto(spread.name, { url, lat: spread.lat, lng: spread.lng }); } catch {}
    e.target.value = "";
  };
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        try { addCrumb(pos.coords.latitude, pos.coords.longitude); } catch {}
        if (spread.lat != null) setDist(distMiles(pos.coords.latitude, pos.coords.longitude, spread.lat, spread.lng));
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };
  const coord = fmtCoord(spread.lat, spread.lng);
  const btn = { cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)", background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" };
  return (
    <aside style={{ borderLeft: "1px solid var(--pb-line)", padding: "28px 20px" }}>
      <Eyebrow>Stop Tools</Eyebrow>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", margin: "6px 0 18px" }}>Edit Story &amp; Photo</h3>

      <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "14px 15px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>GPS Signal</span>
          <button onClick={locate} style={{ cursor: "pointer", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".06em", border: "1px solid " + (dist != null ? "var(--pb-go)" : "var(--pb-line-strong)"), color: dist != null ? "var(--pb-go)" : "var(--pb-ink-2)", background: dist != null ? "rgba(79,217,138,.08)" : "transparent", borderRadius: 999, padding: "3px 9px" }}>
            {locating ? "locating…" : dist != null ? (dist < 10 ? dist.toFixed(1) : Math.round(dist)) + " mi away" : "Use my location"}
          </button>
        </div>
        <div style={{ fontFamily: mono, fontSize: ".9rem", color: "var(--pb-ink)", marginTop: 8 }}>{coord || "—"}</div>
        <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 2 }}>Recorded {spread.name}</div>
      </div>

      {editing ? (
        <div style={{ marginBottom: 12 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} placeholder="Write the story of this stop…" style={{ width: "100%", background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 12px", color: "var(--pb-ink)", fontFamily: serif, fontSize: ".92rem", lineHeight: 1.5, outline: "none", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveStory} style={{ ...btn, flex: 1, color: "#0a1712", background: GOLD, border: "none" }}>Save story</button>
            <button onClick={() => setEditing(false)} style={{ ...btn, flex: "0 0 auto" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="bs-btn" style={{ ...btn, width: "100%", marginBottom: 10 }} onClick={() => setEditing(true)}>✎ Edit Story Content</button>
      )}
      <button className="bs-btn" style={{ ...btn, width: "100%" }} onClick={() => fileRef.current && fileRef.current.click()}>⤢ Swap Photo</button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      <div style={{ marginTop: 24 }}>
        <Eyebrow>Layout rules</Eyebrow>
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          <li style={{ fontSize: ".76rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>• Chapters sort automatically by your route order.</li>
          <li style={{ fontSize: ".76rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>• Only your own photos are printed — an un-photographed stop becomes a clean typographic page.</li>
        </ul>
      </div>
    </aside>
  );
}

function ThemeDesktop({ book, layout, setLayoutKey, pal, setPal, palette, price, priceNum, pages, setStep, role, setRole, size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey }) {
  const reader = role === "reader";
  return (
    <div style={{ display: "grid", gridTemplateColumns: reader ? "1fr" : "300px 1fr 320px", minHeight: "calc(100vh - 160px)" }}>
      {!reader && (
        <aside style={{ borderRight: "1px solid var(--pb-line)", padding: "28px 20px" }}>
          <Eyebrow>Cover Layouts</Eyebrow>
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.1rem", color: "var(--pb-ink)", margin: "6px 0 16px" }}>Select Silhouette</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LAYOUTS.map((l) => (
              <button key={l.key} className="bs-stopcard" onClick={() => setLayoutKey(l.key)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: l.key === layout.key ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (l.key === layout.key ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "11px 13px" }}>
                <div style={{ fontWeight: 600, fontSize: ".85rem", color: "var(--pb-ink)" }}>{l.name}</div>
                <div style={{ fontSize: ".7rem", color: "var(--pb-muted)", marginTop: 2 }}>{l.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <Eyebrow>Color Palettes</Eyebrow>
            {[["Dark", PALETTES.dark], ["Light", PALETTES.light]].map(([label, list]) => (
              <div key={label} style={{ marginTop: 12 }}>
                <div style={{ fontFamily: mono, fontSize: ".48rem", letterSpacing: ".12em", color: "var(--pb-muted)", marginBottom: 6 }}>{label}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {list.map((p) => (
                    <button key={p.key} onClick={() => setPal(p.key)} title={p.name} aria-label={p.name} style={{ cursor: "pointer", width: 34, height: 34, borderRadius: "50%", background: p.base, border: "2px solid " + (p.key === pal ? "var(--pb-gold)" : "var(--pb-line-strong)") }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <FormatPicker size={size} sizeKey={sizeKey} setSizeKey={setSizeKey} cover={cover} coverKey={coverKey} setCoverKey={setCoverKey} finish={finish} finishKey={finishKey} setFinishKey={setFinishKey} />
          </div>
        </aside>
      )}
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 30px" }}>
        <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" />
      </main>
      {!reader && (
        <aside style={{ borderLeft: "1px solid var(--pb-line)", padding: "28px 20px" }}>
          <Eyebrow>Summary</Eyebrow>
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", margin: "6px 0 18px" }}>Your Edition</h3>
          <SummaryRows rows={[["Size", size.name.replace("·", "").replace(/\s+/g, " ").trim()], ["Cover", cover.name], ["Finish", cover.key === "linen" ? "Matte linen" : finish.name], ["Theme", palette.name], ["Cover art", layout.name]]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--pb-line)", margin: "16px 0", paddingTop: 14 }}>
            <span style={{ fontSize: ".9rem", color: "var(--pb-ink)" }}>Est. total</span>
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.4rem", color: "var(--pb-gold)" }}>{price}.00</span>
          </div>
          {cover.key === "linen" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <span style={{ color: "var(--pb-gold)" }}>✦</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: ".85rem", color: "var(--pb-ink)" }}>Gold Foil Spine</div>
                <div style={{ fontSize: ".72rem", color: "var(--pb-muted)" }}>Debossed on forest linen</div>
              </div>
            </div>
          )}
          <button onClick={() => setStep("preview")} style={{ cursor: "pointer", width: "100%", fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 12, padding: "13px" }}>Preview Book →</button>
        </aside>
      )}
    </div>
  );
}

// Physical print options (size / cover / finish) with guided prices — real Lulu SKUs.
function FormatPicker({ size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey }) {
  const Row = ({ label, items, sel, onPick, priced }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mono, fontSize: ".48rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((it) => (
          <button key={it.key} className="bs-stopcard" onClick={() => onPick(it.key)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: it.key === sel ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (it.key === sel ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: ".82rem", color: "var(--pb-ink)" }}>{it.name}</span>
              {it.guide && <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pb-gold)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "2px 7px" }}>{it.guide}</span>}
              {priced && it.add > 0 && <span style={{ fontFamily: mono, fontSize: ".6rem", color: "var(--pb-gold-soft)" }}>+${it.add}</span>}
            </div>
            {it.note && <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", marginTop: 2 }}>{it.note}</div>}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <>
      <Eyebrow>Format &amp; Finish</Eyebrow>
      <div style={{ height: 10 }} />
      <Row label="Size" items={SIZES} sel={sizeKey} onPick={setSizeKey} />
      <Row label="Cover" items={COVERS} sel={coverKey} onPick={setCoverKey} priced />
      {cover.key !== "linen" && <Row label="Cover finish" items={FINISHES} sel={finishKey} onPick={setFinishKey} />}
      <p style={{ fontSize: ".68rem", color: "var(--pb-muted)", lineHeight: 1.5 }}>All editions are premium full-color on 80# photo paper. Prices are estimates — final total (with shipping) is confirmed at checkout.</p>
    </>
  );
}
const SummaryRows = ({ rows }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {rows.map(([k, v]) => (
      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: ".82rem", color: "var(--pb-ink-2)" }}>{k}</span>
        <span style={{ fontFamily: mono, fontSize: ".76rem", color: "var(--pb-ink)", textAlign: "right" }}>{v}</span>
      </div>
    ))}
  </div>
);

function PreviewDesktop({ book, spreads, sel, setSel, cur, n, prev, next, palette, layout, pages, price, openReserve, role, size, cover, finish }) {
  const reader = role === "reader";
  const toc = [["Cover Layout", "—"], ["Introduction", "01"], ...spreads.map((s, i) => [s.name, String(4 + i * 4).padStart(2, "0")]), ["Final Page Summary", String(pages).padStart(2, "0")]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: reader ? "1fr" : "300px 1fr 320px", minHeight: "calc(100vh - 160px)" }}>
      {!reader && (
        <aside style={{ borderRight: "1px solid var(--pb-line)", padding: "28px 20px" }}>
          <Eyebrow>Book Contents</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {toc.map(([label, pg], i) => {
              const active = i >= 2 && i - 2 === sel;
              return (
                <button key={i} onClick={() => i >= 2 && i - 2 < n && setSel(i - 2)} style={{ textAlign: "left", cursor: i >= 2 ? "pointer" : "default", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: active ? "var(--pb-surface-2)" : "transparent", border: "none" }}>
                  <span style={{ fontSize: ".85rem", color: active ? "var(--pb-ink)" : "var(--pb-ink-2)", fontWeight: active ? 600 : 400 }}>{label}</span>
                  <span style={{ fontFamily: mono, fontSize: ".6rem", color: "var(--pb-muted)" }}>{pg}</span>
                </button>
              );
            })}
          </div>
        </aside>
      )}
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 30px" }}>
        <Spread spread={cur} />
        <Pager i={sel} n={n} onPrev={prev} onNext={next} dots />
      </main>
      {!reader && (
        <aside style={{ borderLeft: "1px solid var(--pb-line)", padding: "28px 20px" }}>
          <Eyebrow>Order Details</Eyebrow>
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", margin: "6px 0 18px" }}>Review &amp; Imprint</h3>
          <SummaryRows rows={[["Size", size.name.replace("·", "").replace(/\s+/g, " ").trim()], ["Cover", cover.name], ["Pages", pages + " Pages"], ["Theme", palette.name], ["Stops Included", n + " Stops"]]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--pb-line)", margin: "16px 0", paddingTop: 14 }}>
            <span style={{ fontSize: ".9rem", color: "var(--pb-ink)" }}>Total Price</span>
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.5rem", color: "var(--pb-gold)" }}>{price}.00</span>
          </div>
          <button onClick={openReserve} style={{ cursor: "pointer", width: "100%", fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 12, padding: "13px" }}>Order Book</button>
          <div style={{ textAlign: "center", fontFamily: mono, fontSize: ".56rem", letterSpacing: ".04em", color: "var(--pb-muted)", marginTop: 10 }}>Secured by Stripe · Lulu Print-on-Demand</div>
          <p style={{ fontSize: ".72rem", color: "var(--pb-muted)", lineHeight: 1.5, marginTop: 14 }}>Only your own photos are printed. Stops without a photo get a beautiful typographic page.</p>
        </aside>
      )}
    </div>
  );
}

/* ---------------- mobile ---------------- */
function MobilePhone(props) {
  const { step, setStep, role, setRole, spreads, sel, setSel, cur, n, prev, next, book, layout, setLayoutKey, pal, setPal, palette, pages, price, openReserve, mobilePage, setMobilePage, toolsOpen, setToolsOpen, openManage, size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey } = props;
  const BAR = 64;
  return (
    <div style={{ paddingBottom: BAR + 10 }}>
      {/* top */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--pb-glass)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--pb-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--pb-gold)" }}>♟</span>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1rem", color: "var(--pb-ink)" }}>Book Studio</span>
        </div>
        <RoleToggle role={role} setRole={setRole} />
      </div>

      <div style={{ padding: "16px" }}>
        {step === "diary" && (
          <>
            {role === "author" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Eyebrow>Your Stops ({n})</Eyebrow>
                  <button onClick={openManage} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".7rem", fontWeight: 600, color: "var(--pb-gold)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "5px 11px" }}>Manage</button>
                </div>
                <div className="bs-reels" style={{ display: "flex", gap: 10, overflowX: "auto", margin: "10px -4px 16px", padding: "0 4px 4px", scrollbarWidth: "none" }}>
                  {spreads.map((s, i) => (
                    <button key={i} onClick={() => setSel(i)} style={{ flex: "0 0 46%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: i === sel ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (i === sel ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "9px 11px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: mono, fontSize: ".46rem", color: "var(--pb-muted)" }}>{"0" + (i + 1)}</span>
                        <span style={{ fontFamily: mono, fontSize: ".46rem", color: s.userImg ? "var(--pb-go)" : "var(--pb-muted)" }}>{s.userImg ? "✓" : "＋"}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--pb-ink)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", background: "var(--pb-tint)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: 3, marginBottom: 14 }}>
                  {[["photo", "Photo Spread"], ["story", "Story Text"]].map(([k, l]) => (
                    <button key={k} onClick={() => setMobilePage(k)} style={{ flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: mobilePage === k ? 700 : 500, border: "none", borderRadius: 8, padding: "8px", background: mobilePage === k ? "var(--pb-surface)" : "transparent", color: mobilePage === k ? "var(--pb-ink)" : "var(--pb-muted)" }}>{l}</button>
                  ))}
                </div>
              </>
            )}
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              {mobilePage === "photo" || role === "reader"
                ? <div style={{ aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: "1px solid var(--pb-line)" }}><SpreadPhoto spread={cur} rounded={false} /></div>
                : <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: 18 }}><SpreadStory spread={cur} /></div>}
            </div>
            {role === "author" && (
              <div style={{ maxWidth: 460, margin: "14px auto 0", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, overflow: "hidden" }}>
                <button onClick={() => setToolsOpen((v) => !v)} style={{ width: "100%", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "none", border: "none" }}>
                  <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Stop Tools · {fmtCoord(cur.lat, cur.lng) || "—"}</span>
                  <span style={{ color: "var(--pb-ink-2)" }}>{toolsOpen ? "▾" : "▸"}</span>
                </button>
                {toolsOpen && <div style={{ padding: "0 14px 14px" }}><MobileStopTools spread={cur} /></div>}
              </div>
            )}
            <Pager i={sel} n={n} label={cur.name} onPrev={prev} onNext={next} />
          </>
        )}

        {step === "theme" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 20px" }}>
              <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" />
            </div>
            <Eyebrow>Cover Layouts</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 18px" }}>
              {LAYOUTS.map((l) => (
                <button key={l.key} onClick={() => setLayoutKey(l.key)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: l.key === layout.key ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (l.key === layout.key ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ fontWeight: 600, fontSize: ".85rem", color: "var(--pb-ink)" }}>{l.name}</div>
                  <div style={{ fontSize: ".7rem", color: "var(--pb-muted)" }}>{l.desc}</div>
                </button>
              ))}
            </div>
            <Eyebrow>Color Palettes</Eyebrow>
            <div style={{ display: "flex", gap: 8, margin: "10px 0 22px", flexWrap: "wrap" }}>
              {[...PALETTES.dark, ...PALETTES.light].map((p) => (
                <button key={p.key} onClick={() => setPal(p.key)} title={p.name} style={{ cursor: "pointer", width: 38, height: 38, borderRadius: "50%", background: p.base, border: "2px solid " + (p.key === pal ? "var(--pb-gold)" : "var(--pb-line-strong)") }} />
              ))}
            </div>
            <FormatPicker size={size} sizeKey={sizeKey} setSizeKey={setSizeKey} cover={cover} coverKey={coverKey} setCoverKey={setCoverKey} finish={finish} finishKey={finishKey} setFinishKey={setFinishKey} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "8px 0 14px" }}>
              <span style={{ fontSize: ".85rem", color: "var(--pb-ink)" }}>Est. total</span>
              <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.3rem", color: "var(--pb-gold)" }}>{price}.00</span>
            </div>
            <button onClick={() => setStep("preview")} style={{ cursor: "pointer", width: "100%", fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 12, padding: "13px" }}>Preview Book →</button>
          </>
        )}

        {step === "preview" && (
          <>
            <div style={{ maxWidth: 460, margin: "0 auto 4px" }}>
              <div style={{ aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: "1px solid var(--pb-line)" }}><SpreadPhoto spread={cur} rounded={false} /></div>
            </div>
            <Pager i={sel} n={n} onPrev={prev} onNext={next} dots />
            <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "16px 16px", marginTop: 18 }}>
              <Eyebrow>Order Details</Eyebrow>
              <div style={{ margin: "12px 0" }}><SummaryRows rows={[["Size", size.name.replace("·", "").replace(/\s+/g, " ").trim()], ["Cover", cover.name], ["Pages", pages + " Pages"], ["Stops", n + " Stops"]]} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--pb-line)", paddingTop: 12 }}>
                <span style={{ fontSize: ".9rem", color: "var(--pb-ink)" }}>Total</span>
                <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.4rem", color: "var(--pb-gold)" }}>{price}.00</span>
              </div>
            </div>
            <button onClick={openReserve} style={{ cursor: "pointer", width: "100%", fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 12, padding: "14px", marginTop: 14 }}>Order Book</button>
          </>
        )}
      </div>

      {/* bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, height: BAR, display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "var(--pb-glass-strong)", borderTop: "1px solid var(--pb-line)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[["diary", "Diary", "📖"], ["theme", "Theme", "✦"], ["preview", "Preview", "▤"], ["order", "Order", "🛍"]].map(([k, label, ic]) => {
          const active = k === "order" ? false : step === k;
          return (
            <button key={k} onClick={() => k === "order" ? openReserve() : setStep(k)} style={{ cursor: "pointer", fontFamily: "inherit", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: active ? "var(--pb-gold)" : "var(--pb-muted)" }}>
              <span style={{ fontSize: "1rem" }}>{ic}</span>
              <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileStopTools({ spread }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(spread.story || "");
  const fileRef = useRef(null);
  useEffect(() => { setDraft(spread.story || ""); setEditing(false); }, [spread.name]);
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const url = await fileToDataUrl(f); addPhoto(spread.name, { url, lat: spread.lat, lng: spread.lng }); } catch {}
    e.target.value = "";
  };
  const btn = { flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-ink)", background: "var(--pb-surface-2)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "10px" };
  return editing ? (
    <div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} style={{ width: "100%", background: "var(--pb-surface-2)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "10px", color: "var(--pb-ink)", fontFamily: serif, fontSize: ".9rem", outline: "none" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => { try { setStory(spread.name, draft); } catch {} setEditing(false); }} style={{ ...btn, color: "#0a1712", background: GOLD, border: "none" }}>Save</button>
        <button onClick={() => setEditing(false)} style={btn}>Cancel</button>
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8 }}>
      <button style={btn} onClick={() => setEditing(true)}>✎ Edit Story</button>
      <button style={btn} onClick={() => fileRef.current && fileRef.current.click()}>⤢ Swap Photo</button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
    </div>
  );
}

/* ---------------- manage stops (add / delete / reorder) ---------------- */
// Operates on the REAL trip (trip.js). Adding a location here creates a real trip
// if there wasn't one (so the Yosemite sample is replaced by the user's own book).
function ManageStops({ onClose }) {
  const [, force] = useState(0);
  useEffect(() => {
    const un = subscribeTrip(() => force((x) => x + 1));
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { un && un(); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const stops = (() => { try { return getStops() || []; } catch { return []; } })();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { setPhoto({ url: await fileToDataUrl(f) }); } catch {}
    e.target.value = "";
  };
  const add = () => {
    const nm = name.trim(); if (!nm) return;
    try { addStop(nm); if (photo) addPhoto(nm, { url: photo.url }); } catch {}
    setName(""); setPhoto(null);
  };

  const iconBtn = { cursor: "pointer", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--pb-line-strong)", background: "var(--pb-surface)", color: "var(--pb-ink)", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
  return (
    <div className="tbres-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tbres-card" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
        <div className="tbres-kicker">Manage stops</div>
        <div className="tbres-title">Your book's pages</div>
        <p className="tbres-note" style={{ marginTop: 4 }}>Reorder, remove, or add a place. Each stop becomes a chapter — add a photo and it prints; leave it and you get a clean typographic page.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
          {stops.length === 0 && <div style={{ fontSize: ".85rem", color: "var(--pb-muted)" }}>No stops yet — add your first place below. (You're viewing the sample book until then.)</div>}
          {stops.map((s, i) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "9px 11px" }}>
              <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".55rem", color: "var(--pb-muted)", width: 18 }}>{"0" + (i + 1)}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: ".88rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <button style={{ ...iconBtn, opacity: i === 0 ? .35 : 1 }} disabled={i === 0} onClick={() => moveStop(s.name, -1)} aria-label="Move up">↑</button>
              <button style={{ ...iconBtn, opacity: i === stops.length - 1 ? .35 : 1 }} disabled={i === stops.length - 1} onClick={() => moveStop(s.name, 1)} aria-label="Move down">↓</button>
              <button style={{ ...iconBtn, color: "var(--pb-hold)" }} onClick={() => removeStop(s.name)} aria-label="Remove">✕</button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 14 }}>
          <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", marginBottom: 8 }}>Add a place</div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input list="pb-park-list" className="tbres-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Park, town, or any place" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...iconBtn, width: "auto", padding: "0 12px", gap: 6 }}>{photo ? "✓ Photo" : "＋ Photo"}</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
          </div>
          <datalist id="pb-park-list">
            {DEMO.stops.map((s) => <option key={s.name} value={s.name} />)}
          </datalist>
          <button onClick={add} disabled={!name.trim()} style={{ cursor: name.trim() ? "pointer" : "not-allowed", width: "100%", marginTop: 10, fontFamily: "inherit", fontWeight: 700, fontSize: ".85rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 10, padding: "11px", opacity: name.trim() ? 1 : .5 }}>Add to book</button>
        </div>

        <div className="tbres-actions" style={{ marginTop: 14 }}>
          <button className="tbres-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- reservation + Stripe/Lulu checkout (unchanged logic) ---------------- */
function ReserveModal({ data, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ship, setShip] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const priceNum = parseFloat(String(data.price).replace(/[^0-9.]/g, "")) || 0;
  const total = priceNum ? "$" + (priceNum * qty).toFixed(0) : data.price;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    if (!agree) { setError("Please confirm you have the rights to the photos in your book."); return; }
    setStatus("sending");
    const headers = { "Content-Type": "application/json" };
    const payload = JSON.stringify({
      email: email.trim(), name, shipping: ship, quantity: qty, note,
      title: data.title, theme: data.theme, size: data.size, price: data.price,
      dates: data.dates, dedication: data.dedication, entries: data.entries,
    });
    let reserved = false;
    try { const r = await fetch("/api/book-order", { method: "POST", headers, body: payload }); const d = await r.json().catch(() => ({})); reserved = r.ok && d.ok; } catch {}
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers, body: payload });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      if (reserved) { setStatus("done"); return; }
      setStatus("idle"); setError(d.error || "Couldn't complete that right now. Please try again.");
    } catch { if (reserved) { setStatus("done"); return; } setStatus("idle"); setError("Network error — please try again."); }
  };

  return (
    <div className="tbres-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tbres-card" role="dialog" aria-modal="true">
        {status === "done" ? (
          <div className="tbres-done">
            <div className="ic">✨</div>
            <h3>You&rsquo;re on the list</h3>
            <p>We&rsquo;ve reserved your edition of &ldquo;{data.title || "your Trip Book"}&rdquo;. We&rsquo;ll email {email} the moment printed books go live — no charge yet.</p>
            <div style={{ marginTop: 18 }}><button className="tbres-btn" onClick={onClose}>Done</button></div>
          </div>
        ) : (
          <>
            <div className="tbres-kicker">Almost there</div>
            <div className="tbres-title">{data.title || "Your Trip Book"}</div>
            <div className="tbres-sum">
              <span>Theme <b>{data.theme}</b></span>
              <span>Size <b>{data.size}</b></span>
              <span>Hardcover <b>{data.price}</b></span>
            </div>
            <div className="tbres-total"><span>Est. total</span><b>{total}</b></div>
            <div className="tbres-field"><label>Your name</label><input className="tbres-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Rivera" /></div>
            <div className="tbres-field"><label>Email *</label><input className="tbres-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" /></div>
            <div className="tbres-row">
              <div className="tbres-field" style={{ flex: "0 0 92px" }}><label>Copies</label><input className="tbres-input" type="number" min="1" max="20" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))} /></div>
              <div className="tbres-field"><label>Ship to (optional)</label><input className="tbres-input" value={ship} onChange={(e) => setShip(e.target.value)} placeholder="City, State" /></div>
            </div>
            <div className="tbres-field"><label>Note (optional)</label><textarea className="tbres-ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you'd like us to know" /></div>
            <p className="tbres-note">Only your own photos are printed — any stop you didn&rsquo;t photograph becomes a clean, designed page (we don&rsquo;t print stock photos in your book).</p>
            <p className="tbres-note">Made to order: misprinted or damaged books are replaced or refunded. Because each is custom-printed, change-of-mind returns aren&rsquo;t possible once printing starts. See our <a href="/terms" target="_blank" rel="noopener" style={{ color: "var(--pb-gold,#c9a35f)", textDecoration: "underline" }}>full terms</a>.</p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "6px 0 2px", cursor: "pointer", fontSize: ".82rem", lineHeight: 1.45 }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, flex: "none", accentColor: "#c9a35f", width: 16, height: 16 }} />
              <span>I own or have the rights to use the photos in this book.</span>
            </label>
            {error && <div className="tbres-err">{error}</div>}
            <div className="tbres-actions">
              <button className="tbres-btn" disabled={status === "sending" || !agree} onClick={submit}>{status === "sending" ? "Working…" : "Checkout"}</button>
              <button className="tbres-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
