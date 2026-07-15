"use client";

// Park Buddy — apparel storefront ("Expedition Premium"). Ported 1:1 from the Claude
// Design handoff (design_handoff_park_buddy_storefront): dark charcoal + brass, animated
// rotating-tribe hero, embossed trail crests, Shop by Tribe, Family sets, the Duck Pond
// capsule, New Drops grid, brand promise, newsletter, footer. Theme-aware (dark default),
// visual cart (toast) — no real checkout. All art is inline SVG (no external requests).

import { useEffect, useRef, useState } from "react";

// ---- content (from the handoff's Component class) --------------------------------------
const HERO_TRIBES = [
  { name: "National Park Fans", emblem: "compass", color: "#dcb968" },
  { name: "Jeepers", emblem: "grille", color: "#dcb968" },
  { name: "Overlanders", emblem: "rig", color: "#cdbfa2" },
  { name: "Hikers", emblem: "boot", color: "#9ba492" },
  { name: "Mountain Bikers", emblem: "bike", color: "#dcb968" },
  { name: "ATV / UTV", emblem: "quad", color: "#c9823f" },
  { name: "Surfers", emblem: "wave", color: "#9ba492" },
];
const TRUST = [
  ["01 · BUILT TO LAST", "Trail-tested", "Durable prints and stitching made to survive the backcountry."],
  ["02 · PREMIUM BLANKS", "Heavyweight cotton", "Dense, structured blanks that hold shape wash after wash."],
  ["03 · SHIPS WORLDWIDE", "Every port", "Tracked delivery to the trailhead, wherever it is."],
  ["04 · IN-HOUSE ART", "Original crests", "Drawn by our own studio — tied to real, runnable trails."],
];
const TRAILS = [
  { name: "Rubicon", slug: "rubicon", region: "SIERRA NEVADA · CA", terrain: "summit", length: "22 MI", rating: "10", coords: "38.9976°N 120.3103°W" },
  { name: "Black Bear Pass", slug: "blackbear", region: "SAN JUAN MTNS · CO", terrain: "switchbacks", length: "12 MI", rating: "9", coords: "37.8930°N 107.7020°W" },
  { name: "Hell's Revenge", slug: "hells", region: "MOAB · UT", terrain: "slickrock", length: "6.5 MI", rating: "8", coords: "38.5730°N 109.5498°W" },
  { name: "Poison Spider", slug: "poison", region: "MOAB · UT", terrain: "mesa", length: "16 MI", rating: "8", coords: "38.5410°N 109.6360°W" },
  { name: "Rausch Creek", slug: "rausch", region: "APPALACHIA · PA", terrain: "creek", length: "20+ MI", rating: "6", coords: "40.6120°N 76.5480°W" },
  { name: "Fordyce Creek", slug: "fordyce", region: "SIERRA NEVADA · CA", terrain: "creek", length: "13 MI", rating: "9", coords: "39.3560°N 120.5100°W" },
];
const TRIBES = [
  { name: "Hikers", emblem: "boot", tag: "Miles over everything.", code: "TR-01" },
  { name: "Mountain Bikers", emblem: "bike", tag: "Earn the descent.", code: "TR-02" },
  { name: "Jeepers", emblem: "grille", tag: "Seven slots, no chill.", code: "TR-03" },
  { name: "Overlanders", emblem: "rig", tag: "Home is where you park it.", code: "TR-04" },
  { name: "ATV / UTV", emblem: "quad", tag: "Throttle therapy.", code: "TR-05" },
  { name: "Surfers", emblem: "wave", tag: "Salt in the seams.", code: "TR-06" },
];
const PERSONAS = [
  ["SOLO", "One rider, one badge", "Build a personal trophy case. Every trail you clear earns a crest worth wearing home."],
  ["COUPLES", "Two-up matching", "Co-driver approved. Matching tees and hoodies for the pair who navigate as one."],
  ["FAMILY", "The whole crew", "Newborn to grandparent — one crest, every size, so nobody rides unbadged."],
];
const FAMILY = [
  { label: "Newborn", sub: "Onesie", garment: "onesie", px: 58 },
  { label: "Toddler", sub: "2T–4T", garment: "tee", px: 72 },
  { label: "Youth", sub: "S–XL", garment: "tee", px: 86 },
  { label: "Adult", sub: "S–3XL", garment: "tee", px: 104 },
  { label: "Adult", sub: "Hoodie", garment: "hoodie", px: 112 },
];
const DUCKS = [
  { name: "Been Ducked? Duck Back", tag: "STICKER PACK", price: "12" },
  { name: "Certified Duck Dropper", tag: "TEE", price: "34" },
  { name: "Nice Rig — Have a Duck", tag: "TEE", price: "34" },
  { name: "The Duck Pond Patch", tag: "PATCH", price: "10" },
];
const PRODUCTS = [
  { name: "Rubicon Badge Tee", tag: "TRAIL SERIES", price: "38", garment: "tee", emblem: "summit" },
  { name: "Jeepers Grille Hoodie", tag: "TRIBE", price: "64", garment: "hoodie", emblem: "grille" },
  { name: "Overland Rig Tee", tag: "TRIBE", price: "38", garment: "tee", emblem: "rig" },
  { name: '"Been Ducked?" Tee', tag: "DUCK POND", price: "36", garment: "tee", emblem: "duck" },
  { name: "Trailhead Family Set", tag: "FAMILY", price: "120", garment: "tee", emblem: "summit" },
  { name: "Summit Hikers Hoodie", tag: "TRIBE", price: "64", garment: "hoodie", emblem: "boot" },
  { name: "Hell's Revenge Tee", tag: "TRAIL SERIES", price: "38", garment: "tee", emblem: "slickrock" },
  { name: "Salt & Sand Surf Tee", tag: "TRIBE", price: "36", garment: "tee", emblem: "wave" },
];

// Inline SVG symbol sheet (defs + all motifs) — enables <use href="#id"> throughout.
const SYMBOLS = `
<linearGradient id="brassGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecd696"/><stop offset="0.5" stop-color="#c9a24b"/><stop offset="1" stop-color="#a97f31"/></linearGradient>
<radialGradient id="crestSheen" cx="34%" cy="26%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<path id="topoLine" d="M-80 320 C 180 218 360 424 600 300 C 828 190 1030 402 1290 296" fill="none"/>
<symbol id="summit" viewBox="0 0 100 100"><path d="M4 84 L30 32 L45 58 L59 20 L96 84 Z" fill="currentColor"/><path d="M53 32 L59 20 L68 40 L61 37 L56 41 Z" fill="#fff" opacity="0.85"/><path d="M22 51 L30 32 L39 51 L32 48 L27 52 Z" fill="#fff" opacity="0.7"/></symbol>
<symbol id="switchbacks" viewBox="0 0 100 100"><path d="M16 88 L84 88 L84 66 L28 66 L28 46 L84 46 L84 26 L44 26 L44 12" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="slickrock" viewBox="0 0 100 100"><path d="M2 86 Q22 40 42 60 Q56 30 72 58 Q84 42 98 86 Z" fill="currentColor"/><path d="M2 86 Q22 40 42 60" fill="none" stroke="#000" stroke-width="1.6" opacity="0.18"/><path d="M42 60 Q56 30 72 58" fill="none" stroke="#000" stroke-width="1.6" opacity="0.18"/></symbol>
<symbol id="mesa" viewBox="0 0 100 100"><path d="M12 88 L12 48 L26 40 L74 40 L88 50 L88 88 Z" fill="currentColor"/><path d="M28 40 L28 88 M72 40 L72 88" stroke="#000" stroke-width="1.6" opacity="0.16"/></symbol>
<symbol id="creek" viewBox="0 0 100 100"><path d="M4 50 Q22 40 40 50 T76 50 T112 50" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M4 66 Q22 56 40 66 T76 66 T112 66" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity="0.65"/><path d="M20 34 L26 18 L32 34 Z M62 34 L68 18 L74 34 Z" fill="currentColor" opacity="0.85"/></symbol>
<symbol id="boot" viewBox="0 0 100 100"><path d="M30 16 L48 16 L52 56 L82 66 Q90 68 90 78 L90 84 L18 84 Q14 84 14 80 L14 30 Q14 20 24 18 Z" fill="currentColor"/><path d="M52 60 L82 68" stroke="#000" stroke-width="2.4" opacity="0.2"/><circle cx="30" cy="30" r="2.2" fill="#000" opacity="0.3"/><circle cx="30" cy="40" r="2.2" fill="#000" opacity="0.3"/><circle cx="30" cy="50" r="2.2" fill="#000" opacity="0.3"/></symbol>
<symbol id="bike" viewBox="0 0 100 100"><circle cx="26" cy="66" r="18" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="74" cy="66" r="18" fill="none" stroke="currentColor" stroke-width="5"/><path d="M26 66 L48 66 L62 40 L74 66 M48 66 L60 40" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="M40 40 L62 40" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></symbol>
<symbol id="grille" viewBox="0 0 100 100"><rect x="16" y="26" width="68" height="48" rx="9" fill="none" stroke="currentColor" stroke-width="5"/><g fill="currentColor"><rect x="35" y="34" width="3" height="32" rx="1.5"/><rect x="40.7" y="34" width="3" height="32" rx="1.5"/><rect x="46.3" y="34" width="3" height="32" rx="1.5"/><rect x="52" y="34" width="3" height="32" rx="1.5"/><rect x="57.7" y="34" width="3" height="32" rx="1.5"/><rect x="63.3" y="34" width="3" height="32" rx="1.5"/><rect x="69" y="34" width="3" height="32" rx="1.5"/></g><circle cx="26" cy="50" r="5.4" fill="currentColor"/><circle cx="74" cy="50" r="5.4" fill="currentColor"/></symbol>
<symbol id="rig" viewBox="0 0 100 100"><path d="M10 46 L28 46 L36 34 L74 34 L84 46 L92 48 L92 64 L8 64 L8 50 Z" fill="currentColor"/><path d="M24 34 L30 22 L70 22 L76 34 Z" fill="currentColor" opacity="0.82"/><circle cx="30" cy="66" r="9.5" fill="currentColor"/><circle cx="72" cy="66" r="9.5" fill="currentColor"/><circle cx="30" cy="66" r="3.6" fill="#000" opacity="0.3"/><circle cx="72" cy="66" r="3.6" fill="#000" opacity="0.3"/></symbol>
<symbol id="quad" viewBox="0 0 100 100"><path d="M22 46 L40 40 L62 40 L76 48 L82 48 L82 56 L18 56 L18 48 Z" fill="currentColor"/><path d="M60 40 L70 30 L80 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="64" r="12" fill="currentColor"/><circle cx="72" cy="64" r="12" fill="currentColor"/><circle cx="30" cy="64" r="4.4" fill="#000" opacity="0.3"/><circle cx="72" cy="64" r="4.4" fill="#000" opacity="0.3"/></symbol>
<symbol id="wave" viewBox="0 0 100 100"><path d="M10 62 Q24 18 54 38 Q78 54 58 66 Q46 72 46 60 Q60 62 62 52 Q58 40 44 44 Q26 50 28 66 Z" fill="currentColor"/><path d="M8 80 Q30 73 50 80 T92 80" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.55"/></symbol>
<symbol id="tee" viewBox="0 0 100 100"><path d="M36 15 L20 25 L11 40 L24 49 L28 45 L28 87 L72 87 L72 45 L76 49 L89 40 L80 25 L64 15 Q50 27 36 15 Z" fill="currentColor"/></symbol>
<symbol id="hoodie" viewBox="0 0 100 100"><path d="M36 20 L20 30 L11 46 L24 55 L28 51 L28 89 L72 89 L72 51 L76 55 L89 46 L80 30 L64 20 Z" fill="currentColor"/><path d="M36 20 Q50 36 64 20 Q60 8 50 8 Q40 8 36 20 Z" fill="currentColor"/><path d="M42 55 L58 55 L60 74 L40 74 Z" fill="#000" opacity="0.18"/><path d="M46 22 L46 33 M54 22 L54 33" stroke="#000" stroke-width="2.2" opacity="0.32" stroke-linecap="round"/></symbol>
<symbol id="onesie" viewBox="0 0 100 100"><path d="M38 22 L26 30 L18 44 L30 51 L34 47 L34 68 Q34 74 40 74 L45 74 L45 61 L55 61 L55 74 L60 74 Q66 74 66 68 L66 47 L70 51 L82 44 L74 30 L62 22 Q50 32 38 22 Z" fill="currentColor"/><circle cx="50" cy="56" r="1.8" fill="#000" opacity="0.3"/><circle cx="50" cy="63" r="1.8" fill="#000" opacity="0.3"/></symbol>
<symbol id="duck" viewBox="0 0 100 100"><path d="M78 56 Q92 52 88 70 Q80 74 72 66 Z" fill="currentColor"/><ellipse cx="52" cy="64" rx="32" ry="21" fill="currentColor"/><circle cx="33" cy="43" r="17" fill="currentColor"/><path d="M18 43 L3 47 L18 52 Z" fill="#b0692a"/><circle cx="30" cy="39" r="3.1" fill="#12211a"/><path d="M46 62 Q64 57 70 70 Q58 76 46 70 Z" fill="#000" opacity="0.12"/></symbol>
<symbol id="pack" viewBox="0 0 100 100"><path d="M32 34 Q32 16 50 16 Q68 16 68 34" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><rect x="22" y="30" width="56" height="54" rx="13" fill="currentColor"/><rect x="35" y="46" width="30" height="24" rx="6" fill="#000" opacity="0.22"/><path d="M22 44 L78 44" stroke="#000" stroke-width="2" opacity="0.18"/></symbol>
<symbol id="compass" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 18 L60 50 L50 82 L40 50 Z" fill="currentColor"/><circle cx="50" cy="50" r="4" fill="currentColor"/></symbol>
`;

const CSS = `
.pbstore{--bg:#191c18;--surface:#1c241d;--surface-2:#223026;--pine-deep:#16211a;--ink:#ece4d2;--ink-dim:#9ba492;--line:rgba(220,185,121,.16);--accent:#dcb968;--accent-2:#b08838;--accent-ink:#12211a;--brass-l:#dcb968;--parchment:#ece4d2;--sage:#9ba492;--canvas:#cdbfa2;
--font-display:"Arial Black","Helvetica Neue",Helvetica,Arial,sans-serif;--font-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--font-mono:ui-monospace,"SF Mono","SFMono-Regular","Roboto Mono",Menlo,Consolas,monospace;--font-serif:Georgia,"Times New Roman",serif;
background:var(--bg);color:var(--ink);font-family:var(--font-body);min-height:100vh;}
.pbstore[data-theme="light"]{--bg:#d9cdb4;--surface:#ece4d2;--surface-2:#e3d9c3;--ink:#16211a;--ink-dim:#5c634f;--line:rgba(34,48,38,.2);--accent:#9a7327;--accent-2:#7d5c1f;--accent-ink:#fbf4e4;}
.pbstore *{box-sizing:border-box;}
.pbs-wrap{max-width:1200px;margin:0 auto;padding:0 24px;}
.pbs-sec{padding:clamp(70px,9vw,110px) 0;}
.pbs-ey{display:flex;align-items:center;gap:14px;font-family:var(--font-mono);font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent);}
.pbs-ey::before{content:"";width:30px;height:1px;background:var(--accent);display:inline-block;}
.pbs-h2{font-family:var(--font-display);font-weight:900;text-transform:uppercase;letter-spacing:-1px;line-height:.95;font-size:clamp(28px,4.4vw,52px);margin:16px 0 0;}
.pbs-body{font-size:16px;line-height:1.6;color:var(--ink-dim);}
.pbs-mono{font-family:var(--font-mono);text-transform:uppercase;}
.pbs-btn{font-family:var(--font-mono);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-size:12px;padding:15px 26px;border-radius:9px;cursor:pointer;border:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;}
.pbs-btn-p{background:var(--accent);color:var(--accent-ink);}
.pbs-btn-s{background:transparent;color:var(--ink);border:1.5px solid var(--line);}
.pbs-add{background:var(--accent);color:var(--accent-ink);font-family:var(--font-mono);font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px;padding:10px 16px;border:none;border-radius:8px;cursor:pointer;}
.pbs-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;}
.pbs-a{color:var(--accent);text-decoration:none;}
.pbs-a:hover{color:var(--brass-l);}
.pbstore a:focus-visible,.pbstore button:focus-visible,.pbstore input:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}
@keyframes pbUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes pbWordIn{from{opacity:0;transform:translateY(20px) rotateX(-55deg)}to{opacity:1;transform:none}}
@keyframes pbGlow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.8;transform:scale(1.09)}}
@keyframes pbSway{0%,100%{transform:translateY(0) rotate(-.7deg)}50%{transform:translateY(-12px) rotate(.7deg)}}
@keyframes pbFloat{0%{opacity:0;transform:translateY(0)}12%{opacity:.7}88%{opacity:.5}100%{opacity:0;transform:translateY(-340px)}}
@keyframes pbMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pbToast{from{opacity:0;transform:translateX(-50%) translateY(22px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.pbs-up{animation:pbUp .7s ease both;}
@media (prefers-reduced-motion: reduce){.pbstore *{animation:none !important;transition:none !important;}}
`;

function Ico({ id, size = 24, color, style }) {
  return <svg viewBox="0 0 100 100" width={size} height={size} style={{ color, ...style }} aria-hidden="true"><use href={"#" + id} /></svg>;
}

function Crest({ t }) {
  return (
    <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
      <defs><path id={"arc-" + t.slug} d="M34 108 A68 68 0 0 1 166 108" fill="none" /></defs>
      <circle cx="100" cy="100" r="97" fill="url(#brassGrad)" />
      <circle cx="100" cy="100" r="90" fill="#16211a" />
      <circle cx="100" cy="100" r="90" fill="url(#crestSheen)" />
      <circle cx="100" cy="100" r="82" fill="none" stroke="#dcb968" strokeWidth="1.4" strokeDasharray="2 4.5" opacity="0.6" />
      <text textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase" }} fontSize="15" fill="#dcb968"><textPath href={"#arc-" + t.slug} startOffset="50%">{t.name}</textPath></text>
      <use href={"#" + t.terrain} x="66" y="50" width="68" height="68" style={{ color: "#dcb968" }} />
      <path d="M44 122 L156 122 L156 143 L44 143 Z" fill="url(#brassGrad)" /><path d="M44 122 L33 132.5 L44 143 Z" fill="#8a6526" /><path d="M156 122 L167 132.5 L156 143 Z" fill="#8a6526" />
      <text x="100" y="137" textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: "2px" }} fontSize="13" fill="#12211a">RATED {t.rating}</text>
      <text x="100" y="164" textAnchor="middle" style={{ fontFamily: "var(--font-mono)", letterSpacing: "1.2px" }} fontSize="8" fill="#9ba492">{t.region}</text>
      <circle cx="100" cy="13" r="3" fill="#8a6526" /><circle cx="100" cy="187" r="3" fill="#8a6526" /><circle cx="13" cy="100" r="3" fill="#8a6526" /><circle cx="187" cy="100" r="3" fill="#8a6526" />
    </svg>
  );
}

const LogoGlyph = ({ w = 34, g = 19 }) => (
  <span style={{ width: w, height: w, borderRadius: 9, background: "linear-gradient(135deg,#ecd696,#c9a24b)", boxShadow: "0 0 18px rgba(217,183,121,.35)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
    <svg viewBox="0 0 24 24" fill="#12211a" width={g} height={g} aria-hidden="true"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
  </span>
);

export default function Storefront() {
  const [theme, setTheme] = useState("dark");
  const [tribeIndex, setTribeIndex] = useState(0);
  const [cart, setCart] = useState(0);
  const [toast, setToast] = useState({ msg: "", on: false });
  const toastRef = useRef(null);

  useEffect(() => {
    // Auto: honor a saved choice first, else match the device (prefers-color-scheme),
    // defaulting to dark ("the expedition night") when the device has no preference.
    try {
      const saved = localStorage.getItem("pb_store_theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
    } catch {}
  }, []);
  useEffect(() => {
    try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch {}
    const id = setInterval(() => setTribeIndex((i) => (i + 1) % HERO_TRIBES.length), 2200);
    return () => clearInterval(id);
  }, []);
  const toggleTheme = () => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem("pb_store_theme", n); } catch {} return n; });
  const fireToast = (msg) => { if (toastRef.current) clearTimeout(toastRef.current); setToast({ msg, on: true }); toastRef.current = setTimeout(() => setToast((s) => ({ ...s, on: false })), 2600); };
  const addToCart = (name) => { setCart((c) => c + 1); fireToast("Added to pack · " + name); };
  const isDark = theme === "dark";

  const ht = HERO_TRIBES[tribeIndex % HERO_TRIBES.length];
  const gType = tribeIndex % 2 === 0 ? "tee" : "hoodie";
  const gLabel = gType === "tee" ? "Tee" : "Hoodie";
  const NAV = [["Trail Badges", "#trails"], ["Tribes", "#tribes"], ["Family", "#family"], ["The Duck Pond", "#duckpond"], ["About", "#promise"]];

  return (
    <div className="pbstore" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }} aria-hidden="true"><defs dangerouslySetInnerHTML={{ __html: SYMBOLS }} /></svg>

      {/* utility bar */}
      <div style={{ background: "var(--pine-deep)", color: "var(--brass-l)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, textAlign: "center", padding: "8px 16px", borderBottom: "1px solid var(--line)" }}>
        <span>Heavyweight blanks · Original in-house art · Ships worldwide</span>
        <span style={{ display: "block", opacity: 0.8, marginTop: 3 }}>◇ 44.4280°N 110.5885°W ◇ EST. MMXXI</span>
      </div>

      {/* header / nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        <div className="pbs-wrap" style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 24px", flexWrap: "wrap" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--ink)" }}>
            <LogoGlyph />
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: "1.4rem", letterSpacing: ".01em" }}>Park Buddy</span>
          </a>
          <nav style={{ display: "flex", gap: 22, flexWrap: "wrap", marginLeft: "auto" }}>
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="pbs-mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, color: "var(--ink-dim)", textDecoration: "none" }}>{label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 40, height: 40, borderRadius: 9, border: "1.5px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isDark
                ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>
                : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>}
            </button>
            <button onClick={() => fireToast(cart ? cart + " in your pack" : "Your pack is empty")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 12px", color: "var(--ink)", cursor: "pointer" }}>
              <Ico id="pack" size={20} color="var(--ink)" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1 }}>PACK</span>
              <span style={{ minWidth: 20, height: 20, borderRadius: 999, background: "var(--accent)", color: "var(--accent-ink)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{cart}</span>
            </button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "clamp(600px,90vh,880px)", display: "flex", alignItems: "center", background: "radial-gradient(130% 110% at 80% 8%, rgba(220,185,121,.12), transparent 52%), linear-gradient(180deg,var(--bg),var(--surface))" }}>
        <svg viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: "var(--sage)", opacity: 0.12, pointerEvents: "none" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.4">{[-120, -40, 40, 120, 200].map((y) => <use key={y} href="#topoLine" transform={"translate(0," + y + ")"} />)}</g>
        </svg>
        {!isDark ? null : [0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} aria-hidden="true" style={{ position: "absolute", bottom: 40, left: (12 + i * 15) + "%", width: 5, height: 5, borderRadius: "50%", background: i % 2 ? "var(--sage)" : "var(--brass-l)", opacity: 0, animation: `pbFloat ${8.5 + i}s ease-in-out ${i * 1.3}s infinite`, pointerEvents: "none" }} />
        ))}
        <div className="pbs-wrap" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 48, alignItems: "center", padding: "clamp(48px,7vw,90px) 24px" }}>
          <div>
            <div className="pbs-ey pbs-up">National Park Fans · Every Tribe</div>
            <h1 className="pbs-up" style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-1px", lineHeight: 0.9, fontSize: "clamp(42px,6.6vw,82px)", margin: "18px 0 20px" }}>Earn the trail.<br />Wear the badge.</h1>
            <div className="pbs-up" style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--font-mono)", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", color: "var(--ink-dim)", minHeight: 34 }}>
              <span>Built for the</span>
              <span key={tribeIndex} style={{ display: "inline-flex", alignItems: "center", gap: 10, color: ht.color, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, animation: "pbWordIn .55s cubic-bezier(.2,.8,.2,1) both" }}>
                <Ico id={ht.emblem} size={30} color={ht.color} style={{ flexShrink: 0 }} />{ht.name}
              </span>
            </div>
            <p className="pbs-body pbs-up" style={{ margin: "22px 0 28px", maxWidth: 520 }}>One studio, every backcountry crew. Heavyweight blanks and original in-house art for national park fans, jeepers, overlanders, hikers, bikers, riders and surfers — built to take a beating and worn as proof you showed up.</p>
            <div className="pbs-up" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="#drops" className="pbs-btn pbs-btn-p">Shop the Apparel</a>
              <a href="#tribes" className="pbs-btn pbs-btn-s">Find Your Tribe</a>
            </div>
            <div style={{ marginTop: 34, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>
              <div style={{ display: "inline-flex", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 3, color: "var(--ink-dim)", animation: "pbMarquee 26s linear infinite" }}>
                {[0, 1].map((k) => <span key={k}>NATIONAL PARK FANS ✦ JEEPERS ✦ OVERLANDERS ✦ HIKERS ✦ MOUNTAIN BIKERS ✦ ATV / UTV ✦ SURFERS ✦&nbsp;</span>)}
              </div>
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div aria-hidden="true" style={{ position: "absolute", top: "20%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,185,121,.4), transparent 65%)", filter: "blur(18px)", animation: "pbGlow 4.6s ease-in-out infinite", pointerEvents: "none" }} />
            <div key={tribeIndex} style={{ position: "relative", width: "100%", maxWidth: 360, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: "26px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 26px 50px rgba(0,0,0,.4)", animation: "pbWordIn .55s cubic-bezier(.2,.8,.2,1) both, pbSway 6.5s ease-in-out infinite" }}>
              <div style={{ position: "relative", width: 210, height: 210, maxWidth: "52vw" }}>
                <Ico id={gType} color="var(--ink)" style={{ width: "100%", height: "100%" }} />
                <svg viewBox="0 0 100 100" style={{ position: "absolute", width: "34%", height: "34%", top: gType === "hoodie" ? "40%" : "36%", left: "33%", color: ht.color }} aria-hidden="true"><use href={"#" + ht.emblem} /></svg>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: ht.color }}>Tribe Series</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 18, letterSpacing: ".3px", color: "var(--ink)", textAlign: "center" }}>{ht.name} {gLabel}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {[["tee", "grille"], ["hoodie", "boot"], ["tee", "wave"], ["tee", "duck"], ["tee", "summit"]].map(([g, e], i) => (
                <div key={i} style={{ width: 58, height: 58, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 100 100" style={{ width: "74%", height: "74%", color: "var(--ink-dim)" }} aria-hidden="true"><use href={"#" + g} /></svg>
                  <svg viewBox="0 0 100 100" style={{ position: "absolute", width: "26%", height: "26%", color: "var(--accent)" }} aria-hidden="true"><use href={"#" + e} /></svg>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-dim)", textAlign: "center" }}>Tees &amp; hoodies · printed across every tribe · newborn → adult</span>
          </div>
        </div>
      </section>

      {/* trust band */}
      <div style={{ background: "var(--pine-deep)", color: "var(--parchment)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="pbs-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 30, padding: "44px 24px" }}>
          {TRUST.map(([n, h, d]) => (
            <div key={n}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--brass-l)" }}>{n}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 20, letterSpacing: "-.3px", margin: "8px 0 6px" }}>{h}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--sage)" }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* trail series */}
      <section id="trails" className="pbs-sec"><div className="pbs-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 44 }}>
          <div style={{ maxWidth: 560 }}>
            <div className="pbs-ey">Badge of Honor · Trail Series</div>
            <h2 className="pbs-h2">You ran it.<br />Now wear it.</h2>
            <p className="pbs-body" style={{ marginTop: 16 }}>Embossed crests for the legendary off-road trails — each one carries the real terrain, length, difficulty rating, and coordinates. Plan the run in Park Buddy, then earn the badge.</p>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ink-dim)" }}>06 CRESTS · IN-HOUSE</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 22 }}>
          {TRAILS.map((t) => (
            <article key={t.slug} className="pbs-card" style={{ padding: "26px 22px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ width: "74%", maxWidth: 230, filter: "drop-shadow(0 16px 26px rgba(0,0,0,.35))", marginBottom: 20 }}><Crest t={t} /></div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 19, letterSpacing: ".2px", margin: "0 0 6px", color: "var(--ink)" }}>{t.name}</h3>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: 1, color: "var(--ink-dim)", marginBottom: 4 }}>{t.length} · RATED {t.rating}/10</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 0.5, color: "var(--accent)", marginBottom: 16 }}>◇ {t.coords}</div>
              <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center", paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
                <a href="#drops" className="pbs-a" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Featured on tees &amp; hoodies →</a>
              </div>
            </article>
          ))}
        </div>
      </div></section>

      {/* shop by tribe */}
      <section id="tribes" style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }} className="pbs-sec"><div className="pbs-wrap">
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div className="pbs-ey" style={{ justifyContent: "center" }}>Shop by Tribe</div>
          <h2 className="pbs-h2">Find your people</h2>
          <p className="pbs-body" style={{ marginTop: 14 }}>Every backcountry crew, one studio. Pick your tribe and wear the crest.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
          {TRIBES.map((tr) => (
            <a key={tr.code} href="#drops" className="pbs-card" style={{ padding: 24, textDecoration: "none", color: "var(--ink)", position: "relative", display: "block" }}>
              <span style={{ position: "absolute", top: 16, right: 18, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: "var(--ink-dim)" }}>{tr.code}</span>
              <span style={{ width: 64, height: 64, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico id={tr.emblem} size={38} color="var(--accent)" /></span>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 20, margin: "16px 0 6px" }}>{tr.name}</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-dim)", margin: "0 0 12px" }}>{tr.tag}</p>
              <span className="pbs-a" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Shop the tribe →</span>
            </a>
          ))}
        </div>
      </div></section>

      {/* personas + family */}
      <section id="family" className="pbs-sec"><div className="pbs-wrap">
        <div style={{ marginBottom: 36 }}>
          <div className="pbs-ey">Whoever&apos;s riding</div>
          <h2 className="pbs-h2">Solo, two-up, or the whole rig</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18, marginBottom: 40 }}>
          {PERSONAS.map(([k, t, b]) => (
            <div key={k} className="pbs-card" style={{ padding: 26 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--accent)" }}>{k}</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 22, margin: "10px 0 8px", color: "var(--ink)" }}>{t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-dim)", margin: 0 }}>{b}</p>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--pine-deep)", borderRadius: 20, color: "var(--parchment)", padding: "clamp(28px,5vw,44px)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 3, color: "var(--brass-l)" }}>FAMILY MATCHING SETS</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: "clamp(26px,4vw,40px)", margin: "10px 0 8px" }}>Dress the whole rig</h3>
            <p style={{ fontSize: 14, color: "var(--sage)", margin: 0 }}>One crest, every size — newborn to grandparent.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "center", gap: 22 }}>
            {FAMILY.map((f, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ height: 120, display: "flex", alignItems: "flex-end" }}><svg viewBox="0 0 100 100" style={{ width: f.px, height: f.px, color: "var(--brass-l)" }} aria-hidden="true"><use href={"#" + f.garment} /></svg></div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: "var(--parchment)" }}>{f.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: "var(--sage)" }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div></section>

      {/* the duck pond */}
      <section id="duckpond" style={{ background: "var(--surface-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }} className="pbs-sec"><div className="pbs-wrap">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 40, alignItems: "center" }}>
          <div>
            <div className="pbs-ey">The Duck Pond · Capsule</div>
            <h2 className="pbs-h2" style={{ color: "var(--parchment)" }}>Been ducked?<br />Duck back.</h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--sage)", margin: "16px 0 24px", maxWidth: 460 }}>Jeep-ducking is the friendliest tradition on the trail — leave a little rubber duck on a rig you admire, no strings attached. Our one cheeky capsule celebrates the ritual. Same premium blanks, same in-house art — just with a confident wink.</p>
            <a href="#drops" className="pbs-btn pbs-btn-p">Enter the Pond</a>
          </div>
          <div style={{ background: "var(--pine-deep)", borderRadius: 20, height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, border: "1px solid var(--line)" }}>
            <svg viewBox="0 0 100 100" style={{ width: "62%", height: "62%", color: "var(--brass-l)", filter: "drop-shadow(0 8px 16px rgba(0,0,0,.4))" }} aria-hidden="true"><use href="#duck" /></svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--sage)" }}>CERTIFIED DUCK DROPPER</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 34 }}>
          {DUCKS.map((d) => (
            <div key={d.name} style={{ background: "var(--pine-deep)", border: "1px solid var(--line)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ height: 96, background: "var(--surface-2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico id="duck" size={54} color="var(--brass-l)" /></div>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--sage)" }}>{d.tag}</span>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 15, margin: "6px 0 0", color: "var(--parchment)", lineHeight: 1.1 }}>{d.name}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--brass-l)" }}>${d.price}</span>
                <button onClick={() => addToCart(d.name)} className="pbs-add">Add</button>
              </div>
            </div>
          ))}
        </div>
      </div></section>

      {/* new drops */}
      <section id="drops" className="pbs-sec"><div className="pbs-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
          <div><div className="pbs-ey">New Drops</div><h2 className="pbs-h2">Fresh off the press</h2></div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ink-dim)" }}>SMALL-BATCH · IN-HOUSE ART</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 18 }}>
          {PRODUCTS.map((p) => (
            <div key={p.name} className="pbs-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", aspectRatio: "1", background: "var(--bg)", borderBottom: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ position: "absolute", top: 12, left: 12, fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: 1, color: "var(--ink-dim)", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 8px" }}>{p.tag}</span>
                <svg viewBox="0 0 100 100" style={{ width: "70%", height: "70%", color: "var(--ink-dim)" }} aria-hidden="true"><use href={"#" + p.garment} /></svg>
                <svg viewBox="0 0 100 100" style={{ position: "absolute", width: "26%", height: "26%", top: "38%", left: "37%", color: "var(--accent)" }} aria-hidden="true"><use href={"#" + p.emblem} /></svg>
              </div>
              <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 15, margin: 0, color: "var(--ink)", lineHeight: 1.1 }}>{p.name}</h3>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>${p.price}</span>
                </div>
                <button onClick={() => addToCart(p.name)} className="pbs-add" style={{ flex: "none" }}>Add</button>
              </div>
            </div>
          ))}
        </div>
      </div></section>

      {/* brand promise */}
      <section id="promise" style={{ background: "var(--pine-deep)", color: "var(--parchment)", position: "relative", overflow: "hidden" }} className="pbs-sec">
        <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: "var(--brass-l)", opacity: 0.07, pointerEvents: "none" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.4">{[-120, -40, 40, 120].map((y) => <use key={y} href="#topoLine" transform={"translate(0," + y + ")"} />)}</g>
        </svg>
        <div className="pbs-wrap" style={{ position: "relative", textAlign: "center", maxWidth: 760 }}>
          <Ico id="compass" size={42} color="var(--brass-l)" style={{ marginBottom: 22 }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-1px", fontSize: "clamp(28px,4.4vw,48px)", margin: "0 0 18px" }}>Built to last. Tied to real ground.</h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--sage)", margin: "0 auto 22px", maxWidth: 640 }}>We don&apos;t chase trends. Every Park Buddy piece runs on premium heavyweight blanks, with art our studio draws by hand — anchored to trails you can actually plan and run. No filler. Just gear that means you were there.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {["Built to last", "Premium blanks", "Real trails", "Original art"].map((c) => (
              <span key={c} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--brass-l)", border: "1px solid var(--line)", borderRadius: 999, padding: "8px 14px" }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* newsletter */}
      <section className="pbs-sec"><div className="pbs-wrap">
        <div className="pbs-card" style={{ borderRadius: 20, padding: "clamp(28px,5vw,44px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 32, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--accent)" }}>◇ 44.4280°N 110.5885°W</div>
            <h2 className="pbs-h2" style={{ margin: "10px 0 10px" }}>Join the expedition</h2>
            <p className="pbs-body" style={{ margin: 0 }}>First dibs on new drops, trail-crest reveals, and a discount on your first order.</p>
          </div>
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input type="email" placeholder="you@basecamp.com" style={{ flex: 1, minWidth: 180, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, padding: "14px 14px", color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 13, outline: "none" }} />
              <button onClick={() => fireToast("You're on the list · first dibs incoming")} className="pbs-btn pbs-btn-p">Sign Me Up</button>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: "var(--ink-dim)", marginTop: 10 }}>10% OFF YOUR FIRST ORDER · UNSUBSCRIBE ANYTIME</div>
          </div>
        </div>
      </div></section>

      {/* footer */}
      <footer style={{ background: "var(--pine-deep)", color: "var(--sage)", borderTop: "1px solid var(--line)" }}>
        <div className="pbs-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 30, padding: "48px 24px" }}>
          <div>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--parchment)", marginBottom: 12 }}><LogoGlyph w={30} g={16} /><span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: "1.2rem" }}>Park Buddy</span></a>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--sage)", margin: "0 0 10px", maxWidth: 260 }}>Premium outdoor apparel for every backcountry crew. Original in-house art, tied to real trails.</p>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, color: "var(--brass-l)" }}>◇ 44.4280°N 110.5885°W · EST. MMXXI</div>
          </div>
          {[["Shop", ["Trail Badges", "Shop by Tribe", "Family Sets", "The Duck Pond", "New Drops"]], ["Studio", ["About Us", "Our Craft", "Sizing Guide", "Returns", "Contact"]], ["Expedition", ["Trail Guides", "Duck Registry", "@parkbuddy", "Tread Lightly"]]].map(([h, items]) => (
            <div key={h}>
              <h4 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--parchment)", margin: "0 0 16px" }}>{h}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
                {items.map((it) => <li key={it}><a href="#promise" style={{ color: "var(--sage)", textDecoration: "none" }}>{it}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px dashed var(--line)" }}>
          <div className="pbs-wrap" style={{ padding: "22px 24px", display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, color: "var(--sage)" }}>© 2026 Park Buddy Outfitters · Built for the trail</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, color: "var(--brass-l)" }}>◇ N44.42 W110.58 ◇</span>
          </div>
          <div className="pbs-wrap" style={{ padding: "0 24px 30px" }}>
            <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--sage)", opacity: 0.75, margin: 0, maxWidth: 900 }}>Original in-house art. Not affiliated with, endorsed by, or sponsored by the National Park Service or any land-management agency. Trail names are referenced for the off-road community; difficulty ratings are approximate and intended for celebration, not navigation. Know before you go — check current conditions, permits, and closures, and Tread Lightly.</p>
          </div>
        </div>
      </footer>

      {/* toast */}
      {toast.on && (
        <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 90, background: "var(--pine-deep)", color: "var(--parchment)", border: "1px solid var(--brass-l)", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 16px 40px rgba(0,0,0,.5)", animation: "pbToast .28s ease both", maxWidth: "calc(100vw - 40px)" }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--brass-l)", color: "#12211a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, flexShrink: 0 }}>✓</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 0.5 }}>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
