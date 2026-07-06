"use client";

// /build-trip — native React port of "Build a Trip.dc.html" (design fidelity
// required). Layout, colors, spacing and copy reproduce the design 1:1; the
// static mock panels are made functional per spec:
//  • Itinerary: drag to reorder (⠿ handle), remove, add any of the real 63 parks
//  • Budget: line items recompute from the trip (tap any amount to override)
//  • Trip details: date / travelers / rental car drive days + costs
//  • Per-stop go/no-go: LIVE via /pb-verdict.js (weather.gov), same engine as /explore
//  • Map: numbered stops + dashed route, key from NEXT_PUBLIC_GMAPS_KEY
//    (design's paste-key overlay kept as the dev fallback)

import { useEffect, useRef, useState } from "react";
import loadScript from "../components/load-script";
import { getStops as tripStops, getMeta as tripMeta } from "../lib/trip";

/* ---------------- constants (verbatim from the design) ---------------- */

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#e7e2d0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a6b4c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f3ede0" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#dbe2c4" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cdd7b0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbe6ea" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f3ede0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e4d9bf" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
];

// Ready-made itineraries (design rail). Park names match trip-data.js exactly.
const ROUTES = [
  { id: "mighty5", emoji: "🏜️", name: "Utah's Mighty 5", desc: "All five Utah parks on one desert loop — canyons, arches and hoodoos.", stops: ["Zion", "Bryce Canyon", "Capitol Reef", "Arches", "Canyonlands"], nights: [2, 2, 1, 2, 1], days: 8, miles: 720 },
  { id: "pnw", emoji: "🌲", name: "Pacific NW Loop", desc: "Rainforests, volcanoes and coastline from Seattle to Portland.", stops: ["Olympic", "North Cascades", "Mount Rainier", "Crater Lake"], nights: [3, 2, 2, 2], days: 9, miles: 640 },
  { id: "cali", emoji: "🏔️", name: "California Icons", desc: "Yosemite granite to Sequoia giants and Death Valley dunes.", stops: ["Yosemite", "Sequoia", "Kings Canyon", "Death Valley", "Joshua Tree"], nights: [2, 2, 2, 2, 2], days: 10, miles: 810 },
  { id: "desertsw", emoji: "🌵", name: "Desert Southwest", desc: "Grand Canyon, Saguaro and the red rocks of Arizona & New Mexico.", stops: ["Grand Canyon", "Petrified Forest", "Saguaro", "White Sands", "Carlsbad Caverns", "Guadalupe Mountains"], nights: [2, 2, 2, 2, 2, 1], days: 11, miles: 930 },
];

// Design's Mighty-5 leg distances (real road miles) — used verbatim for the
// preset so the page matches the design at load; edits recompute via haversine.
const MIGHTY5_LEGS = [null, 84, 118, 147, 32];

const CARS = ["Compact", "Midsize SUV", "Full-size SUV", "Minivan", "RV / Camper"];
const FUEL_PER_MI = 0.2333; // ≈ design: 720 mi → $168
const LODGING_PER_NIGHT = 130; // design: 8 nights → $1,040
const FOOD_PER_PERSON_DAY = 35; // design: 2 travelers × 8 days → $560
const ROAD_FACTOR = 1.6; // haversine → road-miles approximation

const fmtUsd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtDate = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtShort = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function milesBetween(a, b) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Live verdict → design's stop-status row (GO / CAUTION / HEAT / HOLD OFF)
const STOP_STATUS = {
  go:      { label: "GO",       dot: "#2f7d4f", text: "#2f7d4f", note: "#5a6b4c", bg: "rgba(46,85,98,.08)" },
  caution: { label: "CAUTION",  dot: "#c79a4b", text: "#a8791f", note: "#7a6a3c", bg: "rgba(199,154,75,.14)" },
  heat:    { label: "HEAT",     dot: "#b9823f", text: "#a05f28", note: "#7a5b34", bg: "rgba(185,130,63,.16)" },
  hold:    { label: "HOLD OFF", dot: "#bf463a", text: "#bf463a", note: "#7a4a42", bg: "rgba(191,70,58,.12)" },
  loading: { label: "CHECKING", dot: "#b3ab97", text: "#8c8473", note: "#8c8473", bg: "rgba(179,171,151,.14)" },
};

/* ================================ component ================================ */

export default function BuildTripApp() {
  const [parksDb, setParksDb] = useState([]); // real 63 parks from trip-data.js
  const [tripName, setTripName] = useState("Utah's Mighty 5");
  const [startDate, setStartDate] = useState("2026-09-12");
  const [travelers, setTravelers] = useState(2);
  const [car, setCar] = useState("Midsize SUV");
  const [stops, setStops] = useState([]); // {name, state, lat, lng, nights, legMi}
  const [totalMilesOverride, setTotalMilesOverride] = useState(720); // design preset; null = sum legs
  const [showOnMap, setShowOnMap] = useState(true);
  const [loadedRoute, setLoadedRoute] = useState("mighty5");
  const [addSel, setAddSel] = useState("");
  const [budgetOverride, setBudgetOverride] = useState({ fuel: 168, lodging: 1040, food: 560, passes: 72 }); // design preset seeds
  const [editingBudget, setEditingBudget] = useState(null); // key being edited
  const [verdicts, setVerdicts] = useState({}); // name -> {status, note}
  const [keyOverlay, setKeyOverlay] = useState(false);
  const [keyMsg, setKeyMsg] = useState("Paste a Google Maps JavaScript API key to load the live map.");

  const mapDivRef = useRef(null);
  const keyInputRef = useRef(null);
  const mapObjRef = useRef(null);
  const routeMarkersRef = useRef([]);
  const routeLineRef = useRef(null);
  const dragIdxRef = useRef(null);
  const mapReadyRef = useRef(false);

  /* ---------------- derived trip math ---------------- */

  const totalNights = stops.reduce((a, s) => a + s.nights, 0);
  const legSum = stops.reduce((a, s) => a + (s.legMi || 0), 0);
  const totalMiles = totalMilesOverride != null ? totalMilesOverride : Math.round(legSum);
  const driveHrs = Math.round(totalMiles / 60);
  const endDate = (() => {
    const d = new Date(startDate + "T12:00:00");
    d.setDate(d.getDate() + totalNights);
    return d.toISOString().slice(0, 10);
  })();

  const budget = {
    fuel: budgetOverride.fuel ?? Math.round(totalMiles * FUEL_PER_MI),
    lodging: budgetOverride.lodging ?? totalNights * LODGING_PER_NIGHT,
    food: budgetOverride.food ?? travelers * totalNights * FOOD_PER_PERSON_DAY,
    passes: budgetOverride.passes ?? Math.min(stops.length * 35, 80),
  };
  const totalCost = budget.fuel + budget.lodging + budget.food + budget.passes;

  // day ranges per stop ("Days 1–2", "Day 5") + arrive dates
  const dayRanges = (() => {
    let day = 1;
    return stops.map((s) => {
      const from = day, to = day + s.nights - 1;
      const arrive = new Date(startDate + "T12:00:00");
      arrive.setDate(arrive.getDate() + (from - 1));
      day = to + 1;
      return { label: s.nights === 1 ? "Day " + from : "Days " + from + "–" + to, arrive: arrive.toISOString().slice(0, 10) };
    });
  })();

  /* ---------------- stop mutations ---------------- */

  function recomputeLegs(list) {
    return list.map((s, i) => ({
      ...s,
      legMi: i === 0 ? null : Math.round(milesBetween(list[i - 1], s) * ROAD_FACTOR),
    }));
  }

  function commitStops(list, { keepPreset = false } = {}) {
    const next = keepPreset ? list : recomputeLegs(list);
    setStops(next);
    if (!keepPreset) {
      setTotalMilesOverride(null); // once edited, drive miles = honest sum of legs
      setLoadedRoute(null);
      setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null }); // recompute all
    }
    setVerdicts((v) => v); // verdict effect below fills gaps
  }

  function loadRoute(route, db = parksDb) {
    const list = route.stops
      .map((name, i) => {
        const p = db.find((x) => x.name === name);
        return p ? { name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: route.nights[i], legMi: null } : null;
      })
      .filter(Boolean);
    const withLegs = route.id === "mighty5"
      ? list.map((s, i) => ({ ...s, legMi: MIGHTY5_LEGS[i] }))
      : recomputeLegs(list);
    setStops(withLegs);
    setTripName(route.name);
    setLoadedRoute(route.id);
    setTotalMilesOverride(route.id === "mighty5" ? 720 : route.miles);
    setBudgetOverride(route.id === "mighty5" ? { fuel: 168, lodging: 1040, food: 560, passes: 72 } : { fuel: null, lodging: null, food: null, passes: null });
  }

  const removeStop = (i) => commitStops(stops.filter((_, x) => x !== i));
  const addPark = () => {
    if (!addSel) return;
    const p = parksDb.find((x) => x.name === addSel);
    if (!p || stops.some((s) => s.name === p.name)) return;
    commitStops(stops.concat([{ name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: 1, legMi: null }]));
    setAddSel("");
  };

  // drag-to-reorder (⠿ handle rows are draggable)
  const onDragStart = (i) => () => { dragIdxRef.current = i; };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (i) => (e) => {
    e.preventDefault();
    const from = dragIdxRef.current;
    if (from == null || from === i) return;
    const list = stops.slice();
    const [moved] = list.splice(from, 1);
    list.splice(i, 0, moved);
    dragIdxRef.current = null;
    commitStops(list);
  };

  /* ---------------- boot: real data + verdict engine + map ---------------- */

  useEffect(() => {
    let disposed = false;
    (async () => {
      await Promise.all([loadScript("/trip-data.js"), loadScript("/pb-verdict.js")]);
      if (disposed) return;
      const db = window.TRIP_PARKS || [];
      setParksDb(db);
      // Seed from the shared trip store (what the user actually added across the
      // site). Match each saved stop to a real park for its coords; keep the saved
      // nights. Only if the trip is empty do we fall back to the design preset.
      const saved = tripStops();
      const matched = saved
        .map((s) => { const p = db.find((x) => x.name === s.name); return p ? { name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: s.nights > 0 ? s.nights : 2, legMi: null } : null; })
        .filter(Boolean);
      if (matched.length) {
        setStops(recomputeLegs(matched));
        setTripName(tripMeta().tripName || "My national-parks trip");
        setLoadedRoute(null);
        setTotalMilesOverride(null);
        setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null });
      } else {
        loadRoute(ROUTES[0], db); // design preset — Utah's Mighty 5
      }

      let key = "";
      try { key = localStorage.getItem("pb_gmaps_key") || ""; } catch {}
      if (!key) key = process.env.NEXT_PUBLIC_GMAPS_KEY || "";
      if (!key && window.GMAPS_KEY) key = window.GMAPS_KEY;
      if (!key) { setKeyOverlay(true); return; }
      loadGoogle(key);
    })();
    return () => { disposed = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadGoogle(key) {
    window.gm_authFailure = () => {
      setKeyMsg("That key was rejected for this site. Use an unrestricted dev key, or add this URL to the key's allowed referrers in Google Cloud.");
      setKeyOverlay(true);
    };
    if (window.google && window.google.maps) { initMap(); return; }
    window.__pbBtInit = () => initMap();
    if (document.getElementById("pb-gm-js")) return;
    const s = document.createElement("script");
    s.id = "pb-gm-js";
    s.async = true;
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&loading=async&callback=__pbBtInit";
    s.onerror = () => { setKeyMsg("Could not load Google Maps. Check your connection or the key."); setKeyOverlay(true); };
    document.head.appendChild(s);
  }

  function initMap() {
    const el = mapDivRef.current;
    if (!el || !window.google) return;
    const g = window.google;
    mapObjRef.current = new g.maps.Map(el, {
      center: { lat: 38.05, lng: -111.3 }, zoom: 7,
      disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy",
      backgroundColor: "#dbe6ea", styles: MAP_STYLE,
    });
    mapReadyRef.current = true;
    setKeyOverlay(false);
    drawRoute();
  }

  function drawRoute() {
    const g = window.google;
    const map = mapObjRef.current;
    if (!g || !map || !mapReadyRef.current) return;
    routeMarkersRef.current.forEach((m) => m.setMap(null));
    routeMarkersRef.current = [];
    if (routeLineRef.current) { routeLineRef.current.setMap(null); routeLineRef.current = null; }
    if (!showOnMap || !stops.length) return;

    const path = [], bounds = new g.maps.LatLngBounds();
    stops.forEach((s, i) => {
      const pos = { lat: s.lat, lng: s.lng };
      path.push(pos); bounds.extend(pos);
      routeMarkersRef.current.push(new g.maps.Marker({
        position: pos, map, title: s.name,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38"><circle cx="19" cy="19" r="14" fill="#1d3941" stroke="#e4be78" stroke-width="2.5"/><text x="19" y="24" font-family="sans-serif" font-size="15" font-weight="800" fill="#ffffff" text-anchor="middle">' + (i + 1) + "</text></svg>"),
          scaledSize: new g.maps.Size(38, 38), anchor: new g.maps.Point(19, 19),
        },
      }));
    });
    routeLineRef.current = new g.maps.Polyline({
      path, map, geodesic: true, strokeOpacity: 0,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: "#2c5562", scale: 3 }, offset: "0", repeat: "12px" }],
    });
    map.fitBounds(bounds, 52);
  }
  useEffect(() => { drawRoute(); }, [stops, showOnMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // live per-stop verdicts (same engine as /explore; graceful if PBVerdict absent)
  useEffect(() => {
    const PB = typeof window !== "undefined" && window.PBVerdict;
    if (!PB || !PB.fetchVerdict) return;
    stops.forEach((s) => {
      if (verdicts[s.name]) return;
      try {
        PB.fetchVerdict(s.lat, s.lng, (res) => {
          const r = res && typeof res.score === "number" ? res : res && res.v && typeof res.v.score === "number" ? res.v : null;
          if (!r) return;
          let status = r.score >= 62 ? "go" : r.score >= 42 ? "caution" : "hold";
          if (typeof r.temp === "number" && r.temp >= 95) status = "heat";
          const bits = [];
          if (r.sky) bits.push(r.sky + (typeof r.temp === "number" ? ", " + Math.round(r.temp) + "°F" : ""));
          else if (typeof r.temp === "number") bits.push(Math.round(r.temp) + "°F");
          if (r.chips && r.chips[0] && r.chips[0].t) bits.push(r.chips[0].t);
          setVerdicts((v) => ({ ...v, [s.name]: { status, note: bits.join(" · ") || "Live conditions checked." } }));
        });
      } catch {}
    });
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveKey() {
    const v = keyInputRef.current && keyInputRef.current.value.trim();
    if (!v) return;
    try { localStorage.setItem("pb_gmaps_key", v); } catch {}
    window.location.reload();
  }

  /* ---------------- share links (production-correct, real waypoints) ---------------- */

  const gmapsUrl = stops.length >= 2
    ? "https://www.google.com/maps/dir/" + stops.map((s) => s.lat + "," + s.lng).join("/")
    : "https://www.google.com/maps";
  const appleUrl = stops.length >= 2
    ? "https://maps.apple.com/?saddr=" + stops[0].lat + "," + stops[0].lng + "&daddr=" + stops.slice(1).map((s) => s.lat + "," + s.lng).join("+to:")
    : "https://maps.apple.com";
  const shareText = tripName + " — " + stops.map((s) => s.name).join(" → ") + " · " + totalMiles + " mi, " + totalNights + " days. Planned with ParkBuddy.";
  const waUrl = "https://wa.me/?text=" + encodeURIComponent(shareText);
  const copyLink = () => { try { navigator.clipboard.writeText(window.location.href); } catch {} };

  /* ---------------- shared style fragments (design verbatim) ---------------- */

  const sans = "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif";
  const serif = "var(--font-spectral), 'Spectral', Georgia, serif";
  const panel = { position: "relative", background: "#fffdf7", border: "1px solid #e7ddca", borderRadius: 22, boxShadow: "0 22px 50px -30px rgba(28,46,34,.4),0 2px 6px rgba(28,46,34,.05)" };
  const stepNum = { position: "absolute", left: 10, top: 20, width: 37, height: 37, borderRadius: 12, background: "linear-gradient(150deg,#33555f,#1d3941)", color: "#e4be78", border: "1px solid rgba(228,190,120,.45)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: "1.06rem", fontWeight: 800, boxShadow: "0 8px 18px -8px rgba(8,18,12,.6)" };
  const fieldLabel = { fontSize: ".66rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "#8c8473" };
  const fieldBox = { padding: "11px 13px", border: "1.5px solid #e7ddca", borderRadius: 12, fontSize: ".88rem", fontWeight: 600, color: "#1a2b21", background: "#fff", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
  const statCell = { flex: 1, background: "rgba(251,246,234,.1)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 13, padding: "9px 6px", textAlign: "center", backdropFilter: "blur(6px)" };
  const statB = { display: "block", fontFamily: serif, fontSize: "1.22rem", fontWeight: 700, color: "#e4be78", lineHeight: 1 };
  const statS = { fontSize: ".56rem", color: "rgba(251,246,234,.72)", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 4, display: "block", fontWeight: 700 };
  const budgetRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", fontSize: ".88rem" };
  const budgetVal = { fontWeight: 700, color: "#2c5562", fontFamily: serif, cursor: "pointer" };

  const BudgetAmount = ({ k }) => editingBudget === k ? (
    <input
      type="number" autoFocus defaultValue={budget[k]}
      onBlur={(e) => { const v = Math.max(0, Math.round(+e.target.value || 0)); setBudgetOverride((o) => ({ ...o, [k]: v })); setEditingBudget(null); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      style={{ width: 90, textAlign: "right", fontWeight: 700, color: "#2c5562", fontFamily: serif, fontSize: ".88rem", border: "1.5px solid #c79a4b", borderRadius: 8, padding: "3px 7px", outline: "none" }}
    />
  ) : (
    <span style={budgetVal} title="Tap to enter your real price" onClick={() => setEditingBudget(k)}>{fmtUsd(budget[k])}</span>
  );

  /* ================================ render ================================ */

  return (
    <div style={{ fontFamily: sans, color: "#1a2b21", position: "relative", minHeight: "100vh", background: "#16303a" }}>
      <style>{`
        ::selection { background: #c79a4b; color: #15241c; }
        .bt-scroller::-webkit-scrollbar { height: 9px; }
        .bt-scroller::-webkit-scrollbar-thumb { background: rgba(28,46,34,.25); border-radius: 9px; }
        @keyframes bt-drift { from { transform: translateX(-22vw); } to { transform: translateX(118vw); } }
        @keyframes bt-sun { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes bt-fade { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bt-pulse { 0% { box-shadow: 0 0 0 0 rgba(70,217,127,.5); } 70% { box-shadow: 0 0 0 8px rgba(70,217,127,0); } 100% { box-shadow: 0 0 0 0 rgba(70,217,127,0); } }
        @keyframes bt-birds { 0% { transform: translate(0,0); } 50% { transform: translate(26px,-12px); } 100% { transform: translate(54px,4px); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>

      {/* ============ LIVING SCENE ============ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: "linear-gradient(180deg,#3a5f6e 0%,#6f8f86 55%,#cfd9c2 100%)" }}>
        <div style={{ position: "absolute", top: "-8%", right: "6%", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%,rgba(255,238,190,.95),rgba(228,190,120,.5) 38%,transparent 70%)", filter: "blur(4px)", animation: "bt-sun 6s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "14%", width: 240, height: 70, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%,rgba(255,253,247,.5),rgba(255,253,247,.12) 60%,transparent 75%)", filter: "blur(8px)", opacity: 0.7, animation: "bt-drift 46s linear infinite" }} />
        <div style={{ position: "absolute", top: "24%", width: 170, height: 54, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%,rgba(255,253,247,.5),rgba(255,253,247,.12) 60%,transparent 75%)", filter: "blur(8px)", opacity: 0.5, animation: "bt-drift 64s linear infinite", animationDelay: "-20s" }} />
        <div style={{ position: "absolute", top: "8%", width: 300, height: 84, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%,rgba(255,253,247,.5),rgba(255,253,247,.12) 60%,transparent 75%)", filter: "blur(8px)", opacity: 0.4, animation: "bt-drift 82s linear infinite", animationDelay: "-50s" }} />
        <div style={{ position: "absolute", top: "20%", left: "30%", color: "rgba(251,246,234,.5)", fontSize: ".9rem", letterSpacing: 4, animation: "bt-birds 9s ease-in-out infinite" }}>˅ ˅ ˅</div>
        <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: "54vh", background: "linear-gradient(180deg,#86a59c,#789a90)", opacity: 0.42, clipPath: "polygon(0 64%,18% 40%,34% 56%,52% 30%,68% 52%,84% 34%,100% 50%,100% 100%,0 100%)" }} />
        <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: "44vh", background: "linear-gradient(180deg,#557d73,#456b61)", opacity: 0.7, clipPath: "polygon(0 72%,14% 54%,30% 68%,46% 44%,62% 64%,80% 46%,100% 62%,100% 100%,0 100%)" }} />
        <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: "36vh", background: "linear-gradient(180deg,#2f574c,#1d3a31)", clipPath: "polygon(0 78%,12% 62%,28% 76%,44% 56%,60% 74%,78% 58%,100% 72%,100% 100%,0 100%)" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(130% 92% at 50% 6%,transparent 44%,rgba(8,18,12,.42) 100%),linear-gradient(100deg,rgba(7,18,12,.5) 0%,rgba(8,20,14,.2) 48%,transparent 74%)" }} />

      {/* ============ SHELL ============ */}
      <div style={{ position: "relative", zIndex: 4, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* glass header */}
        <header style={{ position: "sticky", top: 14, zIndex: 1200, margin: "14px clamp(12px,3vw,28px) 0", borderRadius: 20, background: "rgba(16,32,23,.34)", WebkitBackdropFilter: "blur(20px) saturate(1.5)", backdropFilter: "blur(20px) saturate(1.5)", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 14px 36px -18px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.14)" }}>
          <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, gap: 12, padding: "0 15px" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, color: "#fbf6ea", textDecoration: "none" }}>
              <span style={{ width: 36, height: 36, flex: "none", borderRadius: 11, background: "linear-gradient(145deg,#e4be78,#c79a4b)", display: "flex", alignItems: "center", justifyContent: "center", color: "#15241c", boxShadow: "0 6px 18px rgba(0,0,0,.3)" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l5 9h-3l5 9H5l5-9H7z"></path><rect x="11" y="18" width="2" height="4"></rect></svg>
              </span>
              <span style={{ lineHeight: 1.05 }}>
                <b style={{ fontFamily: serif, fontSize: "1.22rem", fontWeight: 700, display: "block" }}>ParkBuddy</b>
                <small style={{ display: "block", color: "rgba(243,237,224,.6)", fontSize: ".68rem", marginTop: 1, letterSpacing: ".04em" }}>live status · every U.S. national park</small>
              </span>
            </a>
            <nav style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <a href="/explore" style={{ color: "rgba(243,237,224,.9)", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Map</a>
              <a href="/plan" style={{ color: "rgba(243,237,224,.9)", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Plan a Trip</a>
              <a href="/build-trip" style={{ color: "#15241c", background: "#fbf6ea", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Build a Trip</a>
              <a href="/shop.html" style={{ color: "rgba(243,237,224,.9)", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Gear &amp; Stays</a>
              <a href="/pro.html" style={{ color: "rgba(243,237,224,.9)", textDecoration: "none", fontSize: ".85rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Pro</a>
            </nav>
          </div>
        </header>

        {/* hero */}
        <section style={{ maxWidth: 1320, margin: "0 auto", width: "100%", padding: "clamp(28px,5vw,52px) clamp(16px,3vw,28px) 10px", boxSizing: "border-box" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(20,36,28,.42)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 999, padding: "7px 15px 7px 11px", color: "#fbf6ea", fontSize: ".74rem", fontWeight: 700, marginBottom: 18, animation: "bt-fade .7s ease both" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#46d97f", boxShadow: "0 0 0 4px rgba(70,217,127,.22)", animation: "bt-pulse 2s infinite" }} />
            Trip builder · live conditions baked in
          </div>
          <h1 style={{ fontFamily: serif, fontWeight: 800, color: "#fbf6ea", fontSize: "clamp(2.3rem,5.6vw,4.2rem)", lineHeight: 1, letterSpacing: "-.02em", textShadow: "0 4px 30px rgba(0,0,0,.4)", maxWidth: "16ch", margin: 0, animation: "bt-fade .8s ease .05s both" }}>
            Build your <em style={{ fontStyle: "italic", color: "#e4be78" }}>national-parks</em> road trip
          </h1>
          <p style={{ color: "rgba(251,246,234,.84)", fontSize: "clamp(.98rem,1.5vw,1.16rem)", margin: "18px 0 0", maxWidth: "62ch", lineHeight: 1.55, textShadow: "0 2px 16px rgba(0,0,0,.4)", animation: "bt-fade .9s ease .12s both" }}>
            Load a ready-made route or build your own. Add parks, set your dates and rental car, and get a day-by-day plan that follows real roads — each stop carrying today&apos;s live go / no-go call.
          </p>
        </section>

        {/* prebuilt rail */}
        <section style={{ maxWidth: 1320, margin: "0 auto", width: "100%", padding: "clamp(20px,3vw,30px) clamp(16px,3vw,28px) 6px", boxSizing: "border-box" }}>
          <div style={{ fontSize: ".72rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#e4be78", fontWeight: 800, marginBottom: 13, display: "flex", alignItems: "center", gap: 9, textShadow: "0 1px 8px rgba(0,0,0,.4)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c79a4b" }} />
            Browse ready-made itineraries · tap to load a full route
          </div>
          <div className="bt-scroller" style={{ display: "flex", gap: 14, overflowX: "auto", padding: "4px 2px 16px" }}>
            {ROUTES.map((r) => {
              const isLoaded = loadedRoute === r.id;
              return (
                <div key={r.id} onClick={() => loadRoute(r)} style={{ flex: "none", width: 248, background: isLoaded ? "rgba(251,246,234,.92)" : "rgba(251,246,234,.9)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", border: isLoaded ? "2px solid #c79a4b" : "1px solid rgba(255,255,255,.55)", borderRadius: 20, padding: "17px 18px", cursor: "pointer", boxShadow: "0 16px 40px rgba(8,16,12,.34)" }}>
                  <div style={{ fontSize: ".64rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#c79a4b" }}>{isLoaded ? "Loaded" : "Route"} {r.emoji}</div>
                  <h3 style={{ fontFamily: serif, fontSize: "1.2rem", fontWeight: 700, color: "#1d3941", lineHeight: 1.1, margin: "4px 0 7px" }}>{r.name}</h3>
                  <p style={{ fontSize: ".81rem", color: "#5e6557", lineHeight: 1.45, margin: 0 }}>{r.desc}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: ".72rem", color: "#2c5562", fontWeight: 700 }}>
                    <span style={{ background: "rgba(29,74,55,.08)", border: "1px solid rgba(29,74,55,.16)", borderRadius: 999, padding: "3px 10px" }}>{r.stops.length} stops</span>
                    <span style={{ background: "rgba(29,74,55,.08)", border: "1px solid rgba(29,74,55,.16)", borderRadius: 999, padding: "3px 10px" }}>{r.days} days</span>
                    <span style={{ background: "rgba(29,74,55,.08)", border: "1px solid rgba(29,74,55,.16)", borderRadius: 999, padding: "3px 10px" }}>{r.miles} mi</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============ CREAM SHEET ============ */}
        <div style={{ position: "relative", background: "#fbf6ea", borderRadius: "34px 34px 0 0", marginTop: "clamp(18px,3vh,30px)", boxShadow: "0 -26px 70px -34px rgba(8,18,12,.7)", paddingTop: 8 }}>
          <div style={{ maxWidth: 1320, margin: "0 auto", width: "100%", padding: "clamp(20px,3vw,34px) clamp(16px,3vw,28px) 44px", display: "grid", gridTemplateColumns: "1fr 480px", gap: 22, alignItems: "start", boxSizing: "border-box" }}>

            {/* MAP (sticky) */}
            <div style={{ position: "sticky", top: 90, borderRadius: 22, overflow: "hidden", border: "1px solid #e7ddca", boxShadow: "0 22px 50px -26px rgba(28,46,34,.5)", background: "#dbe6ea" }}>
              <div style={{ position: "relative", height: "76vh", minHeight: 480 }}>
                <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
                <div style={{ display: keyOverlay ? "flex" : "none", position: "absolute", inset: 0, zIndex: 5, background: "rgba(16,32,23,.72)", backdropFilter: "blur(3px)", alignItems: "center", justifyContent: "center", padding: 24 }}>
                  <div style={{ background: "#fffdf7", borderRadius: 16, padding: 22, maxWidth: 340, boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
                    <b style={{ fontFamily: serif, fontSize: "1.1rem", color: "#1d3941", display: "block", marginBottom: 6 }}>Load the live Google Map</b>
                    <p style={{ fontSize: ".82rem", color: "#8c8473", lineHeight: 1.5, margin: "0 0 12px" }}>{keyMsg}</p>
                    <input ref={keyInputRef} placeholder="AIza…" style={{ width: "100%", border: "1px solid #e7ddca", borderRadius: 10, padding: "11px 12px", fontSize: ".86rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box" }} />
                    <button onClick={saveKey} style={{ width: "100%", marginTop: 10, border: "none", cursor: "pointer", borderRadius: 10, padding: 12, fontWeight: 800, color: "#fbf6ea", background: "#2c5562", fontFamily: "inherit" }}>Load map</button>
                    <p style={{ fontSize: ".7rem", color: "#b0a894", margin: "10px 0 0", lineHeight: 1.45 }}>Stored only in your browser. Use an unrestricted dev key, or add this URL to the key&apos;s allowed referrers.</p>
                  </div>
                </div>
                <div style={{ position: "absolute", top: 14, left: 14, zIndex: 3, display: "flex", alignItems: "center", gap: 7, background: "rgba(16,32,23,.86)", color: "#e4be78", padding: "7px 13px", borderRadius: 999, fontSize: ".72rem", fontWeight: 700, letterSpacing: ".03em" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#46d97f", boxShadow: "0 0 0 3px rgba(70,217,127,.3)" }} />LIVE ROUTE
                </div>
                <div style={{ position: "absolute", bottom: 14, right: 14, zIndex: 3, background: "#fffdf7", color: "#1d3941", padding: "7px 13px", borderRadius: 999, fontSize: ".76rem", fontWeight: 700, boxShadow: "0 6px 16px rgba(0,0,0,.14)" }}>{totalMiles} mi · {driveHrs} h drive</div>
              </div>
            </div>

            {/* PANELS COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* header panel: trip name + stats */}
              <div style={{ ...panel, overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg,#33555f,#1d3941)", padding: 18, color: "#fbf6ea" }}>
                  <input value={tripName} onChange={(e) => setTripName(e.target.value)} style={{ width: "100%", fontFamily: serif, fontSize: "1.4rem", fontWeight: 700, color: "#fbf6ea", background: "transparent", border: "none", outline: "none", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
                    <div style={statCell}><b style={statB}>{stops.length}</b><span style={statS}>Stops</span></div>
                    <div style={statCell}><b style={statB}>{totalNights}</b><span style={statS}>Days</span></div>
                    <div style={statCell}><b style={statB}>{totalMiles}</b><span style={statS}>Drive mi</span></div>
                    <div style={statCell}><b style={statB}>{fmtUsd(totalCost)}</b><span style={statS}>Est. cost</span></div>
                  </div>
                </div>
              </div>

              {/* step 1: trip details */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>1</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "#1d3941", margin: "0 0 14px", minHeight: 38, display: "flex", alignItems: "center" }}>Trip details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={fieldLabel}>Start date</label>
                      <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} style={fieldBox} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={fieldLabel}>Travelers</label>
                      <select value={travelers} onChange={(e) => { setTravelers(+e.target.value); setBudgetOverride((o) => ({ ...o, food: null })); }} style={fieldBox}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} adult{n === 1 ? "" : "s"}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={fieldLabel}>Rental car</label>
                      <select value={car} onChange={(e) => setCar(e.target.value)} style={fieldBox}>
                        {CARS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={fieldLabel}>End date (auto)</label>
                      <div style={{ ...fieldBox, color: "#8c8473" }}>{fmtDate(endDate)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* step 2: itinerary */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>2</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "#1d3941", margin: "0 0 14px", minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Your itinerary</span>
                    <label onClick={() => setShowOnMap(!showOnMap)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem", fontWeight: 700, color: "#8c8473", cursor: "pointer" }}>
                      <span style={{ width: 32, height: 18, borderRadius: 999, background: showOnMap ? "#2c5562" : "#d9d3c2", position: "relative" }}>
                        <span style={{ position: "absolute", top: 2, right: showOnMap ? 2 : 16, width: 14, height: 14, borderRadius: "50%", background: "#fffdf7" }} />
                      </span>Show on map
                    </label>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {stops.map((s, i) => {
                      const v = verdicts[s.name];
                      const st = STOP_STATUS[v ? v.status : "loading"];
                      return (
                        <div key={s.name} draggable onDragStart={onDragStart(i)} onDragOver={onDragOver} onDrop={onDrop(i)} style={{ background: "#fff", border: "1px solid #e7ddca", borderRadius: 16, padding: 13, boxShadow: "0 12px 30px -22px rgba(28,46,34,.55)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                            <span style={{ color: "#cdbf9f", fontSize: "1rem", marginTop: 4, cursor: "grab" }}>⠿</span>
                            <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "linear-gradient(150deg,#33555f,#1d3941)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".86rem", border: "2px solid #e4be78", boxShadow: "0 4px 12px -4px rgba(0,0,0,.4)" }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: ".6rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#c79a4b" }}>{dayRanges[i] ? dayRanges[i].label : ""}</div>
                              <b style={{ fontFamily: serif, fontSize: "1.02rem", fontWeight: 700, color: "#1d3941", display: "block", lineHeight: 1.15 }}>{s.name}</b>
                              <div style={{ fontSize: ".72rem", color: "#8c8473", marginTop: 1 }}>
                                {s.state} · {s.nights} night{s.nights === 1 ? "" : "s"} · {i === 0 ? "arrive " + fmtShort(dayRanges[0] ? dayRanges[0].arrive : startDate) : (s.legMi != null ? s.legMi + " mi from " + stops[i - 1].name : "")}
                              </div>
                            </div>
                            <span onClick={() => removeStop(i)} style={{ color: "#b06a4a", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>×</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "7px 11px", background: st.bg, borderRadius: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot }} />
                            <b style={{ fontSize: ".74rem", color: st.text }}>{st.label}</b>
                            <span style={{ fontSize: ".74rem", color: st.note }}>{v ? v.note : "Fetching live conditions…"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: ".66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8c8473", margin: "16px 0 8px" }}>Add national parks</div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <select value={addSel} onChange={(e) => setAddSel(e.target.value)} style={{ ...fieldBox, flex: 1, color: addSel ? "#1a2b21" : "#8c8473" }}>
                      <option value="">Choose a park…</option>
                      {parksDb.filter((p) => !stops.some((s) => s.name === p.name)).map((p) => (
                        <option key={p.id} value={p.name}>{p.name} — {p.state}</option>
                      ))}
                    </select>
                    <button onClick={addPark} style={{ width: 48, flex: "none", border: "none", borderRadius: 12, background: "#2c5562", color: "#fbf6ea", fontSize: "1.2rem", cursor: "pointer", boxShadow: "0 4px 0 #16303a" }}>＋</button>
                  </div>
                  <div style={{ fontSize: ".66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8c8473", margin: "16px 0 8px" }}>Or search a place — home, hotel, town…</div>
                  <div style={{ padding: "11px 13px", border: "1.5px solid #e7ddca", borderRadius: 12, fontSize: ".88rem", color: "#b0a894", background: "#fff" }}>Type a full address or place name</div>
                </div>
              </div>

              {/* step 3: budget */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>3</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "#1d3941", margin: "0 0 4px", minHeight: 38, display: "flex", alignItems: "center" }}>Budget</div>
                  <div style={{ fontSize: ".74rem", color: "#8c8473", marginBottom: 12 }}>Tap any amount to enter your real price.</div>
                  <div>
                    <div style={budgetRow}><span style={{ color: "#4c5443" }}>⛽ Fuel</span><BudgetAmount k="fuel" /></div>
                    <div style={{ ...budgetRow, borderTop: "1px solid #e7ddca" }}><span style={{ color: "#4c5443" }}>🏨 Lodging · {totalNights} nights</span><BudgetAmount k="lodging" /></div>
                    <div style={{ ...budgetRow, borderTop: "1px solid #e7ddca" }}><span style={{ color: "#4c5443" }}>🍔 Food · {travelers} traveler{travelers === 1 ? "" : "s"}</span><BudgetAmount k="food" /></div>
                    <div style={{ ...budgetRow, borderTop: "1px solid #e7ddca" }}><span style={{ color: "#4c5443" }}>🎟️ Park passes</span><BudgetAmount k="passes" /></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, paddingTop: 13, borderTop: "2px solid #c79a4b" }}>
                    <span style={{ fontFamily: serif, fontSize: "1.08rem", color: "#1d3941", fontWeight: 700 }}>Estimated total</span>
                    <span style={{ fontFamily: serif, fontSize: "1.7rem", color: "#2c5562", fontWeight: 800 }}>{fmtUsd(totalCost)}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: ".72rem", color: "#8c8473", marginTop: 3 }}>≈ {fmtUsd(totalCost / Math.max(1, travelers))} per person</div>
                </div>
              </div>

              {/* step 4: navigate & share */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>4</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "#1d3941", margin: "0 0 14px", minHeight: 38, display: "flex", alignItems: "center" }}>Navigate &amp; share</div>
                  <div style={{ display: "flex", gap: 9, marginBottom: 11 }}>
                    <a href={gmapsUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#2c5562", color: "#fff", borderRadius: 12, padding: "11px 15px", fontWeight: 700, fontSize: ".85rem", boxShadow: "0 4px 0 #16303a" }}>Google Maps ↗</a>
                    <a href={appleUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#fff", border: "1.5px solid #e7ddca", color: "#2c5562", borderRadius: 12, padding: "11px 15px", fontWeight: 700, fontSize: ".85rem" }}>Apple Maps ↗</a>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a href={waUrl} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 88, textAlign: "center", textDecoration: "none", background: "#1faa55", color: "#fff", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".85rem" }}>WhatsApp</a>
                    <button onClick={copyLink} style={{ flex: 1, minWidth: 88, border: "1.5px solid #e7ddca", background: "#fff", color: "#2c5562", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".85rem", cursor: "pointer", fontFamily: "inherit" }}>Copy link</button>
                  </div>
                  <button style={{ marginTop: 14, width: "100%", background: "linear-gradient(135deg,#33555f,#1d3941)", color: "#fbf6ea", border: "1px solid rgba(199,154,75,.45)", borderRadius: 13, padding: 13, fontSize: ".88rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>🛂 Trip Passport · download PDF</button>
                </div>
              </div>

              {/* coming soon */}
              <div style={{ ...panel, padding: 20, boxShadow: "0 22px 50px -30px rgba(28,46,34,.4)" }}>
                <div style={{ border: "1px dashed #e7ddca", borderRadius: 16, padding: 16, background: "repeating-linear-gradient(135deg,#f6f1e6,#f6f1e6 12px,#f1ebde 12px,#f1ebde 24px)" }}>
                  <span style={{ display: "inline-block", fontSize: ".58rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", background: "linear-gradient(120deg,#e4be78,#c79a4b)", color: "#3a2e08", padding: "3px 10px", borderRadius: 999, marginBottom: 9 }}>Coming soon</span>
                  <h4 style={{ fontFamily: serif, fontSize: "1.05rem", fontWeight: 700, color: "#1d3941", margin: "0 0 5px" }}>📎 Reservations &amp; live trip tracking</h4>
                  <p style={{ fontSize: ".8rem", color: "#8c8473", lineHeight: 1.5, margin: 0 }}>Upload your campground, park and rental-car confirmations and we&apos;ll keep everything in one place — with live updates on weather, closures and check-in reminders as you travel.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
                    <span style={{ fontSize: ".68rem", background: "#fff", border: "1px solid #e7ddca", color: "#6a6553", padding: "5px 10px", borderRadius: 999, fontWeight: 600 }}>Confirmations</span>
                    <span style={{ fontSize: ".68rem", background: "#fff", border: "1px solid #e7ddca", color: "#6a6553", padding: "5px 10px", borderRadius: 999, fontWeight: 600 }}>Weather alerts</span>
                    <span style={{ fontSize: ".68rem", background: "#fff", border: "1px solid #e7ddca", color: "#6a6553", padding: "5px 10px", borderRadius: 999, fontWeight: 600 }}>Check-in reminders</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer style={{ textAlign: "center", color: "rgba(28,46,34,.6)", fontSize: ".72rem", padding: 24, borderTop: "1px solid #e7ddca" }}>
            Drive times &amp; costs are planning estimates · live weather &amp; official info on each park&apos;s status page · ParkBuddy
          </footer>
        </div>
      </div>
    </div>
  );
}
