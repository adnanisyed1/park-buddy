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
import { getStops as tripStops, getMeta as tripMeta, setStops as tripSetStops, setMeta as tripSetMeta } from "../lib/trip";
import SiteHeader from "../components/SiteHeader";

/* ---------------- constants (verbatim from the design) ---------------- */

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

// Trail line colors (match /explore).
const TRAIL_STYLE = { hiking: "#3f7a34", offroad: "#a15a2a", ski: "#2a6f9e" };

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
  go:      { label: "GO",       dot: "#4fd98a", text: "#7fe3a6", note: "#9fbfa8", bg: "rgba(79,217,138,.1)" },
  caution: { label: "CAUTION",  dot: "#e8cf9a", text: "#e8cf9a", note: "#c3b98f", bg: "rgba(232,207,154,.12)" },
  heat:    { label: "HEAT",     dot: "#e0a56a", text: "#e0a56a", note: "#c39a78", bg: "rgba(224,144,106,.14)" },
  hold:    { label: "HOLD OFF", dot: "#e0906a", text: "#e0906a", note: "#c99a86", bg: "rgba(224,144,106,.12)" },
  loading: { label: "CHECKING", dot: "#9aa7a0", text: "#9aa7a0", note: "var(--pb-muted)", bg: "rgba(255,255,255,.05)" },
};

// One filter toggle row (Explore-style: glyph + label + switch).
function BtTog({ glyph, color, label, on, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "transparent", border: "none", padding: "8px 2px" }}>
      <span style={{ color, fontSize: ".82rem", width: 16, textAlign: "center", flex: "none" }}>{glyph}</span>
      <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: on ? "var(--pb-ink)" : "#9aa7a0" }}>{label}</span>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? "var(--pb-grad-gold)" : "rgba(255,255,255,.12)", position: "relative", flex: "none", transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: on ? "var(--pb-bg)" : "#e7e3d8", transition: "left .2s" }} />
      </span>
    </button>
  );
}
const btFilterMini = { cursor: "pointer", fontFamily: "inherit", fontSize: ".68rem", fontWeight: 700, color: "#e7e3d8", background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 8, padding: "4px 10px" };
const btStep = { width: 30, height: 30, flex: "none", borderRadius: 8, border: "1px solid var(--pb-line-strong)", background: "rgba(255,255,255,.04)", color: "var(--pb-ink)", fontSize: "1rem", cursor: "pointer", fontFamily: "inherit" };

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
  const [addrInput, setAddrInput] = useState("");
  const [addrMsg, setAddrMsg] = useState("");
  const [budgetOverride, setBudgetOverride] = useState({ fuel: 168, lodging: 1040, food: 560, passes: 72 }); // design preset seeds
  const [editingBudget, setEditingBudget] = useState(null); // key being edited
  const [verdicts, setVerdicts] = useState({}); // name -> {status, note}
  const [keyOverlay, setKeyOverlay] = useState(false);
  const [keyMsg, setKeyMsg] = useState("Paste a Google Maps JavaScript API key to load the live map.");

  // Explore-style filters — the full set. Destination types put clickable markers on
  // the map (tap to add to the trip); the "on the map" layers draw campgrounds, lakes
  // and trails around each stop within the radius.
  const [layers, setLayers] = useState({ np: true, statePark: false, forest: false, camp: false, lake: false, hiking: false, offroad: false, ski: false });
  const [browseState, setBrowseState] = useState(""); // "" = all states
  const [radius, setRadius] = useState(50); // miles — scopes the map layers around each stop
  const [forestsDb, setForestsDb] = useState([]);
  const [stateParksDb, setStateParksDb] = useState([]);
  const [mapReady, setMapReady] = useState(false); // flips true in initMap → retriggers marker draws
  const [roadInfo, setRoadInfo] = useState(null); // {miles, mins} from the real driving route
  const dirServiceRef = useRef(null);
  const routeGenRef = useRef(0); // ignores stale Directions callbacks
  const browseMarkersRef = useRef([]);
  const layerOverlaysRef = useRef([]); // campground/lake markers + trail polylines
  const layerCacheRef = useRef({}); // `${stopName}|${kind}` → data (avoid refetching)
  const layerGenRef = useRef(0); // cancels stale async layer draws
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const mapDivRef = useRef(null);
  const keyInputRef = useRef(null);
  const mapObjRef = useRef(null);
  const routeMarkersRef = useRef([]);
  const routeLinesRef = useRef([]); // per-leg polylines (road or straight fallback)
  const dragIdxRef = useRef(null);
  const mapReadyRef = useRef(false);
  const geocoderRef = useRef(null);
  // True once the user edits the trip here — gates writing back to the shared store
  // (so the initial seed / auto-loaded preset isn't saved as "the user's trip").
  const userEditedRef = useRef(false);

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
    userEditedRef.current = true; // a real edit — start persisting to the shared store
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

  // Geocode a typed address / hotel / town and add it as a stop (home → hotel →
  // park all live in one itinerary). Server-side geocode so it works without the
  // Google Geocoding API enabled.
  async function addAddress() {
    const q = addrInput.trim();
    if (!q) return;
    setAddrMsg("Finding…");
    try {
      const d = await fetch("/api/geocode?q=" + encodeURIComponent(q)).then((r) => (r.ok ? r.json() : null));
      if (!d || !d.found) { setAddrMsg("Couldn't find that place — try a fuller address."); return; }
      if (stops.some((s) => s.name === d.name)) { setAddrMsg(d.name + " is already in your trip."); return; }
      commitStops(stops.concat([{ name: d.name, state: d.state || "", lat: d.lat, lng: d.lng, nights: 1, legMi: null, custom: true }]));
      setAddrInput(""); setAddrMsg("");
    } catch { setAddrMsg("Geocoding is unavailable right now."); }
  }

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
        .map((s) => {
          // Custom (geocoded) stops carry their own coords; parks match trip-data.
          if (s.lat != null && s.lng != null) return { name: s.name, state: s.state || "", lat: s.lat, lng: s.lng, nights: s.nights >= 0 ? s.nights : 2, legMi: null, custom: !!s.custom };
          const p = db.find((x) => x.name === s.name);
          return p ? { name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: s.nights > 0 ? s.nights : 2, legMi: null } : null;
        })
        .filter(Boolean);
      if (matched.length) {
        setStops(recomputeLegs(matched));
        const m = tripMeta();
        setTripName(m.tripName || "My national-parks trip");
        if (m.startDate) setStartDate(m.startDate);
        if (m.travelers) setTravelers(m.travelers);
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

  // Persist edits back to the shared trip store so they survive a refresh (and show
  // in the header modal). Only after a real user edit — never the seed/auto-preset.
  // Build My Trip only manages PARKS (forests etc. have no road-trip coords), so we
  // must NOT drop the store's non-park stops — keep them alongside our park list.
  useEffect(() => {
    if (!userEditedRef.current) return;
    // Preserve store stops we don't manage here (e.g. forests added from the modal),
    // but don't duplicate our own stops (parks + geocoded customs carry coords).
    const managed = new Set(stops.map((s) => s.name));
    const preserved = tripStops().filter((s) => !managed.has(s.name));
    tripSetStops([...stops.map((s) => ({ name: s.name, nights: s.nights, lat: s.lat, lng: s.lng, state: s.state, custom: s.custom })), ...preserved]);
    tripSetMeta({ tripName, startDate, travelers });
  }, [stops, tripName, startDate, travelers]); // eslint-disable-line react-hooks/exhaustive-deps

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
      disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative",
      backgroundColor: "#e8eae4", // standard light Google Maps (no custom style)
    });
    mapReadyRef.current = true;
    setMapReady(true); // re-runs the marker-draw effects with fresh data closures
    setKeyOverlay(false);
    // Stream state parks for the visible area as the user pans (when that layer's on).
    mapObjRef.current.addListener("idle", () => { if (layersRef.current.statePark) fetchStateParks(); });
    // drawRoute/drawBrowse/drawLayers run from their effects once mapReady flips.
  }

  function drawRoute() {
    const g = window.google;
    const map = mapObjRef.current;
    if (!g || !map || !mapReadyRef.current) return;
    const gen = ++routeGenRef.current;
    routeMarkersRef.current.forEach((m) => m.setMap(null));
    routeMarkersRef.current = [];
    routeLinesRef.current.forEach((l) => l.setMap(null));
    routeLinesRef.current = [];
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
    map.fitBounds(bounds, 52);

    if (stops.length < 2) { setRoadInfo(null); return; }
    if (!dirServiceRef.current) dirServiceRef.current = new g.maps.DirectionsService();
    const reqStops = stops.slice();
    const mapObj = mapObjRef.current;
    // Route each consecutive LEG on its own. A single multi-waypoint request fails
    // entirely if any one park's centroid isn't reachable by road (e.g. Zion's
    // canyon interior), so per-leg we draw the real road where it routes and a
    // dashed straight line only for the leg that can't.
    const routeLeg = (a, b, attempt) => new Promise((resolve) => {
      dirServiceRef.current.route({ origin: { lat: a.lat, lng: a.lng }, destination: { lat: b.lat, lng: b.lng }, travelMode: g.maps.TravelMode.DRIVING }, (res, status) => {
        if (status === "OK" && res && res.routes && res.routes[0]) {
          const lg = res.routes[0];
          resolve({ ok: true, path: lg.overview_path, meters: lg.legs.reduce((s, l) => s + (l.distance ? l.distance.value : 0), 0), secs: lg.legs.reduce((s, l) => s + (l.duration ? l.duration.value : 0), 0) });
        } else if (attempt < 2 && status !== "ZERO_RESULTS" && status !== "NOT_FOUND" && status !== "REQUEST_DENIED") {
          setTimeout(() => routeLeg(a, b, attempt + 1).then(resolve), 500 * (attempt + 1));
        } else resolve({ ok: false });
      });
    });
    (async () => {
      let meters = 0, secs = 0;
      for (let i = 0; i < reqStops.length - 1; i++) {
        const a = reqStops[i], b = reqStops[i + 1];
        const r = await routeLeg(a, b, 0);
        if (gen !== routeGenRef.current || !mapReadyRef.current) return; // stale — a newer draw superseded us
        if (r.ok) {
          routeLinesRef.current.push(new g.maps.Polyline({ path: r.path, map: mapObj, strokeColor: "#e4be78", strokeOpacity: 0.95, strokeWeight: 4 }));
          meters += r.meters; secs += r.secs;
        } else {
          routeLinesRef.current.push(new g.maps.Polyline({ path: [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], map: mapObj, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: "#e4be78", scale: 3 }, offset: "0", repeat: "12px" }] }));
          const mi = milesBetween(a, b) * 1.25; // straight-line → road estimate
          meters += mi * 1609.34; secs += (mi / 55) * 3600;
        }
      }
      if (gen === routeGenRef.current) setRoadInfo({ miles: Math.round(meters / 1609.34), mins: Math.round(secs / 60) });
    })();
  }
  useEffect(() => { drawRoute(); }, [stops, showOnMap, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- browse markers (Explore-style filters) ---------------- */

  // National forests dataset (for the "Forests" layer).
  useEffect(() => {
    fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).then((d) => setForestsDb((d && d.forests) || [])).catch(() => {});
  }, []);

  function browseMarkerSvg(type, color) {
    let shape;
    if (type === "forest") shape = '<polygon points="11,3 19,18 3,18" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/>';
    else if (type === "statePark") shape = '<g transform="rotate(45 11 11)"><rect x="4.5" y="4.5" width="13" height="13" rx="2" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/></g>';
    else shape = '<circle cx="11" cy="11" r="8" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' + shape + "</svg>");
  }

  function addDestination(d) {
    if (!d || d.lat == null || stops.some((s) => s.name === d.name)) return;
    commitStops(stops.concat([{ name: d.name, state: d.state || "", lat: d.lat, lng: d.lng, nights: 1, legMi: null }]));
  }

  function drawBrowse() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map || !mapReadyRef.current) return;
    browseMarkersRef.current.forEach((m) => m.setMap(null));
    browseMarkersRef.current = [];
    const inTrip = new Set(stops.map((s) => s.name));
    const st = browseState;
    const paint = (list, type, color) => {
      list.forEach((d) => {
        if (!d || d.lat == null || inTrip.has(d.name)) return;
        if (st && d.state !== st) return;
        const mk = new g.maps.Marker({
          position: { lat: d.lat, lng: d.lng }, map, title: d.name + (d.state ? " · " + d.state : "") + " — tap to add",
          icon: { url: browseMarkerSvg(type, color), scaledSize: new g.maps.Size(22, 22), anchor: new g.maps.Point(11, 11) },
          zIndex: 1,
        });
        mk.addListener("click", () => addDestination({ name: d.name, state: d.state, lat: d.lat, lng: d.lng }));
        browseMarkersRef.current.push(mk);
      });
    };
    if (layers.np) paint(parksDb, "np", "#5fbf86");
    if (layers.forest) paint(forestsDb, "forest", "#6f9e5a");
    if (layers.statePark) paint(stateParksDb, "statePark", "#d9a441");
  }
  useEffect(() => { drawBrowse(); }, [layers, browseState, parksDb, forestsDb, stateParksDb, stops, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -------- "on the map" layers: campgrounds / lakes / trails around each stop -------- */

  async function ensureLayerData(stop, kind) {
    const key = stop.name + "|" + kind;
    if (layerCacheRef.current[key]) return layerCacheRef.current[key];
    const la = stop.lat.toFixed(4), ln = stop.lng.toFixed(4);
    let data = null;
    try {
      if (kind === "camp") {
        const d = await fetch("/api/places?lat=" + la + "&lng=" + ln + "&radius=" + radius).then((r) => (r.ok ? r.json() : null));
        data = ((d && d.facilities) || []).concat((d && d.recAreas) || []).filter((x) => x && x.lat != null);
      } else if (kind === "lake") {
        const d = await fetch("/api/water?lat=" + la + "&lng=" + ln + "&radius=" + Math.round(radius * 1.609)).then((r) => (r.ok ? r.json() : null));
        data = ((d && d.lakes) || []).filter((x) => x && x.lat != null);
      } else {
        const d = await fetch("/api/trails?lat=" + la + "&lng=" + ln + "&radius=" + radius).then((r) => (r.ok ? r.json() : null));
        data = d && (d.hiking || d.offroad || d.ski) ? d : { hiking: [], offroad: [], ski: [] };
      }
    } catch {}
    layerCacheRef.current[key] = data || (kind === "trails" ? { hiking: [], offroad: [], ski: [] } : []);
    return layerCacheRef.current[key];
  }

  async function drawLayers() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map || !mapReadyRef.current) return;
    layerOverlaysRef.current.forEach((o) => o.setMap(null));
    layerOverlaysRef.current = [];
    const L = layers;
    const needTrails = L.hiking || L.offroad || L.ski;
    if (!L.camp && !L.lake && !needTrails) return;
    const gen = ++layerGenRef.current;
    const dot = (color, r) => ({ url: browseMarkerSvg("np", color), scaledSize: new g.maps.Size(r, r), anchor: new g.maps.Point(r / 2, r / 2) });
    for (const stop of stops) {
      if (L.camp) {
        const d = await ensureLayerData(stop, "camp"); if (gen !== layerGenRef.current) return;
        d.forEach((c) => layerOverlaysRef.current.push(new g.maps.Marker({ position: { lat: c.lat, lng: c.lng }, map, title: (c.name || "Campground") + " · campground", icon: { ...dot("#d08a4b", 15) }, zIndex: 0 })));
      }
      if (L.lake) {
        const d = await ensureLayerData(stop, "lake"); if (gen !== layerGenRef.current) return;
        d.forEach((k) => layerOverlaysRef.current.push(new g.maps.Marker({ position: { lat: k.lat, lng: k.lng }, map, title: (k.name || "Lake") + " · lake", icon: { ...dot("#4f96c9", 14) }, zIndex: 0 })));
      }
      if (needTrails) {
        const d = await ensureLayerData(stop, "trails"); if (gen !== layerGenRef.current) return;
        ["hiking", "offroad", "ski"].forEach((cat) => {
          if (!L[cat]) return;
          (d[cat] || []).forEach((t) => {
            if (!t.path || t.path.length < 2) return;
            layerOverlaysRef.current.push(new g.maps.Polyline({ path: t.path.map((p) => ({ lat: p[0], lng: p[1] })), map, strokeColor: TRAIL_STYLE[cat], strokeOpacity: 0.85, strokeWeight: 3, zIndex: 0 }));
          });
        });
      }
    }
  }
  useEffect(() => { drawLayers(); }, [layers, radius, stops, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // State parks stream in live by map bbox (empty if the destinations table isn't
  // configured — honest, the rest of the map still works). Accumulate as you pan.
  function fetchStateParks() {
    const map = mapObjRef.current;
    if (!map || !map.getBounds) return;
    const b = map.getBounds();
    if (!b) return;
    const ne = b.getNorthEast(), sw = b.getSouthWest();
    const bbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()].map((n) => n.toFixed(3)).join(",");
    fetch("/api/destinations?bbox=" + bbox + "&type=state_park&limit=250").then((r) => (r.ok ? r.json() : null)).then((d) => {
      const list = ((d && d.destinations) || []).filter((x) => x && x.lat != null).map((x) => ({ name: x.name, state: x.state, lat: x.lat, lng: x.lng }));
      if (!list.length) return;
      setStateParksDb((prev) => { const seen = new Set(prev.map((p) => p.name)); return prev.concat(list.filter((x) => !seen.has(x.name))); });
    }).catch(() => {});
  }
  // Fetch when the State Parks layer is switched on.
  useEffect(() => { if (layers.statePark) fetchStateParks(); }, [layers.statePark]); // eslint-disable-line react-hooks/exhaustive-deps

  // States list for the browse filter (from the real datasets).
  const browseStates = (() => {
    const set = new Set();
    parksDb.forEach((p) => p.state && set.add(p.state));
    forestsDb.forEach((f) => f.state && set.add(f.state));
    return [...set].sort();
  })();

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
  const mono = "var(--pb-mono), ui-monospace, monospace";
  const panel = { position: "relative", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 22, boxShadow: "0 22px 50px -30px rgba(0,0,0,.7)" };
  const stepNum = { position: "absolute", left: 10, top: 20, width: 37, height: 37, borderRadius: 12, background: "linear-gradient(150deg,#33555f,#1d3941)", color: "#e4be78", border: "1px solid rgba(228,190,120,.45)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: "1.06rem", fontWeight: 800, boxShadow: "0 8px 18px -8px rgba(8,18,12,.6)" };
  const fieldLabel = { fontSize: ".66rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--pb-muted)" };
  const fieldBox = { padding: "11px 13px", border: "1.5px solid var(--pb-line-strong)", borderRadius: 12, fontSize: ".88rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.04)", fontFamily: "inherit", boxSizing: "border-box", width: "100%", colorScheme: "dark" };
  const statCell = { flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 13, padding: "9px 6px", textAlign: "center", backdropFilter: "blur(6px)" };
  const statB = { display: "block", fontFamily: serif, fontSize: "1.22rem", fontWeight: 700, color: "#e4be78", lineHeight: 1 };
  const statS = { fontSize: ".56rem", color: "rgba(251,246,234,.72)", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 4, display: "block", fontWeight: 700 };
  const budgetRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", fontSize: ".88rem" };
  const budgetVal = { fontWeight: 700, color: "var(--pb-gold-soft)", fontFamily: serif, cursor: "pointer" };

  const BudgetAmount = ({ k }) => editingBudget === k ? (
    <input
      type="number" autoFocus defaultValue={budget[k]}
      onBlur={(e) => { const v = Math.max(0, Math.round(+e.target.value || 0)); setBudgetOverride((o) => ({ ...o, [k]: v })); setEditingBudget(null); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      style={{ width: 90, textAlign: "right", fontWeight: 700, color: "var(--pb-gold-soft)", fontFamily: serif, fontSize: ".88rem", border: "1.5px solid #c79a4b", borderRadius: 8, padding: "3px 7px", outline: "none", background: "rgba(255,255,255,.04)", colorScheme: "dark" }}
    />
  ) : (
    <span style={budgetVal} title="Tap to enter your real price" onClick={() => setEditingBudget(k)}>{fmtUsd(budget[k])}</span>
  );

  /* ================================ render ================================ */

  return (
    <div style={{ fontFamily: sans, color: "var(--pb-ink)", position: "relative", minHeight: "100vh", background: "var(--pb-bg)" }}>
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
        /* stack the map + planner columns on narrow screens; map isn't sticky there */
        @media (max-width: 900px) {
          .bt-sheet-grid { grid-template-columns: 1fr !important; }
          .bt-sheet-grid > div:first-child { position: static !important; }
        }
      `}</style>

      {/* ============ LIVING SCENE (dusk-dark) ============ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: "linear-gradient(180deg,#0a1017 0%,#0c1712 52%,#0e1f16 100%)" }}>
        {/* soft gold moon glow */}
        <div style={{ position: "absolute", top: "-10%", right: "8%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%,rgba(232,207,154,.5),rgba(217,183,121,.16) 42%,transparent 70%)", filter: "blur(6px)", animation: "bt-sun 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "12%", width: 260, height: 70, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%,rgba(180,200,210,.12),transparent 72%)", filter: "blur(10px)", opacity: 0.6, animation: "bt-drift 56s linear infinite" }} />
        <div style={{ position: "absolute", top: "22%", width: 180, height: 54, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%,rgba(180,200,210,.1),transparent 72%)", filter: "blur(10px)", opacity: 0.5, animation: "bt-drift 74s linear infinite", animationDelay: "-20s" }} />
        {/* layered mountain silhouettes, dark greens */}
        <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: "54vh", background: "linear-gradient(180deg,#16352a,#122b22)", opacity: 0.5, clipPath: "polygon(0 64%,18% 40%,34% 56%,52% 30%,68% 52%,84% 34%,100% 50%,100% 100%,0 100%)" }} />
        <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: "44vh", background: "linear-gradient(180deg,#102820,#0d2019)", opacity: 0.8, clipPath: "polygon(0 72%,14% 54%,30% 68%,46% 44%,62% 64%,80% 46%,100% 62%,100% 100%,0 100%)" }} />
        <div style={{ position: "absolute", left: "-5%", right: "-5%", bottom: 0, height: "36vh", background: "linear-gradient(180deg,#0b1a14,#08120d)", clipPath: "polygon(0 78%,12% 62%,28% 76%,44% 56%,60% 74%,78% 58%,100% 72%,100% 100%,0 100%)" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(130% 92% at 50% 6%,transparent 40%,rgba(5,9,7,.55) 100%)" }} />

      {/* shared platform header (fixed) */}
      <SiteHeader acctSlot />

      {/* ============ SHELL ============ */}
      <div style={{ position: "relative", zIndex: 4, display: "flex", flexDirection: "column", minHeight: "100vh", paddingTop: 64 }}>

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
                <div key={r.id} onClick={() => { userEditedRef.current = true; loadRoute(r); }} style={{ flex: "none", width: 248, background: "linear-gradient(180deg,rgba(16,34,24,.9),rgba(9,20,14,.9))", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", border: isLoaded ? "1.5px solid var(--pb-gold)" : "1px solid var(--pb-line-strong)", borderRadius: 20, padding: "17px 18px", cursor: "pointer", boxShadow: isLoaded ? "0 0 0 1px rgba(217,183,121,.3),0 16px 40px -20px rgba(0,0,0,.7)" : "0 16px 40px -20px rgba(0,0,0,.7)" }}>
                  <div style={{ fontSize: ".64rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold)" }}>{isLoaded ? "Loaded" : "Route"} {r.emoji}</div>
                  <h3 style={{ fontFamily: serif, fontSize: "1.2rem", fontWeight: 700, color: "var(--pb-ink)", lineHeight: 1.1, margin: "4px 0 7px" }}>{r.name}</h3>
                  <p style={{ fontSize: ".81rem", color: "var(--pb-ink-2)", lineHeight: 1.45, margin: 0 }}>{r.desc}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: ".72rem", color: "var(--pb-gold-soft)", fontWeight: 700 }}>
                    <span style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: "3px 10px" }}>{r.stops.length} stops</span>
                    <span style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: "3px 10px" }}>{r.days} days</span>
                    <span style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: "3px 10px" }}>{r.miles} mi</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============ SHEET ============ */}
        <div style={{ position: "relative", background: "linear-gradient(180deg,rgba(9,18,13,.92),var(--pb-bg))", borderTop: "1px solid var(--pb-line)", borderRadius: "34px 34px 0 0", marginTop: "clamp(18px,3vh,30px)", boxShadow: "0 -26px 70px -34px rgba(0,0,0,.85)", paddingTop: 8 }}>
          <div className="bt-sheet-grid" style={{ maxWidth: 1320, margin: "0 auto", width: "100%", padding: "clamp(20px,3vw,34px) clamp(16px,3vw,28px) 44px", display: "grid", gridTemplateColumns: "1fr 480px", gap: 22, alignItems: "start", boxSizing: "border-box" }}>

            {/* LEFT COLUMN — filters (off the map) + map */}
            <div>
            {/* ===== FILTER PANEL (Explore's full set) ===== */}
            <div style={{ ...panel, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Filters · tap a map marker to add</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setLayers({ np: true, statePark: true, forest: true, camp: true, lake: true, hiking: true, offroad: true, ski: true })} style={btFilterMini}>All</button>
                  <button onClick={() => setLayers({ np: false, statePark: false, forest: false, camp: false, lake: false, hiking: false, offroad: false, ski: false })} style={btFilterMini}>None</button>
                </div>
              </div>
              {/* state + radius */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <label style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={fieldLabel}>State</span>
                  <select value={browseState} onChange={(e) => setBrowseState(e.target.value)} style={fieldBox}>
                    <option value="">All states</option>
                    {browseStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={fieldLabel}>Layers radius · {radius} mi</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                    <button onClick={() => setRadius((r) => Math.max(10, r - 25))} style={btStep}>−</button>
                    <input type="range" min="10" max="150" step="5" value={radius} onChange={(e) => setRadius(+e.target.value)} style={{ flex: 1, accentColor: "#d9b779" }} />
                    <button onClick={() => setRadius((r) => Math.min(150, r + 25))} style={btStep}>+</button>
                  </div>
                </div>
              </div>
              {/* destination types */}
              <div style={{ ...fieldLabel, marginBottom: 7 }}>Destination types</div>
              <div style={{ marginBottom: 14 }}>
                <BtTog glyph="●" color="#5fbf86" label="National Parks" on={layers.np} onClick={() => setLayers((l) => ({ ...l, np: !l.np }))} />
                <BtTog glyph="◆" color="#d9a441" label="State Parks" on={layers.statePark} onClick={() => setLayers((l) => ({ ...l, statePark: !l.statePark }))} />
                <BtTog glyph="▲" color="#6f9e5a" label="National Forests" on={layers.forest} onClick={() => setLayers((l) => ({ ...l, forest: !l.forest }))} />
              </div>
              {/* on-the-map layers */}
              <div style={{ ...fieldLabel, marginBottom: 7 }}>On the map · around each stop</div>
              <div>
                <BtTog glyph="▲" color="#d08a4b" label="Campgrounds &amp; areas" on={layers.camp} onClick={() => setLayers((l) => ({ ...l, camp: !l.camp }))} />
                <BtTog glyph="●" color="#4f96c9" label="Lakes" on={layers.lake} onClick={() => setLayers((l) => ({ ...l, lake: !l.lake }))} />
                <BtTog glyph="▬" color={TRAIL_STYLE.hiking} label="Hiking trails" on={layers.hiking} onClick={() => setLayers((l) => ({ ...l, hiking: !l.hiking }))} />
                <BtTog glyph="▬" color={TRAIL_STYLE.offroad} label="Off-road / 4×4" on={layers.offroad} onClick={() => setLayers((l) => ({ ...l, offroad: !l.offroad }))} />
                <BtTog glyph="▬" color={TRAIL_STYLE.ski} label="Ski routes" on={layers.ski} onClick={() => setLayers((l) => ({ ...l, ski: !l.ski }))} />
              </div>
            </div>

            {/* MAP (sticky) */}
            <div style={{ position: "sticky", top: 90, borderRadius: 22, overflow: "hidden", border: "1px solid var(--pb-line)", boxShadow: "0 22px 50px -26px rgba(28,46,34,.5)", background: "#e8eae4" }}>
              <div style={{ position: "relative", height: "76vh", minHeight: 480 }}>
                <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
                <div style={{ display: keyOverlay ? "flex" : "none", position: "absolute", inset: 0, zIndex: 5, background: "rgba(16,32,23,.72)", backdropFilter: "blur(3px)", alignItems: "center", justifyContent: "center", padding: 24 }}>
                  <div style={{ background: "var(--pb-surface)", borderRadius: 16, padding: 22, maxWidth: 340, boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
                    <b style={{ fontFamily: serif, fontSize: "1.1rem", color: "var(--pb-ink)", display: "block", marginBottom: 6 }}>Load the live Google Map</b>
                    <p style={{ fontSize: ".82rem", color: "var(--pb-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>{keyMsg}</p>
                    <input ref={keyInputRef} placeholder="AIza…" style={{ width: "100%", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 12px", fontSize: ".86rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,.04)", color: "var(--pb-ink)", colorScheme: "dark" }} />
                    <button onClick={saveKey} style={{ width: "100%", marginTop: 10, border: "none", cursor: "pointer", borderRadius: 10, padding: 12, fontWeight: 800, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", fontFamily: "inherit" }}>Load map</button>
                    <p style={{ fontSize: ".7rem", color: "var(--pb-muted)", margin: "10px 0 0", lineHeight: 1.45 }}>Stored only in your browser. Use an unrestricted dev key, or add this URL to the key&apos;s allowed referrers.</p>
                  </div>
                </div>
                <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 3, display: "flex", alignItems: "center", gap: 7, background: "rgba(16,32,23,.86)", color: "#e4be78", padding: "6px 12px", borderRadius: 999, fontSize: ".66rem", fontWeight: 700, letterSpacing: ".03em" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#46d97f", boxShadow: "0 0 0 3px rgba(70,217,127,.3)" }} />Tap a marker to add
                </div>
                <div style={{ position: "absolute", bottom: 14, right: 14, zIndex: 3, background: "var(--pb-surface)", color: "var(--pb-ink)", padding: "7px 13px", borderRadius: 999, fontSize: ".76rem", fontWeight: 700, boxShadow: "0 6px 16px rgba(0,0,0,.14)" }}>{roadInfo ? roadInfo.miles + " mi · " + (roadInfo.mins >= 60 ? Math.floor(roadInfo.mins / 60) + " h " + (roadInfo.mins % 60) + " m" : roadInfo.mins + " m") + " drive" : totalMiles + " mi · " + driveHrs + " h drive"}</div>
              </div>
            </div>
            </div>

            {/* PANELS COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* header panel: trip name + stats */}
              <div style={{ ...panel, overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg,#33555f,#1d3941)", padding: 18, color: "#fbf6ea" }}>
                  <input value={tripName} onChange={(e) => { userEditedRef.current = true; setTripName(e.target.value); }} style={{ width: "100%", fontFamily: serif, fontSize: "1.4rem", fontWeight: 700, color: "var(--pb-ink)", background: "transparent", border: "none", outline: "none", boxSizing: "border-box" }} />
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
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "var(--pb-ink)", margin: "0 0 14px", minHeight: 38, display: "flex", alignItems: "center" }}>Trip details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={fieldLabel}>Start date</label>
                      <input type="date" value={startDate} onChange={(e) => { if (e.target.value) { userEditedRef.current = true; setStartDate(e.target.value); } }} style={fieldBox} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={fieldLabel}>Travelers</label>
                      <select value={travelers} onChange={(e) => { userEditedRef.current = true; setTravelers(+e.target.value); setBudgetOverride((o) => ({ ...o, food: null })); }} style={fieldBox}>
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
                      <div style={{ ...fieldBox, color: "var(--pb-muted)" }}>{fmtDate(endDate)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* step 2: itinerary */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>2</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "var(--pb-ink)", margin: "0 0 14px", minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Your itinerary</span>
                    <label onClick={() => setShowOnMap(!showOnMap)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem", fontWeight: 700, color: "var(--pb-muted)", cursor: "pointer" }}>
                      <span style={{ width: 32, height: 18, borderRadius: 999, background: showOnMap ? "var(--pb-grad-gold)" : "rgba(255,255,255,.14)", position: "relative" }}>
                        <span style={{ position: "absolute", top: 2, right: showOnMap ? 2 : 16, width: 14, height: 14, borderRadius: "50%", background: showOnMap ? "var(--pb-bg)" : "#e7e3d8" }} />
                      </span>Show on map
                    </label>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {stops.map((s, i) => {
                      const v = verdicts[s.name];
                      const st = STOP_STATUS[v ? v.status : "loading"];
                      return (
                        <div key={s.name} draggable onDragStart={onDragStart(i)} onDragOver={onDragOver} onDrop={onDrop(i)} style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line)", borderRadius: 16, padding: 13, boxShadow: "0 12px 30px -22px rgba(28,46,34,.55)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                            <span style={{ color: "var(--pb-muted)", fontSize: "1rem", marginTop: 4, cursor: "grab" }}>⠿</span>
                            <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "linear-gradient(150deg,#33555f,#1d3941)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".86rem", border: "2px solid #e4be78", boxShadow: "0 4px 12px -4px rgba(0,0,0,.4)" }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: ".6rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#c79a4b" }}>{dayRanges[i] ? dayRanges[i].label : ""}</div>
                              <b style={{ fontFamily: serif, fontSize: "1.02rem", fontWeight: 700, color: "var(--pb-ink)", display: "block", lineHeight: 1.15 }}>{s.name}</b>
                              <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 1 }}>
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

                  <div style={{ fontSize: ".66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pb-muted)", margin: "16px 0 8px" }}>Add national parks</div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <select value={addSel} onChange={(e) => setAddSel(e.target.value)} style={{ ...fieldBox, flex: 1, color: addSel ? "#1a2b21" : "var(--pb-muted)" }}>
                      <option value="">Choose a park…</option>
                      {parksDb.filter((p) => !stops.some((s) => s.name === p.name)).map((p) => (
                        <option key={p.id} value={p.name}>{p.name} — {p.state}</option>
                      ))}
                    </select>
                    <button onClick={addPark} style={{ width: 48, flex: "none", border: "none", borderRadius: 12, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", fontSize: "1.2rem", cursor: "pointer", fontWeight: 700 }}>＋</button>
                  </div>
                  <div style={{ fontSize: ".66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pb-muted)", margin: "16px 0 8px" }}>Or add a place — home, hotel, town…</div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <input
                      value={addrInput}
                      onChange={(e) => { setAddrInput(e.target.value); if (addrMsg) setAddrMsg(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") addAddress(); }}
                      placeholder="123 Main St, or 'Zion Lodge', or a town…"
                      style={{ ...fieldBox, flex: 1 }}
                    />
                    <button onClick={addAddress} title="Add this place" style={{ width: 48, flex: "none", border: "none", borderRadius: 12, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", fontSize: "1.2rem", cursor: "pointer", fontWeight: 700 }}>＋</button>
                  </div>
                  {addrMsg && <div style={{ fontSize: ".74rem", color: "var(--pb-ink-2)", marginTop: 7 }}>{addrMsg}</div>}
                </div>
              </div>

              {/* step 3: budget */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>3</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "var(--pb-ink)", margin: "0 0 4px", minHeight: 38, display: "flex", alignItems: "center" }}>Budget</div>
                  <div style={{ fontSize: ".74rem", color: "var(--pb-muted)", marginBottom: 12 }}>Tap any amount to enter your real price.</div>
                  <div>
                    <div style={budgetRow}><span style={{ color: "var(--pb-ink-2)" }}>⛽ Fuel</span><BudgetAmount k="fuel" /></div>
                    <div style={{ ...budgetRow, borderTop: "1px solid var(--pb-line)" }}><span style={{ color: "var(--pb-ink-2)" }}>🏨 Lodging · {totalNights} nights</span><BudgetAmount k="lodging" /></div>
                    <div style={{ ...budgetRow, borderTop: "1px solid var(--pb-line)" }}><span style={{ color: "var(--pb-ink-2)" }}>🍔 Food · {travelers} traveler{travelers === 1 ? "" : "s"}</span><BudgetAmount k="food" /></div>
                    <div style={{ ...budgetRow, borderTop: "1px solid var(--pb-line)" }}><span style={{ color: "var(--pb-ink-2)" }}>🎟️ Park passes</span><BudgetAmount k="passes" /></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, paddingTop: 13, borderTop: "2px solid #c79a4b" }}>
                    <span style={{ fontFamily: serif, fontSize: "1.08rem", color: "var(--pb-ink)", fontWeight: 700 }}>Estimated total</span>
                    <span style={{ fontFamily: serif, fontSize: "1.7rem", color: "var(--pb-gold-soft)", fontWeight: 800 }}>{fmtUsd(totalCost)}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 3 }}>≈ {fmtUsd(totalCost / Math.max(1, travelers))} per person</div>
                </div>
              </div>

              {/* step 4: navigate & share */}
              <div style={panel}>
                <div style={{ position: "relative", padding: "24px 20px 24px 58px" }}>
                  <span style={stepNum}>4</span>
                  <div style={{ fontSize: ".96rem", fontWeight: 800, color: "var(--pb-ink)", margin: "0 0 14px", minHeight: 38, display: "flex", alignItems: "center" }}>Navigate &amp; share</div>
                  <div style={{ display: "flex", gap: 9, marginBottom: 11 }}>
                    <a href={gmapsUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", borderRadius: 12, padding: "11px 15px", fontWeight: 700, fontSize: ".85rem" }}>Google Maps ↗</a>
                    <a href={appleUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "rgba(255,255,255,.04)", border: "1.5px solid var(--pb-line)", color: "var(--pb-gold-soft)", borderRadius: 12, padding: "11px 15px", fontWeight: 700, fontSize: ".85rem" }}>Apple Maps ↗</a>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a href={waUrl} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 88, textAlign: "center", textDecoration: "none", background: "#1faa55", color: "#fff", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".85rem" }}>WhatsApp</a>
                    <button onClick={copyLink} style={{ flex: 1, minWidth: 88, border: "1.5px solid var(--pb-line)", background: "rgba(255,255,255,.04)", color: "var(--pb-gold-soft)", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".85rem", cursor: "pointer", fontFamily: "inherit" }}>Copy link</button>
                  </div>
                  <button style={{ marginTop: 14, width: "100%", background: "linear-gradient(135deg,#33555f,#1d3941)", color: "#fbf6ea", border: "1px solid rgba(199,154,75,.45)", borderRadius: 13, padding: 13, fontSize: ".88rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>🛂 Trip Passport · download PDF</button>
                </div>
              </div>

              {/* coming soon */}
              <div style={{ ...panel, padding: 20, boxShadow: "0 22px 50px -30px rgba(28,46,34,.4)" }}>
                <div style={{ border: "1px dashed var(--pb-line-strong)", borderRadius: 16, padding: 16, background: "repeating-linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.02) 12px,rgba(255,255,255,.04) 12px,rgba(255,255,255,.04) 24px)" }}>
                  <span style={{ display: "inline-block", fontSize: ".58rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", background: "linear-gradient(120deg,#e4be78,#c79a4b)", color: "#3a2e08", padding: "3px 10px", borderRadius: 999, marginBottom: 9 }}>Coming soon</span>
                  <h4 style={{ fontFamily: serif, fontSize: "1.05rem", fontWeight: 700, color: "var(--pb-ink)", margin: "0 0 5px" }}>📎 Reservations &amp; live trip tracking</h4>
                  <p style={{ fontSize: ".8rem", color: "var(--pb-muted)", lineHeight: 1.5, margin: 0 }}>Upload your campground, park and rental-car confirmations and we&apos;ll keep everything in one place — with live updates on weather, closures and check-in reminders as you travel.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
                    <span style={{ fontSize: ".68rem", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line)", color: "var(--pb-ink-2)", padding: "5px 10px", borderRadius: 999, fontWeight: 600 }}>Confirmations</span>
                    <span style={{ fontSize: ".68rem", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line)", color: "var(--pb-ink-2)", padding: "5px 10px", borderRadius: 999, fontWeight: 600 }}>Weather alerts</span>
                    <span style={{ fontSize: ".68rem", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line)", color: "var(--pb-ink-2)", padding: "5px 10px", borderRadius: 999, fontWeight: 600 }}>Check-in reminders</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer style={{ textAlign: "center", color: "var(--pb-muted)", fontSize: ".72rem", padding: 24, borderTop: "1px solid var(--pb-line)" }}>
            Drive times &amp; costs are planning estimates · live weather &amp; official info on each park&apos;s status page · ParkBuddy
          </footer>
        </div>
      </div>
    </div>
  );
}
