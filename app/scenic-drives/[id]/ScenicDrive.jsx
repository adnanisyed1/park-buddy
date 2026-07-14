"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ensureMapsLoaded } from "../../lib/googleMapsLoader";
import { getMapPrefs, mapOptionsFor } from "../../lib/mapPrefs";
import { usePhoto } from "../../components/PhotoThumb";
import SiteHeader from "../../components/SiteHeader";
import RouteItinerary from "./RouteItinerary";
import RouteAttractions from "./RouteAttractions";
import RoutePhotos from "./RoutePhotos";

// /scenic-drives/<id> detail — ported 1:1 from the Claude-design spec. Real
// data: federal byway record (name/tier/states/length/qualities/blurb), live
// NPS road status, real photos (hero + filmstrip + highlight cards), a REAL
// Google map with numbered overlook markers wired two-way to the highlight
// cards (hover a card → its marker haloes; hover a marker → its card lifts),
// and internal cross-links to the parks/trails/lakes along the route.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const KEYFRAMES = `
@keyframes sd-ken{0%{transform:scale(1.08) translate(0,0)}100%{transform:scale(1.18) translate(-2.4%,-2.2%)}}
@keyframes sd-fadeup{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes sd-chip{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
@keyframes sd-shine{0%{background-position:-140% 0}60%,100%{background-position:240% 0}}
@keyframes sd-pulse{0%{box-shadow:0 0 0 0 rgba(228,190,120,.55)}70%{box-shadow:0 0 0 12px rgba(228,190,120,0)}100%{box-shadow:0 0 0 0 rgba(228,190,120,0)}}
@media(prefers-reduced-motion:reduce){.sd-anim{animation:none!important}}
.pb-poi-label{text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 4px rgba(0,0,0,.8),0 0 8px rgba(0,0,0,.6);white-space:nowrap;letter-spacing:.01em}
`;

const QUAL_META = {
  Scenic: { ic: "◈", d: "Panoramic, memorable views" },
  Natural: { ic: "✿", d: "Outstanding natural features" },
  Historic: { ic: "⌂", d: "Legacy of the past you can visit" },
  Cultural: { ic: "♪", d: "Living traditions and community" },
  Recreational: { ic: "⛰", d: "Outdoor recreation along the way" },
  Archaeological: { ic: "◇", d: "Evidence of ancient peoples" },
};

const FEATURE_NOTE = { peak: "A named summit near the route", pass: "A named pass on the drive", saddle: "A saddle on the ridge", water: "A lake beside the route", waterfall: "A waterfall near the road", glacier: "A glacier along the route", viewpoint: "A marked viewpoint", ridge: "A named ridge", spring: "A spring near the road" };

// Roadside-attraction categories (from OpenStreetMap) — colour + glyph for the map
// markers, the legend, and the scenic-stops list.
const POI_CAT = {
  overlook: { color: "#e8cf9a", ic: "◉", label: "Overlook" },
  pass: { color: "#d99a4e", ic: "▲", label: "Pass" },
  campground: { color: "#4f9d69", ic: "⌂", label: "Campground" },
  waterfall: { color: "#5aa9d6", ic: "≋", label: "Waterfall" },
  lake: { color: "#3f8fa0", ic: "◐", label: "Lake" },
  peak: { color: "#a7adb3", ic: "△", label: "Peak" },
  trailhead: { color: "#b3862d", ic: "⇡", label: "Trailhead" },
  "rest area": { color: "#7a5a2f", ic: "▤", label: "Rest area" },
};
const poiCat = (t) => POI_CAT[t] || POI_CAT.overlook;

// Factual explainer of what each designation means (National Scenic Byways Program,
// FHWA / U.S. DOT). Displayed on every drive so the page explains the badge.
const TIER_INFO = {
  "all-american": {
    label: "All-American Road",
    lead: "the highest honor in the National Scenic Byways Program",
    body: "To be named an All-American Road, a route has to possess multiple intrinsic qualities that are nationally significant, with features so exceptional you can't find them anywhere else. The road is considered a destination unto itself — reason enough to make the trip. Only about 40 roads in the country hold this designation.",
  },
  landmark: {
    label: "National Historic Landmark",
    lead: "a nationally significant historic road",
    body: "This drive carries a national historic designation rather than an FHWA byway title — recognized for its engineering, its history, or the landscape it opens up, and protected as part of America's heritage.",
  },
  byway: {
    label: "National Scenic Byway",
    lead: "a nationally recognized scenic byway",
    body: "A National Scenic Byway is recognized for one or more intrinsic qualities that are regionally significant — a road worth slowing down for, chosen for what you can see, learn, and experience along the way.",
  },
};

function Badge({ tier }) {
  const meta = tier === "all-american"
    ? { grad: "linear-gradient(135deg,#e8cf9a,var(--pb-gold-2))", ink: "#4a3410", label: "All-American Road", sub: "Top tier · unique in the nation" }
    : tier === "landmark"
    ? { grad: "linear-gradient(135deg,#d9b38a,#a9764a)", ink: "#3f2a12", label: "National Historic Landmark", sub: "Iconic road · not an FHWA byway" }
    : { grad: "linear-gradient(135deg,#e6e8ea,#a9b0b6)", ink: "#2c3338", label: "National Scenic Byway", sub: "Nationally significant" };
  return (
    <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 10, background: meta.grad, borderRadius: 16, padding: "10px 15px", boxShadow: "0 16px 40px -18px rgba(0,0,0,.7)" }}>
      <div className="sd-anim" style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%)", backgroundSize: "220% 100%", animation: "sd-shine 4.5s ease-in-out infinite" }} />
      <svg width="22" height="22" viewBox="0 0 24 24" fill={meta.ink} style={{ position: "relative", flex: "none" }}><path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5L2.6 8.8l6.5-.9z" /></svg>
      <span style={{ position: "relative", display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <b style={{ fontFamily: serif, fontWeight: 800, fontSize: ".98rem", color: meta.ink }}>{meta.label}</b>
        <span style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: meta.ink, opacity: .8 }}>{meta.sub}</span>
      </span>
    </div>
  );
}

function CrossTile({ c }) {
  const photo = usePhoto(c.q, c.lat, c.lng, undefined, undefined, c.fallback);
  const routeCol = { "National Park": "#1d4a37", "National Forest": "#3f6a4a", "State Park": "#6b7a3f", Trail: "#b3862d", Lake: "#2f6d7a", Campground: "#7a5a2f" };
  const col = routeCol[c.type] || "#1d4a37";
  return (
    <Link href={c.href} style={{ textDecoration: "none", position: "relative", display: "block", aspectRatio: "1/1", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(217,183,121,.16)", boxShadow: "0 18px 44px -24px rgba(28,46,34,.4)", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }}>
      {photo && photo.url && <img src={photo.url} alt={c.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.05) 40%,rgba(9,24,16,.82) 100%)" }} />
      <span style={{ position: "absolute", left: 11, top: 11, background: col, color: "var(--pb-ink)", fontFamily: mono, fontSize: ".54rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", borderRadius: 999, padding: "4px 9px" }}>{c.type}</span>
      <b style={{ position: "absolute", left: 12, right: 12, bottom: 11, fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: "1.02rem", lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{c.name}</b>
    </Link>
  );
}

export default function ScenicDrive({ drive, detail, cross, heroFallback }) {
  // Wikipedia-derived record (traveler itinerary, history, references, CC BY-SA
  // attribution) when this drive has been enriched; null otherwise (page renders
  // its baseline). Route line + highlights prefer curated data, then the record.
  // Route line source. The hand-curated flagships (Blue Ridge, Trail Ridge,
  // Going-to-the-Sun — the ones with curated highlights) always keep their tuned
  // endpoints. Otherwise pick whichever route has MORE waypoints: the generated
  // detail route traces the full parsed corridor with the milepost geocode-snap, so
  // it beats a thin curated from/to (e.g. Beartooth's partial "Red Lodge→Cooke City"),
  // but a genuinely richer curated route still wins.
  const detailEp = detail && detail.endpoints;
  const driveEp = drive.endpoints;
  const viaN = (e) => (e && e.from && e.to ? (e.via || []).length + 1 : 0);
  const curatedFlagship = !!(drive.highlights && drive.highlights.length);
  const routeEndpoints = curatedFlagship
    ? (driveEp || detailEp || null)
    : (viaN(detailEp) > viaN(driveEp) ? detailEp : (driveEp || detailEp)) || null;
  const parkCode = drive.parkCode || (detail && detail.parkCode) || null;
  // Name-only (no geo fallback): a byway is linear, so a geo-search near one
  // coordinate returns junk (a church, a brewery, a photo of Earth from orbit).
  // But many byways have no Wikipedia lead image, so fall back to a nearby national
  // park's photo (passed from the server) rather than leaving the hero blank.
  const heroPhoto = usePhoto([...(drive.wiki || []), drive.name].join("|"), null, null, undefined, undefined, heroFallback);
  // Reliable hero: a real Commons photo from the gallery wins (Wikipedia lead images
  // often don't exist for byway names); fall back to the name lookup, then card image.
  const heroUrl = (detail && detail.gallery && detail.gallery[0] && detail.gallery[0].url) || (heroPhoto && heroPhoto.url) || drive.cardImage;
  const [road, setRoad] = useState(undefined);
  const [highlights, setHighlights] = useState(drive.highlights || null);
  const [film, setFilm] = useState([]);
  const [filmIdx, setFilmIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapDivRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const routeLineRef = useRef(null);
  const routeCasingRef = useRef(null);
  const routeGlowRef = useRef(null);
  const dirServiceRef = useRef(null);
  const filmTimer = useRef(null);

  // Live road status
  useEffect(() => {
    let on = true;
    const qs = new URLSearchParams({ road: drive.name });
    if (parkCode) qs.set("parkCode", parkCode);
    if (drive.lat != null && !drive.approxLoc) { qs.set("lat", String(drive.lat)); qs.set("lng", String(drive.lng)); } // NWS at the road's point
    if (drive.season) qs.set("season", drive.season);
    if (drive.states) qs.set("states", drive.states);
    fetch("/api/roadstatus?" + qs.toString())
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (on) setRoad(d); }).catch(() => { if (on) setRoad(null); });
    return () => { on = false; };
  }, [parkCode, drive.name, drive.lat, drive.lng, drive.season, drive.states, drive.approxLoc]);

  // Highlights: curated (flagships) or derived from real named features on the
  // route. Skip derivation when the drive only has an APPROXIMATE (state-level)
  // location — features around a state centroid wouldn't be on the actual road.
  useEffect(() => {
    if (drive.highlights && drive.highlights.length) { setHighlights(drive.highlights); return; }
    // Wikipedia-derived corridor highlights (real coords) beat the crude ±0.12° box.
    const dh = (detail && detail.highlights || []).filter((h) => h.lat != null);
    if (dh.length) { setHighlights(dh); return; }
    if (drive.approxLoc) { setHighlights([]); return; }
    let on = true;
    const pad = 0.12;
    const bbox = [drive.lat - pad, drive.lng - pad, drive.lat + pad, drive.lng + pad].map((v) => v.toFixed(4)).join(",");
    fetch("/api/waypoints?bbox=" + bbox)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const feats = (d && d.features) || [];
        const picked = feats.slice(0, 5).map((f) => ({ n: f.name, d: FEATURE_NOTE[f.type] || "A named landmark on the route", q: f.name, lat: f.lat, lng: f.lng }));
        if (on) setHighlights(picked);
      })
      .catch(() => { if (on) setHighlights([]); });
  }, [drive.id, drive.lat, drive.lng]);

  // Filmstrip: curated captions or geotagged photos near the route.
  useEffect(() => {
    let on = true;
    if (drive.film && drive.film.length) {
      // Curated flagship captions — matched by name (no geo fallback).
      Promise.all(drive.film.map((f) =>
        fetch("/api/photo?q=" + encodeURIComponent(f.q.join("|")) + "&v=4")
          .then((r) => (r.ok ? r.json() : null)).then((d) => (d && d.found ? { url: d.image || d.thumb, cap: f.cap } : null)).catch(() => null)
      )).then((arr) => { if (on) setFilm(arr.filter(Boolean)); });
    }
    // No curated film → no filmstrip. We used to pull geotagged photos near the
    // route here, but for a linear byway those are junk (churches, breweries,
    // even photos of Earth from orbit) — better no filmstrip than a wrong one.
    return () => { on = false; };
  }, [drive.id, drive.lat, drive.lng]);

  // Auto-advance filmstrip
  useEffect(() => {
    if (!film.length) return;
    filmTimer.current = setInterval(() => setFilmIdx((i) => (i + 1) % film.length), 4200);
    return () => clearInterval(filmTimer.current);
  }, [film.length]);

  useEffect(() => { let on = true; ensureMapsLoaded().then((ok) => { if (on) setMapsLoaded(ok); }); return () => { on = false; }; }, []);

  // Real Google map + numbered markers at overlook coords.
  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || mapObjRef.current || !window.google) return;
    const g = window.google;
    const smo = mapOptionsFor(getMapPrefs());
    const map = new g.maps.Map(mapDivRef.current, { mapTypeId: smo.mapTypeId, styles: smo.styles, mapTypeControl: true, streetViewControl: false, fullscreenControl: false, gestureHandling: "cooperative" });
    mapObjRef.current = map;
    map.setCenter({ lat: drive.lat, lng: drive.lng });
    map.setZoom(drive.approxLoc ? 6 : 9); // approximate location → show the region
  }, [mapsLoaded, drive.lat, drive.lng, drive.approxLoc]);

  // Draw the drive: numbered overlook markers where we have them, PLUS a real driving
  // route (Google Directions) — from curated endpoints when present, else routed
  // through the overlooks. Falls back to a dashed connector, then a single anchor pin,
  // so the map is never empty and, wherever possible, shows a route on the road.
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    const g = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    [routeGlowRef, routeCasingRef, routeLineRef].forEach((r) => { if (r.current) { r.current.setMap(null); r.current = null; } });

    // Marker source: the named itinerary's geocoded stops (numbered by their seq,
    // so the map pins match the itinerary list) when enriched; else curated/derived
    // overlooks. hoverIdx holds the marker "key" (seq for itinerary, index for overlooks).
    const itinPts = ((detail && detail.itinerary) || []).filter((s) => s.lat != null);
    const usingItin = itinPts.length >= 2;
    const pts = usingItin ? itinPts : (highlights || []).filter((h) => h.lat != null);

    pts.forEach((h, i) => {
      const key = usingItin ? h.seq : i;
      const mk = new g.maps.Marker({
        position: { lat: h.lat, lng: h.lng }, map, zIndex: 20,
        label: { text: String(usingItin ? h.seq : i + 1), color: "var(--pb-bg)", fontSize: "12px", fontWeight: "800" },
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#e8cf9a", fillOpacity: 1, strokeColor: "#0a1712", strokeWeight: 2 },
      });
      mk.pbKey = key;
      mk.addListener("mouseover", () => setHoverIdx(key));
      mk.addListener("mouseout", () => setHoverIdx(null));
      markersRef.current.push(mk);
    });

    // Roadside attractions from OSM — small category-coloured dots (no pbKey, so the
    // hover-restyle skips them). Native title tooltip shows name + mile.
    const poiList = (detail && detail.pois) || [];
    poiList.forEach((p) => {
      if (p.lat == null) return;
      const c = poiCat(p.type);
      const mk = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng }, map, zIndex: 8,
        title: p.name + (p.mile != null ? " · mi " + p.mile : "") + (p.ele ? " · " + Math.round(p.ele * 3.281) + " ft" : ""),
        // the attraction's name, sitting just below its coloured dot, always visible
        label: { text: p.name, color: c.color, fontSize: "11px", fontWeight: "700", className: "pb-poi-label" },
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 5, fillColor: c.color, fillOpacity: 1, strokeColor: "#0a1712", strokeWeight: 1.4, labelOrigin: new g.maps.Point(0, 2.7) },
      });
      markersRef.current.push(mk);
    });

    const fitTo = (coords) => { if (!coords.length) return; const b = new g.maps.LatLngBounds(); coords.forEach((c) => b.extend(c)); map.fitBounds(b, 60); };
    const solidRoute = (path) => {
      [routeGlowRef, routeCasingRef, routeLineRef].forEach((r) => { if (r.current) { r.current.setMap(null); r.current = null; } });
      // Three-layer cased road for a prominent yet refined line, like a good print
      // map: a soft gold glow, a dark casing that lifts it off the terrain, and a
      // bright warm-gold core on top.
      // Thin, crisp, bright line: marks the route clearly without covering the stop
      // markers or their labels. A slim dark casing keeps it legible on any terrain.
      routeCasingRef.current = new g.maps.Polyline({ path, map, strokeColor: "#0a1712", strokeOpacity: 0.75, strokeWeight: 4.5, zIndex: 3 });
      routeLineRef.current = new g.maps.Polyline({ path, map, strokeColor: "#ffcf2e", strokeOpacity: 1, strokeWeight: 2.4, zIndex: 4 });
      fitTo(path);
    };
    const dashedConnector = () => {
      routeLineRef.current = new g.maps.Polyline({ path: pts.map((h) => ({ lat: h.lat, lng: h.lng })), map, geodesic: true, strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: "#e8cf9a", strokeOpacity: 0.9, scale: 3 }, offset: "0", repeat: "13px" }] });
      fitTo(pts.map((h) => ({ lat: h.lat, lng: h.lng })));
    };
    const anchorPin = () => {
      markersRef.current.push(new g.maps.Marker({ position: { lat: drive.lat, lng: drive.lng }, map, title: drive.name, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 11, fillColor: "#e8cf9a", fillOpacity: 1, strokeColor: "#0a1712", strokeWeight: 2 } }));
      map.setCenter({ lat: drive.lat, lng: drive.lng }); map.setZoom(drive.approxLoc ? 7 : 10);
    };

    // Best case: real OSM road geometry — draw it exactly (no Directions guessing),
    // like a Wikimedia/OSM route map, and frame the whole line.
    const osmLine = (detail && detail.routeLine) || null;
    if (osmLine && osmLine.length >= 2) {
      solidRoute(osmLine.map(([lat, lng]) => ({ lat, lng })));
      return;
    }

    // Build a Directions request: curated endpoints win; else route through overlooks.
    let req = null;
    const e = routeEndpoints;
    if (e && e.from && e.to) {
      req = { origin: e.from, destination: e.to, waypoints: (e.via || []).map((v) => ({ location: v, stopover: false })) };
    } else if (pts.length >= 2) {
      req = { origin: { lat: pts[0].lat, lng: pts[0].lng }, destination: { lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng }, waypoints: pts.slice(1, -1).map((h) => ({ location: { lat: h.lat, lng: h.lng }, stopover: false })) };
    }

    if (req) {
      if (pts.length) fitTo(pts.map((h) => ({ lat: h.lat, lng: h.lng }))); // frame something while Directions resolves
      if (!dirServiceRef.current) dirServiceRef.current = new g.maps.DirectionsService();
      dirServiceRef.current.route({ ...req, travelMode: g.maps.TravelMode.DRIVING }, (res, status) => {
        if (mapObjRef.current !== map) return; // component/map changed under us
        if (status === "OK" && res.routes && res.routes[0]) {
          // Precise per-step geometry (hugs the road), not the decimated overview_path.
          const rt = res.routes[0]; const pathPts = [];
          (rt.legs || []).forEach((l) => (l.steps || []).forEach((st) => (st.path || []).forEach((p) => pathPts.push(p))));
          solidRoute((pathPts.length ? pathPts : rt.overview_path).map((ll) => ({ lat: ll.lat(), lng: ll.lng() })));
        } else if (pts.length >= 2) dashedConnector();
        else if (pts.length === 1) { map.setCenter({ lat: pts[0].lat, lng: pts[0].lng }); map.setZoom(drive.approxLoc ? 8 : 11); }
        else anchorPin();
      });
      return;
    }

    if (pts.length >= 2) dashedConnector();
    else if (pts.length === 1) { map.setCenter({ lat: pts[0].lat, lng: pts[0].lng }); map.setZoom(drive.approxLoc ? 8 : 11); }
    else anchorPin();
  }, [highlights, mapsLoaded, routeEndpoints, drive.lat, drive.lng, drive.approxLoc, drive.name]);

  // Two-way hover link: restyle the hovered marker. Skip when the map only holds
  // the single anchor pin (no numbered overlooks to hover).
  useEffect(() => {
    if (!window.google) return;
    markersRef.current.forEach((mk) => {
      if (mk.pbKey == null) return;
      const on = mk.pbKey === hoverIdx;
      mk.setIcon({ path: window.google.maps.SymbolPath.CIRCLE, scale: on ? 17 : 12, fillColor: on ? "#1d4a37" : "#e8cf9a", fillOpacity: 1, strokeColor: on ? "#e8cf9a" : "#0a1712", strokeWeight: on ? 3 : 2 });
      const lbl = mk.getLabel() || {};
      mk.setLabel({ ...lbl, color: on ? "#fff" : "var(--pb-bg)", fontSize: "12px", fontWeight: "800" });
    });
  }, [hoverIdx]);

  const hl = highlights || [];
  const itinerary = (detail && detail.itinerary) || [];
  const hasItinerary = itinerary.filter((s) => s.lat != null).length >= 2; // named itinerary drives the map
  const hasOverlooks = hasItinerary || hl.some((h) => h.lat != null); // numbered markers on the map
  const hasRoute = hasOverlooks || !!(routeEndpoints && routeEndpoints.from && routeEndpoints.to); // a line gets drawn
  const ti = TIER_INFO[drive.tier] || TIER_INFO.byway;
  const pill = (k, v) => (
    <span style={{ display: "inline-flex", flexDirection: "column", background: "rgba(10,26,18,.5)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 15, padding: "10px 16px" }}>
      <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(217,183,121,.65)" }}>{k}</span>
      <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.15rem", color: "var(--pb-ink)", lineHeight: 1, marginTop: 3 }}>{v}</span>
    </span>
  );

  const roadDot = road && road.state === "closed" ? "#d0563a" : road && road.state === "caution" ? "#e0a53a" : road && road.state === "unknown" ? "#8a9a90" : "#46d97f";

  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", fontFamily: "var(--pb-sans)" }}>
      <style>{KEYFRAMES}</style>
      <SiteHeader active="drives" />

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "min(88vh,760px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "clamp(80px,12vh,140px) clamp(16px,4vw,40px) clamp(40px,6vh,64px)" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--pb-surface)" }}>
          {heroUrl && <img className="sd-anim" alt={drive.name} src={heroUrl} style={{ position: "absolute", inset: "-6%", width: "112%", height: "112%", objectFit: "cover", transformOrigin: "60% 40%", animation: "sd-ken 26s ease-in-out infinite alternate" }} />}
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.42) 0%,rgba(9,24,16,.05) 34%,rgba(9,24,16,.55) 82%,rgba(9,24,16,.86) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 80% 0%,rgba(228,190,120,.14),transparent 55%)" }} />
        <div style={{ position: "absolute", top: "clamp(64px,9vh,88px)", right: "clamp(16px,4vw,40px)", zIndex: 4 }}><Badge tier={drive.tier} /></div>
        <div style={{ position: "relative", zIndex: 3, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div className="sd-anim" style={{ fontFamily: mono, fontSize: ".68rem", fontWeight: 700, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-gold)", animation: "sd-fadeup .6s ease both" }}>{drive.regionLabel} · {drive.states}</div>
          <h1 className="sd-anim" style={{ fontFamily: serif, fontWeight: 800, color: "var(--pb-ink)", fontSize: "clamp(2.6rem,7.4vw,5.4rem)", lineHeight: .94, letterSpacing: "-.025em", textShadow: "0 6px 40px rgba(0,0,0,.5)", marginTop: 12, maxWidth: "16ch", animation: "sd-fadeup .7s .06s ease both" }}>{drive.name}</h1>
          <div className="sd-anim" style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center", marginTop: 22, animation: "sd-fadeup .75s .14s ease both" }}>
            {pill("Length", drive.length)}{pill("States", drive.states)}{drive.time && pill("Drive time", drive.time)}
          </div>
        </div>
      </section>

      <div style={{ position: "relative", zIndex: 5, background: "var(--pb-bg)", borderRadius: "30px 30px 0 0", marginTop: -30, boxShadow: "0 -30px 70px -34px rgba(8,18,12,.6)" }}>
        {/* THE ROAD — which real, signed route this byway is, and where it runs */}
        {detail && detail.source && detail.source.roadArticle && itinerary.length >= 2 && (() => {
          const dec = (s) => String(s || "").replace(/&#0?39;/g, "’").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
          const road = dec(detail.source.roadArticle);
          const first = itinerary[0], last = itinerary[itinerary.length - 1];
          const totalMi = last.mileFromStart != null ? Math.round(last.mileFromStart) : drive.lengthMi;
          return (
            <section style={{ padding: "clamp(18px,2.6vh,26px) clamp(16px,4vw,40px) 0" }}>
              <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "clamp(12px,2vw,20px)", flexWrap: "wrap", background: "linear-gradient(135deg,var(--pb-surface),var(--pb-surface-2))", border: "1px solid rgba(217,183,121,.26)", borderRadius: 18, padding: "clamp(12px,1.8vw,16px) clamp(14px,2.2vw,20px)", boxShadow: "0 18px 44px -30px rgba(28,46,34,.5)" }}>
                  <span aria-hidden style={{ flex: "none", width: 46, height: 46, borderRadius: 12, background: "linear-gradient(145deg,#e8cf9a,var(--pb-gold))", color: "#5a3f12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", boxShadow: "0 6px 16px -6px rgba(0,0,0,.5)" }}>🛣️</span>
                  <div style={{ flex: "1 1 auto", minWidth: 180 }}>
                    <div style={{ fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>The road you follow</div>
                    <div style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.15rem,2.4vw,1.55rem)", color: "var(--pb-ink)", lineHeight: 1.15, marginTop: 2 }}>{road}</div>
                  </div>
                  <div style={{ flex: "none", alignSelf: "stretch", width: 1, background: "rgba(217,183,121,.22)" }} />
                  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: "clamp(8px,1.4vw,14px)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                      <span style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Runs</span>
                      <span style={{ fontSize: ".92rem", fontWeight: 700, color: "var(--pb-ink)" }}>{first.place} <span style={{ color: "var(--pb-gold)" }}>→</span> {last.place}</span>
                    </div>
                    {totalMi ? (
                      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                        <span style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Length</span>
                        <span style={{ fontSize: ".92rem", fontWeight: 700, color: "var(--pb-ink)" }}>~{totalMi} mi</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ROAD STATUS */}
        <section style={{ padding: "clamp(22px,3.5vh,34px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ position: "relative", overflow: "hidden", background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 22, padding: "clamp(16px,2.4vw,22px)", boxShadow: "0 22px 54px -34px rgba(28,46,34,.5)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, flex: "1 1 auto", minWidth: 240 }}>
                  <span className="sd-anim" style={{ width: 16, height: 16, borderRadius: "50%", background: roadDot, boxShadow: "0 0 12px 1px " + roadDot, flex: "none", animation: "sd-pulse 2.2s infinite" }} />
                  <div>
                    <b style={{ fontFamily: serif, fontWeight: 800, fontSize: "1.35rem", color: "var(--pb-ink)", lineHeight: 1 }}>
                      {road === undefined ? "Checking road status…" : (road && road.label) ? road.label : (drive.parkCode ? "Status unavailable — see official page" : "Seasonal mountain road")}
                    </b>
                    <div style={{ fontSize: ".94rem", color: "var(--pb-ink-2)", lineHeight: 1.5, marginTop: 5, fontWeight: 600 }}>
                      {road && road.alerts && road.alerts.length ? road.alerts[0].title : drive.season ? "Typically open " + drive.season + "." : "Check the official page for current conditions."}
                    </div>
                  </div>
                </div>
                {drive.season && (
                  <div style={{ flex: "none", alignSelf: "center", display: "inline-flex", flexDirection: "column", gap: 2, background: "var(--pb-surface-2)", border: "1px solid rgba(217,183,121,.22)", borderRadius: 14, padding: "9px 14px" }}>
                    <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Open season</span>
                    <span style={{ fontSize: ".82rem", fontWeight: 700, color: "var(--pb-ink)" }}>{drive.season}</span>
                  </div>
                )}
              </div>
              {road && road.alerts && road.alerts.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(217,183,121,.16)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {road.alerts.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>
                      <b style={{ color: a.category === "Park Closure" ? "var(--pb-hold)" : a.category === "Danger" || a.category === "Caution" ? "var(--pb-gold-soft)" : "var(--pb-go)" }}>{a.title}</b>
                      {a.description ? " — " + a.description : ""}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: ".76rem", color: "var(--pb-muted)", marginTop: 12 }}>
                {road && road.credit ? road.credit + " " : ""}Always confirm on the official page before you go. <a href={drive.link} target="_blank" rel="noreferrer" style={{ color: "var(--pb-gold)", fontWeight: 700, textDecoration: "none" }}>Official road status ↗</a>
              </div>
            </div>
          </div>
        </section>

        {/* INTRINSIC QUALITIES — only when we have the real designation data */}
        {(drive.qualities && drive.qualities.length > 0) && (
        <section style={{ padding: "clamp(24px,3.5vh,40px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Designated for its</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {(drive.qualities || []).map((q, i) => {
                const m = QUAL_META[q] || { ic: "◈", d: "" };
                return (
                  <span key={q} className="sd-anim" style={{ animation: "sd-chip .5s " + (0.05 + i * 0.08) + "s both", display: "inline-flex", alignItems: "center", gap: 11, background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 16, padding: "11px 16px 11px 13px", boxShadow: "0 14px 34px -22px rgba(28,46,34,.4)" }}>
                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 11, background: "linear-gradient(145deg,#e8cf9a,var(--pb-gold))", color: "#5a3f12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{m.ic}</span>
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}><b style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.02rem", color: "var(--pb-ink)" }}>{q}</b><span style={{ fontSize: ".72rem", color: "var(--pb-muted)" }}>{m.d}</span></span>
                  </span>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {/* THE DRIVE */}
        <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 8 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.5rem,3.4vw,2.1rem)", color: "var(--pb-ink)", lineHeight: 1.1 }}>The drive</h2>
            <p style={{ fontSize: "clamp(1rem,1.5vw,1.12rem)", color: "var(--pb-ink-2)", lineHeight: 1.72 }}>{drive.blurb || ("A " + (drive.tier === "all-american" ? "top-tier All-American Road" : drive.tier === "landmark" ? "nationally significant historic road" : "National Scenic Byway") + " in " + drive.states + ". Federally recognized as one of America's most scenic drives — see the official page for the full route and what to see along the way.")}</p>
          </div>
        </section>

        {/* ABOUT THE DESIGNATION — real National Scenic Byways Program facts, on every drive */}
        <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ position: "relative", overflow: "hidden", background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 24, padding: "clamp(20px,3vw,32px)", boxShadow: "0 22px 54px -34px rgba(28,46,34,.5)" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(90% 120% at 92% 0%,rgba(228,190,120,.1),transparent 55%)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>What the designation means</div>
                <h2 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.5rem,3.2vw,2.2rem)", color: "var(--pb-ink)", lineHeight: 1.12, marginTop: 8 }}>
                  {ti.label}<span style={{ color: "var(--pb-muted)", fontWeight: 600 }}> — {ti.lead}</span>
                </h2>
                <p style={{ fontSize: "clamp(.98rem,1.4vw,1.08rem)", color: "var(--pb-ink-2)", lineHeight: 1.72, marginTop: 12, maxWidth: "72ch" }}>{ti.body}</p>
                <p style={{ fontSize: ".92rem", color: "var(--pb-muted)", lineHeight: 1.7, marginTop: 12, maxWidth: "72ch" }}>
                  America&rsquo;s Byways are designated by the U.S. Secretary of Transportation under the National Scenic Byways Program — created by Congress in 1991 and administered by the Federal Highway Administration. A road earns its place by demonstrating one or more of six intrinsic qualities:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, marginTop: 16 }}>
                  {Object.keys(QUAL_META).map((q) => {
                    const m = QUAL_META[q];
                    const owned = (drive.qualities || []).includes(q);
                    return (
                      <div key={q} style={{ display: "flex", alignItems: "flex-start", gap: 11, background: owned ? "linear-gradient(145deg,rgba(232,207,154,.16),rgba(217,183,121,.05))" : "var(--pb-surface-2)", border: "1px solid " + (owned ? "rgba(217,183,121,.42)" : "rgba(217,183,121,.12)"), borderRadius: 14, padding: "12px 14px" }}>
                        <span style={{ width: 30, height: 30, flex: "none", borderRadius: 9, background: "linear-gradient(145deg,#e8cf9a,var(--pb-gold))", color: "#5a3f12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem" }}>{m.ic}</span>
                        <div style={{ lineHeight: 1.25 }}>
                          <b style={{ fontFamily: serif, fontWeight: 700, fontSize: ".98rem", color: "var(--pb-ink)" }}>{q}{owned ? " ✓" : ""}</b>
                          <div style={{ fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 2 }}>{m.d}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(drive.qualities && drive.qualities.length > 0) && (
                  <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", marginTop: 16, lineHeight: 1.6 }}>
                    <b style={{ color: "var(--pb-gold-soft)" }}>{drive.name}</b> is recognized for its {drive.qualities.map((q) => q.toLowerCase()).join(", ")} {drive.qualities.length === 1 ? "quality" : "qualities"} — marked ✓ above.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ROUTE MAP */}
        <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>The route</h2>
              <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{hasItinerary ? "Numbered stops ↔ the itinerary below" : hasOverlooks ? "Hover an overlook ↔ its map marker" : hasRoute ? "The drive, on the road" : drive.approxLoc ? "Approximate area" : "Route overview"}</span>
            </div>
            <figure style={{ position: "relative", margin: "14px 0 0", height: "clamp(320px,48vh,500px)", overflow: "hidden", borderRadius: 24, border: "1px solid rgba(217,183,121,.16)", background: "var(--pb-surface)" }}>
              <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
              {detail && detail.pois && detail.pois.length >= 3 && (
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3, background: "rgba(15,32,24,.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 12, padding: "9px 11px", display: "grid", gap: 5, maxWidth: 150 }}>
                  <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", marginBottom: 1 }}>Along the route</div>
                  {[...new Set(detail.pois.map((p) => p.type))].slice(0, 8).map((t) => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".64rem", fontWeight: 600, color: "var(--pb-ink)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: poiCat(t).color, flex: "none" }} />
                      {poiCat(t).label}
                    </span>
                  ))}
                </div>
              )}
              <figcaption style={{ position: "absolute", left: 14, bottom: 14, zIndex: 3, background: "rgba(21,36,28,.82)", color: "var(--pb-ink)", fontSize: ".72rem", fontWeight: 700, borderRadius: 999, padding: "6px 14px", pointerEvents: "none" }}>{drive.mapCap || (hasOverlooks ? drive.states + " · overlooks along the route" : hasRoute ? drive.states + " · driving route" : drive.approxLoc ? "Approximate area — see the official page for the turn-by-turn route" : drive.states + " · see the official page for the full route")}</figcaption>
            </figure>
          </div>
        </section>

        {/* NAMED SCENIC ITINERARY — system-generated from the byway's Wikipedia record */}
        {detail && detail.itinerary && detail.itinerary.length >= 2 && (
          <section style={{ padding: "clamp(20px,3vh,32px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 820, margin: "0 auto" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--pb-surface-2)", border: "1px solid rgba(217,183,121,.28)", borderRadius: 999, padding: "5px 12px 5px 10px" }}>
                <span aria-hidden style={{ fontSize: ".82rem" }}>⚙</span>
                <span style={{ fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>
                  System-generated itinerary · America&rsquo;s Byways{detail.designation === "All-American Road" ? " · All-American Road" : ""}
                </span>
              </div>
              <h2 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.6rem,3.4vw,2.3rem)", color: "var(--pb-ink)", lineHeight: 1.1, marginTop: 12 }}>
                The {drive.name}
                <span style={{ color: "var(--pb-muted)", fontWeight: 600 }}> — Scenic Itinerary</span>
              </h2>
              <p style={{ fontSize: ".9rem", color: "var(--pb-muted)", lineHeight: 1.6, marginTop: 6, maxWidth: "64ch" }}>
                Every stop below is drawn automatically from the official byway record and the route&rsquo;s Wikipedia article — the towns and landmarks you pass, in order, with the miles between them. {hasItinerary ? "Hover a stop to find it on the map." : ""}
              </p>
              <RouteItinerary itinerary={detail.itinerary} hoverKey={hoverIdx} onHover={setHoverIdx} />
            </div>
          </section>
        )}

        {/* HISTORY — from the Wikipedia article (CC BY-SA; attributed in Sources) */}
        {detail && detail.history && detail.history.paragraphs && detail.history.paragraphs.length > 0 && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 820, margin: "0 auto" }}>
              <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>The story of the road</div>
              <h2 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.5rem,3.2vw,2.1rem)", color: "var(--pb-ink)", lineHeight: 1.12, marginTop: 6 }}>History</h2>
              <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
                {detail.history.paragraphs.map((p, i) => (
                  <p key={i} style={{ fontSize: "clamp(.98rem,1.4vw,1.08rem)", color: "var(--pb-ink-2)", lineHeight: 1.72 }}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SCENIC STOPS & ATTRACTIONS — every roadside point from OSM */}
        {detail && detail.pois && detail.pois.length >= 3 && <RouteAttractions pois={detail.pois} />}

        {/* PHOTOS ALONG THE DRIVE — Commons gallery built at generation time */}
        {detail && detail.gallery && detail.gallery.length >= 3 && <RoutePhotos photos={detail.gallery} />}

        {/* FILMSTRIP */}
        {film.length > 0 && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Along the drive</h2>
                <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Auto-advancing · tap the dots</span>
              </div>
              <div style={{ marginTop: 14, position: "relative", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(217,183,121,.16)", background: "var(--pb-surface)", boxShadow: "0 30px 70px -40px rgba(8,18,12,.7)" }}>
                <div style={{ display: "flex", transition: "transform .7s cubic-bezier(.4,0,.15,1)", transform: "translateX(-" + filmIdx * 100 + "%)" }}>
                  {film.map((f, i) => (
                    <figure key={i} style={{ flex: "0 0 100%", margin: 0, position: "relative", aspectRatio: "16/9", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 14px,var(--pb-surface) 14px 28px)", overflow: "hidden" }}>
                      {f.url && <img src={f.url} alt={f.cap || ""} loading={i <= 1 ? "eager" : "lazy"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                    </figure>
                  ))}
                </div>
                <button onClick={() => setFilmIdx((i) => (i - 1 + film.length) % film.length)} aria-label="Previous" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 4, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", background: "rgba(15,32,24,.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "var(--pb-ink)", fontSize: "1.1rem", cursor: "pointer" }}>‹</button>
                <button onClick={() => setFilmIdx((i) => (i + 1) % film.length)} aria-label="Next" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 4, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", background: "rgba(15,32,24,.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "var(--pb-ink)", fontSize: "1.1rem", cursor: "pointer" }}>›</button>
                {film[filmIdx] && (film[filmIdx].cap || film[filmIdx].date) && (
                  <div style={{ position: "absolute", left: 16, bottom: 14, zIndex: 4, background: "rgba(21,36,28,.82)", color: "var(--pb-ink)", fontSize: ".72rem", fontWeight: 700, borderRadius: 999, padding: "6px 14px" }}>{(filmIdx + 1) + " / " + film.length}{film[filmIdx].cap ? " · " + film[filmIdx].cap : ""}{film[filmIdx].date ? " · " + film[filmIdx].date : ""}</div>
                )}
                <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 4, display: "flex", gap: 6 }}>
                  {film.map((_, i) => <span key={i} onClick={() => setFilmIdx(i)} style={{ width: 8, height: 8, borderRadius: "50%", background: i === filmIdx ? "var(--pb-gold)" : "rgba(217,183,121,.4)", cursor: "pointer" }} />)}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HIGHLIGHTS — hidden when a named itinerary already lists the stops */}
        {hl.length > 0 && !hasItinerary && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Highlights along the way</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 16 }}>
                {hl.map((h, i) => <HighlightCard key={i} h={h} i={i} active={hoverIdx === i} onHover={setHoverIdx} />)}
              </div>
            </div>
          </section>
        )}

        {/* CROSS-LINKS */}
        {cross && cross.length > 0 && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "var(--pb-ink)" }}>Parks &amp; trails on this route</h2>
                <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Cross-links into ParkBuddy</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
                {cross.map((c, i) => <CrossTile key={i} c={c} />)}
              </div>
            </div>
          </section>
        )}

        {/* SOURCES & ATTRIBUTION — every enriched fact is traced (CC BY-SA compliance) */}
        {detail && (detail.attribution || (detail.references && detail.references.length) || (detail.sources && detail.sources.length)) && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 820, margin: "0 auto" }}>
              <div style={{ background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 22, padding: "clamp(18px,2.6vw,26px)" }}>
                <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Where this comes from</div>
                <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.2rem,2.6vw,1.6rem)", color: "var(--pb-ink)", marginTop: 6 }}>Sources</h2>
                {detail.sources && detail.sources.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {detail.sources.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, background: "var(--pb-surface-2)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 999, padding: "6px 13px", fontSize: ".78rem", fontWeight: 700, color: "var(--pb-ink)" }}>
                        {s.name}<span style={{ color: "var(--pb-gold)" }}>↗</span>
                      </a>
                    ))}
                  </div>
                )}
                {detail.attribution && detail.attribution.text && (
                  <p style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 14 }}>
                    {detail.attribution.text}{" "}
                    <a href={detail.attribution.licenseUrl} target="_blank" rel="noreferrer" style={{ color: "var(--pb-gold)", fontWeight: 700, textDecoration: "none" }}>{detail.attribution.license} ↗</a>
                  </p>
                )}
                {detail.references && detail.references.length > 0 && (
                  <details style={{ marginTop: 14 }}>
                    <summary style={{ cursor: "pointer", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{detail.references.length} cited references</summary>
                    <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 7 }}>
                      {detail.references.map((r, i) => (
                        <li key={i} style={{ fontSize: ".78rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>
                          {r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--pb-ink-2)", textDecorationColor: "rgba(217,183,121,.5)" }}>{r.text}</a> : r.text}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          </section>
        )}

        {/* PLAN */}
        <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) clamp(40px,6vh,60px)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#1d4a37,#122e22)", borderRadius: 26, padding: "clamp(22px,3.5vw,34px)", boxShadow: "0 30px 70px -40px rgba(8,18,12,.8)" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(90% 120% at 90% 0%,rgba(228,190,120,.16),transparent 60%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 22, alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(217,183,121,.6)" }}>Plan this drive</div>
                  <h2 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.5rem,3vw,2.1rem)", color: "var(--pb-ink)", marginTop: 8, lineHeight: 1.08 }}>Time it for the open season</h2>
                  <p style={{ fontSize: ".95rem", color: "rgba(217,183,121,.85)", lineHeight: 1.65, marginTop: 10, maxWidth: "52ch" }}>{drive.planNote || ("Best driven " + (drive.season || "in the warm months") + " — check the official page for current road status and any seasonal closures before you go.")}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "rgba(217,183,121,.08)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 16, padding: "14px 16px" }}>
                    <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(217,183,121,.55)" }}>Best season</div>
                    <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.3rem", color: "var(--pb-ink)", marginTop: 4 }}>{drive.season || "Warm months"}</div>
                  </div>
                  <a href={drive.link} target="_blank" rel="noreferrer" style={{ textAlign: "center", textDecoration: "none", fontFamily: "inherit", fontSize: ".84rem", fontWeight: 800, color: "var(--pb-ink)", background: "linear-gradient(120deg,var(--pb-gold),var(--pb-gold-2))", padding: "11px 18px", borderRadius: 999 }}>Official byway page ↗</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer style={{ textAlign: "center", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", padding: 22, borderTop: "1px solid rgba(217,183,121,.16)" }}>Designation from federal byway records · {detail ? "Route & history via Wikipedia (CC BY-SA) · " : ""}Photos via Wikimedia · Road status via NPS · ParkBuddy</footer>
      </div>
    </div>
  );
}

function HighlightCard({ h, i, active, onHover }) {
  // Name-only (no geo fallback): the nearest geotagged photo to a highlight's
  // coordinate is unreliable (verified live: ISS "View of Earth" shots, a moth,
  // a wildflower). Match by the feature's name or show the placeholder.
  const photo = usePhoto(Array.isArray(h.q) ? h.q.join("|") : h.q || h.n, null, null);
  return (
    <div onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)} style={{ background: "var(--pb-surface)", border: "1px solid " + (active ? "var(--pb-gold)" : "rgba(217,183,121,.16)"), borderRadius: 20, overflow: "hidden", boxShadow: active ? "0 24px 50px -22px rgba(28,46,34,.6)" : "0 18px 44px -24px rgba(28,46,34,.4)", transform: active ? "translateY(-4px)" : "none", transition: "transform .25s,box-shadow .25s,border-color .25s" }}>
      <figure style={{ position: "relative", aspectRatio: "4/3", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }}>
        {photo && photo.url && <img src={photo.url} alt={h.n} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <span style={{ position: "absolute", left: 10, top: 10, width: 26, height: 26, borderRadius: "50%", background: "rgba(21,36,28,.82)", color: "var(--pb-gold)", fontFamily: mono, fontSize: ".72rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
      </figure>
      <div style={{ padding: "13px 15px 15px" }}>
        <b style={{ fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: "1.05rem", lineHeight: 1.15, display: "block" }}>{h.n}</b>
        <div style={{ fontSize: ".8rem", color: "var(--pb-ink-2)", lineHeight: 1.5, marginTop: 5 }}>{h.d}</div>
      </div>
    </div>
  );
}
