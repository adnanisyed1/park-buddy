"use client";

// Landing v5 — the cinematic six-act landing (Claude Design handoff
// design_handoff_park_buddy_landing, landing-v5-preview.html), recreated as the
// production page. Structure: constants → data hooks → canvas effect hooks
// (overture, hero, flock, atlas, stage, filament, cta) → sections → one CSS
// template string (prototype CSS, header/tokens stripped, scoped under .pbl5).
// Integration: SiteHeader owns nav/theme; useThemedBody keeps <body> in sync;
// real media lives in /public/media/landing; live data per act is noted on the
// act's JSX. Honesty rule: loading = muted/skeleton, failure = quiet fallback,
// never an invented number.
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import loadScript from "./components/load-script";
import { useThemedBody } from "./lib/theme";
import { usePhoto } from "./components/PhotoThumb";

// SSR-safe layout effect: the overture must hide (or start) BEFORE first paint
// so returning visitors never flash the overlay.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ── constants ─────────────────────────────────────────────────────────── */

// Verdict spots (Verdict Engine feed): hero chip + the three engine cards.
const ROCKY = { name: "Rocky Mountain", lat: 40.3428, lng: -105.6836 };
const YOSEMITE = { name: "Yosemite", lat: 37.8651, lng: -119.5383 };
const GLACIER = { name: "Glacier", lat: 48.7596, lng: -113.787 };

// Capability ribbon — static list (prototype copy verbatim).
const RIBBON_ITEMS = [
  "Live verdicts", "63 national parks", "103 national forests", "1,000+ lakes",
  "~3,200 town guides", "124 scenic byways", "Offline trail nav", "Real bookable tours",
  "Wildlife top-10s", "Ranger activities", "Trip Books", "Pines — coming",
];

// Atlas nodes — the only numbers allowed here are the real ones from the brief.
const ATLAS_NODES = [
  { key: "Parks", x: 0.30, y: 0.42, stat: "63", buddy: "63 parks — and I've read the weather at every one this morning.", facts: ["A live GO / PREPARE / HOLD verdict, daily", "Photo-backed page for every park", "Alerts, webcams, sun & moon times"], rel: [3, 7, 5] },
  { key: "Forests", x: 0.15, y: 0.30, stat: "103", buddy: "Quieter than the parks — and I know the good ones.", facts: ["103 national forests", "Dispersed camping & fewer crowds", "Byway and trailhead access"], rel: [5, 6] },
  { key: "Lakes", x: 0.45, y: 0.60, stat: "1,000+", buddy: "632 are man-made — I know every dam by name.", facts: ["Live surface area & conditions", "The dam, its river, year built & operator", "Boat ramps, marinas, swim beaches"], rel: [6, 3] },
  { key: "Towns", x: 0.62, y: 0.36, stat: "~3,200", buddy: "Where to sleep, eat, and start from.", facts: ["Which parks each town serves", "Cabins & hotels", "Real bookable tours from town"], rel: [0, 7, 2] },
  { key: "Byways", x: 0.76, y: 0.30, stat: "124", buddy: "Every overlook, in the right order.", facts: ["All-American Roads to hidden routes", "Real traveler itineraries + history", "One tap adds the whole drive to your trip"], rel: [3, 0] },
  { key: "Trails", x: 0.40, y: 0.24, stat: "OFFLINE", buddy: "I'll keep navigating when your signal dies.", facts: ["Scrub-able elevation on the terrain map", "Live on-trail nav, works offline", "GPS-verified milestone photos"], rel: [0, 1] },
  { key: "Camping", x: 0.70, y: 0.60, stat: "LIVE", buddy: "I'll tell you the second a site opens.", facts: ["Live availability from Recreation.gov", "Booking hand-off", "Permits & passes"], rel: [2, 1] },
  { key: "Tours", x: 0.85, y: 0.48, stat: "REAL", buddy: "Booked or ranger-free — your call.", facts: ["Viator catalog on every page", "Free NPS ranger activities", "Booking supports Park Buddy at no cost to you"], rel: [0, 3] },
];

// Shared US silhouette polygon (atlas dust + stage constellation).
const US_POLY = [[0.10, 0.30], [0.09, 0.42], [0.06, 0.52], [0.10, 0.60], [0.17, 0.66], [0.28, 0.72], [0.40, 0.78], [0.47, 0.74], [0.55, 0.75], [0.62, 0.72], [0.70, 0.70], [0.74, 0.78], [0.80, 0.82], [0.83, 0.72], [0.86, 0.62], [0.90, 0.52], [0.93, 0.40], [0.95, 0.28], [0.86, 0.24], [0.72, 0.22], [0.58, 0.22], [0.44, 0.24], [0.30, 0.24], [0.18, 0.26]];

// One unbroken gold thread: 6 control points per stage state — they only move.
const STAGE_THREAD = {
  0: [[0.10, 0.42], [0.30, 0.30], [0.50, 0.26], [0.66, 0.36], [0.82, 0.34], [0.93, 0.30]],
  1: [[0.30, 0.16], [0.42, 0.34], [0.34, 0.50], [0.50, 0.64], [0.42, 0.80], [0.58, 0.90]],
  2: [[0.16, 0.22], [0.84, 0.22], [0.86, 0.5], [0.84, 0.82], [0.16, 0.82], [0.14, 0.5]],
  3: [[0.5, 0.08], [0.5, 0.26], [0.5, 0.44], [0.5, 0.62], [0.5, 0.80], [0.5, 0.94]],
};

const STAGE_PROOFS_LEFT = [
  { k: "Explore", h: "63 parks, one live map", p: "Weather, hourly & 7-day forecasts, alerts, webcams, river gauges — on every place." },
  { k: "Plan", h: "Real drive times", p: "Daylight-fit pacing so I won't overstuff your Tuesday. Trip Mode rides along day-of." },
  { k: "Book", h: "Booked & free", p: "Real tours plus NPS ranger activities that are free with your park entry." },
  { k: "Remember", h: "Print it, for real", p: "Design it in Book Studio and I'll ship a real hardcover to your door." },
];
const STAGE_PROOFS_RIGHT = [
  { k: "Search", h: "One bar finds it all", p: "Parks, forests, lakes, towns — plus live “you are here” tracking." },
  { k: "Share", h: ".ics · print · link", p: "Send the plan to anyone. It opens right in their calendar." },
  { k: "Honest", h: "Verdict on every card", p: "GO / PREPARE / HOLD travels with the booking, live." },
  { k: "Keepsake", h: "Hardcover, shipped", p: "Your route, photos and story — the way trips used to be remembered." },
];

/* ── shared canvas helpers (pure; only called client-side in effects) ───── */

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}
function isLightTheme() { return document.documentElement.getAttribute("data-theme") === "light"; }
// Canvas art palette per theme (README): dark = gold; light = antique gold / pine.
function goldRGB(light) { return light ? [150, 112, 42] : [232, 207, 154]; }
function isOnScreen(el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
function prefersReduced() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
// The app's real mono stack for ctx.font (canvas can't read var()).
function monoFam(el) {
  const v = getComputedStyle(el).getPropertyValue("--pb-mono").trim();
  return v || "'Space Mono', ui-monospace, monospace";
}
function pip(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function bez3(a, b, c, d, t) { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d; }
function easeOut(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }

// Stroke a polyline partially (0..1 of its length) — the pine grows tier by tier.
function drawPolyPartial(ctx, pts, p) {
  if (p <= 0) return;
  let total = 0; const segs = [];
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); total += L; }
  const want = total * p; let acc = 0;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] <= want) { ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); acc += segs[i]; }
    else { const f = (want - acc) / segs[i]; ctx.lineTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f); break; }
  }
  ctx.stroke();
}
// prog 0..1 across trunk + 5 tiers (bottom → crown) — 5 birds, 5 tiers.
function drawPine(ctx, cx, baseY, H, prog, light) {
  const g1 = light ? "#2f6b4e" : "#e8cf9a", g2 = light ? "#1f4a37" : "#c9a35f";
  const grad = ctx.createLinearGradient(cx - H * 0.4, baseY - H, cx + H * 0.4, baseY);
  grad.addColorStop(0, g1); grad.addColorStop(1, g2);
  ctx.save();
  ctx.strokeStyle = grad; ctx.lineWidth = Math.max(1.4, H * 0.032); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = light ? "rgba(47,107,78,.5)" : "rgba(232,207,154,.6)"; ctx.shadowBlur = H * 0.05;
  const tiers = 5, trunkH = H * 0.14, trunkTop = baseY - trunkH, span = H - trunkH;
  const seg = prog * (tiers + 1);
  if (seg > 0) drawPolyPartial(ctx, [[cx, baseY], [cx, baseY - trunkH * Math.min(seg, 1)]], 1);
  for (let i = 0; i < tiers; i++) {
    const s = seg - (i + 1); if (s <= 0) continue;
    const p = Math.min(s, 1), w = (H * 0.44) * (1 - i * 0.17);
    const peakY = trunkTop - span * (i / tiers), leg = (span / tiers) * 1.25;
    drawPolyPartial(ctx, [[cx - w, peakY + leg], [cx, peakY], [cx + w, peakY + leg]], p);
  }
  ctx.restore();
}

/* ── data hooks (honesty rule: null = loading, {failed} = quiet fallback) ── */

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

// Live verdict via the shared engine (/pb-verdict.js → window.PBVerdict).
// bucket thresholds match the engine's own tiers: ≥62 go · ≥42 prepare · hold.
function useVerdict(lat, lng) {
  const [v, setV] = useState(null);
  useEffect(() => {
    let on = true;
    loadScript("/pb-verdict.js").then((ok) => {
      if (!on) return;
      if (!ok || typeof window === "undefined" || !window.PBVerdict) { setV({ failed: true }); return; }
      window.PBVerdict.fetchVerdict(lat, lng, (r) => {
        if (!on) return;
        if (!r || r.score == null) { setV({ failed: true }); return; }
        const bucket = r.score >= 62 ? "go" : r.score >= 42 ? "prepare" : "hold";
        setV({ ...r, bucket, at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
      });
    });
    return () => { on = false; };
  }, [lat, lng]);
  return v;
}

// Wildlife tile: top mammal + caution list from /api/wildlife (iNaturalist).
function useWildlife(lat, lng) {
  const [w, setW] = useState(null);
  useEffect(() => {
    let on = true;
    fetch("/api/wildlife?lat=" + lat + "&lng=" + lng)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        if (!d || !Array.isArray(d.mammals) || !d.mammals.length) { setW({ failed: true }); return; }
        setW({ top: d.mammals[0], caution: (d.caution || []).slice(0, 3) });
      })
      .catch(() => { if (on) setW({ failed: true }); });
    return () => { on = false; };
  }, [lat, lng]);
  return w;
}

// One real bookable tour near Rocky Mountain (Viator via /api/tours).
// Ranger-activity card: the NPS's own curated program for RMNP, with the
// NPS's own photo — real content, not stock. 503s locally (DEMO_KEY); the
// card then falls back to a Wikimedia park photo via usePhoto.
function useRangerTodo() {
  const [item, setItem] = useState(null);
  useEffect(() => {
    let on = true;
    fetch("/api/thingstodo?parkCode=romo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        const it = d && Array.isArray(d.items) && d.items.find((i) => i.img && i.title);
        setItem(it || { failed: true });
      })
      .catch(() => { if (on) setItem({ failed: true }); });
    return () => { on = false; };
  }, []);
  return item;
}

function useTour(lat, lng) {
  const [t, setT] = useState(null);
  useEffect(() => {
    let on = true;
    fetch("/api/tours?lat=" + lat + "&lng=" + lng + "&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        const tour = d && Array.isArray(d.tours) && d.tours[0];
        if (!tour || !tour.title) { setT({ failed: true }); return; }
        setT(tour);
      })
      .catch(() => { if (on) setT({ failed: true }); });
    return () => { on = false; };
  }, [lat, lng]);
  return t;
}

/* ── ACT 0 — the overture (once per session; skippable; RM = badge fade) ──
   Data feed: none — pure brand. Five birds (NPS·NWS·USGS·BUDDIES·USFS) feed
   the pine; the real parchment badge PNG fades in around the completed tree,
   the gold seal sweeps once, and the badge glides into the header logo slot
   (SiteHeader's badge img). At scatter, the birds seed the hero fireflies. */
function useOverture({ ovRef, canvasRef, badgeRef, sealRef, skipRef, heroSeedRef, reveal }) {
  useIsoLayoutEffect(() => {
    const ov = ovRef.current, canvas = canvasRef.current, badge = badgeRef.current, seal = sealRef.current, skipBtn = skipRef.current;
    if (!ov || !canvas || !badge) return undefined;
    let seen = false;
    try { seen = sessionStorage.getItem("pb_overture") === "1"; } catch {}
    const timeouts = [];
    let raf = null, finished = false;
    const markDone = () => {
      try { sessionStorage.setItem("pb_overture", "1"); } catch {}
      ov.classList.add("gone");
      timeouts.push(setTimeout(() => { ov.style.display = "none"; }, 650));
    };
    if (seen) { ov.style.display = "none"; reveal(); return undefined; }
    const RM = prefersReduced();
    const skip = () => { if (finished) return; finished = true; if (raf) cancelAnimationFrame(raf); reveal(); markDone(); };
    const onKey = (e) => { if (e.key === "Enter") skip(); };
    skipBtn && skipBtn.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);

    // Reduced motion → a dignified badge fade, still once per session.
    if (RM) {
      badge.style.left = "50%"; badge.style.top = "50%";
      badge.style.transform = "translate(-50%,-50%)";
      badge.style.transition = "opacity 1s ease";
      const kick = requestAnimationFrame(() => { badge.style.opacity = "1"; });
      timeouts.push(setTimeout(skip, 1400));
      return () => {
        cancelAnimationFrame(kick); timeouts.forEach(clearTimeout);
        skipBtn && skipBtn.removeEventListener("click", skip);
        window.removeEventListener("keydown", onKey);
      };
    }

    const ctx = canvas.getContext("2d");
    const MONO = monoFam(canvas);
    let W = 0, H = 0, cx = 0, groundY = 0, treeH = 0, start = 0, seeded = false;
    const ripples = [];
    function layoutCenter() {
      const bw = badge.offsetWidth || 190, bh = badge.offsetHeight || 190;
      badge.style.left = (W / 2 - bw / 2) + "px";
      badge.style.top = (H * 0.5 - bh / 2 - H * 0.02) + "px";
    }
    function size() { const d = fitCanvas(canvas); W = d.w; H = d.h; cx = W / 2; groundY = H * 0.6; treeH = Math.min(H * 0.34, 320); layoutCenter(); }
    // timeline knobs (ms) — prototype values; LETTERS phase dropped (the PNG
    // badge carries the wordmark itself).
    const STAG = 110, APP = 720, B0 = 140;
    const LAST = B0 + 4 * STAG + APP;
    const ORBIT_S = LAST + 120, ORBIT_E = ORBIT_S + 560, SCAT_E = ORBIT_E + 320;
    const BADGE_IN = LAST + 120, SEAL_S = BADGE_IN + 520, SEAL_E = SEAL_S + 560;
    const GLIDE_S = SEAL_E + 120, GLIDE_E = GLIDE_S + 680, DONE = GLIDE_E + 40;
    const corners = [[-0.1, -0.05], [1.1, -0.02], [-0.08, 0.5], [1.08, 0.55], [0.5, -0.12]];
    const labels = ["NPS", "NWS", "USGS", "BUDDIES", "USFS"];
    let birds = [];
    function initBirds() {
      birds = [];
      for (let i = 0; i < 5; i++) {
        const sx = corners[i][0] * W, sy = corners[i][1] * H;
        const c1x = sx + (cx - sx) * 0.3 + (Math.random() - 0.5) * W * 0.2, c1y = sy + (groundY - sy) * 0.1 - H * 0.18;
        const c2x = sx + (cx - sx) * 0.7 + (Math.random() - 0.5) * W * 0.1, c2y = groundY - H * 0.22;
        birds.push({ sx, sy, c1x, c1y, c2x, c2y, start: B0 + i * STAG, label: labels[i], orbA: (i / 5) * 6.2832, px: sx, py: sy, dropped: false });
      }
    }
    let treeProg = 0, treeTarget = 0;
    function drawBird(x, y, ang, alpha, label, light) {
      const gold = light ? "#2f6b4e" : "#e8cf9a";
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = gold; ctx.globalAlpha = alpha; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.shadowColor = gold; ctx.shadowBlur = 8;
      const len = 13, h = 6;
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(-len * 0.4, -h, 0, -1); ctx.quadraticCurveTo(len * 0.4, -h, len, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -1, 2.1, 0, 6.2832); ctx.fillStyle = light ? "#c9a35f" : "#e8cf9a"; ctx.shadowBlur = 12; ctx.fill();
      ctx.restore();
      if (label) { ctx.save(); ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = gold; ctx.font = "9px " + MONO; ctx.textAlign = "center"; ctx.fillText(label, x, y + 16); ctx.restore(); }
    }
    let glideFrom = null, glideTo = null, heroKicked = false;
    function glide(p) {
      const e = easeOut(p);
      if (!glideFrom) {
        const br = badge.getBoundingClientRect();
        glideFrom = { x: br.left, y: br.top, w: br.width };
        // land on the header's real badge (first badge img in the document =
        // SiteHeader's brand); fall back to the top-left header area.
        const t = document.querySelector('img[src="/brand/the-park-buddy-badge.png"]');
        const g = t && t.getBoundingClientRect();
        glideTo = g && g.width ? { x: g.left, y: g.top, w: g.width } : { x: 26, y: 16, w: 38 };
        badge.style.transition = "none";
      }
      const scale = 1 + (glideTo.w / glideFrom.w - 1) * e;
      badge.style.transformOrigin = "top left";
      badge.style.transform = "translate(" + ((glideTo.x - glideFrom.x) * e) + "px," + ((glideTo.y - glideFrom.y) * e) + "px) scale(" + scale + ")";
      badge.style.opacity = String(1 - e * 0.9);
    }
    function frame(now) {
      if (finished) return;
      if (!start) start = now;
      const E = now - start;
      ctx.clearRect(0, 0, W, H);
      const light = isLightTheme();
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i], age = E - rp.t;
        if (age > 900) { ripples.splice(i, 1); continue; }
        const pr = age / 900;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 6 + pr * 46, 0, 6.2832);
        ctx.strokeStyle = "rgba(" + (light ? "47,107,78" : "232,207,154") + "," + (0.5 * (1 - pr)) + ")";
        ctx.lineWidth = 1.5; ctx.stroke();
      }
      treeProg += (treeTarget - treeProg) * 0.12;
      if (treeProg > 0.01) drawPine(ctx, cx, groundY, treeH, treeProg, light);
      if (treeTarget >= 1) { const pulse = 0.5 + 0.5 * Math.sin(E * 0.006); ctx.save(); ctx.globalAlpha = 0.25 * pulse; drawPine(ctx, cx, groundY, treeH * 1.02, 1, light); ctx.restore(); }
      for (let i = 0; i < 5; i++) {
        const b = birds[i];
        if (E < b.start) continue;
        const tt = (E - b.start) / APP;
        if (tt <= 1) {
          const t = easeOut(tt);
          const x = bez3(b.sx, b.c1x, b.c2x, cx, t), y = bez3(b.sy, b.c1y, b.c2y, groundY - 2, t);
          const ang = Math.atan2(y - b.py, x - b.px); b.px = x; b.py = y;
          drawBird(x, y, ang, 1, b.label, light);
        } else if (!b.dropped) { b.dropped = true; ripples.push({ x: cx, y: groundY, t: E }); treeTarget = (i + 2) / 6; }
        else if (E < ORBIT_E) { // the coronation orbit
          const op = (E - ORBIT_S) / (ORBIT_E - ORBIT_S), ang0 = b.orbA + op * 4.2, R = treeH * 0.62;
          const x = cx + Math.cos(ang0) * R, y = (groundY - treeH * 0.5) + Math.sin(ang0) * R * 0.5;
          b.px = x; b.py = y; drawBird(x, y, ang0 + Math.PI / 2, 1, null, light);
        } else if (E < SCAT_E) { // scatter → hand the light to the hero fireflies
          const sp = (E - ORBIT_E) / (SCAT_E - ORBIT_E), dir = b.orbA;
          const x = b.px + Math.cos(dir) * sp * W * 0.5, y = b.py - Math.abs(Math.sin(dir)) * sp * H * 0.4 - sp * 40;
          drawBird(x, y, dir, 1 - sp, null, light);
          if (sp > 0.5 && !seeded && i === 4) {
            seeded = true;
            if (heroSeedRef.current) heroSeedRef.current(birds.map((bb) => ({ x: bb.px, y: bb.py })));
          }
        }
      }
      if (E >= BADGE_IN) badge.style.opacity = String(Math.min((E - BADGE_IN) / 300, 1));
      if (E >= SEAL_S && seal) {
        const sp = Math.min((E - SEAL_S) / (SEAL_E - SEAL_S), 1);
        seal.style.opacity = sp < 1 ? "1" : "0";
        seal.style.transform = "rotate(" + (sp * 360) + "deg)";
      }
      if (E >= SEAL_E - 160) { const cf = Math.min((E - (SEAL_E - 160)) / 220, 1); canvas.style.opacity = String(1 - cf * 0.85); }
      if (E >= GLIDE_S) glide(Math.min((E - GLIDE_S) / (GLIDE_E - GLIDE_S), 1));
      if (E >= GLIDE_S + 120 && !heroKicked) { heroKicked = true; reveal(); } // headline assembles mid-glide
      if (E >= DONE) { finished = true; markDone(); return; }
      raf = requestAnimationFrame(frame);
    }
    const onResize = () => { size(); initBirds(); };
    window.addEventListener("resize", onResize);
    size(); initBirds();
    raf = requestAnimationFrame(frame);
    return () => {
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      skipBtn && skipBtn.removeEventListener("click", skip);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── ACT I — hero canvas: soft ridgelines + gold fireflies (cursor gravity).
   Ridge opacity is DIALED BACK vs the prototype — the hero film supplies the
   forest now (README). Exposes heroSeedRef so overture birds become motes. */
function useHeroCanvas({ canvasRef, heroRef, heroSeedRef }) {
  useEffect(() => {
    const canvas = canvasRef.current, hero = heroRef.current;
    if (!canvas || !hero) return undefined;
    const RM = prefersReduced();
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = null, running = false;
    let motes = [], ridges = [];
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const rnd = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const ridgeH = (rg, xn) => {
      let s = 0, wt = 0;
      for (let k = 0; k < rg.h.length; k++) { const o = rg.h[k]; s += Math.sin(xn * 6.2832 * o.f + o.p) * o.w; wt += o.w; }
      return rg.baseY - rg.amp * ((s / wt) * 0.5 + 0.5);
    };
    const newMote = () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.6, vx: (Math.random() - 0.5) * 0.12, vy: -(Math.random() * 0.25 + 0.05), a: Math.random() * 0.6 + 0.2, tw: Math.random() * 6.28, ts: Math.random() * 0.03 + 0.008 });
    function build() {
      const d = fitCanvas(canvas); W = d.w; H = d.h; ridges = [];
      [{ y: 0.66, amp: 0.09, depth: 0.26, seed: 11 }, { y: 0.75, amp: 0.12, depth: 0.5, seed: 37 },
       { y: 0.85, amp: 0.14, depth: 0.74, seed: 71 }, { y: 0.95, amp: 0.17, depth: 1, seed: 97 }].forEach((c) => {
        const r = rnd(c.seed);
        const h = [{ f: 0.7 + r() * 0.5, p: r() * 6.28, w: 1 }, { f: 1.5 + r() * 0.7, p: r() * 6.28, w: 0.55 }, { f: 2.6 + r() * 1.1, p: r() * 6.28, w: 0.3 }, { f: 12 + Math.floor(r() * 10), p: r() * 6.28, w: 0.05 + c.depth * 0.05 }];
        ridges.push({ baseY: H * c.y, amp: H * c.amp, depth: c.depth, h });
      });
      const target = Math.min(RM ? 70 : 110, Math.round((W * H) / 14000));
      if (!motes.length) for (let i = 0; i < target; i++) motes.push(newMote());
    }
    heroSeedRef.current = (pts) => { // overture handoff — birds become motes
      pts.forEach((pt) => {
        for (let k = 0; k < 6; k++) {
          const m = newMote(); m.x = pt.x; m.y = pt.y;
          const a = Math.random() * 6.28, sp = Math.random() * 1.2 + 0.4;
          m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp - 0.3; m.a = 0.8;
          motes.push(m);
        }
      });
      if (motes.length > 150) motes.splice(0, motes.length - 150);
    };
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const light = isLightTheme();
      const mx = mouse.x / W - 0.5, my = mouse.y / H - 0.5;
      for (let l = 0; l < ridges.length; l++) {
        const rg = ridges[l], off = rg.depth * mx * 26, voff = rg.depth * my * 10, N = 80;
        ctx.beginPath(); ctx.moveTo(-60, H + 60); ctx.lineTo(-60, ridgeH(rg, -0.05) + voff);
        for (let i = 0; i <= N; i++) { const xn = i / N; ctx.lineTo(xn * W + off, ridgeH(rg, xn) + voff); }
        ctx.lineTo(W + 60, ridgeH(rg, 1.05) + voff); ctx.lineTo(W + 60, H + 60); ctx.closePath();
        const g = ctx.createLinearGradient(0, rg.baseY - rg.amp, 0, H);
        // ~40% of the prototype's alphas: the film is the forest, canvas is mist
        if (light) { g.addColorStop(0, "rgba(41,86,64," + (0.06 + rg.depth * 0.08) + ")"); g.addColorStop(1, "rgba(23,57,42," + (0.12 + rg.depth * 0.14) + ")"); }
        else { g.addColorStop(0, "rgba(9,22,15," + (0.13 + rg.depth * 0.09) + ")"); g.addColorStop(1, "rgba(3,8,5," + (0.25 + rg.depth * 0.15) + ")"); }
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const xn = i / N, x = xn * W + off, y = ridgeH(rg, xn) + voff; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = light ? "rgba(122,87,22," + (0.05 + rg.depth * 0.05) + ")" : "rgba(232,207,154," + (0.04 + rg.depth * 0.06) + ")";
        ctx.lineWidth = 1; ctx.shadowColor = light ? "rgba(122,87,22,.4)" : "rgba(232,207,154,.5)"; ctx.shadowBlur = 6 + rg.depth * 6; ctx.stroke(); ctx.shadowBlur = 0;
      }
      const gold = goldRGB(light);
      for (let m = 0; m < motes.length; m++) {
        const o = motes[m];
        if (mouse.x > -9000) {
          const dx = mouse.x - o.x, dy = mouse.y - o.y, d2 = dx * dx + dy * dy;
          if (d2 < 26000) { const f = (1 - d2 / 26000) * 0.06; o.vx += dx * f * 0.02; o.vy += dy * f * 0.02; }
        }
        o.x += o.vx; o.y += o.vy; o.tw += o.ts; o.vx *= 0.985; o.vy = o.vy * 0.985 - 0.006;
        if (o.y < -10 || o.x < -20 || o.x > W + 20) { motes[m] = newMote(); motes[m].y = H + 8; continue; }
        const fl = 0.55 + Math.sin(o.tw) * 0.45;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (o.a * fl) + ")";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.9)"; ctx.shadowBlur = o.r * 4; ctx.fill(); ctx.shadowBlur = 0;
      }
      mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
    }
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    function startC() { if (running) return; running = true; if (RM) { draw(); return; } loop(); }
    function stopC() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    const onMouse = (e) => { const r = canvas.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; };
    const onTouch = (e) => { const t = e.touches[0], r = canvas.getBoundingClientRect(); mouse.tx = t.clientX - r.left; mouse.ty = t.clientY - r.top; };
    window.addEventListener("mousemove", onMouse);
    canvas.addEventListener("touchmove", onTouch, { passive: true });
    const ro = new ResizeObserver(build); ro.observe(canvas); build();
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? startC() : stopC())); }, { threshold: 0.02 });
    io.observe(hero);
    const onVis = () => { document.hidden ? stopC() : (isOnScreen(hero) && startC()); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopC(); ro.disconnect(); io.disconnect();
      window.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("touchmove", onTouch);
      document.removeEventListener("visibilitychange", onVis);
      heroSeedRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── page-wide flock: ~6 calligraphic gulls on a fixed canvas. The prototype
   sampled document.elementFromPoint per feather; here plain z-layering does it
   (canvas z:5, content wrappers z:6) — the README's own suggested swap. */
function useFlock({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const RM = prefersReduced();
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = null, running = false, last = 0, birds = [];
    function fitv() { const d = fitCanvas(canvas); W = d.w; H = d.h; }
    function spawn(depth) {
      const fromLeft = Math.random() < 0.5, y0 = H * 0.06 + Math.random() * H * 0.82;
      const sx = fromLeft ? -90 : W + 90, ex = fromLeft ? W + 90 : -90;
      return {
        sx, sy: y0,
        c1x: sx + (ex - sx) * 0.33, c1y: y0 + (Math.random() - 0.5) * H * 0.5,
        c2x: sx + (ex - sx) * 0.66, c2y: y0 + (Math.random() - 0.5) * H * 0.5,
        ex, ey: y0 + (Math.random() - 0.5) * H * 0.35,
        t: Math.random() * 0.2, sp: (0.00006 + Math.random() * 0.00007) * (0.55 + depth), depth,
        scale: (2.0 + depth * 2.4) * (0.85 + Math.random() * 0.35), px: sx, py: y0, cur: 0,
      };
    }
    function build() { fitv(); if (!birds.length) for (let i = 0; i < 6; i++) birds.push(spawn(i / 6)); }
    function gull(x, y, rot, sc, alpha, col) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.1, 0.9 + sc * 0.5); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      const flap = Math.sin(performance.now() * 0.003 + x * 0.015 + y * 0.01);
      const span = 16 * sc, lift = (9 + flap * 2.4) * sc, tip = (3.4 - flap * 2.8) * sc, body = 1.6 * sc;
      ctx.beginPath();
      ctx.moveTo(-span, tip);
      ctx.bezierCurveTo(-span * 0.52, -lift * 0.75, -span * 0.2, -lift, 0, -body);
      ctx.bezierCurveTo(span * 0.2, -lift, span * 0.52, -lift * 0.75, span, tip);
      ctx.stroke();
      ctx.restore();
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      const col = isLightTheme() ? "#0f3324" : "#e8cf9a";
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i]; b.t += b.sp * (dt || 16);
        if (b.t >= 1) { birds[i] = spawn(b.depth); continue; }
        const x = bez3(b.sx, b.c1x, b.c2x, b.ex, b.t), y = bez3(b.sy, b.c1y, b.c2y, b.ey, b.t);
        const ang = Math.max(-0.5, Math.min(0.5, Math.atan2(y - b.py, Math.abs(x - b.px) + 0.001)));
        b.px = x; b.py = y;
        b.cur += ((0.26 + b.depth * 0.32) - b.cur) * 0.16; // soft fade-in after spawn
        if (b.cur > 0.01) gull(x, y, ang, b.scale, b.cur, col);
      }
    }
    function loop(ts) { if (!last) last = ts; const dt = ts - last; last = ts; draw(dt); raf = requestAnimationFrame(loop); }
    function startC() { if (running) return; running = true; last = 0; if (RM) { draw(0); return; } raf = requestAnimationFrame(loop); }
    function stopC() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    const onResize = () => build();
    window.addEventListener("resize", onResize);
    build(); startC();
    const onVis = () => (document.hidden ? stopC() : startC());
    document.addEventListener("visibilitychange", onVis);
    return () => { stopC(); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── ACT II — atlas canvas: US dust field, 8 gold nodes, dashed filaments to
   the active node's relations. Active state lives in React (the panel); the
   loop reads it through refs. Auto-cycles every 4.5s when not hover-locked. */
function useAtlas({ canvasRef, sectionRef, activeRef, hoverLockRef, setActive, apiRef }) {
  useEffect(() => {
    const canvas = canvasRef.current, section = sectionRef.current;
    if (!canvas || !section) return undefined;
    const RM = prefersReduced();
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = null, running = false, autoT = 0, lastTime = 0;
    const dust = [];
    const nodePos = ATLAS_NODES.map(() => [0, 0]);
    function build() {
      const d = fitCanvas(canvas); W = d.w; H = d.h;
      if (!dust.length) {
        let tries = 0;
        while (dust.length < 70 && tries < 1500) {
          tries++;
          const x = 0.05 + Math.random() * 0.9, y = 0.16 + Math.random() * 0.68;
          if (pip(x, y, US_POLY)) dust.push({ x, y, r: Math.random() * 1.3 + 0.5, tw: Math.random() * 6.28, ts: Math.random() * 0.03 + 0.01 });
        }
      }
    }
    const nodeXY = (n) => [(0.06 + n.x * 0.88) * W, (0.12 + n.y * 0.76) * H];
    const MONO = monoFam(canvas);
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      const light = isLightTheme(), gold = goldRGB(light), active = activeRef.current;
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i]; p.tw += p.ts;
        const x = (0.06 + p.x * 0.88) * W, y = (0.12 + p.y * 0.76) * H, fl = 0.4 + Math.sin(p.tw) * 0.35;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (0.16 * fl) + ")"; ctx.fill();
      }
      const a = ATLAS_NODES[active], ap = nodeXY(a);
      for (let r = 0; r < a.rel.length; r++) {
        const bp = nodeXY(ATLAS_NODES[a.rel[r]]);
        ctx.beginPath(); ctx.moveTo(ap[0], ap[1]);
        const mx = (ap[0] + bp[0]) / 2, my = (ap[1] + bp[1]) / 2 - 24;
        ctx.quadraticCurveTo(mx, my, bp[0], bp[1]);
        ctx.strokeStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.28)";
        ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -(performance.now() * 0.03); ctx.stroke(); ctx.setLineDash([]);
        const ph = (performance.now() * 0.0004) % 1;
        const qx = (1 - ph) * (1 - ph) * ap[0] + 2 * (1 - ph) * ph * mx + ph * ph * bp[0];
        const qy = (1 - ph) * (1 - ph) * ap[1] + 2 * (1 - ph) * ph * my + ph * ph * bp[1];
        ctx.beginPath(); ctx.arc(qx, qy, 2, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.9)";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.8)"; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
      }
      for (let i = 0; i < ATLAS_NODES.length; i++) {
        const n = ATLAS_NODES[i], xy = nodeXY(n), on = i === active;
        nodePos[i] = xy;
        const pulse = on ? 1 + Math.sin(performance.now() * 0.004) * 0.12 : 1;
        const R = (on ? 9 : 4.5) * pulse;
        ctx.beginPath(); ctx.arc(xy[0], xy[1], R + (on ? 6 : 0), 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (on ? 0.14 : 0.05) + ")"; ctx.fill();
        ctx.beginPath(); ctx.arc(xy[0], xy[1], R, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (on ? 1 : 0.55) + ")";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.9)"; ctx.shadowBlur = on ? 16 : 6; ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (on ? 1 : 0.6) + ")";
        ctx.font = (on ? "600 " : "") + "11px " + MONO; ctx.textAlign = "center";
        ctx.fillText(n.key.toUpperCase(), xy[0], xy[1] - R - 9);
      }
      if (!RM && !hoverLockRef.current) {
        autoT += dt;
        if (autoT > 4500) { autoT = 0; setActive((prev) => (prev + 1) % ATLAS_NODES.length); }
      }
    }
    function loop(ts) { if (!lastTime) lastTime = ts; const dt = ts - lastTime; lastTime = ts; draw(dt); raf = requestAnimationFrame(loop); }
    function startC() { if (running) return; running = true; lastTime = 0; if (RM) { draw(0); return; } raf = requestAnimationFrame(loop); }
    function stopC() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    apiRef.current = { redraw: () => { if (RM) draw(0); } }; // RM: repaint on tap
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 1e9;
      for (let i = 0; i < ATLAS_NODES.length; i++) {
        const dx = mx - nodePos[i][0], dy = my - nodePos[i][1], d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      if (bd < 2600) { hoverLockRef.current = true; if (best !== activeRef.current) setActive(best); }
      else hoverLockRef.current = false;
    };
    const onLeave = () => { hoverLockRef.current = false; autoT = 0; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    const ro = new ResizeObserver(build); ro.observe(canvas); build();
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? startC() : stopC())); }, { threshold: 0.12 });
    io.observe(section);
    const onVis = () => { document.hidden ? stopC() : (isOnScreen(section) && startC()); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopC(); ro.disconnect(); io.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      apiRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── ACT III — the morphing stage: 96 particles retarget per state, the gold
   thread's 6 control points glide (0.06 lerp, never break). State lives in
   React (overlays/proofs/ticks); the loop owns the 6s autoplay + tick fill. */
function useStage({ canvasRef, sectionRef, stateRef, tickFillRefs, advance, apiRef }) {
  useEffect(() => {
    const canvas = canvasRef.current, section = sectionRef.current;
    if (!canvas || !section) return undefined;
    const RM = prefersReduced();
    const ctx = canvas.getContext("2d");
    const AUTO = 6000, N = 96;
    let W = 0, H = 0, raf = null, running = false, lastTime = 0, autoT = 0;
    let usPts = [], parts = [], thread = null, threadTarget = STAGE_THREAD[0];
    function buildUS() {
      usPts = [];
      for (let gy = 0; gy < 9 && usPts.length < 63; gy++) {
        for (let gx = 0; gx < 12 && usPts.length < 63; gx++) {
          const x = 0.05 + (gx / 11) * 0.9 + Math.sin(gx * 3.1 + gy) * 0.02;
          const y = 0.2 + (gy / 8) * 0.62 + Math.cos(gy * 2.3 + gx) * 0.02;
          if (pip(x, y, US_POLY)) usPts.push([x, y]);
        }
      }
      let e = 0;
      while (usPts.length < 63) { usPts.push(US_POLY[e % US_POLY.length]); e++; }
    }
    function targetsFor(s) {
      const t = [];
      if (s === 0) { for (let i = 0; i < N; i++) t.push(i < usPts.length ? [usPts[i][0], usPts[i][1]] : [Math.random(), Math.random()]); }
      else if (s === 1) { const nd = STAGE_THREAD[1]; for (let i = 0; i < N; i++) { const q = nd[i % nd.length]; t.push([q[0] + (Math.random() - 0.5) * 0.05, q[1] + (Math.random() - 0.5) * 0.05]); } }
      else if (s === 2) {
        const corners = [[0.14, 0.16], [0.86, 0.16], [0.86, 0.84], [0.14, 0.84]];
        for (let i = 0; i < N; i++) {
          const a = i / N, seg = a * 4, k = Math.floor(seg) % 4, c0 = corners[k], c1 = corners[(k + 1) % 4], f = seg - Math.floor(seg);
          t.push([c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f]);
        }
      } else { for (let i = 0; i < N; i++) { const side = i % 2 ? 1 : -1, v = i / N; t.push([0.5 + side * (0.06 + Math.random() * 0.32), 0.12 + v * 0.76]); } }
      return t;
    }
    function retarget(s, instant) {
      const tg = targetsFor(s);
      for (let i = 0; i < N; i++) {
        parts[i].tx = tg[i][0]; parts[i].ty = tg[i][1];
        if (instant) { parts[i].x = tg[i][0]; parts[i].y = tg[i][1]; }
      }
      threadTarget = STAGE_THREAD[s];
      if (instant && thread) thread = STAGE_THREAD[s].map((p) => [p[0], p[1]]);
      // reset every tick fill; the loop refills the active one
      tickFillRefs.current.forEach((el) => { if (el) el.style.width = ""; });
      autoT = 0;
      if (RM) draw();
    }
    function build() {
      const d = fitCanvas(canvas); W = d.w; H = d.h;
      if (!usPts.length) buildUS();
      if (!parts.length) {
        for (let i = 0; i < N; i++) parts.push({ x: Math.random(), y: Math.random(), tx: 0.5, ty: 0.5, r: Math.random() * 1.6 + 0.8, tw: Math.random() * 6.28, ts: Math.random() * 0.04 + 0.01 });
        thread = STAGE_THREAD[0].map((p) => [p[0], p[1]]);
        retarget(stateRef.current, true);
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const light = isLightTheme(), gold = goldRGB(light), state = stateRef.current;
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        p.x += (p.tx - p.x) * 0.06; p.y += (p.ty - p.y) * 0.06; p.tw += p.ts;
        const px = p.x * W, py = p.y * H, fl = 0.5 + Math.sin(p.tw) * 0.5;
        const al = state === 0 && i >= usPts.length ? 0.1 * fl : 0.35 + 0.5 * fl;
        ctx.beginPath(); ctx.arc(px, py, p.r, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + al + ")";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.8)"; ctx.shadowBlur = p.r * 3.5; ctx.fill(); ctx.shadowBlur = 0;
      }
      for (let c = 0; c < thread.length; c++) {
        thread[c][0] += (threadTarget[c][0] - thread[c][0]) * 0.06;
        thread[c][1] += (threadTarget[c][1] - thread[c][1]) * 0.06;
      }
      const tp = thread.map((p) => [p[0] * W, p[1] * H]), closed = state === 2;
      ctx.beginPath(); ctx.moveTo(tp[0][0], tp[0][1]);
      for (let i = 0; i < tp.length - 1; i++) { const cu = tp[i], nx = tp[i + 1]; ctx.quadraticCurveTo(cu[0], cu[1], (cu[0] + nx[0]) / 2, (cu[1] + nx[1]) / 2); }
      ctx.lineTo(tp[tp.length - 1][0], tp[tp.length - 1][1]);
      if (closed) ctx.lineTo(tp[0][0], tp[0][1]);
      const lg = ctx.createLinearGradient(0, 0, W, H);
      lg.addColorStop(0, "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.85)");
      lg.addColorStop(1, "rgba(" + Math.round(gold[0] * 0.8) + "," + Math.round(gold[1] * 0.75) + "," + Math.round(gold[2] * 0.6) + ",.85)");
      ctx.strokeStyle = lg; ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.6)"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
      for (let i = 0; i < tp.length; i++) {
        ctx.beginPath(); ctx.arc(tp[i][0], tp[i][1], 3, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.95)";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.9)"; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    function loop(ts) {
      if (!lastTime) lastTime = ts;
      const dt = ts - lastTime; lastTime = ts;
      autoT += dt;
      const frac = Math.min(autoT / AUTO, 1);
      const fill = tickFillRefs.current[stateRef.current];
      if (fill) fill.style.width = (frac * 100) + "%";
      if (autoT >= AUTO) advance();
      draw();
      raf = requestAnimationFrame(loop);
    }
    function startC() { if (running) return; running = true; lastTime = 0; if (RM) { draw(); return; } raf = requestAnimationFrame(loop); }
    function stopC() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    apiRef.current = { set: (s) => retarget(s, false) };
    const ro = new ResizeObserver(build); ro.observe(canvas); build();
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? startC() : stopC())); }, { threshold: 0.15 });
    io.observe(section);
    const onVis = () => { document.hidden ? stopC() : (isOnScreen(section) && startC()); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopC(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); apiRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── ACT IV — source filament: 8 feeds flow inward to the one verdict dot. */
function useFilament({ canvasRef, sectionRef }) {
  useEffect(() => {
    const canvas = canvasRef.current, section = sectionRef.current;
    if (!canvas || !section) return undefined;
    const RM = prefersReduced();
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = null, running = false, t = 0;
    function build() { const d = fitCanvas(canvas); W = d.w; H = d.h; }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const gold = goldRGB(isLightTheme());
      const cx = W * 0.5, cy = H * 0.82, srcY = H * 0.34, n = 8;
      for (let i = 0; i < n; i++) {
        const sx = ((i + 0.5) / n) * W, sy = srcY;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + cx) / 2, (sy + cy) / 2 - 20, cx, cy);
        ctx.strokeStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.08)"; ctx.lineWidth = 1; ctx.stroke();
        const ph = (t * 0.0006 + i / n) % 1;
        const qx = (1 - ph) * (1 - ph) * sx + 2 * (1 - ph) * ph * ((sx + cx) / 2) + ph * ph * cx;
        const qy = (1 - ph) * (1 - ph) * sy + 2 * (1 - ph) * ph * ((sy + cy) / 2 - 20) + ph * ph * cy;
        ctx.beginPath(); ctx.arc(qx, qy, 1.6, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (0.5 * (1 - Math.abs(ph - 0.5) * 1.6)) + ")";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.8)"; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
      }
      t += 16;
    }
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    function startC() { if (running) return; running = true; if (RM) { draw(); return; } loop(); }
    function stopC() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    const ro = new ResizeObserver(build); ro.observe(canvas); build();
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? startC() : stopC())); }, { threshold: 0.1 });
    io.observe(section);
    const onVis = () => { document.hidden ? stopC() : (isOnScreen(section) && startC()); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopC(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── ACT VI — the close: the hero's misted ridgelines reprised, rising out of
   the cream→green transition, with drifting motes. */
function useCtaCanvas({ canvasRef, sectionRef }) {
  useEffect(() => {
    const canvas = canvasRef.current, section = sectionRef.current;
    if (!canvas || !section) return undefined;
    const RM = prefersReduced();
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = null, running = false, ridges = [], motes = [];
    const rnd = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const rh = (rg, xn) => {
      let s = 0, wt = 0;
      for (let k = 0; k < rg.h.length; k++) { const o = rg.h[k]; s += Math.sin(xn * 6.2832 * o.f + o.p) * o.w; wt += o.w; }
      return rg.baseY - rg.amp * ((s / wt) * 0.5 + 0.5);
    };
    const nm = () => ({ x: Math.random() * W, y: H * 0.45 + Math.random() * H * 0.55, r: Math.random() * 1.6 + 0.6, vy: -(Math.random() * 0.22 + 0.05), vx: (Math.random() - 0.5) * 0.1, a: Math.random() * 0.5 + 0.2, tw: Math.random() * 6.28, ts: Math.random() * 0.03 + 0.01 });
    function build() {
      const d = fitCanvas(canvas); W = d.w; H = d.h; ridges = [];
      [{ y: 0.74, amp: 0.1, depth: 0.4, seed: 23 }, { y: 0.86, amp: 0.13, depth: 0.7, seed: 59 }, { y: 0.98, amp: 0.16, depth: 1, seed: 83 }].forEach((c) => {
        const r = rnd(c.seed);
        const h = [{ f: 0.7 + r() * 0.5, p: r() * 6.28, w: 1 }, { f: 1.5 + r() * 0.7, p: r() * 6.28, w: 0.55 }, { f: 2.6 + r() * 1.1, p: r() * 6.28, w: 0.3 }, { f: 12 + Math.floor(r() * 10), p: r() * 6.28, w: 0.05 + c.depth * 0.05 }];
        ridges.push({ baseY: H * c.y, amp: H * c.amp, depth: c.depth, h });
      });
      if (!motes.length) for (let i = 0; i < 26; i++) motes.push(nm());
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const light = isLightTheme();
      for (let l = 0; l < ridges.length; l++) {
        const rg = ridges[l], N = 80;
        ctx.beginPath(); ctx.moveTo(-60, H + 60); ctx.lineTo(-60, rh(rg, -0.05));
        for (let i = 0; i <= N; i++) { const xn = i / N; ctx.lineTo(xn * W, rh(rg, xn)); }
        ctx.lineTo(W + 60, rh(rg, 1.05)); ctx.lineTo(W + 60, H + 60); ctx.closePath();
        const g = ctx.createLinearGradient(0, rg.baseY - rg.amp, 0, H);
        if (light) { g.addColorStop(0, "rgba(7,32,23," + (0.36 + rg.depth * 0.22) + ")"); g.addColorStop(1, "rgba(5,22,16," + (0.66 + rg.depth * 0.26) + ")"); }
        else { g.addColorStop(0, "rgba(11,27,18," + (0.5 + rg.depth * 0.2) + ")"); g.addColorStop(1, "rgba(3,9,6," + (0.82 + rg.depth * 0.16) + ")"); }
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const xn = i / N, x = xn * W, y = rh(rg, xn); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = light ? "rgba(198,166,99," + (0.1 + rg.depth * 0.1) + ")" : "rgba(232,207,154," + (0.07 + rg.depth * 0.11) + ")";
        ctx.lineWidth = 1; ctx.shadowColor = light ? "rgba(198,166,99,.4)" : "rgba(232,207,154,.5)"; ctx.shadowBlur = 6 + rg.depth * 6; ctx.stroke(); ctx.shadowBlur = 0;
      }
      const gold = light ? [198, 166, 99] : [232, 207, 154];
      for (let m = 0; m < motes.length; m++) {
        const o = motes[m];
        o.x += o.vx; o.y += o.vy; o.tw += o.ts; o.vy = o.vy * 0.99 - 0.004;
        if (o.y < H * 0.3 || o.x < -10 || o.x > W + 10) { motes[m] = nm(); motes[m].y = H + 6; continue; }
        const fl = 0.5 + Math.sin(o.tw) * 0.5;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832);
        ctx.fillStyle = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + "," + (o.a * fl) + ")";
        ctx.shadowColor = "rgba(" + gold[0] + "," + gold[1] + "," + gold[2] + ",.9)"; ctx.shadowBlur = o.r * 3.5; ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    function loop() { draw(); raf = requestAnimationFrame(loop); }
    function startC() { if (running) return; running = true; if (RM) { draw(); return; } loop(); }
    function stopC() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    const ro = new ResizeObserver(build); ro.observe(canvas); build();
    const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? startC() : stopC())); }, { threshold: 0.05 });
    io.observe(section);
    const onVis = () => { document.hidden ? stopC() : (isOnScreen(section) && startC()); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopC(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── small pieces ──────────────────────────────────────────────────────── */

// Engine verdict card — live Verdict Engine. Loading = muted READING…, failure
// = quiet Buddy-voice fallback; the bucket colors are the semantic tokens.
function ParkCard({ name, v, delayClass }) {
  return (
    <div className={"park-card reveal shimmer-edge " + delayClass}>
      <div className="pc-top">
        <h4 className="display">{name}</h4>
        {v == null ? (
          <span className="chip reading"><span className="hb still" />READING…</span>
        ) : v.failed ? (
          <span className="chip reading">OFFLINE</span>
        ) : (
          <span className={"chip " + v.bucket}><span className="hb" />{v.bucket.toUpperCase()}</span>
        )}
      </div>
      {v == null ? (
        <div className="reason skel" aria-hidden="true"><span /><span /></div>
      ) : v.failed ? (
        <p className="reason">Live verdict unavailable right now — if I can&apos;t verify it, I don&apos;t show it.</p>
      ) : (
        <p className="reason">{((v.chips || []).slice(0, 2).map((c) => c.t).join(" · ") || v.word) + "."}</p>
      )}
      <div className="meta">
        {v && !v.failed ? (
          <>
            <span>{v.temp != null ? v.temp + "°F" : ""}{v.sky ? (v.temp != null ? " · " : "") + v.sky : ""}</span>
            <span>NWS · {v.at}</span>
          </>
        ) : (
          <span>NWS · live</span>
        )}
      </div>
    </div>
  );
}

// Things-to-do trio: the tour card — real Viator tour (title, from-price,
// photo, /tours/:code). Empty or failed: the design placeholder, no price.
function TourCard({ tour, fallbackPhoto }) {
  const real = tour && !tour.failed;
  const href = real && tour.code ? "/tours/" + tour.code : "/book?cat=tours";
  const photoUrl = (real && tour.photo) || (fallbackPhoto && fallbackPhoto.url) || null;
  return (
    <Link href={href} className="todo-card todo-link reveal d1 shimmer-edge">
      {photoUrl ? (
        <span className="todo-photo"><img src={photoUrl} alt="" loading="lazy" /></span>
      ) : (
        <div className="photo-slot"><span className="mono">PHOTO — guided canyon rim tour</span></div>
      )}
      <div className="tt">
        <h4 className="display" style={tour == null ? { color: "var(--pb-muted)" } : undefined}>{real ? tour.title : tour == null ? "Reading the catalog…" : "Guided tours"}</h4>
        {real && tour.fromPrice != null && <span className="price">from ${Math.round(tour.fromPrice)}</span>}
      </div>
      <p>{real ? "A real bookable tour near Rocky Mountain — live from the catalog." : "Small-group tours departing the gateway town, guide included."}</p>
      <p className="disc">Booked via Viator — supports Park Buddy at no cost to you.</p>
    </Link>
  );
}

// Wildlife flip card — /api/wildlife (iNaturalist research-grade sightings).
// Front: top mammal count; back: the live caution list with real guidance.
// Failure keeps the design's curated copy, numbers removed.
function WildlifeFlip({ w }) {
  const [flipped, setFlipped] = useState(false);
  const fmtObs = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));
  const real = w && !w.failed;
  return (
    <div
      className={"wildlife-flip reveal d3" + (flipped ? " flipped" : "")}
      tabIndex={0}
      role="button"
      aria-label="Wildlife — tap to flip"
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
    >
      <div className="flip-inner">
        <div className="flip-face">
          <span className="mono" style={{ color: "var(--pb-gold-soft)" }}>Wildlife · iNaturalist</span>
          {w == null ? (
            <>
              <div className="big display" style={{ marginTop: 14, color: "var(--pb-muted)" }}>·····</div>
              <p style={{ color: "var(--pb-muted)", fontSize: "13.5px", marginTop: 6, fontFamily: "var(--pb-mono)", letterSpacing: ".12em", textTransform: "uppercase" }}>Reading the field…</p>
            </>
          ) : real ? (
            <>
              <div className="big display" style={{ marginTop: 14 }}>{fmtObs(w.top.obs)}+</div>
              <p style={{ color: "var(--pb-ink-2)", fontSize: "13.5px", marginTop: 6 }}>research-grade {w.top.name.toLowerCase()} sightings near Rocky Mountain, ranked in our top-10.</p>
            </>
          ) : (
            <p style={{ color: "var(--pb-ink-2)", fontSize: "13.5px", marginTop: 14 }}>Research-grade wildlife sightings near Rocky Mountain — live from iNaturalist.</p>
          )}
          <span className="flip-hint">Hover / tap for the caution list →</span>
        </div>
        <div className="flip-face flip-back">
          <h4 className="display">⚠ Watch out for</h4>
          {real && w.caution.length ? (
            <ul>
              {w.caution.map((c) => (
                <li key={c.name}><b>{c.name}</b>{c.note ? " — " + c.note : ""}</li>
              ))}
            </ul>
          ) : real ? (
            <p style={{ color: "var(--pb-ink-2)", fontSize: "14px" }}>No confirmed hazard species outside the top sightings right now.</p>
          ) : (
            <ul>
              <li><b>Black bear</b> — store food in lockers; 100 ft distance.</li>
              <li><b>Moose</b> — unpredictable in fall rut; give 75 ft.</li>
              <li><b>Rattlesnake</b> — confirmed on lower trails; watch your step.</li>
            </ul>
          )}
          <span className="flip-hint">Confirmed sightings only — real safety guidance.</span>
        </div>
      </div>
    </div>
  );
}

// Pines email capture → POST /api/pines-waitlist (validation/busy/success/error
// states follow BookHub's notify()).
function PinesCapture() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/pines-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "landing-pines" }),
      });
      if (r.ok) setSent(true);
      else { const d = await r.json().catch(() => ({})); setErr(d.error || "Couldn't save just now — try again."); }
    } catch { setErr("Couldn't reach the list — try again."); }
    setBusy(false);
  };
  if (sent) {
    return <p className="capture-done">You&apos;re on the list ✓ — I&apos;ll email you the moment Pines opens.</p>;
  }
  return (
    <>
      <form className="capture" onSubmit={submit}>
        <input
          type="email"
          placeholder="Your email for early access"
          aria-label="Email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }}
        />
        <button type="submit" disabled={busy}>{busy ? "…" : "Notify me"}</button>
      </form>
      {err && <p className="capture-err">{err}</p>}
    </>
  );
}

// The fanned 9:16 film frames — real reels. Center frame plays (muted loop);
// side frames are posters. Only three reels exist, so the two outermost frames
// reuse alternate crops of the same footage (unlabeled duplicates).
const PINES_FRAMES = [
  { cls: "f0", img: "/media/landing/reel-sequoia.jpg", pos: "50% 20%", lbl: "Sequoia" },
  { cls: "f1", img: "/media/landing/reel-teton.jpg", pos: "50% 50%", lbl: "Grand Teton" },
  { cls: "f2", img: "/media/landing/reel-glacier.jpg", video: "/media/landing/reel-glacier.mp4", pos: "50% 50%", lbl: "Glacier" },
  { cls: "f3", img: "/media/landing/reel-sequoia.jpg", pos: "50% 80%", lbl: "Sequoia" },
  { cls: "f4", img: "/media/landing/reel-teton.jpg", pos: "50% 85%", lbl: "Grand Teton" },
];

/* ── the page ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const rootRef = useRef(null);
  useThemedBody(rootRef); // body follows the page bg across the theme toggle
  const reduced = usePrefersReducedMotion();
  // Videos mount only after the client confirms motion is OK — server HTML and
  // client render #1 both show posters, so hydration always matches.
  const [motionOK, setMotionOK] = useState(false);
  useEffect(() => { setMotionOK(!reduced); }, [reduced]);

  // ── live data (see each act's comment for the feed)
  const vRocky = useVerdict(ROCKY.lat, ROCKY.lng);       // hero chip + engine card
  const vYosemite = useVerdict(YOSEMITE.lat, YOSEMITE.lng);
  const vGlacier = useVerdict(GLACIER.lat, GLACIER.lng);
  const wildlife = useWildlife(ROCKY.lat, ROCKY.lng);
  const tour = useTour(ROCKY.lat, ROCKY.lng);
  const rangerTodo = useRangerTodo();
  // Real photos for the last placeholder slots (Wikimedia via /api/photo):
  // the tour-card fallback and the stage's ranger-walk mini. Real places,
  // never stock.
  // Distinct chain from the ranger card's park photo so the trio never
  // shows the same image twice.
  // w=900 keeps Wikimedia from handing back multi-thousand-pixel originals
  // for card-sized frames.
  const tourFallbackPhoto = usePhoto("Longs Peak|Trail Ridge Road|Moraine Park", 40.2549, -105.6151, undefined, 900);
  const sunriseWalkPhoto = usePhoto("Bear Lake (Colorado)|Bear Lake, Colorado|Dream Lake", 40.3131, -105.648, undefined, 900);
  const rangerFallbackPhoto = usePhoto("Rocky Mountain National Park", ROCKY.lat, ROCKY.lng, undefined, 900);

  // ── refs for the canvas systems + choreography
  const ovRef = useRef(null), ovCanvasRef = useRef(null), ovBadgeRef = useRef(null), ovSealRef = useRef(null), ovSkipRef = useRef(null);
  const heroRef = useRef(null), heroCanvasRef = useRef(null), heroVideoRef = useRef(null);
  const heroSeedRef = useRef(null);
  const heroSubRef = useRef(null), heroCtaRef = useRef(null), ribbonRef = useRef(null);
  const birdsRef = useRef(null);
  const atlasRef = useRef(null), atlasCanvasRef = useRef(null), atlasApiRef = useRef(null);
  const stageSecRef = useRef(null), stageCanvasRef = useRef(null), stageApiRef = useRef(null);
  const engineRef = useRef(null), filamentRef = useRef(null);
  const ctaRef = useRef(null), ctaCanvasRef = useRef(null);
  const pinesRef = useRef(null), reelRef = useRef(null);
  const tickFillRefs = useRef([]);
  const heroTimers = useRef([]);
  const revealedRef = useRef(false);

  // ── atlas + stage state (panels/overlays in React; canvases read refs)
  const [atlasActive, setAtlasActive] = useState(0);
  const atlasActiveRef = useRef(0);
  atlasActiveRef.current = atlasActive;
  const atlasHoverLock = useRef(false);
  const [stageState, setStageState] = useState(0);
  const stageStateRef = useRef(0);
  stageStateRef.current = stageState;
  useEffect(() => { if (atlasApiRef.current) atlasApiRef.current.redraw(); }, [atlasActive]);
  useEffect(() => { if (stageApiRef.current) stageApiRef.current.set(stageState); }, [stageState]);
  const stageAdvance = useCallback(() => setStageState((s) => (s + 1) % 4), []);
  const stageJump = useCallback((s) => setStageState(s), []);

  // Hero reveal choreography — words condense in, then sub → CTAs → ribbon.
  // Called by the overture (mid-glide), by skip, or instantly when already seen.
  const revealPage = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    const root = rootRef.current;
    if (!root) return;
    root.classList.add("ready");
    const words = root.querySelectorAll(".hero-h1 .word");
    words.forEach((w, i) => heroTimers.current.push(setTimeout(() => w.classList.add("on"), i * 90)));
    const base = words.length * 90;
    heroTimers.current.push(setTimeout(() => { heroSubRef.current && heroSubRef.current.classList.add("on"); }, base + 80));
    heroTimers.current.push(setTimeout(() => { heroCtaRef.current && heroCtaRef.current.classList.add("on"); }, base + 220));
    heroTimers.current.push(setTimeout(() => { ribbonRef.current && ribbonRef.current.classList.add("on"); }, base + 360));
  }, []);
  useEffect(() => () => { heroTimers.current.forEach(clearTimeout); }, []);

  // ── the seven canvas systems
  useOverture({ ovRef, canvasRef: ovCanvasRef, badgeRef: ovBadgeRef, sealRef: ovSealRef, skipRef: ovSkipRef, heroSeedRef, reveal: revealPage });
  useHeroCanvas({ canvasRef: heroCanvasRef, heroRef, heroSeedRef });
  // Page-wide flock retired (owner call 2026-07-22: constant birds over the
  // content read as noise). The birds keep their two meaningful homes — the
  // overture, and the fireflies they dissolve into. useFlock kept below for
  // an easy re-enable.
  // useFlock({ canvasRef: birdsRef });
  useAtlas({ canvasRef: atlasCanvasRef, sectionRef: atlasRef, activeRef: atlasActiveRef, hoverLockRef: atlasHoverLock, setActive: setAtlasActive, apiRef: atlasApiRef });
  useStage({ canvasRef: stageCanvasRef, sectionRef: stageSecRef, stateRef: stageStateRef, tickFillRefs, advance: stageAdvance, apiRef: stageApiRef });
  useFilament({ canvasRef: filamentRef, sectionRef: engineRef });
  useCtaCanvas({ canvasRef: ctaCanvasRef, sectionRef: ctaRef });

  // Reveal-on-scroll (.reveal / .shimmer-edge) — one observer for the page.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.16 });
    root.querySelectorAll(".reveal,.shimmer-edge").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Magnetic buttons — fine pointers only, never under reduced motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReduced() || !window.matchMedia("(pointer:fine)").matches) return undefined;
    const els = Array.from(root.querySelectorAll(".magnetic"));
    const moves = els.map((btn) => {
      const onMove = (e) => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
        btn.style.transform = "translate(" + (mx * 0.18) + "px," + (my * 0.28) + "px)";
      };
      const onLeave = () => { btn.style.transform = ""; };
      btn.addEventListener("mousemove", onMove);
      btn.addEventListener("mouseleave", onLeave);
      return { btn, onMove, onLeave };
    });
    return () => moves.forEach(({ btn, onMove, onLeave }) => {
      btn.removeEventListener("mousemove", onMove);
      btn.removeEventListener("mouseleave", onLeave);
    });
  }, []);

  // Hero film + center reel: pause whenever their section leaves the viewport.
  useEffect(() => {
    if (!motionOK) return undefined;
    const pairs = [[heroRef.current, heroVideoRef.current], [pinesRef.current, reelRef.current]].filter(([s, v]) => s && v);
    const ios = pairs.map(([sec, vid]) => {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { vid.play && vid.play().catch(() => {}); }
        else { vid.pause && vid.pause(); }
      }, { threshold: 0.05 });
      io.observe(sec);
      return io;
    });
    return () => ios.forEach((io) => io.disconnect());
  }, [motionOK]);

  // Idle-time prefetch of Explore's boot scripts — the most-clicked CTA gets a
  // head start (cache-only; Explore's own loadScript calls then hit the cache).
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    const id = idle(() => {
      for (const href of ["/trip-data.js", "/pb-verdict.js", "/gateway-towns.js"]) {
        if (document.querySelector('link[href="' + href + '"]')) continue;
        const l = document.createElement("link");
        l.rel = "prefetch"; l.as = "script"; l.href = href;
        document.head.appendChild(l);
      }
    });
    return () => { (window.cancelIdleCallback || clearTimeout)(id); };
  }, []);

  // Ask Park Buddy — the shared widget pattern (same as SiteHeader's).
  const askBuddy = useCallback(async () => {
    let fab = document.querySelector(".pbask-fab, #askPill");
    if (!fab) {
      await loadScript("/ask-parkbuddy.js");
      fab = document.querySelector(".pbask-fab, #askPill");
    }
    if (fab) fab.click();
    else window.location.href = "/#ask";
  }, []);

  const atlasNode = ATLAS_NODES[atlasActive];

  return (
    <div ref={rootRef} className="pb-theme pbl5">
      {/* Without JS the overture overlay would sit on the page forever and the
          hero would stay at opacity 0 — hide/force them for noscript. */}
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: ".pbl5 #overture{display:none}.pbl5 .hero-h1 .word,.pbl5 .hero-sub,.pbl5 .hero-cta,.pbl5 .ribbon{opacity:1;transform:none;filter:none}" }} />
      </noscript>
      {/* ACT 0 — the overture (brand only; hidden pre-paint if already seen) */}
      <div id="overture" ref={ovRef} aria-hidden="true">
        <div className="ov-horizon" />
        <canvas ref={ovCanvasRef} />
        <div className="ov-badge" ref={ovBadgeRef}>
          <img src="/brand/the-park-buddy-badge.png" alt="" draggable={false} />
          <div className="ov-seal" ref={ovSealRef} />
        </div>
        <button type="button" className="ov-skip" ref={ovSkipRef}>enter ↵</button>
      </div>

      <SiteHeader active={null} acctSlot />

      {/* page-wide flock retired with its hook above — canvas stays out of the
          DOM entirely so nothing paints or resizes for it. */}

      <main>
        {/* ACT I — the living forest. Data: hero chip ← Verdict Engine (NWS)
            for Rocky Mountain; film = /media/landing/hero.mp4 (poster .jpg). */}
        <section id="hero" ref={heroRef}>
          <div className="hero-video">
            <img src="/media/landing/hero.jpg" alt="" />
            {motionOK && (
              <video ref={heroVideoRef} autoPlay muted loop playsInline preload="metadata" poster="/media/landing/hero.jpg" src="/media/landing/hero.mp4" />
            )}
          </div>
          <div className="atmos" />
          <canvas ref={heroCanvasRef} id="heroCanvas" />
          <div className="hero-inner">
            <div className={"verdict-chip" + (vRocky && !vRocky.failed ? " " + vRocky.bucket : "")}>
              {vRocky == null ? (
                <>
                  <span className="dot still" />
                  <b className="muted-b">READING…</b>
                  <span className="sep">·</span> Rocky Mountain
                </>
              ) : vRocky.failed ? (
                <>
                  <span className="dot still" />
                  <b className="muted-b">VERDICT OFFLINE</b>
                  <span className="sep">·</span> Rocky Mountain
                </>
              ) : (
                <>
                  <span className="dot" style={{ background: "var(--pb-" + vRocky.bucket + ")" }} />
                  <b style={{ color: "var(--pb-" + vRocky.bucket + ")" }}>{vRocky.bucket.toUpperCase()}</b>
                  <span className="sep">·</span> Rocky Mountain
                  {vRocky.temp != null && (<><span className="sep">·</span> {vRocky.temp}°F</>)}
                </>
              )}
            </div>
            <h1 className="display hero-h1">
              <span className="word">The</span> <span className="word">whole</span> <span className="word">trip</span>{" "}
              <span className="word"><em>lives</em></span> <span className="word">here.</span>
            </h1>
            <p className="hero-sub" ref={heroSubRef}>I&apos;m your Park Buddy. I&apos;ve read this morning&apos;s conditions across every US public land — the live map, the honest call, the day-by-day plan — so you don&apos;t have to. Ask me anything.</p>
            <div className="hero-cta" ref={heroCtaRef}>
              <Link href="/build-trip" className="big-gold magnetic">Plan my trip <span aria-hidden="true">→</span></Link>
              <button type="button" className="line-btn magnetic" onClick={askBuddy}>Ask Park Buddy</button>
            </div>
            <div className="ribbon" ref={ribbonRef}>
              <div className="ribbon-track">
                {[0, 1].map((k) => RIBBON_ITEMS.map((t) => <span key={k + t} className="ribbon-chip">{t}</span>))}
              </div>
            </div>
          </div>
          <div className="scroll-cue"><span className="mono">Scroll</span><span className="rail" /></div>
        </section>

        {/* ACT II — the atlas. Data: node stats are the real catalog counts
            (geo index; camping ← Recreation.gov; tours ← Viator). */}
        <section id="atlas" ref={atlasRef}>
          <div className="wrap">
            <div className="atlas-head reveal">
              <span className="eyebrow mono">The Atlas · everything that lives here</span>
              <h2 className="display">One map. All of it.</h2>
              <p>Eight kinds of place, one living index. Touch a star and I&apos;ll show you what I know — with receipts.</p>
            </div>
            <div className="atlas-stage reveal shimmer-edge">
              <canvas ref={atlasCanvasRef} id="atlasCanvas" />
              <div className="atlas-chips">
                {ATLAS_NODES.map((n, i) => (
                  <button
                    key={n.key}
                    type="button"
                    className={"atlas-chip" + (i === atlasActive ? " active" : "")}
                    onClick={() => { atlasHoverLock.current = true; setAtlasActive(i); }}
                  >
                    <span className="k">{n.key}</span><span className="v">{n.stat}</span>
                  </button>
                ))}
              </div>
              <div className="atlas-panel">
                <div className="swap" key={atlasActive}>
                  <span className="cat mono">{atlasNode.key} · what I know</span>
                  <div className="stat">{atlasNode.stat}</div>
                  <div className="buddy">“{atlasNode.buddy}”</div>
                  <ul className="facts">{atlasNode.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                  <div className="rel">{atlasNode.rel.map((r) => <span key={r}>{ATLAS_NODES[r].key}</span>)}</div>
                </div>
              </div>
            </div>
            <p className="atlas-hint mono">Hover a star to explore · tap the chips on mobile</p>
          </div>
        </section>

        {/* ACT III — one card, four lives. Data: map ← 63 parks + verdicts;
            itinerary ← Trip Studio (real artwork trip-itinerary-real.jpg);
            booking ← Viator + NPS; book ← Trip Books (trip-book-cover-real.jpg). */}
        <section id="stage" ref={stageSecRef}>
          <div className="wrap">
            <div className="stage-head reveal">
              <span className="eyebrow mono">The set-piece</span>
              <h2 className="display">One card. Four lives.</h2>
              <p>Explore it, plan it, book it, keep it forever — not four pages you scroll past, but one living surface that reshapes as your trip does. The gold thread never breaks.</p>
            </div>
            <div className="stage-grid">
              <div className="proof-col left">
                {STAGE_PROOFS_LEFT.map((pr, i) => (
                  <div key={pr.k} className={"proof" + (stageState === i ? " on" : "")}>
                    <span className="mono">{pr.k}</span><h4>{pr.h}</h4><p>{pr.p}</p>
                  </div>
                ))}
              </div>
              <div
                className="stage-card shimmer-edge reveal"
                role="button"
                tabIndex={0}
                aria-label="Advance the story"
                onClick={stageAdvance}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stageAdvance(); } }}
              >
                <canvas ref={stageCanvasRef} id="stageCanvas" />
                <div className="stage-overlay">
                  <div className={"stage-state" + (stageState === 0 ? " on" : "")}>
                    <span className="state-badge"><span className="mono">Explore · live map</span></span>
                    <h3 className="display">63 parks,<br />one constellation.</h3>
                    <p>Every point is a live verdict — gold where I say go this morning.</p>
                  </div>
                  <div className={"stage-state" + (stageState === 1 ? " on" : "")}>
                    <span className="state-badge"><span className="mono">Plan · trip studio</span></span>
                    <span className="state-visual"><img src="/media/landing/trip-itinerary-real.jpg" alt="Trip Studio itinerary" loading="lazy" /></span>
                    <h3 className="display">14 stops, 6 days,<br />zero guesswork.</h3>
                    <p>Real drive times, daylight-fit pacing, offline GPS on trail. Let&apos;s go.</p>
                  </div>
                  <div className={"stage-state" + (stageState === 2 ? " on" : "")}>
                    <span className="state-badge"><span className="mono">Book · things to do</span></span>
                    <div className="book-mini">
                      {sunriseWalkPhoto && sunriseWalkPhoto.url ? (
                        <div className="ph photo-slot" style={{ padding: 0, overflow: "hidden" }}>
                          <img src={sunriseWalkPhoto.url} alt="Sunrise at Bear Lake, Rocky Mountain National Park" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      ) : (
                        <div className="ph photo-slot"><span className="mono">PHOTO — ranger-led sunrise walk</span></div>
                      )}
                      <div className="row">
                        <span className="price">Free<span className="price-sub"> · NPS ranger walk</span></span>
                        <span className="go"><span className="d" />GO</span>
                      </div>
                      <p className="disc">Paid tours via Viator — booking supports Park Buddy at no cost to you.</p>
                    </div>
                  </div>
                  <div className={"stage-state" + (stageState === 3 ? " on" : "")}>
                    <span className="state-badge"><span className="mono">Remember · trip book</span></span>
                    <span className="state-visual tall"><img src="/media/landing/trip-book-cover-real.jpg" alt="Trip Book cover" loading="lazy" /></span>
                    <h3 className="display">The trip,<br />bound in gold.</h3>
                    <p>Print the whole journey as a real hardcover afterward.</p>
                  </div>
                </div>
              </div>
              <div className="proof-col right">
                {STAGE_PROOFS_RIGHT.map((pr, i) => (
                  <div key={pr.k} className={"proof" + (stageState === i ? " on" : "")}>
                    <span className="mono">{pr.k}</span><h4>{pr.h}</h4><p>{pr.p}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="stage-progress">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={"tick" + (i < stageState ? " done" : "")}
                  role="button"
                  tabIndex={0}
                  aria-label={"Go to state " + (i + 1)}
                  onClick={(e) => { e.stopPropagation(); stageJump(i); }}
                  onKeyDown={(e) => { if (e.key === "Enter") stageJump(i); }}
                >
                  <i ref={(el) => { tickFillRefs.current[i] = el; }} />
                </span>
              ))}
            </div>
            <p className="stage-hint mono">Tap the card to move · auto-advances</p>
          </div>
        </section>

        {/* ACT IV — the honest machine. Data: three live verdicts (Verdict
            Engine), tour ← /api/tours (Viator), wildlife ← /api/wildlife. */}
        <section id="engine" ref={engineRef}>
          <div className="wrap">
            <div className="engine-head reveal">
              <span className="eyebrow mono">The honest machine</span>
              <h2 className="display">One honest call, every park, every morning.</h2>
              <p>Every park gets one plain verdict from live data — not a vibe, not a star rating.</p>
              <p className="creed">“If I can&apos;t verify it, I don&apos;t show it.”</p>
            </div>
            <div className="park-row">
              <ParkCard name={ROCKY.name} v={vRocky} delayClass="d1" />
              <ParkCard name={YOSEMITE.name} v={vYosemite} delayClass="d2" />
              <ParkCard name={GLACIER.name} v={vGlacier} delayClass="d3" />
            </div>
            <div className="machine">
              <div className="sources reveal shimmer-edge">
                <canvas ref={filamentRef} id="filamentCanvas" />
                <div className="src-inner">
                  <span className="mono">Eight feeds, one verdict</span>
                  <div className="src-list">
                    {["NPS", "NWS", "USGS", "USFS", "Recreation.gov", "OpenStreetMap", "iNaturalist", "Wikimedia"].map((s) => (
                      <span key={s} className="src-tag">{s}</span>
                    ))}
                  </div>
                  <div className="verdict-dot-wrap"><span className="verdict-dot" /><b>LIVE VERDICT{vRocky && !vRocky.failed ? " · " + vRocky.at : ""}</b></div>
                </div>
              </div>
              <div className="alerts-card reveal d2 shimmer-edge">
                <span className="mono" style={{ color: "var(--pb-gold-soft)" }}>Alerts, if you want them</span>
                <p className="alerts-h">I&apos;ll ping you the second it changes.</p>
                <p className="alerts-p">Verdict flips · permit drops · road &amp; pass openings · flash-flood watch · first snow.</p>
              </div>
            </div>
            <div className="todo-head reveal">
              <p className="creed">Things to do on every single page — booked, free, and wild.</p>
            </div>
            <div className="trio">
              <TourCard tour={tour} fallbackPhoto={tourFallbackPhoto} />
              <div className="todo-card reveal d2 shimmer-edge">
                {rangerTodo && !rangerTodo.failed ? (
                  <span className="todo-photo"><img src={rangerTodo.img} alt="" loading="lazy" /></span>
                ) : rangerFallbackPhoto && rangerFallbackPhoto.url ? (
                  <span className="todo-photo"><img src={rangerFallbackPhoto.url} alt="" loading="lazy" /></span>
                ) : (
                  <div className="photo-slot"><span className="mono">PHOTO — ranger geology talk</span></div>
                )}
                <div className="tt"><h4 className="display">{rangerTodo && !rangerTodo.failed ? rangerTodo.title : "Ranger activity"}</h4><span className="free">FREE WITH ENTRY</span></div>
                <p>NPS ranger-curated walks and talks — real programs, on the park&apos;s own schedule.</p>
                <p className="disc">Straight from the National Park Service calendar.</p>
              </div>
              <WildlifeFlip w={wildlife} />
            </div>
          </div>
        </section>

        {/* ACT V — Pines + Trip Books. Data: real reels (geo-locked films),
            email ← /api/pines-waitlist, book cover ← trip-book-cover-real.jpg. */}
        <section id="pines" ref={pinesRef}>
          <div className="wrap">
            <div className="pines-head reveal">
              <span className="eyebrow mono">Pines · now launching</span>
              <h2 className="display">Films from inside the parks.</h2>
              <p>Short vertical films, geo-locked to where they were shot. Stand on the spot to press play — you can&apos;t fake a Pine.</p>
            </div>
            <div className="pines-band">
              <div className="film-fan reveal">
                {PINES_FRAMES.map((f) => (
                  <div key={f.cls} className={"frame " + f.cls}>
                    <img src={f.img} alt="" loading="lazy" style={{ objectPosition: f.pos }} />
                    {f.video && motionOK && (
                      <video ref={reelRef} muted loop playsInline preload="metadata" poster={f.img} src={f.video} />
                    )}
                    <span className="lbl">{f.lbl}</span>
                    {f.video && <span className="play" />}
                    <span className="stamp"><span className="pin" />Verified on location</span>
                  </div>
                ))}
              </div>
              <div className="pines-copy reveal d2">
                <h3 className="display">Geo-locked. GPS-verified.<br /><span className="gold-text">Impossible to fake.</span></h3>
                <p>Every Pine is stamped to the exact coordinates it was filmed. The community that makes them is the Buddies. Want in early?</p>
                <PinesCapture />
              </div>
            </div>
            <div className="book-row">
              <div className="tripbook reveal">
                <div className="book">
                  <div className="spine" />
                  <div className="pages" />
                  <div className="cover"><img src="/media/landing/trip-book-cover-real.jpg" alt="Trip Book cover" loading="lazy" /></div>
                </div>
              </div>
              <div className="book-copy reveal d2">
                <h3 className="display">When it&apos;s over,<br />keep it forever.</h3>
                <p>After the trip, I&apos;ll lay out your route, photos and story in Book Studio and ship a real, print-quality hardcover to your door.</p>
                <div className="feats"><span>Print-quality photos</span><span>Hard / softcover</span><span>Shipped to you</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ACT VI — the close. close.jpg under the cream→green gradient. */}
        <section id="cta" ref={ctaRef}>
          <div className="cta-bg" aria-hidden="true" />
          <div className="cta-grad" aria-hidden="true" />
          <canvas ref={ctaCanvasRef} id="ctaCanvas" />
          <div className="wrap">
            <h2 className="display reveal">Your parks are waiting.<br /><span className="gold-text cta-em">I&apos;ll watch the weather.</span></h2>
            <div className="cta-row reveal d1">
              <Link href="/build-trip" className="big-gold magnetic">Start your trip <span aria-hidden="true">→</span></Link>
              <button type="button" className="line-btn magnetic" onClick={askBuddy}>Ask me anything</button>
            </div>
            <p className="sig reveal d2">— I&apos;m your Park Buddy · companion for every US public land</p>
          </div>
        </section>
      </main>

      <footer id="footer">
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="brand-line">
                <img src="/brand/the-park-buddy-badge.png" alt="The Park Buddy" width={30} height={30} loading="lazy" />
                <b>Park Buddy</b>
              </div>
              <p>One companion for all US public lands. Honest verdicts, real plans, nothing invented.</p>
            </div>
            <div className="foot-col">
              <h5>Explore</h5>
              <Link href="/explore">Live map</Link>
              <Link href="/parks">Parks</Link>
              <Link href="/forests">Forests</Link>
              <Link href="/scenic-drives">Scenic drives</Link>
              <Link href="/towns">Towns</Link>
              <Link href="/build-trip">Trip Studio</Link>
            </div>
            <div className="foot-col">
              <h5>Company</h5>
              <Link href="/pines">Pines</Link>
              <Link href="/book">Trip Books</Link>
              <Link href="/shop">Shop</Link>
              <Link href="/about">About</Link>
            </div>
            <div className="foot-col">
              <h5>Sources</h5>
              <span className="src">NPS · NWS · USGS</span>
              <span className="src">USFS · Rec.gov</span>
              <span className="src">OSM · iNaturalist</span>
              <span className="src">Wikimedia</span>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Park Buddy. Data from public sources, cited in-app.</span>
            <span className="foot-legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></span>
            <span className="mono">If I can&apos;t verify it, I don&apos;t show it.</span>
          </div>
        </div>
      </footer>

      {/* dangerouslySetInnerHTML is LOAD-BEARING: a plain <style> text child is
          HTML-escaped on the server but not the client, which kills hydration
          for the whole page. Never convert this back to a text child. */}
      <style dangerouslySetInnerHTML={{ __html: `
/* ── landing v5 — prototype CSS scoped under .pbl5. Tokens come from
   globals.css; only genuinely NEW tokens are defined here. ─────────────── */
.pbl5{
  --pb-bg-3:#050c08; --pb-scrim:rgba(8,19,13,.62);
  --pb-glass-brd:rgba(217,183,121,.14);
  --pb-r-lg:24px; --pb-r-md:18px; --pb-r-pill:999px;
  background:var(--pb-bg); color:var(--pb-ink);
  font-family:var(--pb-sans); font-size:16px; line-height:1.55;
  -webkit-font-smoothing:antialiased;
  transition:background .6s ease, color .6s ease;
  overflow-x:clip;
}
html[data-theme="light"] .pbl5{
  --pb-bg-3:#0f3a29; --pb-scrim:rgba(239,230,207,.58);
  --pb-glass-brd:rgba(16,46,32,.20);
}
/* Bottom bands stay deep forest in light theme — re-tokenised so text & gold
   read on green. color: must be set HERE (computed inheritance gotcha). */
html[data-theme="light"] .pbl5 #cta, html[data-theme="light"] .pbl5 #footer{
  color:var(--pb-ink);
  --pb-ink:#f6efdd; --pb-ink-2:#cdbf9f; --pb-muted:#9a8e6f;
  --pb-gold:#e8cf9a; --pb-gold-soft:#d9b779;
  --pb-grad-gold:linear-gradient(120deg,#e8cf9a,#c9a35f);
  --pb-line:rgba(217,183,121,.18); --pb-line-strong:rgba(217,183,121,.30);
}
.pbl5 a{color:var(--pb-gold-soft); text-decoration:none; transition:color .25s ease;}
.pbl5 a:hover{color:var(--pb-gold);}
.pbl5 img{max-width:100%;}
.pbl5 ::selection{background:var(--pb-gold); color:var(--pb-bg);}
.pbl5 .display{font-family:var(--pb-serif); font-weight:600; line-height:1.02; letter-spacing:-.01em; text-wrap:balance; margin:0;}
.pbl5 .mono{font-family:var(--pb-mono); text-transform:uppercase; letter-spacing:.18em; font-size:11px; color:var(--pb-muted);}
.pbl5 .gold-text{background:var(--pb-grad-gold); -webkit-background-clip:text; background-clip:text; color:transparent;}
.pbl5 .wrap{max-width:1180px; margin:0 auto; padding:0 32px; width:100%; position:relative; z-index:6;}
.pbl5 h2,.pbl5 h3,.pbl5 h4,.pbl5 p{margin:0;}
.pbl5 section{position:relative;}

/* photo / film placeholder slots */
.pbl5 .photo-slot{
  background:var(--pb-surface-2); position:relative; overflow:hidden;
  border:1px solid var(--pb-line); border-radius:var(--pb-r-md);
  display:flex; align-items:flex-end; padding:14px;
  background-image:repeating-linear-gradient(135deg,transparent 0 11px,rgba(217,183,121,.05) 11px 12px);
}
.pbl5 .photo-slot .mono{color:var(--pb-gold-soft); opacity:.8;}

/* page-wide flock: above section backgrounds (z:auto), below .wrap (z:6) */
.pbl5 .pbl5-birds{position:fixed; inset:0; z-index:5; width:100%; height:100vh; pointer-events:none;}

/* ── overture ── */
.pbl5 #overture{position:fixed; inset:0; z-index:200; background:var(--pb-bg-2); overflow:hidden;
  transition:opacity .6s ease; display:flex; align-items:center; justify-content:center;}
.pbl5 #overture.gone{opacity:0; pointer-events:none;}
.pbl5 #overture > canvas{position:absolute; inset:0; width:100%; height:100%;}
.pbl5 .ov-horizon{position:absolute; left:0; right:0; bottom:0; height:44%; z-index:0; pointer-events:none;
  background:radial-gradient(120% 100% at 50% 100%, rgba(232,207,154,.10), transparent 62%);
  animation:atmos-drift 6s ease-in-out infinite alternate;}
.pbl5 .ov-badge{position:absolute; z-index:2; width:190px; height:190px;
  display:flex; align-items:center; justify-content:center;
  opacity:0; transform:translateZ(0);}
.pbl5 .ov-badge img{width:170px; height:170px; object-fit:contain;
  filter:drop-shadow(0 30px 80px rgba(0,0,0,.7));}
.pbl5 .ov-seal{position:absolute; inset:-12px; border-radius:50%; pointer-events:none;
  background:conic-gradient(from -90deg, transparent 0deg, var(--pb-gold) 18deg, transparent 40deg);
  -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  opacity:0;}
.pbl5 .ov-skip{position:absolute; right:26px; bottom:22px; z-index:3; cursor:pointer; background:none; border:0;
  font-family:var(--pb-mono); text-transform:uppercase; letter-spacing:.2em; font-size:11px;
  color:rgba(217,183,121,.7); transition:color .3s ease;}
.pbl5 .ov-skip:hover{color:var(--pb-gold);}

/* ── shared entrance language ── */
.pbl5 .eyebrow{display:inline-flex; align-items:center; gap:10px; margin-bottom:22px;}
.pbl5 .eyebrow::before{content:""; width:26px; height:1px; background:var(--pb-line-strong);}
.pbl5 .reveal{opacity:0; transform:translateY(26px); transition:opacity .7s cubic-bezier(.23,1,.32,1), transform .7s cubic-bezier(.23,1,.32,1);}
.pbl5 .reveal.in{opacity:1; transform:none;}
.pbl5 .reveal.d1{transition-delay:.06s;} .pbl5 .reveal.d2{transition-delay:.14s;}
.pbl5 .reveal.d3{transition-delay:.22s;} .pbl5 .reveal.d4{transition-delay:.3s;}
@keyframes edge-shimmer{0%{background-position:-160% 0;} 100%{background-position:260% 0;}}
.pbl5 .shimmer-edge{position:relative;}
.pbl5 .shimmer-edge.in::before{
  content:""; position:absolute; inset:0; border-radius:inherit; padding:1px; pointer-events:none;
  background:linear-gradient(100deg,transparent 30%,var(--pb-gold) 50%,transparent 70%);
  background-size:220% 100%;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  animation:edge-shimmer 1.1s cubic-bezier(.23,1,.32,1) .1s 1 both;}
@keyframes atmos-drift{0%{filter:hue-rotate(0deg) brightness(1);} 100%{filter:hue-rotate(-6deg) brightness(1.06);}}
@keyframes breathe{0%,100%{box-shadow:0 0 0 0 rgba(79,217,138,.5); transform:scale(1);} 50%{box-shadow:0 0 0 7px rgba(79,217,138,0); transform:scale(1.12);}}
@keyframes breathe-soft{0%,100%{transform:scale(1);} 50%{transform:scale(1.12);}}

/* ── ACT I — hero ── */
.pbl5 #hero{height:100svh; min-height:660px; position:relative; overflow:hidden;}
.pbl5 #hero .hero-video{position:absolute; inset:0; z-index:0; overflow:hidden;}
.pbl5 #hero .hero-video img, .pbl5 #hero .hero-video video{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
.pbl5 #hero .atmos{position:absolute; inset:0; z-index:1;
  background:
    radial-gradient(120% 90% at 78% -10%, rgba(232,207,154,.16), transparent 55%),
    radial-gradient(90% 70% at 12% 8%, rgba(79,217,138,.06), transparent 60%),
    linear-gradient(180deg, var(--pb-scrim), transparent 42%, var(--pb-scrim));
  animation:atmos-drift 24s linear infinite alternate;}
.pbl5 #heroCanvas{position:absolute; inset:0; z-index:2; width:100%; height:100%; display:block;}
.pbl5 #hero .hero-inner{position:relative; z-index:6; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:120px 32px 120px;}
.pbl5 .verdict-chip{
  display:inline-flex; align-items:center; gap:10px; margin-bottom:28px;
  background:var(--pb-glass); border:1px solid var(--pb-line-strong); border-radius:var(--pb-r-pill);
  padding:9px 18px 9px 14px; font-size:13.5px; color:var(--pb-ink); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  box-shadow:0 0 30px -10px rgba(79,217,138,.35);}
.pbl5 .verdict-chip.prepare{box-shadow:0 0 30px -10px rgba(232,207,154,.35);}
.pbl5 .verdict-chip.hold{box-shadow:0 0 30px -10px rgba(224,144,106,.35);}
.pbl5 .verdict-chip .dot{width:9px; height:9px; border-radius:50%; background:var(--pb-go); box-shadow:0 0 0 0 rgba(79,217,138,.55); animation:breathe 3.4s ease-in-out infinite;}
.pbl5 .verdict-chip.prepare .dot, .pbl5 .verdict-chip.hold .dot{box-shadow:none; animation:breathe-soft 3.4s ease-in-out infinite;}
.pbl5 .verdict-chip .dot.still{background:var(--pb-muted); box-shadow:none; animation:none;}
.pbl5 .verdict-chip .sep{color:var(--pb-muted);}
.pbl5 .verdict-chip b{color:var(--pb-go); font-weight:600; letter-spacing:.06em; font-size:12px; font-family:var(--pb-mono);}
.pbl5 .verdict-chip b.muted-b{color:var(--pb-muted);}
.pbl5 .hero-h1{font-size:clamp(48px,10vw,112px); max-width:14ch; margin:0 auto;}
.pbl5 .hero-h1 .word{display:inline-block; opacity:0; transform:translateY(38px) scale(.96); filter:blur(10px);}
.pbl5 .hero-h1 .word.on{opacity:1; transform:none; filter:blur(0); transition:opacity .8s cubic-bezier(.23,1,.32,1), transform .8s cubic-bezier(.23,1,.32,1), filter .8s ease;}
.pbl5 .hero-h1 em{font-style:italic; background:var(--pb-grad-gold); -webkit-background-clip:text; background-clip:text; color:transparent;}
.pbl5 .hero-sub{margin:26px auto 0; max-width:54ch; color:var(--pb-ink-2); font-size:clamp(16px,1.8vw,19px); opacity:0; transition:opacity 1s ease .5s;}
.pbl5 .hero-sub.on{opacity:1;}
.pbl5 .hero-cta{display:flex; gap:14px; margin-top:36px; flex-wrap:wrap; justify-content:center; opacity:0; transition:opacity 1s ease .7s, transform 1s cubic-bezier(.23,1,.32,1) .7s; transform:translateY(14px);}
.pbl5 .hero-cta.on{opacity:1; transform:none;}
.pbl5 .line-btn{
  cursor:pointer; font:inherit; font-weight:500; font-size:15px; color:var(--pb-ink);
  background:transparent; border:1px solid var(--pb-line-strong); padding:14px 26px; border-radius:var(--pb-r-pill);
  transition:border-color .3s ease, background .3s ease, transform .3s cubic-bezier(.23,1,.32,1);}
.pbl5 .line-btn:hover{border-color:var(--pb-gold); background:var(--pb-line);}
.pbl5 .big-gold{
  cursor:pointer; font:inherit; font-weight:600; font-size:15px; color:#0a1712; background:var(--pb-grad-gold);
  border:0; padding:15px 30px; border-radius:var(--pb-r-pill); display:inline-flex; align-items:center; gap:10px;
  box-shadow:0 16px 44px -16px var(--pb-gold), 0 0 0 1px rgba(232,207,154,.35);
  transition:box-shadow .35s ease, transform .35s cubic-bezier(.23,1,.32,1); text-decoration:none;}
.pbl5 .big-gold:hover{box-shadow:0 22px 60px -16px var(--pb-gold), 0 0 0 1px rgba(232,207,154,.6); color:#0a1712;}
.pbl5 .ribbon{position:relative; margin-top:52px; width:100vw; left:50%; transform:translateX(-50%); overflow:hidden;
  -webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent); mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);
  opacity:0; transition:opacity 1s ease 1s;}
.pbl5 .ribbon.on{opacity:1;}
.pbl5 .ribbon::after{content:""; position:absolute; top:0; bottom:0; left:50%; width:140px; transform:translateX(-50%); pointer-events:none; z-index:2;
  background:radial-gradient(60% 100% at 50% 50%, rgba(232,207,154,.14), transparent 70%);}
.pbl5 .ribbon-track{display:flex; gap:0; width:max-content; animation:ribbon-scroll 42s linear infinite;}
.pbl5 .ribbon:hover .ribbon-track{animation-play-state:paused;}
@keyframes ribbon-scroll{to{transform:translateX(-50%);}}
.pbl5 .ribbon-chip{display:inline-flex; align-items:center; gap:10px; padding:0 26px; white-space:nowrap;
  font-family:var(--pb-mono); text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:var(--pb-ink-2);}
.pbl5 .ribbon-chip::before{content:""; width:5px; height:5px; border-radius:50%; background:var(--pb-gold-soft); opacity:.5;}
.pbl5 .scroll-cue{position:absolute; bottom:22px; left:50%; transform:translateX(-50%); z-index:6; color:var(--pb-muted); display:flex; flex-direction:column; align-items:center; gap:8px;}
.pbl5 .scroll-cue .rail{width:1px; height:40px; background:linear-gradient(var(--pb-line-strong),transparent); position:relative; overflow:hidden;}
.pbl5 .scroll-cue .rail::after{content:""; position:absolute; top:-14px; left:0; width:1px; height:14px; background:var(--pb-gold); animation:cue 2.4s ease-in-out infinite;}
@keyframes cue{0%{top:-14px; opacity:0;} 30%{opacity:1;} 100%{top:40px; opacity:0;}}

/* ── ACT II — atlas ── */
.pbl5 #atlas{padding:110px 0 120px; background:linear-gradient(180deg,var(--pb-bg),var(--pb-bg-2));}
.pbl5 .atlas-head{text-align:center; max-width:760px; margin:0 auto 40px;}
.pbl5 .atlas-head h2{font-size:clamp(34px,5vw,58px);}
.pbl5 .atlas-head p{color:var(--pb-ink-2); margin-top:16px; font-size:17px;}
.pbl5 .atlas-stage{position:relative; height:560px; border-radius:var(--pb-r-lg); overflow:hidden;
  border:1px solid var(--pb-line); background:radial-gradient(120% 100% at 50% 40%, var(--pb-surface-2), var(--pb-surface));
  box-shadow:var(--pb-shadow);}
.pbl5 #atlasCanvas{position:absolute; inset:0; width:100%; height:100%; z-index:1;}
.pbl5 .atlas-panel{position:absolute; z-index:2; left:34px; top:34px; width:min(340px,calc(100% - 68px));
  background:var(--pb-glass); border:1px solid var(--pb-line-strong); border-radius:var(--pb-r-md);
  padding:24px; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); box-shadow:var(--pb-shadow); pointer-events:none;
  transition:opacity .45s ease, transform .45s cubic-bezier(.23,1,.32,1);}
.pbl5 .atlas-panel .cat{color:var(--pb-gold-soft); display:block; margin-bottom:14px;}
.pbl5 .atlas-panel .stat{font-family:var(--pb-serif); font-weight:600; font-size:clamp(44px,6vw,64px); line-height:.95;}
.pbl5 .atlas-panel .buddy{font-family:var(--pb-serif); font-style:italic; font-size:20px; color:var(--pb-ink); margin-top:8px; line-height:1.2;}
.pbl5 .atlas-panel .facts{list-style:none; margin:18px 0 0; padding:0; display:flex; flex-direction:column; gap:9px;}
.pbl5 .atlas-panel .facts li{display:flex; gap:10px; align-items:flex-start; color:var(--pb-ink-2); font-size:13.5px;}
.pbl5 .atlas-panel .facts li::before{content:""; width:5px; height:5px; border-radius:50%; background:var(--pb-gold); margin-top:8px; flex:0 0 auto; box-shadow:0 0 8px var(--pb-gold);}
.pbl5 .atlas-panel .rel{margin-top:18px; display:flex; gap:6px; flex-wrap:wrap;}
.pbl5 .atlas-panel .rel span{font-family:var(--pb-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--pb-gold-soft); border:1px solid var(--pb-line); border-radius:999px; padding:4px 9px;}
.pbl5 .atlas-panel .swap{animation:panel-swap .45s cubic-bezier(.23,1,.32,1);}
@keyframes panel-swap{from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:none;}}
.pbl5 .atlas-chips{display:none;}
.pbl5 .atlas-hint{text-align:center; margin-top:16px;}

/* ── ACT III — stage ── */
.pbl5 #stage{padding:120px 0 130px; background:var(--pb-bg-2);}
.pbl5 .stage-head{text-align:center; max-width:720px; margin:0 auto 54px;}
.pbl5 .stage-head h2{font-size:clamp(34px,5vw,58px);}
.pbl5 .stage-head p{color:var(--pb-ink-2); margin-top:16px; font-size:17px;}
.pbl5 .stage-grid{display:grid; grid-template-columns:1fr minmax(360px,540px) 1fr; gap:30px; align-items:center;}
.pbl5 .proof-col{display:flex; flex-direction:column; gap:26px;}
.pbl5 .proof-col.right{align-items:flex-end; text-align:right;}
.pbl5 .proof{max-width:250px; opacity:0; transform:translateY(18px); transition:opacity .55s cubic-bezier(.23,1,.32,1), transform .55s cubic-bezier(.23,1,.32,1);}
.pbl5 .proof.on{opacity:1; transform:none;}
.pbl5 .proof .mono{color:var(--pb-gold-soft); margin-bottom:8px; display:block;}
.pbl5 .proof h4{font-family:var(--pb-serif); font-weight:600; font-size:22px; margin:0 0 5px; line-height:1.15;}
.pbl5 .proof p{color:var(--pb-ink-2); font-size:13.5px; line-height:1.5;}
.pbl5 .stage-card{
  position:relative; aspect-ratio:1/1; border-radius:var(--pb-r-lg); overflow:hidden; cursor:pointer;
  background:radial-gradient(120% 120% at 50% 8%, var(--pb-surface-2), var(--pb-surface));
  border:1px solid var(--pb-line); box-shadow:var(--pb-shadow);}
.pbl5 #stageCanvas{position:absolute; inset:0; width:100%; height:100%; z-index:1;}
.pbl5 .stage-overlay{position:absolute; inset:0; z-index:2; pointer-events:none;}
.pbl5 .stage-state{position:absolute; inset:0; opacity:0; transition:opacity .6s ease; padding:30px; display:flex; flex-direction:column;}
.pbl5 .stage-state.on{opacity:1;}
.pbl5 .state-badge{align-self:flex-start;}
.pbl5 .state-badge .mono{color:var(--pb-gold-soft);}
.pbl5 .stage-state h3{font-family:var(--pb-serif); font-weight:600; font-size:clamp(26px,3.4vw,38px); margin-top:auto; line-height:1.06;}
.pbl5 .stage-state p{color:var(--pb-ink-2); font-size:14.5px; margin-top:8px; max-width:34ch;}
/* real product artwork riding the morphing card (Plan + Remember states) */
.pbl5 .state-visual{position:absolute; right:28px; top:66px; width:36%; aspect-ratio:4/5; border-radius:14px; overflow:hidden;
  border:1px solid var(--pb-line-strong); box-shadow:var(--pb-shadow); transform:rotate(2deg);}
.pbl5 .state-visual.tall{aspect-ratio:3/4; width:32%; transform:rotate(-2deg);}
.pbl5 .state-visual img{width:100%; height:100%; object-fit:cover; object-position:top; display:block;}
.pbl5 .book-mini{margin-top:auto; align-self:flex-start; background:var(--pb-glass); border:1px solid var(--pb-line-strong); border-radius:var(--pb-r-md); padding:12px; width:min(74%,300px); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);}
.pbl5 .book-mini .ph{height:96px; border-radius:12px; margin-bottom:10px;}
.pbl5 .book-mini .row{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.pbl5 .book-mini .price{font-family:var(--pb-serif); font-weight:600; font-size:24px;}
.pbl5 .book-mini .price-sub{font-size:13px; color:var(--pb-muted);}
.pbl5 .book-mini .go{display:inline-flex; gap:6px; align-items:center; font-family:var(--pb-mono); font-size:11px; letter-spacing:.14em; color:var(--pb-go); border:1px solid rgba(79,217,138,.4); padding:5px 10px; border-radius:999px;}
.pbl5 .book-mini .go .d{width:7px; height:7px; border-radius:50%; background:var(--pb-go); animation:breathe 3.4s ease-in-out infinite;}
.pbl5 .book-mini .disc{color:var(--pb-muted); font-size:11px; margin-top:8px;}
.pbl5 .stage-progress{display:flex; gap:10px; justify-content:center; margin-top:38px;}
.pbl5 .tick{width:54px; height:3px; border-radius:3px; background:var(--pb-line); overflow:hidden; cursor:pointer; position:relative;}
.pbl5 .tick i{position:absolute; inset:0; width:0; background:var(--pb-grad-gold); border-radius:3px;}
.pbl5 .tick.done i{width:100%;}
.pbl5 .stage-hint{text-align:center; margin-top:16px;}

/* ── ACT IV — engine ── */
.pbl5 #engine{padding:120px 0 120px; background:linear-gradient(180deg,var(--pb-bg-2),var(--pb-bg));}
.pbl5 .engine-head{text-align:center; max-width:760px; margin:0 auto 56px;}
.pbl5 .engine-head h2{font-size:clamp(34px,5vw,58px);}
.pbl5 .engine-head p{color:var(--pb-ink-2); margin-top:16px; font-size:17px;}
.pbl5 .engine-head .creed{color:var(--pb-gold-soft); font-family:var(--pb-serif); font-style:italic; font-size:clamp(20px,2.4vw,26px); margin-top:10px;}
.pbl5 .park-row{display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-bottom:16px;}
.pbl5 .park-card{background:var(--pb-surface); border:1px solid var(--pb-line); border-radius:var(--pb-r-lg); padding:22px; position:relative; overflow:hidden;}
.pbl5 .park-card .pc-top{display:flex; align-items:center; justify-content:space-between; gap:12px;}
.pbl5 .park-card h4{font-family:var(--pb-serif); font-weight:600; font-size:24px; margin:0;}
.pbl5 .park-card .reason{color:var(--pb-ink-2); font-size:14px; margin-top:12px; line-height:1.5;}
.pbl5 .park-card .reason.skel{display:flex; flex-direction:column; gap:8px;}
.pbl5 .park-card .reason.skel span{display:block; height:10px; border-radius:5px; background:var(--pb-line); width:86%;}
.pbl5 .park-card .reason.skel span + span{width:58%;}
.pbl5 .park-card .meta{margin-top:16px; color:var(--pb-muted); font-size:12px; display:flex; gap:14px; flex-wrap:wrap;}
.pbl5 .chip{display:inline-flex; align-items:center; gap:8px; font-family:var(--pb-mono); font-size:11px; letter-spacing:.14em; padding:6px 12px; border-radius:999px;}
.pbl5 .chip .hb{width:9px; height:9px; border-radius:50%; animation:heartbeat 2.6s ease-in-out infinite;}
.pbl5 .chip .hb.still{animation:none;}
@keyframes heartbeat{0%,100%{transform:scale(1); opacity:.9;} 14%{transform:scale(1.5); opacity:1;} 28%{transform:scale(1);} 42%{transform:scale(1.35);} 56%{transform:scale(1);}}
.pbl5 .chip.go{color:var(--pb-go); border:1px solid rgba(79,217,138,.4);} .pbl5 .chip.go .hb{background:var(--pb-go);}
.pbl5 .chip.prepare{color:var(--pb-prepare); border:1px solid rgba(232,207,154,.4);} .pbl5 .chip.prepare .hb{background:var(--pb-prepare);}
.pbl5 .chip.hold{color:var(--pb-hold); border:1px solid rgba(224,144,106,.4);} .pbl5 .chip.hold .hb{background:var(--pb-hold);}
.pbl5 .chip.reading{color:var(--pb-muted); border:1px solid var(--pb-line);} .pbl5 .chip.reading .hb{background:var(--pb-muted);}
.pbl5 .machine{display:grid; grid-template-columns:1.5fr 1fr; gap:20px; margin-top:20px;}
.pbl5 .sources{background:var(--pb-surface); border:1px solid var(--pb-line); border-radius:var(--pb-r-lg); padding:26px; position:relative; overflow:hidden; min-height:220px;}
.pbl5 #filamentCanvas{position:absolute; inset:0; width:100%; height:100%; z-index:0;}
.pbl5 .sources .src-inner{position:relative; z-index:1;}
.pbl5 .src-list{display:flex; flex-wrap:wrap; gap:10px 8px; margin-top:20px;}
.pbl5 .src-tag{font-family:var(--pb-mono); font-size:11px; letter-spacing:.1em; color:var(--pb-ink-2); border:1px solid var(--pb-line); padding:7px 12px; border-radius:999px; background:var(--pb-bg-2);}
.pbl5 .verdict-dot-wrap{display:flex; align-items:center; gap:14px; margin-top:26px;}
.pbl5 .verdict-dot{width:16px; height:16px; border-radius:50%; background:var(--pb-go); box-shadow:0 0 30px 4px rgba(79,217,138,.6); animation:breathe 3.4s ease-in-out infinite;}
.pbl5 .verdict-dot-wrap b{font-family:var(--pb-mono); font-size:12px; letter-spacing:.14em; color:var(--pb-go);}
.pbl5 .alerts-card{background:var(--pb-surface); border:1px solid var(--pb-line); border-radius:var(--pb-r-lg); padding:26px; display:flex; flex-direction:column; justify-content:center;}
.pbl5 .alerts-h{font-family:var(--pb-serif); font-weight:600; font-size:26px; margin-top:12px; line-height:1.1;}
.pbl5 .alerts-p{color:var(--pb-ink-2); font-size:14px; margin-top:10px;}
.pbl5 .todo-head{text-align:center; margin:64px auto 26px; max-width:640px;}
.pbl5 .todo-head .creed{color:var(--pb-gold-soft); font-family:var(--pb-serif); font-style:italic; font-size:22px;}
.pbl5 .trio{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
.pbl5 .todo-card{background:var(--pb-surface); border:1px solid var(--pb-line); border-radius:var(--pb-r-lg); padding:22px; position:relative;}
.pbl5 a.todo-link{display:block; color:var(--pb-ink); transition:border-color .3s ease, transform .3s cubic-bezier(.23,1,.32,1);}
.pbl5 a.todo-link:hover{color:var(--pb-ink); border-color:var(--pb-line-strong); transform:translateY(-2px);}
.pbl5 .todo-card .photo-slot{height:130px; margin-bottom:16px;}
.pbl5 .todo-photo{display:block; height:130px; margin-bottom:16px; border-radius:var(--pb-r-md); overflow:hidden; border:1px solid var(--pb-line);}
.pbl5 .todo-photo img{width:100%; height:100%; object-fit:cover; display:block;}
.pbl5 .todo-card .tt{display:flex; align-items:flex-start; justify-content:space-between; gap:12px;}
.pbl5 .todo-card h4{font-family:var(--pb-serif); font-weight:600; font-size:23px; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;}
.pbl5 .todo-card .price{font-family:var(--pb-serif); font-weight:600; font-size:24px; color:var(--pb-gold-soft); white-space:nowrap;}
.pbl5 .todo-card p{color:var(--pb-ink-2); font-size:13.5px; margin-top:10px; line-height:1.5;}
.pbl5 .todo-card .free{font-family:var(--pb-mono); font-size:11px; letter-spacing:.14em; color:var(--pb-go);}
.pbl5 .todo-card .disc{color:var(--pb-muted); font-size:11px; margin-top:12px;}
.pbl5 .wildlife-flip{perspective:1200px; height:100%; cursor:pointer;}
.pbl5 .flip-inner{position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform .7s cubic-bezier(.23,1,.32,1);}
.pbl5 .wildlife-flip:hover .flip-inner, .pbl5 .wildlife-flip.flipped .flip-inner{transform:rotateY(180deg);}
.pbl5 .flip-face{position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; background:var(--pb-surface); border:1px solid var(--pb-line); border-radius:var(--pb-r-lg); padding:22px; display:flex; flex-direction:column;}
.pbl5 .flip-back{transform:rotateY(180deg); background:linear-gradient(160deg,var(--pb-surface-2),var(--pb-surface));}
.pbl5 .flip-face .big{font-family:var(--pb-serif); font-weight:600; font-size:46px; line-height:1;}
.pbl5 .flip-back h4{font-family:var(--pb-serif); font-weight:600; font-size:24px; color:var(--pb-hold); margin:0 0 14px;}
.pbl5 .flip-back ul{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px;}
.pbl5 .flip-back li{display:flex; gap:10px; color:var(--pb-ink-2); font-size:14px;}
.pbl5 .flip-back li b{color:var(--pb-ink); font-weight:600;}
.pbl5 .flip-hint{margin-top:auto; padding-top:12px; color:var(--pb-muted); font-family:var(--pb-mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase;}

/* ── ACT V — pines ── */
.pbl5 #pines{padding:120px 0 120px; background:linear-gradient(180deg,var(--pb-bg),var(--pb-bg-2));}
.pbl5 .pines-head{text-align:center; max-width:720px; margin:0 auto 56px;}
.pbl5 .pines-head h2{font-size:clamp(34px,5vw,58px);}
.pbl5 .pines-head p{color:var(--pb-ink-2); margin-top:16px; font-size:17px;}
.pbl5 .pines-band{display:grid; grid-template-columns:1.35fr 1fr; gap:36px; align-items:center;}
.pbl5 .film-fan{position:relative; height:420px; display:flex; align-items:center; justify-content:center;}
.pbl5 .frame{position:absolute; width:150px; aspect-ratio:9/16; border-radius:16px; overflow:hidden; border:1px solid var(--pb-line-strong);
  background:var(--pb-surface-2); box-shadow:var(--pb-shadow); transition:transform .6s cubic-bezier(.23,1,.32,1);}
.pbl5 .frame img, .pbl5 .frame video{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
.pbl5 .frame .stamp{position:absolute; left:10px; bottom:10px; display:flex; align-items:center; gap:6px; font-family:var(--pb-mono); font-size:8px; letter-spacing:.12em; color:var(--pb-gold-soft); background:rgba(5,12,8,.6); padding:4px 7px; border-radius:999px; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);}
.pbl5 .frame .pin{width:7px; height:7px; border-radius:50% 50% 50% 0; background:var(--pb-gold); transform:rotate(-45deg); box-shadow:0 0 8px var(--pb-gold);}
.pbl5 .frame .lbl{position:absolute; top:10px; left:10px; right:10px; font-family:var(--pb-mono); font-size:8px; letter-spacing:.08em; color:#e7e3d8; text-transform:uppercase; text-shadow:0 1px 6px rgba(0,0,0,.7);}
.pbl5 .frame.f0{transform:rotate(-16deg) translateX(-230px) translateY(24px) scale(.86);}
.pbl5 .frame.f1{transform:rotate(-8deg) translateX(-120px) translateY(6px) scale(.94);}
.pbl5 .frame.f2{z-index:3; transform:scale(1.06);}
.pbl5 .frame.f2::after{content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(120deg,transparent 30%,rgba(232,207,154,.28) 50%,transparent 70%); background-size:220% 100%; animation:edge-shimmer 3.4s linear infinite;}
.pbl5 .frame.f2 .play{position:absolute; inset:0; margin:auto; width:46px; height:46px; border-radius:50%; background:var(--pb-glass); border:1px solid var(--pb-line-strong); display:grid; place-items:center; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);}
.pbl5 .frame.f2 .play::after{content:""; border-left:11px solid var(--pb-gold); border-top:7px solid transparent; border-bottom:7px solid transparent; margin-left:3px;}
.pbl5 .frame.f3{transform:rotate(8deg) translateX(120px) translateY(6px) scale(.94);}
.pbl5 .frame.f4{transform:rotate(16deg) translateX(230px) translateY(24px) scale(.86);}
.pbl5 .film-fan:hover .frame.f0{transform:rotate(-18deg) translateX(-250px) translateY(20px) scale(.86);}
.pbl5 .film-fan:hover .frame.f4{transform:rotate(18deg) translateX(250px) translateY(20px) scale(.86);}
.pbl5 .pines-copy h3{font-family:var(--pb-serif); font-weight:600; font-size:clamp(28px,3.6vw,42px); line-height:1.05;}
.pbl5 .pines-copy p{color:var(--pb-ink-2); margin-top:14px; font-size:16px; max-width:44ch;}
.pbl5 .capture{display:flex; gap:10px; margin-top:24px; max-width:420px;}
.pbl5 .capture input{flex:1; min-width:0; background:var(--pb-glass); border:1px solid var(--pb-line-strong); border-radius:var(--pb-r-pill); padding:13px 18px; color:var(--pb-ink); font:inherit; font-size:14px; outline:none; transition:border-color .3s ease;}
.pbl5 .capture input:focus{border-color:var(--pb-gold);}
.pbl5 .capture input::placeholder{color:var(--pb-muted);}
.pbl5 .capture button{cursor:pointer; border:0; background:var(--pb-grad-gold); color:#0a1712; font:inherit; font-weight:600; font-size:14px; padding:13px 22px; border-radius:var(--pb-r-pill); white-space:nowrap;}
.pbl5 .capture button:disabled{opacity:.7; cursor:default;}
.pbl5 .capture-done{margin-top:24px; color:var(--pb-go); font-size:14px;}
.pbl5 .capture-err{margin-top:10px; color:var(--pb-hold); font-size:12.5px;}
.pbl5 .book-row{display:grid; grid-template-columns:1fr 1.2fr; gap:36px; align-items:center; margin-top:80px; padding-top:70px; border-top:1px solid var(--pb-line);}
.pbl5 .tripbook{perspective:1400px; display:flex; align-items:center; justify-content:center; padding:20px;}
/* Square, not portrait: Trip Books ARE square-format (the real cover art is
   810x810) — a 210x280 frame cropped the title off both edges. */
.pbl5 .book{position:relative; width:250px; height:250px; transform-style:preserve-3d; transform:rotateY(-24deg) rotateX(6deg); transition:transform .8s cubic-bezier(.23,1,.32,1);}
.pbl5 .tripbook:hover .book{transform:rotateY(-6deg) rotateX(2deg);}
.pbl5 .book .cover{position:absolute; inset:0; border-radius:6px 10px 10px 6px; background:linear-gradient(135deg,#123020,#0b1c12); border:1px solid var(--pb-line-strong); box-shadow:var(--pb-shadow); transform:translateZ(14px); overflow:hidden;}
.pbl5 .book .cover img{width:100%; height:100%; object-fit:cover; display:block;}
.pbl5 .book .pages{position:absolute; top:6px; bottom:6px; right:-2px; width:16px; border-radius:0 6px 6px 0; background:repeating-linear-gradient(90deg,#f4f1ea 0 2px,#d8d2c4 2px 3px); transform:translateZ(6px) rotateY(4deg); overflow:hidden;}
.pbl5 .book .pages::after{content:""; position:absolute; inset:0; background:linear-gradient(100deg,transparent 30%,rgba(232,207,154,.9) 50%,transparent 70%); background-size:220% 100%; animation:edge-shimmer 3.2s linear infinite;}
.pbl5 .book .spine{position:absolute; left:-8px; top:0; bottom:0; width:16px; border-radius:6px 0 0 6px; background:linear-gradient(90deg,#0a1712,#123020); transform:rotateY(-88deg); transform-origin:right;}
.pbl5 .book-copy h3{font-family:var(--pb-serif); font-weight:600; font-size:clamp(28px,3.6vw,42px); line-height:1.05;}
.pbl5 .book-copy p{color:var(--pb-ink-2); margin-top:14px; font-size:16px; max-width:46ch;}
.pbl5 .book-copy .feats{display:flex; gap:22px; margin-top:20px; flex-wrap:wrap;}
.pbl5 .book-copy .feats span{font-family:var(--pb-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--pb-gold-soft);}

/* ── ACT VI — the close (close.jpg under the cream→green transition) ── */
.pbl5 #cta{padding:210px 0 110px; text-align:center; color:var(--pb-ink); overflow:hidden;}
.pbl5 .cta-bg{position:absolute; inset:0; z-index:0; background:url(/media/landing/close.jpg) center/cover no-repeat;}
.pbl5 .cta-grad{position:absolute; inset:0; z-index:1;
  background:linear-gradient(180deg,var(--pb-bg-2),var(--pb-bg-3) 260px);}
@supports (background:color-mix(in srgb,#000 50%,transparent)){
  .pbl5 .cta-grad{background:linear-gradient(180deg,var(--pb-bg-2),
    color-mix(in srgb,var(--pb-bg-3) 88%,transparent) 260px,
    color-mix(in srgb,var(--pb-bg-3) 92%,transparent));}
}
.pbl5 #ctaCanvas{position:absolute; inset:0; z-index:2; width:100%; height:100%; pointer-events:none;}
.pbl5 #cta h2{font-size:clamp(40px,7vw,90px); max-width:16ch; margin:0 auto 34px;}
.pbl5 .cta-em{font-style:italic;}
.pbl5 #cta .cta-row{display:flex; gap:14px; justify-content:center; flex-wrap:wrap;}
.pbl5 #cta .sig{color:var(--pb-muted); font-family:var(--pb-mono); font-size:12px; letter-spacing:.2em; margin-top:30px;}

/* ── footer ── */
.pbl5 #footer{background:var(--pb-bg-3); border-top:1px solid var(--pb-line); padding:60px 0 120px; color:var(--pb-ink);}
.pbl5 .foot-grid{display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr; gap:30px;}
.pbl5 .foot-brand .brand-line{display:flex; align-items:center; gap:10px; margin-bottom:14px;}
.pbl5 .foot-brand .brand-line img{width:30px; height:30px; object-fit:contain;}
.pbl5 .foot-brand b{font-family:var(--pb-serif); font-weight:600; font-size:20px;}
.pbl5 .foot-brand p{color:var(--pb-muted); font-size:13px; max-width:34ch;}
.pbl5 .foot-col h5{font-family:var(--pb-mono); text-transform:uppercase; letter-spacing:.16em; font-size:11px; color:var(--pb-gold-soft); margin:0 0 16px;}
.pbl5 .foot-col a{display:block; color:var(--pb-ink-2); font-size:14px; padding:5px 0;}
.pbl5 .foot-col a:hover{color:var(--pb-ink);}
.pbl5 .foot-col .src{display:block; color:var(--pb-ink-2); font-size:14px; padding:5px 0;}
.pbl5 .foot-bottom{margin-top:50px; padding-top:24px; border-top:1px solid var(--pb-line); display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; color:var(--pb-muted); font-size:12px;}
.pbl5 .foot-legal{display:flex; gap:16px;}
.pbl5 .foot-legal a{color:var(--pb-muted); font-size:12px;}
.pbl5 .foot-legal a:hover{color:var(--pb-ink);}

/* ── responsive ── */
@media(max-width:1080px){
  .pbl5 .machine{grid-template-columns:1fr;}
  .pbl5 .stage-grid{grid-template-columns:1fr; gap:24px;}
  .pbl5 .proof-col{flex-direction:row; flex-wrap:wrap; justify-content:center; gap:16px;}
  .pbl5 .proof-col.right{text-align:left; align-items:flex-start;}
  .pbl5 .proof{max-width:none; flex:1 1 200px;}
  .pbl5 .trio{grid-template-columns:1fr;}
  .pbl5 .wildlife-flip{min-height:320px;}
  .pbl5 .pines-band{grid-template-columns:1fr; gap:28px;}
  .pbl5 .book-row{grid-template-columns:1fr; gap:28px;}
}
@media(max-width:860px){
  .pbl5 .wrap{padding:0 20px;}
  .pbl5 .park-row{grid-template-columns:1fr; gap:14px;}
  .pbl5 .foot-grid{grid-template-columns:1fr 1fr;}
  .pbl5 .scroll-cue{display:none;}
  .pbl5 .atlas-stage{height:auto; padding:24px; display:flex; flex-direction:column; gap:20px;}
  .pbl5 #atlasCanvas{display:none;}
  .pbl5 .atlas-panel{position:relative; left:auto; top:auto; width:100%; order:2;}
  .pbl5 .atlas-chips{display:grid; grid-template-columns:repeat(2,1fr); gap:10px; order:1; position:relative; z-index:2;}
  .pbl5 .atlas-chip{cursor:pointer; text-align:left; background:var(--pb-surface); border:1px solid var(--pb-line); border-radius:14px; padding:12px 14px; color:var(--pb-ink); font:inherit; transition:border-color .25s ease, background .25s ease;}
  .pbl5 .atlas-chip.active{border-color:var(--pb-gold); background:var(--pb-line);}
  .pbl5 .atlas-chip .k{font-family:var(--pb-mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--pb-gold-soft); display:block;}
  .pbl5 .atlas-chip .v{font-family:var(--pb-serif); font-weight:600; font-size:22px;}
  .pbl5 .film-fan{height:380px; transform:scale(.8);}
}
@media(max-width:520px){
  .pbl5 .foot-grid{grid-template-columns:1fr 1fr;}
  .pbl5 .stage-grid .proof-col.right{order:3;}
  .pbl5 .capture{flex-direction:column;}
  .pbl5 .atlas-chips{grid-template-columns:repeat(2,1fr);}
}

/* ── reduced motion: ambient scenes freeze, entrances become short fades ── */
@media(prefers-reduced-motion:reduce){
  .pbl5 *{animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.25s !important;}
  .pbl5 .hero-h1 .word{opacity:1; transform:none; filter:none;}
  .pbl5 .hero-sub,.pbl5 .hero-cta,.pbl5 .ribbon{opacity:1; transform:none;}
  .pbl5 .ribbon-track{animation:none;}
  .pbl5 .film-fan:hover .frame.f0,.pbl5 .film-fan:hover .frame.f4{transform:rotate(-16deg) translateX(-230px) translateY(24px) scale(.86);}
}
      ` }} />
    </div>
  );
}
