"use client";

// /explore-next — the Zillow/Airbnb split, built to the Figma.
//
// Two levels, and the split between them is a DATA decision, not a taste one:
//   level 1  places you go — national parks, forests, state parks. All local
//            datasets, so browsing them across a map costs nothing.
//   level 2  things inside one place — trails, camping, water. Every one of these
//            is a live third-party call (NPS ArcGIS / Recreation.gov / USGS), so
//            they load ONLY after you open a place. One place, on demand.
//
// The chip row never moves; only its vocabulary changes. Outside a place it asks
// "what kind of place", inside one it asks "what kind of thing here".
//
// Layout is measured off the real thing: Zillow runs a 43% map with 344px cards,
// Airbnb ~48% with 303px. We use a 700px panel (two 318px cards) and the rest map.
// A 420px rail is a list; parks sell on the photograph.
//
// This is a NEW route on purpose — /explore keeps working untouched while this
// is reviewed.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import SaveButton from "../components/SaveButton";
import { usePhoto } from "../components/PhotoThumb";
import { useThemedBody } from "../lib/theme";
import { ensureMapsLoaded } from "../lib/googleMapsLoader";
import { getStops, setStops, subscribeTrip } from "../lib/trip";
import { getMapPrefs, setMapPrefs, subscribeMapPrefs, mapOptionsFor, DARK_STYLE } from "../lib/mapPrefs";
import { roadAccessNote, roadAccessLabel } from "../lib/roadAccess";
import { WeatherChip, conditionFromSky } from "../components/WeatherTile";
import TrailDetail from "./TrailDetail";
import SharedGround from "../components/SharedGround";

/* ------------------------------------------------------------------ helpers */
const R_EARTH = 3958.8;
const rad = (d) => (d * Math.PI) / 180;
function milesBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}
const ST_ABBR = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY" };
const abbr = (s) => ST_ABBR[s] || s || "";

const TYPE_LABEL = {
  national_park: "National park", national_forest: "National forest",
  state_park: "State park", nps_unit: "National Park Service site",
};
const CATS = [
  { key: "national_park", label: "Parks" },
  { key: "national_forest", label: "Forests" },
  { key: "state_park", label: "State parks" },
  { key: "nps_unit", label: "Monuments & sites" },
];

// Monuments start OFF on purpose (410 units would drown the 63 parks), so
// "has the user filtered?" must be measured against THIS, not against
// everything-on — otherwise a fresh page opens already wearing a filter
// badge, and the quiet default is never quiet.
const DEFAULT_CATS = { national_park: true, national_forest: true, state_park: true, nps_unit: false };
const catsAreDefault = (c) => CATS.every(({ key }) => !!c[key] === !!DEFAULT_CATS[key]);

// A National Park Service unit is anything from a monument to a battlefield, so
// name it by its own designation rather than one flat label.
const NPS_DESIGNATIONS = [
  "National Monument", "National Historical Park", "National Historic Site",
  "National Historic Area", "National Seashore", "National Lakeshore",
  "National Recreation Area", "National Preserve", "National Reserve",
  "National Battlefield Park", "National Battlefield", "National Military Park",
  "National Memorial", "National Parkway", "National River", "National Scenic River",
  "Affiliated Area",
];
function npsLabel(name) {
  for (const d of NPS_DESIGNATIONS) if (name.includes(d)) return d;
  return "National Park Service site";
}

// 24 of the NPS units are LINEAR — the Appalachian Trail, the California National
// Historic Trail — running thousands of miles across up to ten states. They have a
// centroid in the data, but pinning one to a point and quoting a distance to it
// would be a straightforward lie about where it is. Routes need the treatment
// scenic drives get; until they have it, they're excluded rather than misplaced.
const isLinearUnit = (name) =>
  /National (Historic|Scenic) Trail/i.test(name) || /\bTrail\b/i.test(name) && /National/i.test(name);

function loadScript(src, id) {
  return new Promise((res) => {
    if (typeof document === "undefined") return res(false);
    if (document.getElementById(id)) return res(true);
    const s = document.createElement("script");
    s.src = src; s.id = id; s.async = true;
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}

// Numbered map marker. Google Maps can't read CSS variables, so these are literal.
// The numbered pin is the list-to-map correspondence (the Zillow/Airbnb model),
// so the number stays. What it was missing is today's call: the ring is drawn in
// the place's verdict colour, so GO / PREPARE / HOLD reads straight off the map
// instead of only from the cards.
function numIcon(g, n, on, verdict) {
  const d = on ? 30 : 24;
  const ring = verdictHex(verdict).replace("#", "%23");
  const bg = on ? "%23e8cf9a" : "rgba(8,13,9,.92)";
  const fg = on ? "%230a1712" : "%23aab0ba";
  const stroke = on ? "none" : "stroke='" + ring + "' stroke-opacity='.95' stroke-width='2'";
  const svg =
    "data:image/svg+xml;utf8," +
    "<svg xmlns='http://www.w3.org/2000/svg' width='" + d + "' height='" + d + "' viewBox='0 0 " + d + " " + d + "'>" +
    "<circle cx='" + d / 2 + "' cy='" + d / 2 + "' r='" + (d / 2 - 1.5) + "' fill='" + bg + "' " + stroke + "/>" +
    "<text x='50%' y='50%' dy='.36em' text-anchor='middle' font-family='monospace' font-size='" +
      (on ? 13 : 11) + "' fill='" + fg + "'>" + n + "</text></svg>";
  return { url: svg, scaledSize: new g.maps.Size(d, d), anchor: new g.maps.Point(d / 2, d / 2) };
}
function originIcon(g) {
  const svg =
    "data:image/svg+xml;utf8," +
    "<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'>" +
    "<circle cx='15' cy='15' r='13' fill='rgba(8,13,9,.92)' stroke='%23e8cf9a' stroke-width='3'/>" +
    "<circle cx='15' cy='15' r='5' fill='%23e8cf9a'/></svg>";
  return { url: svg, scaledSize: new g.maps.Size(30, 30), anchor: new g.maps.Point(15, 15) };
}

// Trail polyline colours, carried over from the legacy map so a route drawn here
// looks like the same route drawn anywhere else on the platform.
// InfoWindow content is an HTML string, so anything from a third-party feed has
// to be escaped on the way in — these names come from RIDB, OSM and GNIS.
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// One line under the name, in that kind's own terms.
function subFor(kind, it, place) {
  if (kind === "trails") return [TRAIL_CAT_LABEL[it.cat] || "Trail", it.lengthMi ? it.lengthMi + " mi" : null].filter(Boolean).join(" · ");
  if (kind === "camping") return [it.type || "Campground", it.reservable ? "reservable" : null].filter(Boolean).join(" · ");
  if (kind === "water") return it.kind || "Lake";
  if (kind === "towns") return it.distanceMi != null ? Math.round(it.distanceMi) + " mi from " + place.name : "Gateway town";
  return "";
}

// Rough drive time from straight-line miles. 45 mph is the old page's figure and
// it stays an estimate — it doesn't know about roads, let alone today's traffic,
// which is why every label that uses it says "est.".
const AVG_MPH = 45;
function driveTimeLabel(miles) {
  const hrs = miles / AVG_MPH;
  if (hrs < 1) return Math.round(hrs * 60) + " min";
  return Math.round(hrs * 10) / 10 + " hr";
}

const BOUNDARY_URL = (code) =>
  "https://raw.githubusercontent.com/nationalparkservice/data/gh-pages/base_data/boundaries/parks/" + code + ".topojson";

const TRAIL_STYLE = { hiking: "#3f7a34", offroad: "#a15a2a", ski: "#2a6f9e" };
const TRAIL_CAT_LABEL = { hiking: "Hiking trail", offroad: "Off-road / 4x4 route", ski: "Ski route" };

// Marker SVGs are data URIs, which can't reference CSS custom properties — but
// the verdict palette differs between light and dark. So resolve the token to a
// literal at draw time and the markers follow the theme like everything else.
function cssHex(name, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}
function verdictHex(v) {
  if (v === "go") return cssHex("--pb-go", "#4fd98a");
  if (v === "prepare") return cssHex("--pb-prepare", "#e8cf9a");
  if (v === "hold") return cssHex("--pb-hold", "#e0906a");
  return "#b3ab97";   // no live read yet
}

// Nearby features get a smaller, quieter dot than the numbered place markers —
// they're context around the place you opened, not results you're choosing between.
// One colour per kind so the map reads without a click.
const NEARBY_LABEL = { trails: "trail", camping: "campground", water: "water", towns: "gateway town" };
const NEARBY_STYLE = {
  trails:  { c: "%236fbf8b", r: 6 },
  camping: { c: "%23e8cf9a", r: 6 },
  water:   { c: "%236fb6d9", r: 6 },
  towns:   { c: "%23d79a9a", r: 7 },
};
function dotIcon(g, kind) {
  const st = NEARBY_STYLE[kind] || NEARBY_STYLE.trails;
  const d = st.r * 2 + 6;
  const svg =
    "data:image/svg+xml;utf8," +
    "<svg xmlns='http://www.w3.org/2000/svg' width='" + d + "' height='" + d + "' viewBox='0 0 " + d + " " + d + "'>" +
    "<circle cx='" + d / 2 + "' cy='" + d / 2 + "' r='" + st.r + "' fill='" + st.c +
      "' stroke='rgba(8,13,9,.85)' stroke-width='2'/></svg>";
  return { url: svg, scaledSize: new g.maps.Size(d, d), anchor: new g.maps.Point(d / 2, d / 2) };
}

// Explore's own dark style: roads and POI labels off so the place markers are the
// only thing competing for attention. Passed to mapOptionsFor as this page's dark
// style, which only applies to the roadmap base — satellite and terrain imagery
// ignore it, which is why the toggle still feels like a real choice.
const MAP_STYLE = [
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

// Every type here has a status page except nps_unit, which has none — so it gets
// no link rather than a broken one. Without this a forest or state park opened
// from the map was a dead end, even though /forests/:slug and /state-parks/:id
// have existed all along.
function statusHrefFor(p) {
  if (!p) return "";
  if (p.type === "national_park" && p.id) return "/parks/" + p.id;
  if (p.type === "national_forest") return "/forests/" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (p.type === "state_park" && p.destId) return "/state-parks/" + encodeURIComponent(p.destId);
  return "";
}

/* --------------------------------------------------------------- the screen */
export default function ExploreSplit() {
  const themeRef = useRef(null);
  useThemedBody(themeRef);

  const [places, setPlaces] = useState([]);
  const [dataErr, setDataErr] = useState("");
  const [origin, setOrigin] = useState(null);          // { name, lat, lng, state }
  const [radius, setRadius] = useState(100);           // miles; null = any
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [dataNote, setDataNote] = useState("");
  const [conds, setConds] = useState({ go: true, prepare: true, hold: true });
  const [stateFilter, setStateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sugg, setSugg] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [verdicts, setVerdicts] = useState({});
  const [picked, setPicked] = useState(() => new Set());
  const [sel, setSel] = useState(null);                // the opened place
  // What the detail panel has fetched for the opened place, lifted so the map can
  // draw it. The panel still owns the fetching — this is the same data, shown twice.
  // The trip store is shared with the park pages and the trip modal, so a stop
  // added anywhere else has to show up here. Reading getStops() during render
  // looked fine and was always stale — nothing told React to re-render.
  const [tripCount, setTripCount] = useState(0);
  useEffect(() => {
    const sync = () => setTripCount(getStops().length);
    sync();
    return subscribeTrip(sync);
  }, []);

  // The homepage's "Design your adventure → Enter the map" modal writes the
  // visitor's choices to pb_map_filters and expects the map to pick them up.
  // Nothing read the key here, so that whole funnel quietly lost the selection.
  // Consumed once and cleared, so a refresh doesn't re-apply a stale choice.
  //
  // Only the three place types the homepage offers map onto controls that exist
  // here; its per-layer choices (camp / lakes / hike / ohv / ski) are handled by
  // the in-place tabs instead, so they're deliberately not translated.
  useEffect(() => {
    let raw;
    try { raw = localStorage.getItem("pb_map_filters"); } catch { return; }
    if (!raw) return;
    try { localStorage.removeItem("pb_map_filters"); } catch {}
    let f;
    try { f = JSON.parse(raw); } catch { return; }
    if (!f) return;
    const TYPE = { np: "national_park", sp: "state_park", nf: "national_forest" };
    if (f.types) {
      const next = {};
      Object.keys(TYPE).forEach((k) => { if (k in f.types) next[TYPE[k]] = !!f.types[k]; });
      if (Object.keys(next).length) setCats((c) => ({ ...c, ...next }));
    }
    if (Number(f.radius) > 0) setRadius(Number(f.radius));
    if (f.near && typeof f.near.lat === "number") {
      setOrigin({ name: "My location", lat: f.near.lat, lng: f.near.lng, state: "" });
    }
  }, []);

  /* ---- phone layout -------------------------------------------------------
     The split is a desktop shape. At 375px a 50vw panel is 187px wide — narrower
     than a single card — so the page wasn't degraded on a phone, it was unusable.
     On a phone the panel takes the whole screen and the map becomes a full-screen
     view you switch to, which is what every app of this kind does.

     Reading the breakpoint in JS rather than CSS is only safe because this page
     is loaded ssr:false — there's no server render for the first client value to
     disagree with. It would be a hydration bug otherwise. */
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // Which half a phone is looking at. Desktop shows both and ignores this.
  const [phoneView, setPhoneView] = useState("list");

  // The platform's phone tab bar is fixed to the bottom and owns its own height,
  // so measure it rather than hardcoding one — the same reason the top nav is
  // measured. Getting this wrong doesn't look wrong, it makes the map/list
  // toggle invisible underneath the bar, which is how I first shipped it.
  const [barH, setBarH] = useState(0);
  useEffect(() => {
    if (!phone) { setBarH(0); return; }
    const bar = document.querySelector(".pbtabbar");
    if (!bar) return;
    const measure = () => setBarH(Math.round(bar.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar, { box: "border-box" });
    return () => ro.disconnect();
  }, [phone]);
  // Opening a place on a phone should show you the place, not leave you on the map.
  useEffect(() => { if (phone && sel) setPhoneView("list"); }, [phone, sel && sel.key]);

  const [nearby, setNearby] = useState({});
  const [detailTab, setDetailTab] = useState("overview");
  useEffect(() => { setNearby({}); setDetailTab("overview"); }, [sel && sel.key]);
  const [flash, setFlash] = useState("");

  const say = useCallback((m) => { setFlash(m); setTimeout(() => setFlash(""), 3000); }, []);

  // The site nav is a FLOATING PILL (.pb-nav-float — fixed, offset by a vw-based
  // clamp, height set by its contents), not a 64px bar. Hardcoding 64 put it on
  // top of the search field.
  //
  // Measuring once at mount isn't enough either, and that's what kept the overlap
  // alive: the nav holds a LOGO IMAGE, so at the moment this effect first runs the
  // nav can still be at its pre-load height. It grows when the image arrives — and
  // no resize event fires for that, so a one-shot measurement stays permanently
  // too small. A ResizeObserver catches the image landing, a font swapping in, and
  // the nav wrapping on a narrow window, all of which change its height without
  // the window changing size.
  const [topPad, setTopPad] = useState(104);
  useEffect(() => {
    const nav = document.querySelector(".pb-nav-float");
    if (!nav) return;
    const measure = () => {
      // fixed positioning → bottom is viewport-relative and scroll-independent
      setTopPad(Math.round(nav.getBoundingClientRect().bottom) + 14);
    };
    measure();
    // border-box, not the default content-box: what matters here is where the nav
    // visually ENDS, and padding or a border changes that without touching the
    // content box at all.
    const ro = new ResizeObserver(measure);
    ro.observe(nav, { box: "border-box" });
    window.addEventListener("resize", measure);   // catches the vw-clamp offset moving
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  /* ---- load the three local datasets ---- */
  useEffect(() => {
    let dead = false;
    (async () => {
      const [okTrip, okForest] = await Promise.all([
        loadScript("/trip-data.js", "pb-x-trip"),
        loadScript("/forest-data.js", "pb-x-forest"),
      ]);
      loadScript("/pb-verdict.js", "pb-x-verdict");
      let sp = [];
      try {
        const r = await fetch("/state-parks.json");
        if (r.ok) sp = (await r.json()).parks || [];
      } catch {}
      if (dead) return;

      const out = [];
      // National parks always come from the bundled file — it carries the id and
      // parkCode the destinations table doesn't, and those are what link to
      // /parks/:id and fetch the right trails.
      if (okTrip && window.TRIP_PARKS) {
        const codes = window.NPS_CODE || {};
        for (const p of window.TRIP_PARKS) {
          out.push({ key: "np:" + p.id, name: p.name, state: abbr(p.state), lat: p.lat, lng: p.lng,
            type: "national_park", id: p.id, npsCode: codes[p.id] || "", desc: p.desc || "",
            href: "/parks/" + p.id });
        }
      }

      // Everything else from the destinations table, so anything ingested later
      // shows up with no code change. Typed calls because the API caps at 500 and
      // the three types together exceed it.
      let fromDb = 0;
      const seen = new Set(out.map((p) => p.name.toLowerCase()));
      for (const type of ["state_park", "national_forest", "nps_unit"]) {
        try {
          const r = await fetch("/api/destinations?type=" + type + "&limit=500");
          if (!r.ok) continue;
          const j = await r.json();
          for (const d of j.destinations || []) {
            if (!d.name || d.lat == null || d.lng == null) continue;
            if (seen.has(d.name.toLowerCase())) continue;
            if (type === "nps_unit" && isLinearUnit(d.name)) continue;   // routes, not points
            seen.add(d.name.toLowerCase());
            // Some units span up to ten states; the field then reads
            // "California / Colorado / Idaho / …". Left out of the state filter
            // rather than polluting it with a compound value.
            const multi = typeof d.state === "string" && d.state.includes("/");
            out.push({
              key: type + ":" + d.id, name: d.name, state: multi ? "" : abbr(d.state),
              stateLabel: multi ? "Multi-state" : abbr(d.state),
              lat: Number(d.lat), lng: Number(d.lng), type,
              // the destinations-table id is what /state-parks/:id keys on
              destId: d.id,
              href: statusHrefFor({ type, name: d.name, destId: d.id }),
              sub: type === "nps_unit" ? npsLabel(d.name) : null,
            });
            fromDb++;
          }
        } catch { /* fall through to the bundled files */ }
      }

      // No table (local dev, or it's down) — use what ships in the repo. Fewer
      // places, but the page works rather than showing an empty shelf.
      if (!fromDb) {
        if (okForest && window.FOREST_DATA) {
          for (const f of window.FOREST_DATA) {
            if (seen.has(f.name.toLowerCase())) continue;
            seen.add(f.name.toLowerCase());
            out.push({ key: "nf:" + f.name, name: f.name, state: abbr(f.state), lat: f.lat, lng: f.lng,
              type: "national_forest", href: statusHrefFor({ type: "national_forest", name: f.name }) });
          }
        }
        for (const s of sp) {
          if (seen.has(s.name.toLowerCase())) continue;
          seen.add(s.name.toLowerCase());
          out.push({ key: "sp:" + s.name, name: s.name, state: abbr(s.state), lat: s.lat, lng: s.lng,
            type: "state_park", href: "" });
        }
        setDataNote("Showing the built-in list — the full places database isn't reachable from here.");
      }

      setPlaces(out);
      if (!out.length) setDataErr("Couldn't load the places list. Reload to try again.");
    })();
    return () => { dead = true; };
  }, []);

  /* ---- filtering ----
     Split in two on purpose. `inScope` applies everything EXCEPT the category
     toggles, so each chip can show how many places it would contribute. A count
     that changed when you toggled a different chip would be useless. */
  const inScope = useMemo(() => {
    let out = places;
    if (stateFilter) out = out.filter((p) => p.state === stateFilter);
    // A state is a scope, not another narrowing. Picking Utah means all of Utah —
    // leaving the radius on top of it would silently hide the half of the state
    // outside the circle, which is the opposite of what choosing a state means.
    // The origin still sorts and still shows distances; it just stops excluding.
    if (origin && radius && !stateFilter) out = out.filter((p) => milesBetween(origin, p) <= radius);
    // Conditions only bite once a verdict has actually arrived — an unknown
    // verdict must never silently hide a place.
    if (!conds.go || !conds.prepare || !conds.hold) {
      out = out.filter((p) => { const v = verdicts[p.name]; return !v || conds[v]; });
    }
    return out;
  }, [places, stateFilter, origin, radius, conds, verdicts]);

  const catCounts = useMemo(() => {
    const c = { national_park: 0, national_forest: 0, state_park: 0, nps_unit: 0 };
    for (const p of inScope) if (c[p.type] != null) c[p.type]++;
    return c;
  }, [inScope]);

  const results = useMemo(() => {
    const out = inScope.filter((p) => cats[p.type]);
    return origin
      ? out.slice().sort((a, b) => milesBetween(origin, a) - milesBetween(origin, b))
      : out.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [inScope, cats, origin]);

  // Render in pages rather than capping. Every card costs a photo fetch and a
  // verdict lookup, so 255 at once would hammer both — but the number on screen
  // must never be presented as the total.
  const [limit, setLimit] = useState(24);
  useEffect(() => { setLimit(24); }, [stateFilter, origin, radius, cats, conds]);
  const shown = results.slice(0, limit);

  // Active weather alerts, straight from weather.gov. Cached per rounded coord for
  // the session, same convention PBVerdict uses.
  const alertCache = useRef({});
  const fetchAlerts = useCallback(async (lat, lng) => {
    const key = lat.toFixed(3) + "," + lng.toFixed(3);
    if (alertCache.current[key]) return alertCache.current[key];
    try {
      const r = await fetch(
        "https://api.weather.gov/alerts/active?point=" + lat.toFixed(4) + "," + lng.toFixed(4),
        { headers: { Accept: "application/geo+json" } }
      );
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const list = (j.features || [])
        .map((f) => f.properties || {})
        .filter((p) => p.event)
        .map((p) => ({ event: p.event, severity: p.severity || "", headline: p.headline || "" }));
      alertCache.current[key] = list;
      return list;
    } catch {
      alertCache.current[key] = null;   // null = we tried and couldn't
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.PBVerdict) return;
    let dead = false, running = 0, i = 0;
    // Every type, not just national parks. The old Explore checked national parks
    // only, which left every state park and forest showing "checking…" forever —
    // a promise the page never kept. weather.gov works from any US coordinate and
    // PBVerdict caches per rounded coord for the session, so the cost is bounded
    // by what's actually on screen rather than by the whole dataset.
    const queue = shown.filter((p) => !verdicts[p.name]);

    const one = async (p) => {
      // Alerts FIRST, because the verdict is supposed to account for them.
      // pb-verdict's own fetchVerdict passes evaluate(periods, 0, 0) — weather
      // only — so a place could read "Great day to go" with a flood warning
      // active. We fetch the real count and evaluate with it.
      const alerts = await fetchAlerts(p.lat, p.lng);
      const periods = await new Promise((res) => window.PBVerdict.fetchPeriods(p.lat, p.lng, res));
      if (dead) return;
      const r = periods ? window.PBVerdict.evaluate(periods, (alerts || []).length, 0) : null;
      if (!r) return;
      const b = r.score >= 62 ? "go" : r.score >= 42 ? "prepare" : "hold";
      // isDaytime is the forecast's own flag — the weather effect needs it to know
      // whether a clear sky is a sun or a field of stars.
      const isDay = periods[0] && periods[0].isDaytime !== false;
      setVerdicts((v) => ({ ...v, [p.name]: b, [p.name + ":full"]: r,
        [p.name + ":alerts"]: alerts, [p.name + ":day"]: isDay }));
    };

    const pump = () => {
      while (running < 3 && i < queue.length) {
        const p = queue[i++]; running++;
        one(p).catch(() => {}).then(() => { running--; if (!dead) pump(); });
      }
    };
    pump();
    return () => { dead = true; };
  }, [shown.map((p) => p.key).join(","), places.length, fetchAlerts]);

  /* ---- search: local places first, then geocode (ZIP / address / town) ---- */
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setSugg([]); return; }
    const local = places
      .filter((p) => p.name.toLowerCase().includes(q) || p.state.toLowerCase() === q)
      .slice(0, 6)
      .map((p) => ({ kind: "place", label: p.name, sub: TYPE_LABEL[p.type] + " · " + p.state, place: p }));
    setSugg(local);
    // Gateway towns ride along (owner call 2026-07-22: every town searchable
    // from anywhere). Server-side name index over the ~3,200 town pages;
    // debounced so typing doesn't spray requests, appended below the places.
    let dead = false;
    const t = setTimeout(() => {
      fetch("/api/town-search?q=" + encodeURIComponent(q))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (dead) return;
          const towns = ((d && d.towns) || []).slice(0, 4).map((tn) => ({
            kind: "town",
            label: tn.name + ", " + tn.st,
            sub: "Gateway town" + (tn.serves && tn.serves.length ? " · serves " + tn.serves[0] : ""),
            href: "/towns/" + tn.slug,
          }));
          if (towns.length) setSugg([...local, ...towns]);
        })
        .catch(() => {});
    }, 220);
    return () => { dead = true; clearTimeout(t); };
  }, [query, places]);

  const searchGeo = async () => {
    const q = query.trim();
    if (!q) return;
    setGeocoding(true);
    try {
      const r = await fetch("/api/geocode?q=" + encodeURIComponent(q));
      const d = await r.json();
      if (d && d.found) {
        setOrigin({ name: d.name, lat: d.lat, lng: d.lng, state: d.state || "" });
        setQuery(""); setSugg([]); setSel(null);
      } else {
        say("Couldn't find “" + q + "”. Try a town, ZIP or park name.");
      }
    } catch {
      say("Search is unavailable right now.");
    }
    setGeocoding(false);
  };

  const pickPlace = (p) => {
    setOrigin({ name: p.name, lat: p.lat, lng: p.lng, state: p.state });
    setQuery(""); setSugg([]); setSel(null);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return say("This browser can't share a location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ name: "My location", lat: pos.coords.latitude, lng: pos.coords.longitude, state: "" }),
      () => say("Couldn't get your location — allow location access and try again."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  /* ---- the map ---- */
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const originRef = useRef(null);
  const ringRef = useRef(null);
  const [mapOk, setMapOk] = useState(null);   // null = trying

  useEffect(() => {
    let dead = false;
    ensureMapsLoaded().then((ok) => {
      if (dead) return;
      setMapOk(ok);
      if (!ok || !mapEl.current) return;
      const g = window.google;
      // Map appearance is a platform-wide preference (app/lib/mapPrefs.js), not a
      // per-page decision. Hardcoding "hybrid" here meant this map silently
      // disagreed with every other map on the site.
      mapRef.current = new g.maps.Map(mapEl.current, {
        center: { lat: 39.5, lng: -98.5 }, zoom: 4, minZoom: 3, maxZoom: 15,
        mapTypeControl: true, streetViewControl: false,
        fullscreenControl: true, gestureHandling: "cooperative", backgroundColor: "#0a1712",
        ...mapOptionsFor(getMapPrefs(), MAP_STYLE),
      });
    });
    return () => { dead = true; };
  }, []);

  // …and follow it when it changes elsewhere on the site.
  useEffect(() => subscribeMapPrefs((prefs) => {
    if (mapRef.current) mapRef.current.setOptions(mapOptionsFor(prefs, MAP_STYLE));
  }), []);

  // A map inside display:none has zero size, and Google caches that. Revealing it
  // without a resize gives you a grey rectangle with the logo in the corner —
  // it needs telling, and re-centring afterwards or it keeps the old centre in
  // the wrong place.
  useEffect(() => {
    if (!phone || phoneView !== "map") return;
    const g = typeof window !== "undefined" ? window.google : null;
    const map = mapRef.current;
    if (!g || !map) return;
    const c = map.getCenter();
    const t = setTimeout(() => {
      g.maps.event.trigger(map, "resize");
      if (c) map.setCenter(c);
    }, 60);
    return () => clearTimeout(t);
  }, [phone, phoneView, mapOk]);


  // redraw markers whenever the visible set changes
  useEffect(() => {
    const g = typeof window !== "undefined" ? window.google : null;
    const map = mapRef.current;
    if (!g || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // With a place open the map belongs to that place: show only it, and don't
    // re-fit to the whole result set (that would fight the zoom-in below).
    const list = sel ? shown.filter((p) => p.key === sel.key) : shown;

    list.forEach((p, i) => {
      const on = picked.has(p.key);
      const m = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map,
        icon: numIcon(g, sel ? shown.indexOf(p) + 1 : i + 1, on || !!sel, verdicts[p.name]),
        title: p.name + (verdicts[p.name] ? " · " + verdicts[p.name].toUpperCase() : ""), zIndex: on ? 20 : 10,
      });
      m.addListener("click", () => setSel(p));
      markersRef.current.push(m);
    });

    if (originRef.current) { originRef.current.setMap(null); originRef.current = null; }
    if (ringRef.current) { ringRef.current.setMap(null); ringRef.current = null; }
    if (origin) {
      originRef.current = new g.maps.Marker({
        position: { lat: origin.lat, lng: origin.lng }, map,
        icon: originIcon(g), title: origin.name, zIndex: 30,
      });
      if (radius) {
        ringRef.current = new g.maps.Circle({
          map, center: { lat: origin.lat, lng: origin.lng }, radius: radius * 1609.34,
          strokeColor: "#c9a35f", strokeOpacity: 0.7, strokeWeight: 1.5,
          fillColor: "#d9b779", fillOpacity: 0.05,
        });
      }
    }

    if (sel) return;   // the selection effect owns the viewport while a place is open

    const b = new g.maps.LatLngBounds();
    let n = 0;
    if (origin) { b.extend({ lat: origin.lat, lng: origin.lng }); n++; }
    shown.forEach((p) => { b.extend({ lat: p.lat, lng: p.lng }); n++; });
    if (n > 1) map.fitBounds(b, 60);
    else if (n === 1) { map.setCenter(b.getCenter()); map.setZoom(8); }
  }, [shown.map((p) => p.key).join(","), picked, origin, radius, mapOk, sel, verdicts]);

  /* ---- the opened place: zoom in, and draw what's around it ---------------
     Opening a park moves the map to that park and puts its trails, campgrounds,
     lakes and gateway towns on it. The active tab drives which kinds show, so the
     list and the map are always describing the same thing; Overview shows all of
     them. This draws the data the detail panel already fetched — nothing extra is
     requested for the map. */
  /* ---- live location ------------------------------------------------------
     Distinct from the search origin: the origin is "where I'm searching from"
     and doesn't move, this is "where I am right now" and does. watchPosition is
     cleared on unmount so the page can't leave the GPS polling in the background. */
  const [liveOn, setLiveOn] = useState(false);
  const [liveErr, setLiveErr] = useState("");
  const liveRef = useRef({ watch: null, marker: null });
  useEffect(() => () => {
    if (liveRef.current.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(liveRef.current.watch);
    if (liveRef.current.marker) liveRef.current.marker.setMap(null);
  }, []);

  const toggleLive = () => {
    const g = typeof window !== "undefined" ? window.google : null;
    const map = mapRef.current;
    if (liveOn) {
      if (liveRef.current.watch != null) navigator.geolocation.clearWatch(liveRef.current.watch);
      liveRef.current.watch = null;
      if (liveRef.current.marker) { liveRef.current.marker.setMap(null); liveRef.current.marker = null; }
      setLiveOn(false); setLiveErr("");
      return;
    }
    if (!navigator.geolocation) { setLiveErr("This browser can't share a location."); return; }
    setLiveErr(""); setLiveOn(true);
    let framed = false;
    liveRef.current.watch = navigator.geolocation.watchPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!g || !map) return;
        if (!liveRef.current.marker) {
          liveRef.current.marker = new g.maps.Marker({
            position: at, map, zIndex: 60, title: "You are here",
            icon: { url: "data:image/svg+xml;utf8," +
              "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'>" +
              "<circle cx='11' cy='11' r='9' fill='%232c7a9e' fill-opacity='.28'/>" +
              "<circle cx='11' cy='11' r='5' fill='%234aa8d8' stroke='%23fffdf7' stroke-width='2'/></svg>",
              scaledSize: new g.maps.Size(22, 22), anchor: new g.maps.Point(11, 11) },
          });
        } else liveRef.current.marker.setPosition(at);
        // Frame once, then stay out of the way — re-centring on every fix fights
        // anyone trying to pan.
        if (!framed) { framed = true; map.panTo(at); if (map.getZoom() < 9) map.setZoom(9); }
      },
      (err) => {
        setLiveOn(false);
        setLiveErr(err && err.code === 1
          ? "Location access was denied — you can allow it in your browser's site settings."
          : "Couldn't get a location fix.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const nearbyRef = useRef([]);
  const infoRef = useRef(null);
  useEffect(() => {
    const g = typeof window !== "undefined" ? window.google : null;
    const map = mapRef.current;
    if (!g || !map) return;

    nearbyRef.current.forEach((m) => m.setMap(null));
    nearbyRef.current = [];
    if (infoRef.current) infoRef.current.close();
    if (!sel) return;
    if (!infoRef.current) infoRef.current = new g.maps.InfoWindow();

    const kinds = ["trails", "camping", "water", "towns"];
    const active = kinds.indexOf(detailTab) > -1 ? [detailTab] : kinds;
    const b = new g.maps.LatLngBounds();
    b.extend({ lat: sel.lat, lng: sel.lng });
    let n = 0;

    // Everything found gets drawn, but only what's close decides the frame.
    // Acadia returns 99 gateway towns, the farthest ~90 miles out, and fitting to
    // all of them zooms so far back that the park itself is a speck — the opposite
    // of opening a place. Anything further out is still on the map, just off the
    // edge until you pan.
    const FRAME_MI = 30;
    const inFrame = (lat, lng) => milesBetween({ lat: sel.lat, lng: sel.lng }, { lat, lng }) <= FRAME_MI;

    const open = (anchorOrLatLng, title, sub, extra) => {
      infoRef.current.setContent(
        '<div style="font-family:system-ui,sans-serif;max-width:230px;color:#12261b">' +
        '<b>' + esc(title) + '</b>' +
        (sub ? '<div style="font-size:12px;color:#4a5a50;margin-top:3px">' + esc(sub) + '</div>' : "") +
        (extra || "") + '</div>'
      );
      // A marker anchors the bubble; a click on a polyline has no marker, only the
      // latlng where the line was hit.
      if (anchorOrLatLng instanceof g.maps.Marker) infoRef.current.open({ map, anchor: anchorOrLatLng });
      else { infoRef.current.setPosition(anchorOrLatLng); infoRef.current.open(map); }
    };

    active.forEach((kind) => {
      // /api/trails returns geometry, not a point — trails have no lat/lng at all,
      // so they're drawn as lines below rather than as dots that would never appear.
      if (kind === "trails") return;
      (nearby[kind] || []).forEach((it) => {
        const lat = Number(it.lat), lng = Number(it.lng);
        if (!isFinite(lat) || !isFinite(lng) || (!lat && !lng)) return;
        const name = it.bareName || it.name || "Unnamed";
        const m = new g.maps.Marker({
          position: { lat, lng }, map, icon: dotIcon(g, kind), zIndex: 5,
          title: name + " · " + NEARBY_LABEL[kind],
        });
        m.addListener("click", () => {
          setDetailTab(kind);
          // A campground you can actually book is worth a link straight to the
          // booking page; everything else just says what it is.
          const extra = kind === "camping" && it.reservable && it.id
            ? '<div style="margin-top:7px"><a href="https://www.recreation.gov/camping/campgrounds/' +
              encodeURIComponent(it.id) + '" target="_blank" rel="noopener" style="font-size:12px">Book on Recreation.gov →</a></div>'
            : kind === "towns" && it.distanceMi != null
            ? '<div style="margin-top:7px"><a href="/book?cat=stays" style="font-size:12px">Find stays →</a></div>'
            : "";
          open(m, name, subFor(kind, it, sel), extra);
        });
        nearbyRef.current.push(m);
        if (inFrame(lat, lng)) { b.extend({ lat, lng }); n++; }
      });
    });

    // Trails are lines, not points — drawn in the legacy colour for their category
    // so a footpath, a 4x4 route and a ski route stay distinguishable.
    if (detailTab === "overview" || detailTab === "trails") {
      (nearby.trails || []).forEach((t) => {
        // The feed gives [lat, lng] pairs, which Google's Polyline does not accept —
        // it wants {lat, lng}. Passing the raw pairs draws a silently empty line.
        const path = (Array.isArray(t.path) ? t.path : [])
          .map((q) => (Array.isArray(q) ? { lat: Number(q[0]), lng: Number(q[1]) } : q))
          .filter((q) => q && isFinite(q.lat) && isFinite(q.lng));
        if (path.length < 2) return;
        const line = new g.maps.Polyline({
          path, map, strokeColor: TRAIL_STYLE[t.cat] || TRAIL_STYLE.hiking,
          strokeOpacity: 0.95, strokeWeight: 4, zIndex: 8, clickable: true,
        });
        line.addListener("click", (e) => {
          setDetailTab("trails");
          open(e.latLng, t.name || "Trail", subFor("trails", t, sel), "");
        });
        nearbyRef.current.push(line);
        path.forEach((q) => { if (inFrame(q.lat, q.lng)) { b.extend(q); n++; } });
      });
    }

    if (n) map.fitBounds(b, 70);
    else { map.setCenter({ lat: sel.lat, lng: sel.lng }); map.setZoom(10); }
  }, [sel, detailTab, nearby, mapOk]);

  /* ---- the park's real boundary ------------------------------------------
     A national park is an area, not a pin. The NPS publishes each unit's
     boundary as topojson; drawing it is the difference between "somewhere
     around here" and the actual shape of the place. Cached per unit code, and
     it never tightens the view — a boundary fit would push the campgrounds and
     trails just drawn above off-screen, so it only widens if the park is
     bigger than what's on screen. */
  const boundaryRef = useRef({ cache: {}, feats: [] });
  useEffect(() => {
    const g = typeof window !== "undefined" ? window.google : null;
    const map = mapRef.current;
    if (!g || !map) return;
    let dead = false;

    boundaryRef.current.feats.forEach((f) => { try { map.data.remove(f); } catch {} });
    boundaryRef.current.feats = [];
    if (!sel || !sel.npsCode) return;

    (async () => {
      const code = sel.npsCode;
      let geo = boundaryRef.current.cache[code];
      if (geo === undefined) {
        let transient = false;
        try {
          await loadScript("https://unpkg.com/topojson-client@3/dist/topojson-client.min.js", "pb-x-topojson");
          // loadScript resolves as soon as the tag exists, which can be before the
          // library has evaluated. Waiting on the global is what actually tells us
          // it's usable.
          for (let i = 0; i < 40 && !window.topojson; i++) await new Promise((r2) => setTimeout(r2, 50));
          if (!window.topojson) throw new Error("topojson unavailable");
          const r = await fetch(BOUNDARY_URL(code));
          const topo = r.ok ? await r.json() : null;
          if (topo && topo.objects) {
            const k = Object.keys(topo.objects)[0];
            geo = k ? window.topojson.feature(topo, topo.objects[k]) : null;
          } else geo = null;   // this park genuinely has no published boundary
        } catch { geo = null; transient = true; }
        // Cache a real "no boundary" answer, never a transient failure — caching
        // the latter would mean one flaky load permanently blanks this park.
        if (!transient) boundaryRef.current.cache[code] = geo;
      }
      if (dead || !geo || !mapRef.current) return;

      const feats = map.data.addGeoJson(geo);
      map.data.setStyle({ strokeColor: "#1d4a37", strokeWeight: 2, fillColor: "#3f7a4a", fillOpacity: 0.22 });
      boundaryRef.current.feats = feats;

      const bb = new g.maps.LatLngBounds();
      feats.forEach((f) => f.getGeometry().forEachLatLng((ll) => bb.extend(ll)));
      const cur = map.getBounds();
      if (!bb.isEmpty() && cur && !cur.contains(bb.getNorthEast()) && !cur.contains(bb.getSouthWest())) {
        map.fitBounds(bb, 90);
      }
    })();

    return () => { dead = true; };
  }, [sel, mapOk]);

  /* ---- add to trip ---- */
  const addToTrip = () => {
    const chosen = shown.filter((p) => picked.has(p.key));
    if (!chosen.length) return;
    const existing = getStops();
    const have = new Set(existing.map((s) => s.name));
    const fresh = chosen.filter((p) => !have.has(p.name)).map((p) => {
      const s = { name: p.name, nights: 2, lat: p.lat, lng: p.lng, state: p.state };
      if (p.type === "national_forest") s.kind = "forest";
      if (p.type === "state_park") s.custom = true;
      return s;
    });
    setStops(existing.concat(fresh));
    const dupes = chosen.length - fresh.length;
    say(fresh.length
      ? "Added " + fresh.length + " to your trip" + (dupes ? " · " + dupes + " already there" : "")
      : "Already in your trip");
    setPicked(new Set());
  };

  const toggle = (k) => setPicked((prev) => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n;
  });

  const activeFilters =
    (stateFilter ? 1 : 0) +
    (origin && radius !== 100 ? 1 : 0) +
    ((!conds.go || !conds.prepare || !conds.hold) ? 1 : 0) +
    (!catsAreDefault(cats) ? 1 : 0);

  const states = useMemo(
    () => Array.from(new Set(places.map((p) => p.state).filter(Boolean))).sort(),
    [places]
  );

  /* ------------------------------------------------------------------ view */
  return (
    <div ref={themeRef} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader active="explore" tripCount={tripCount} acctSlot />
      <div style={{ display: "flex", height: "100vh", paddingTop: topPad, boxSizing: "border-box" }}>

        {/* ─────────────────────────────── panel */}
        <section style={phone
          ? { width: "100%", flex: "none", display: phoneView === "list" ? "flex" : "none",
              flexDirection: "column", background: "var(--pb-surface)", position: "relative" }
          : { width: 700, maxWidth: "50vw", flex: "none", display: "flex", flexDirection: "column",
              background: "var(--pb-surface)", borderRight: "1px solid var(--pb-line)", position: "relative" }}>

          {sel ? (
            <PlaceDetail place={sel} origin={origin} onBack={() => setSel(null)} resultCount={results.length}
              tab={detailTab} onTab={setDetailTab} onNearby={setNearby}
              vfull={verdicts[sel.name + ":full"]} isDay={verdicts[sel.name + ":day"]} />
          ) : (
            <>
              <Header
                query={query} setQuery={setQuery} sugg={sugg} onPick={pickPlace} onSubmit={searchGeo}
                geocoding={geocoding} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen}
                activeFilters={activeFilters} cats={cats} setCats={setCats} catCounts={catCounts}
                origin={origin} setOrigin={setOrigin} radius={radius} setRadius={setRadius}
                onMyLocation={useMyLocation}
                conds={conds} setConds={setConds} states={states}
                stateFilter={stateFilter} setStateFilter={setStateFilter}
                count={results.length} stateName={stateFilter} phone={phone}
              />

              <div style={{ flex: 1, overflowY: "auto",
                padding: phone ? "0 16px " + (barH + 96) + "px" : "0 24px 120px" }}>
                {dataErr && <Notice text={dataErr} />}
                {dataNote && <Notice text={dataNote} quiet />}
                {!dataErr && !places.length && <Notice text="Loading places…" quiet />}
                {!!places.length && !results.length && (
                  <Notice text={origin
                    ? "Nothing within " + radius + " mi of " + origin.name + ". Widen the distance, or turn a category back on."
                    : "No places match those filters."} />
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                  {shown.map((p, i) => (
                    <PlaceCard key={p.key} p={p} n={i + 1} origin={origin}
                      verdict={verdicts[p.name]} vfull={verdicts[p.name + ":full"]}
                      alerts={verdicts[p.name + ":alerts"]} isDay={verdicts[p.name + ":day"]}
                      picked={picked.has(p.key)} onToggle={() => toggle(p.key)} onOpen={() => setSel(p)} />
                  ))}
                </div>
                {results.length > shown.length && (
                  <div style={{ textAlign: "center", marginTop: 20 }}>
                    <button onClick={() => setLimit((n) => n + 24)} style={{ ...pillBtn, padding: "12px 22px" }}>
                      Show {Math.min(24, results.length - shown.length)} more
                    </button>
                    <div style={{ ...micro, marginTop: 9 }}>
                      Showing {shown.length} of {results.length}
                    </div>
                  </div>
                )}
              </div>

              {picked.size > 0 && (
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 24px 18px",
                  background: "var(--pb-glass-strong)", borderTop: "1px solid var(--pb-line)", backdropFilter: "blur(14px)" }}>
                  <button onClick={addToTrip} style={goldBtn}>Add {picked.size} to Trip Studio</button>
                  <div style={{ textAlign: "center", fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 7 }}>
                    Your trip has {tripCount} stop{tripCount === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </>
          )}

          {flash && (
            <div role="status" style={{ position: "absolute", left: 24, right: 24, bottom: picked.size ? 108 : 24,
              padding: "11px 14px", borderRadius: 12, background: "var(--pb-surface-2)",
              border: "1px solid var(--pb-gold-2)", fontSize: ".84rem" }}>{flash}</div>
          )}
        </section>

        {/* ─────────────────────────────── map */}
        <section style={phone
          ? { flex: 1, position: "relative", background: "var(--pb-bg-2)", display: phoneView === "map" ? "block" : "none" }
          : { flex: 1, position: "relative", background: "var(--pb-bg-2)" }}>
          <div ref={mapEl} style={{ position: "absolute", inset: 0 }} />
          {mapOk === false && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", padding: 40, textAlign: "center", color: "var(--pb-muted)", fontSize: ".9rem" }}>
              The map needs a Google Maps key. Everything on the left still works —
              search, filters, distances and adding to a trip.
            </div>
          )}
          {origin && mapOk && (
            <div style={{ position: "absolute", left: 20, top: 20, padding: "8px 12px", borderRadius: 9,
              background: "var(--pb-glass-strong)", border: "1px solid var(--pb-gold-2)",
              fontSize: ".76rem", fontWeight: 600, color: "var(--pb-gold)" }}>
              {origin.name}{radius ? " · " + radius + " mi" : ""}
            </div>
          )}

          {mapOk && (
            <>
              {/* What the pin colours mean. Without this the ring is just decoration. */}
              <div style={{ position: "absolute", left: 20, bottom: 20, padding: "10px 13px", borderRadius: 12,
                background: "var(--pb-glass-strong)", border: "1px solid var(--pb-line)", backdropFilter: "blur(8px)" }}>
                <div style={{ ...micro, marginBottom: 7 }}>Today&rsquo;s call</div>
                <div style={{ display: "flex", gap: 13 }}>
                  {[["--pb-go", "Go"], ["--pb-prepare", "Prepare"], ["--pb-hold", "Hold off"]].map(([v, label]) => (
                    <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: ".72rem", color: "var(--pb-ink)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, border: "2px solid var(--" + v.slice(2) + ")" }} />
                      {label}
                    </span>
                  ))}
                </div>
                {sel && (
                  <div style={{ display: "flex", gap: 13, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--pb-line)" }}>
                    {[["trails", "Trails"], ["camping", "Camping"], ["water", "Water"], ["towns", "Towns"]].map(([k, label]) => (
                      <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: ".72rem", color: "var(--pb-muted)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999,
                          background: decodeURIComponent(NEARBY_STYLE[k].c) }} />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: "absolute", right: 20, bottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={toggleLive} title="Follow my location"
                  style={{ ...mapCtl, color: liveOn ? "#4aa8d8" : "var(--pb-ink)",
                    borderColor: liveOn ? "#4aa8d8" : "var(--pb-line-strong)" }}>◉</button>
                <button title="Back to the whole country"
                  onClick={() => { setSel(null); const m = mapRef.current; if (m) { m.setCenter({ lat: 39.5, lng: -98.5 }); m.setZoom(4); } }}
                  style={mapCtl}>⌂</button>
              </div>

              {liveErr && (
                <div style={{ position: "absolute", right: 20, bottom: 96, maxWidth: 230, padding: "9px 12px",
                  borderRadius: 10, background: "var(--pb-glass-strong)", border: "1px solid var(--pb-line)",
                  fontSize: ".74rem", color: "var(--pb-muted)" }}>{liveErr}</div>
              )}
            </>
          )}
        </section>
      </div>

      {/* On a phone the two halves are one at a time, so there has to be a way
          back to the other one. Hidden entirely on desktop, where both show. */}
      {phone && (
        <button
          onClick={() => setPhoneView((v) => (v === "list" ? "map" : "list"))}
          style={{ position: "fixed", left: "50%", bottom: barH + 16, transform: "translateX(-50%)",
            zIndex: 40, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 20px", borderRadius: 999, border: "1px solid var(--pb-line-strong)",
            background: "var(--pb-glass-strong)", backdropFilter: "blur(10px)",
            color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".86rem",
            boxShadow: "0 6px 22px rgba(0,0,0,.28)" }}>
          {phoneView === "list" ? "◉  Map" : "☰  List"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ header */
function Header(props) {
  const { query, setQuery, sugg, onPick, onSubmit, geocoding, filtersOpen, setFiltersOpen,
    activeFilters, cats, setCats, catCounts, origin, setOrigin, radius, setRadius, onMyLocation,
    conds, setConds, states, stateFilter, setStateFilter, count, stateName, phone } = props;

  return (
    <div style={{ padding: phone ? "12px 14px 8px" : "20px 24px 14px", position: "relative", flex: "none" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            placeholder="Search a town, ZIP, park or address"
            style={{ width: "100%", boxSizing: "border-box", background: "var(--pb-tint)",
              border: "1px solid " + (origin ? "var(--pb-gold-2)" : "var(--pb-line-strong)"),
              borderRadius: 999, padding: "12px 16px", color: "var(--pb-ink)",
              fontFamily: "var(--pb-sans)", fontSize: ".88rem", outline: "none" }} />
          {!!sugg.length && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
              background: "var(--pb-glass-strong)", border: "1px solid var(--pb-line-strong)",
              borderRadius: 14, overflow: "hidden", backdropFilter: "blur(14px)" }}>
              {sugg.map((s) => s.href ? (
                // Gateway towns are PAGES — a pick goes to the town guide, not
                // the map anchor (owner call 2026-07-22: towns clickable from
                // anywhere).
                <a key={"town:" + s.href} href={s.href}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "left", cursor: "pointer",
                    padding: "10px 14px", background: "transparent", textDecoration: "none",
                    borderBottom: "1px solid var(--pb-line)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
                  <div style={{ fontSize: ".87rem", fontWeight: 600 }}>🏘 {s.label}</div>
                  <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 1 }}>{s.sub}</div>
                </a>
              ) : (
                <button key={s.label} onClick={() => onPick(s.place)}
                  style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                    padding: "10px 14px", background: "transparent", border: "none",
                    borderBottom: "1px solid var(--pb-line)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
                  <div style={{ fontSize: ".87rem", fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 1 }}>{s.sub}</div>
                </button>
              ))}
              <button onClick={onSubmit} style={{ display: "block", width: "100%", textAlign: "left",
                cursor: "pointer", padding: "10px 14px", background: "transparent", border: "none",
                color: "var(--pb-gold)", fontFamily: "var(--pb-sans)", fontSize: ".8rem", fontWeight: 600 }}>
                {geocoding ? "Searching…" : "Search “" + query + "” as a place or ZIP →"}
              </button>
            </div>
          )}
        </div>
        {/* The door to the Filters panel: an icon docked to the search bar,
            where every search UI keeps it. The badge is the only state it
            carries — the chips below say WHAT is applied, this says how many. */}
        <button onClick={() => setFiltersOpen((v) => !v)} aria-label="Filters"
          style={{ position: "relative", cursor: "pointer", flex: "none",
            width: 44, height: 44, borderRadius: 999,
            background: "var(--pb-tint)", display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid " + (filtersOpen || activeFilters > 0 ? "var(--pb-gold-2)" : "var(--pb-line-strong)") }}>
          <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
            <g stroke="var(--pb-gold)" strokeWidth="1.6" strokeLinecap="round">
              <line x1="1.5" y1="4" x2="15.5" y2="4" />
              <line x1="1.5" y1="8.5" x2="15.5" y2="8.5" />
              <line x1="1.5" y1="13" x2="15.5" y2="13" />
            </g>
            <g fill="var(--pb-gold)">
              <circle cx="11" cy="4" r="2.2" />
              <circle cx="5.5" cy="8.5" r="2.2" />
              <circle cx="12.5" cy="13" r="2.2" />
            </g>
          </svg>
          {activeFilters > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17,
              borderRadius: 999, background: "var(--pb-grad-gold)", color: "var(--pb-bg)",
              fontFamily: "var(--pb-mono)", fontSize: ".6rem", display: "flex", alignItems: "center",
              justifyContent: "center", padding: "0 4px", border: "1.5px solid var(--pb-bg)" }}>{activeFilters}</span>
          )}
        </button>
      </div>

      {/* Every filter lives in the panel; this row only REPORTS — Near me,
          then a removable chip per active selection. When it has nothing to
          say it doesn't render, so the untouched header is search + icon. */}
      {(!origin || activeFilters > 0) && (
      <div style={phone
        // One line that scrolls sideways on a phone; the negative margins
        // bleed the scroll area to the panel edges so a chip peeking
        // off-screen reads as "scroll me" instead of clipping mid-pill.
        ? { display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", alignItems: "center",
            margin: "10px -14px 0", padding: "0 14px 2px",
            WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }
        : { display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        {!origin && (
          <button onClick={onMyLocation} style={{ ...pillBtn, fontSize: ".78rem" }}>
            ◎ Near me
          </button>
        )}
        {/* one chip per selection, each removable */}
        {!catsAreDefault(cats) && (
          <AppliedChip onClear={() => setCats(DEFAULT_CATS)}>
            {CATS.filter((c) => cats[c.key]).map((c) => c.label).join(" · ") || "No types"}
          </AppliedChip>
        )}
        {stateFilter && (
          <AppliedChip onClear={() => setStateFilter("")}>{stateFilter}</AppliedChip>
        )}
        {origin && radius && !stateFilter && (
          <AppliedChip onClear={() => setRadius(null)}>within {radius} mi</AppliedChip>
        )}
        {Object.values(conds).some((v) => !v) && (
          <AppliedChip onClear={() => setConds({ go: true, prepare: true, hold: true })}>
            hiding {[["go", "good"], ["prepare", "prepare"], ["hold", "hold"]].filter(([k]) => !conds[k]).map(([, l]) => l).join(" + ")}
          </AppliedChip>
        )}
      </div>
      )}

      {/* the pinpoint — a status banner, not a filter, so it keeps its row */}
      {origin && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, padding: "8px 12px",
          borderRadius: 999, background: "var(--pb-surface-2)", border: "1px solid var(--pb-gold-2)" }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, border: "2.5px solid var(--pb-gold)", flex: "none" }} />
          <span style={{ flex: 1, fontSize: ".8rem", fontWeight: 600 }}>Searching from {origin.name}</span>
          <span style={{ ...micro, letterSpacing: ".08em" }}>
            {stateName ? "distance sorts only" : radius ? "within " + radius + " mi" : "any distance"}
          </span>
          <button onClick={() => setOrigin(null)} aria-label="Clear location"
            style={{ cursor: "pointer", background: "none", border: "none", color: "var(--pb-muted)", fontSize: ".9rem" }}>✕</button>
        </div>
      )}

      {/* On the phone the two-line headline collapses to one quiet line —
          the count is orientation, not a heading, and vertical space is the
          scarcest thing on that screen. */}
      {phone ? (
        <div style={{ ...micro, marginTop: 10 }}>
          {count} PLACE{count === 1 ? "" : "S"}
          {stateName ? " IN " + stateName : origin ? " NEAR " + origin.name.toUpperCase() : " — A–Z"}
          {!stateName && origin && radius ? " · WITHIN " + radius + " MI" : ""}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--pb-serif)", fontSize: "1.3rem", fontWeight: 300 }}>
              {count} place{count === 1 ? "" : "s"}
              {stateName ? " in " + stateName : origin ? " near " + origin.name : ""}
            </div>
            <div style={{ ...micro, marginTop: 3 }}>
              {stateName
                ? (origin ? "THE WHOLE STATE — SORTED FROM " + origin.name.toUpperCase() : "THE WHOLE STATE")
                : origin && radius ? "WITHIN " + radius + " MI"
                : "ALPHABETICAL — SEARCH A PLACE TO SORT BY DISTANCE"}
            </div>
          </div>
        </div>
      )}

      {filtersOpen && (
        <FilterPopover
          onClose={() => setFiltersOpen(false)}
          cats={cats} setCats={setCats} catCounts={catCounts}
          conds={conds} setConds={setConds}
          states={states} stateFilter={stateFilter} setStateFilter={setStateFilter}
          origin={origin} radius={radius} setRadius={setRadius}
          onReset={() => {
            setCats(DEFAULT_CATS);
            setConds({ go: true, prepare: true, hold: true }); setStateFilter(""); setRadius(100);
          }}
          count={count}
        />
      )}
    </div>
  );
}

function FilterPopover({ onClose, cats, setCats, catCounts, conds, setConds, states, stateFilter, setStateFilter, origin, radius, setRadius, onReset, count }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div style={{ position: "absolute", top: 66, right: 24, width: 340, maxWidth: "calc(100vw - 32px)", zIndex: 41,
        background: "var(--pb-glass-strong)", border: "1px solid var(--pb-line-strong)",
        borderRadius: 16, padding: "4px 0 16px", backdropFilter: "blur(18px)",
        maxHeight: "72vh", overflowY: "auto",
        boxShadow: "0 18px 44px -18px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 12px" }}>
          <b style={{ fontSize: ".95rem" }}>Filters</b>
          <button onClick={onReset} style={{ cursor: "pointer", background: "none", border: "none",
            color: "var(--pb-gold)", fontSize: ".78rem", fontWeight: 600 }}>Reset</button>
        </div>

        {/* Place type lives here with everything else now — the bar outside
            only reports selections. Counts stay: subtraction should be
            legible while you're doing it. */}
        <div style={{ ...micro, padding: "10px 16px 8px" }}>Place type</div>
        <div style={{ display: "flex", gap: 6, padding: "0 16px", flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <Chip key={c.key} on={cats[c.key]} onClick={() => setCats((s) => ({ ...s, [c.key]: !s[c.key] }))}
              count={catCounts[c.key]}>
              {c.label}
            </Chip>
          ))}
        </div>

        <div style={{ ...micro, padding: "14px 16px 8px" }}>Today&rsquo;s conditions</div>
        <div style={{ display: "flex", gap: 6, padding: "0 16px", flexWrap: "wrap" }}>
          {[["go", "Good", "var(--pb-go)"], ["prepare", "Prepare", "var(--pb-prepare)"], ["hold", "Hold", "var(--pb-hold)"]].map(([k, label, c]) => (
            <Chip key={k} on={conds[k]} onClick={() => setConds((s) => ({ ...s, [k]: !s[k] }))} dot={c}>{label}</Chip>
          ))}
        </div>
        <div style={{ ...micro, padding: "6px 16px 0", textTransform: "none", letterSpacing: 0, fontSize: ".68rem" }}>
          Places we haven&rsquo;t checked yet always stay visible.
        </div>

        <div style={{ ...micro, padding: "14px 16px 8px" }}>State</div>
        <div style={{ padding: "0 16px" }}>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
            style={{ width: "100%", background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)",
              borderRadius: 11, padding: "11px 12px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)",
              fontSize: ".85rem", outline: "none" }}>
            <option value="">Anywhere</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ ...micro, padding: "14px 16px 8px" }}>
          {origin ? "Distance from " + origin.name : "Distance"}
        </div>
        {stateFilter && (
          <div style={{ padding: "0 16px 8px", fontSize: ".76rem", color: "var(--pb-muted)", lineHeight: 1.5 }}>
            Showing all of {stateFilter}. Distance sorts the list but doesn&rsquo;t limit it —
            clear the state to search by radius again.
          </div>
        )}
        {origin ? (
          <div style={{ display: "flex", gap: 6, padding: "0 16px", flexWrap: "wrap" }}>
            {[50, 100, 200, null].map((r) => (
              <Chip key={String(r)} on={radius === r} onClick={() => setRadius(r)}>{r ? r + " mi" : "Any"}</Chip>
            ))}
          </div>
        ) : (
          <div style={{ padding: "0 16px", fontSize: ".78rem", color: "var(--pb-muted)", lineHeight: 1.5 }}>
            Search a town, ZIP or park first — distance needs somewhere to measure from.
          </div>
        )}

        <div style={{ padding: "16px 16px 0" }}>
          <button onClick={onClose} style={goldBtn}>Show {count} place{count === 1 ? "" : "s"}</button>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- place card */
function PlaceCard({ p, n, origin, verdict, vfull, alerts, isDay, picked, onToggle, onOpen }) {
  const ref = useRef(null);
  const q = p.type === "national_park" ? p.name + " National Park|" + p.name : p.name;
  const photo = usePhoto(q, p.lat, p.lng, ref, 700);
  const dist = origin ? milesBetween(origin, p) : null;
  const vcol = verdict === "go" ? "var(--pb-go)" : verdict === "prepare" ? "var(--pb-prepare)" : verdict === "hold" ? "var(--pb-hold)" : "var(--pb-muted)";
  const access = roadAccessNote(p.name);

  return (
    <div ref={ref} style={{ borderRadius: 16, overflow: "hidden",
      background: picked ? "var(--pb-surface-2)" : "var(--pb-tint)",
      border: "1px solid " + (picked ? "var(--pb-gold-2)" : "var(--pb-line)") }}>
      <button onClick={onOpen} style={{ display: "block", width: "100%", padding: 0, border: "none",
        background: "var(--pb-surface-2)", cursor: "pointer", position: "relative", aspectRatio: "16/9" }}>
        {photo && photo.url
          ? <img src={photo.url} alt={p.name} loading="lazy"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }} />}
        <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.05) 45%,rgba(9,24,16,.8) 100%)" }} />
        <span style={{ position: "absolute", left: 12, top: 12, width: 26, height: 26, borderRadius: 999,
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--pb-mono)",
          fontSize: ".68rem", background: picked ? "var(--pb-grad-gold)" : "var(--pb-glass-strong)",
          color: picked ? "var(--pb-bg)" : "var(--pb-ink-2)",
          border: picked ? "none" : "1px solid var(--pb-line-strong)" }}>{n}</span>

        {/* Temperature, big, where the eye lands — carried over from the old tile. */}
        {vfull && (
          <span style={{ position: "absolute", right: 10, top: 10, display: "inline-flex",
            alignItems: "center", gap: 7, padding: "5px 10px 5px 8px", borderRadius: 999,
            background: "rgba(8,19,13,.62)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(217,183,121,.22)" }}>
            {vfull.temp != null && (
              <span style={{ fontFamily: "var(--pb-serif)", fontSize: "1.15rem", color: "#f7f4ec", lineHeight: 1 }}>
                {Math.round(vfull.temp)}°
              </span>
            )}
          </span>
        )}

        {/* You cannot drive to eight of the national parks. Say so before someone
            plans a road trip to one — this is the Alaska/island signal. */}
        {access && (
          <span title={access.text} style={{ position: "absolute", left: 12, top: 44,
            display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999,
            fontFamily: "var(--pb-mono)", fontSize: ".56rem", fontWeight: 700, letterSpacing: ".06em",
            textTransform: "uppercase", color: "var(--pb-hold)", background: "var(--pb-glass-strong)",
            border: "1px solid color-mix(in srgb, var(--pb-hold) 55%, transparent)" }}>
            ✈ {access.level === "none" ? "No road" : "Ltd road"}
          </span>
        )}
        {/* the perishable fact, on the photo */}
        <span style={{ position: "absolute", left: 12, bottom: 12, display: "inline-flex", alignItems: "center",
          gap: 6, padding: "5px 9px", borderRadius: 999, background: "var(--pb-glass-strong)",
          fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".06em", color: vcol }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: vcol }} />
          {verdict ? (vfull ? vfull.word : verdict.toUpperCase()) : "CHECKING TODAY…"}
        </span>
      </button>

      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onToggle} aria-pressed={picked} aria-label={(picked ? "Deselect " : "Select ") + p.name}
            style={{ cursor: "pointer", flex: "none", width: 20, height: 20, borderRadius: "50%",
              background: picked ? "var(--pb-grad-gold)" : "transparent",
              border: picked ? "none" : "1.5px solid var(--pb-line-strong)",
              color: "var(--pb-bg)", fontSize: ".62rem", fontWeight: 800, lineHeight: 1 }}>{picked ? "✓" : ""}</button>
          <button onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer",
            background: "none", border: "none", padding: 0, color: "var(--pb-ink)",
            fontFamily: "var(--pb-serif)", fontWeight: 500, fontSize: "1.25rem", lineHeight: 1.1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</button>
          <SaveButton variant="bare" size={26} place={{
            kind: p.type === "national_park" ? "park" : p.type === "national_forest" ? "forest" : "statePark",
            name: p.name, ref: p.id || p.state, state: p.state, lat: p.lat, lng: p.lng,
            sub: TYPE_LABEL[p.type], href: p.href || "",
          }} />
        </div>
        <div style={{ fontSize: ".76rem", color: "var(--pb-ink-2)", marginTop: 5 }}>
          {p.sub || TYPE_LABEL[p.type]}{(p.stateLabel || p.state) ? " · " + (p.stateLabel || p.state) : ""}
          {dist != null && isFinite(dist)
            ? " · " + (dist < 1 ? "under a mile" : Math.round(dist) + " mi from " + origin.name)
            : ""}
        </div>

        {/* ── active alerts. Loudest thing on the card when there are any,
              because it's the one fact that can change the plan. ── */}
        {alerts && alerts.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 9,
            padding: "7px 9px", borderRadius: 9,
            background: "color-mix(in srgb, var(--pb-hold) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pb-hold) 45%, transparent)" }}>
            <span aria-hidden="true" style={{ color: "var(--pb-hold)", fontSize: ".8rem", lineHeight: 1.3 }}>⚠</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: ".74rem", lineHeight: 1.35, color: "var(--pb-ink)" }}>
              <b style={{ fontWeight: 600 }}>{alerts[0].event}</b>
              {alerts.length > 1 && (
                <span style={{ color: "var(--pb-muted)" }}> + {alerts.length - 1} more</span>
              )}
            </span>
          </div>
        )}

        {/* ── today's weather, and the reasons behind the verdict.
              All of this already came back with the verdict — it was being
              thrown away and only the headline word rendered. ── */}
        {vfull && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {conditionFromSky(vfull.sky) && (
                <WeatherChip condition={conditionFromSky(vfull.sky)} temp={vfull.temp} />
              )}
              <span style={{ ...micro, letterSpacing: ".06em" }}>
                {[vfull.sky || null, vfull.wind ? vfull.wind + " mph wind" : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            {!!(vfull.chips && vfull.chips.length) && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                {vfull.chips.slice(0, 3).map((c, i) => (
                  <span key={i} style={{ fontSize: ".68rem", padding: "3px 8px", borderRadius: 999,
                    background: "var(--pb-surface-2)", border: "1px solid var(--pb-line)",
                    color: c.pos ? "var(--pb-go)" : "var(--pb-ink-2)" }}>{c.t}</span>
                ))}
              </div>
            )}
          </>
        )}
        {alerts === null && (
          <div style={{ ...micro, marginTop: 8, letterSpacing: ".06em" }}>Alerts unavailable</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ place detail */
const IN_PLACE = [
  { key: "overview", label: "Overview" },
  { key: "about", label: "About" },
  { key: "trails", label: "Trails" },
  { key: "camping", label: "Camping" },
  { key: "water", label: "Water" },
  { key: "towns", label: "Towns" },
];

function PlaceDetail({ place, origin, onBack, resultCount, vfull, isDay, tab, onTab, onNearby }) {
  const setTab = onTab;
  // Picking a trail opens a sub-view inside the panel rather than navigating
  // away, so you keep the park you were looking at.
  const [trail, setTrail] = useState(null);
  useEffect(() => { setTrail(null); }, [place.key, tab]);
  const [data, setData] = useState({});      // { trails, camping, water, conditions }
  const [err, setErr] = useState({});
  const heroRef = useRef(null);
  const q = place.type === "national_park" ? place.name + " National Park|" + place.name : place.name;
  const photo = usePhoto(q, place.lat, place.lng, null, 1200);

  // Everything here is a live third-party call, so it only runs now — one place,
  // on demand. Each section fails on its own and says so.
  useEffect(() => {
    let dead = false;
    // Every one of these is a third-party call, so each gets a deadline. Without
    // one, a slow source leaves its chip showing "…" forever — and the count on a
    // chip is a promise that a number is coming.
    //
    // /api/gateway is the reason this exists: it serves stored towns instantly for
    // national parks and forests, but state parks and monuments aren't in that
    // index, so they fall through to a live Overpass query that takes ~20s. That
    // is most of the places in this list.
    const get = async (key, url, pick, ms = 12000) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), ms);
      try {
        const r = await fetch(url, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!dead) setData((d) => ({ ...d, [key]: pick(j) }));
      } catch {
        if (!dead) setErr((e) => ({ ...e, [key]: true }));
      } finally {
        clearTimeout(timer);
      }
    };
    setData({}); setErr({});
    const ll = "lat=" + place.lat + "&lng=" + place.lng;
    // Flattening the three categories into one array threw away the only thing
    // that says whether a line is a footpath, a 4x4 route or a ski route — which
    // is what colours it on the map and what a hiker most needs to know.
    get("trails", place.npsCode ? "/api/trails?parkCode=" + place.npsCode : "/api/trails?" + ll + "&radius=25",
      (j) => ["hiking", "offroad", "ski"].flatMap((cat) => (j[cat] || []).map((t) => ({ ...t, cat }))));
    get("camping", "/api/places?" + ll + "&radius=30", (j) => (j.facilities || []));
    get("water", "/api/water?" + ll + "&radius=35", (j) => (j.lakes || []));
    get("conditions", "/api/conditions?" + ll, (j) => j);
    // Where you actually sleep, eat and buy fuel. Comes from the gateway_towns
    // table via /api/gateway, ranked nearest-first.
    get("towns", "/api/gateway?" + ll + (place.state ? "&state=" + encodeURIComponent(place.state) : ""),
      (j) => (j.towns || []));
    // NPS only knows about NPS units. A forest or state park has no entry, so
    // don't ask — an empty About is honest, a failed request looks broken.
    if (place.npsCode || place.type === "national_park") {
      const q = place.npsCode ? "parkCode=" + place.npsCode : "name=" + encodeURIComponent(place.name);
      get("about", "/api/nps?" + q, (j) => j);
    }
    return () => { dead = true; };
  }, [place.key]);

  // The map draws from this same object, so it can never disagree with the list.
  useEffect(() => { if (onNearby) onNearby(data); }, [data, onNearby]);

  const counts = {
    trails: data.trails ? data.trails.length : null,
    camping: data.camping ? data.camping.length : null,
    water: data.water ? data.water.length : null,
    towns: data.towns ? data.towns.length : null,
  };
  const dist = origin ? milesBetween(origin, place) : null;

  return (
    <>
      <div style={{ padding: "18px 24px 14px", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="Back to the list"
            style={{ cursor: "pointer", width: 30, height: 30, borderRadius: "50%",
              border: "1px solid var(--pb-line-strong)", background: "transparent",
              color: "var(--pb-ink)", fontSize: "1rem", lineHeight: 1, flex: "none" }}>‹</button>
          <button onClick={onBack} style={{ flex: 1, textAlign: "left", cursor: "pointer", background: "none",
            border: "none", color: "var(--pb-gold)", fontFamily: "var(--pb-sans)", fontSize: ".8rem" }}>
            Back to {resultCount} place{resultCount === 1 ? "" : "s"}
          </button>
          <SaveButton size={34} place={{
            kind: place.type === "national_park" ? "park" : place.type === "national_forest" ? "forest" : "statePark",
            name: place.name, ref: place.id || place.state, state: place.state,
            lat: place.lat, lng: place.lng, sub: TYPE_LABEL[place.type], href: place.href || "",
          }} />
        </div>

        <div ref={heroRef} style={{ marginTop: 14, borderRadius: 16, overflow: "hidden", position: "relative",
          aspectRatio: "16/6", background: "var(--pb-surface-2)", border: "1px solid var(--pb-line)" }}>
          {photo && photo.url && <img src={photo.url} alt={place.name}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.1) 40%,rgba(9,24,16,.86) 100%)" }} />
          <div style={{ position: "absolute", left: 20, bottom: 16 }}>
            <div style={{ fontFamily: "var(--pb-serif)", fontSize: "2rem", fontWeight: 300, lineHeight: 1.05 }}>{place.name}</div>
            <div style={{ ...micro, marginTop: 5 }}>
              {TYPE_LABEL[place.type]} · {place.state}
              {dist != null && isFinite(dist) ? " · " + Math.round(dist) + " MI FROM " + origin.name.toUpperCase() : ""}
            </div>
          </div>
        </div>

        {/* same chip row, new vocabulary */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 14 }}>
          {IN_PLACE.map((t) => {
            const c = counts[t.key];
            const empty = c === 0;
            return (
              <Chip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)} dim={empty}>
                {t.label}
                {t.key !== "overview" && t.key !== "about" && (
                  <span style={{ marginLeft: 6, fontFamily: "var(--pb-mono)", fontSize: ".62rem",
                    padding: "2px 6px", borderRadius: 999,
                    background: tab === t.key ? "var(--pb-bg)" : "var(--pb-surface-2)",
                    color: tab === t.key ? "var(--pb-gold)" : empty ? "var(--pb-muted)" : "var(--pb-gold-soft)" }}>
                    {err[t.key] ? "—" : c == null ? "…" : c}
                  </span>
                )}
              </Chip>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 40px" }}>
        {trail ? (
          <TrailDetail trail={trail} place={place} onBack={() => setTrail(null)} />
        ) : (<>
          {tab === "overview" && <Overview place={place} cond={data.conditions} err={err.conditions} vfull={vfull} nearby={data} onTab={setTab} />}
          {tab === "about" && <About place={place} nps={data.about} err={err.about} />}
          {tab !== "overview" && tab !== "about" && (
            <ThingList kind={tab} items={data[tab]} failed={err[tab]} place={place} onTrail={setTrail} />
          )}
        </>)}
      </div>
    </>
  );
}

// Pines are the platform's place-locked short videos. The peek is deliberately
// quiet and always honest about the count: an invitation when a place has none,
// a link when it has some. Never a number it hasn't checked.
function PinesPeek({ name }) {
  const [pins, setPins] = useState(null);
  useEffect(() => {
    if (!name) return;
    let on = true;
    fetch("/api/pines?place_name=" + encodeURIComponent(name) + "&limit=1")
      .then((r) => (r.ok ? r.json() : { pines: [] }))
      .then((d) => { if (on) setPins(d.pines || []); })
      .catch(() => { if (on) setPins(null); });   // null stays hidden rather than lying
    return () => { on = false; };
  }, [name]);
  if (pins === null) return null;
  return (
    <Link href="/pines" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none",
      border: "1px solid var(--pb-line)", borderRadius: 12, padding: "10px 12px", background: "var(--pb-tint)" }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, background: "var(--pb-grad-gold)", flex: "none",
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--pb-bg)" aria-hidden="true">
          <path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)" }}>
        {pins.length ? "Pines from here" : "Be the first to pin a Pine here"}
      </span>
      <span style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--pb-gold)", flex: "none" }}>→</span>
    </Link>
  );
}

// "What's around here", answered once.
//
// This used to be a list of campgrounds and lakes — which is exactly what the
// Camping and Water tabs already hold, so the same rows appeared twice and
// gateway towns appeared in a third place with no connection to either. The
// tabs ARE the answer; this summarises them and points into them, so there is
// one place that says what surrounds this park and one place per kind that
// lists it.
const AROUND = [
  { key: "trails", label: "Trails", icon: "🥾", empty: "none mapped here" },
  { key: "camping", label: "Camping", icon: "⛺", empty: "none found nearby" },
  { key: "water", label: "Lakes & water", icon: "💧", empty: "none found nearby" },
  { key: "towns", label: "Gateway towns", icon: "🏘", empty: "none within reach" },
];

function AroundHere({ place, nearby, onTab }) {
  const rows = AROUND.map((a) => {
    const items = nearby[a.key];
    if (!items) return { ...a, loading: true };
    // Trails carry geometry rather than a point, so they get a count and no
    // distance — saying "0 mi" would be inventing one.
    let nearest = null;
    if (a.key !== "trails") {
      for (const it of items) {
        const lat = Number(it.lat), lng = Number(it.lng);
        if (!isFinite(lat) || !isFinite(lng)) continue;
        const mi = it.distanceMi != null ? Number(it.distanceMi) : milesBetween(place, { lat, lng });
        if (!isFinite(mi)) continue;
        if (!nearest || mi < nearest.mi) nearest = { mi, name: it.bareName || it.name };
      }
    }
    return { ...a, count: items.length, nearest };
  });

  return (
    <Panel title="Around here">
      <div style={{ display: "grid", gap: 2 }}>
        {rows.map((r, i) => (
          <button key={r.key} onClick={() => onTab(r.key)}
            style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
              cursor: "pointer", background: "none", border: "none", padding: "8px 0",
              borderTop: i ? "1px solid var(--pb-line)" : "none", color: "var(--pb-ink)", fontFamily: "inherit" }}>
            <span aria-hidden="true" style={{ fontSize: ".95rem", flex: "none" }}>{r.icon}</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: ".85rem" }}>{r.label}</span>
            <span style={{ ...micro, letterSpacing: ".06em", textAlign: "right" }}>
              {r.loading ? "…"
                : !r.count ? r.empty
                : r.count + (r.nearest ? " · nearest " + Math.round(r.nearest.mi) + " mi" : "")}
            </span>
            <span aria-hidden="true" style={{ color: "var(--pb-gold)", flex: "none" }}>›</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Overview({ place, cond, err, vfull, nearby, onTab }) {
  // The road-access warning is the one thing here that must render even when the
  // live conditions fail: eight national parks have no road to them at all, and
  // a failed weather fetch is no reason to let someone plan a drive to Katmai.
  const access = roadAccessNote(place.name);
  const banner = access ? (
    <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 13,
      background: "color-mix(in srgb, var(--pb-hold) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--pb-hold) 45%, transparent)" }}>
      <span aria-hidden="true" style={{ color: "var(--pb-hold)" }}>✈</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: ".86rem" }}>{roadAccessLabel(access.level)}</div>
        <div style={{ fontSize: ".78rem", color: "var(--pb-ink-2)", marginTop: 3, lineHeight: 1.45 }}>{access.text}</div>
      </div>
    </div>
  ) : null;

  if (err) return <div style={{ display: "grid", gap: 12 }}>{banner}<Notice text="Couldn't read today's conditions for this place." /></div>;
  if (!cond) return <div style={{ display: "grid", gap: 12 }}>{banner}<Notice text="Reading conditions…" quiet /></div>;
  const alerts = cond.weatherAlerts || [];
  const fires = cond.wildfires || [];
  // pb-verdict already writes this sentence, across five tiers — it separates
  // "Great day to go" from "Good to go", which the card's three-way GO/PREPARE/
  // HOLD band flattens. So the panel quotes the engine rather than re-deriving
  // a coarser version of what it already said.
  const copy = vfull && vfull.word ? { headline: vfull.word, note: vfull.sub || "" } : null;
  // Same thresholds the map sweep uses, so the panel and the pin can't disagree.
  const band = !vfull ? null : vfull.score >= 62 ? "go" : vfull.score >= 42 ? "prepare" : "hold";
  const vband = band === "go" ? "var(--pb-go)" : band === "prepare" ? "var(--pb-prepare)"
    : band === "hold" ? "var(--pb-hold)" : "var(--pb-muted)";

  // The quiet facts, stated once on one line rather than in three empty panels.
  // Reasons that merely restate the metrics line or the alert block below.
  const RESTATES = /(\d+\s*°|\bmph\b|\balerts?\b)/i;
  const shownChips = ((vfull && vfull.chips) || []).filter((c) => c && c.t && !RESTATES.test(c.t)).slice(0, 3);

  const aq = cond.airQuality;
  const quiet = [
    alerts.length ? null : "No active alerts",
    fires.length ? null : "Nothing burning within 80 mi",
    aq && aq.aqi != null ? "Air " + aq.aqi + " " + (aq.category || "") : null,
  ].filter(Boolean);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Order is the question someone actually asks, in order: can I get there,
          should I go today, what is it like right now, what else is around, and
          only then the community stuff. Pines used to sit second and Nearby was
          wedged between the verdict and the conditions, splitting them. */}
      {banner}
      {/* ── today's call, and the weather that drives it, as ONE block ────────
          These were two: a verdict card, then a titled "Right now" panel holding
          two facts the verdict is already about. Split across two bordered boxes
          they read as two topics and cost ~195px of a ~400px panel. One block,
          with the reading below a hairline rather than inside another box. */}
      {copy && (
        <div style={{ padding: "16px 18px", borderRadius: 14, background: "var(--pb-tint)",
          border: "1px solid var(--pb-line)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, " + vband + " 22%, transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: vband, flex: "none" }} />
            <span style={{ ...micro, letterSpacing: ".16em" }}>Today&rsquo;s call</span>
          </div>
          <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 400, fontSize: "1.55rem",
            lineHeight: 1.15, marginTop: 7, color: vband }}>{copy.headline}</div>
          <div style={{ fontSize: ".83rem", color: "var(--pb-ink-2)", marginTop: 4, lineHeight: 1.45 }}>{copy.note}</div>

          {(vfull.temp != null || vfull.wind != null) && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
              marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pb-line)" }}>
              {vfull.temp != null && (
                <span style={{ fontFamily: "var(--pb-serif)", fontSize: "1.7rem", fontWeight: 300,
                  lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(vfull.temp)}°<span style={{ fontSize: "1rem" }}>F</span>
                </span>
              )}
              <span style={{ fontSize: ".84rem", color: "var(--pb-ink-2)" }}>
                {[vfull.sky || null,
                  vfull.wind != null ? Math.round(vfull.wind) + " mph wind" : null].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          {shownChips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
              {/* A chip is {t, pos}, not a string — pos marks a reason in favour. */}
              {shownChips.map((c, i) => (
                <span key={i} style={{ padding: "3px 9px", borderRadius: 999, fontSize: ".71rem",
                  background: "var(--pb-surface-2)", border: "1px solid var(--pb-line)",
                  color: c.pos ? "var(--pb-go)" : "var(--pb-ink-2)" }}>{c.t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <SharedGround place={place} />

      {/* ── what's wrong today, if anything ───────────────────────────────────
          Alerts, wildfire and air used to be three titled panels that rendered at
          full size whether or not they had anything to report — 67px of panel to
          say nothing is burning. An alert is worth a box; the absence of one is
          worth a line. */}
      {alerts.length > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 13,
          background: "color-mix(in srgb, var(--pb-hold) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pb-hold) 42%, transparent)" }}>
          {alerts.slice(0, 3).map((a, i) => (
            <div key={i} style={{ padding: i ? "8px 0 0" : 0, marginTop: i ? 8 : 0,
              borderTop: i ? "1px solid var(--pb-line)" : "none" }}>
              <div style={{ display: "flex", gap: 7 }}>
                <span aria-hidden="true" style={{ color: "var(--pb-hold)", flex: "none" }}>⚠</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: ".86rem" }}>{a.event}</div>
                  {a.headline && (
                    <div style={{ fontSize: ".77rem", color: "var(--pb-ink-2)", marginTop: 2, lineHeight: 1.4 }}>{a.headline}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {alerts.length > 3 && (
            <div style={{ ...micro, marginTop: 8 }}>+{alerts.length - 3} more</div>
          )}
        </div>
      )}

      {fires.length > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 13,
          background: "color-mix(in srgb, var(--pb-hold) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pb-hold) 42%, transparent)" }}>
          <div style={{ ...micro, marginBottom: 6 }}>Wildfire ({fires.length})</div>
          {fires.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontSize: ".83rem", padding: "3px 0" }}>
              {f.name} — {f.acres ? f.acres.toLocaleString() + " acres" : "size unreported"}
              {f.distanceMi != null ? " · " + Math.round(f.distanceMi) + " mi away" : ""}
            </div>
          ))}
        </div>
      )}

      {/* Everything quiet collapses to one line. It still SAYS it — silence about
          alerts and silence about fire look identical, and only one is honest. */}
      {quiet.length > 0 && (
        <div style={{ ...micro, letterSpacing: ".08em", lineHeight: 1.7 }}>{quiet.join(" · ")}</div>
      )}

      {/* What else is around, once today's call and today's conditions are read. */}
      <AroundHere place={place} nearby={nearby || {}} onTab={onTab} />
      <PinesPeek name={place.name} />
      {place.href && (
        <Link href={place.href} style={{ ...goldBtn, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
          Open the full status page →
        </Link>
      )}
    </div>
  );
}

// What this place IS, as opposed to what it's doing today. The old Explore had
// this and the rebuild dropped it — description, what people come here to do,
// and a link out to the park's own page.
//
// Only National Park Service units have an entry, so a forest or state park says
// so plainly rather than showing a spinner that never resolves.
function About({ place, nps, err }) {
  const isNps = !!(place.npsCode || place.type === "national_park");
  if (!isNps) {
    return (
      <Notice text={"The Park Service publishes this kind of detail for national parks. " +
        TYPE_LABEL[place.type] + "s like " + place.name + " aren't in that catalogue, so there's nothing to show here."} />
    );
  }
  if (err) return <Notice text={"Couldn't reach the Park Service for " + place.name + "."} />;
  if (!nps) return <Notice text="Loading…" quiet />;

  const park = nps.park || null;
  // `park: null` on a real NPS unit almost always means the request didn't
  // authenticate, not that the Park Service has nothing on Acadia. Don't assert
  // an absence we haven't established.
  if (!park) return <Notice text={"Couldn't load Park Service detail for " + place.name + " just now."} />;

  const activities = (park.activities || []).slice(0, 10);
  const todo = (nps.thingsToDo || []).slice(0, 4);
  const hours = (park.operatingHours || [])[0];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {park.description && (
        <Panel title={park.designation || "About"}>
          <div style={{ fontSize: ".9rem", lineHeight: 1.6, color: "var(--pb-ink-2)" }}>{park.description}</div>
        </Panel>
      )}

      {!!activities.length && (
        <Panel title="What people come here to do">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {activities.map((a) => (
              <span key={a} style={{ fontSize: ".76rem", padding: "5px 10px", borderRadius: 999,
                background: "var(--pb-surface-2)", border: "1px solid var(--pb-line)", color: "var(--pb-ink-2)" }}>{a}</span>
            ))}
          </div>
        </Panel>
      )}

      {!!todo.length && (
        <Panel title="Things to do">
          {todo.map((t, i) => (
            <div key={i} style={{ padding: "9px 0", borderTop: i ? "1px solid var(--pb-line)" : "none" }}>
              <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{t.title}</div>
              {t.shortDescription && (
                <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 3, lineHeight: 1.45,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {t.shortDescription}
                </div>
              )}
              {t.duration && <div style={{ ...micro, marginTop: 5, letterSpacing: ".06em" }}>{t.duration}</div>}
            </div>
          ))}
        </Panel>
      )}

      {hours && hours.description && (
        <Panel title="Hours">
          <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>{hours.description}</div>
        </Panel>
      )}

      {!!(park.entranceFees || []).length && (
        <Panel title="Getting in">
          {park.entranceFees.slice(0, 3).map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: ".84rem" }}>
              <span style={{ color: "var(--pb-ink-2)" }}>{f.title}</span>
              <span style={{ fontFamily: "var(--pb-mono)", color: "var(--pb-gold)" }}>${f.cost}</span>
            </div>
          ))}
        </Panel>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {place.href && (
          <Link href={place.href} style={{ ...goldBtn, width: "auto", display: "inline-block", textDecoration: "none", boxSizing: "border-box" }}>
            Full live status →
          </Link>
        )}
        {park.url && (
          <a href={park.url} target="_blank" rel="noreferrer" style={{ ...pillBtn, display: "inline-block", textDecoration: "none" }}>
            nps.gov ↗
          </a>
        )}
      </div>
      <div style={{ ...micro, letterSpacing: ".1em" }}>Source · National Park Service</div>
    </div>
  );
}

function ThingList({ kind, items, failed, place, onTrail }) {
  const LABEL = { trails: "trails", camping: "campgrounds", water: "lakes", towns: "towns" };
  if (failed) return <Notice text={kind === "towns"
    ? "Nearby towns are indexed for national parks and forests. For " + place.name +
      " they have to be looked up live, and that didn't finish in time."
    : "Couldn't load " + LABEL[kind] + " for " + place.name + ". The source didn't answer."} />;
  if (!items) return <Notice text={"Loading " + LABEL[kind] + "…"} quiet />;
  if (!items.length) return <Notice text={kind === "towns"
    ? "No towns found within reach of " + place.name + "."
    : "No " + LABEL[kind] + " found in or near " + place.name + "."} />;

  if (kind === "towns") {
    // Ranked nearest-first, so the distance leads. This is the "where do I sleep"
    // list — a town 90 miles out is a different trip from one 8 miles out.
    return (
      <>
        <div style={{ display: "grid", gap: 8 }}>
          {items.slice(0, 12).map((t, i) => (
            <div key={(t.name || "") + i} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "11px 13px", borderRadius: 13, background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
              <span style={{ flex: "none", width: 34, height: 34, borderRadius: 9, display: "flex",
                alignItems: "center", justifyContent: "center", background: "var(--pb-surface-2)",
                border: "1px solid var(--pb-line)", fontFamily: "var(--pb-mono)", fontSize: ".62rem",
                color: "var(--pb-gold)" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: ".92rem", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.bareName || t.name}</div>
                {t.distanceMi != null && (
                  <div style={{ ...micro, marginTop: 3, letterSpacing: ".06em" }}>
                    {Math.round(t.distanceMi)} mi from {place.name}
                  </div>
                )}
              </div>
              <SaveButton variant="bare" size={26} place={{
                kind: "town", name: t.bareName || t.name, ref: place.state || place.name,
                state: place.state, lat: t.lat, lng: t.lng, sub: "Gateway town", href: "",
              }} />
            </div>
          ))}
        </div>
        <div style={{ ...micro, marginTop: 12, letterSpacing: ".08em" }}>
          Nearest first · lodging, food, fuel and outfitters
        </div>
      </>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
      {items.slice(0, 24).map((it, i) => {
        const name = it.name || "Unnamed";
        const sub =
          kind === "trails" ? [it.trailClass || it.difficulty, it.lengthMi ? it.lengthMi + " mi" : null].filter(Boolean).join(" · ")
          : kind === "camping" ? [it.type, it.reservable ? "reservable" : null].filter(Boolean).join(" · ")
          : (it.kind || "lake");
        // A trail has a whole view behind it — stats, photo, reviews. Everything
        // else here is already showing all it has, so only trails become buttons.
        const openable = kind === "trails" && onTrail;
        return (
          <div key={name + i} style={{ padding: "12px 14px", borderRadius: 13,
            background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {openable ? (
                  <button onClick={() => onTrail(it)}
                    style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                      background: "none", border: "none", padding: 0, color: "var(--pb-ink)",
                      fontFamily: "inherit", fontWeight: 600, fontSize: ".92rem" }}>
                    {name} <span aria-hidden="true" style={{ color: "var(--pb-gold)" }}>›</span>
                  </button>
                ) : (
                  <div style={{ fontWeight: 600, fontSize: ".92rem" }}>{name}</div>
                )}
                {sub && <div style={{ ...micro, marginTop: 4, letterSpacing: ".06em" }}>{sub}</div>}
                {it.description && (
                  <div style={{ fontSize: ".76rem", color: "var(--pb-muted)", marginTop: 6, lineHeight: 1.45,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {it.description}
                  </div>)}
              </div>
              <SaveButton variant="bare" size={26} place={{
                kind: kind === "trails" ? "trail" : kind === "camping" ? "camp" : "water",
                name, ref: place.npsCode || place.name, state: place.state,
                lat: it.lat, lng: it.lng, sub, href: "",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- atoms */
const mapCtl = { cursor: "pointer", width: 38, height: 38, borderRadius: 10, display: "flex",
  alignItems: "center", justifyContent: "center", fontSize: "1rem", lineHeight: 1,
  background: "var(--pb-glass-strong)", border: "1px solid var(--pb-line-strong)",
  color: "var(--pb-ink)", backdropFilter: "blur(8px)" };
const micro = { fontFamily: "var(--pb-mono)", fontSize: ".58rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" };
const pillBtn = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".82rem", color: "var(--pb-ink)", background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "11px 16px", whiteSpace: "nowrap", flex: "none" };
const goldBtn = { cursor: "pointer", width: "100%", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".9rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "13px 16px" };

function Chip({ on, onClick, children, dot, dim, count }) {
  const empty = count === 0;
  return (
    <button onClick={onClick} aria-pressed={!!on}
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 13px", borderRadius: 999, fontFamily: "var(--pb-sans)",
        // never shrink or fold inside a sideways-scrolling chip row
        whiteSpace: "nowrap", flex: "none",
        fontSize: ".8rem", fontWeight: on ? 700 : 500, opacity: dim || empty ? 0.5 : 1,
        background: on ? "var(--pb-grad-gold)" : "var(--pb-tint)",
        color: on ? "var(--pb-bg)" : "var(--pb-ink-2)",
        border: "1px solid " + (on ? "transparent" : "var(--pb-line)") }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />}
      {children}
      {count != null && (
        <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", padding: "2px 6px",
          borderRadius: 999, background: on ? "rgba(10,23,18,.22)" : "var(--pb-surface-2)",
          color: on ? "var(--pb-bg)" : empty ? "var(--pb-muted)" : "var(--pb-gold-soft)" }}>
          {count}
        </span>
      )}
    </button>
  );
}

// A filter that was applied inside the popover, shown in the chip row so the
// list's current truth is readable without opening anything. The ✕ removes
// just that one narrowing — different job from Chip, which TOGGLES a lens.
function AppliedChip({ onClear, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 8px 7px 13px",
      borderRadius: 999, fontFamily: "var(--pb-sans)", fontSize: ".78rem", fontWeight: 600,
      whiteSpace: "nowrap", flex: "none",
      background: "var(--pb-surface-2)", color: "var(--pb-ink)", border: "1px solid var(--pb-gold-2)" }}>
      {children}
      <button onClick={onClear} aria-label={"Remove filter: " + (typeof children === "string" ? children : "")}
        style={{ cursor: "pointer", background: "none", border: "none", padding: "0 4px",
          color: "var(--pb-muted)", fontSize: ".82rem", lineHeight: 1 }}>✕</button>
    </span>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
      <div style={{ ...micro, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Notice({ text, quiet }) {
  return (
    <div style={{ padding: "22px 18px", textAlign: "center", borderRadius: 14,
      border: "1px dashed var(--pb-line-strong)", color: "var(--pb-muted)",
      fontSize: ".86rem", lineHeight: 1.55, opacity: quiet ? 0.7 : 1, margin: "6px 0 14px" }}>
      {text}
    </div>
  );
}
