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
  getPhotosFor, getStory, setStory, addPhoto, removePhoto, movePhoto,
  distMiles, addCrumb, subscribeTripMode,
} from "../lib/tripmode";
// Book photos take the PRINT path, not Trip Mode's 1280px snapshot path — see
// lib/bookPhoto.js for why that distinction matters.
import { uploadBookPhoto, slotInches, resVerdict } from "../lib/bookPhoto";

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
/* Cover silhouettes. `photo` says whether this cover uses your cover photo at all —
   the picker greys the photo chooser out on a type-only cover rather than letting
   you pick a photo that never prints. */
const LAYOUTS = [
  { key: "split", name: "Photo on top, title below", desc: "Your photo fills the top half.", photo: "half" },
  { key: "full", name: "Photo across the whole cover", desc: "Full-bleed photo, title over it.", photo: "full" },
  { key: "centered", name: "Title only, centered", desc: "No photo — gold type and a seal.", photo: "none" },
  { key: "editorial", name: "Title only, big headline", desc: "No photo — the title spans the cover.", photo: "none" },
  { key: "minimal", name: "Title only, corner type", desc: "No photo — small type, low and quiet.", photo: "none" },
  { key: "manuscript", name: "Title only, bookplate", desc: "No photo — a botanical imprint frame.", photo: "none" },
];
const layoutFor = (key) => LAYOUTS.find((l) => l.key === key) || LAYOUTS[0];
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
/* A chapter is a two-page SPREAD. Each page (pane) is divided into 1–4 SECTIONS —
   the most the paper sensibly splits into — and every section is independently a
   PHOTO or a STORY block. Sections are freely mixed and interchangeable: that's the
   whole model. Photo and story stay separate cells (no text over a photo). A story
   section carries its own text, capped to fit the space it's given.
     layout = { left: [section…], right: [section…] }
     section = { type: "photo" } | { type: "story", text?: string } */
const MAX_SECTIONS = 4;
const PRESETS = [
  { key: "photo-story", name: "Photo + story", hint: "A photo facing what you wrote.", left: [{ type: "photo" }], right: [{ type: "story" }] },
  { key: "photo-photo", name: "Photos on both pages", hint: "One photo per page — no writing.", left: [{ type: "photo" }], right: [{ type: "photo" }] },
  { key: "grid", name: "Four photos + story", hint: "A 2×2 photo grid facing your writing.", left: [{ type: "photo" }, { type: "photo" }, { type: "photo" }, { type: "photo" }], right: [{ type: "story" }] },
  { key: "photo-caption", name: "Photo + caption, both pages", hint: "A photo above a short caption on each page.", left: [{ type: "photo" }, { type: "story" }], right: [{ type: "photo" }, { type: "story" }] },
  { key: "story", name: "Story on both pages", hint: "Writing only, across the whole spread.", left: [{ type: "story" }], right: [{ type: "story" }] },
];
const LKEY = "pb_book_layouts";
const DEFAULT_LAYOUT = { left: [{ type: "photo" }], right: [{ type: "story" }] };
// A section is a photo or a story block. (A location stamp is not a section type — it
// attaches like a photo; see addStampTo / the stamp fields on a photo record.)
function cleanSection(s) {
  if (s && s.type === "story") return s.text != null ? { type: "story", text: s.text } : { type: "story" };
  return { type: "photo" };
}
// Normalise a pane to an array of 1–4 sections, migrating the older shapes:
//   • {type:"photos"|"story", count}  (per-side type + count)
//   • array already in the new form
function normSide(side) {
  if (Array.isArray(side)) { const a = side.slice(0, MAX_SECTIONS).map(cleanSection); return a.length ? a : [{ type: "photo" }]; }
  if (side && side.type) {
    const t = side.type === "story" ? "story" : "photo";
    const n = t === "story" ? 1 : Math.max(1, Math.min(MAX_SECTIONS, side.count || 1));
    return Array.from({ length: n }, () => ({ type: t }));
  }
  return [{ type: "photo" }];
}
// Also accepts the oldest {mode,count} shape so saved books keep working.
function normLayout(l) {
  if (!l) return DEFAULT_LAYOUT;
  if (!l.left && !l.right && l.mode) {
    const c = Math.max(1, Math.min(MAX_SECTIONS, l.count || 4));
    if (l.mode === "photo-photo") return { left: [{ type: "photo" }], right: [{ type: "photo" }] };
    if (l.mode === "grid") return { left: Array.from({ length: c }, () => ({ type: "photo" })), right: [{ type: "story" }] };
    if (l.mode === "story") return { left: [{ type: "story" }], right: [{ type: "story" }] };
    return DEFAULT_LAYOUT;
  }
  return { left: normSide(l.left), right: normSide(l.right) };
}
const photoCount = (side) => side.filter((s) => s.type === "photo").length;
const storyCount = (side) => side.filter((s) => s.type === "story").length;
// How many photos this chapter needs before nothing is an empty slot.
const photosNeeded = (l) => { const n = normLayout(l); return photoCount(n.left) + photoCount(n.right); };
const describeSide = (side) => {
  const p = photoCount(side), s = storyCount(side);
  const parts = [];
  if (p) parts.push(`${p} photo${p > 1 ? "s" : ""}`);
  if (s) parts.push(`${s} text`);
  return parts.join(" + ") || "empty";
};
const describeLayout = (l) => { const n = normLayout(l); return `${describeSide(n.left)} · ${describeSide(n.right)}`; };
/* A story section that's 1/n of a page holds roughly this many characters before it
   would overrun its box in print — a quarter-page can't take a full page of prose.
   The textarea enforces it and the count shows how much is left. */
const STORY_CAP = { 1: 700, 2: 340, 3: 220, 4: 160 };
const storyCap = (sectionsOnPage) => STORY_CAP[Math.max(1, Math.min(MAX_SECTIONS, sectionsOnPage))] || 160;
/* Page margins — the white border content is inset from the trim edge, a book-wide
   choice. Values from print guidance (Lulu safety margin = 0.5"): full-bleed is the
   photo-only exception at 0; Standard matches the 0.5" safety line; Gallery is a
   wide, premium frame. `in` is inches; the preview insets by in/trim. */
const MARGINS = [
  { key: "fullbleed", name: "Full bleed", in: 0, note: "Edge-to-edge — best for photos. Keep text away from the edges." },
  { key: "standard", name: "Standard", in: 0.5, note: "A clean, even border — the safe default for photos and text." },
  { key: "gallery", name: "Gallery", in: 0.75, note: "A wide, museum-style frame." },
];
const marginOf = (key) => MARGINS.find((m) => m.key === key) || MARGINS[1];
function getBookMargin() { return readLayouts().margin || "standard"; }
function setBookMargin(key) { const o = readLayouts(); o.margin = key; writeLayouts(o); }
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
// Set one story section's text. Editing text materialises the layout as a stop
// override (writing implies you've customised this chapter). The globally-first
// story section also mirrors to the trip story so the two stay in sync; extra
// writing blocks are book-only, carried on the section.
function setSectionStory(name, pane, idx, text) {
  const o = readLayouts(); o.stops = o.stops || {};
  const cur = normLayout(o.stops[name] || getDefaultLayout());
  o.stops[name] = { ...cur, [pane]: cur[pane].map((s, i) => (i === idx ? { ...s, text } : s)) };
  writeLayouts(o);
}
/* A static map image of a spot, for a location stamp. Uses the same Google key as the
   rest of the app when present; returns null otherwise so the stamp falls back to a
   designed placeholder rather than a broken image.
   ⚠ PRINT LICENSING: Google Static Maps in a SOLD, PRINTED book needs Google's
   permission — fine for the on-screen preview, must be swapped for a print-licensed
   provider (Mapbox/Stadia/Geoapify static images) before a map stamp is printed.
   Tracked in TODO. */
function gmapsKey() {
  try { return localStorage.getItem("pb_gmaps_key") || (typeof window !== "undefined" && window.GMAPS_KEY) || ""; } catch { return ""; }
}
function staticMapUrl(lat, lng) {
  const key = gmapsKey();
  if (lat == null || lng == null || !key) return null;
  const c = `${(+lat).toFixed(5)},${(+lng).toFixed(5)}`;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${c}&zoom=12&size=400x300&scale=2&maptype=terrain&markers=color:0xC9A24A%7C${c}&key=${key}`;
}
/* Walk a spread's sections in reading order (left pane, then right) and number the
   photos and story blocks globally — the numbers the preview shows and Stop Tools
   matches. photoIndex → which photo fills it; storyIndex → which writing block. */
function planSpread(lay) {
  let pi = 0, si = 0;
  // Each section carries where it lives (pane + index + how many share the page) so a
  // cell rendered on the book can save itself — that's what makes inline editing work.
  const plan = (side, pane) => side.map((s, idx) => {
    const base = { pane, idx, paneCount: side.length };
    if (s.type === "photo") return { ...base, type: "photo", photoIndex: pi++ };
    return { ...base, type: "story", storyIndex: si++, text: s.text };
  });
  return { left: plan(lay.left, "left"), right: plan(lay.right, "right") };
}
/* The cover photo is a CHOICE, kept alongside the layouts so it rides the same
   change event. Until it's made we fall back to the first photo in the book —
   a sensible opening image rather than a blank cover — but the moment the
   traveller picks one, that's what prints. */
// Stores the whole photo RECORD, not just the thumbnail: the cover has to print the
// full-resolution original too. Tolerates the older string form.
function getCoverPick() {
  const c = readLayouts().cover;
  if (!c) return null;
  return typeof c === "string" ? { url: c, path: null, w: null, h: null } : c;
}
function setCoverPick(rec) { const o = readLayouts(); o.cover = rec; writeLayouts(o); }
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
// `afterName` (optional) makes this a continuation page that renders right after
// that chapter — how "add another page for this stop" works. Without it, the page
// is a standalone own-page appended at the end.
function addExtra({ name, story = "", photos = [], afterName = null }) {
  const a = readExtras();
  const id = "x" + Date.now().toString(36);
  a.push({ id, name, story, photos, afterName });
  writeExtras(a);
  return id;
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
  // Older extras stored bare url strings; normalise them to records so one shape
  // reaches the renderers (they just have no print original behind them).
  const asRec = (p) => (typeof p === "string" ? { url: p, path: null, w: null, h: null } : p);
  const extraSpreads = extras.map((e) => ({
    name: e.name, park: "Your own page", q: [e.name],
    userImg: (asRec((e.photos || [])[0]) || {}).url || null,
    photos: (e.photos || []).map(asRec).filter((p) => p && p.url),
    story: e.story || "", date: "", lat: null, lng: null,
    chapter: 0, source: "own", id: e.id, afterName: e.afterName || null,
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
      // Records, not bare urls — the thumbnail we draw and the print original's path
      // have to stay together or the book prints something other than the preview.
      photos: photos.filter((p) => p && (p.url || p.stamp)).map((p) => ({ url: p.url, path: p.path || null, w: p.w || null, h: p.h || null, stamp: p.stamp || null })),
      story: stories[s.name] || "",
      date: p0 && p0.ts ? fmtDate(p0.ts) : "",
      lat: s.lat != null ? s.lat : (p0 ? p0.lat : null),
      lng: s.lng != null ? s.lng : (p0 ? p0.lng : null),
      chapter: i + 1,
      source: "itinerary",
    };
  });
  // Interleave continuation pages right after the chapter they belong to; free
  // own-pages fall to the end. Then number chapters by final order.
  const ordered = [];
  spreads.forEach((sp) => {
    ordered.push(sp);
    extraSpreads.filter((o) => o.afterName === sp.name).forEach((o) => ordered.push(o));
  });
  extraSpreads.filter((o) => !o.afterName || !spreads.some((sp) => sp.name === o.afterName)).forEach((o) => ordered.push(o));
  ordered.forEach((sp, i) => { sp.chapter = i + 1; });
  const states = [...new Set(stops.map((s) => s.state).filter(Boolean))];
  return {
    isDemo: false, tick,
    title: meta.tripName || "Your Trip Book",
    author: "",
    region: states.length ? states.join(" · ") : "A Park Buddy Trip",
    spreads: ordered,
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

// Every photo slot wears its number, and the same number labels the photo in Stop
// Tools — so "slot ② is that photo" is something you SEE, not work out. Circled
// digits (①..⑧) cover the most any spread prints (4 + 4).
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];
const slotGlyph = (n) => CIRCLED[n - 1] || "(" + n + ")";
const SlotNum = ({ n }) => (n ? (
  <div aria-hidden style={{ position: "absolute", top: 5, left: 5, zIndex: 2, minWidth: 17, height: 17, padding: "0 3px", borderRadius: 9, background: "rgba(12,22,16,.82)", color: "#f4f1ea", fontFamily: mono, fontSize: ".6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{n}</div>
) : null);

/* The photo shows in its OWN orientation, whole — `contain`, not `cover`. The slot's
   shape is the layout's page frame, not the photo's; filling it with `cover` cropped a
   portrait down to a landscape band ("why is my portrait landscape?"). We'd rather
   show the whole photo, centered on the page, than silently cut the top and bottom
   off someone's shot. The margins are the page paper (transparent → the card behind). */
const PhotoSlot = ({ url, num }) => (
  <div style={{ position: "relative", overflow: "hidden", borderRadius: 4, height: "100%" }}>
    <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    <SlotNum n={num} />
  </div>
);
// An un-filled slot stays honest: it prints as a designed page, never stock art. It
// still carries its number, so an empty slot is a place you can see needs a photo.
const EmptySlot = ({ num }) => (
  <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "1px dashed var(--pb-line-strong)", color: "var(--pb-muted)", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".08em", textAlign: "center", padding: 8 }}>
    <SlotNum n={num} />＋ Add a photo
  </div>
);
// One story SECTION on a page. Compact — it may be a quarter of a page — so type
// scales down when it shares the page. The chapter title rides the first writing
// block of the chapter only, so a book always has one somewhere. When `editable`,
// the body is a textarea styled as the page's own prose, so you write straight onto
// the book — capped to the space the section prints in.
function StorySection({ spread, planned, dense, editable }) {
  const text = planned.text != null ? planned.text : (planned.storyIndex === 0 ? spread.story : "");
  const isFirst = planned.storyIndex === 0;
  const bodyFont = dense ? ".82rem" : "1rem";
  return (
    <div style={{ height: "100%", overflow: "hidden", padding: dense ? "8px 8px" : "10px 6px", display: "flex", flexDirection: "column" }}>
      {isFirst && <>
        <Eyebrow>Chapter {spread.chapter}</Eyebrow>
        <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: dense ? "1.05rem" : "1.5rem", color: "var(--pb-ink)", margin: "6px 0 0", lineHeight: 1.1 }}>{spread.name}</h3>
        <div style={{ width: 36, height: 1, background: "var(--pb-line-strong)", margin: dense ? "9px 0 10px" : "12px 0 14px" }} />
      </>}
      {editable
        ? <InlineStory spread={spread} planned={planned} font={bodyFont} />
        : <p style={{ fontFamily: serif, fontSize: bodyFont, lineHeight: 1.6, color: "var(--pb-ink-2)", margin: 0 }}>
            {text || <span style={{ color: "var(--pb-muted)", fontStyle: "italic" }}>Write this section in Stop Tools — or it prints as a clean blank page.</span>}
          </p>}
    </div>
  );
}

// Write straight onto the page. The textarea looks like the printed prose (serif,
// no chrome) and shares everything with the Stop Tools editor: same cap for the
// section's size, same store, first block still mirrors the trip story. Saves when
// you click away, so typing doesn't thrash localStorage.
function InlineStory({ spread, planned, font }) {
  const cap = storyCap(planned.paneCount);
  const seed = () => (planned.text != null ? planned.text : (planned.storyIndex === 0 ? (spread.story || "") : ""));
  const [val, setVal] = useState(seed);
  useEffect(() => { setVal(seed()); }, [spread.name, planned.pane, planned.idx, planned.text]);
  const save = () => {
    if (val === seed()) return;
    try { setSectionStory(spread.name, planned.pane, planned.idx, val); if (planned.storyIndex === 0) setStory(spread.name, val); } catch {}
  };
  const left = cap - val.length;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <textarea
        value={val} maxLength={cap} onChange={(e) => setVal(e.target.value)} onBlur={save}
        placeholder="Write here…"
        style={{ flex: 1, minHeight: 0, width: "100%", resize: "none", border: "none", outline: "none", background: "transparent",
          fontFamily: serif, fontSize: font, lineHeight: 1.6, color: "var(--pb-ink-2)", padding: 0 }} />
      <div style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".06em", color: left <= 20 ? "var(--pb-prepare)" : "var(--pb-muted)", textAlign: "right", marginTop: 2 }}>{left}</div>
    </div>
  );
}

/* A LOCATION STAMP photo — the map screenshot with a pin, and the coordinates (and an
   optional place name) as a caption beneath it, like a postcard mark. It fills a photo
   slot like any other photo; a photo record carries `stamp:{lat,lng,label}`. */
function StampPhoto({ rec, num, dense }) {
  const { lat, lng, label } = rec.stamp || {};
  const url = rec.url || staticMapUrl(lat, lng);
  const coord = fmtCoord(lat, lng);
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", borderRadius: 4, overflow: "hidden", border: "1px solid var(--pb-line)" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", background: "var(--pb-tint)" }}>
        {url
          ? <img src={url} alt={coord || "location"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pb-muted)", fontSize: dense ? "1.4rem" : "2rem" }}>⌖</div>}
      </div>
      <div style={{ flex: "0 0 auto", padding: dense ? "5px 7px" : "8px 10px", textAlign: "center", background: "var(--pb-surface)", borderTop: "1px solid var(--pb-line)" }}>
        {label && <div style={{ fontFamily: serif, fontSize: dense ? ".72rem" : ".92rem", color: "var(--pb-ink)", lineHeight: 1.15 }}>{label}</div>}
        {coord && <div style={{ fontFamily: mono, fontSize: dense ? ".48rem" : ".56rem", letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 2 }}>{coord}</div>}
      </div>
      <SlotNum n={num} />
    </div>
  );
}

// One cell of a page — a photo (numbered slot, own orientation), a location-stamp
// photo, or a story block. A lone empty photo cell falls back to the licensed hero
// image; empty cells in a grid stay honest "add a photo" tiles.
function SectionCell({ planned, spread, dense, hero, editable }) {
  if (planned.type === "story") return <StorySection spread={spread} planned={planned} dense={dense} editable={editable} />;
  const p = (spread.photos || [])[planned.photoIndex];
  const num = planned.photoIndex + 1;
  if (p && p.stamp) return <StampPhoto rec={p} num={num} dense={dense} />;
  if (p) return <PhotoSlot url={p.url} num={num} />;
  if (hero) return <div style={{ height: "100%", position: "relative" }}><SpreadPhoto spread={spread} /><SlotNum n={num} /></div>;
  return <EmptySlot num={num} />;
}

/* A page (pane) lays its 1–4 sections into a grid:
     1 → full page          2 → two stacked rows
     3 → one big cell on top, two side by side below (a hero + two supporters —
         far kinder to a portrait than three wide, short letterbox strips)
     4 → a 2×2 grid
   Each cell fills its share so the page is the same height either side. */
function Pane({ sections, spread, hero, editable }) {
  const n = sections.length;
  let grid, spanFirst = false;
  if (n >= 4) grid = { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" };
  else if (n === 3) { grid = { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1.15fr 1fr" }; spanFirst = true; }
  else grid = { gridTemplateColumns: "1fr", gridTemplateRows: `repeat(${n}, 1fr)` };
  return (
    <div style={{ display: "grid", ...grid, gap: 6, height: "100%" }}>
      {sections.map((s, i) => (
        <div key={i} style={{ minHeight: 0, minWidth: 0, ...(spanFirst && i === 0 ? { gridColumn: "1 / -1" } : {}) }}>
          <SectionCell planned={s} spread={spread} dense={n > 1} hero={hero} editable={editable} />
        </div>
      ))}
    </div>
  );
}

// The open-book spread. Its composition comes from the stop's own layout, else the
// book default (see MODES / pb_book_layouts).
/* Page maths — derived from what each chapter ACTUALLY is, not a flat guess.
   A story-only chapter is one page; every other composition is a spread (two).
   Getting this wrong mis-numbers the book AND mis-states the page count we quote
   and send to the printer, so it's computed from the real layouts. Front matter =
   cover + introduction (2); the closing page is 1. Lulu's hardcover minimum is 24
   pages and the count must be even — we pad silently rather than make a customer
   do signature arithmetic. */
const layoutOf = (spread, ready) => normLayout(ready ? (getStopLayout(spread.name) || getDefaultLayout()) : DEFAULT_LAYOUT);
// Every chapter is a two-page spread, so page maths is simply positional.
function paginate(spreads, ready) {
  const starts = spreads.map((_, i) => 3 + i * 2); // 1-2 = cover + introduction
  let total = 3 + spreads.length * 2; // + the closing page
  total = Math.max(24, total);
  if (total % 2) total += 1;
  return { starts, total };
}
const PageNums = ({ start, single }) => {
  const pad = (x) => String(x).padStart(2, "0");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".14em", color: "var(--pb-muted)", padding: "8px 4px 0", gridColumn: "1 / -1" }}>
      <span>{pad(start)}</span>{!single && <span>{pad(start + 1)}</span>}
    </div>
  );
};

/* Two 3:4 pages side by side, with the gutter between them — the aspect of the
   open book. It lives on the pages row so EVERY composition is the same size,
   whatever mix of photos and text the pages hold. */
const SPREAD_ASPECT = "1.53 / 1";

function Spread({ spread, startPage = 3, editable = false, size }) {
  const ready = useLayoutTick();
  const lay = layoutOf(spread, ready);
  const plan = planSpread(lay);
  const totalPhotos = photoCount(lay.left) + photoCount(lay.right);
  // Book-wide margin, inset as a fraction of the trim so the preview matches print.
  const trimIn = ((size && parseInt(String(size.trim).slice(0, 4), 10)) || 850) / 100;
  const marginPct = ready ? (marginOf(getBookMargin()).in / trimIn) * 100 : 0;
  const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, boxShadow: "var(--pb-shadow)", padding: 14, maxWidth: 720, width: "100%" };
  const pages = { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "14px", aspectRatio: SPREAD_ASPECT };
  const pad = { height: "100%", boxSizing: "border-box", ...(marginPct ? { padding: `${marginPct}%` } : {}) };
  return (
    <div style={card}>
      <div style={pages}>
        <div style={pad}><Pane sections={plan.left} spread={spread} hero={totalPhotos === 1} editable={editable} /></div>
        <div style={pad}><Pane sections={plan.right} spread={spread} hero={totalPhotos === 1} editable={editable} /></div>
      </div>
      <PageNums start={startPage} />
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
  } else if (k === "full") {
    // Full-bleed photo. The title sits in a scrim at the foot so it stays legible
    // whatever photo lands underneath it — a bright sky must not eat the title.
    inner = (
      <div style={{ position: "absolute", inset: 0 }}>
        {photo}
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,0) 38%,rgba(0,0,0,.18) 58%,rgba(0,0,0,.78) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, padding: 26, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>{vol}{seal}</div>
          <div>
            <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", lineHeight: 1.08, margin: "0 0 6px", color: "#F4F2EC" }}>{title}</h3>
            {region && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: ".82rem", color: "rgba(244,242,236,.8)", marginBottom: 10 }}>A journey through {region}</div>}
            {author && <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(244,242,236,.85)" }}>{author}</div>}
          </div>
        </div>
      </div>
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
  const cur = spreads[Math.min(Math.max(sel, 0), n - 1)] || spreads[0];
  const layout = layoutFor(layoutKey);
  // The chosen cover photo wins; until one is chosen, the book's first photo stands in.
  // getCoverPick() is a RECORD {url,path,w,h}; everything that draws the cover needs a
  // URL string (url(${coverImg})), so extract .url. Passing the object printed
  // url([object Object]) and the cover showed nothing.
  const coverPick = mounted ? getCoverPick() : null;
  const coverImg = (coverPick && coverPick.url) || (spreads.find((s) => s.userImg) || {}).userImg || null;
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
  // Real page count + per-chapter start pages, from the actual compositions.
  const { starts, total: pages } = paginate(spreads, mounted);
  const priceNum = size.base + n * size.perStop + cover.add;
  const price = "$" + priceNum;

  // -1 is the cover, so the pager runs cover → chapter 01 → … and wraps.
  const prev = () => setSel((s) => ((s + 1 - 1 + (n + 1)) % (n + 1)) - 1);
  const next = () => setSel((s) => ((s + 1 + 1) % (n + 1)) - 1);

  const openReserve = () => setReserve({
    theme: palette.name, size: sizeName, price, title: book.title, dates: "", dedication: "",
    pages, stops: n, cover: cover.name, finish: finish.name, sku,
    entries: spreads.map((s) => ({ type: "Chapter", place: s.name, cap: s.story, userImg: s.userImg, q: s.q })),
  });

  const fmtProps = { size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, priceNum, customBase, setCustomBase, pickTheme };
  const commonProps = { book, spreads, sel, setSel, cur, n, prev, next, role, starts, coverImg, layoutKey, openManage: () => setManageOpen(true) };

  if (!mounted) {
    return (
      <div className="pb-theme">
        <SiteHeader acctSlot hideTabBar />
        <div style={{ minHeight: "100vh", background: "var(--pb-bg)", paddingTop: 90 }} />
      </div>
    );
  }

  return (
    /* `.pb-theme` wraps the HEADER TOO. It's the class that opts a page into the
       light palette, and it only ever re-values --pb-* tokens (no layout of its
       own) — so a header outside it kept the dark theme's near-white ink while the
       page under it went cream, which is why sign-in, My Trip and the theme toggle
       read as invisible in light mode. */
    <div className="pb-theme">
      {/* The MAIN Park Buddy banner stays — same header as the landing/rest of the
          platform. The studio's own bar sits below it as a page toolbar (and supplies
          the phone's bottom bar, so hideTabBar avoids two bottom bars). */}
      <SiteHeader acctSlot hideTabBar />
      {/* Desktop is a fixed-height workspace: the book stays put and only the rails
          scroll. (Phone keeps normal page scrolling.) */}
      <div style={{ background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: sans, paddingTop: 90,
        ...(isPhone ? { minHeight: "100vh" } : { height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }) }}>
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
    </div>
  );
}

/* ---------------- top bar (desktop) ---------------- */
function TopBar({ step, setStep, role, setRole, price, pages }) {
  const steps = [["diary", "Diary"], ["theme", "Theme"], ["preview", "Preview"]];
  /* NOT sticky. The workspace is a fixed-height, non-scrolling column, which makes
     it a scroll container — so `top: 90` would be measured from the workspace
     rather than the viewport and shunt this bar 90px down over the rails. It's a
     plain row at the top of the column; nothing scrolls past it. */
  return (
    <div style={{ flex: "0 0 auto", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", height: 60, borderBottom: "1px solid var(--pb-line)", background: "var(--pb-glass)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Running price — never let the total be a checkout surprise. */}
        {price && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{pages} pages</span>
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1rem", color: "var(--pb-gold)" }}>{price}.00</span>
          </div>
        )}
        <RoleToggle role={role} setRole={setRole} />
      </div>
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
      <TopBar step={step} setStep={props.setStep} role={props.role} setRole={props.setRole} price={props.price} pages={props.pages} />
      {props.book && props.book.isDemo && (
        <div style={{ flex: "0 0 auto", background: "rgba(232,207,154,.08)", borderBottom: "1px solid var(--pb-line)", padding: "9px 26px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Sample book</span>
          <span style={{ fontSize: ".8rem", color: "var(--pb-ink-2)" }}>You&rsquo;re looking at an example — build an itinerary or add your own pages and it becomes yours.</span>
          <Link href="/build-trip" style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--pb-gold)", textDecoration: "none" }}>Build a trip →</Link>
        </div>
      )}
      <div style={{ maxWidth: 1440, margin: "0 auto", width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {step === "diary" && <DiaryDesktop {...props} />}
        {step === "theme" && <ThemeDesktop {...props} />}
        {step === "preview" && <PreviewDesktop {...props} />}
      </div>
    </>
  );
}

/* Photos go to the right place: an itinerary chapter's photos live in Trip Mode;
   a book-only page keeps its own. A `rec` is { url, path, w, h } — url is the
   thumbnail the Studio draws, path is where the print-resolution original lives
   (lib/bookPhoto.js), w/h are the original's true pixels. */
function addPhotosTo(spread, recs) {
  if (!recs.length) return;
  if (spread.source === "own") updateExtra(spread.id, { photos: [...(spread.photos || []), ...recs] });
  else recs.forEach((r) => addPhoto(spread.name, { ...r, lat: spread.lat, lng: spread.lng }));
}
/* Attach a LOCATION STAMP — a map screenshot of a spot with a pin — as a photo. It
   fills a photo slot like any other photo, and renders the coordinates (and place
   name) as a caption beneath the map. */
function addStampTo(spread, { lat, lng, label }) {
  if (lat == null || lng == null) return;
  addPhotosTo(spread, [{ url: staticMapUrl(lat, lng), path: null, w: null, h: null, stamp: { lat, lng, label: label || "" } }]);
}

/* One place that knows how to take photos into a chapter, so the stop tile and Stop
   Tools behave identically: upload at print resolution, report what actually went
   wrong, and never pretend a failed photo landed. */
function useAddPhotos(spread) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // let the same file be re-picked after a failure
    if (!files.length) return;
    setError(null);
    setBusy(files.length);
    const recs = [];
    let failed = null;
    for (const f of files) {
      try { recs.push(await uploadBookPhoto(f)); }
      catch (err) { failed = (err && err.message) || "Couldn't add that photo."; }
      setBusy((n) => Math.max(0, n - 1));
    }
    if (recs.length) {
      try { addPhotosTo(spread, recs); }
      catch (err) { failed = err && err.name === "QuotaError" ? "Your browser's storage is full — remove a photo and try again." : (err && err.message) || "Couldn't save that photo."; }
    }
    setBusy(0);
    if (failed) setError(failed);
  };
  return { fileRef, onFile, busy, error, open: () => fileRef.current && fileRef.current.click() };
}
const PhotoInput = ({ fileRef, onFile }) => (
  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFile} style={{ display: "none" }} />
);

// A stop tile carries its own composition + photo state, and takes photos directly.
function StopCard({ spread, i, active, onSelect }) {
  const ready = useLayoutTick();
  const lay = layoutOf(spread, ready);
  const need = photosNeeded(lay);
  const have = (spread.photos || []).length;
  const { fileRef, onFile, busy, error, open } = useAddPhotos(spread);
  const full = need === 0 || have >= need;
  return (
    <div className="bs-stopcard" onClick={onSelect} style={{ cursor: "pointer", background: active ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (active ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: mono, fontSize: ".5rem", color: "var(--pb-muted)" }}>{"0" + (i + 1)}</span>
        <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".06em", textTransform: "uppercase", color: spread.source === "own" ? "var(--pb-gold-soft)" : "var(--pb-muted)" }}>{spread.source === "own" ? "Your page" : "Itinerary"}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: ".9rem", color: "var(--pb-ink)", marginTop: 3 }}>{spread.name}</div>
      <div style={{ fontSize: ".7rem", color: "var(--pb-muted)" }}>{spread.park}</div>
      {/* the composition + how many photos it still needs, right on the tile */}
      <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".04em", color: "var(--pb-ink-2)", marginTop: 7 }}>{describeLayout(lay)}</div>
      {/* the photos actually on this chapter, on the tile itself */}
      {have > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
          {(spread.photos || []).slice(0, 6).map((p, k) => (
            <div key={k} aria-hidden style={{ flex: "0 0 26px", height: 34, borderRadius: 3, border: "1px solid var(--pb-line)", background: `center/cover url(${p.url})` }} />
          ))}
          {have > 6 && <div style={{ alignSelf: "center", fontFamily: mono, fontSize: ".5rem", color: "var(--pb-muted)" }}>+{have - 6}</div>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
        <span style={{ fontFamily: mono, fontSize: ".5rem", color: full ? "var(--pb-go)" : "var(--pb-prepare)" }}>{have}/{need || "–"} photos</span>
        <button onClick={(e) => { e.stopPropagation(); open(); }} disabled={!!busy}
          style={{ marginLeft: "auto", cursor: busy ? "default" : "pointer", fontFamily: "inherit", fontSize: ".66rem", fontWeight: 600, color: busy ? "var(--pb-muted)" : "var(--pb-gold)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "3px 9px" }}>
          {busy ? "Adding…" : "＋ Photos"}
        </button>
        <span onClick={(e) => e.stopPropagation()}><PhotoInput fileRef={fileRef} onFile={onFile} /></span>
      </div>
      {error && <div style={{ fontSize: ".64rem", color: "var(--pb-avoid)", marginTop: 5, lineHeight: 1.4 }}>{error}</div>}
    </div>
  );
}

/* The cover's own card in the page list. It sits above chapter 01 because that's
   where it sits in the book. */
function CoverCard({ active, onSelect, layoutKey, coverImg }) {
  const lay = layoutFor(layoutKey);
  return (
    <button onClick={onSelect} className="bs-stopcard"
      style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 10, alignItems: "center", background: active ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (active ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "10px 11px" }}>
      <div aria-hidden style={{ flex: "0 0 30px", height: 40, borderRadius: 3, border: "1px solid var(--pb-line)", background: lay.photo !== "none" && coverImg ? `center/cover url(${coverImg})` : "var(--pb-tint)" }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Cover</div>
        <div style={{ fontWeight: 600, fontSize: ".85rem", color: "var(--pb-ink)", margin: "1px 0 2px" }}>Front cover</div>
        <div style={{ fontSize: ".66rem", color: "var(--pb-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lay.name}</div>
      </div>
    </button>
  );
}

function DiaryDesktop({ spreads, sel, setSel, cur, n, prev, next, role, book, openManage, setStep, starts, layoutKey, setLayoutKey, palette, coverImg, cover, finish, size }) {
  const author = role === "author";
  const onCover = sel === -1;
  // Add a page from the Pages panel: a continuation right after the selected page
  // (jump to it), or a fresh page at the end when the cover is selected.
  const onAddPage = () => {
    if (onCover) { addExtra({ name: "New page" }); setSel(n); }
    else { addExtra({ name: cur.name + " — more", afterName: cur.name }); setSel(sel + 1); }
  };
  // Fixed height + independently scrolling rails — the book stays put instead of
  // the whole page scrolling away under you.
  return (
    <div style={{ display: "grid", gridTemplateColumns: author ? "300px 1fr 320px" : "1fr", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {author && (
        <aside className="bs-rail" style={{ borderRight: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Eyebrow>Your Pages ({n + 1})</Eyebrow>
            <button onClick={openManage} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".7rem", fontWeight: 600, color: "var(--pb-gold)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "5px 11px" }}>Manage</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
            <CoverCard active={onCover} onSelect={() => setSel(-1)} layoutKey={layoutKey} coverImg={coverImg} />
            {spreads.map((s, i) => <StopCard key={s.id || s.name} spread={s} i={i} active={i === sel} onSelect={() => setSel(i)} />)}
          </div>
          {/* Add a page — a new page right after whichever page is selected. */}
          <button onClick={onAddPage} style={{ cursor: "pointer", width: "100%", marginTop: 12, fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, color: "var(--pb-gold)", background: "transparent", border: "1px dashed var(--pb-line-strong)", borderRadius: 10, padding: "11px" }}>
            ＋ Add a page{onCover ? "" : ` after ${cur.name}`}
          </button>
        </aside>
      )}
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", padding: "24px 30px", overflowY: "auto" }}>
        {onCover
          ? <CoverPreview title={book.title} author={book.author} region={book.region} layout={layoutFor(layoutKey)} palette={palette} dateLabel="" coverImg={coverImg} cover={cover} finish={finish} size={size} />
          : <Spread spread={cur} startPage={(starts || [])[sel] || 3} editable={author} size={size} />}
        <Pager i={sel + 1} n={n + 1} label={onCover ? "Front cover" : cur.name} onPrev={prev} onNext={next} />
      </main>
      {author && (onCover
        ? <CoverTools spreads={spreads} layoutKey={layoutKey} setLayoutKey={setLayoutKey} coverImg={coverImg} size={size} onNext={() => setStep("theme")} />
        : <StopTools spread={cur} size={size} onNext={() => setStep("theme")} />)}
    </div>
  );
}

// One pane's section editor. TOP-LEVEL (not nested in LayoutPicker) on purpose: a
// component defined inside another is a new type every render, so React unmounts and
// remounts it each time — which drops a real mouse click when the button is replaced
// between mousedown and mouseup. That was the "toggle doesn't change it" bug.
const stepBtnStyle = (off) => ({ cursor: off ? "default" : "pointer", width: 20, height: 20, borderRadius: 6, border: "1px solid var(--pb-line-strong)", background: "transparent", color: off ? "var(--pb-line-strong)" : "var(--pb-ink)", fontFamily: "inherit", fontSize: ".8rem", lineHeight: 1, opacity: off ? 0.5 : 1 });
function SideCtl({ side, label, sections, onSetType, onAdd, onRemove }) {
  return (
    <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "9px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => onRemove(side)} disabled={sections.length <= 1} aria-label="Fewer sections" style={stepBtnStyle(sections.length <= 1)}>−</button>
          <span style={{ fontFamily: mono, fontSize: ".55rem", color: "var(--pb-ink-2)", minWidth: 20, textAlign: "center" }}>{sections.length}</span>
          <button onClick={() => onAdd(side)} disabled={sections.length >= MAX_SECTIONS} aria-label="More sections" style={stepBtnStyle(sections.length >= MAX_SECTIONS)}>+</button>
        </span>
      </div>
      {/* One row per section, top to bottom as they stack on the page — each flips
          between a photo and a story block. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: mono, fontSize: ".5rem", color: "var(--pb-muted)", width: 12, textAlign: "center" }}>{i + 1}</span>
            <div style={{ display: "flex", flex: 1, background: "var(--pb-tint)", borderRadius: 6, padding: 2 }}>
              {[["photo", "Photo"], ["story", "Story"]].map(([t, l]) => (
                <button key={t} onClick={() => onSetType(side, i, t)} style={{ flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: ".66rem", fontWeight: s.type === t ? 700 : 500, border: "none", borderRadius: 4, padding: "4px", background: s.type === t ? "var(--pb-surface-2)" : "transparent", color: s.type === t ? "var(--pb-ink)" : "var(--pb-muted)" }}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Page-composition picker — used for the book DEFAULT (Theme step) and to override
// a single chapter (Stop Tools).
function LayoutPicker({ value, onChange, onReset, isOverride }) {
  const lay = normLayout(value);
  const types = (side) => side.map((s) => s.type).join(",");
  const presetOn = (p) => types(normSide(p.left)) === types(lay.left) && types(normSide(p.right)) === types(lay.right);
  const setSide = (side, sections) => onChange({ ...lay, [side]: sections });
  // Changing a section's type keeps whatever that type carries (story text, map coords).
  const setType = (side, i, type) => setSide(side, lay[side].map((s, k) => (k === i ? cleanSection({ ...s, type }) : s)));
  const addSection = (side) => { if (lay[side].length < MAX_SECTIONS) setSide(side, [...lay[side], { type: "photo" }]); };
  const removeSection = (side) => { if (lay[side].length > 1) setSide(side, lay[side].slice(0, -1)); };

  return (
    <>
      <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => onChange({ left: normSide(p.left), right: normSide(p.right) })} title={p.hint}
            style={{ cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", border: "1px solid " + (presetOn(p) ? "var(--pb-gold-2)" : "var(--pb-line)"), background: presetOn(p) ? "var(--pb-surface-2)" : "transparent", color: "var(--pb-ink)", borderRadius: 8, padding: "7px 10px" }}>
            <span style={{ display: "block", fontSize: ".72rem", fontWeight: presetOn(p) ? 700 : 500 }}>{p.name}</span>
            <span style={{ display: "block", fontSize: ".62rem", color: "var(--pb-muted)", marginTop: 2 }}>{p.hint}</span>
          </button>
        ))}
      </div>
      <div style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)", marginBottom: 6 }}>Or build it yourself — up to 4 sections a page</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <SideCtl side="left" label="Left page" sections={lay.left} onSetType={setType} onAdd={addSection} onRemove={removeSection} />
        <SideCtl side="right" label="Right page" sections={lay.right} onSetType={setType} onAdd={addSection} onRemove={removeSection} />
      </div>
      {onReset && (
        <button onClick={onReset} disabled={!isOverride} style={{ cursor: isOverride ? "pointer" : "default", width: "100%", marginTop: 10, fontFamily: "inherit", fontSize: ".72rem", color: isOverride ? "var(--pb-gold)" : "var(--pb-muted)", background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 8, padding: "7px", opacity: isOverride ? 1 : .55 }}>
          {isOverride ? "↺ Use book default" : "Using book default"}
        </button>
      )}
    </>
  );
}

// Book-wide page margins. The preview updates as you pick (see Spread).
function MarginPicker() {
  useLayoutTick();
  const cur = getBookMargin();
  return (
    <>
      <Eyebrow>Page margins</Eyebrow>
      <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", margin: "6px 0 10px" }}>The border around every page. Applies to the whole book.</div>
      <div style={{ display: "grid", gap: 5 }}>
        {MARGINS.map((m) => {
          const on = m.key === cur;
          return (
            <button key={m.key} onClick={() => setBookMargin(m.key)}
              style={{ cursor: "pointer", textAlign: "left", fontFamily: "inherit", background: on ? "var(--pb-surface-2)" : "transparent", border: "1px solid " + (on ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 8, padding: "8px 11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: ".78rem", fontWeight: on ? 700 : 500, color: "var(--pb-ink)" }}>{m.name}</span>
                <span style={{ fontFamily: mono, fontSize: ".5rem", color: "var(--pb-muted)" }}>{m.in ? m.in + '"' : "0"}</span>
              </div>
              <div style={{ fontSize: ".64rem", color: "var(--pb-muted)", marginTop: 2, lineHeight: 1.4 }}>{m.note}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* The cover silhouette list — what shape the cover is, in the same words on
   desktop and phone. */
function CoverLayoutList({ layoutKey, setLayoutKey }) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      {LAYOUTS.map((l) => (
        <button key={l.key} onClick={() => setLayoutKey(l.key)}
          style={{ cursor: "pointer", textAlign: "left", fontFamily: "inherit", background: l.key === layoutKey ? "var(--pb-surface-2)" : "transparent", border: "1px solid " + (l.key === layoutKey ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 8, padding: "7px 10px" }}>
          <span style={{ display: "block", fontSize: ".72rem", fontWeight: l.key === layoutKey ? 700 : 500, color: "var(--pb-ink)" }}>{l.name}</span>
          <span style={{ display: "block", fontSize: ".62rem", color: "var(--pb-muted)", marginTop: 2 }}>{l.desc}</span>
        </button>
      ))}
    </div>
  );
}

/* Which photo goes on the cover. Every photo already in the book is a candidate —
   you shouldn't have to re-upload a shot that's already on page 12. */
function CoverPhotoPicker({ spreads, layoutKey, coverImg, size }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lay = layoutFor(layoutKey);
  const usesPhoto = lay.photo !== "none";
  const pool = [];
  const seen = new Set();
  for (const s of spreads || []) for (const p of s.photos || []) if (p && p.url && !seen.has(p.url)) { seen.add(p.url); pool.push(p); }

  const onFile = async (e) => {
    const f = (e.target.files || [])[0];
    e.target.value = "";
    if (!f) return;
    setError(null); setBusy(true);
    try { setCoverPick(await uploadBookPhoto(f)); }
    catch (err) { setError((err && err.message) || "Couldn't add that photo."); }
    setBusy(false);
  };
  if (!usesPhoto) {
    return (
      <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", lineHeight: 1.5, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "11px 12px" }}>
        This cover is type only — no photo prints on it. Pick a photo layout above to choose one.
      </div>
    );
  }
  const inches = slotInches(size.trim, 1, lay.photo === "full");
  const picked = pool.find((p) => p.url === coverImg);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
        {pool.map((p) => (
          <button key={p.url} onClick={() => setCoverPick(p)} aria-label="Use this photo on the cover"
            style={{ cursor: "pointer", padding: 0, aspectRatio: "3/4", borderRadius: 6, overflow: "hidden", border: "2px solid " + (p.url === coverImg ? "var(--pb-gold)" : "var(--pb-line)"), background: `center/cover url(${p.url})` }} />
        ))}
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}
          style={{ cursor: busy ? "default" : "pointer", aspectRatio: "3/4", borderRadius: 6, border: "1px dashed var(--pb-line-strong)", background: "transparent", color: "var(--pb-muted)", fontFamily: mono, fontSize: ".55rem", lineHeight: 1.3 }}>{busy ? "…" : <>＋<br />Upload</>}</button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} style={{ display: "none" }} />
      {/* The cover is the biggest thing we print, so it's where thin resolution shows first. */}
      {picked && <div style={{ marginTop: 8 }}><ResBadge rec={picked} inches={inches} /></div>}
      {error && <div style={{ fontSize: ".66rem", color: "var(--pb-avoid)", marginTop: 8, lineHeight: 1.4 }}>{error}</div>}
      <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", marginTop: 8, lineHeight: 1.5 }}>
        {pool.length === 0
          ? "No photos in the book yet — upload one, or add photos to a stop and they'll show up here."
          : getCoverPick() ? "This is your cover photo." : "Using the first photo in your book until you pick one."}
      </div>
    </>
  );
}

/* What this photo will actually look like in ink, at the size it's printed.
   A photo with no `path` predates print storage — we only ever kept a 1280px copy of
   it, so we say that rather than quietly measuring the thumbnail and calling it fine. */
function ResBadge({ rec, inches }) {
  if (!rec) return null;
  if (!rec.path || !rec.w) {
    return <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".04em", color: "var(--pb-prepare)" }}>Added before print storage — re-add it to print sharp.</div>;
  }
  const v = resVerdict(rec.w, inches);
  const tone = v.level === "ok" ? "var(--pb-go)" : v.level === "soft" ? "var(--pb-prepare)" : "var(--pb-avoid)";
  return (
    <div>
      <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".06em", color: tone }}>{v.label}</span>
      <span style={{ fontSize: ".64rem", color: "var(--pb-muted)", marginLeft: 6 }}>{v.note}</span>
    </div>
  );
}

/* Cover tools — the cover is a page of the book, so it's composed in step 1
   alongside every other page, not left to be inferred from the theme. */
function CoverTools({ spreads, layoutKey, setLayoutKey, coverImg, size, onNext }) {
  useLayoutTick();
  const cap = { fontFamily: mono, fontSize: ".46rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginBottom: 7 };
  return (
    <aside className="bs-rail" style={{ borderLeft: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
      <Eyebrow>Cover Tools</Eyebrow>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", margin: "6px 0 18px" }}>Design your cover</h3>
      <div style={cap}>Cover layout</div>
      <CoverLayoutList layoutKey={layoutKey} setLayoutKey={setLayoutKey} />
      <div style={{ ...cap, marginTop: 18 }}>Cover photo</div>
      <CoverPhotoPicker spreads={spreads} layoutKey={layoutKey} coverImg={coverImg} size={size} />
      <button onClick={onNext} style={{ cursor: "pointer", width: "100%", marginTop: 22, fontFamily: "inherit", fontSize: ".85rem", fontWeight: 700, color: "#14210f", background: "var(--pb-gold)", border: "none", borderRadius: 10, padding: "12px" }}>Next: Theme →</button>
    </aside>
  );
}

/* The photos on this chapter, in the order they fill the spread — so "which photo is
   on the left page" is something you can see and change, not deduce. */
function PhotoStrip({ spread, size }) {
  const ready = useLayoutTick();
  const lay = layoutOf(spread, ready);
  const photos = spread.photos || [];
  const need = photosNeeded(lay);

  // Each photo slot in fill order → which pane it's on and how wide it prints there.
  // Width by arrangement: 2×2 and the two small cells of a 3-up are half-page; a
  // stacked cell and the big cell of a 3-up are full width.
  const wIn = (parseInt(String(size.trim).slice(0, 4), 10) || 850) / 100;
  const widthFrac = (count, idx) => (count >= 4 ? 0.5 : count === 3 ? (idx === 0 ? 1 : 0.5) : 1);
  const photoSlots = [];
  [["left", "Left"], ["right", "Right"]].forEach(([key, label]) => {
    const count = lay[key].length;
    lay[key].forEach((s, idx) => { if (s.type === "photo") photoSlots.push({ page: label, inches: wIn * widthFrac(count, idx) }); });
  });
  const slotOf = (i) => photoSlots[i] || null;
  if (!photos.length) {
    return <div style={{ fontSize: ".7rem", color: "var(--pb-muted)", lineHeight: 1.5 }}>No photos on this chapter yet.{need ? ` This layout prints ${need}.` : ""}</div>;
  }
  const last = photos.length - 1;
  const mv = { cursor: "pointer", width: 20, height: 18, fontFamily: "inherit", fontSize: ".7rem", lineHeight: 1, color: "var(--pb-ink-2)", background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 5, padding: 0 };
  const mvOff = { ...mv, cursor: "default", color: "var(--pb-line-strong)", opacity: 0.5 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {photos.map((p, i) => {
        const slot = slotOf(i);
        // The row's number IS the slot it fills — the same ① ② … on the book page.
        return (
          <div key={(p.url || "stamp") + i} style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: slot ? 1 : 0.5 }}>
            <div aria-hidden style={{ position: "relative", flex: "0 0 38px", height: 48, borderRadius: 4, border: "1px solid var(--pb-line)", background: p.url ? `center/cover url(${p.url})` : "var(--pb-tint)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pb-muted)" }}>
              {!p.url && p.stamp && "⌖"}
              {slot && <SlotNum n={i + 1} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: mono, fontSize: ".46rem", letterSpacing: ".1em", textTransform: "uppercase", color: slot ? "var(--pb-gold-soft)" : "var(--pb-muted)" }}>
                {slot ? `${slotGlyph(i + 1)} ${slot.page} page` : "Not printed — no slot in this layout"}
              </div>
              {slot && <div style={{ marginTop: 3 }}>
                {p.stamp
                  ? <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".04em", color: "var(--pb-ink-2)" }}>⌖ Location stamp · {fmtCoord(p.stamp.lat, p.stamp.lng) || "no coords"}</span>
                  : <ResBadge rec={p} inches={slot.inches} />}
              </div>}
            </div>
            {/* Reorder = re-slot: move a photo up/down to change which ① ② … it fills. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "0 0 auto" }}>
              <button onClick={() => movePhotoIn(spread, i, i - 1)} disabled={i === 0} aria-label="Move earlier" style={i === 0 ? mvOff : mv}>↑</button>
              <button onClick={() => movePhotoIn(spread, i, i + 1)} disabled={i === last} aria-label="Move later" style={i === last ? mvOff : mv}>↓</button>
            </div>
            <button onClick={() => removePhotoFrom(spread, i)} aria-label="Remove this photo"
              style={{ cursor: "pointer", flex: "0 0 auto", fontFamily: "inherit", fontSize: ".7rem", color: "var(--pb-muted)", background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 6, padding: "2px 7px", alignSelf: "center" }}>✕</button>
          </div>
        );
      })}
      {need > 0 && photos.length > need && (
        <div style={{ fontSize: ".64rem", color: "var(--pb-prepare)", lineHeight: 1.45, marginTop: 2 }}>
          This layout prints {need}. The extra {photos.length - need} won&rsquo;t print — reorder to choose which do, or remove them.
        </div>
      )}
    </div>
  );
}

// Remove by position, so what you click in the strip is what leaves the page.
function removePhotoFrom(spread, i) {
  if (spread.source === "own") {
    const next = (spread.photos || []).filter((_, k) => k !== i);
    updateExtra(spread.id, { photos: next });
  } else {
    const list = getPhotosFor(spread.name) || [];
    const target = list[i];
    if (target && target.id) removePhoto(spread.name, target.id);
  }
}
// Move a photo between slots — book-only pages reorder their own array; itinerary
// chapters reorder in Trip Mode. Either way the preview re-renders into the new slots.
function movePhotoIn(spread, from, to) {
  if (spread.source === "own") {
    const list = [...(spread.photos || [])];
    if (to < 0 || to >= list.length) return;
    const [it] = list.splice(from, 1); list.splice(to, 0, it);
    updateExtra(spread.id, { photos: list });
  } else {
    movePhoto(spread.name, from, to);
  }
}

// (Story is written directly on the book now — see InlineStory. Stop Tools Step 3
// points there instead of carrying its own editors.)

// Attach a location stamp as a photo, letting the user choose the spot: this stop's
// own coordinates, or their current location.
function StampAdder({ spread }) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const hasStop = spread.lat != null && spread.lng != null;
  const stopCoord = fmtCoord(spread.lat, spread.lng);
  const addStop = () => { addStampTo(spread, { lat: spread.lat, lng: spread.lng, label: spread.name }); setOpen(false); };
  const addHere = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); setOpen(false); addStampTo(spread, { lat: p.coords.latitude, lng: p.coords.longitude, label: spread.name }); },
      () => setLocating(false), { enableHighAccuracy: true, timeout: 15000 });
  };
  const opt = { cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit", fontSize: ".76rem", color: "var(--pb-ink)", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 8, padding: "8px 11px" };
  return (
    <div style={{ marginTop: 8 }}>
      <button className="bs-btn" onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", width: "100%", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)", background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 14px" }}>⌖ Add a location stamp</button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {hasStop && <button onClick={addStop} style={opt}>This stop&rsquo;s spot<span style={{ display: "block", fontFamily: mono, fontSize: ".5rem", color: "var(--pb-muted)", marginTop: 2 }}>{stopCoord}</span></button>}
          <button onClick={addHere} style={opt}>{locating ? "locating…" : "My current location"}</button>
          <div style={{ fontSize: ".64rem", color: "var(--pb-muted)", lineHeight: 1.45 }}>A map of the spot with a pin, added as a photo — the coordinates print beneath it.</div>
        </div>
      )}
    </div>
  );
}

function StopTools({ spread, onNext, size, onAddPage }) {
  useLayoutTick();
  const [dist, setDist] = useState(null);
  const [locating, setLocating] = useState(false);
  // Multiple at once — a spread can want up to 8 photos across both pages.
  const { fileRef, onFile, busy, error, open } = useAddPhotos(spread);

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
  // Open the same Ask Park Buddy assistant the header launches (its floating button).
  const openAsk = () => { const f = document.querySelector(".pbask-fab, #askPill"); if (f) f.click(); else window.location.href = "/#ask"; };
  const btn = { cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)", background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" };
  const lay = layoutOf(spread, true);
  const need = photosNeeded(lay);
  const have = (spread.photos || []).length;
  const stepCap = { fontFamily: mono, fontSize: ".5rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-gold-soft)", display: "flex", alignItems: "center", gap: 7 };
  const stepDot = { flex: "0 0 auto", width: 16, height: 16, borderRadius: "50%", background: "var(--pb-gold)", color: "#14210f", fontSize: ".58rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
  const hint = { fontSize: ".72rem", color: "var(--pb-muted)", lineHeight: 1.5, margin: "5px 0 10px" };
  return (
    <aside className="bs-rail" style={{ borderLeft: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
      <Eyebrow>Stop Tools</Eyebrow>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", margin: "6px 0 4px" }}>{spread.name}</h3>
      <p style={{ ...hint, marginTop: 0, marginBottom: 18 }}>Build this chapter in three steps — everything shows on the book as you go.</p>

      {/* STEP 1 — the page layout: it decides how many photo slots there are, so it
          comes before the photos that fill them. */}
      <div style={stepCap}><span style={stepDot}>1</span> Choose the layout</div>
      <p style={hint}>Split each page into up to 4 sections. Make each one a <b>photo</b> or a bit of <b>writing</b> — mix them however you like.</p>
      <LayoutPicker
        value={getStopLayout(spread.name) || getDefaultLayout()}
        onChange={(p) => setStopLayout(spread.name, p)}
        onReset={() => clearStopLayout(spread.name)}
        isOverride={!!getStopLayout(spread.name)}
      />
      <div style={{ height: 16 }} />
      <MarginPicker />

      {/* STEP 2 — the photos for those slots, numbered to match the book, reorderable. */}
      <div style={{ ...stepCap, marginTop: 24 }}><span style={stepDot}>2</span> Add your photos {need ? `(${Math.min(have, need)}/${need})` : ""}</div>
      <p style={hint}>{need ? `This layout holds ${need} photo${need > 1 ? "s" : ""}. ` : ""}The numbers ① ② match the slots on the book — use the arrows to reorder.</p>
      <button className="bs-btn" style={{ ...btn, width: "100%", opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={open}>
        {busy ? `Adding ${busy} photo${busy === 1 ? "" : "s"}…` : need && have < need ? `＋ Add ${need - have} more photo${need - have === 1 ? "" : "s"}` : "＋ Add photos"}
      </button>
      <PhotoInput fileRef={fileRef} onFile={onFile} />
      {error && <div style={{ fontSize: ".7rem", color: "var(--pb-avoid)", marginTop: 7, lineHeight: 1.45 }}>{error}</div>}
      <StampAdder spread={spread} />
      <div style={{ height: 12 }} />
      <PhotoStrip spread={spread} size={size} />

      {/* STEP 3 — the words. No editor here: you write straight onto the book. */}
      <div style={{ ...stepCap, marginTop: 24 }}><span style={stepDot}>3</span> Write the story</div>
      <p style={hint}>Write it on the book — click any writing section on the page and type. It saves as you go.</p>
      <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "13px 14px" }}>
        <div style={{ fontSize: ".78rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>Want a hand with the words? <b>Ask Park Buddy</b> to draft or polish your story.</div>
        <button onClick={openAsk} style={{ cursor: "pointer", width: "100%", marginTop: 10, fontFamily: "inherit", fontSize: ".82rem", fontWeight: 700, color: "#14210f", background: "var(--pb-grad-gold)", border: "none", borderRadius: 10, padding: "10px" }}>✦ Ask Park Buddy</button>
      </div>

      {/* Where this stop was — a quiet footnote, not the headline it used to be. */}
      <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "12px 14px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Location</span>
          <button onClick={locate} style={{ cursor: "pointer", fontFamily: mono, fontSize: ".5rem", letterSpacing: ".06em", border: "1px solid " + (dist != null ? "var(--pb-go)" : "var(--pb-line-strong)"), color: dist != null ? "var(--pb-go)" : "var(--pb-ink-2)", background: dist != null ? "rgba(79,217,138,.08)" : "transparent", borderRadius: 999, padding: "3px 9px" }}>
            {locating ? "locating…" : dist != null ? (dist < 10 ? dist.toFixed(1) : Math.round(dist)) + " mi away" : "Use my location"}
          </button>
        </div>
        <div style={{ fontFamily: mono, fontSize: ".82rem", color: "var(--pb-ink)", marginTop: 6 }}>{coord || "—"}</div>
      </div>

      {onNext && (
        <button onClick={onNext} style={{ cursor: "pointer", width: "100%", marginTop: 24, fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: GOLD, border: "none", borderRadius: 12, padding: "13px" }}>Next: Theme →</button>
      )}
    </aside>
  );
}

function ThemeDesktop({ book, spreads, layout, setLayoutKey, pal, setPal, palette, price, priceNum, pages, setStep, role, setRole, size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, customBase, setCustomBase, pickTheme, coverImg }) {
  useLayoutTick();
  const reader = role === "reader";
  return (
    <div style={{ display: "grid", gridTemplateColumns: reader ? "1fr" : "300px 1fr 320px", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {!reader && (
        <aside className="bs-rail" style={{ borderRight: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
          {/* The cover's layout and photo are composed in step 1 with every other
              page; this step is the book's look and materials. Picking a theme still
              moves the cover to the silhouette it was designed around. */}
          <div style={{ marginTop: 0 }}>
            <ThemeCards pal={pal} pickTheme={pickTheme} />
            <CustomColor pal={pal} setPal={setPal} customBase={customBase} setCustomBase={setCustomBase} />
          </div>
          <div style={{ marginTop: 24 }}>
            <FormatPicker size={size} sizeKey={sizeKey} setSizeKey={setSizeKey} cover={cover} coverKey={coverKey} setCoverKey={setCoverKey} finish={finish} finishKey={finishKey} setFinishKey={setFinishKey} />
          </div>
          {/* Page layout AND margins are chosen per chapter in Diary → Stop Tools.
              This step is the book's look and materials. */}
        </aside>
      )}
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 30px" }}>
        <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" coverImg={coverImg} cover={cover} finish={finish} size={size} />
      </main>
      {!reader && (
        <aside className="bs-rail" style={{ borderLeft: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
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
function BookPage({ pv, n, spreads, book, palette, layout, coverImg, cover, finish, size, starts }) {
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
  if (pv >= 2 && pv - 2 < n) return <Spread spread={spreads[pv - 2]} startPage={(starts || [])[pv - 2] || 3} size={size} />;
  return (
    <div style={{ width: 460, maxWidth: "100%", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 10, boxShadow: "var(--pb-shadow)", padding: "56px 40px", textAlign: "center" }}>
      <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: "1.5rem", color: "var(--pb-ink)" }}>Adventure&rsquo;s better with a Buddy.</div>
      <div style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", color: "var(--pb-gold)", display: "flex", alignItems: "center", justifyContent: "center", margin: "22px auto 0" }}>✦</div>
      <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 22 }}>The Park Buddy · parkbuddy.app</div>
    </div>
  );
}

function PreviewDesktop({ book, spreads, sel, setSel, cur, n, prev, next, palette, layout, pages, price, openReserve, role, size, cover, finish, starts, coverImg }) {
  const reader = role === "reader";
  const [pv, setPv] = useState(0); // 0 cover · 1 intro · 2..n+1 stops · n+2 final
  const total = n + 3;
  const toc = [["Cover", "—"], ["Introduction", "02"], ...spreads.map((s, i) => [s.name, String((starts || [])[i] || 3).padStart(2, "0")]), ["Final Page", String(pages).padStart(2, "0")]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: reader ? "1fr" : "300px 1fr 320px", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {!reader && (
        <aside className="bs-rail" style={{ borderRight: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
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
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", padding: "40px 30px", overflowY: "auto" }}>
        <BookPage pv={pv} n={n} spreads={spreads} book={book} palette={palette} layout={layout} coverImg={coverImg} cover={cover} finish={finish} size={size} starts={starts} />
        <Pager i={pv} n={total} onPrev={() => setPv((p) => (p - 1 + total) % total)} onNext={() => setPv((p) => (p + 1) % total)} dots />
      </main>
      {!reader && (
        <aside className="bs-rail" style={{ borderLeft: "1px solid var(--pb-line)", padding: "22px 18px", overflowY: "auto" }}>
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
  const { step, setStep, role, setRole, spreads, sel, setSel, cur, n, prev, next, book, layout, setLayoutKey, pal, setPal, palette, pages, price, openReserve, mobilePage, setMobilePage, toolsOpen, setToolsOpen, openManage, size, sizeKey, setSizeKey, cover, coverKey, setCoverKey, finish, finishKey, setFinishKey, customBase, setCustomBase, pickTheme, coverImg } = props;
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
                  <button onClick={() => setSel(-1)} style={{ flex: "0 0 46%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: sel === -1 ? "var(--pb-surface-2)" : "var(--pb-surface)", border: "1px solid " + (sel === -1 ? "var(--pb-gold-2)" : "var(--pb-line)"), borderRadius: 10, padding: "9px 11px" }}>
                    <div style={{ fontFamily: mono, fontSize: ".46rem", color: "var(--pb-muted)" }}>COVER</div>
                    <div style={{ fontWeight: 600, fontSize: ".8rem", color: "var(--pb-ink)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Front cover</div>
                  </button>
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
                {sel !== -1 && (
                  <div style={{ display: "flex", background: "var(--pb-tint)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: 3, marginBottom: 14 }}>
                    {[["photo", "Photo Spread"], ["story", "Story Text"]].map(([k, l]) => (
                      <button key={k} onClick={() => setMobilePage(k)} style={{ flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: mobilePage === k ? 700 : 500, border: "none", borderRadius: 8, padding: "8px", background: mobilePage === k ? "var(--pb-surface)" : "transparent", color: mobilePage === k ? "var(--pb-ink)" : "var(--pb-muted)" }}>{l}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              {sel === -1
                ? <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" coverImg={coverImg} cover={cover} finish={finish} size={size} />
                : mobilePage === "photo" || role === "reader"
                  ? <div style={{ aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: "1px solid var(--pb-line)" }}><SpreadPhoto spread={cur} rounded={false} /></div>
                  : <div style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: 18 }}><SpreadStory spread={cur} /></div>}
            </div>
            {role === "author" && (
              <div style={{ maxWidth: 460, margin: "14px auto 0", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, overflow: "hidden" }}>
                <button onClick={() => setToolsOpen((v) => !v)} style={{ width: "100%", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "none", border: "none" }}>
                  <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{sel === -1 ? "Cover Tools" : `Stop Tools · ${fmtCoord(cur.lat, cur.lng) || "—"}`}</span>
                  <span style={{ color: "var(--pb-ink-2)" }}>{toolsOpen ? "▾" : "▸"}</span>
                </button>
                {toolsOpen && (
                  <div style={{ padding: "0 14px 14px" }}>
                    {sel === -1 ? (
                      <>
                        <Eyebrow>Cover layout</Eyebrow>
                        <div style={{ height: 8 }} />
                        <CoverLayoutList layoutKey={layout.key} setLayoutKey={setLayoutKey} />
                        <div style={{ height: 14 }} />
                        <Eyebrow>Cover photo</Eyebrow>
                        <div style={{ height: 8 }} />
                        <CoverPhotoPicker spreads={spreads} layoutKey={layout.key} coverImg={coverImg} size={size} />
                      </>
                    ) : <MobileStopTools spread={cur} />}
                  </div>
                )}
              </div>
            )}
            <Pager i={sel + 1} n={n + 1} label={sel === -1 ? "Front cover" : cur.name} onPrev={prev} onNext={next} />
          </>
        )}

        {step === "theme" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 20px" }}>
              <CoverPreview title={book.title} author={book.author} region={book.region} layout={layout} palette={palette} dateLabel="" coverImg={coverImg} cover={cover} finish={finish} size={size} />
            </div>
            <ThemeCards pal={pal} pickTheme={pickTheme} />
            <CustomColor pal={pal} setPal={setPal} customBase={customBase} setCustomBase={setCustomBase} />
            <div style={{ height: 22 }} />
            <FormatPicker size={size} sizeKey={sizeKey} setSizeKey={setSizeKey} cover={cover} coverKey={coverKey} setCoverKey={setCoverKey} finish={finish} finishKey={finishKey} setFinishKey={setFinishKey} />
            <div style={{ height: 22 }} />
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
  const { fileRef, onFile, busy, error, open } = useAddPhotos(spread);
  useEffect(() => { setDraft(spread.story || ""); setEditing(false); }, [spread.name]);
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
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} onClick={() => setEditing(true)}>✎ Edit Story</button>
        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={open}>{busy ? "Adding…" : "＋ Photos"}</button>
        <PhotoInput fileRef={fileRef} onFile={onFile} />
      </div>
      {error && <div style={{ fontSize: ".7rem", color: "var(--pb-avoid)", marginTop: 7, lineHeight: 1.45 }}>{error}</div>}
    </>
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setError(null); setBusy(true);
    const recs = [];
    let failed = null;
    for (const f of files) {
      try { recs.push(await uploadBookPhoto(f)); }
      catch (err) { failed = (err && err.message) || "Couldn't add that photo."; }
    }
    setPending((p) => [...p, ...recs]);
    setBusy(false);
    if (failed) setError(failed);
  };
  const add = () => {
    const nm = name.trim(); if (!nm) return;
    try { addExtra({ name: nm, photos: pending }); setName(""); setPending([]); setError(null); }
    catch (err) { setError(err && err.name === "QuotaError" ? "Your browser's storage is full — remove a photo and try again." : "Couldn't add that page."); }
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
            <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} style={{ ...iconBtn, width: "auto", padding: "0 12px" }}>{busy ? "…" : pending.length ? `✓ ${pending.length}` : "＋ Photos"}</button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFile} style={{ display: "none" }} />
          </div>
          {error && <div style={{ fontSize: ".76rem", color: "var(--pb-avoid)", marginTop: 8, lineHeight: 1.45 }}>{error}</div>}
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
