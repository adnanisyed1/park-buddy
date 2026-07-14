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

const FUEL_PER_MI = 0.2333, LODGING_PER_NIGHT = 130, FOOD_PER_PERSON_DAY = 35, ROAD_FACTOR = 1.25;

function miBetween(a, b) {
  const R = 3958.8, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
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

  useEffect(() => {
    let on = true;
    (async () => {
      // A shared trip travels in the URL (?t=…); fall back to the local trip store.
      let shared = null;
      try { const t = new URLSearchParams(window.location.search).get("t"); if (t) shared = decodeTrip(t); } catch {}
      const raw = shared ? shared.stops : getStops();
      const m = shared ? shared.meta : getMeta();
      const coord = {};
      try {
        await loadScript("/trip-data.js");
        (window.TRIP_PARKS || []).forEach((p) => { if (p && p.name) coord[p.name] = { lat: p.lat, lng: p.lng, state: p.state }; });
      } catch {}
      try {
        const fd = await fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        ((fd && fd.forests) || []).forEach((f) => { if (f && f.name) coord[f.name] = { lat: f.lat, lng: f.lng, state: f.state }; });
      } catch {}
      const resolved = raw.map((s) => {
        const c = s.lat != null && s.lng != null ? s : coord[s.name];
        return c ? { name: s.name, nights: s.nights || 0, lat: c.lat, lng: c.lng, state: s.state || c.state || "", custom: !!s.custom } : { name: s.name, nights: s.nights || 0, state: s.state || "" };
      });
      if (on) { setStops(resolved); setMeta(m); setReady(true); }
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
    return { ...s, label: start === end ? "Day " + start : "Days " + start + "–" + end, arrive, legMi: mapped.includes(s) ? legMi[mapped.indexOf(s)] : null };
  });
  const totalDays = dayCursor - 1;

  const W = 640, H = 300;
  const pts = fitProject(mapped.map((s, i) => ({ name: s.name, lat: s.lat, lng: s.lng, i: stops.indexOf(s) })), W, H, 34);

  const doPrint = () => { try { window.print(); } catch {} };

  const card = { border: "1px solid #e3ddcf", borderRadius: 14, padding: "16px 18px", background: "#fff" };
  const label = { fontFamily: "var(--pb-mono), ui-monospace, monospace", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#8a8067" };

  return (
    <div style={{ background: "#f4efe4", minHeight: "100vh", color: "#20241c", fontFamily: "var(--pb-sans), 'Hanken Grotesk', system-ui, sans-serif" }}>
      <style>{`
        @page { margin: 14mm; }
        @media screen and (max-width: 560px) { .tp-two { grid-template-columns: 1fr !important; } }
        @media print {
          .tp-noprint { display: none !important; }
          .tp-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
          .tp-break { break-inside: avoid; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* toolbar (screen only) */}
      <div className="tp-noprint" style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px clamp(14px,4vw,40px)", background: "#20241c", color: "#f4efe4" }}>
        <a href="/build-trip" style={{ color: "#e4be78", textDecoration: "none", fontWeight: 700, fontSize: ".9rem" }}>← Back to Build My Trip</a>
        <button onClick={doPrint} style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: ".88rem", color: "#20241c", background: "linear-gradient(120deg,#e4be78,#c79a4b)", border: "none", borderRadius: 999, padding: "10px 20px" }}>🖨 Print / Save as PDF</button>
      </div>

      <div className="tp-sheet" style={{ maxWidth: 860, margin: "24px auto", background: "#fff", boxShadow: "0 20px 60px -30px rgba(0,0,0,.3)", borderRadius: 16, padding: "clamp(22px,4vw,44px)" }}>
        {!ready ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#8a8067" }}>Preparing your itinerary…</div>
        ) : stops.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#8a8067" }}>Your trip is empty. <a href="/build-trip" style={{ color: "#c79a4b" }}>Build it first →</a></div>
        ) : (
          <>
            {/* cover */}
            <div className="tp-break" style={{ borderBottom: "2px solid #e4be78", paddingBottom: 18, marginBottom: 22 }}>
              <div style={label}>Park Buddy · Road-trip itinerary</div>
              <h1 style={{ fontFamily: "var(--pb-serif), 'Spectral', Georgia, serif", fontSize: "clamp(1.9rem,5vw,2.9rem)", fontWeight: 700, margin: "6px 0 10px", lineHeight: 1.05 }}>{meta.tripName || "My national-parks trip"}</h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: ".95rem", color: "#4a4636" }}>
                {startDate && <span>{fmtDate(meta.startDate)}{meta.endDate ? " → " + fmtDate(meta.endDate) : ""}</span>}
                <span>{stops.length} stop{stops.length === 1 ? "" : "s"} · {totalDays} day{totalDays === 1 ? "" : "s"}</span>
                <span>≈ {totalMiles.toLocaleString()} mi driving</span>
                <span>{adults} adult{adults === 1 ? "" : "s"}{infants ? " + " + infants + " kid" + (infants === 1 ? "" : "s") : ""}</span>
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
                <svg viewBox={"0 0 " + W + " " + H} style={{ display: "block", width: "100%", height: "auto", background: "#eef1e6" }}>
                  {[0.25, 0.5, 0.75].map((f) => (<line key={"h" + f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="#20241c" strokeOpacity="0.05" />))}
                  {[0.2, 0.4, 0.6, 0.8].map((f) => (<line key={"v" + f} x1={W * f} y1="0" x2={W * f} y2={H} stroke="#20241c" strokeOpacity="0.05" />))}
                  {pts.length > 1 && (<polyline points={pts.map((p) => p.x + "," + p.y).join(" ")} fill="none" stroke="#c79a4b" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />)}
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="13" fill="#1d3941" stroke="#e4be78" strokeWidth="2.5" />
                      <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="sans-serif">{i + 1}</text>
                    </g>
                  ))}
                </svg>
              </div>
              );
            })()}

            {/* day-by-day */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ ...label, marginBottom: 10 }}>Day by day</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dayRows.map((s, i) => (
                  <div key={i} className="tp-break" style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "#1d3941", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".9rem", border: "2px solid #e4be78" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#c79a4b" }}>{s.label}{s.arrive ? " · arrive " + s.arrive : ""}</div>
                      <div style={{ fontFamily: "var(--pb-serif), 'Spectral', Georgia, serif", fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.15 }}>{s.name}</div>
                      <div style={{ fontSize: ".82rem", color: "#6a6553", marginTop: 2 }}>
                        {[s.state, (s.nights || 0) + " night" + ((s.nights || 0) === 1 ? "" : "s"), i > 0 && s.legMi != null ? s.legMi + " mi from " + dayRows[i - 1].name : null, s.custom ? "custom stop" : null].filter(Boolean).join(" · ")}
                      </div>
                      <div style={{ borderTop: "1px dashed #e3ddcf", marginTop: 8, paddingTop: 6, fontSize: ".78rem", color: "#9a927c" }}>Notes / plans: ______________________________________________</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* budget + settings */}
            <div className="tp-break tp-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
              <div style={card}>
                <div style={{ ...label, marginBottom: 8 }}>Estimated budget</div>
                {Object.entries(budget).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: ".9rem", borderBottom: "1px solid #f2ecdc" }}><span style={{ color: "#4a4636" }}>{k}</span><b>{usd(v)}</b></div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "2px solid #c79a4b", fontFamily: "var(--pb-serif), serif" }}><b style={{ fontSize: "1.05rem" }}>Total</b><b style={{ fontSize: "1.3rem", color: "#1d3941" }}>{usd(total)}</b></div>
                <div style={{ textAlign: "right", fontSize: ".72rem", color: "#9a927c", marginTop: 3 }}>≈ {usd(total / Math.max(1, party))} per person · planning estimate</div>
              </div>
              <div style={card}>
                <div style={{ ...label, marginBottom: 8 }}>Trip at a glance</div>
                {[["Getting there", meta.arrivalMode === "fly" ? "Fly in + rental car" : "Driving the whole way"], ["Trip scope", meta.tripScope === "crosscountry" ? "Cross-country route" : "Loop around the destination"], ["Rental car", meta.car || "Midsize SUV"], ["Travelers", adults + " adult" + (adults === 1 ? "" : "s") + (infants ? " + " + infants + " kid" + (infants === 1 ? "" : "s") : "")], ["Total driving", "≈ " + totalMiles.toLocaleString() + " mi"], ["Nights", totalNights]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: ".9rem", borderBottom: "1px solid #f2ecdc" }}><span style={{ color: "#6a6553" }}>{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>
                ))}
              </div>
            </div>

            {/* checklist */}
            <div className="tp-break" style={{ marginBottom: 12 }}>
              <div style={{ ...label, marginBottom: 10 }}>Packing &amp; prep checklist</div>
              <div className="tp-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {Object.entries(CHECKLIST).map(([group, items]) => (
                  <div key={group} style={card}>
                    <div style={{ fontWeight: 800, fontSize: ".92rem", marginBottom: 7 }}>{group}</div>
                    {items.map((it) => (
                      <div key={it} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0", fontSize: ".84rem", color: "#3a3628" }}>
                        <span style={{ width: 13, height: 13, flex: "none", marginTop: 2, border: "1.5px solid #9a927c", borderRadius: 3 }} />{it}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e3ddcf", marginTop: 20, paddingTop: 12, fontSize: ".72rem", color: "#9a927c", lineHeight: 1.5 }}>
              Distances &amp; costs are planning estimates. Check each park&apos;s live status, permits and closures before you go. Made with Park Buddy · theparkbuddy.com
            </div>
          </>
        )}
      </div>
    </div>
  );
}
