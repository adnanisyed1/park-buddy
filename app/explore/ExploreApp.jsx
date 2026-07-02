"use client";

// /explore — native React port of Explore.dc.html (design fidelity required).
// Layout, colors, spacing and copy reproduce the design file 1:1. Data is REAL:
//  • Parks: the 63 national parks from /trip-data.js (window.TRIP_PARKS)
//  • Verdicts: live, via /pb-verdict.js (weather.gov) — bucketed to the design's
//    Go / Prepare / Hold off legend (loading grey until each verdict lands)
//  • Gateway towns: /gateway-towns.js (window.PB_GATEWAY)
//  • Maps key: NEXT_PUBLIC_GMAPS_KEY (Netlify env) → else the design's
//    paste-a-key overlay (kept as designed, stored in localStorage)
// The design's sample cross-type destinations (state parks / forests / lakes /
// campgrounds) and the NPS-photo-key panel are kept verbatim per the spec.

import { useEffect, useRef, useState } from "react";
import loadScript from "../components/load-script";

/* ---------------- design constants (verbatim from Explore.dc.html) ---------------- */

const V = {
  go:      { dot: "#2f7d4f", label: "Go",       note: "Conditions look good — clear access and comfortable weather today.", bg: "rgba(47,125,79,.1)" },
  prepare: { dot: "#b9802a", label: "Prepare",  note: "Manageable, but check conditions and pack accordingly before you head out.", bg: "rgba(185,128,42,.12)" },
  hold:    { dot: "#bf463a", label: "Hold off", note: "An advisory is in effect — consider rescheduling or picking another spot nearby.", bg: "rgba(191,70,58,.12)" },
  loading: { dot: "#b3ab97", label: "Loading",  note: "We don't have a live read yet — check back shortly.", bg: "rgba(179,171,151,.14)" },
};

const TYPE_META = {
  national_park:   { label: "National Park",  icon: "🏔️", color: null }, // null => verdict color
  state_park:      { label: "State Park",     icon: "🌳", color: "#c79a4b" },
  national_forest: { label: "National Forest", icon: "🌲", color: "#3f5d2f" },
  lake:            { label: "Lake",           icon: "💧", color: "#2c6b8f" },
  campground:      { label: "Campground",     icon: "🏕️", color: "#b9823f" },
};

// State parks, national forests and lakes are NOT hardcoded — they load live from
// the real APIs as you pan the map (/api/destinations by bbox, /api/water by area),
// exactly like the pre-migration /explore. See loadViewportDestinations() below.

const CAMPGROUNDS = [
  { name: "Watchman Campground", lat: 37.193, lng: -112.988 },
  { name: "Bridge Bay Campground", lat: 44.547, lng: -110.437 },
  { name: "Elkmont Campground", lat: 35.652, lng: -83.587 },
  { name: "Blackwoods Campground", lat: 44.301, lng: -68.211 },
];

const USER_LOC = { lat: 39.8283, lng: -98.5795 };
const AVG_MPH = 45;

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ saturation: -55 }, { lightness: 8 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a6b4c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f3ede0" }, { weight: 3 }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#c79a4b" }, { weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#d9cba0" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#8c8473" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd3d6" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// TRIP_PARKS carries full state names; the design displays postal codes.
const STATE_ABBR = {
  Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Florida: "FL", Hawaii: "HI", Indiana: "IN", Kentucky: "KY", Maine: "ME",
  Michigan: "MI", Minnesota: "MN", Missouri: "MO", Montana: "MT", Nevada: "NV",
  "New Mexico": "NM", "NC / Tennessee": "NC/TN", "North Dakota": "ND", Ohio: "OH",
  Oregon: "OR", "South Carolina": "SC", "South Dakota": "SD", Texas: "TX",
  Utah: "UT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wyoming: "WY", "U.S. Virgin Islands": "USVI", "American Samoa": "AS",
};

/* ---------------- helpers (verbatim logic from the design) ---------------- */

function milesBetween(a, b) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function driveTimeLabel(miles) {
  const hrs = miles / AVG_MPH;
  if (hrs < 1) return Math.round(hrs * 60) + " min";
  return Math.round(hrs * 10) / 10 + " hr";
}

// Distinct SHAPE per type (not just color) so they read apart at a glance.
function markerIconUrl(type, color) {
  const shapes = {
    national_park: '<circle cx="9" cy="9" r="6" fill="' + color + '" stroke="#fffdf7" stroke-width="2"/>',
    state_park: '<polygon points="9,2 16,9 9,16 2,9" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
    national_forest: '<polygon points="9,2 16,16 2,16" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
    lake: '<path d="M9,2 C5,8 3,11 3,13.2 A6,5.6 0 0,0 15,13.2 C15,11 13,8 9,2 Z" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
  };
  const svg = shapes[type] || shapes.national_park;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">' + svg + "</svg>");
}

function photoTitleFor(p) {
  const suffix = { national_park: " National Park", state_park: " State Park", national_forest: " National Forest", lake: "" }[p.type] || "";
  return p.name + suffix;
}

/* ---------------- photo pipeline (server-side; no browser-stored key) ---------------- */

let photoCache = null;
function getPhotoCache() {
  if (photoCache) return photoCache;
  try { photoCache = JSON.parse(localStorage.getItem("pb_photo_cache") || "{}"); } catch { photoCache = {}; }
  return photoCache;
}
function savePhotoCache() {
  try { localStorage.setItem("pb_photo_cache", JSON.stringify(photoCache)); } catch {}
}

// Photos resolve SERVER-SIDE via /api/photo (Wikipedia/Wikimedia + the NPS lookup
// handled on the server with NPS_API_KEY). No key is ever asked of the user or
// stored in the browser. Resolved URLs are cached to localStorage.
function fetchPhoto(p) {
  const cache = getPhotoCache();
  const cached = cache[p.name];
  if (cached) return Promise.resolve(cached);
  if (cached === false) return Promise.resolve(null);
  const apply = (url) => { cache[p.name] = url || false; savePhotoCache(); return url || null; };
  return fetch("/api/photo?name=" + encodeURIComponent(photoTitleFor(p)) + "&state=" + encodeURIComponent(p.state || ""))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => apply(d && d.found ? (d.thumb || d.image) : null))
    .catch(() => apply(null));
}

function CoverPhoto({ park }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    fetchPhoto(park).then((u) => { if (on && u) setUrl(u); });
    return () => { on = false; };
  }, [park.name]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!url) return null;
  return <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1, transition: "opacity .35s" }} />;
}

/* ================================ component ================================ */

export default function ExploreApp() {
  const [parks, setParks] = useState([]); // real 63 parks + design sample extras
  const [verdicts, setVerdicts] = useState({}); // name -> 'go'|'prepare'|'hold' (absent = loading)
  const [ui, setUi] = useState({
    panelOpen: false, filtersOpen: true, radius: 150,
    destNational: true, destState: true, destForest: true, destLake: true, campgrounds: true,
    anchor: null, // { lat, lng, label, isUser }
    view: "browse", // browse | detail | trip
    listMode: false, selectedName: null, detailTab: "live",
    searchQuery: "", trip: [],
    keyOverlay: false, keyMsg: "Paste a Google Maps JavaScript API key to load the live park map. Stored only in your browser — never committed to code.",
  });
  const patch = (p) => setUi((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));

  // Refs for map plumbing + latest-state access inside Maps event callbacks.
  const mapDivRef = useRef(null);
  const keyInputRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef(new Map()); // name -> Marker
  const campMarkersRef = useRef([]);
  const nearCircleRef = useRef(null);
  const nearMarkerRef = useRef(null);
  const gatewayMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const seenDestRef = useRef(new Set()); // dedupe live destinations across pans
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const parksRef = useRef(parks);
  parksRef.current = parks;

  const vOf = (p) => V[verdicts[p.name] || (p.type === "national_park" ? "loading" : "go")];
  const bucketOf = (name, type) => verdicts[name] || (type === "national_park" ? "loading" : "go");

  const typeOn = (type, s = ui) => {
    if (type === "national_park") return s.destNational;
    if (type === "state_park") return s.destState;
    if (type === "national_forest") return s.destForest;
    if (type === "lake") return s.destLake;
    return true;
  };

  const visibleParks = (s = ui, list = parks) => {
    let out = list.filter((p) => typeOn(p.type, s));
    if (s.anchor) out = out.filter((p) => milesBetween(s.anchor, p) <= s.radius);
    return out;
  };

  const getSelected = () => parks.find((p) => p.name === ui.selectedName) || null;
  const getGateway = (park) => {
    if (!park || typeof window === "undefined" || !window.PB_GATEWAY) return null;
    const g = window.PB_GATEWAY(park.name);
    if (!g) return null;
    if (g.towns && g.towns.length) return { town: g.towns[0].name, blurb: g.blurb, lat: g.towns[0].lat, lng: g.towns[0].lng };
    return g.lat != null ? g : null;
  };

  /* ---------------- boot: data + shared globals + map ---------------- */

  useEffect(() => {
    let disposed = false;
    (async () => {
      // Real data + verdict engine + gateway towns (shared legacy globals).
      await loadScript("/trip-data.js");
      await Promise.all([loadScript("/pb-verdict.js"), loadScript("/gateway-towns.js")]);
      if (disposed) return;

      const all = (window.TRIP_PARKS || []).map((p) => ({
        name: p.name,
        state: STATE_ABBR[p.state] || p.state,
        lat: p.lat, lng: p.lng, type: "national_park",
      }));
      setParks(all);
      parksRef.current = all;

      // Maps key: env-injected (Netlify) → localStorage (design's paste flow) → legacy global.
      let key = "";
      try { key = localStorage.getItem("pb_gmaps_key") || ""; } catch {}
      if (!key) key = process.env.NEXT_PUBLIC_GMAPS_KEY || "";
      if (!key && window.GMAPS_KEY) key = window.GMAPS_KEY;
      if (!key) { patch({ keyOverlay: true }); }
      else loadGoogle(key, all);

      // Account UI + Ask Park Buddy (self-mounting shared globals; fab hidden via CSS,
      // the design's own button triggers the panel).
      loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2")
        .then(() => loadScript("/supabase-config.js"))
        .then(() => loadScript("/auth.js"));
      loadScript("/ask-parkbuddy.js");
    })();
    return () => { disposed = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadGoogle(key, all) {
    window.gm_authFailure = () => {
      patch({ keyOverlay: true, keyMsg: "That key was rejected for this site. Use an unrestricted dev key, or add this URL to the key's allowed referrers in Google Cloud." });
    };
    if (window.google && window.google.maps) { draw(all); return; }
    window.__pbExInit = () => draw(all);
    if (document.getElementById("pb-ex-gm-js")) return;
    const s = document.createElement("script");
    s.id = "pb-ex-gm-js";
    s.async = true;
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&callback=__pbExInit";
    s.onerror = () => patch({ keyOverlay: true, keyMsg: "Could not load Google Maps. Check your connection or the key." });
    document.head.appendChild(s);
  }

  // Create a marker for any destination in state that doesn't have one yet
  // (national parks at boot + state parks / forests / lakes as they stream in).
  function ensureMarkers() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    parksRef.current.forEach((p) => {
      if (markersRef.current.has(p.name)) return;
      const meta = TYPE_META[p.type] || TYPE_META.national_park;
      const color = meta.color || V[p.type === "national_park" ? "loading" : "go"].dot;
      const marker = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map: null, title: p.name + " — " + meta.label,
        icon: { url: markerIconUrl(p.type, color), scaledSize: new g.maps.Size(18, 18), anchor: new g.maps.Point(9, 9) },
      });
      marker.addListener("click", () => showPinPreview(p, marker));
      markersRef.current.set(p.name, marker);
    });
  }

  // Show/hide markers per the type toggles + anchor radius. Uses refs so it can
  // be called from map callbacks as well as the render effect.
  function applyVisibility() {
    const map = mapObjRef.current;
    if (!map) return;
    const visibleSet = new Set(visibleParks(uiRef.current, parksRef.current).map((p) => p.name));
    markersRef.current.forEach((m, name) => m.setMap(visibleSet.has(name) ? map : null));
    campMarkersRef.current.forEach((m) => m.setMap(uiRef.current.campgrounds ? map : null));
  }

  function draw(all) {
    const el = mapDivRef.current;
    if (!el || !window.google) return;
    const g = window.google;
    const map = new g.maps.Map(el, {
      center: { lat: 39.5, lng: -98.5 }, zoom: 4, minZoom: 3, maxZoom: 14,
      mapTypeId: "terrain", disableDefaultUI: true, gestureHandling: "cooperative",
      backgroundColor: "#dbe6ea", styles: MAP_STYLE,
    });
    mapObjRef.current = map;
    markersRef.current = new Map();

    const bounds = new g.maps.LatLngBounds();
    all.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    ensureMarkers();

    campMarkersRef.current = [];
    CAMPGROUNDS.forEach((c) => {
      campMarkersRef.current.push(new g.maps.Marker({
        position: { lat: c.lat, lng: c.lng }, map: null, title: c.name + " — Campground",
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><rect x="2" y="2" width="10" height="10" fill="#b9823f" stroke="#fffdf7" stroke-width="1.5"/></svg>'),
          scaledSize: new g.maps.Size(14, 14), anchor: new g.maps.Point(7, 7),
        },
      }));
    });

    map.fitBounds(bounds, 40);
    g.maps.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > 5) map.setZoom(5); });
    map.addListener("idle", () => loadViewportDestinations());
    applyVisibility();
    patch({ keyOverlay: false });
    startVerdictSweep(all);
    loadViewportDestinations();
  }

  // Live state parks + national forests (/api/destinations by bbox) and lakes
  // (/api/water by area) for the current viewport, deduped across pans and merged
  // into the unified destination model. Restores the pre-migration behavior where
  // these types populated the map and list as you moved around.
  async function loadViewportDestinations() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    const b = map.getBounds();
    if (!b) return;
    const sw = b.getSouthWest(), ne = b.getNorthEast(), c = b.getCenter();
    const bbox = sw.lng().toFixed(3) + "," + sw.lat().toFixed(3) + "," + ne.lng().toFixed(3) + "," + ne.lat().toFixed(3);
    const seen = seenDestRef.current;
    const additions = [];

    try {
      const d = await fetch("/api/destinations?bbox=" + bbox + "&limit=400").then((r) => (r.ok ? r.json() : null));
      (d && d.destinations ? d.destinations : []).forEach((x) => {
        if (x.source === "nps" || typeof x.lat !== "number" || typeof x.lng !== "number") return;
        if (x.type !== "state_park" && x.type !== "national_forest") return;
        const key = "d:" + (x.id != null ? x.id : x.name + x.lat.toFixed(3));
        if (seen.has(key)) return;
        seen.add(key);
        if (parksRef.current.some((p) => p.name === x.name)) return;
        additions.push({ name: x.name, state: x.state || "", lat: x.lat, lng: x.lng, type: x.type });
      });
    } catch {}

    // Lakes come from Overpass (heavier) — only when zoomed in, radius capped.
    if (map.getZoom() >= 7) {
      const radiusKm = Math.min(70, Math.max(15, Math.round(milesBetween({ lat: c.lat(), lng: c.lng() }, { lat: ne.lat(), lng: ne.lng() }) * 1.609)));
      try {
        const w = await fetch("/api/water?lat=" + c.lat().toFixed(4) + "&lng=" + c.lng().toFixed(4) + "&radius=" + radiusKm).then((r) => (r.ok ? r.json() : null));
        (w && w.lakes ? w.lakes : []).forEach((x) => {
          if (typeof x.lat !== "number" || typeof x.lng !== "number" || !x.name) return;
          const key = "w:" + x.name + x.lat.toFixed(3);
          if (seen.has(key)) return;
          seen.add(key);
          if (parksRef.current.some((p) => p.name === x.name)) return;
          additions.push({ name: x.name, state: x.state || "", lat: x.lat, lng: x.lng, type: "lake" });
        });
      } catch {}
    }

    if (additions.length) {
      const merged = parksRef.current.concat(additions);
      parksRef.current = merged;
      setParks(merged);
    }
  }

  // Live verdict sweep — same pattern as the embed's s3.js: throttled queue,
  // max 4 concurrent weather.gov fetches, markers recolor as verdicts land.
  function startVerdictSweep(all) {
    const PB = window.PBVerdict;
    if (!PB || !PB.fetchVerdict) return; // graceful: everything stays "Loading"
    const queue = all.filter((p) => p.type === "national_park").slice();
    let active = 0;
    const next = () => {
      while (active < 4 && queue.length) {
        const p = queue.shift();
        active++;
        try {
          PB.fetchVerdict(p.lat, p.lng, (res) => {
            active--;
            const r = res && typeof res.score === "number" ? res : res && res.v && typeof res.v.score === "number" ? res.v : null;
            if (r) {
              const bucket = r.score >= 62 ? "go" : r.score >= 42 ? "prepare" : "hold";
              setVerdicts((v) => ({ ...v, [p.name]: bucket }));
              const m = markersRef.current.get(p.name);
              if (m && window.google) {
                m.setIcon({ url: markerIconUrl("national_park", V[bucket].dot), scaledSize: new window.google.maps.Size(18, 18), anchor: new window.google.maps.Point(9, 9) });
              }
            }
            next();
          });
        } catch { active--; }
      }
    };
    next();
  }

  /* ---------------- pin preview → detail (never jump straight to detail) ---------------- */

  function showPinPreview(p, marker) {
    const g = window.google;
    if (!infoWindowRef.current) infoWindowRef.current = new g.maps.InfoWindow();
    const v = V[bucketOfRef(p)];
    const meta = TYPE_META[p.type];
    window.__pbExPreview = () => { infoWindowRef.current.close(); selectPark(p.name); };
    // tapping a pin also anchors the list around it — Zillow-style map/list sync
    setAnchor({ lat: p.lat, lng: p.lng, label: p.name, isUser: false }, false);
    const html =
      '<div style="font-family:\'Hanken Grotesk\',sans-serif;padding:2px 2px 4px;min-width:190px">' +
      '<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">' +
      '<span style="font-size:1.1rem">' + meta.icon + "</span>" +
      '<b style="font-family:\'Spectral\',serif;font-size:.98rem;color:#163a2b">' + p.name + "</b></div>" +
      '<div style="font-size:.72rem;color:#8c8473;margin-bottom:8px">' + meta.label + " · " + p.state + "</div>" +
      '<div style="display:inline-flex;align-items:center;gap:5px;background:' + v.dot + "18;color:" + v.dot + ';font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;margin-bottom:10px">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:' + v.dot + '"></span>' + v.label + "</div>" +
      '<button onclick="window.__pbExPreview()" style="display:block;width:100%;box-sizing:border-box;border:none;border-radius:9px;padding:8px;background:#1d4a37;color:#fff;font-weight:700;font-size:.8rem;cursor:pointer;font-family:inherit">View details →</button>' +
      "</div>";
    infoWindowRef.current.setContent(html);
    infoWindowRef.current.open(mapObjRef.current, marker);
  }
  // verdict lookup that works inside map callbacks (uses live state via ref-free closure)
  function bucketOfRef(p) {
    // setVerdicts state isn't readable synchronously here; recompute from marker color is
    // overkill — the preview just re-reads on each click, so read from the latest render:
    return (window.__pbExVerdicts && window.__pbExVerdicts[p.name]) || (p.type === "national_park" ? "loading" : "go");
  }
  useEffect(() => { window.__pbExVerdicts = verdicts; }, [verdicts]);

  function selectPark(name) {
    patch({ view: "detail", selectedName: name, detailTab: "live", searchQuery: "", panelOpen: true });
    const p = parksRef.current.find((x) => x.name === name);
    const map = mapObjRef.current;
    if (p && map) { map.panTo({ lat: p.lat, lng: p.lng }); if (map.getZoom() < 7) map.setZoom(7); }
    if (infoWindowRef.current) infoWindowRef.current.close();
    showGatewayMarker(p);
  }

  function backToBrowse() { patch({ view: "browse", selectedName: null }); showGatewayMarker(null); }

  // gateway-town pin: a distinct gold square, only for the selected park
  function showGatewayMarker(park) {
    const g = window.google;
    if (!g || !mapObjRef.current) return;
    const gateway = getGateway(park);
    if (!gateway || gateway.lat == null) {
      if (gatewayMarkerRef.current) gatewayMarkerRef.current.setMap(null);
      return;
    }
    const pos = { lat: gateway.lat, lng: gateway.lng };
    const icon = {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect x="2" y="2" width="14" height="14" rx="4" fill="#c79a4b" stroke="#163a2b" stroke-width="2"/></svg>'),
      scaledSize: new g.maps.Size(18, 18), anchor: new g.maps.Point(9, 9),
    };
    if (!gatewayMarkerRef.current) {
      gatewayMarkerRef.current = new g.maps.Marker({ position: pos, map: mapObjRef.current, icon });
    } else {
      gatewayMarkerRef.current.setPosition(pos);
      gatewayMarkerRef.current.setIcon(icon);
      gatewayMarkerRef.current.setMap(mapObjRef.current);
    }
    gatewayMarkerRef.current.setTitle("🏘 Gateway town: " + gateway.town);
  }

  /* ---------------- anchor mechanism (map ↔ list sync) ---------------- */

  function setAnchor(anchor, fitMap) {
    const g = window.google;
    patch({ anchor, view: "browse", panelOpen: true });
    if (g && mapObjRef.current) {
      const pos = { lat: anchor.lat, lng: anchor.lng };
      if (anchor.isUser) {
        if (!nearMarkerRef.current) {
          nearMarkerRef.current = new g.maps.Marker({
            position: pos, map: mapObjRef.current,
            icon: {
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#c79a4b" stroke="#163a2b" stroke-width="2"/></svg>'),
              scaledSize: new g.maps.Size(16, 16), anchor: new g.maps.Point(8, 8),
            },
          });
        } else {
          nearMarkerRef.current.setPosition(pos);
          nearMarkerRef.current.setMap(mapObjRef.current);
        }
      }
      if (!nearCircleRef.current) {
        nearCircleRef.current = new g.maps.Circle({
          center: pos, radius: uiRef.current.radius * 1609.34, map: mapObjRef.current,
          strokeColor: "#c79a4b", strokeWeight: 2, fillColor: "#c79a4b", fillOpacity: 0.08,
        });
      } else {
        nearCircleRef.current.setCenter(pos);
        nearCircleRef.current.setMap(mapObjRef.current);
        nearCircleRef.current.setRadius(uiRef.current.radius * 1609.34);
      }
      if (fitMap) mapObjRef.current.fitBounds(nearCircleRef.current.getBounds(), 40);
    }
  }

  function clearAnchor() {
    patch({ anchor: null });
    if (nearCircleRef.current) nearCircleRef.current.setMap(null);
    if (nearMarkerRef.current) nearMarkerRef.current.setMap(null);
  }

  function setRadius(v) {
    v = Math.max(10, Math.min(300, v));
    patch({ radius: v });
    if (nearCircleRef.current) nearCircleRef.current.setRadius(v * 1609.34);
  }

  // marker visibility follows the type filters + anchor radius; also creates
  // markers for any destinations that streamed in since the last render
  useEffect(() => {
    if (!mapObjRef.current) return;
    ensureMarkers();
    applyVisibility();
  }, [ui.destNational, ui.destState, ui.destForest, ui.destLake, ui.campgrounds, ui.anchor, ui.radius, parks]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- misc actions ---------------- */

  function saveKey() {
    const v = keyInputRef.current && keyInputRef.current.value.trim();
    if (!v) return;
    try { localStorage.setItem("pb_gmaps_key", v); } catch {}
    window.location.reload();
  }

  function toggleTripFor(name) {
    if (!name) return;
    patch((s) => {
      const trip = s.trip.slice();
      const i = trip.indexOf(name);
      if (i === -1) trip.push(name); else trip.splice(i, 1);
      return { trip };
    });
  }

  const zoomIn = () => { const m = mapObjRef.current; if (m) m.setZoom(m.getZoom() + 1); };
  const zoomOut = () => { const m = mapObjRef.current; if (m) m.setZoom(m.getZoom() - 1); };
  const askParkBuddy = () => { const fab = document.querySelector(".pbask-fab"); if (fab) fab.click(); };

  /* ---------------- derived render values ---------------- */

  const onTrack = "#c79a4b", offTrack = "#d9d3c2";
  const activeFilterCount =
    [ui.destNational, ui.destState, ui.destForest, ui.destLake, ui.campgrounds].filter(Boolean).length + (ui.anchor ? 1 : 0);

  const q = ui.searchQuery.trim().toLowerCase();
  const searchResults = q
    ? parks.filter((p) => p.name.toLowerCase().indexOf(q) > -1).slice(0, 8)
    : [];

  const sel = getSelected();
  const selMeta = sel ? TYPE_META[sel.type] : null;
  const selV = sel ? V[bucketOf(sel.name, sel.type)] : null;
  const tripHas = sel ? ui.trip.indexOf(sel.name) > -1 : false;
  const gateway = getGateway(sel);

  const visible = visibleParks();
  const sortedVisible = ui.anchor
    ? visible.slice().sort((a, b) => milesBetween(ui.anchor, a) - milesBetween(ui.anchor, b))
    : visible;

  const nearbyItems = (() => {
    if (!sel) return [];
    const dest = parks
      .filter((p) => p.name !== sel.name && typeOn(p.type))
      .map((p) => ({ name: p.name, type: p.type, dist: milesBetween(sel, p), click: () => selectPark(p.name) }));
    const camps = ui.campgrounds
      ? CAMPGROUNDS.map((c) => ({ name: c.name, type: "campground", dist: milesBetween(sel, c), click: null }))
      : [];
    return dest.concat(camps).filter((o) => o.dist <= ui.radius).sort((a, b) => a.dist - b.dist).slice(0, 10);
  })();

  const tripItems = ui.trip.map((n) => parks.find((p) => p.name === n)).filter(Boolean);

  const toggle = (key) => () => patch((s) => ({ [key]: !s[key] }));
  const Switch = ({ on, onClick }) => (
    <button onClick={onClick} style={{ width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: on ? onTrack : offTrack, position: "relative", padding: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );

  const sans = "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif";
  const serif = "var(--font-spectral), 'Spectral', Georgia, serif";

  /* ================================ render ================================ */

  return (
    <div style={{ fontFamily: sans, color: "#2c281f", position: "fixed", inset: 0, background: "#dbe6ea", overflow: "hidden" }}>
      <style>{`
        .ex-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
        .ex-scroll::-webkit-scrollbar-thumb { background: #cdd3c0; border-radius: 9px; }
        @keyframes ex-sheen { 0% { transform: translateY(-30%) rotate(8deg); opacity: 0; } 18% { opacity: .5; } 45% { opacity: 0; } 100% { transform: translateY(120%) rotate(8deg); opacity: 0; } }
        @keyframes ex-loc { 0% { box-shadow: 0 0 0 0 rgba(228,190,120,.55); } 70% { box-shadow: 0 0 0 10px rgba(228,190,120,0); } 100% { box-shadow: 0 0 0 0 rgba(228,190,120,0); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        .pbask-fab { display: none !important; } /* design's own button triggers the panel */
        ::selection { background: #c79a4b; color: #15241c; }
      `}</style>

      {/* map fills the whole viewport */}
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

      {/* key prompt overlay (design's dev fallback — production uses NEXT_PUBLIC_GMAPS_KEY) */}
      <div style={{ display: ui.keyOverlay ? "flex" : "none", position: "absolute", inset: 0, zIndex: 700, background: "rgba(14,42,29,.72)", backdropFilter: "blur(3px)", alignItems: "center", justifyContent: "center", padding: 30 }}>
        <div style={{ background: "#fffdf7", border: "1px solid #e3d9c5", borderRadius: 16, padding: "24px 26px", maxWidth: 420, boxShadow: "0 16px 40px -16px rgba(0,0,0,.4)" }}>
          <h3 style={{ fontFamily: serif, color: "#1d4a37", fontSize: "1.15rem", margin: "0 0 8px" }}>Load the live map</h3>
          <p style={{ color: "#666", fontSize: ".88rem", lineHeight: 1.55, margin: "0 0 12px" }}>{ui.keyMsg}</p>
          <input ref={keyInputRef} placeholder="Your Maps JS API key" style={{ width: "100%", border: "1px solid #e3d9c5", borderRadius: 10, padding: "11px 12px", fontSize: ".86rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box" }} />
          <button onClick={saveKey} style={{ width: "100%", marginTop: 10, border: "none", cursor: "pointer", borderRadius: 10, padding: 12, fontWeight: 800, color: "#fff", background: "#1d4a37", fontFamily: "inherit", boxShadow: "0 5px 0 #10271d" }}>Load map</button>
          <p style={{ fontSize: ".72rem", color: "#a7a08c", margin: "11px 0 0", lineHeight: 1.45 }}>Use an unrestricted dev key for testing, or add this preview's URL to the key's allowed referrers in Google Cloud.</p>
        </div>
      </div>

      {/* ============ GLASS HEADER (nav + search) ============ */}
      <header style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 600, border: "1px solid rgba(255,255,255,.12)", borderRadius: 18, background: "rgba(16,32,23,.42)", WebkitBackdropFilter: "blur(20px) saturate(1.5)", backdropFilter: "blur(20px) saturate(1.5)", boxShadow: "0 16px 40px -18px rgba(8,18,12,.6)", overflow: "visible" }}>
        <div style={{ position: "absolute", top: 0, left: "-30%", width: "42%", height: "340%", pointerEvents: "none", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.2),transparent)", transform: "translateY(-30%) rotate(8deg)", animation: "ex-sheen 7.5s ease-in-out infinite 1s", borderRadius: 18, overflow: "hidden" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 58, padding: "0 14px" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, color: "#f3ede0", textDecoration: "none", flex: "none" }}>
            <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "linear-gradient(145deg,#e4be78,#c79a4b)", display: "flex", alignItems: "center", justifyContent: "center", color: "#15241c", boxShadow: "0 6px 16px -6px rgba(0,0,0,.5)" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l5 9h-3l5 9H5l5-9H7z"></path><rect x="11" y="18" width="2" height="4"></rect></svg>
            </span>
            <span style={{ lineHeight: 1.05, display: "none" }}>
              <b style={{ fontFamily: serif, fontSize: "1.18rem", fontWeight: 700, color: "#fbf6ea", display: "block" }}>ParkBuddy</b>
            </span>
          </a>

          {/* search + typeahead */}
          <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(243,237,224,.6)", fontSize: ".95rem", pointerEvents: "none" }}>⌕</span>
            <input
              value={ui.searchQuery}
              onChange={(e) => patch({ searchQuery: e.target.value })}
              placeholder="Search parks, forests, lakes…"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 34px", border: "1px solid rgba(255,255,255,.22)", borderRadius: 12, fontSize: ".86rem", fontFamily: "inherit", color: "#fbf6ea", background: "rgba(255,255,255,.12)", outline: "none" }}
            />
            {searchResults.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fffdf7", border: "1px solid #e3d9c5", borderRadius: 13, boxShadow: "0 20px 44px -16px rgba(8,18,12,.5)", maxHeight: 320, overflowY: "auto", zIndex: 50 }}>
                {searchResults.map((r) => (
                  <button key={r.name} onClick={() => selectPark(r.name)} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", border: "none", borderBottom: "1px solid #f1ead9", background: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ fontSize: "1rem" }}>{TYPE_META[r.type].icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: ".85rem", color: "#1d3941", display: "block" }}>{r.name}</b>
                      <span style={{ fontSize: ".7rem", color: "#8c8473" }}>{TYPE_META[r.type].label} · {r.state}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <nav style={{ display: "flex", gap: 6, alignItems: "center", flex: "none" }}>
            <a href="/explore" style={{ color: "#15241c", background: "#fbf6ea", textDecoration: "none", fontSize: ".84rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Map</a>
            <a href="/plan" style={{ color: "rgba(243,237,224,.9)", textDecoration: "none", fontSize: ".84rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Plan a Trip</a>
            <a href="/build-trip" style={{ color: "rgba(243,237,224,.9)", textDecoration: "none", fontSize: ".84rem", fontWeight: 600, padding: "8px 14px", borderRadius: 999 }}>Build a Trip</a>
            {/* auth.js mounts the real account UI here (falls back to a plain circle pre-load) */}
            <span id="pp-acct-slot" style={{ display: "inline-flex", alignItems: "center" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(145deg,#33555f,#1d3941)", border: "1px solid rgba(228,190,120,.4)" }} />
            </span>
          </nav>
        </div>
      </header>

      {/* ---- show-panel trigger ---- */}
      <button onClick={() => patch({ panelOpen: true })} style={{ display: ui.panelOpen ? "none" : "flex", position: "absolute", top: 86, left: 18, zIndex: 560, border: "1px solid rgba(228,190,120,.5)", background: "linear-gradient(150deg,rgba(35,72,82,.95),rgba(16,38,44,.96))", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", color: "#fbf6ea", fontFamily: "inherit", fontWeight: 700, fontSize: ".82rem", padding: "11px 16px", borderRadius: 13, cursor: "pointer", boxShadow: "0 14px 34px -14px rgba(8,18,12,.7)" }}>☰ Filters &amp; browse</button>

      {/* ============ CONTROL-CENTER PANEL ============ */}
      <aside style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 392, zIndex: 530, overflow: "hidden", background: "linear-gradient(168deg,rgba(243,246,240,.94),rgba(230,238,231,.9))", WebkitBackdropFilter: "blur(26px) saturate(1.5)", backdropFilter: "blur(26px) saturate(1.5)", borderRight: "1px solid rgba(255,255,255,.45)", boxShadow: "1px 0 0 rgba(255,255,255,.6) inset, 0 2px 0 rgba(228,190,120,.5) inset, 18px 0 60px -34px rgba(20,36,28,.5)", display: "flex", flexDirection: "column", transform: ui.panelOpen ? "translateX(0)" : "translateX(-100%)" }}>
        <button onClick={() => patch({ panelOpen: false })} style={{ position: "absolute", top: 84, right: 9, zIndex: 3, width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(255,255,255,.8)", background: "rgba(255,255,255,.7)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", color: "#1d3941", fontSize: "1rem", lineHeight: 1, cursor: "pointer" }}>‹</button>

        <div className="ex-scroll" style={{ flex: 1, overflowY: "auto", padding: "78px 16px 16px", boxSizing: "border-box" }}>

          {/* ========== BROWSE VIEW ========== */}
          {ui.view === "browse" && (
            <>
              <button onClick={toggle("filtersOpen")} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 9, padding: "10px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ color: "#8c8473", fontSize: ".95rem" }}>⚙</span>
                <span style={{ fontSize: ".74rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#1d3941", flex: 1 }}>Filters</span>
                <span style={{ minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: "#c79a4b", color: "#163a2b", fontSize: ".68rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeFilterCount}</span>
                <span style={{ color: "#8c8473", fontSize: ".8rem", transform: ui.filtersOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </button>

              <div style={{ display: ui.filtersOpen ? "block" : "none" }}>
                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#b07d3a", margin: "8px 0" }}>Search radius</div>
                <div style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <b style={{ fontSize: ".88rem", color: "#1a2b21" }}>Within {ui.radius} mi</b>
                    <button onClick={() => setAnchor({ lat: USER_LOC.lat, lng: USER_LOC.lng, label: "your location", isUser: true }, true)} style={{ display: "flex", alignItems: "center", gap: 5, background: ui.anchor && ui.anchor.isUser ? "#1d4a37" : "#f0e8d5", color: ui.anchor && ui.anchor.isUser ? "#fbf6ea" : "#7a6a3c", border: "none", borderRadius: 999, padding: "6px 13px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📍 Near me</button>
                  </div>
                  <input type="range" min="10" max="300" step="10" value={ui.radius} onChange={(e) => setRadius(+e.target.value)} style={{ width: "100%", accentColor: "#c79a4b" }} />
                  <div style={{ fontSize: ".72rem", color: "#8c8473", marginTop: 6, lineHeight: 1.4 }}>Tap &quot;Near me&quot; or pick a place, then set the distance.</div>
                </div>

                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#b07d3a", marginBottom: 8 }}>Destination types</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#2f7d4f" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>National Parks</span>
                    <Switch on={ui.destNational} onClick={toggle("destNational")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, background: "#c79a4b", transform: "rotate(45deg)", display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>State Parks</span>
                    <Switch on={ui.destState} onClick={toggle("destState")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "9px solid #3f5d2f", display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>National Forests</span>
                    <Switch on={ui.destForest} onClick={toggle("destForest")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50% 50% 50% 0", background: "#2c6b8f", transform: "rotate(-45deg)", display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Lakes</span>
                    <Switch on={ui.destLake} onClick={toggle("destLake")} />
                  </div>
                </div>

                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#b07d3a", marginBottom: 8 }}>On the map</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 8, height: 8, background: "#b9823f", display: "inline-block" }} />
                  <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Campgrounds &amp; areas</span>
                  <Switch on={ui.campgrounds} onClick={toggle("campgrounds")} />
                </div>

              </div>

              <div style={{ display: "flex", gap: 6, margin: "16px 0 12px", background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 12, padding: 4 }}>
                <button onClick={() => patch({ listMode: false })} style={{ flex: 1, border: "none", borderRadius: 9, padding: 8, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: !ui.listMode ? "#1d4a37" : "transparent", color: !ui.listMode ? "#fff" : "#5b6258" }}>🗺 Map</button>
                <button onClick={() => patch({ listMode: true })} style={{ flex: 1, border: "none", borderRadius: 9, padding: 8, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: ui.listMode ? "#1d4a37" : "transparent", color: ui.listMode ? "#fff" : "#5b6258" }}>☰ List</button>
              </div>

              {ui.anchor && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(199,154,75,.16)", border: "1px solid rgba(199,154,75,.35)", borderRadius: 11, padding: "8px 11px", marginBottom: 10 }}>
                  <span style={{ color: "#a8791f" }}>📍</span>
                  <span style={{ flex: 1, fontSize: ".78rem", fontWeight: 700, color: "#7a5b1f" }}>Around {ui.anchor.label}</span>
                  <button onClick={clearAnchor} style={{ background: "none", border: "none", color: "#a8791f", fontSize: ".8rem", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                </div>
              )}

              <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8c8473", marginBottom: 10 }}>{visible.length} of {parks.length} destinations match your filters</div>

              {!ui.listMode && (
                <div style={{ textAlign: "center", color: "#8c8473", fontSize: ".85rem", lineHeight: 1.6, padding: "18px 10px", background: "rgba(255,255,255,.45)", border: "1px dashed rgba(140,132,115,.4)", borderRadius: 14 }}>
                  Tap any pin on the map to explore that place — conditions, details, and what&apos;s nearby.
                </div>
              )}
              {ui.listMode && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {sortedVisible.length === 0 && (
                    <div style={{ textAlign: "center", color: "#8c8473", padding: "26px 10px", fontSize: ".85rem" }}>No destinations match this filter right now.</div>
                  )}
                  {sortedVisible.map((p) => {
                    const v = vOf(p);
                    const meta = TYPE_META[p.type];
                    const inTrip = ui.trip.indexOf(p.name) > -1;
                    const near = parks.filter((o) => o.name !== p.name && milesBetween(p, o) <= 50).length;
                    return (
                      <div key={p.name} onClick={() => selectPark(p.name)} style={{ background: "#fffdf7", border: "1px solid rgba(255,255,255,.8)", borderRadius: 14, overflow: "hidden", cursor: "pointer", boxShadow: "0 10px 26px -16px rgba(20,36,28,.45)" }}>
                        <div style={{ position: "relative", height: 78, background: `linear-gradient(135deg,${v.dot}cc,${v.dot}88)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          <span style={{ fontSize: "1.9rem", opacity: 0.5, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.2))" }}>{meta.icon}</span>
                          <CoverPhoto park={p} />
                          <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,.95)", color: v.dot, fontSize: ".66rem", fontWeight: 800, letterSpacing: ".03em", padding: "4px 9px", borderRadius: 999, boxShadow: "0 3px 8px rgba(0,0,0,.18)" }}>{v.label}</span>
                          <button
                            title={inTrip ? "In your trip" : "Add to trip"}
                            onClick={(e) => { e.stopPropagation(); toggleTripFor(p.name); }}
                            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,.9)", color: inTrip ? "#1d4a37" : "#8c8473", fontSize: ".85rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(0,0,0,.18)" }}
                          >{inTrip ? "✓" : "+"}</button>
                        </div>
                        <div style={{ padding: "9px 11px 11px" }}>
                          <b style={{ fontFamily: serif, fontSize: ".94rem", color: "#163a2b", display: "block", lineHeight: 1.2 }}>{p.name}</b>
                          <div style={{ fontSize: ".71rem", color: "#8c8473", margin: "2px 0 7px" }}>{meta.label} · {p.state}</div>
                          <div style={{ display: "flex", gap: 10, fontSize: ".68rem", color: "#5b6258", fontWeight: 600 }}>
                            <span>📍 {near} nearby</span>
                            {ui.anchor && <span>{Math.round(milesBetween(ui.anchor, p))} mi from pin</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ========== DETAIL VIEW ========== */}
          {ui.view === "detail" && sel && (
            <>
              <button onClick={backToBrowse} style={{ background: "none", border: "none", color: "#1d3941", fontWeight: 700, fontSize: ".82rem", cursor: "pointer", fontFamily: "inherit", padding: "4px 4px 12px", display: "flex", alignItems: "center", gap: 5 }}>‹ Back to browse</button>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: "1.3rem" }}>{selMeta.icon}</span>
                <span style={{ fontFamily: serif, fontSize: "1.2rem", fontWeight: 700, color: "#163a2b" }}>{sel.name}</span>
              </div>
              <div style={{ fontSize: ".78rem", color: "#8c8473", marginBottom: 12 }}>{selMeta.label} · {sel.state}</div>

              {gateway && (
                <div style={{ background: "rgba(199,154,75,.14)", border: "1px solid rgba(199,154,75,.3)", borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
                  <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#a8791f", marginBottom: 3 }}>🏘 Gateway town</div>
                  <b style={{ fontSize: ".86rem", color: "#163a2b", display: "block" }}>{gateway.town}</b>
                  <div style={{ fontSize: ".76rem", color: "#6b6046", marginTop: 3, lineHeight: 1.4 }}>{gateway.blurb}</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 12, padding: 4 }}>
                <button onClick={() => patch({ detailTab: "live" })} style={{ flex: 1, border: "none", borderRadius: 9, padding: 8, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: ui.detailTab === "live" ? "#1d4a37" : "transparent", color: ui.detailTab === "live" ? "#fff" : "#5b6258" }}>📡 Live</button>
                <button onClick={() => patch({ detailTab: "about" })} style={{ flex: 1, border: "none", borderRadius: 9, padding: 8, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: ui.detailTab === "about" ? "#1d4a37" : "transparent", color: ui.detailTab === "about" ? "#fff" : "#5b6258" }}>ℹ️ About</button>
              </div>

              {ui.detailTab === "live" && (
                <div style={{ background: selV.bg, borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: selV.dot }} />
                    <b style={{ fontSize: "1rem", color: selV.dot }}>{selV.label}</b>
                  </div>
                  <div style={{ fontSize: ".84rem", color: "#4c5443", lineHeight: 1.5 }}>{selV.note}</div>
                </div>
              )}
              {ui.detailTab === "about" && (
                <div style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 14, padding: 16, marginBottom: 14, fontSize: ".84rem", color: "#4c5443", lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 8 }}><b style={{ color: "#1d3941" }}>Type:</b> {selMeta.label}</div>
                  <div style={{ marginBottom: 8 }}><b style={{ color: "#1d3941" }}>State:</b> {sel.state}</div>
                  <div style={{ color: "#8c8473", fontSize: ".78rem" }}>Full descriptions, photos and visitor info coming soon.</div>
                </div>
              )}

              <button onClick={() => toggleTripFor(ui.selectedName)} style={{ width: "100%", boxSizing: "border-box", border: "none", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: ".88rem", cursor: "pointer", fontFamily: "inherit", marginBottom: 18, background: tripHas ? "#eef4e6" : "#1d4a37", color: tripHas ? "#1d4a37" : "#fff" }}>
                {tripHas ? "✓ In your trip — tap to remove" : "+ Add to trip"}
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8c8473" }}>Nearby — within {ui.radius} mi (~{driveTimeLabel(ui.radius)} drive)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <button onClick={() => setRadius(ui.radius - 25)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(140,132,115,.35)", background: "rgba(255,255,255,.6)", color: "#1d3941", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>−</button>
                <input type="range" min="10" max="300" step="10" value={ui.radius} onChange={(e) => setRadius(+e.target.value)} style={{ flex: 1, accentColor: "#c79a4b" }} />
                <button onClick={() => setRadius(ui.radius + 25)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(140,132,115,.35)", background: "rgba(255,255,255,.6)", color: "#1d3941", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nearbyItems.length === 0 && (
                  <div style={{ textAlign: "center", color: "#8c8473", padding: "16px 10px", fontSize: ".82rem" }}>Nothing within {ui.radius} mi — try widening the radius above.</div>
                )}
                {nearbyItems.map((o) => {
                  const meta = TYPE_META[o.type];
                  return (
                    <div key={o.name} onClick={o.click || undefined} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 12, padding: "10px 11px", cursor: o.click ? "pointer" : "default" }}>
                      <span style={{ fontSize: "1rem" }}>{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: ".85rem", color: "#163a2b", display: "block" }}>{o.name}</b>
                        <span style={{ fontSize: ".7rem", color: "#8c8473" }}>{meta.label}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#8c8473" }}>{Math.round(o.dist)} mi</div>
                        <div style={{ fontSize: ".64rem", color: "#a7a08c" }}>~{driveTimeLabel(o.dist)} drive</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ========== TRIP VIEW (the cart) ========== */}
          {ui.view === "trip" && (
            <>
              <button onClick={backToBrowse} style={{ background: "none", border: "none", color: "#1d3941", fontWeight: 700, fontSize: ".82rem", cursor: "pointer", fontFamily: "inherit", padding: "4px 4px 12px", display: "flex", alignItems: "center", gap: 5 }}>‹ Back to browse</button>
              <div style={{ fontFamily: serif, fontSize: "1.2rem", fontWeight: 700, color: "#163a2b", marginBottom: 4 }}>My Trip</div>
              <div style={{ fontSize: ".8rem", color: "#8c8473", marginBottom: 14 }}>
                {ui.trip.length ? ui.trip.length + " place" + (ui.trip.length === 1 ? "" : "s") + " added" : "No places yet"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
                {tripItems.length === 0 && (
                  <div style={{ textAlign: "center", color: "#8c8473", padding: "24px 10px", fontSize: ".85rem", lineHeight: 1.5 }}>Nothing added yet. Select a place and tap &quot;Add to trip.&quot;</div>
                )}
                {tripItems.map((p, i) => {
                  const meta = TYPE_META[p.type];
                  return (
                    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 12, padding: "10px 11px" }}>
                      <span style={{ width: 24, height: 24, flex: "none", borderRadius: "50%", background: "#1d4a37", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".76rem", fontWeight: 700, border: "2px solid #c79a4b" }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: ".86rem", color: "#163a2b", display: "block" }}>{p.name}</b>
                        <span style={{ fontSize: ".7rem", color: "#8c8473" }}>{meta.label} · {p.state}</span>
                      </div>
                      <button onClick={() => patch((s) => ({ trip: s.trip.filter((n) => n !== p.name) }))} style={{ background: "none", border: "none", color: "#b06a4a", cursor: "pointer", fontSize: "1.15rem", lineHeight: 1 }}>×</button>
                    </div>
                  );
                })}
              </div>
              {ui.trip.length > 0 && (
                <a href="/build-trip" style={{ display: "block", textAlign: "center", background: "#c79a4b", color: "#163a2b", padding: 13, borderRadius: 11, fontWeight: 700, fontSize: ".9rem", textDecoration: "none", boxShadow: "0 5px 0 #9c7330" }}>Build this trip →</a>
              )}
            </>
          )}
        </div>

        {/* persistent trip pill */}
        <div style={{ display: ui.view === "trip" ? "none" : "block", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,.5)", background: "linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.62))", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => patch({ view: "trip" })} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(150deg,#33555f,#1d3941)", color: "#fff" }}>🧳 My Trip · {ui.trip.length}</button>
        </div>
      </aside>

      {/* ---- bottom-left: Home + verdict legend ---- */}
      <div style={{ position: "absolute", left: 16, bottom: 16, zIndex: 500, display: "flex", alignItems: "center", gap: 9 }}>
        <button onClick={() => { window.location.href = "/"; }} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,253,247,.9)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.7)", borderRadius: 999, padding: "9px 15px", fontFamily: "inherit", fontWeight: 700, fontSize: ".82rem", color: "#1d3941", cursor: "pointer", boxShadow: "0 12px 28px -14px rgba(28,46,34,.5)" }}>
          <span style={{ color: "#c79a4b" }}>▲</span>Home
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(255,253,247,.86)", WebkitBackdropFilter: "blur(14px) saturate(1.3)", backdropFilter: "blur(14px) saturate(1.3)", border: "1px solid rgba(255,255,255,.6)", borderRadius: 999, padding: "9px 14px", boxShadow: "0 12px 28px -14px rgba(28,46,34,.5)" }}>
          <span style={{ fontSize: ".6rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#b07d3a" }}>Today&apos;s call</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".74rem", fontWeight: 700, color: "#3c4a3a" }}><i style={{ width: 9, height: 9, borderRadius: "50%", background: "#2f7d4f", border: "1.5px solid #fffdf7" }} />Go</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".74rem", fontWeight: 700, color: "#3c4a3a" }}><i style={{ width: 9, height: 9, borderRadius: "50%", background: "#b9802a", border: "1.5px solid #fffdf7" }} />Prepare</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".74rem", fontWeight: 700, color: "#3c4a3a" }}><i style={{ width: 9, height: 9, borderRadius: "50%", background: "#bf463a", border: "1.5px solid #fffdf7" }} />Hold off</span>
        </div>
      </div>

      {/* ---- bottom-right: expand + zoom + Ask Park Buddy ---- */}
      <div style={{ position: "absolute", right: 16, bottom: 78, zIndex: 500, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <button title="Fullscreen" onClick={() => { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen(); else if (document.exitFullscreen) document.exitFullscreen(); }} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,253,247,.92)", border: "1px solid rgba(255,255,255,.7)", boxShadow: "0 8px 20px -10px rgba(28,46,34,.5)", color: "#1d4a37", fontSize: "1rem", cursor: "pointer" }}>⤢</button>
        <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 20px -10px rgba(28,46,34,.5)", border: "1px solid rgba(255,255,255,.7)" }}>
          <button onClick={zoomIn} style={{ width: 38, height: 36, background: "rgba(255,253,247,.95)", border: "none", borderBottom: "1px solid #e3d9c5", color: "#1d4a37", fontSize: "1.15rem", fontWeight: 700, cursor: "pointer" }}>+</button>
          <button onClick={zoomOut} style={{ width: 38, height: 36, background: "rgba(255,253,247,.95)", border: "none", color: "#1d4a37", fontSize: "1.3rem", fontWeight: 700, cursor: "pointer" }}>−</button>
        </div>
      </div>
      <button onClick={askParkBuddy} style={{ position: "absolute", right: 16, bottom: 16, zIndex: 500, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(150deg,#33555f,#1d3941)", color: "#fbf6ea", border: "1px solid rgba(228,190,120,.45)", borderRadius: 999, padding: "12px 18px", fontFamily: "inherit", fontWeight: 700, fontSize: ".84rem", cursor: "pointer", boxShadow: "0 14px 32px -14px rgba(8,18,12,.65)" }}>
        <span style={{ color: "#e4be78" }}>✦</span>Ask Park Buddy
      </button>
    </div>
  );
}
