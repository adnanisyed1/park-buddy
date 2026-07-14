"use client";

// /trip-print — a clean, print-ready itinerary built from the shared trip store.
// Deliberately LIGHT-themed (white paper, dark ink) so it prints/saves-to-PDF well,
// unlike the dark app chrome. Reads stops + all the trip-setup answers, resolves
// coordinates (parks from trip-data, forests from the JSON, custom stops carry their
// own), and lays out: cover, route map (SVG so it always prints), day-by-day plan,
// budget, trip settings and a packing checklist. "Print / Save as PDF" calls the
// browser's print dialog. Nothing here is interactive — it's a document.

import { useEffect, useState } from "react";
import loadScript from "../components/load-script";
import { getStops, getMeta } from "../lib/trip";
import { ensureMapsLoaded } from "../lib/googleMapsLoader";
import { computeRoute } from "../lib/googleRoutes";
import { decodeTrip } from "../lib/tripShare";
import { getChecklist } from "../lib/checklist";
import { CATS as PACK_CATS } from "../lib/packgo";

const FUEL_PER_MI = 0.2333, LODGING_PER_NIGHT = 130, FOOD_PER_PERSON_DAY = 35, ROAD_FACTOR = 1.25;

function miBetween(a, b) {
  const R = 3958.8, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const BLOCK_EMOJI = { drive: "🚗", stay: "🛏", meal: "🍽", scenic: "⛰", hike: "🥾", sight: "📸" };

// Print identity — the "Field Notes" travel-document palette (Claude Design handoff:
// warm creams, forest greens, bronze/gold, a rust accent). Light + print-safe.
const PAGE = "#efe7d6", PAPER = "#faf6ec", CARD = "#fffdf8", INK = "#22302a", TEAL = "#23453a", DEEP = "#1a2620";
const BRONZE = "#a9772f", GOLD = "#c9a35f", GOLD_LT = "#e8cf9a", MUTE = "#5f6b60", MUTE2 = "#94917f", HAIR = "#e6ddc8", RUST = "#b5643c";
const SERIF = "var(--pb-serif), 'Cormorant Garamond', 'Spectral', Georgia, serif";
const MONO = "var(--pb-mono), 'Space Mono', ui-monospace, monospace";

// Section header: serif title · hairline rule · filled gold ◆ · mono note (field-notes style).
function SectionHead({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "0 0 18px" }}>
      <h2 style={{ fontFamily: SERIF, fontSize: "1.75rem", fontWeight: 600, color: DEEP, margin: 0, whiteSpace: "nowrap", letterSpacing: ".005em" }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: "rgba(34,48,42,0.16)" }} />
      <span style={{ width: 6, height: 6, flex: "none", background: GOLD, transform: "rotate(45deg)", display: "inline-block" }} />
      {note ? <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".24em", textTransform: "uppercase", color: BRONZE, whiteSpace: "nowrap" }}>{note}</span> : null}
    </div>
  );
}

// The decorative field-notes hero: layered mountain range, sun, gold contour lines.
function HeroBand() {
  return (
    <svg viewBox="0 0 900 196" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "clamp(120px,26vw,200px)" }}>
      <rect x="0" y="0" width="900" height="196" fill="#f3ead6" />
      <g stroke="rgba(201,163,95,0.35)" strokeWidth="1" fill="none">
        <path d="M0,44 C160,30 320,54 480,40 S780,28 900,42" />
        <path d="M0,66 C180,52 340,76 520,60 S800,50 900,64" />
      </g>
      <circle cx="686" cy="78" r="34" fill="#e8cf9a" />
      <circle cx="686" cy="78" r="34" fill="none" stroke="rgba(169,119,47,0.4)" strokeWidth="1" />
      <polygon points="0,150 120,92 230,124 360,64 480,112 620,58 760,104 900,74 900,196 0,196" fill="#c6d2c0" />
      <polygon points="0,196 90,128 210,158 330,104 470,146 600,100 740,140 900,110 900,196" fill="rgba(201,163,95,0.55)" />
      <polygon points="360,64 336,88 386,88" fill="#faf6ec" />
      <polygon points="620,58 598,82 644,82" fill="#faf6ec" />
      <polygon points="0,196 150,140 300,170 430,134 560,166 700,128 820,158 900,144 900,196" fill="#23453a" />
      <polygon points="150,140 132,160 170,160" fill="#e9efe4" />
      <polygon points="700,128 682,150 720,150" fill="#e9efe4" />
    </svg>
  );
}
const fmtDate = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); } catch { return iso; } };

// aspect-preserving projection of stops into a WxH box (mid-lat lng correction)
function fitProject(pts, W, H, pad) {
  if (!pts.length) return [];
  if (pts.length === 1) return [{ ...pts[0], x: W / 2, y: H / 2 }];
  const midLat = (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2;
  const k = Math.cos((midLat * Math.PI) / 180) || 1;
  const X = pts.map((p) => p.lng * k), Y = pts.map((p) => -p.lat);
  const minX = Math.min(...X), maxX = Math.max(...X), minY = Math.min(...Y), maxY = Math.max(...Y);
  const spanX = maxX - minX || 1e-6, spanY = maxY - minY || 1e-6;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - scale * spanX) / 2 - scale * minX, offY = (H - scale * spanY) / 2 - scale * minY;
  return pts.map((p) => ({ ...p, x: scale * (p.lng * k) + offX, y: scale * (-p.lat) + offY }));
}

const CHECKLIST = {
  Essentials: ["America the Beautiful pass (or park entry booked)", "Reusable water — ~1 L per person per hour", "Layers + rain shell", "Sun protection: hat, sunscreen, sunglasses", "First-aid kit + any medications", "Headlamp / flashlight", "Offline maps downloaded (no signal in parks)", "Portable charger / car charger"],
  "On the road": ["Rental car booked + insurance", "Snacks & a cooler", "Cash for small gateway towns", "Physical map as backup", "Roadside kit (jumper, tire plug)"],
  "Stay & permits": ["Lodging / campground confirmations", "Timed-entry or wilderness permits printed", "Backcountry / camping gear if needed"],
  "For the story": ["Camera / phone with space cleared", "A small notebook", "Turn on Trip Mode for photo reminders"],
};

export default function TripPrint() {
  const [ready, setReady] = useState(false);
  const [stops, setStops] = useState([]);
  const [meta, setMeta] = useState({});
  const [mapImgErr, setMapImgErr] = useState(false);
  const [routePoly, setRoutePoly] = useState("");
  const [dayPlans, setDayPlans] = useState({});
  const [packItems, setPackItems] = useState([]);

  useEffect(() => {
    let on = true;
    (async () => {
      // A shared trip travels in the URL (?t=…); fall back to the local trip store.
      let shared = null;
      try { const t = new URLSearchParams(window.location.search).get("t"); if (t) shared = decodeTrip(t); } catch {}
      const raw = shared ? shared.stops : getStops();
      const m = shared ? shared.meta : getMeta();
      const coord = {};
      // Coord lookups for stops that don't already carry lat/lng (old saved trips by name).
      // Time-bounded so a hung script/fetch never blocks the page on "Preparing…" — a
      // shared link already has coordinates in its payload.
      const withTimeout = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
      try {
        await withTimeout(loadScript("/trip-data.js"), 3500);
        (window.TRIP_PARKS || []).forEach((p) => { if (p && p.name) coord[p.name] = { lat: p.lat, lng: p.lng, state: p.state }; });
      } catch {}
      try {
        const fd = await withTimeout(fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).catch(() => null), 3500);
        ((fd && fd.forests) || []).forEach((f) => { if (f && f.name) coord[f.name] = { lat: f.lat, lng: f.lng, state: f.state }; });
      } catch {}
      const resolved = raw.map((s) => {
        const c = s.lat != null && s.lng != null ? s : coord[s.name];
        return c ? { name: s.name, nights: s.nights || 0, lat: c.lat, lng: c.lng, state: s.state || c.state || "", custom: !!s.custom } : { name: s.name, nights: s.nights || 0, state: s.state || "" };
      });
      // Day-plan blocks: from the shared payload, else the local store.
      let dp = shared ? (shared.dayPlans || {}) : {};
      if (!shared) { try { dp = JSON.parse(localStorage.getItem("pb_trip_dayplans") || "{}") || {}; } catch { dp = {}; } }
      const pack = shared ? (shared.checklist || []) : getChecklist();
      if (on) { setStops(resolved); setMeta(m); setDayPlans(dp); setPackItems(pack); setReady(true); }
    })();
    return () => { on = false; };
  }, []);

  // Route geometry for the static map: prefer what Trip Studio saved; otherwise
  // compute it here via Directions so the PDF map works even if Studio never ran.
  useEffect(() => {
    if (!ready) return;
    if (meta.routePolyline) { setRoutePoly(meta.routePolyline); return; }
    const mp = stops.filter((s) => s.lat != null);
    if (mp.length < 2) return;
    let cancelled = false;
    (async () => {
      try {
        const ok = await ensureMapsLoaded();
        const g = window.google;
        if (!ok || !g || !g.maps) return;
        const full = [];
        for (let i = 0; i < mp.length - 1; i++) {
          const r = await computeRoute(mp[i], mp[i + 1]);
          if (cancelled) return;
          if (r.ok && r.path) r.path.forEach((p) => full.push(p));
        }
        if (!cancelled && full.length > 1 && g.maps.geometry && g.maps.geometry.encoding) {
          const step = Math.max(1, Math.ceil(full.length / 300));
          setRoutePoly(g.maps.geometry.encoding.encodePath(full.filter((_, idx) => idx % step === 0 || idx === full.length - 1)));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [ready, stops, meta.routePolyline]);

  const mapped = stops.filter((s) => s.lat != null);
  const totalNights = stops.reduce((a, s) => a + (s.nights || 0), 0);
  // Prefer the REAL driving miles from Google Directions (saved on the trip by Trip
  // Studio); fall back to a straight-line estimate only if they're absent.
  const legMi = mapped.map((s, i) => (i === 0 ? 0 : (meta.legMiles && meta.legMiles[i] != null ? meta.legMiles[i] : Math.round(miBetween(mapped[i - 1], s) * ROAD_FACTOR))));
  // Real per-leg driving MINUTES from Trip Studio's Routes API result; fall back to a
  // ~55 mph highway estimate from the miles only when they're absent.
  const legMin = mapped.map((s, i) => (i === 0 ? 0 : (meta.legMins && meta.legMins[i] != null ? meta.legMins[i] : Math.round((legMi[i] / 55) * 60))));
  const totalMiles = meta.driveMiles != null ? meta.driveMiles : legMi.reduce((a, b) => a + b, 0);
  const adults = meta.adults || meta.travelers || 2;
  const infants = meta.infants || 0;
  const party = adults + infants;
  const budget = {
    Flights: meta.arrivalMode === "fly" ? adults * 320 : 0,
    Fuel: Math.round(totalMiles * FUEL_PER_MI),
    Lodging: totalNights * LODGING_PER_NIGHT,
    Food: adults * totalNights * FOOD_PER_PERSON_DAY,
    "Park passes": Math.min(stops.length * 35, 80),
  };
  const total = Object.values(budget).reduce((a, b) => a + b, 0);

  // day ranges
  let dayCursor = 1;
  const startDate = meta.startDate ? new Date(meta.startDate + "T12:00:00") : null;
  const dayRows = stops.map((s, i) => {
    const start = dayCursor;
    const span = Math.max(1, s.nights || 1);
    const end = start + span - 1;
    let arrive = "";
    if (startDate) { const d = new Date(startDate); d.setDate(d.getDate() + (start - 1)); arrive = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
    dayCursor = end + 1;
    const mi = mapped.indexOf(s);
    return { ...s, start, span, label: start === end ? "Day " + start : "Days " + start + "–" + end, arrive, legMi: mi >= 0 ? legMi[mi] : null, legMin: mi >= 0 ? legMin[mi] : null };
  });
  const totalDays = dayCursor - 1;
  // "3h 20m" from minutes; used for drive legs on the day-by-day.
  const fmtDur = (min) => (min == null ? null : min >= 60 ? Math.floor(min / 60) + "h" + (min % 60 ? " " + (min % 60) + "m" : "") : Math.max(1, min) + "m");

  const W = 640, H = 300;
  const pts = fitProject(mapped.map((s, i) => ({ name: s.name, lat: s.lat, lng: s.lng, i: stops.indexOf(s) })), W, H, 34);

  // A one-line field-notes subtitle derived from the trip.
  const uniqStates = [...new Set(stops.map((s) => s.state).filter(Boolean))];
  const region = uniqStates.length === 1 ? uniqStates[0] : uniqStates.length === 2 ? uniqStates.join(" & ") : uniqStates.length ? "the American West" : "the national parks";
  const scopeWord = meta.tripScope === "crosscountry" ? "cross-country route" : "loop";
  const tagline = "A " + totalDays + "-day " + scopeWord + " through " + region + ".";

  const doPrint = () => { try { window.print(); } catch {} };

  const card = { border: "1px solid " + HAIR, borderRadius: 14, padding: "16px 18px", background: "#fffdf8" };
  const label = { fontFamily: MONO, fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", color: MUTE };

  return (
    <div style={{ background: PAGE, minHeight: "100vh", color: INK, fontFamily: "var(--pb-sans), 'Inter', 'Hanken Grotesk', system-ui, sans-serif" }}>
      <style>{`
        @page { margin: 12mm; }
        @media screen and (max-width: 560px) { .tp-two { grid-template-columns: 1fr !important; } .tp-stats { grid-template-columns: 1fr 1fr !important; } }
        @media print {
          .tp-noprint { display: none !important; }
          .tp-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; border-radius: 0 !important; }
          .tp-break { break-inside: avoid; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* toolbar (screen only) */}
      <div className="tp-noprint" style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px clamp(14px,4vw,40px)", background: DEEP, color: PAPER }}>
        <a href="/build-trip" style={{ color: GOLD, textDecoration: "none", fontWeight: 700, fontSize: ".9rem" }}>← Back to Build My Trip</a>
        <button onClick={doPrint} style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".88rem", color: DEEP, background: "linear-gradient(120deg," + GOLD_LT + "," + GOLD + ")", border: "none", borderRadius: 999, padding: "10px 20px" }}>🖨 Print / Save as PDF</button>
      </div>

      <div className="tp-sheet" style={{ maxWidth: 880, margin: "24px auto", background: CARD, boxShadow: "0 24px 70px -34px rgba(26,38,32,.5)", borderRadius: 16, overflow: "hidden", border: "1px solid " + HAIR }}>
        {!ready ? (
          <div style={{ padding: "80px 24px", textAlign: "center", color: MUTE2 }}>Preparing your itinerary…</div>
        ) : stops.length === 0 ? (
          <div style={{ padding: "80px 24px", textAlign: "center", color: MUTE2 }}>Your trip is empty. <a href="/build-trip" style={{ color: BRONZE }}>Build it first →</a></div>
        ) : (
          <>
            <HeroBand />
            <div style={{ padding: "clamp(22px,4vw,44px)" }}>
            {/* cover masthead */}
            <div className="tp-break" style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                <span style={{ width: 28, height: 28, flex: "none", borderRadius: 8, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 11, height: 11, border: "2px solid " + GOLD_LT, borderRadius: "50%" }} />
                </span>
                <span style={{ ...label, fontSize: 10, letterSpacing: ".34em", color: BRONZE }}>Park Buddy · Field Notes</span>
              </div>
              {(() => {
                const name = meta.tripName || "My national-parks trip";
                const parts = name.trim().split(" ");
                const last = parts.length > 1 ? parts.pop() : null;
                return (
                  <h1 style={{ fontFamily: SERIF, fontSize: "clamp(2.4rem,6.5vw,3.6rem)", fontWeight: 600, margin: "0 0 8px", lineHeight: 1.0, color: INK, letterSpacing: "-.01em" }}>
                    {parts.join(" ")}{last ? " " : ""}{last ? <em style={{ fontStyle: "italic", color: GOLD }}>{last}</em> : null}
                  </h1>
                );
              })()}
              <div style={{ fontSize: "1rem", color: MUTE, marginBottom: 14 }}>{tagline}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <span style={{ color: BRONZE, fontSize: 11 }}>◆</span>
                <span style={{ width: 90, height: 1.5, background: "linear-gradient(90deg," + GOLD + ",transparent)" }} />
              </div>
              {/* stat ledger — vertical-rule dividers */}
              <div className="tp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: "1px solid " + HAIR, borderBottom: "1px solid " + HAIR }}>
                {[
                  ["Dates", startDate ? fmtDate(meta.startDate).replace(/,? \d{4}$/, "") + (meta.endDate ? " – " + fmtDate(meta.endDate).replace(/^\w+,? /, "") : "") : "Not set", startDate ? (new Date(meta.startDate + "T12:00:00").getFullYear()) : ""],
                  ["Route", stops.length + " stop" + (stops.length === 1 ? "" : "s"), totalDays + " day" + (totalDays === 1 ? "" : "s") + " on the road"],
                  ["Driving", "≈ " + totalMiles.toLocaleString() + " mi", "total distance"],
                  ["Travelers", adults + " adult" + (adults === 1 ? "" : "s") + (infants ? " + " + infants : ""), meta.car || "Midsize SUV"],
                ].map(([k, v, sub], ix) => (
                  <div key={k} style={{ padding: "14px 16px 14px " + (ix === 0 ? "0" : "16px"), borderLeft: ix === 0 ? "none" : "1px solid " + HAIR }}>
                    <div style={{ ...label, fontSize: 8.5, letterSpacing: ".16em", marginBottom: 5, color: BRONZE }}>{k}</div>
                    <div style={{ fontFamily: SERIF, fontSize: "1.15rem", fontWeight: 600, color: INK, lineHeight: 1.1 }}>{v}</div>
                    {sub ? <div style={{ fontSize: ".78rem", color: MUTE2, marginTop: 2 }}>{sub}</div> : null}
                  </div>
                ))}
              </div>
            </div>

            {/* route map — a real static-map snapshot fitted to the whole route (falls
                back to the SVG sketch when the map key / route geometry isn't available) */}
            {pts.length > 0 && (() => {
              let gkey = "";
              try { gkey = (typeof localStorage !== "undefined" && localStorage.getItem("pb_gmaps_key")) || ""; } catch {}
              if (!gkey) gkey = process.env.NEXT_PUBLIC_GMAPS_KEY || (typeof window !== "undefined" && window.GMAPS_KEY) || "";
              let mt = "roadmap"; try { const mp = JSON.parse(localStorage.getItem("pb_map_prefs") || "{}"); mt = mp.type === "satellite" ? "hybrid" : mp.type === "terrain" ? "terrain" : "roadmap"; } catch {}
              const markers = mapped.map((s, i) => "&markers=" + encodeURIComponent("size:mid|color:0x1D3941|label:" + (i + 1) + "|" + s.lat + "," + s.lng)).join("");
              const staticUrl = (gkey && routePoly)
                ? "https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&maptype=" + mt + "&path=color:0xc79a4bff|weight:4|enc:" + encodeURIComponent(routePoly) + markers + "&key=" + gkey
                : null;
              if (staticUrl && !mapImgErr) return (
                <div className="tp-break" style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 22 }}>
                  <img src={staticUrl} alt="Your route" onError={() => setMapImgErr(true)} style={{ display: "block", width: "100%", height: "auto" }} />
                </div>
              );
              return (
              <div className="tp-break" style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 22 }}>
                <svg viewBox={"0 0 " + W + " " + H} style={{ display: "block", width: "100%", height: "auto", background: "#e8efe2" }}>
                  {[0.25, 0.5, 0.75].map((f) => (<line key={"h" + f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="#20241c" strokeOpacity="0.05" />))}
                  {[0.2, 0.4, 0.6, 0.8].map((f) => (<line key={"v" + f} x1={W * f} y1="0" x2={W * f} y2={H} stroke="#20241c" strokeOpacity="0.05" />))}
                  {pts.length > 1 && (<polyline points={pts.map((p) => p.x + "," + p.y).join(" ")} fill="none" stroke={BRONZE} strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />)}
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="13" fill={TEAL} stroke={GOLD_LT} strokeWidth="2.5" />
                      <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="sans-serif">{i + 1}</text>
                    </g>
                  ))}
                </svg>
              </div>
              );
            })()}

            {/* day-by-day — timeline rail with gold-ring bullets + faint watermark numbers */}
            <div style={{ marginBottom: 26 }}>
              <SectionHead note={totalDays + " days"}>Day by day</SectionHead>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, paddingLeft: 26 }}>
                <div aria-hidden="true" style={{ position: "absolute", left: 6, top: 10, bottom: 10, width: 1, background: "repeating-linear-gradient(" + HAIR + " 0 4px, transparent 4px 9px)" }} />
                {dayRows.map((s, i) => (
                  <div key={i} className="tp-break" style={{ ...card, position: "relative", overflow: "hidden" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: -26, top: 18, width: 13, height: 13, borderRadius: "50%", background: CARD, border: "2px solid " + GOLD, boxShadow: "0 0 0 3px " + PAPER }} />
                    <span aria-hidden="true" style={{ position: "absolute", right: 12, top: -8, fontFamily: SERIF, fontSize: "5rem", fontWeight: 600, color: "rgba(35,69,58,0.06)", lineHeight: 1, pointerEvents: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                    <div style={{ position: "relative" }}>
                      <div style={{ fontFamily: MONO, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: GOLD }}>{s.label}{s.arrive ? " · arrive " + s.arrive : ""}</div>
                      <div style={{ fontFamily: SERIF, fontSize: "1.4rem", fontWeight: 600, lineHeight: 1.12, color: TEAL, marginTop: 1 }}>{s.name}</div>
                      <div style={{ fontSize: ".82rem", color: MUTE, marginTop: 3 }}>
                        {[s.state, (s.nights || 0) + " night" + ((s.nights || 0) === 1 ? "" : "s"), i > 0 && s.legMi != null ? s.legMi + " mi" + (s.legMin != null ? " · ~" + fmtDur(s.legMin) + " drive" : "") + " from " + dayRows[i - 1].name : null, s.custom ? "custom stop" : null].filter(Boolean).join(" · ")}
                      </div>
                      {i === 0 && meta.origin && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 10px", borderRadius: 9, background: "rgba(35,69,58,0.05)", border: "1px dashed " + HAIR }}>
                          <span style={{ fontSize: 13, flex: "none" }}>{meta.arrivalMode === "fly" ? "✈" : "🚗"}</span>
                          <span style={{ fontSize: ".8rem", color: INK }}>
                            <b style={{ fontWeight: 600 }}>Getting here:</b> {meta.arrivalMode === "fly" ? "fly" : "drive"} from {meta.origin}
                            {meta.originMiles != null ? " · " + meta.originMiles + " mi" : ""}
                            {meta.originMins != null ? " · ~" + fmtDur(meta.originMins) : ""}
                            <span style={{ color: MUTE2 }}> — plan this as your Day {s.start} travel.</span>
                          </span>
                        </div>
                      )}
                      {(() => {
                        const blocks = (dayPlans[s.name] || []).slice().sort((a, b) => ((a.day || 0) - (b.day || 0)) || (a.time || "").localeCompare(b.time || ""));
                        if (!blocks.length) return <div style={{ borderTop: "1px dashed " + HAIR, marginTop: 8, paddingTop: 6, fontSize: ".78rem", color: MUTE2 }}>Notes / plans: ______________________________________________</div>;
                        const byDay = {};
                        blocks.forEach((b) => { (byDay[b.day || 0] = byDay[b.day || 0] || []).push(b); });
                        return (
                          <div style={{ borderTop: "1px dashed " + HAIR, marginTop: 8, paddingTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
                            {Object.keys(byDay).sort((a, c) => Number(a) - Number(c)).map((dk) => (
                              <div key={dk}>
                                <div style={{ fontFamily: MONO, fontSize: ".58rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: GOLD, marginBottom: 3 }}>Day {s.start + Number(dk)}</div>
                                {byDay[dk].map((b, bi) => (
                                  <div key={bi} style={{ display: "flex", gap: 8, fontSize: ".82rem", color: INK, padding: "1px 0" }}>
                                    <span style={{ minWidth: 44, color: MUTE2, fontVariantNumeric: "tabular-nums" }}>{b.time || "—"}</span>
                                    <span>{BLOCK_EMOJI[b.type] || "•"} {b.name}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* budget + settings */}
            <div className="tp-break" style={{ marginBottom: 24 }}>
              <SectionHead note="planning estimate">Budget &amp; logistics</SectionHead>
              <div className="tp-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 600, color: TEAL, marginBottom: 8 }}>Estimated budget</div>
                {Object.entries(budget).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: ".9rem", borderBottom: "1px solid " + HAIR }}><span style={{ color: MUTE }}>{k}</span><b>{usd(v)}</b></div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: "2px solid " + GOLD, fontFamily: SERIF }}><b style={{ fontSize: "1.05rem", color: INK }}>Total</b><b style={{ fontSize: "1.45rem", color: TEAL }}>{usd(total)}</b></div>
                <div style={{ textAlign: "right", fontSize: ".72rem", color: MUTE2, marginTop: 3 }}>≈ {usd(total / Math.max(1, party))} per person · planning estimate</div>
              </div>
              <div style={card}>
                <div style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 600, color: TEAL, marginBottom: 8 }}>Trip at a glance</div>
                {[["Getting there", meta.arrivalMode === "fly" ? "Fly in + rental car" : "Driving the whole way"], ["Trip scope", meta.tripScope === "crosscountry" ? "Cross-country route" : "Loop around the destination"], ["Rental car", meta.car || "Midsize SUV"], ["Travelers", adults + " adult" + (adults === 1 ? "" : "s") + (infants ? " + " + infants + " kid" + (infants === 1 ? "" : "s") : "")], ["Total driving", "≈ " + totalMiles.toLocaleString() + " mi" + (meta.driveMins != null ? " · " + fmtDur(meta.driveMins) : "")], ["Nights", totalNights]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: ".9rem", borderBottom: "1px solid " + HAIR }}><span style={{ color: MUTE }}>{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>
                ))}
              </div>
              </div>
            </div>

            {/* checklist */}
            <div className="tp-break" style={{ marginBottom: 12 }}>
              <SectionHead note={packItems.length ? (packItems.filter((i) => i.done).length + " / " + packItems.length + " packed") : null}>{packItems.length ? "Pack & Go" : "Packing & prep"}</SectionHead>
              <div className="tp-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {packItems.length
                  ? PACK_CATS.map(([cat, emoji, title]) => {
                      const its = packItems.filter((i) => i.cat === cat);
                      if (!its.length) return null;
                      return (
                        <div key={cat} style={card}>
                          <div style={{ fontFamily: SERIF, fontSize: "1.08rem", fontWeight: 600, color: TEAL, marginBottom: 7 }}>{emoji} {title}</div>
                          {its.map((it, ix) => (
                            <div key={ix} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0", fontSize: ".84rem", color: INK }}>
                              <span style={{ width: 13, height: 13, flex: "none", marginTop: 2, border: "1.5px solid " + GOLD, borderRadius: 3, background: it.done ? BRONZE : "transparent" }} />
                              <span style={{ textDecoration: it.done ? "line-through" : "none", color: it.done ? MUTE2 : INK }}>{it.label}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  : Object.entries(CHECKLIST).map(([group, items]) => (
                      <div key={group} style={card}>
                        <div style={{ fontFamily: SERIF, fontSize: "1.08rem", fontWeight: 600, color: TEAL, marginBottom: 7 }}>{group}</div>
                        {items.map((it) => (
                          <div key={it} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0", fontSize: ".84rem", color: INK }}>
                            <span style={{ width: 13, height: 13, flex: "none", marginTop: 2, border: "1.5px solid " + GOLD, borderRadius: 3 }} />{it}
                          </div>
                        ))}
                      </div>
                    ))}
              </div>
            </div>

            {/* footer */}
            <div style={{ borderTop: "1px solid " + HAIR, marginTop: 26, paddingTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: TEAL, fontSize: 12, lineHeight: 1 }}>▲</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: BRONZE }}>Made with Park Buddy · theparkbuddy.com</span>
              <span style={{ flex: 1, minWidth: 20 }} />
              <span style={{ fontSize: ".72rem", color: MUTE2, lineHeight: 1.4 }}>Distances &amp; costs are planning estimates — check each park&apos;s live status before you go.</span>
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
