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
import { getSavedTrips, upsertActiveTrip, deleteSavedTrip as storeDeleteSavedTrip, subscribeSavedTrips } from "../lib/savedTrips";
import { getMapPrefs, setMapPrefs, subscribeMapPrefs, mapOptionsFor } from "../lib/mapPrefs";
import SiteHeader from "../components/SiteHeader";
import TripStudio from "./TripStudio";
import TripSetupWizard from "./TripSetupWizard";

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
const ROAD_FACTOR = 1.25; // haversine → road-miles fallback (only when Directions is unavailable); real driving miles from Google Directions override this

// Dark Trip-Studio map style (matches /explore's dark map) so the planner map reads
// like the design — deep greens, gold borders, roads hidden for a clean route canvas.
const MAP_DARK = [
  { elementType: "geometry", stylers: [{ color: "#0f2318" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7f8a82" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1712" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a4436" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#c9a35f" }, { weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#3a5a48" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#8a938b" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#aab0ba" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#123322" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#16401f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b262b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4f96c9" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const fmtUsd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtDate = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtShort = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// The precise, road-hugging route geometry — Google's per-step path points, not the
// decimated overview_path (which straightens curves). This is what Google's own line uses.
function detailedPath(route) {
  const pts = [];
  (route.legs || []).forEach((l) => (l.steps || []).forEach((st) => (st.path || []).forEach((p) => pts.push(p))));
  return pts.length ? pts : (route.overview_path || []);
}
function milesBetween(a, b) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Live verdict → design's stop-status row (GO / CAUTION / HEAT / HOLD OFF)
const STOP_STATUS = {
  go:      { label: "GO",       dot: "#8fd6a6", text: "#7fe3a6", note: "#9fbfa8", bg: "rgba(79,217,138,.1)",   chipBg: "rgba(143,214,166,0.12)", chipBorder: "rgba(143,214,166,0.35)", chipText: "#8fd6a6" },
  caution: { label: "CAUTION",  dot: "#e8cf9a", text: "#e8cf9a", note: "#c3b98f", bg: "rgba(232,207,154,.12)", chipBg: "rgba(232,207,154,0.12)", chipBorder: "rgba(232,207,154,0.35)", chipText: "#e8cf9a" },
  heat:    { label: "HEAT",     dot: "#e0a56a", text: "#e0a56a", note: "#c39a78", bg: "rgba(224,144,106,.14)", chipBg: "rgba(224,144,106,0.14)", chipBorder: "rgba(224,144,106,0.4)",  chipText: "#e0a56a" },
  hold:    { label: "HOLD OFF", dot: "#e0906a", text: "#e0906a", note: "#c99a86", bg: "rgba(224,144,106,.12)", chipBg: "rgba(224,144,106,0.12)", chipBorder: "rgba(224,144,106,0.4)",  chipText: "#e0906a" },
  loading: { label: "CHECKING", dot: "#9aa7a0", text: "#9aa7a0", note: "var(--pb-muted)", bg: "rgba(255,255,255,.05)", chipBg: "rgba(255,255,255,0.05)", chipBorder: "rgba(217,183,121,0.25)", chipText: "#9aa7a0" },
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
  const [adults, setAdults] = useState(2);
  const [infants, setInfants] = useState(0);
  const [arrivalMode, setArrivalMode] = useState("drive"); // how they reach the region: "drive" | "fly"
  const [tripScope, setTripScope] = useState("regional"); // "regional" (loop near the destination) | "crosscountry"
  const [car, setCar] = useState("Midsize SUV");
  const [stops, setStops] = useState([]); // {name, state, lat, lng, nights, legMi}
  const [totalMilesOverride, setTotalMilesOverride] = useState(720); // design preset; null = sum legs
  const [showOnMap, setShowOnMap] = useState(true);
  const [origin, setOrigin] = useState(null); // where the trip starts from (Home), {name, lat, lng} — drives the first leg + travel day
  const [mapPrefs, setMapPrefsState] = useState(() => getMapPrefs()); // platform-wide map theme + type
  const [loadedRoute, setLoadedRoute] = useState("mighty5");
  const [addSel, setAddSel] = useState("");
  const [addrInput, setAddrInput] = useState("");
  const [addrMsg, setAddrMsg] = useState("");
  const [budgetOverride, setBudgetOverride] = useState({ fuel: 168, lodging: 1040, food: 560, passes: 72, flights: null, rental: null }); // design preset seeds
  const travelers = adults + infants; // party size (for lodging/food/per-person)
  const [editingBudget, setEditingBudget] = useState(null); // key being edited
  const [verdicts, setVerdicts] = useState({}); // name -> {status, note}
  const [keyOverlay, setKeyOverlay] = useState(false);
  const [keyMsg, setKeyMsg] = useState("Paste a Google Maps JavaScript API key to load the live map.");
  // Step-by-step setup wizard (Trip details → Transportation). Auto-opens on first
  // visit, reopens from the "Trip settings" button.
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeTripId, setActiveTripId] = useState(null); // the "checked-out" My-trips entry being edited (document model)
  const wantsSaveRef = useRef(false); // set when the questionnaire is submitted → create the My-trips entry on next sync
  const [endDateOverride, setEndDateOverride] = useState(null); // wizard-set end date wins over the nights-derived one
  const [transport, setTransport] = useState({ type: "own", flightNo: "", rentalDaily: null, rentalWhere: "", fuelState: "" });

  // Explore-style filters — the full set. Destination types put clickable markers on
  // the map (tap to add to the trip); the "on the map" layers draw campgrounds, lakes
  // and trails around each stop within the radius.
  const [layers, setLayers] = useState({ np: true, statePark: false, forest: false, byway: false, camp: false, lake: false, hiking: false, offroad: false, ski: false });
  const [browseState, setBrowseState] = useState(""); // "" = all states
  const [browseQuery, setBrowseQuery] = useState(""); // Explore search box — filters candidate pins by name
  const [radius, setRadius] = useState(50); // miles — scopes the map layers around each stop
  const [forestsDb, setForestsDb] = useState([]);
  const [stateParksDb, setStateParksDb] = useState([]);
  const [bywaysDb, setBywaysDb] = useState([]); // America's Byways (scenic drives) — add whole drives as trip stops
  const [addBywaySel, setAddBywaySel] = useState("");
  const [coordInput, setCoordInput] = useState(""); // "lat, lng" for the Coordinates source
  const [railTab, setRailTab] = useState("new"); // Trip Studio mode: "new" editor | "premade" routes | "mine" saved trips
  const [mapView, setMapView] = useState("route"); // map mode: "route" (itinerary) | "explore" (discover + add)
  const [previewRoute, setPreviewRoute] = useState(null); // ready-made route shown in read-only preview (map + details)
  const [bywayDetail, setBywayDetail] = useState(null); // Wikipedia/OSM-enriched record (full itinerary + route geometry) for a scenic-drive preview
  const [savedTrips, setSavedTrips] = useState([]); // the user's explicitly-saved trips ("My trips")
  const [saveMsg, setSaveMsg] = useState(""); // brief "Saved ✓" confirmation on the summary tile
  const [addSource, setAddSource] = useState(null); // Trip Studio "+ Add a stop" → "park" | "scenic" | "place" | null
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [setupCollapsed, setSetupCollapsed] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(null); // itinerary card ↔ map pin hover link
  const [expandedStop, setExpandedStop] = useState(null); // stop name whose "Plan this day" timeline is open
  const [dayPlans, setDayPlans] = useState({}); // { [stopName]: [{id, icon, type, name, time}] } — per-day activity timelines
  const [lodging, setLodging] = useState({}); // { [stopName]: {name, lat, lng} } — where you're actually staying at each base
  const [layersOpen, setLayersOpen] = useState(false); // Trip Studio map "Layers" control popover
  const [mapReady, setMapReady] = useState(false); // flips true in initMap → retriggers marker draws
  const [roadInfo, setRoadInfo] = useState(null); // {miles, mins} from the real driving route (incl. the Home→first-base leg)
  const [originRoadMi, setOriginRoadMi] = useState(null); // real driving miles Home → first base
  const [interLegMi, setInterLegMi] = useState([]); // real driving miles into stops[k] from stops[k-1] (index-aligned to stops)
  const dirServiceRef = useRef(null);
  const routeGenRef = useRef(0); // ignores stale Directions callbacks
  const browseMarkersRef = useRef([]);
  const previewMarkersRef = useRef([]); // ready-made route preview pins
  const previewLineRef = useRef(null);
  const previewCasingRef = useRef(null); // dark casing under the byway route line
  const previewReqRef = useRef(0); // ignores stale byway Directions callbacks
  const layerOverlaysRef = useRef([]); // campground/lake markers + trail polylines
  const layerCacheRef = useRef({}); // `${stopName}|${kind}` → data (avoid refetching)
  const layerGenRef = useRef(0); // cancels stale async layer draws
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const mapDivRef = useRef(null);
  const activityCounterRef = useRef(0); // stable ids for day-plan activities
  const keyInputRef = useRef(null);
  const mapObjRef = useRef(null);
  const myLocRef = useRef(null); // "you are here" marker on the Edit-Trip map
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
  // Prefer the real driving total from Google Directions (incl. Home→first base);
  // fall back to the straight-line estimate before it resolves / when unavailable.
  const totalMiles = totalMilesOverride != null ? totalMilesOverride : (roadInfo ? roadInfo.miles : Math.round(legSum + (originRoadMi || 0)));
  const driveHrs = roadInfo ? Math.round(roadInfo.mins / 60) : Math.round(totalMiles / 60);
  const endDate = endDateOverride || (() => {
    const d = new Date(startDate + "T12:00:00");
    d.setDate(d.getDate() + totalNights);
    return d.toISOString().slice(0, 10);
  })();

  const tripDays = totalNights > 0 ? totalNights + 1 : 0; // days you hold a rental
  const isRental = transport.type === "rental" || transport.type === "fly";
  const budget = {
    flights: budgetOverride.flights ?? (arrivalMode === "fly" ? adults * 320 : 0), // rough domestic RT/adult; tap to enter real cost
    rental: budgetOverride.rental ?? (isRental && transport.rentalDaily ? Math.round(transport.rentalDaily * tripDays) : 0), // rate/day × days from the setup wizard
    fuel: budgetOverride.fuel ?? Math.round(totalMiles * FUEL_PER_MI),
    lodging: budgetOverride.lodging ?? totalNights * LODGING_PER_NIGHT,
    food: budgetOverride.food ?? adults * totalNights * FOOD_PER_PERSON_DAY, // infants ~ free
    passes: budgetOverride.passes ?? Math.min(stops.length * 35, 80),
  };
  const totalCost = budget.flights + budget.rental + budget.fuel + budget.lodging + budget.food + budget.passes;

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
      legMi: null, // real driving miles come from Google Directions (interLegMi); no straight-line estimate
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
    setRailTab("new"); // show the loaded route in the editor
  }

  // Clone a ready-made route as a brand-new trip: load its stops (NO preset budget —
  // it's just a route to follow), then ask the setup questionnaire like a new trip.
  function cloneRoute(route, db = parksDb) {
    userEditedRef.current = true;
    const list = route.stops
      .map((name, i) => { const p = db.find((x) => x.name === name); return p ? { name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: route.nights[i], legMi: null } : null; })
      .filter(Boolean);
    setStops(recomputeLegs(list));
    setTripName(route.name);
    setLoadedRoute(null);
    setTotalMilesOverride(null);
    setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null, flights: null, rental: null }); // no preset budget
    setActiveTripId(null); // a fresh trip
    try { localStorage.removeItem("pb_active_trip_id"); } catch {}
    wantsSaveRef.current = true; // the questionnaire's finish → creates the My-trips entry
    setRailTab("new");
    setSetupOpen(true); // ask the same questions as "add a new trip"
  }

  // Merge a ready-made route INTO the current trip at a chosen position (index in
  // the current stops list). Skips parks already in the trip. If the trip is empty,
  // this becomes the trip (named after the route) and gets saved to My trips.
  function insertRouteAt(route, index, db = parksDb) {
    const add = route.stops
      .map((name, i) => {
        const p = db.find((x) => x.name === name);
        return p ? { name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: route.nights[i], legMi: null } : null;
      })
      .filter(Boolean)
      .filter((s) => !stops.some((x) => x.name === s.name));
    if (!add.length) return;
    const wasEmpty = stops.length === 0;
    const next = stops.slice();
    next.splice(Math.max(0, Math.min(index, next.length)), 0, ...add);
    commitStops(next);
    if (wasEmpty) {
      setTripName(route.name);
      if (!activeTripId) wantsSaveRef.current = true; // create the My-trips entry
    }
    setRailTab("new");
  }

  // Drop a scenic drive into the current trip at a chosen position (index in the
  // stops list). The drive becomes one "byway" stop; its waypoints seed that stop's
  // "Plan this day" timeline — the drive's start & end by default, or every waypoint
  // when the user expanded the tile first. detail is the enriched byway record (full
  // itinerary); previewRoute-style basics (name/lat/lng/endpoints) come on `drive`.
  function insertScenicDrive(drive, index, { expanded = false, detail = null } = {}) {
    if (!drive || drive.lat == null) return;
    if (stops.some((s) => s.name === drive.name)) return; // already in the trip
    const stop = { name: drive.name, state: drive.states || drive.state || "", lat: drive.lat, lng: drive.lng, nights: 1, legMi: null, kind: "byway", slug: drive.id };
    const next = stops.slice();
    next.splice(Math.max(0, Math.min(index, next.length)), 0, stop);
    const wasEmpty = stops.length === 0;
    commitStops(next);
    if (wasEmpty) { setTripName(drive.name); if (!activeTripId) wantsSaveRef.current = true; }

    // Seed "Plan this day" (things to do) for the drive's day.
    const itin = detail && Array.isArray(detail.itinerary) ? detail.itinerary.filter((s) => s && s.place) : [];
    const ep = drive.endpoints || (detail && detail.endpoints) || null;
    let acts = [];
    if (expanded && itin.length) {
      acts = itin.map((s) => ({ icon: "⟿", type: "scenic", name: s.place + (s.mileFromStart != null ? " · mi " + s.mileFromStart.toFixed(1) : ""), time: "" }));
    } else {
      const first = (itin[0] && itin[0].place) || (ep && ep.from) || null;
      const last = (itin.length && itin[itin.length - 1].place) || (ep && ep.to) || null;
      acts = [first && { icon: "⟿", type: "scenic", name: "Start · " + first, time: "" }, last && { icon: "⟿", type: "scenic", name: "End · " + last, time: "" }].filter(Boolean);
    }
    if (acts.length) {
      const withIds = acts.map((a) => ({ id: "act_" + (activityCounterRef.current += 1), ...a }));
      setDayPlans((prev) => ({ ...prev, [drive.name]: (prev[drive.name] || []).concat(withIds) }));
      setExpandedStop(drive.name); // open its day timeline so the added stops are visible
    }
    setRailTab("new");
  }

  // ---- saved trips ("My trips") ----
  useEffect(() => {
    setSavedTrips(getSavedTrips());
    return subscribeSavedTrips(() => setSavedTrips(getSavedTrips()));
  }, []);

  // Snapshot the current trip into the shared saved-trips library ("My trips").
  // Flush the live page state to the store first so the snapshot matches what's
  // on screen (savedTrips.saveCurrentTrip reads the active trip from trip.js).
  function saveCurrentTrip() {
    tripSetStops(stops.map((s) => ({ name: s.name, nights: s.nights, lat: s.lat, lng: s.lng, state: s.state, custom: s.custom, kind: s.kind, slug: s.slug })));
    tripSetMeta({ tripName, startDate, endDate, adults, infants, travelers, arrivalMode, tripScope, car, transport });
    // Document model: keep the checked-out entry (activeTripId) in sync; otherwise
    // create a new My-trips entry and check it out.
    const entry = upsertActiveTrip(activeTripId, tripName || "My trip");
    if (!activeTripId) { setActiveTripId(entry.id); try { localStorage.setItem("pb_active_trip_id", entry.id); } catch {} }
    setSavedTrips(getSavedTrips());
    setSaveMsg("Saved to “My trips” ✓");
    setTimeout(() => setSaveMsg(""), 2600);
  }

  // Reload a saved trip: restore its stops + every setup answer, and make it the
  // live trip (so it persists + shows across the site).
  function loadSavedTrip(t) {
    userEditedRef.current = true;
    setActiveTripId(t.id); // check this trip out for editing (Edit Mode)
    try { localStorage.setItem("pb_active_trip_id", t.id); } catch {}
    const list = (t.stops || []).map((s) => ({ name: s.name, state: s.state || "", lat: s.lat, lng: s.lng, nights: s.nights >= 0 ? s.nights : 2, legMi: null, custom: !!s.custom, ...(s.kind ? { kind: s.kind } : {}), ...(s.slug ? { slug: s.slug } : {}) }));
    setStops(recomputeLegs(list));
    const m = t.meta || {};
    setTripName(t.name || m.tripName || "My trip");
    if (m.startDate) setStartDate(m.startDate);
    setEndDateOverride(m.endDate || null);
    if (m.adults) setAdults(m.adults);
    if (m.infants != null) setInfants(m.infants);
    if (m.arrivalMode) setArrivalMode(m.arrivalMode);
    if (m.tripScope) setTripScope(m.tripScope);
    if (m.car) setCar(m.car);
    if (m.transport) setTransport(m.transport);
    setLoadedRoute(null);
    setTotalMilesOverride(null);
    setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null, flights: null, rental: null });
    setRailTab("new"); // show the reloaded trip in the editor
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const deleteSavedTrip = (id) => {
    storeDeleteSavedTrip(id);
    // If we're deleting the trip currently checked out, drop out of Edit mode and
    // clear the canvas — otherwise the autosave immediately re-creates the entry.
    if (id === activeTripId) {
      setActiveTripId(null);
      try { localStorage.removeItem("pb_active_trip_id"); } catch {}
      setStops([]); setLoadedRoute(null); setTotalMilesOverride(null);
      setTripName("My national-parks trip");
      setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null, flights: null, rental: null });
      tripSetStops([]);
    }
    setSavedTrips(getSavedTrips());
  };

  // Start a fresh, blank trip (the "New trip" action).
  // −/+ nights on a stop (min 1) — the itinerary stepper (Trip Studio spec 3a).
  function setStopNights(i, dir) {
    userEditedRef.current = true;
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, nights: Math.max(1, (s.nights || 0) + dir) } : s)));
  }
  // "Plan this day" — per-stop activity timelines (spec §3.3). Stored locally,
  // keyed by stop name; the trip store itself stays a simple stop list.
  function toggleDayPlan(name) { setExpandedStop((cur) => (cur === name ? null : name)); }
  function addActivity(name, act) {
    const id = "act_" + (activityCounterRef.current += 1);
    setDayPlans((prev) => {
      const list = (prev[name] || []).concat([{ id, ...act }]);
      list.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      return { ...prev, [name]: list };
    });
  }
  function removeActivity(name, id) {
    setDayPlans((prev) => ({ ...prev, [name]: (prev[name] || []).filter((a) => a.id !== id) }));
  }
  function updateActivity(name, id, patch) {
    setDayPlans((prev) => ({ ...prev, [name]: (prev[name] || []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }

  // Save the current trip into My trips, then jump to that tab (spec §3.7 "+ Add my trip").
  function addMyTrip() { saveCurrentTrip(); setRailTab("mine"); }

  // Start a fresh trip. Always opens the setup questionnaire — the user answers
  // it every time they add a new trip (not just on first visit).
  function onNewTrip() {
    userEditedRef.current = true;
    setStops([]);
    setTripName("My national-parks trip");
    setLoadedRoute(null);
    setTotalMilesOverride(null);
    setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null, flights: null, rental: null });
    setRailTab("new");
    setAddSource(null); setAddMenuOpen(false);
    setActiveTripId(null); // fresh trip — the questionnaire will create a new My-trips entry
    try { localStorage.removeItem("pb_active_trip_id"); } catch {}
    setSetupOpen(true);
  }

  const removeStop = (i) => commitStops(stops.filter((_, x) => x !== i));
  // Insert a base at a chosen position (addAtRef, set when the user clicks an
  // "add a base here" divider) — otherwise append to the end. Single choke point so
  // every add source (park, address, coords, scenic, map click) can insert in place.
  const addAtRef = useRef(null);
  function insertStop(stop) {
    if (!stop || stop.lat == null || stops.some((s) => s.name === stop.name)) { addAtRef.current = null; return; }
    const next = stops.slice();
    const idx = addAtRef.current;
    next.splice(idx == null ? next.length : Math.max(0, Math.min(idx, next.length)), 0, stop);
    addAtRef.current = null;
    commitStops(next);
  }

  const addPark = () => {
    if (!addSel) return;
    const p = parksDb.find((x) => x.name === addSel);
    if (!p || stops.some((s) => s.name === p.name)) return;
    insertStop({ name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: 1, legMi: null });
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
      insertStop({ name: d.name, state: d.state || "", lat: d.lat, lng: d.lng, nights: 1, legMi: null, custom: true });
      setAddrInput(""); setAddrMsg("");
    } catch { setAddrMsg("Geocoding is unavailable right now."); }
  }

  // Reset the trip-setup answers to sensible defaults (the "use defaults" escape hatch).
  function useDefaults() {
    userEditedRef.current = true;
    setAdults(2); setInfants(0); setArrivalMode("drive"); setTripScope("regional"); setCar("Midsize SUV");
    setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null, flights: null, rental: null });
  }

  // Document model: show the setup questionnaire on load whenever there's no
  // checked-out trip yet — the trip is born from the questionnaire, so there's no
  // "Set up your trip" button to press. Once a trip is checked out, go to Edit mode.
  useEffect(() => {
    let activeId = null;
    try { activeId = localStorage.getItem("pb_active_trip_id"); } catch {}
    const hasTrip = (tripStops() || []).length > 0;
    if (activeId) {
      setActiveTripId(activeId); // already editing a saved trip → Edit mode
    } else if (hasTrip) {
      wantsSaveRef.current = true; // in-progress trip w/o an id (legacy) → adopt it as the checked-out trip
    }
    // else: no trip yet → the Edit-trip section shows its empty state (no auto-popup).
    // The user starts a trip via "＋ Add a new trip", which opens the questionnaire.
    try {
      const saved = JSON.parse(localStorage.getItem("pb_trip_dayplans") || "{}");
      if (saved && typeof saved === "object") {
        setDayPlans(saved);
        let mx = 0; Object.values(saved).forEach((l) => (l || []).forEach((a) => { const n = parseInt(String(a.id).replace("act_", ""), 10); if (n > mx) mx = n; }));
        activityCounterRef.current = mx;
      }
    } catch {}
  }, []);
  // Persist day-plan timelines locally.
  useEffect(() => {
    try { localStorage.setItem("pb_trip_dayplans", JSON.stringify(dayPlans)); } catch {}
  }, [dayPlans]);

  // Where you're staying at each base ("Staying at" line). Keyed by base name.
  useEffect(() => {
    try { const l = JSON.parse(localStorage.getItem("pb_trip_lodging") || "{}"); if (l && typeof l === "object") setLodging(l); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("pb_trip_lodging", JSON.stringify(lodging)); } catch {}
  }, [lodging]);
  function setStopLodging(name, val) {
    setLodging((prev) => { const next = { ...prev }; if (val) next[name] = val; else delete next[name]; return next; });
  }

  // Persist the REAL driving figures (from Google Directions) onto the trip so the
  // Print/PDF and any other consumer show the same real miles — not a re-estimate.
  useEffect(() => {
    if (!userEditedRef.current || roadInfo == null) return;
    try { tripSetMeta({ driveMiles: roadInfo.miles, driveMins: roadInfo.mins, legMiles: interLegMi, originMiles: originRoadMi }); } catch {}
  }, [roadInfo, interLegMi, originRoadMi]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trip origin ("starting from") — where the first drive leg begins.
  useEffect(() => {
    try { const o = JSON.parse(localStorage.getItem("pb_trip_origin") || "null"); if (o && o.lat != null) setOrigin(o); } catch {}
  }, []);
  useEffect(() => {
    try { if (origin && origin.lat != null) localStorage.setItem("pb_trip_origin", JSON.stringify(origin)); else localStorage.removeItem("pb_trip_origin"); } catch {}
  }, [origin]);

  // Apply the wizard's answers back into the planner (dates, transport, budget).
  function applySetup(x) {
    userEditedRef.current = true;
    try { localStorage.setItem("pb_trip_setup_seen", "1"); } catch {}
    if (x.tripName) setTripName(x.tripName);
    if (x.startDate) setStartDate(x.startDate);
    setEndDateOverride(x.endDate || null);
    setArrivalMode(x.transportType === "fly" ? "fly" : "drive");
    if (x.transportType === "rv") setCar("RV / Camper"); else if (x.carType) setCar(x.carType);
    setTransport({ type: x.transportType || "own", flightNo: x.flightNo || "", rentalDaily: x.rentalDaily ?? null, rentalWhere: x.rentalWhere || "", fuelState: x.fuelState || "" });
    // Fuel estimate → the budget's fuel line; rental day-rate → its own line, added in a later phase.
    setBudgetOverride((o) => ({ ...o, fuel: x.fuelEstimate != null ? x.fuelEstimate : o.fuel }));
    // Submitting the questionnaire creates (or updates) this trip in My trips — even
    // with no stops yet. If we're already editing a checked-out trip, the autosave
    // keeps it in sync; otherwise the next sync creates the entry.
    if (!activeTripId) wantsSaveRef.current = true;
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
          if (s.lat != null && s.lng != null) return { name: s.name, state: s.state || "", lat: s.lat, lng: s.lng, nights: s.nights >= 0 ? s.nights : 2, legMi: null, custom: !!s.custom, ...(s.kind ? { kind: s.kind } : {}), ...(s.slug ? { slug: s.slug } : {}) };
          const p = db.find((x) => x.name === s.name);
          return p ? { name: p.name, state: p.state, lat: p.lat, lng: p.lng, nights: s.nights > 0 ? s.nights : 2, legMi: null } : null;
        })
        .filter(Boolean);
      if (matched.length) {
        setStops(recomputeLegs(matched));
        const m = tripMeta();
        setTripName(m.tripName || "My national-parks trip");
        if (m.startDate) setStartDate(m.startDate);
        if (m.adults) setAdults(m.adults); else if (m.travelers) setAdults(m.travelers);
        if (m.infants != null) setInfants(m.infants);
        if (m.arrivalMode) setArrivalMode(m.arrivalMode);
        if (m.tripScope) setTripScope(m.tripScope);
        setLoadedRoute(null);
        setTotalMilesOverride(null);
        setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null });
      } else {
        // No saved trip → start empty so the Edit-trip section shows its empty state
        // ("Add a new trip, or pick one from My trips / Ready-made routes"). The demo
        // preset is no longer auto-loaded; the user creates a trip via the questionnaire.
        setStops([]);
        setLoadedRoute(null);
        setTotalMilesOverride(null);
        setTripName("My national-parks trip");
        setBudgetOverride({ fuel: null, lodging: null, food: null, passes: null, flights: null, rental: null });
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
    tripSetStops([...stops.map((s) => ({ name: s.name, nights: s.nights, lat: s.lat, lng: s.lng, state: s.state, custom: s.custom, kind: s.kind, slug: s.slug })), ...preserved]);
    tripSetMeta({ tripName, startDate, adults, infants, travelers, arrivalMode, tripScope, endDate, transport });
    // Document model: once a trip is "checked out" (activeTripId) or the questionnaire
    // was just submitted (wantsSaveRef), autosave every edit into that My-trips entry.
    if (activeTripId) {
      upsertActiveTrip(activeTripId, tripName);
    } else if (wantsSaveRef.current) {
      wantsSaveRef.current = false;
      const entry = upsertActiveTrip(null, tripName);
      setActiveTripId(entry.id);
      try { localStorage.setItem("pb_active_trip_id", entry.id); } catch {}
    }
  }, [stops, tripName, startDate, adults, infants, arrivalMode, tripScope, endDate, transport, activeTripId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&libraries=places&v=weekly&loading=async&callback=__pbBtInit";
    s.onerror = () => { setKeyMsg("Could not load Google Maps. Check your connection or the key."); setKeyOverlay(true); };
    document.head.appendChild(s);
  }

  // Change the platform-wide map theme/type from the map-style menu, and apply it
  // to this map live. Every other map on the site reads the same pref on load.
  function setMapPref(patch) {
    const next = setMapPrefs(patch);
    setMapPrefsState(next);
    const g = window.google, map = mapObjRef.current;
    if (g && map) { const mo = mapOptionsFor(next, MAP_DARK); map.setOptions({ mapTypeId: mo.mapTypeId, styles: mo.styles }); }
  }
  useEffect(() => subscribeMapPrefs((p) => {
    setMapPrefsState(p);
    const g = window.google, map = mapObjRef.current;
    if (g && map) { const mo = mapOptionsFor(p, MAP_DARK); map.setOptions({ mapTypeId: mo.mapTypeId, styles: mo.styles }); }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  function initMap() {
    const el = mapDivRef.current;
    if (!el || !window.google) return;
    const g = window.google;
    const mo = mapOptionsFor(getMapPrefs(), MAP_DARK);
    mapObjRef.current = new g.maps.Map(el, {
      center: { lat: 38.05, lng: -111.3 }, zoom: 7,
      mapTypeId: mo.mapTypeId, styles: mo.styles,
      disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative",
      backgroundColor: "#08130d", // dark Trip-Studio canvas
    });
    mapReadyRef.current = true;
    setMapReady(true); // re-runs the marker-draw effects with fresh data closures
    setKeyOverlay(false);
    // Stream state parks for the visible area as the user pans (when that layer's on).
    mapObjRef.current.addListener("idle", () => { if (layersRef.current.statePark) fetchStateParks(); });

    // "My location" control — drops a blue you-are-here dot and pans to it.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Show my current location";
    btn.setAttribute("aria-label", "Show my current location");
    btn.style.cssText = "margin:10px;width:40px;height:40px;border-radius:11px;border:1px solid rgba(217,183,121,0.3);background:rgba(10,23,18,0.92);color:#e8cf9a;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px -10px rgba(0,0,0,0.8);backdrop-filter:blur(6px)";
    btn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>';
    btn.onclick = () => {
      if (!navigator.geolocation) return;
      btn.style.opacity = "0.5";
      navigator.geolocation.getCurrentPosition((pos) => {
        btn.style.opacity = "1";
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }, gg = window.google, map = mapObjRef.current;
        if (!gg || !map) return;
        if (myLocRef.current) myLocRef.current.setPosition(p);
        else myLocRef.current = new gg.maps.Marker({ position: p, map, zIndex: 999, title: "You are here", icon: { path: gg.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#4c9be8", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2.5 } });
        map.panTo(p); map.setZoom(Math.max(map.getZoom() || 7, 9));
      }, () => { btn.style.opacity = "1"; }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    };
    mapObjRef.current.controls[g.maps.ControlPosition.RIGHT_BOTTOM].push(btn);
    // drawRoute/drawBrowse/drawLayers run from their effects once mapReady flips.
  }

  // Trip-Studio route pin: dark core, gold ring, soft gold halo + gold numeral.
  // The hovered variant grows the halo + brightens the ring (matches the design's
  // "hover a stop card → halo its map pin" interaction).
  function pinIcon(g, n, hov) {
    const halo = hov ? 21 : 18, haloO = hov ? 0.32 : 0.15, ring = hov ? 13 : 12, rc = hov ? "#f6e6bd" : "#e8cf9a", rw = hov ? 3.2 : 2.6;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="' + halo + '" fill="#e8cf9a" opacity="' + haloO + '"/><circle cx="22" cy="22" r="' + ring + '" fill="#0a1712" stroke="' + rc + '" stroke-width="' + rw + '"/><text x="22" y="26.5" font-family="sans-serif" font-size="13" font-weight="800" fill="' + rc + '" text-anchor="middle">' + n + "</text></svg>"),
      scaledSize: new g.maps.Size(44, 44), anchor: new g.maps.Point(22, 22),
    };
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
        position: pos, map, title: s.name, icon: pinIcon(g, i + 1, false),
      }));
    });
    // Trip origin (Home) — its own marker; it anchors the first drive leg.
    if (origin && origin.lat != null) {
      bounds.extend({ lat: origin.lat, lng: origin.lng });
      routeMarkersRef.current.push(new g.maps.Marker({ position: { lat: origin.lat, lng: origin.lng }, map, title: "Start · " + origin.name, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#8fd6a6", fillOpacity: 1, strokeColor: "#0a1712", strokeWeight: 2.5 } }));
    }
    map.fitBounds(bounds, 52);

    // Route legs: Home → first base (if origin set), then base → base. Real driving
    // distance from Directions; the first leg's miles feed the Home→base display.
    const reqStops = (origin && origin.lat != null) ? [{ lat: origin.lat, lng: origin.lng, name: origin.name }, ...stops] : stops.slice();
    if (reqStops.length < 2) { setRoadInfo(null); setOriginRoadMi(null); return; }
    if (!dirServiceRef.current) dirServiceRef.current = new g.maps.DirectionsService();
    const mapObj = mapObjRef.current;
    // Route each consecutive LEG on its own. A single multi-waypoint request fails
    // entirely if any one park's centroid isn't reachable by road (e.g. Zion's
    // canyon interior), so per-leg we draw the real road where it routes and a
    // dashed straight line only for the leg that can't.
    const routeLeg = (a, b, attempt) => new Promise((resolve) => {
      dirServiceRef.current.route({ origin: { lat: a.lat, lng: a.lng }, destination: { lat: b.lat, lng: b.lng }, travelMode: g.maps.TravelMode.DRIVING }, (res, status) => {
        if (status === "OK" && res && res.routes && res.routes[0]) {
          const lg = res.routes[0];
          resolve({ ok: true, path: detailedPath(lg), meters: lg.legs.reduce((s, l) => s + (l.distance ? l.distance.value : 0), 0), secs: lg.legs.reduce((s, l) => s + (l.duration ? l.duration.value : 0), 0) });
        } else if (attempt < 2 && status !== "ZERO_RESULTS" && status !== "NOT_FOUND" && status !== "REQUEST_DENIED") {
          setTimeout(() => routeLeg(a, b, attempt + 1).then(resolve), 500 * (attempt + 1));
        } else resolve({ ok: false });
      });
    });
    const hasOrigin = !!(origin && origin.lat != null);
    (async () => {
      let meters = 0, secs = 0, originMi = null; const perStopMi = []; // perStopMi[k] = real miles into stops[k]
      for (let t = 0; t < reqStops.length - 1; t++) {
        const a = reqStops[t], b = reqStops[t + 1];
        const r = await routeLeg(a, b, 0);
        if (gen !== routeGenRef.current || !mapReadyRef.current) return; // stale — a newer draw superseded us
        const destStopIdx = hasOrigin ? t : t + 1; // which stops[] index this leg arrives at
        if (r.ok) {
          // glow: a wide, soft gold casing under a bright thin line (Trip-Studio look)
          routeLinesRef.current.push(new g.maps.Polyline({ path: r.path, map: mapObj, strokeColor: "#e8cf9a", strokeOpacity: 0.22, strokeWeight: 13, zIndex: 1 }));
          routeLinesRef.current.push(new g.maps.Polyline({ path: r.path, map: mapObj, strokeColor: "#f0dca8", strokeOpacity: 1, strokeWeight: 3.5, zIndex: 3 }));
          const mi = Math.round(r.meters / 1609.34);
          meters += r.meters; secs += r.secs;
          if (hasOrigin && t === 0) originMi = mi; else perStopMi[destStopIdx] = mi;
        } else {
          // Can't be routed (e.g. a park centroid off-road) — draw a dashed connector,
          // but leave the distance blank rather than inventing one.
          routeLinesRef.current.push(new g.maps.Polyline({ path: [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }], map: mapObj, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: "#e4be78", scale: 3 }, offset: "0", repeat: "12px" }] }));
          if (hasOrigin && t === 0) originMi = null; else perStopMi[destStopIdx] = null;
        }
      }
      if (gen === routeGenRef.current) {
        setRoadInfo(meters > 0 ? { miles: Math.round(meters / 1609.34), mins: Math.round(secs / 60) } : null);
        setOriginRoadMi(hasOrigin ? originMi : null);
        setInterLegMi(perStopMi);
      }
    })();
  }
  useEffect(() => { drawRoute(); }, [stops, showOnMap, mapReady, origin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explore mode: hide the itinerary route + its numbered pins so discoverable place
  // pins stand out; ensure at least one destination layer is on so there ARE pins.
  useEffect(() => {
    const explore = mapView === "explore";
    routeLinesRef.current.forEach((l) => { try { l.setOptions({ visible: !explore }); } catch {} });
    routeMarkersRef.current.forEach((m) => { try { m.setVisible(!explore); } catch {} });
    if (explore) setLayers((l) => (l.np || l.statePark || l.forest || l.byway ? l : { ...l, np: true }));
  }, [mapView, mapReady, stops]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- browse markers (Explore-style filters) ---------------- */

  // National forests dataset (for the "Forests" layer).
  useEffect(() => {
    fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).then((d) => setForestsDb((d && d.forests) || [])).catch(() => {});
  }, []);

  // Scenic drives (America's Byways) — for the "Scenic routes" layer + the add dropdown.
  // Same self-fetch pattern as trip-data.js: byways-data.js sets window.BYWAYS_DATA.
  useEffect(() => {
    loadScript("/byways-data.js").then(() => setBywaysDb(window.BYWAYS_DATA || [])).catch(() => {});
  }, []);

  function browseMarkerSvg(type, color) {
    let shape;
    if (type === "forest") shape = '<polygon points="11,3 19,18 3,18" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/>';
    else if (type === "statePark") shape = '<g transform="rotate(45 11 11)"><rect x="4.5" y="4.5" width="13" height="13" rx="2" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/></g>';
    else if (type === "byway") shape = '<g transform="rotate(-38 11 11)"><rect x="7.5" y="2.5" width="7" height="17" rx="3.5" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/><line x1="11" y1="6" x2="11" y2="9" stroke="#0a1710" stroke-width="1.4" stroke-linecap="round"/><line x1="11" y1="13" x2="11" y2="16" stroke="#0a1710" stroke-width="1.4" stroke-linecap="round"/></g>';
    else shape = '<circle cx="11" cy="11" r="8" fill="' + color + '" stroke="#0a1710" stroke-width="1.5"/>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' + shape + "</svg>");
  }

  function addDestination(d) {
    if (!d || d.lat == null || stops.some((s) => s.name === d.name)) return;
    const stop = { name: d.name, state: d.state || "", lat: d.lat, lng: d.lng, nights: 1, legMi: null };
    if (d.kind) stop.kind = d.kind;   // "byway" scenic-drive stops link back to their page
    if (d.slug) stop.slug = d.slug;
    insertStop(stop);
  }
  // Add a stop at raw coordinates ("lat, lng").
  function addCoords() {
    const nums = (coordInput || "").split(/[,\s]+/).map(Number).filter((n) => !isNaN(n));
    if (nums.length < 2) { setAddrMsg("Enter as: latitude, longitude"); return; }
    const [lat, lng] = nums;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { setAddrMsg("Those don't look like valid coordinates."); return; }
    addDestination({ name: "Pin " + lat.toFixed(3) + ", " + lng.toFixed(3), lat, lng, custom: true });
    setCoordInput(""); setAddrMsg("");
  }
  // Add a whole scenic drive to the trip (anchored at the drive's own coordinate).
  const addByway = () => {
    if (!addBywaySel) return;
    const b = bywaysDb.find((x) => x.id === addBywaySel);
    if (b && b.lat != null) addDestination({ name: b.name, state: b.states || b.state || "", lat: b.lat, lng: b.lng, kind: "byway", slug: b.id });
    setAddBywaySel("");
  };

  function drawBrowse() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map || !mapReadyRef.current) return;
    browseMarkersRef.current.forEach((m) => m.setMap(null));
    browseMarkersRef.current = [];
    const inTrip = new Set(stops.map((s) => s.name));
    const st = browseState;
    const q = browseQuery.trim().toLowerCase();
    const paint = (list, type, color, extra) => {
      list.forEach((d) => {
        if (!d || d.lat == null || inTrip.has(d.name)) return;
        if (q && !d.name.toLowerCase().includes(q)) return;
        // byways carry a multi-state `states` string ("Arizona · Utah"); match by
        // inclusion so a filtered state still surfaces its multi-state drives.
        const dstate = d.state || d.states || "";
        if (st && (d.state ? d.state !== st : !dstate.includes(st))) return;
        const mk = new g.maps.Marker({
          position: { lat: d.lat, lng: d.lng }, map, title: d.name + (dstate ? " · " + dstate : "") + " — tap to add",
          icon: { url: browseMarkerSvg(type, color), scaledSize: new g.maps.Size(22, 22), anchor: new g.maps.Point(11, 11) },
          zIndex: type === "byway" ? 2 : 1,
        });
        mk.addListener("click", () => addDestination({ name: d.name, state: dstate, lat: d.lat, lng: d.lng, ...(extra ? extra(d) : {}) }));
        browseMarkersRef.current.push(mk);
      });
    };
    if (layers.np) paint(parksDb, "np", "#5fbf86");
    if (layers.forest) paint(forestsDb, "forest", "#6f9e5a");
    if (layers.statePark) paint(stateParksDb, "statePark", "#d9a441");
    if (layers.byway) paint(bywaysDb, "byway", "#e4be78", (d) => ({ kind: "byway", slug: d.id }));
  }
  useEffect(() => { drawBrowse(); }, [layers, browseState, browseQuery, parksDb, forestsDb, stateParksDb, bywaysDb, stops, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ready-made route PREVIEW: draw the route's stops (gold pins + a connecting line)
  // on the map without touching the active trip. Hides the live route/pins while open.
  function drawPreview() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map || !mapReadyRef.current) return;
    previewReqRef.current++; // invalidate any in-flight byway route callback
    previewMarkersRef.current.forEach((m) => m.setMap(null)); previewMarkersRef.current = [];
    if (previewLineRef.current) { previewLineRef.current.setMap(null); previewLineRef.current = null; }
    if (previewCasingRef.current) { previewCasingRef.current.setMap(null); previewCasingRef.current = null; }
    const previewing = !!previewRoute;
    routeMarkersRef.current.forEach((m) => { try { m.setVisible(!previewing); } catch {} });
    routeLinesRef.current.forEach((l) => { try { l.setOptions({ visible: !previewing }); } catch {} });
    browseMarkersRef.current.forEach((m) => { try { m.setVisible(!previewing); } catch {} });
    if (!previewing) return;
    // Scenic byway preview: trace the actual drive on the map. Best case is the
    // enriched record's real OSM road geometry + full named itinerary (every stop
    // gets a numbered pin, same as the /scenic-drives page). Otherwise route the
    // curated from → via → to through Directions, then fall back to a single pin.
    if (previewRoute.__byway) {
      const ep = previewRoute.endpoints;
      const fallbackPin = () => {
        if (previewRoute.lat == null) return;
        previewMarkersRef.current.push(new g.maps.Marker({ position: { lat: previewRoute.lat, lng: previewRoute.lng }, map, title: previewRoute.name, icon: pinIcon(g, 1, false) }));
        map.setCenter({ lat: previewRoute.lat, lng: previewRoute.lng });
        map.setZoom(7);
      };
      const detail = bywayDetail && bywayDetail.id === previewRoute.id ? bywayDetail : null;
      const osm = detail && Array.isArray(detail.routeLine) ? detail.routeLine : null;
      const itin = detail ? (detail.itinerary || []).filter((s) => s.lat != null && s.place) : [];
      if (osm && osm.length >= 2) {
        const path = osm.map(([lat, lng]) => ({ lat, lng }));
        previewCasingRef.current = new g.maps.Polyline({ path, map, strokeColor: "#0a1712", strokeOpacity: 0.75, strokeWeight: 5, zIndex: 2 });
        previewLineRef.current = new g.maps.Polyline({ path, map, strokeColor: "#ffcf2e", strokeOpacity: 1, strokeWeight: 2.6, zIndex: 3 });
        itin.forEach((s) => previewMarkersRef.current.push(new g.maps.Marker({
          position: { lat: s.lat, lng: s.lng }, map, zIndex: 20, title: s.place + (s.mileFromStart != null ? " · mi " + s.mileFromStart.toFixed(1) : ""),
          label: { text: String(s.seq), color: "#0a1712", fontSize: "11px", fontWeight: "800" },
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 11, fillColor: "#e8cf9a", fillOpacity: 1, strokeColor: "#0a1712", strokeWeight: 2 },
        })));
        const b = new g.maps.LatLngBounds(); path.forEach((c) => b.extend(c)); map.fitBounds(b, 60);
        return;
      }
      if (ep && ep.from && ep.to) {
        if (!dirServiceRef.current) dirServiceRef.current = new g.maps.DirectionsService();
        const reqId = ++previewReqRef.current;
        dirServiceRef.current.route({
          origin: ep.from,
          destination: ep.to,
          waypoints: (ep.via || []).map((v) => ({ location: v, stopover: false })),
          travelMode: g.maps.TravelMode.DRIVING,
        }, (res, status) => {
          if (reqId !== previewReqRef.current) return; // a newer preview replaced this one
          if (status !== "OK" || !res || !res.routes || !res.routes[0]) { fallbackPin(); return; }
          const opath = detailedPath(res.routes[0]).map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
          previewCasingRef.current = new g.maps.Polyline({ path: opath, map, strokeColor: "#0a1712", strokeOpacity: 0.7, strokeWeight: 6, zIndex: 2 });
          previewLineRef.current = new g.maps.Polyline({ path: opath, map, strokeColor: "#e8cf9a", strokeOpacity: 1, strokeWeight: 3, zIndex: 3 });
          const legs = res.routes[0].legs || [];
          const pins = legs.length ? [legs[0].start_location, ...legs.map((lg) => lg.end_location)] : [];
          pins.forEach((loc, i) => previewMarkersRef.current.push(new g.maps.Marker({ position: loc, map, icon: pinIcon(g, i + 1, false) })));
          const b = new g.maps.LatLngBounds(); opath.forEach((c) => b.extend(c)); if (!opath.length) return; map.fitBounds(b, 60);
        });
      } else {
        fallbackPin();
      }
      return;
    }
    const pts = (previewRoute.stops || []).map((name) => parksDb.find((p) => p.name === name)).filter(Boolean);
    if (!pts.length) return;
    const path = [], bounds = new g.maps.LatLngBounds();
    pts.forEach((p, i) => {
      const pos = { lat: p.lat, lng: p.lng }; path.push(pos); bounds.extend(pos);
      previewMarkersRef.current.push(new g.maps.Marker({ position: pos, map, title: p.name, icon: pinIcon(g, i + 1, false) }));
    });
    previewLineRef.current = new g.maps.Polyline({ path, map, strokeColor: "#e8cf9a", strokeOpacity: 0.85, strokeWeight: 3, zIndex: 2, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }] });
    map.fitBounds(bounds, 60);
  }
  useEffect(() => { drawPreview(); }, [previewRoute, parksDb, mapReady, bywayDetail]); // eslint-disable-line react-hooks/exhaustive-deps
  // Enrich a scenic-drive preview with its full itinerary + real OSM route geometry
  // (the same per-byway record the /scenic-drives page uses). Best-effort: the base
  // curated endpoints still draw a route while this loads or if it's missing.
  useEffect(() => {
    if (!previewRoute || !previewRoute.__byway || !previewRoute.id) { setBywayDetail(null); return; }
    let on = true; const id = previewRoute.id;
    setBywayDetail(null);
    fetch("/byways/detail/" + id + ".json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (on && d && d.id === id) setBywayDetail(d); })
      .catch(() => {});
    return () => { on = false; };
  }, [previewRoute]);

  // Hover a stop card → halo its map pin (design's card↔pin link).
  useEffect(() => {
    const g = window.google; if (!g) return;
    routeMarkersRef.current.forEach((m, i) => {
      const hov = i === hoverIdx;
      try { m.setIcon(pinIcon(g, i + 1, hov)); m.setZIndex(hov ? 999 : 1); } catch {}
    });
  }, [hoverIdx]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const sans = "var(--pb-sans), 'Hanken Grotesk', system-ui, sans-serif";
  const serif = "var(--pb-serif), 'Spectral', Georgia, serif";
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

        {/* Hero — the intro banner kept from the classic Build My Trip */}
        <section style={{ maxWidth: 1360, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "clamp(30px,5vw,66px) clamp(16px,2.4vw,40px) clamp(8px,1.6vw,22px)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(217,183,121,0.28)", background: "rgba(143,214,166,0.06)", fontFamily: "var(--pb-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#cdd6cf" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8fd6a6", boxShadow: "0 0 10px #8fd6a6" }} />Trip builder · live conditions baked in
          </div>
          <h1 style={{ fontFamily: "var(--pb-serif)", fontWeight: 500, fontSize: "clamp(40px,6.6vw,76px)", lineHeight: 1.0, letterSpacing: "-.015em", color: "#f7f4ec", margin: "20px 0 0", maxWidth: 940 }}>
            Build your <em style={{ fontStyle: "italic", background: "linear-gradient(120deg,#f0dca8,#c9a35f)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>national-parks</em> road trip
          </h1>
          <p style={{ fontFamily: "var(--pb-sans)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#aab0ba", margin: "18px 0 0", maxWidth: 640 }}>
            Load a ready-made route or build your own. Add parks, set your dates and rental car, and get a day-by-day plan that follows real roads — each stop carrying today&apos;s live go / no-go call.
          </p>
        </section>

        {/* Trip Studio — reskinned planner (design ported from Claude Design) */}
        <TripStudio
          mode={railTab} setMode={setRailTab} onNewTrip={onNewTrip} editing={!!activeTripId}
          stat={{ stops: String(stops.length), days: String(totalNights), miles: String(totalMiles), cost: fmtUsd(totalCost) }}
          statNum={{ stops: stops.length, days: totalNights, miles: totalMiles, cost: totalCost }}
          tripName={tripName} setTripName={(v) => { userEditedRef.current = true; setTripName(v); }}
          stops={stops} dayRanges={dayRanges} verdicts={verdicts} STOP_STATUS={STOP_STATUS}
          onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} removeStop={removeStop} setStopNights={setStopNights} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx}
          expandedStop={expandedStop} toggleDayPlan={toggleDayPlan} dayPlans={dayPlans} addActivity={addActivity} removeActivity={removeActivity} updateActivity={updateActivity}
          origin={origin} setOrigin={setOrigin} originLegMi={originRoadMi} interLegMi={interLegMi}
          setExpandedStop={setExpandedStop} lodging={lodging} setStopLodging={setStopLodging}
          setAddAt={(i) => { addAtRef.current = i; }}
          mapPrefs={mapPrefs} setMapPref={setMapPref}
          addSource={addSource} setAddSource={setAddSource} addMenuOpen={addMenuOpen} setAddMenuOpen={setAddMenuOpen}
          parksDb={parksDb} addSel={addSel} setAddSel={setAddSel} addPark={addPark}
          bywaysDb={bywaysDb} addBywaySel={addBywaySel} setAddBywaySel={setAddBywaySel} addByway={addByway} forestsDb={forestsDb}
          addrInput={addrInput} setAddrInput={setAddrInput} addAddress={addAddress} addrMsg={addrMsg} addDestination={addDestination}
          coordInput={coordInput} setCoordInput={setCoordInput} addCoords={addCoords}
          addMyTrip={addMyTrip}
          setupCollapsed={setupCollapsed} setSetupCollapsed={setSetupCollapsed}
          setupRows={[["Dates", startDate ? fmtShort(startDate) + " – " + fmtShort(endDate) : "—"], ["Length", (tripDays ? tripDays + " days" : "—") + (totalNights ? " · " + totalNights + " nights" : "")], ["Travelers", adults + " adult" + (adults === 1 ? "" : "s") + (infants ? " · " + infants + " kid" + (infants === 1 ? "" : "s") : "")], ["Getting there", ({ own: "Own car", rental: "Rental car", fly: "Fly + rent", rv: "RV / Camper" }[transport.type] || "Own car")], ["Vehicle", transport.type === "rv" ? "RV / Camper" : car], ["Fuel est.", fmtUsd(budget.fuel) + (transport.fuelState ? " · " + transport.fuelState : "")], ["Trip scope", tripScope === "crosscountry" ? "Cross-country" : "Regional loop"]]}
          onEditSetup={() => setSetupOpen(true)} onSaveTrip={saveCurrentTrip} saveMsg={saveMsg}
          showOnMap={showOnMap} setShowOnMap={setShowOnMap}
          budgetOpen={budgetOpen} setBudgetOpen={setBudgetOpen}
          budgetLines={[
            { label: "Flights", icon: "plane", tint: "#6fb4d6", k: "flights", sub: adults + " adult" + (adults === 1 ? "" : "s") + (arrivalMode === "fly" ? "" : " · not flying"), show: budget.flights > 0 || budgetOverride.flights != null },
            { label: transport.type === "rv" ? "RV rental" : "Rental car", icon: transport.type === "rv" ? "caravan" : "car", tint: "#7fb0d0", k: "rental", sub: transport.rentalDaily ? fmtUsd(transport.rentalDaily) + "/day × " + tripDays + " day" + (tripDays === 1 ? "" : "s") : "tap to enter real price", show: budget.rental > 0 || budgetOverride.rental != null },
            { label: "Fuel", icon: "fuel", tint: "#d6795a", k: "fuel", sub: totalMiles + " mi" + (transport.fuelState ? " · " + transport.fuelState : "") },
            { label: "Lodging", icon: "bed", tint: "#d68fa0", k: "lodging", sub: totalNights + " night" + (totalNights === 1 ? "" : "s") },
            { label: "Food", icon: "utensils", tint: "#e0b46a", k: "food", sub: adults + " adult" + (adults === 1 ? "" : "s") },
            { label: "Park passes", icon: "ticket", tint: "#d68fbf", k: "passes", sub: "tap to enter real price" },
          ]}
          BudgetAmount={BudgetAmount} totalCost={totalCost} perPerson={totalCost / Math.max(1, travelers)} fmtUsd={fmtUsd}
          routes={ROUTES} loadedRoute={loadedRoute} loadRoute={loadRoute} insertRouteAt={insertRouteAt} cloneRoute={cloneRoute} previewRoute={previewRoute} setPreviewRoute={setPreviewRoute} bywayDetail={bywayDetail} insertScenicDrive={insertScenicDrive}
          savedTrips={savedTrips} loadSavedTrip={loadSavedTrip} deleteSavedTrip={deleteSavedTrip}
          gmapsUrl={gmapsUrl} appleUrl={appleUrl} waUrl={waUrl} copyLink={copyLink}
          mapDivRef={mapDivRef} keyOverlay={keyOverlay} keyInputRef={keyInputRef} saveKey={saveKey} keyMsg={keyMsg} roadInfo={roadInfo} driveHrs={driveHrs} totalMiles={totalMiles}
          layers={layers} setLayers={setLayers} layersOpen={layersOpen} setLayersOpen={setLayersOpen}
          mapView={mapView} setMapView={setMapView} browseState={browseState} setBrowseState={setBrowseState} browseQuery={browseQuery} setBrowseQuery={setBrowseQuery} radius={radius} setRadius={setRadius}
          fieldBox={fieldBox}
        />
      </div>

      <TripSetupWizard
        open={setupOpen}
        onClose={() => { setSetupOpen(false); try { localStorage.setItem("pb_trip_setup_seen", "1"); } catch {} }}
        initial={{ tripName, startDate, endDate, transportType: transport.type, carType: car === "RV / Camper" ? "Midsize SUV" : car, flightNo: transport.flightNo, rentalDaily: transport.rentalDaily, rentalWhere: transport.rentalWhere, fuelState: transport.fuelState }}
        miles={totalMiles}
        mainState=""
        onSave={applySetup}
      />
    </div>
  );
}
