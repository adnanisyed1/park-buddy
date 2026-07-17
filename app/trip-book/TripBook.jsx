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
/* ── Predefined themes ───────────────────────────────────────────────────────
   A theme is a PRESET: base + ink + accent, plus the cover silhouette that suits
   it. Picking one should make a good-looking book with zero design work. Every
   ink/base pair here measures ≥11:1 and every accent ≥4.5:1 on its base, checked
   for full-colour print on 80# coated stock (screen contrast flatters — reflective
   ink needs more headroom than the WCAG web minimum). 5 dark / 5 light. */
const PALETTES = {
  dark: [
    { key: "black-pine", name: "Black Pine", base: "#0C1512", ink: "#E9EFE7", accent: "#C9A24A", silhouette: "manuscript", mood: "Misty forest, redwoods, the Pacific Northwest.", desc: "Old-growth dark with a struck-brass title." },
    { key: "canyon-dusk", name: "Canyon Dusk", base: "#2B1410", ink: "#F3E7DB", accent: "#D9743C", silhouette: "split", mood: "Desert reds — Utah, Sedona, the Colorado Plateau.", desc: "Deep red rock at last light." },
    { key: "cobalt-meridian", name: "Cobalt Meridian", base: "#101E38", ink: "#EAF0FA", accent: "#D8B15C", silhouette: "centered", mood: "Night skies, coastlines, big water.", desc: "Royal blue and pale gold — an atlas, not a scrapbook." },
    { key: "ash-ember", name: "Ash & Ember", base: "#1A1B1D", ink: "#EFEEEB", accent: "#C56B3E", silhouette: "editorial", mood: "Lava fields — Lassen, Volcanoes, the Cascades.", desc: "Volcanic charcoal with a copper spark." },
    { key: "alpenglow", name: "Alpenglow", base: "#241830", ink: "#F1E9F2", accent: "#F2A07C", silhouette: "centered", mood: "Alpine dusk — the Tetons, Rainier.", desc: "Twilight violet warmed by peach on the peaks." },
  ],
  light: [
    { key: "cirrus", name: "Cirrus", base: "#F7F8F8", ink: "#22272A", accent: "#3D6DA8", silhouette: "minimal", mood: "Modernist, gift-ready, any park.", desc: "Near-white and quiet — the photographs do the talking." },
    { key: "glacier-milk", name: "Glacier Milk", base: "#E9EFF2", ink: "#172A34", accent: "#1F6F7E", silhouette: "split", mood: "Alpine winter, glaciers, deep lakes.", desc: "Pale meltwater blue with deep lake teal." },
    { key: "lichen-field", name: "Lichen Field", base: "#E7EBE1", ink: "#232E1E", accent: "#8A5A34", silhouette: "manuscript", mood: "Meadows, the Appalachians, spring.", desc: "Soft sage paper, moss ink, bark copper." },
    { key: "sunbleached", name: "Sunbleached", base: "#EBE6DA", ink: "#2A2621", accent: "#2F4A6B", silhouette: "editorial", mood: "Desert, coast, dunes, high summer.", desc: "Sun-faded sand cooled by indigo." },
    { key: "serigraph", name: "Serigraph", base: "#E6E2D6", ink: "#1A2E22", accent: "#AE3A24", silhouette: "editorial", mood: "WPA heritage — Yellowstone, the classics.", desc: "Flat poster inks, straight out of the 1930s park shop." },
  ],
};
const ALL_THEMES = [...PALETTES.dark, ...PALETTES.light];

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
/* ── Page composition ────────────────────────────────────────────────────────
   How each chapter's spread is laid out. A book-wide DEFAULT applies to every
   stop; any stop can override it. Persisted in localStorage `pb_book_layouts`
   ({ default:{mode,count}, stops:{ [name]:{mode,count} } }). Only the traveler's
   OWN photos fill photo slots — empty slots stay as honest "add a photo" tiles
   (they print as a designed typographic page, never stock). */
const MODES = [
  { key: "photo-diary", name: "Photo + diary", desc: "One photo, story facing it." },
  { key: "photo-photo", name: "Photos both pages", desc: "A photo on each page, no story." },
  { key: "grid", name: "Photo grid + diary", desc: "Several photos on one page, story facing." },
  { key: "story", name: "Story only", desc: "A clean typographic page." },
];
const LKEY = "pb_book_layouts";
const DEFAULT_LAYOUT = { mode: "photo-diary", count: 2 };
function readLayouts() { try { return JSON.parse(localStorage.getItem(LKEY) || "{}") || {}; } catch { return {}; } }
function writeLayouts(o) {
  try { localStorage.setItem(LKEY, JSON.stringify(o)); window.dispatchEvent(new Event("pb:booklayout")); } catch {}
}
function getDefaultLayout() { return { ...DEFAULT_LAYOUT, ...(readLayouts().default || {}) }; }
function setDefaultLayout(patch) { const o = readLayouts(); o.default = { ...getDefaultLayout(), ...patch }; writeLayouts(o); }
function getStopLayout(name) { const s = readLayouts().stops || {}; return s[name] || null; }
function setStopLayout(name, patch) {
  const o = readLayouts(); o.stops = o.stops || {};
  o.stops[name] = { ...(o.stops[name] || getDefaultLayout()), ...patch };
  writeLayouts(o);
}
function clearStopLayout(name) { const o = readLayouts(); if (o.stops) delete o.stops[name]; writeLayouts(o); }
// Re-render whenever any layout changes. Returns `ready` — false during SSR and the
// first client render — because these layouts live in localStorage, which the server
// can't see. Reading it during render made the server and client disagree
// ("photo-diary" vs a saved grid) and React threw away the server HTML.
function useLayoutTick() {
  const [, set] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const on = () => set((x) => x + 1);
    window.addEventListener("pb:booklayout", on);
    return () => window.removeEventListener("pb:booklayout", on);
  }, []);
  return ready;
}

/* ── Book-only pages ─────────────────────────────────────────────────────────
   The Studio READS the itinerary (trip.js) — it never writes to it. Chapters
   preloaded from your itinerary are edited in Build a Trip; anything you add HERE
   ("your own stop & photo") lives only in the book, in localStorage
   `pb_book_extras`, so making a book never mutates your trip. */
const XKEY = "pb_book_extras";
function readExtras() { try { return JSON.parse(localStorage.getItem(XKEY) || "[]") || []; } catch { return []; } }
function writeExtras(a) { try { localStorage.setItem(XKEY, JSON.stringify(a)); window.dispatchEvent(new Event("pb:bookextras")); } catch {} }
function addExtra({ name, story = "", photos = [] }) {
  const a = readExtras();
  a.push({ id: "x" + Date.now().toString(36), name, story, photos });
  writeExtras(a);
}
function removeExtra(id) { writeExtras(readExtras().filter((e) => e.id !== id)); }
function updateExtra(id, patch) { writeExtras(readExtras().map((e) => (e.id === id ? { ...e, ...patch } : e))); }
function moveExtra(id, dir) {
  const a = readExtras();
  const i = a.findIndex((e) => e.id === id), j = i + dir;
  if (i === -1 || j < 0 || j >= a.length) return;
  const [it] = a.splice(i, 1); a.splice(j, 0, it); writeExtras(a);
}

const isHex = (s) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test((s || "").trim());
const normHex = (s) => { let h = (s || "").trim(); if (!h.startsWith("#")) h = "#" + h; return h.length === 4 ? "#" + h.slice(1).split("").map((c) => c + c).join("") : h.toLowerCase(); };
function lum(hex) {
  try {
    const n = normHex(hex).slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  } catch { return 0; }
}
const contrast = (a, b) => { const L1 = lum(a), L2 = lum(b); const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]; return (hi + 0.05) / (lo + 0.05); };
const INK_DARK = "#1A1F1C", INK_LIGHT = "#F2F1EC";
// We choose the ink, never the customer — ink choice is where amateur books die.
function inkFor(hex) { return lum(hex) > 0.35 ? INK_DARK : INK_LIGHT; }
// Print needs more headroom than the web minimum: reflective ink + dot gain eat
// apparent contrast, so we hold a 7:1 floor. Mid-tone bases fail against BOTH inks
// — that's the trap, and we block it rather than let someone order a fuzzy book.
function customCheck(hex) {
  if (!isHex(hex)) return { ok: false, reason: "Enter a hex code like #2A4A38." };
  const h = normHex(hex);
  const cd = contrast(h, INK_DARK), cl = contrast(h, INK_LIGHT);
  const best = cd >= cl ? { ink: INK_DARK, ratio: cd } : { ink: INK_LIGHT, ratio: cl };
  if (best.ratio < 7) return { ok: false, ...best, reason: "This shade sits in the middle — text won't print crisply on it. Try going deeper or lighter." };
  return { ok: true, ...best };
}

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
    const c = () => setTick((t) => t + 1);
    window.addEventListener("pb:bookextras", c);
    return () => { a && a(); b && b(); window.removeEventListener("pb:bookextras", c); };
  }, []);

  let stops = [], meta = {};
  try { stops = getStops() || []; } catch {}
  try { meta = getMeta() || {}; } catch {}
  const stories = (() => { try { return getStory() || {}; } catch { return {}; } })();
  const extras = readExtras();

  // Your own book-only pages, appended after the itinerary chapters.
  const extraSpreads = extras.map((e, i) => ({
    name: e.name, park: "Your own page", q: [e.name],
    userImg: (e.photos || [])[0] || null, photos: e.photos || [],
    story: e.story || "", date: "", lat: null, lng: null,
    chapter: stops.length + i + 1, source: "own", id: e.id,
  }));

  const hasTrip = stops.length > 0 || extras.length > 0;
  if (!hasTrip) {
    const spreads = DEMO.stops.map((s, i) => ({
      name: s.name, park: s.park, q: s.q, userImg: null, photos: [], story: s.story,
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
      photos: photos.map((p) => p.url).filter(Boolean),
      story: stories[s.name] || "",
      date: p0 && p0.ts ? fmtDate(p0.ts) : "",
      lat: s.lat != null ? s.lat : (p0 ? p0.lat : null),
      lng: s.lng != null ? s.lng : (p0 ? p0.lng : null),
      chapter: i + 1,
      source: "itinerary",
    };
  });
  const states = [...new Set(stops.map((s) => s.state).filter(Boolean))];
  return {
    isDemo: false, tick,
    title: meta.tripName || "Your Trip Book",
    author: "",
    region: states.length ? states.join(" · ") : "A Park Buddy Trip",
    spreads: [...spreads, ...extraSpreads],
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
const PhotoSlot = ({ url }) => (
  <div style={{ position: "relative", overflow: "hidden", borderRadius: 4, background: "#0c1c12" }}>
    <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);
// An un-filled slot stays honest: it prints as a designed page, never stock art.
const EmptySlot = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "1px dashed var(--pb-line-strong)", color: "var(--pb-muted)", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".08em", textAlign: "center", padding: 8 }}>＋ Add a photo</div>
);
function PhotoGrid({ photos, count }) {
  const cells = Array.from({ length: count }, (_, i) => (photos || [])[i] || null);
  const cols = count === 4 ? 2 : 1;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 6, width: "100%", height: "100%" }}>
      {cells.map((u, i) => (u ? <PhotoSlot key={i} url={u} /> : <EmptySlot key={i} />))}
    </div>
  );
}

// The open-book spread. Its composition comes from the stop's own layout, else the
// book default (see MODES / pb_book_layouts).
// Real page numbers — chapter n occupies pages 4+(n-1)*4 and the facing page.
const pagesOf = (spread) => { const l = 4 + ((spread.chapter || 1) - 1) * 4; return [l, l + 1]; };
const PageNums = ({ spread, single }) => {
  const [l, r] = pagesOf(spread);
  const pad = (x) => String(x).padStart(2, "0");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".14em", color: "var(--pb-muted)", padding: "8px 4px 0", gridColumn: "1 / -1" }}>
      <span>{pad(l)}</span>{!single && <span>{pad(r)}</span>}
    </div>
  );
};

function Spread({ spread }) {
  const ready = useLayoutTick();
  const lay = ready ? (getStopLayout(spread.name) || getDefaultLayout()) : DEFAULT_LAYOUT;
  const mode = lay.mode || "photo-diary";
  const count = Math.max(2, Math.min(4, lay.count || 2));
  const photos = spread.photos || [];
  const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, boxShadow: "var(--pb-shadow)", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", maxWidth: 720, width: "100%" };

  if (mode === "story") {
    return <div style={{ ...card, gridTemplateColumns: "1fr", maxWidth: 460 }}><SpreadStory spread={spread} /><PageNums spread={spread} single /></div>;
  }
  if (mode === "photo-photo") {
    return (
      <div style={card}>
        <div style={{ aspectRatio: "3/4" }}><SpreadPhoto spread={spread} /></div>
        <div style={{ aspectRatio: "3/4" }}>{photos[1] ? <PhotoSlot url={photos[1]} /> : <EmptySlot />}</div>
        <PageNums spread={spread} />
      </div>
    );
  }
  if (mode === "grid") {
    return (
      <div style={card}>
        <div style={{ aspectRatio: "3/4" }}><PhotoGrid photos={photos} count={count} /></div>
        <SpreadStory spread={spread} />
        <PageNums spread={spread} />
      </div>
    );
  }
  return (
    <div style={card}>
      <div style={{ aspectRatio: "3/4" }}><SpreadPhoto spread={spread} /></div>
      <SpreadStory spread={spread} />
      <PageNums spread={spread} />
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
// Each layout renders a visibly distinct silhouette so the choice is meaningful.
function CoverPreview({ title, author, region, layout, palette, dateLabel, coverImg, cover, finish, size }) {
  const isLinen = cover && cover.key === "linen";
  const isGloss = !isLinen && finish && finish.key === "gloss";
  // Linen editions are a woven forest cloth with gold-foil type — show that, don't
  // just describe it, so the buyer sees the material they picked.
  const base = isLinen ? "#1b2a20" : palette.base;
  const ink = isLinen ? "#e8cf9a" : palette.ink;
  const gold = "rgba(217,183,121,.9)";
  const goldLine = "rgba(217,183,121,.45)";
  const photo = <div style={{ position: "absolute", inset: 0, background: coverImg ? `center/cover url(${coverImg})` : "linear-gradient(160deg,#2a4a38,#12241a)" }} />;
  const vol = <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".3em", textTransform: "uppercase", color: gold }}>Vol. I</div>;
  const byline = author ? <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".14em", textTransform: "uppercase", color: ink, opacity: .85 }}>{author}</div> : null;
  const sub = region ? <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".85rem", opacity: .75, color: ink }}>A journey through {region}</div> : null;
  const seal = <div aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(217,183,121,.6)", display: "flex", alignItems: "center", justifyContent: "center", color: gold, fontSize: ".7rem" }}>✦</div>;

  let inner;
  const k = layout.key;
  if (k === "split") {
    inner = (
      <>
        <div style={{ flex: "0 0 48%", position: "relative", margin: 20, marginBottom: 0, overflow: "hidden", borderRadius: 2 }}>{photo}</div>
        <div style={{ textAlign: "center", padding: "16px 24px 24px" }}>
          {vol}
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", lineHeight: 1.1, margin: "8px 0 6px", color: ink }}>{title}</h3>
          {sub}<div style={{ marginTop: 12 }}>{byline}</div>
        </div>
      </>
    );
  } else if (k === "minimal") {
    inner = (
      <div style={{ position: "absolute", inset: 0, padding: 30, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>{vol}{seal}</div>
        <div>
          <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: "1.35rem", lineHeight: 1.15, margin: "0 0 6px", color: ink }}>{title}</h3>
          {byline}
        </div>
      </div>
    );
  } else if (k === "editorial") {
    inner = (
      <div style={{ position: "absolute", inset: 0, padding: 26, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {vol}
        <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: "2.6rem", lineHeight: 0.98, margin: "10px 0 12px", color: ink, letterSpacing: "-.01em" }}>{title}</h3>
        <div style={{ height: 2, width: 46, background: gold, marginBottom: 12 }} />
        {sub}<div style={{ marginTop: "auto" }}>{byline}</div>
      </div>
    );
  } else if (k === "manuscript") {
    inner = (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 34 }}>
        <div aria-hidden style={{ position: "absolute", inset: 24, border: "1px solid " + goldLine }} />
        <div>
          {seal}
          <div style={{ height: 1, width: 90, background: goldLine, margin: "16px auto" }} />
          <h3 style={{ fontFamily: serif, fontWeight: 600, fontStyle: "italic", fontSize: "1.5rem", lineHeight: 1.15, margin: 0, color: ink }}>{title}</h3>
          <div style={{ height: 1, width: 90, background: goldLine, margin: "16px auto" }} />
          {byline}
        </div>
      </div>
    );
  } else { // centered (default)
    inner = (
      <div style={{ margin: "auto", textAlign: "center", padding: "0 28px" }}>
        {vol}
        <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", lineHeight: 1.1, margin: "12px 0 0", color: ink }}>{title}</h3>
        {sub && <div style={{ marginTop: 8 }}>{sub}</div>}
        <div style={{ margin: "22px auto", display: "flex", justifyContent: "center" }}>{seal}</div>
        {byline}
        {dateLabel && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".75rem", opacity: .6, marginTop: 6, color: ink }}>{dateLabel}</div>}
      </div>
    );
  }

  const framed = k === "centered" || k === "split";
  // Woven linen texture (fine warp/weft) so the linen edition looks like cloth.
  const linenTexture = "repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0 1px, transparent 1px 3px)";
  const bg = isLinen ? `${linenTexture}, ${base}` : base;
  const ratio = size && size.key === "landscape" ? "22/17" : "17/22";
  const label = [cover ? cover.name : null, isLinen ? "Matte linen" : finish ? finish.name : null, size ? size.name.replace("·", "").replace(/\s+/g, " ").trim() : null].filter(Boolean).join(" · ");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: "100%" }}>
      <div style={{ width: ratio === "22/17" ? 420 : 340, maxWidth: "86%", aspectRatio: ratio, background: bg, color: ink, border: "1px solid " + (isLinen ? "rgba(217,183,121,.3)" : "var(--pb-line)"), boxShadow: isLinen ? "0 40px 90px -50px rgba(0,0,0,.9), inset 0 0 60px rgba(0,0,0,.35)" : "0 40px 90px -50px rgba(0,0,0,.8)", borderRadius: 4, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {framed && <div aria-hidden style={{ position: "absolute", inset: 16, border: "1px solid " + goldLine, borderRadius: 2, pointerEvents: "none" }} />}
        {inner}
        {/* gold-foil spine hint on linen editions */}
        {isLinen && <div aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 9, background: "linear-gradient(90deg,rgba(217,183,121,.55),rgba(217,183,121,.08))", pointerEvents: "none" }} />}
        {/* gloss sheen */}
        {isGloss && <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.04) 30%, transparent 55%)", pointerEvents: "none" }} />}
      </div>
      {label && <div style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)", textAlign: "center" }}>{label}</div>}
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
  const [pal, setPal] = useState("black-pine");
  const [isPhone, setIsPhone] = useState(false);
  const [reserve, setReserve] = useState(null);
  const [mobilePage, setMobilePage] = useState("photo"); // photo | story
  const [toolsOpen, setToolsOpen] = useState(true);
  const [customBase, setCustomBase] = useState("#0c1512");
  // The whole studio is composed from localStorage (trip, photos, extras, layouts),
  // which the server can't read — so we render nothing until mounted rather than
  // emit server HTML that the client immediately contradicts.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
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
  const custom = customCheck(customBase);
  const palette = pal === "custom"
    ? { key: "custom", name: "Custom " + normHex(customBase).toUpperCase(), base: normHex(customBase), ink: custom.ink || INK_LIGHT, accent: "#C9A24A" }
    : (ALL_THEMES.find((p) => p.key === pal) || PALETTES.dark[0]);
  const isLightPal = pal === "custom" ? lum(customBase) > 0.35 : PALETTES.light.some((p) => p.key === pal);
  // A theme is a preset — picking one also sets the cover silhouette it was designed for.
  const pickTheme = (key) => {
    setPal(key);
    const t = ALL_THEMES.find((p) => p.key === key);
    if (t && t.silhouette) setLayoutKey(t.silhouette);
  };
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

  const fmtProps = { size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, priceNum, customBase, setCustomBase, pickTheme };
  const commonProps = { book, spreads, sel, setSel, cur, n, prev, next, role, openManage: () => setManageOpen(true) };

  if (!mounted) {
    return (
      <>
        <SiteHeader acctSlot hideTabBar />
        <div className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", paddingTop: 90 }} />
      </>
    );
  }

  return (
    <>
      {/* The MAIN Park Buddy banner stays — same header as the landing/rest of the
          platform. The studio's own bar sits below it as a page toolbar (and supplies
          the phone's bottom bar, so hideTabBar avoids two bottom bars). */}
      <SiteHeader acctSlot hideTabBar />
      <div className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: sans, paddingTop: 90 }}>
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
    <div style={{ position: "sticky", top: 90, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", height: 60, borderBottom: "1px solid var(--pb-line)", background: "var(--pb-glass)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)" }}>
      {/* No logo here — the main Park Buddy banner above owns the brand. This is a
          page toolbar, not a second banner. */}
      <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "var(--pb-ink)" }}>Book Studio</span>
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

function DiaryDesktop({ spreads, sel, setSel, cur, n, prev, next, role, book, openManage, setStep }) {
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
      {author && <StopTools spread={cur} onNext={() => setStep("theme")} />}
    </div>
  );
}

// Page-composition picker — used for the book DEFAULT (Theme step) and to override
// a single chapter (Stop Tools).
function LayoutPicker({ value, onChange, onReset, isOverride }) {
  const mode = value.mode || "photo-diary";
  const count = Math.max(2, Math.min(4, value.count || 2));
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {MODES.map((m) => (
          <button key={m.key} className="bs-stopcard" onClick={() => onChange({ mode: m.key })} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: m.key === mode ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (m.key === mode ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontWeight: 600, fontSize: ".82rem", color: "var(--pb-ink)" }}>{m.name}</div>
            <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>
      {mode === "grid" && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: mono, fontSize: ".48rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginBottom: 6 }}>Photos on that page</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[2, 3, 4].map((c) => (
              <button key={c} onClick={() => onChange({ count: c })} style={{ flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem", fontWeight: c === count ? 700 : 500, border: "1px solid " + (c === count ? "var(--pb-gold-2)" : "var(--pb-line)"), background: c === count ? "var(--pb-surface-2)" : "var(--pb-surface)", color: "var(--pb-ink)", borderRadius: 8, padding: "7px" }}>{c}</button>
            ))}
          </div>
        </div>
      )}
      {onReset && (
        <button onClick={onReset} disabled={!isOverride} style={{ cursor: isOverride ? "pointer" : "default", width: "100%", marginTop: 10, fontFamily: "inherit", fontSize: ".72rem", color: isOverride ? "var(--pb-gold)" : "var(--pb-muted)", background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 8, padding: "7px", opacity: isOverride ? 1 : .55 }}>
          {isOverride ? "↺ Use book default" : "Using book default"}
        </button>
      )}
    </>
  );
}

function StopTools({ spread, onNext }) {
  useLayoutTick();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(spread.story || "");
  const [dist, setDist] = useState(null);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { setDraft(spread.story || ""); setEditing(false); }, [spread.name]);

  const saveStory = () => { try { setStory(spread.name, draft); } catch {} setEditing(false); };
  // Multiple at once — a grid spread needs 2-4 photos on one page.
  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      try { const url = await fileToDataUrl(f); addPhoto(spread.name, { url, lat: spread.lat, lng: spread.lng }); } catch {}
    }
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
      <button className="bs-btn" style={{ ...btn, width: "100%" }} onClick={() => fileRef.current && fileRef.current.click()}>＋ Add / swap photo</button>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} style={{ display: "none" }} />
      <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".06em", color: "var(--pb-muted)", marginTop: 6, textAlign: "center" }}>
        {(spread.photos || []).length} photo{(spread.photos || []).length === 1 ? "" : "s"} on this chapter
      </div>

      {/* Per-chapter page composition — overrides the book default. */}
      <div style={{ marginTop: 22 }}>
        <Eyebrow>This chapter&rsquo;s pages</Eyebrow>
        <div style={{ height: 10 }} />
        <LayoutPicker
          value={getStopLayout(spread.name) || getDefaultLayout()}
          onChange={(p) => setStopLayout(spread.name, p)}
          onReset={() => clearStopLayout(spread.name)}
          isOverride={!!getStopLayout(spread.name)}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <Eyebrow>Layout rules</Eyebrow>
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          <li style={{ fontSize: ".76rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>• Chapters sort automatically by your route order.</li>
          <li style={{ fontSize: ".76rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>• Only your own photos are printed — an un-photographed stop becomes a clean typographic page.</li>
        </ul>
      </div>

      {onNext && (
        <button onClick={onNext} style={{ cursor: "pointer", width: "100%", marginTop: 24, fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 12, padding: "13px" }}>Next: Theme →</button>
      )}
    </aside>
  );
}

function ThemeDesktop({ book, spreads, layout, setLayoutKey, pal, setPal, palette, price, priceNum, pages, setStep, role, setRole, size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, customBase, setCustomBase, pickTheme }) {
  useLayoutTick();
  const reader = role === "reader";
  const coverImg = ((spreads || []).find((s) => s.userImg) || {}).userImg || null;
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
            <ThemeCards pal={pal} pickTheme={pickTheme} />
            <CustomColor pal={pal} setPal={setPal} customBase={customBase} setCustomBase={setCustomBase} />
          </div>
          <div style={{ marginTop: 24 }}>
            <FormatPicker size={size} sizeKey={sizeKey} setSizeKey={setSizeKey} cover={cover} coverKey={coverKey} setCoverKey={setCoverKey} finish={finish} finishKey={finishKey} setFinishKey={setFinishKey} />
          </div>
          {/* Book-wide page composition; any chapter can override it in Stop Tools. */}
          <div style={{ marginTop: 24 }}>
            <Eyebrow>Default page layout</Eyebrow>
            <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", margin: "6px 0 10px" }}>Applies to every chapter — override any one in Diary → Stop Tools.</div>
            <LayoutPicker value={getDefaultLayout()} onChange={(p) => setDefaultLayout(p)} />
          </div>
        </aside>
      )}
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 30px" }}>
        <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" coverImg={coverImg} cover={cover} finish={finish} size={size} />
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

// Predefined themes — the "pick one and it looks good" path. Each card previews its
// real base/ink/accent and says when to use it; choosing one also sets the cover
// silhouette it was designed for.
function ThemeCards({ pal, pickTheme }) {
  return (
    <>
      <Eyebrow>Themes</Eyebrow>
      <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", margin: "6px 0 10px" }}>Curated for print — pick one and your book is designed.</div>
      {[["Dark", PALETTES.dark], ["Light", PALETTES.light]].map(([label, list]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginBottom: 6 }}>{label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.map((t) => {
              const on = t.key === pal;
              return (
                <button key={t.key} className="bs-stopcard" onClick={() => pickTheme(t.key)} title={t.mood}
                  style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, background: on ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (on ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "8px 10px" }}>
                  {/* real colours, square chips — no shrink, so no ovals */}
                  <span aria-hidden style={{ display: "flex", flex: "0 0 auto", borderRadius: 5, overflow: "hidden", border: "1px solid var(--pb-line-strong)" }}>
                    {[t.base, t.ink, t.accent].map((c, i) => <span key={i} style={{ width: 12, height: 26, background: c, display: "block" }} />)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: ".82rem", color: "var(--pb-ink)" }}>{t.name}</span>
                    <span style={{ display: "block", fontSize: ".66rem", color: "var(--pb-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// Any colour the customer wants — swatch + hex field. Ink is auto-chosen for
// legible print, so a custom colour can't produce an unreadable book.
function CustomColor({ pal, setPal, customBase, setCustomBase }) {
  const [txt, setTxt] = useState(customBase);
  useEffect(() => { setTxt(customBase); }, [customBase]);
  const active = pal === "custom";
  const chk = customCheck(txt);
  const apply = (v) => {
    setTxt(v);
    // Only commit a colour that will actually print legibly.
    if (customCheck(v).ok) { setCustomBase(normHex(v)); setPal("custom"); }
  };
  return (
    <div style={{ marginTop: 16 }}>
      <Eyebrow>Custom colour</Eyebrow>
      <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", margin: "6px 0 8px" }}>Any colour you like — type a hex code or pick one.</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={isHex(customBase) ? normHex(customBase) : "#0c1512"} onChange={(e) => apply(e.target.value)} aria-label="Pick any colour"
          style={{ flex: "0 0 38px", width: 38, height: 38, padding: 0, border: "2px solid " + (active ? "var(--pb-gold)" : "var(--pb-line-strong)"), borderRadius: 8, background: "none", cursor: "pointer" }} />
        <input value={txt} onChange={(e) => apply(e.target.value)} placeholder="#0C1512" spellCheck={false} aria-label="Hex colour code"
          style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: ".8rem", textTransform: "uppercase", background: "var(--pb-surface)", border: "1px solid " + (!chk.ok ? "var(--pb-hold)" : active ? "var(--pb-gold-2)" : "var(--pb-line-strong)"), borderRadius: 8, padding: "9px 10px", color: "var(--pb-ink)", outline: "none" }} />
      </div>
      {!chk.ok && <div style={{ fontSize: ".66rem", color: "var(--pb-hold)", marginTop: 6, lineHeight: 1.45 }}>{chk.reason}</div>}
      {chk.ok && active && (
        <div style={{ fontSize: ".66rem", color: "var(--pb-muted)", marginTop: 6, lineHeight: 1.45 }}>
          Type set to {chk.ink === INK_LIGHT ? "light" : "dark"} automatically ({chk.ratio.toFixed(1)}:1) so it stays crisp in print.
        </div>
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

// A book "page" for the Preview flip-through: cover, intro, a stop spread, or the close.
function BookPage({ pv, n, spreads, book, palette, layout, coverImg, cover, finish, size }) {
  if (pv === 0) return <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} coverImg={coverImg} cover={cover} finish={finish} size={size} />;
  if (pv === 1) return (
    <div style={{ width: 460, maxWidth: "100%", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, boxShadow: "var(--pb-shadow)", padding: "48px 40px", textAlign: "center" }}>
      <Eyebrow>Introduction</Eyebrow>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.9rem", color: "var(--pb-ink)", margin: "14px 0 0" }}>{book.title}</h3>
      {book.region && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: "1rem", color: "var(--pb-ink-2)", marginTop: 8 }}>A journey through {book.region}</div>}
      <div style={{ width: 44, height: 1, background: "var(--pb-line-strong)", margin: "22px auto" }} />
      <p style={{ fontFamily: serif, fontSize: ".98rem", lineHeight: 1.7, color: "var(--pb-ink-2)", maxWidth: 340, margin: "0 auto" }}>{n} chapters, gathered from the road — the places we stood, the light we caught, and the stories worth keeping.</p>
    </div>
  );
  if (pv >= 2 && pv - 2 < n) return <Spread spread={spreads[pv - 2]} />;
  return (
    <div style={{ width: 460, maxWidth: "100%", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, boxShadow: "var(--pb-shadow)", padding: "56px 40px", textAlign: "center" }}>
      <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: "1.5rem", color: "var(--pb-ink)" }}>Adventure&rsquo;s better with a Buddy.</div>
      <div style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", color: "var(--pb-gold)", display: "flex", alignItems: "center", justifyContent: "center", margin: "22px auto 0" }}>✦</div>
      <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 22 }}>The Park Buddy · parkbuddy.app</div>
    </div>
  );
}

function PreviewDesktop({ book, spreads, sel, setSel, cur, n, prev, next, palette, layout, pages, price, openReserve, role, size, cover, finish }) {
  const reader = role === "reader";
  const [pv, setPv] = useState(0); // 0 cover · 1 intro · 2..n+1 stops · n+2 final
  const total = n + 3;
  const coverImg = (spreads.find((s) => s.userImg) || {}).userImg || null;
  const toc = [["Cover", "—"], ["Introduction", "01"], ...spreads.map((s, i) => [s.name, String(4 + i * 4).padStart(2, "0")]), ["Final Page", String(pages).padStart(2, "0")]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: reader ? "1fr" : "300px 1fr 320px", minHeight: "calc(100vh - 160px)" }}>
      {!reader && (
        <aside style={{ borderRight: "1px solid var(--pb-line)", padding: "28px 20px" }}>
          <Eyebrow>Book Contents</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {toc.map(([label, pg], i) => {
              const active = i === pv;
              return (
                <button key={i} onClick={() => setPv(i)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: active ? "var(--pb-surface-2)" : "transparent", border: "none" }}>
                  <span style={{ fontSize: ".85rem", color: active ? "var(--pb-ink)" : "var(--pb-ink-2)", fontWeight: active ? 600 : 400 }}>{label}</span>
                  <span style={{ fontFamily: mono, fontSize: ".6rem", color: "var(--pb-muted)" }}>{pg}</span>
                </button>
              );
            })}
          </div>
        </aside>
      )}
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 30px" }}>
        <BookPage pv={pv} n={n} spreads={spreads} book={book} palette={palette} layout={layout} coverImg={coverImg} cover={cover} finish={finish} size={size} />
        <Pager i={pv} n={total} onPrev={() => setPv((p) => (p - 1 + total) % total)} onNext={() => setPv((p) => (p + 1) % total)} dots />
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
  const { step, setStep, role, setRole, spreads, sel, setSel, cur, n, prev, next, book, layout, setLayoutKey, pal, setPal, palette, pages, price, openReserve, mobilePage, setMobilePage, toolsOpen, setToolsOpen, openManage, size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, customBase, setCustomBase, pickTheme } = props;
  const BAR = 64;
  return (
    <div style={{ paddingBottom: BAR + 10 }}>
      {/* top */}
      {/* Sits below the main Park Buddy banner (fixed, ~90px) — a page toolbar. */}
      <div style={{ position: "sticky", top: 90, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--pb-glass)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--pb-line)" }}>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1rem", color: "var(--pb-ink)" }}>Book Studio</span>
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
              <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" coverImg={(spreads.find((s) => s.userImg) || {}).userImg || null} cover={cover} finish={finish} size={size} />
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
            <ThemeCards pal={pal} pickTheme={pickTheme} />
            <CustomColor pal={pal} setPal={setPal} customBase={customBase} setCustomBase={setCustomBase} />
            <div style={{ height: 22 }} />
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
// TWO sources, kept separate on purpose:
//   1. Preloaded from your itinerary — READ-ONLY here. The itinerary is the source
//      of truth and is edited in Build a Trip; the book follows it automatically.
//   2. Your own pages — book-only extras that never touch the itinerary.
function ManageStops({ onClose }) {
  const [, force] = useState(0);
  useEffect(() => {
    const un = subscribeTrip(() => force((x) => x + 1));
    const onX = () => force((x) => x + 1);
    window.addEventListener("pb:bookextras", onX);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { un && un(); window.removeEventListener("pb:bookextras", onX); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const stops = (() => { try { return getStops() || []; } catch { return []; } })();
  const extras = readExtras();
  const [name, setName] = useState("");
  const [pending, setPending] = useState([]);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    const urls = [];
    for (const f of files) { try { urls.push(await fileToDataUrl(f)); } catch {} }
    setPending((p) => [...p, ...urls]);
    e.target.value = "";
  };
  const add = () => {
    const nm = name.trim(); if (!nm) return;
    addExtra({ name: nm, photos: pending });
    setName(""); setPending([]);
  };

  const iconBtn = { cursor: "pointer", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--pb-line-strong)", background: "var(--pb-surface)", color: "var(--pb-ink)", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
  const secLabel = { fontFamily: "var(--pb-mono)", fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", marginBottom: 8 };

  return (
    <div className="tbres-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tbres-card" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
        <div className="tbres-kicker">Manage pages</div>
        <div className="tbres-title">What&rsquo;s in your book</div>

        {/* 1 — from the itinerary (read-only) */}
        <div style={{ marginTop: 16 }}>
          <div style={secLabel}>Preloaded from your itinerary ({stops.length})</div>
          <p className="tbres-note" style={{ margin: "0 0 8px" }}>These follow your trip automatically — add, remove or reorder them in your itinerary and the book updates itself.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stops.length === 0 && <div style={{ fontSize: ".82rem", color: "var(--pb-muted)" }}>No itinerary yet — build one and its stops become chapters here.</div>}
            {stops.map((s, i) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "8px 11px" }}>
                <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".55rem", color: "var(--pb-muted)", width: 18 }}>{"0" + (i + 1)}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: ".86rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".46rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Itinerary</span>
              </div>
            ))}
          </div>
          <Link href="/build-trip" style={{ display: "inline-block", marginTop: 10, fontFamily: "inherit", fontWeight: 700, fontSize: ".8rem", color: "var(--pb-gold)", textDecoration: "none" }}>Edit your itinerary →</Link>
        </div>

        {/* 2 — your own book-only pages */}
        <div style={{ borderTop: "1px solid var(--pb-line)", marginTop: 18, paddingTop: 16 }}>
          <div style={secLabel}>Add your own stop &amp; photo ({extras.length})</div>
          <p className="tbres-note" style={{ margin: "0 0 8px" }}>Anything you want in the book that isn&rsquo;t a trip stop — a roadside diner, a campsite, a person. These live only in the book; your itinerary is untouched.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {extras.map((e, i) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "8px 11px" }}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: ".86rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".46rem", color: "var(--pb-muted)" }}>{(e.photos || []).length} photo{(e.photos || []).length === 1 ? "" : "s"}</span>
                <button style={{ ...iconBtn, opacity: i === 0 ? .35 : 1 }} disabled={i === 0} onClick={() => moveExtra(e.id, -1)} aria-label="Move up">↑</button>
                <button style={{ ...iconBtn, opacity: i === extras.length - 1 ? .35 : 1 }} disabled={i === extras.length - 1} onClick={() => moveExtra(e.id, 1)} aria-label="Move down">↓</button>
                <button style={{ ...iconBtn, color: "var(--pb-hold)" }} onClick={() => removeExtra(e.id)} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input className="tbres-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this page — e.g. “Moab diner”" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...iconBtn, width: "auto", padding: "0 12px" }}>{pending.length ? `✓ ${pending.length}` : "＋ Photos"}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} style={{ display: "none" }} />
          </div>
          <button onClick={add} disabled={!name.trim()} style={{ cursor: name.trim() ? "pointer" : "not-allowed", width: "100%", marginTop: 10, fontFamily: "inherit", fontWeight: 700, fontSize: ".85rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 10, padding: "11px", opacity: name.trim() ? 1 : .5 }}>Add page to book</button>
        </div>

        <div className="tbres-actions" style={{ marginTop: 16 }}>
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
