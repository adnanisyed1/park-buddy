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
import { getStops, setStops } from "../lib/trip";
import { roadAccessNote, roadAccessLabel } from "../lib/roadAccess";
import WeatherFX from "../components/WeatherFX";

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
function numIcon(g, n, on) {
  const d = on ? 30 : 24;
  const bg = on ? "%23e8cf9a" : "rgba(8,13,9,.92)";
  const fg = on ? "%230a1712" : "%23aab0ba";
  const stroke = on ? "none" : "stroke='%23d9b779' stroke-opacity='.5'";
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

/* --------------------------------------------------------------- the screen */
export default function ExploreSplit() {
  const themeRef = useRef(null);
  useThemedBody(themeRef);

  const [places, setPlaces] = useState([]);
  const [dataErr, setDataErr] = useState("");
  const [origin, setOrigin] = useState(null);          // { name, lat, lng, state }
  const [radius, setRadius] = useState(100);           // miles; null = any
  const [cats, setCats] = useState({ national_park: true, national_forest: true, state_park: true, nps_unit: false });
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
  const [flash, setFlash] = useState("");

  const say = useCallback((m) => { setFlash(m); setTimeout(() => setFlash(""), 3000); }, []);

  // The site nav is a FLOATING PILL (.pb-nav-float — fixed, top 14, ~76 tall), not a
  // 64px bar. Hardcoding 64 put it 26px on top of the search field. Measured at
  // runtime so this stays right when the nav changes height or wraps on a narrow
  // window, instead of being a magic number that silently rots.
  const [topPad, setTopPad] = useState(104);
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector(".pb-nav-float");
      const bottom = nav ? nav.getBoundingClientRect().bottom : 90;  // fixed → scroll-independent
      setTopPad(Math.round(bottom) + 14);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
              lat: Number(d.lat), lng: Number(d.lng), type, href: "",
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
              type: "national_forest", href: "" });
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
      mapRef.current = new g.maps.Map(mapEl.current, {
        center: { lat: 39.5, lng: -98.5 }, zoom: 4, minZoom: 3, maxZoom: 15,
        mapTypeId: "hybrid", mapTypeControl: true, streetViewControl: false,
        fullscreenControl: false, gestureHandling: "cooperative", backgroundColor: "#0a1712",
      });
    });
    return () => { dead = true; };
  }, []);

  // redraw markers whenever the visible set changes
  useEffect(() => {
    const g = typeof window !== "undefined" ? window.google : null;
    const map = mapRef.current;
    if (!g || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    shown.forEach((p, i) => {
      const on = picked.has(p.key);
      const m = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map,
        icon: numIcon(g, i + 1, on), title: p.name, zIndex: on ? 20 : 10,
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

    const b = new g.maps.LatLngBounds();
    let n = 0;
    if (origin) { b.extend({ lat: origin.lat, lng: origin.lng }); n++; }
    shown.forEach((p) => { b.extend({ lat: p.lat, lng: p.lng }); n++; });
    if (n > 1) map.fitBounds(b, 60);
    else if (n === 1) { map.setCenter(b.getCenter()); map.setZoom(8); }
  }, [shown.map((p) => p.key).join(","), picked, origin, radius, mapOk]);

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
    ((!conds.go || !conds.prepare || !conds.hold) ? 1 : 0);

  const states = useMemo(
    () => Array.from(new Set(places.map((p) => p.state).filter(Boolean))).sort(),
    [places]
  );

  /* ------------------------------------------------------------------ view */
  return (
    <div ref={themeRef} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader />
      <div style={{ display: "flex", height: "100vh", paddingTop: topPad, boxSizing: "border-box" }}>

        {/* ─────────────────────────────── panel */}
        <section style={{ width: 700, maxWidth: "50vw", flex: "none", display: "flex", flexDirection: "column",
          background: "var(--pb-surface)", borderRight: "1px solid var(--pb-line)", position: "relative" }}>

          {sel ? (
            <PlaceDetail place={sel} origin={origin} onBack={() => setSel(null)} resultCount={results.length}
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
                count={results.length} stateName={stateFilter}
              />

              <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 120px" }}>
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
                    Your trip has {getStops().length} stop{getStops().length === 1 ? "" : "s"}
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
        <section style={{ flex: 1, position: "relative", background: "var(--pb-bg-2)" }}>
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
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header */
function Header(props) {
  const { query, setQuery, sugg, onPick, onSubmit, geocoding, filtersOpen, setFiltersOpen,
    activeFilters, cats, setCats, catCounts, origin, setOrigin, radius, setRadius, onMyLocation,
    conds, setConds, states, stateFilter, setStateFilter, count, stateName } = props;

  return (
    <div style={{ padding: "20px 24px 14px", position: "relative", flex: "none" }}>
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
              {sugg.map((s) => (
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
        <button onClick={() => setFiltersOpen((v) => !v)}
          style={{ ...pillBtn, borderColor: filtersOpen ? "var(--pb-gold-2)" : "var(--pb-line-strong)",
            display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "var(--pb-gold)" }}>Filters</span>
          {activeFilters > 0 && (
            <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: "var(--pb-grad-gold)",
              color: "var(--pb-bg)", fontFamily: "var(--pb-mono)", fontSize: ".62rem",
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{activeFilters}</span>
          )}
        </button>
      </div>

      {/* chips — what kind of place, and how many of each.
          The count is what makes the toggle legible: turning one off is
          obviously subtraction when you can see what you're subtracting. */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        {CATS.map((c) => (
          <Chip key={c.key} on={cats[c.key]} onClick={() => setCats((s) => ({ ...s, [c.key]: !s[c.key] }))}
            count={catCounts[c.key]}>
            {c.label}
          </Chip>
        ))}
        {CATS.some((c) => !cats[c.key]) && (
          <button onClick={() => setCats({ national_park: true, national_forest: true, state_park: true, nps_unit: true })}
            style={{ cursor: "pointer", background: "none", border: "none", color: "var(--pb-gold)",
              fontFamily: "var(--pb-sans)", fontSize: ".78rem", fontWeight: 600, padding: "0 4px" }}>
            Show all
          </button>
        )}
      </div>

      {/* the pinpoint */}
      {origin ? (
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
      ) : (
        <button onClick={onMyLocation} style={{ ...pillBtn, marginTop: 12, fontSize: ".78rem" }}>
          ◎ Use my location
        </button>
      )}

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

      {filtersOpen && (
        <FilterPopover
          onClose={() => setFiltersOpen(false)}
          conds={conds} setConds={setConds}
          states={states} stateFilter={stateFilter} setStateFilter={setStateFilter}
          origin={origin} radius={radius} setRadius={setRadius}
          onReset={() => { setConds({ go: true, prepare: true, hold: true }); setStateFilter(""); setRadius(100); }}
          count={count}
        />
      )}
    </div>
  );
}

function FilterPopover({ onClose, conds, setConds, states, stateFilter, setStateFilter, origin, radius, setRadius, onReset, count }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div style={{ position: "absolute", top: 66, right: 24, width: 340, zIndex: 41,
        background: "var(--pb-glass-strong)", border: "1px solid var(--pb-line-strong)",
        borderRadius: 16, padding: "4px 0 16px", backdropFilter: "blur(18px)",
        boxShadow: "0 18px 44px -18px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 12px" }}>
          <b style={{ fontSize: ".95rem" }}>Filters</b>
          <button onClick={onReset} style={{ cursor: "pointer", background: "none", border: "none",
            color: "var(--pb-gold)", fontSize: ".78rem", fontWeight: 600 }}>Reset</button>
        </div>

        <div style={{ ...micro, padding: "10px 16px 8px" }}>Today&rsquo;s conditions</div>
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
            <WeatherFX sky={vfull.sky} wind={vfull.wind} isDay={isDay} size="1.05rem" cut="#0d1a13" />
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
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9 }}>
              <WeatherFX sky={vfull.sky} wind={vfull.wind} isDay={isDay} size=".9rem"
                cut={picked ? "var(--pb-surface-2)" : "var(--pb-surface)"} />
              <span style={{ ...micro, letterSpacing: ".06em" }}>
                {[
                  vfull.temp != null ? vfull.temp + "°" : null,
                  vfull.sky || null,
                  vfull.wind ? vfull.wind + " mph wind" : null,
                ].filter(Boolean).join(" · ")}
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
  { key: "trails", label: "Trails" },
  { key: "camping", label: "Camping" },
  { key: "water", label: "Water" },
];

function PlaceDetail({ place, origin, onBack, resultCount, vfull, isDay }) {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState({});      // { trails, camping, water, conditions }
  const [err, setErr] = useState({});
  const heroRef = useRef(null);
  const q = place.type === "national_park" ? place.name + " National Park|" + place.name : place.name;
  const photo = usePhoto(q, place.lat, place.lng, null, 1200);

  // Everything here is a live third-party call, so it only runs now — one place,
  // on demand. Each section fails on its own and says so.
  useEffect(() => {
    let dead = false;
    const get = async (key, url, pick) => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!dead) setData((d) => ({ ...d, [key]: pick(j) }));
      } catch {
        if (!dead) setErr((e) => ({ ...e, [key]: true }));
      }
    };
    setData({}); setErr({});
    const ll = "lat=" + place.lat + "&lng=" + place.lng;
    get("trails", place.npsCode ? "/api/trails?parkCode=" + place.npsCode : "/api/trails?" + ll + "&radius=25",
      (j) => [].concat(j.hiking || [], j.offroad || [], j.ski || []));
    get("camping", "/api/places?" + ll + "&radius=30", (j) => (j.facilities || []));
    get("water", "/api/water?" + ll + "&radius=35", (j) => (j.lakes || []));
    get("conditions", "/api/conditions?" + ll, (j) => j);
    return () => { dead = true; };
  }, [place.key]);

  const counts = {
    trails: data.trails ? data.trails.length : null,
    camping: data.camping ? data.camping.length : null,
    water: data.water ? data.water.length : null,
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
            <div style={{ ...micro, marginTop: 5, display: "flex", alignItems: "center", gap: 8 }}>
              {vfull && <WeatherFX sky={vfull.sky} wind={vfull.wind} isDay={isDay} size="1.1rem" cut="#0d1a13" />}
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
                {t.key !== "overview" && (
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
        {tab === "overview" && <Overview place={place} cond={data.conditions} err={err.conditions} />}
        {tab !== "overview" && (
          <ThingList kind={tab} items={data[tab]} failed={err[tab]} place={place} />
        )}
      </div>
    </>
  );
}

function Overview({ place, cond, err }) {
  if (err) return <Notice text="Couldn't read today's conditions for this place." />;
  if (!cond) return <Notice text="Reading conditions…" quiet />;
  const alerts = cond.weatherAlerts || [];
  const fires = cond.wildfires || [];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {cond.temp && (
        <Panel title="Right now">
          <div style={{ fontSize: "1.5rem", fontFamily: "var(--pb-serif)", fontWeight: 300 }}>
            {cond.temp.temp}°{cond.temp.unit || "F"} · {cond.temp.short || cond.temp.label}
          </div>
        </Panel>
      )}
      <Panel title={"Alerts (" + alerts.length + ")"}>
        {alerts.length
          ? alerts.slice(0, 4).map((a, i) => (
              <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--pb-line)" : "none" }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{a.event}</div>
                <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 3 }}>{a.headline}</div>
              </div>))
          : <div style={{ fontSize: ".84rem", color: "var(--pb-muted)" }}>No active weather alerts.</div>}
      </Panel>
      <Panel title={"Wildfire (" + fires.length + ")"}>
        {fires.length
          ? fires.slice(0, 4).map((f, i) => (
              <div key={i} style={{ fontSize: ".84rem", padding: "4px 0" }}>
                {f.name} — {f.acres ? f.acres.toLocaleString() + " acres" : "size unreported"}
                {f.distanceMi != null ? " · " + Math.round(f.distanceMi) + " mi away" : ""}
              </div>))
          : <div style={{ fontSize: ".84rem", color: "var(--pb-muted)" }}>Nothing burning within 80 miles.</div>}
      </Panel>
      {place.href && (
        <Link href={place.href} style={{ ...goldBtn, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
          Open the full status page →
        </Link>
      )}
    </div>
  );
}

function ThingList({ kind, items, failed, place }) {
  const LABEL = { trails: "trails", camping: "campgrounds", water: "lakes" };
  if (failed) return <Notice text={"Couldn't load " + LABEL[kind] + " for " + place.name + ". The source didn't answer."} />;
  if (!items) return <Notice text={"Loading " + LABEL[kind] + "…"} quiet />;
  if (!items.length) return <Notice text={"No " + LABEL[kind] + " found in or near " + place.name + "."} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
      {items.slice(0, 24).map((it, i) => {
        const name = it.name || "Unnamed";
        const sub =
          kind === "trails" ? [it.trailClass || it.difficulty, it.lengthMi ? it.lengthMi + " mi" : null].filter(Boolean).join(" · ")
          : kind === "camping" ? [it.type, it.reservable ? "reservable" : null].filter(Boolean).join(" · ")
          : (it.kind || "lake");
        return (
          <div key={name + i} style={{ padding: "12px 14px", borderRadius: 13,
            background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: ".92rem" }}>{name}</div>
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
const micro = { fontFamily: "var(--pb-mono)", fontSize: ".58rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" };
const pillBtn = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".82rem", color: "var(--pb-ink)", background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "11px 16px" };
const goldBtn = { cursor: "pointer", width: "100%", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".9rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "13px 16px" };

function Chip({ on, onClick, children, dot, dim, count }) {
  const empty = count === 0;
  return (
    <button onClick={onClick} aria-pressed={!!on}
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 13px", borderRadius: 999, fontFamily: "var(--pb-sans)",
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
