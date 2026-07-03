"use client";

// /explore — native React port of Explore.dc.html (design fidelity required).
// Layout, colors, spacing and copy reproduce the design file 1:1. Data is REAL:
//  • Parks: the 63 national parks from /trip-data.js (window.TRIP_PARKS)
//  • Verdicts: live, via /pb-verdict.js (weather.gov) — bucketed to the design's
//    Go / Prepare / Hold off legend (loading grey until each verdict lands)
//  • Gateway towns: /gateway-towns.js (window.PB_GATEWAY)
//  • Maps key: NEXT_PUBLIC_GMAPS_KEY (Netlify env) → else the design's
//    paste-a-key overlay (kept as designed, stored in localStorage)
// The design's sample cross-type destinations (state parks / forests /
// campgrounds) and the NPS-photo-key panel are kept verbatim per the spec.

import { useEffect, useRef, useState } from "react";
import loadScript from "../components/load-script";
// Lakes and trails come live from /api/water (USGS GNIS) and /api/trails (NPS
// Public Trails) — government ArcGIS REST services, no auth/rate-limiting/
// seeding needed (unlike OpenStreetMap/Overpass, which blocks datacenter IPs).
// Both are scoped to the selected park, same as campgrounds (/api/places).

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

// State parks and national forests are NOT hardcoded — they load live from the
// real API as you pan the map (/api/destinations by bbox). Campgrounds/rec-areas,
// lakes, and trail layers all load per selected park (/api/places, /api/water,
// /api/trails), and park boundaries come from the NPS boundary topojson — same
// sources and styling as the legacy homepage map.

// Trail polyline colors (legacy s0.js values).
const TRAIL_STYLE = { hiking: "#3f7a34", offroad: "#a15a2a", ski: "#2a6f9e" };
const TRAIL_CAT_META = {
  hiking: { icon: "🥾", label: "Hiking trail" },
  offroad: { icon: "🚙", label: "Off-road / 4x4 route" },
  ski: { icon: "⛷️", label: "Ski route" },
};
const BOUNDARY_URL = (code) =>
  "https://raw.githubusercontent.com/nationalparkservice/data/gh-pages/base_data/boundaries/parks/" + code + ".topojson";

// Fallback center (continental US) if browser geolocation is denied/unavailable.
const USER_LOC = { lat: 39.8283, lng: -98.5795 };
const AVG_MPH = 45;

// Parks with NO road connecting them to the outside road network — a distinct
// fact from "sparse map data," and important enough to surface before someone
// plans a drive there. Curated from well-established NPS access info (not
// inferred from live data, which wouldn't be reliable for this).
const NO_ROAD_ACCESS = {
  "Gates of the Arctic": "No roads reach this park — access is by small plane, boat, or on foot only.",
  "Kobuk Valley": "No roads reach this park — access is by small plane, boat, or on foot only.",
  "Lake Clark": "No roads reach this park — access is by small plane or boat only.",
  Katmai: "No roads connect to this park — most visitors arrive by small plane or boat (e.g. to Brooks Camp).",
  "Isle Royale": "No roads or bridges reach this island park — access is by ferry or seaplane only; no cars are allowed on the island.",
  "Dry Tortugas": "No roads reach this park — it's 70 miles from Key West, accessible only by boat or seaplane.",
  "Virgin Islands": "No roads connect from the mainland U.S. — access is by ferry or flight to St. Thomas/St. John.",
  "Nat. Park of American Samoa": "No roads connect from the mainland U.S. — access is by flight to Pago Pago, American Samoa.",
};
// Has some limited/seasonal road access, but most of the park is roadless.
const LIMITED_ROAD_ACCESS = {
  "Wrangell–St. Elias": "Only a small part of this park is road-accessible (the unpaved McCarthy Road) — the rest is roadless wilderness reached by plane or on foot.",
};
function roadAccessNote(name) {
  if (NO_ROAD_ACCESS[name]) return { level: "none", text: NO_ROAD_ACCESS[name] };
  if (LIMITED_ROAD_ACCESS[name]) return { level: "limited", text: LIMITED_ROAD_ACCESS[name] };
  return null;
}

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
  // Live-loaded destinations usually already carry the suffix in their name
  // ("Custer State Park", "Dixie National Forest") — appending it again broke
  // the Wikipedia lookup, which is why only national parks had photos.
  if (!suffix || new RegExp(suffix.trim().replace(/ /g, "\\s+") + "s?$", "i").test(p.name.trim())) return p.name;
  return p.name + suffix;
}

/* ---------------- photo pipeline (server-side; no browser-stored key) ---------------- */

// v2 key: v1 cached permanent `false` failures caused by the double-suffix bug
// above, so returning visitors would never retry those photos.
let photoCache = null;
function getPhotoCache() {
  if (photoCache) return photoCache;
  try { photoCache = JSON.parse(localStorage.getItem("pb_photo_cache_v2") || "{}"); } catch { photoCache = {}; }
  return photoCache;
}
function savePhotoCache() {
  try { localStorage.setItem("pb_photo_cache_v2", JSON.stringify(photoCache)); } catch {}
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

// Best-effort trail photo — most trails have no dedicated Wikipedia page (no
// photo is expected and fine), but well-known ones often do (Bright Angel
// Trail, Angels Landing, Highline Trail). Same /api/photo pipeline as parks,
// keyed with a "trail:" cache prefix so it never collides with a park's cache
// entry of the same or overlapping name.
function fetchTrailPhoto(name, state) {
  const cache = getPhotoCache();
  const key = "trail:" + name;
  const cached = cache[key];
  if (cached) return Promise.resolve(cached);
  if (cached === false) return Promise.resolve(null);
  const apply = (url) => { cache[key] = url || false; savePhotoCache(); return url || null; };
  return fetch("/api/photo?name=" + encodeURIComponent(name) + "&state=" + encodeURIComponent(state || ""))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => apply(d && d.found ? (d.thumb || d.image) : null))
    .catch(() => apply(null));
}

function TrailPhoto({ name, state }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    setUrl(null);
    fetchTrailPhoto(name, state).then((u) => { if (on) setUrl(u); });
    return () => { on = false; };
  }, [name, state]);
  if (!url) return null;
  return <img src={url} alt="" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 12, display: "block" }} />;
}

/* ---------------- trail enrichment: elevation gain (computed) + estimates ---------------- */
// NPS's own trail dataset has no elevation, difficulty rating, time estimate, or
// route-type field — only geometry + surface/class/etc (already used above).
// Elevation gain is computed via Google's ElevationService (part of the core
// Maps JS API, no extra library needed); difficulty/time/route-type are then
// derived from length + gain. All clearly labeled "Est." in the UI since
// they're computed, not authoritative trail-agency ratings.

let elevCache = null;
function getElevCache() {
  if (elevCache) return elevCache;
  try { elevCache = JSON.parse(localStorage.getItem("pb_elev_cache_v1") || "{}"); } catch { elevCache = {}; }
  return elevCache;
}
function saveElevCache() {
  try { localStorage.setItem("pb_elev_cache_v1", JSON.stringify(elevCache)); } catch {}
}

// Lazy: only called when a trail's own detail panel opens, not for a whole
// park's trail list, to avoid unnecessary Elevation API calls.
function fetchElevationGainFt(key, path) {
  const cache = getElevCache();
  if (cache[key] !== undefined) return Promise.resolve(cache[key]);
  if (!window.google || !window.google.maps || !Array.isArray(path) || path.length < 2) return Promise.resolve(null);
  return new Promise((resolve) => {
    const svc = new window.google.maps.ElevationService();
    svc.getElevationForLocations({ locations: path.map(([lat, lng]) => ({ lat, lng })) }, (results, status) => {
      let gainFt = null;
      if (status === "OK" && results && results.length > 1) {
        let gainM = 0;
        for (let i = 1; i < results.length; i++) {
          const d = results[i].elevation - results[i - 1].elevation;
          if (d > 0) gainM += d;
        }
        gainFt = Math.round(gainM * 3.28084);
      }
      const c = getElevCache();
      c[key] = gainFt;
      saveElevCache();
      resolve(gainFt);
    });
  });
}

// Naismith's-rule-style estimate: ~2 mph base pace + 30 min per 1000 ft of gain.
function estimateTimeLabel(mi, gainFt) {
  const minutes = mi * 30 + (gainFt / 1000) * 30;
  if (minutes < 60) return Math.round(minutes / 5) * 5 + " min";
  const h = Math.floor(minutes / 60), m = Math.round((minutes % 60) / 5) * 5;
  return h + "h" + (m ? " " + m + "m" : "");
}
function estimateDifficulty(mi, gainFt) {
  if (mi <= 3 && gainFt <= 500) return "Easy";
  if (mi <= 8 && gainFt <= 1500) return "Moderate";
  return "Hard";
}
// Geometric guess only — a real point-to-point (shuttle) trail looks identical
// to an out-and-back in pure geometry, so this can only reliably detect loops.
function routeTypeFor(path) {
  if (!Array.isArray(path) || path.length < 3) return "Out & back";
  const [lat1, lng1] = path[0], [lat2, lng2] = path[path.length - 1];
  return milesBetween({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) < 0.15 ? "Loop" : "Out & back";
}

const trailStatLabel = { fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#8c8473", marginBottom: 3 };
const trailStatValue = { fontSize: ".92rem", color: "#163a2b" };

function TrailStats({ tr }) {
  const [gainFt, setGainFt] = useState(undefined); // undefined = loading, null = unavailable
  useEffect(() => {
    let on = true;
    setGainFt(undefined);
    fetchElevationGainFt("trail:" + tr.parkName + "|" + tr.name, tr.path).then((g) => { if (on) setGainFt(g); });
    return () => { on = false; };
  }, [tr.parkName, tr.name, tr.path]);

  const lengthMi = tr.lengthMi > 0 ? tr.lengthMi : null;
  const canEstimate = lengthMi != null && typeof gainFt === "number";

  return (
    <>
      <div>
        <div style={trailStatLabel}>Elevation gain</div>
        <b style={trailStatValue}>{gainFt === undefined ? "…" : gainFt == null ? "Unknown" : gainFt + " ft"}</b>
      </div>
      <div>
        <div style={trailStatLabel}>Est. route type</div>
        <b style={trailStatValue}>{routeTypeFor(tr.path)}</b>
      </div>
      {canEstimate && (
        <div>
          <div style={trailStatLabel}>Est. time</div>
          <b style={trailStatValue}>{estimateTimeLabel(lengthMi, gainFt)}</b>
        </div>
      )}
      {canEstimate && (
        <div>
          <div style={trailStatLabel}>Est. difficulty</div>
          <b style={trailStatValue}>{estimateDifficulty(lengthMi, gainFt)}</b>
        </div>
      )}
    </>
  );
}

/* ---------------- trail reviews & ratings ---------------- */
// Reuses the SAME Supabase client + session already set up by public/auth.js
// (window.__ppAuth.supa) rather than instantiating a second client — one
// session/auth source of truth. auth.js loads async on boot, so poll briefly
// until it's ready instead of assuming it's already there.

function useSupabaseClient() {
  const [supa, setSupa] = useState(null);
  useEffect(() => {
    if (window.__ppAuth && window.__ppAuth.supa) { setSupa(window.__ppAuth.supa); return; }
    const t = setInterval(() => {
      if (window.__ppAuth && window.__ppAuth.supa) { setSupa(window.__ppAuth.supa); clearInterval(t); }
    }, 300);
    return () => clearInterval(t);
  }, []);
  return supa;
}

function StarRow({ value, onChange, size }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={onChange ? () => onChange(n) : undefined} style={{ cursor: onChange ? "pointer" : "default", color: n <= value ? "#c79a4b" : "#d9d3c2", fontSize: size || "1.1rem", lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
}

// trail_reviews needs a stable trail id (the NPS OBJECTID) — see
// supabase-trail-reviews.sql. tr.id is only present once /api/trails has been
// updated to return it (already done), so this degrades to nothing rather
// than erroring for any stale cached trail objects without one.
function ReviewsSection({ tr }) {
  const supa = useSupabaseClient();
  const [reviews, setReviews] = useState(null); // null = loading
  const [user, setUser] = useState(null);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supa) return;
    let on = true;
    supa.auth.getSession().then(({ data }) => { if (on) setUser((data && data.session && data.session.user) || null); });
    const { data: sub } = supa.auth.onAuthStateChange((_evt, session) => { if (on) setUser((session && session.user) || null); });
    return () => { on = false; sub && sub.subscription && sub.subscription.unsubscribe(); };
  }, [supa]);

  useEffect(() => {
    if (!supa || tr.id == null) return;
    let on = true;
    setReviews(null);
    supa.from("trail_reviews").select("*").eq("trail_id", String(tr.id)).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (on) setReviews(error ? [] : (data || [])); });
    return () => { on = false; };
  }, [supa, tr.id]);

  useEffect(() => {
    if (!user || !reviews) return;
    const mine = reviews.find((r) => r.user_id === user.id);
    if (mine) { setMyRating(mine.rating); setMyText(mine.review_text || ""); }
  }, [user, reviews]);

  if (tr.id == null) return null;

  const avg = reviews && reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  async function submit() {
    if (!supa || !user || !myRating) return;
    setSaving(true);
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || (user.email || "Explorer").split("@")[0];
    const { error } = await supa.from("trail_reviews").upsert({
      user_id: user.id, trail_id: String(tr.id), park_code: tr.parkCode || "", trail_name: tr.name,
      rating: myRating, review_text: myText.trim(), author_name: name, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,trail_id" });
    if (!error) {
      const { data } = await supa.from("trail_reviews").select("*").eq("trail_id", String(tr.id)).order("created_at", { ascending: false });
      setReviews(data || []);
    }
    setSaving(false);
  }

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8c8473" }}>Reviews</span>
        {avg != null && (
          <span style={{ fontSize: ".78rem", color: "#8c8473", display: "flex", alignItems: "center", gap: 6 }}>
            <StarRow value={Math.round(avg)} size=".85rem" /> {avg.toFixed(1)} ({reviews.length})
          </span>
        )}
      </div>

      {(!supa || reviews === null) && <div style={{ fontSize: ".78rem", color: "#8c8473", marginBottom: 10 }}>Loading reviews…</div>}

      {supa && reviews && reviews.length === 0 && (
        <div style={{ fontSize: ".78rem", color: "#8c8473", marginBottom: 10 }}>No reviews yet — be the first.</div>
      )}

      {supa && reviews && reviews.map((r) => (
        <div key={r.id} style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <b style={{ fontSize: ".82rem", color: "#163a2b" }}>{r.author_name || "Explorer"}</b>
            <StarRow value={r.rating} size=".8rem" />
          </div>
          {r.review_text && <div style={{ fontSize: ".8rem", color: "#4c5443", lineHeight: 1.5 }}>{r.review_text}</div>}
        </div>
      ))}

      {supa && !user && (
        <button onClick={() => window.__ppAuth.openAccount()} style={{ width: "100%", border: "1px solid rgba(140,132,115,.35)", borderRadius: 10, padding: 10, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,.6)", color: "#1d3941", marginTop: 4 }}>Sign in to write a review</button>
      )}

      {supa && user && (
        <div style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 12, padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 700, color: "#1d3941", marginBottom: 6 }}>{myRating ? "Your review" : "Rate this trail"}</div>
          <StarRow value={myRating} onChange={setMyRating} size="1.2rem" />
          <textarea value={myText} onChange={(e) => setMyText(e.target.value)} placeholder="Share tips, conditions, or highlights (optional)" rows={3} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid rgba(140,132,115,.35)", fontFamily: "inherit", fontSize: ".8rem", resize: "vertical" }} />
          <button onClick={submit} disabled={!myRating || saving} style={{ width: "100%", marginTop: 8, border: "none", borderRadius: 10, padding: 10, fontSize: ".8rem", fontWeight: 700, cursor: myRating ? "pointer" : "default", fontFamily: "inherit", background: myRating ? "#1d4a37" : "#cfc7b4", color: "#fff" }}>{saving ? "Saving…" : "Submit review"}</button>
        </div>
      )}
    </div>
  );
}

/* ================================ component ================================ */

export default function ExploreApp() {
  const [parks, setParks] = useState([]); // 63 national parks + live-loaded destinations
  const [verdicts, setVerdicts] = useState({}); // name -> 'go'|'prepare'|'hold' (absent = loading)
  const [verdictFull, setVerdictFull] = useState({}); // name -> full PBVerdict result (word/sub/temp/sky/wind/chips)
  const [npsData, setNpsData] = useState({}); // name -> /api/nps payload (description, activities, thingsToDo)
  const [condData, setCondData] = useState({}); // name -> /api/conditions payload (alerts, wildfires, AQI)
  const [placesData, setPlacesData] = useState({}); // name -> /api/places payload (facilities, recAreas)
  const [lakesData, setLakesData] = useState({}); // name -> /api/water payload's lakes[] — per-park, not the whole-map viewport pattern
  const [trailsData, setTrailsData] = useState({}); // name -> /api/trails payload ({hiking,offroad,ski}) — feeds the Trails tab list
  const [trailStatus, setTrailStatus] = useState(null); // {park, state: 'loading'|'error'|'empty'|'done', n} — visible trail-load feedback
  const [ui, setUi] = useState({
    panelOpen: false, filtersOpen: true, radius: 150,
    destNational: true, destState: true, destForest: true,
    // Off by default: these fetch per-park data (campgrounds via RIDB, trails via
    // NPS, lakes via USGS GNIS) — no reason to hit those services until the user
    // opts in. Once on, clicking any pin loads them immediately (see
    // maybeLoadCampgrounds / maybeLoadTrails / maybeLoadLakes), and turning one
    // on while already viewing a pin loads it right then too.
    campgrounds: false, layerHiking: false, layerOffroad: false, layerSki: false, destLake: false,
    anchor: null, // { lat, lng, label, isUser }
    view: "browse", // browse | detail | trip | trail
    listMode: false, selectedName: null, detailTab: "live",
    selectedTrail: null, // {..fields from /api/trails, category, parkName} — set on trail-line click
    searchQuery: "", trip: [],
    keyOverlay: false, keyMsg: "Paste a Google Maps JavaScript API key to load the live park map. Stored only in your browser — never committed to code.",
  });
  const patch = (p) => setUi((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));

  // Refs for map plumbing + latest-state access inside Maps event callbacks.
  const mapDivRef = useRef(null);
  const keyInputRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef(new Map()); // name -> Marker
  const trailLinesRef = useRef({ hiking: [], offroad: [], ski: [] }); // polylines for selected park
  const placeMarkersRef = useRef([]); // [{marker, layer: 'places'|'water'}] for selected park
  const boundaryRef = useRef({ cache: {}, features: null }); // NPS boundary geojson per code
  const npsFetchedRef = useRef({}); // park name -> true (guards duplicate fetches)
  const condFetchedRef = useRef({});
  const layersForRef = useRef(null); // which park the trail/place layers belong to
  const focusedParkRef = useRef(null); // the actual park object currently pinned/selected
  const placesLoadedRef = useRef(false); // campgrounds fetched for the CURRENT focus?
  const trailsLoadedRef = useRef(false); // trails fetched for the CURRENT focus?
  const nearCircleRef = useRef(null);
  const nearMarkerRef = useRef(null);
  const gatewayMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const seenDestRef = useRef(new Set()); // dedupe live destinations across pans
  const lakesLoadedRef = useRef(false); // lakes fetched for the CURRENT focus?
  const idleTimerRef = useRef(null); // debounce for map idle → viewport loads
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
      // Real data + verdict engine + gateway towns + topojson (for NPS boundaries).
      await loadScript("/trip-data.js");
      await Promise.all([
        loadScript("/pb-verdict.js"),
        loadScript("/gateway-towns.js"),
        loadScript("https://cdn.jsdelivr.net/npm/topojson-client@3"),
      ]);
      if (disposed) return;

      const all = (window.TRIP_PARKS || []).map((p) => ({
        name: p.name,
        state: STATE_ABBR[p.state] || p.state,
        lat: p.lat, lng: p.lng, type: "national_park",
        id: p.id, // for /park-status?park= live-status links
        npsCode: (window.NPS_CODE || {})[p.id] || "", // for the boundary topojson
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
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&loading=async&callback=__pbExInit";
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

  // Show/hide everything per the type toggles + anchor radius + layer toggles.
  // Uses refs so it can be called from map callbacks as well as the render effect.
  function applyVisibility() {
    const map = mapObjRef.current;
    if (!map) return;
    const u = uiRef.current;
    const visibleSet = new Set(visibleParks(u, parksRef.current).map((p) => p.name));
    markersRef.current.forEach((m, name) => m.setMap(visibleSet.has(name) ? map : null));
    // selected-park layers: trails + campgrounds/rec-areas + water facilities
    trailLinesRef.current.hiking.forEach((l) => l.setMap(u.layerHiking ? map : null));
    trailLinesRef.current.offroad.forEach((l) => l.setMap(u.layerOffroad ? map : null));
    trailLinesRef.current.ski.forEach((l) => l.setMap(u.layerSki ? map : null));
    placeMarkersRef.current.forEach((pm) =>
      pm.marker.setMap((pm.layer === "water" ? u.destLake : u.campgrounds) ? map : null)
    );
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

    map.fitBounds(bounds, 40);
    g.maps.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > 5) map.setZoom(5); });
    map.addListener("idle", () => {
      // debounce: only fetch after the map has settled for a beat
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => loadViewportDestinations(), 700);
    });
    applyVisibility();
    patch({ keyOverlay: false });
    startVerdictSweep(all);
    loadViewportDestinations();
  }

  // Live state parks + national forests (/api/destinations by bbox) for the
  // current viewport, deduped across pans and merged into the unified
  // destination model. Restores the pre-migration behavior where these types
  // populated the map and list as you moved around. (Lakes used to be fetched
  // here too, but now load per-park instead — see loadLakesFor.)
  async function loadViewportDestinations() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    const b = map.getBounds();
    if (!b) return;
    const sw = b.getSouthWest(), ne = b.getNorthEast();
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
        additions.push({ name: x.name, state: x.state || "", lat: x.lat, lng: x.lng, type: x.type, destId: x.id }); // destId → /park-status?dest=
      });
    } catch {}

    mergeAdditions(additions);
  }

  function mergeAdditions(adds) {
    if (!adds.length) return;
    const merged = parksRef.current.concat(adds);
    parksRef.current = merged;
    setParks(merged);
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
              setVerdictFull((v) => ({ ...v, [p.name]: r })); // word/sub/temp/sky/wind/chips for the Live tab
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
    // "pinning down a location" loads its boundary + any toggled-on layers
    // (campgrounds, trails) right on the map — the small preview popup stays
    // lightweight; full detail is still a deliberate second click away.
    loadParkLayers(p);
    const access = roadAccessNote(p.name);
    const html =
      '<div style="font-family:\'Hanken Grotesk\',sans-serif;padding:2px 2px 4px;min-width:190px">' +
      '<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">' +
      '<span style="font-size:1.1rem">' + meta.icon + "</span>" +
      '<b style="font-family:\'Spectral\',serif;font-size:.98rem;color:#163a2b">' + p.name + "</b></div>" +
      '<div style="font-size:.72rem;color:#8c8473;margin-bottom:8px">' + meta.label + " · " + p.state + "</div>" +
      '<div style="display:inline-flex;align-items:center;gap:5px;background:' + v.dot + "18;color:" + v.dot + ';font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;margin-bottom:10px">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:' + v.dot + '"></span>' + v.label + "</div>" +
      (access ? '<div style="display:flex;align-items:flex-start;gap:5px;background:rgba(199,154,75,.16);border-radius:8px;padding:6px 8px;margin-bottom:10px;font-size:.68rem;color:#7a5b1f;line-height:1.35"><span>✈️</span><span>' + (access.level === "none" ? "No road access" : "Limited road access") + "</span></div>" : "") +
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
    if (p) loadParkLayers(p); // boundary + trails + campgrounds/areas + NPS info + live conditions
  }

  // Clicking a trail line opens its own detail panel (length, surface, class,
  // season notes, best-effort photo) instead of a small popup — the parent
  // park's selectedName stays set, so "back" returns to that park's detail view.
  function selectTrail(p, cat, t) {
    if (infoWindowRef.current) infoWindowRef.current.close();
    patch({ view: "trail", selectedTrail: { ...t, category: cat, parkName: p.name, parkCode: p.npsCode || "" } });
    const map = mapObjRef.current;
    if (map && t.path && t.path.length > 1) {
      const g = window.google;
      const b = new g.maps.LatLngBounds();
      t.path.forEach(([lat, lng]) => b.extend({ lat, lng }));
      map.fitBounds(b, 60);
    }
  }

  function backToBrowse() {
    patch({ view: "browse", selectedName: null });
    showGatewayMarker(null);
    clearSelectedLayers();
  }

  /* ---------------- selected-park layers (boundary, trails, places, info) ---------------- */

  function clearSelectedLayers() {
    const map = mapObjRef.current;
    if (map && boundaryRef.current.features) boundaryRef.current.features.forEach((f) => map.data.remove(f));
    boundaryRef.current.features = null;
    ["hiking", "offroad", "ski"].forEach((k) => {
      trailLinesRef.current[k].forEach((l) => l.setMap(null));
      trailLinesRef.current[k] = [];
    });
    placeMarkersRef.current.forEach((pm) => pm.marker.setMap(null));
    placeMarkersRef.current = [];
    layersForRef.current = null;
    focusedParkRef.current = null;
    placesLoadedRef.current = false;
    trailsLoadedRef.current = false;
    lakesLoadedRef.current = false;
  }

  // Fetch campgrounds/trails/lakes only if the corresponding toggle is on —
  // called both when a park is first pinned/selected AND reactively when a
  // toggle flips on while that park is still the active focus (see the effects below).
  function maybeLoadCampgrounds(p) {
    if (!uiRef.current.campgrounds || placesLoadedRef.current) return;
    placesLoadedRef.current = true;
    loadPlacesFor(p);
  }
  function maybeLoadTrails(p) {
    const u = uiRef.current;
    // Also load (without necessarily drawing lines on the map) when the Trails
    // tab is open, so the list works even with all three trail toggles off.
    if ((!u.layerHiking && !u.layerOffroad && !u.layerSki && u.detailTab !== "trails") || trailsLoadedRef.current) return;
    trailsLoadedRef.current = true;
    loadTrailsFor(p);
  }
  function maybeLoadLakes(p) {
    if (!uiRef.current.destLake || lakesLoadedRef.current) return;
    lakesLoadedRef.current = true;
    loadLakesFor(p);
  }

  // Called on a PIN CLICK (preview) as well as "View details" / list / search
  // selection — any of those "pins down" a location, so its boundary + toggled
  // layers should appear on the map right away, not just after opening the
  // full detail panel.
  function loadParkLayers(p) {
    if (layersForRef.current !== p.name) {
      clearSelectedLayers();
      layersForRef.current = p.name;
      focusedParkRef.current = p;
      showBoundary(p);
      loadNpsFor(p);
      loadCondFor(p);
    }
    maybeLoadCampgrounds(p);
    maybeLoadTrails(p);
    maybeLoadLakes(p);
  }

  // Reactive: if the user flips a layer toggle on while a park is already
  // pinned/selected, load that layer immediately instead of waiting for the
  // next pin click.
  useEffect(() => { if (focusedParkRef.current) maybeLoadCampgrounds(focusedParkRef.current); }, [ui.campgrounds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusedParkRef.current) maybeLoadTrails(focusedParkRef.current); }, [ui.layerHiking, ui.layerOffroad, ui.layerSki, ui.detailTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusedParkRef.current) maybeLoadLakes(focusedParkRef.current); }, [ui.destLake]); // eslint-disable-line react-hooks/exhaustive-deps

  // NPS boundary polygon (legacy styling: dark-green stroke, translucent green fill).
  async function showBoundary(p) {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map || !p.npsCode) return;
    let geo = boundaryRef.current.cache[p.npsCode];
    if (geo === undefined) {
      try {
        const topo = await fetch(BOUNDARY_URL(p.npsCode)).then((r) => (r.ok ? r.json() : null));
        if (topo && window.topojson && topo.objects) {
          const key = Object.keys(topo.objects)[0];
          geo = key ? window.topojson.feature(topo, topo.objects[key]) : null;
        } else geo = null;
      } catch { geo = null; }
      boundaryRef.current.cache[p.npsCode] = geo;
    }
    if (!geo || uiRef.current.selectedName !== p.name) return;
    const feats = map.data.addGeoJson(geo);
    map.data.setStyle({ strokeColor: "#1d4a37", strokeWeight: 2, fillColor: "#3f7a4a", fillOpacity: 0.22 });
    boundaryRef.current.features = feats;
    // Draw the boundary but DON'T zoom tight to it — selectPark already framed a
    // regional view (zoom ~7). A tight boundary fit pushed nearby campgrounds/
    // trails (up to ~50 mi) off-screen, so they looked "missing". Only widen the
    // view if the park boundary is bigger than what's currently shown.
    const b = new g.maps.LatLngBounds();
    feats.forEach((f) => f.getGeometry().forEachLatLng((ll) => b.extend(ll)));
    const cur = map.getBounds();
    if (!b.isEmpty() && cur && !cur.contains(b.getNorthEast()) && !cur.contains(b.getSouthWest())) {
      map.fitBounds(b, 90);
    }
  }

  function layerInfoHtml(title, sub, extra) {
    return (
      '<div style="font-family:\'Hanken Grotesk\',sans-serif;max-width:220px"><b style="color:#1d3941">' + title + "</b>" +
      '<div style="font-size:12px;color:#5b6258;margin-top:3px">' + sub + "</div>" +
      (extra ? '<div style="font-size:10px;color:#a79f8c;margin-top:6px">' + extra + "</div>" : "") + "</div>"
    );
  }

  // Hiking / off-road / ski polylines (legacy colors + weights), via /api/trails
  // — served live from the NPS's own trails GIS data, filtered by park unit
  // code when we have one (precise — only trails actually in that park),
  // falling back to a bbox query otherwise.
  async function loadTrailsFor(p) {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    setTrailStatus({ park: p.name, state: "loading" });
    try {
      const q = p.npsCode
        ? "parkCode=" + encodeURIComponent(p.npsCode)
        : "lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=25";
      const d = await fetch("/api/trails?" + q).then((r) => (r.ok ? r.json() : null));
      if (layersForRef.current !== p.name) return;
      if (!d) { setTrailStatus({ park: p.name, state: "error" }); return; }
      setTrailsData((s) => ({ ...s, [p.name]: d }));
      let n = 0;
      ["hiking", "offroad", "ski"].forEach((cat) => {
        (d[cat] || []).forEach((t) => {
          if (!t.path || t.path.length < 2) return;
          const line = new g.maps.Polyline({
            path: t.path.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: TRAIL_STYLE[cat], strokeOpacity: 0.85, strokeWeight: 3, zIndex: 30,
            map: null,
          });
          line.addListener("click", () => selectTrail(p, cat, t));
          trailLinesRef.current[cat].push(line);
          n++;
        });
      });
      setTrailStatus({ park: p.name, state: n ? "done" : "empty", n });
      applyVisibility();
    } catch {
      setTrailStatus({ park: p.name, state: "error" });
    }
  }

  // Campgrounds, rec areas & water facilities from Recreation.gov/RIDB + OSM.
  async function loadPlacesFor(p) {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    try {
      const d = await fetch("/api/places?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=50").then((r) => (r.ok ? r.json() : null));
      if (!d || layersForRef.current !== p.name) return;
      setPlacesData((s) => ({ ...s, [p.name]: d }));
      const svg = {
        camp: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"><polygon points="7.5,1.5 14,13.5 1,13.5" fill="#d2843a" stroke="#fffdf7" stroke-width="1.3"/></svg>',
        recarea: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"><circle cx="7.5" cy="7.5" r="5.5" fill="#2f7d4f" stroke="#fffdf7" stroke-width="1.5"/></svg>',
        water: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5" fill="#3a8fc4" stroke="#fffdf7" stroke-width="1.5"/></svg>',
      };
      const addMarker = (x, kind, sub) => {
        if (typeof x.lat !== "number" || typeof x.lng !== "number") return;
        const isWater = /lake|reservoir|pond|river|marina|boat|waterway|bay|lagoon/i.test((x.name || "") + " " + (x.type || ""));
        const iconKey = kind === "recarea" ? "recarea" : isWater ? "water" : "camp";
        const marker = new g.maps.Marker({
          position: { lat: x.lat, lng: x.lng }, map: null, title: x.name, zIndex: 40,
          icon: { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg[iconKey]), scaledSize: new g.maps.Size(15, 15), anchor: new g.maps.Point(7, 7) },
        });
        marker.addListener("click", () => {
          if (!infoWindowRef.current) infoWindowRef.current = new g.maps.InfoWindow();
          const link = x.url ? '<a href="' + x.url + '" target="_blank" rel="noreferrer" style="font-size:12px;color:#2c5562;font-weight:700;display:inline-block;margin-top:6px">Recreation.gov →</a>' : "";
          infoWindowRef.current.setContent(layerInfoHtml(x.name, sub + (x.description ? "<br>" + x.description.slice(0, 140) : "")) .replace("</div></div>", "</div>" + link + "</div>"));
          infoWindowRef.current.open(map, marker);
        });
        placeMarkersRef.current.push({ marker, layer: iconKey === "water" ? "water" : "places" });
      };
      (d.facilities || []).forEach((f) => addMarker(f, "facility", f.type || "Campground"));
      (d.recAreas || []).forEach((r) => addMarker(r, "recarea", "Recreation area"));
      applyVisibility();
    } catch {}
  }

  // Named lakes/reservoirs from USGS GNIS, scoped to the selected park (radius in
  // km) — same "water" marker layer + destLake toggle that loadPlacesFor's
  // water-named-facility heuristic already uses, so no change needed there.
  async function loadLakesFor(p) {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    try {
      const radiusKm = Math.round(50 * 1.609); // match the 50 mi radius used for campgrounds
      const d = await fetch("/api/water?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=" + radiusKm).then((r) => (r.ok ? r.json() : null));
      if (!d || layersForRef.current !== p.name) return;
      const lakes = d.lakes || [];
      setLakesData((s) => ({ ...s, [p.name]: lakes }));
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5" fill="#3a8fc4" stroke="#fffdf7" stroke-width="1.5"/></svg>';
      const icon = { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new g.maps.Size(15, 15), anchor: new g.maps.Point(7, 7) };
      lakes.forEach((x) => {
        if (typeof x.lat !== "number" || typeof x.lng !== "number") return;
        const marker = new g.maps.Marker({ position: { lat: x.lat, lng: x.lng }, map: null, title: x.name, zIndex: 40, icon });
        marker.addListener("click", () => {
          if (!infoWindowRef.current) infoWindowRef.current = new g.maps.InfoWindow();
          infoWindowRef.current.setContent(layerInfoHtml(x.name, x.kind === "reservoir" ? "Reservoir" : "Lake"));
          infoWindowRef.current.open(map, marker);
        });
        placeMarkersRef.current.push({ marker, layer: "water" });
      });
      applyVisibility();
    } catch {}
  }

  // NPS description / activities / things-to-do for the About tab (server key).
  function loadNpsFor(p) {
    if (p.type !== "national_park" || npsFetchedRef.current[p.name]) return;
    npsFetchedRef.current[p.name] = true;
    fetch("/api/nps?name=" + encodeURIComponent(p.name))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.park) setNpsData((s) => ({ ...s, [p.name]: d })); })
      .catch(() => {});
  }

  // Live alerts / wildfire / air quality for the Live tab.
  function loadCondFor(p) {
    if (condFetchedRef.current[p.name]) return;
    condFetchedRef.current[p.name] = true;
    fetch("/api/conditions?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCondData((s) => ({ ...s, [p.name]: d })); })
      .catch(() => {});
  }

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
  }, [ui.destNational, ui.destState, ui.destForest, ui.destLake, ui.campgrounds, ui.layerHiking, ui.layerOffroad, ui.layerSki, ui.anchor, ui.radius, parks]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Real browser geolocation (legacy behavior), falling back to the US center
  // if permission is denied or unavailable.
  function useNearMe() {
    const apply = (lat, lng) => setAnchor({ lat, lng, label: "your location", isUser: true }, true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => apply(pos.coords.latitude, pos.coords.longitude),
        () => apply(USER_LOC.lat, USER_LOC.lng),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else apply(USER_LOC.lat, USER_LOC.lng);
  }

  const zoomIn = () => { const m = mapObjRef.current; if (m) m.setZoom(m.getZoom() + 1); };
  const zoomOut = () => { const m = mapObjRef.current; if (m) m.setZoom(m.getZoom() - 1); };
  const askParkBuddy = () => { const fab = document.querySelector(".pbask-fab"); if (fab) fab.click(); };

  /* ---------------- derived render values ---------------- */

  const onTrack = "#c79a4b", offTrack = "#d9d3c2";
  const activeFilterCount =
    [ui.destNational, ui.destState, ui.destForest, ui.destLake, ui.campgrounds, ui.layerHiking, ui.layerOffroad, ui.layerSki].filter(Boolean).length + (ui.anchor ? 1 : 0);

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
    const selPlaces = placesData[sel.name];
    const camps = ui.campgrounds && selPlaces
      ? (selPlaces.facilities || [])
          .filter((c) => typeof c.lat === "number" && typeof c.lng === "number")
          .map((c) => ({
            name: c.name, type: "campground", dist: milesBetween(sel, c), click: null,
            href: "/campground-status?" + new URLSearchParams({
              name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "", phone: c.phone || "", detail: c.description || "", reservable: c.reservable ? "1" : "0",
            }).toString(),
          }))
      : [];
    const selLakes = lakesData[sel.name];
    const lakes = ui.destLake && selLakes
      ? selLakes
          .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
          .map((l) => ({
            name: l.name, type: "lake", dist: milesBetween(sel, l), click: null,
            href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
          }))
      : [];
    return dest.concat(camps).concat(lakes).filter((o) => o.dist <= ui.radius).sort((a, b) => a.dist - b.dist).slice(0, 10);
  })();

  const selAccess = sel ? roadAccessNote(sel.name) : null; // no/limited road access note
  const selVf = sel ? verdictFull[sel.name] : null; // live weather detail (temp/sky/wind/chips)
  const selCond = sel ? condData[sel.name] : null; // alerts / wildfire / AQI
  const selNps = sel ? npsData[sel.name] : null; // description / activities / things to do
  const selPlaces = sel ? placesData[sel.name] : null; // campgrounds + rec areas (undefined = still loading)

  // Deep link to the full live-status page (same targets the legacy map used).
  const statusHrefFor = (p) =>
    p ? (p.type === "national_park" && p.id ? "/park-status?park=" + p.id : p.destId ? "/park-status?dest=" + encodeURIComponent(p.destId) : null) : null;

  // The pinned destination, shown as a card in Map mode (pin tap → card in the panel).
  const anchoredPark = ui.anchor && !ui.anchor.isUser ? parks.find((p) => p.name === ui.anchor.label) || null : null;

  // One card renderer for List view AND the pinned-location card in Map view —
  // identical markup so the look stays exactly the same everywhere.
  const renderParkCard = (p) => {
    const v = vOf(p);
    const meta = TYPE_META[p.type];
    const inTrip = ui.trip.indexOf(p.name) > -1;
    const near = parks.filter((o) => o.name !== p.name && milesBetween(p, o) <= 50).length;
    const href = statusHrefFor(p);
    const access = roadAccessNote(p.name);
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
          <div style={{ fontSize: ".71rem", color: "#8c8473", margin: "2px 0 7px" }}>{TYPE_META[p.type].label} · {p.state}</div>
          {access && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ".68rem", fontWeight: 700, color: "#a8791f", margin: "0 0 7px" }}>
              <span>✈️</span><span>{access.level === "none" ? "No road access" : "Limited road access"}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, fontSize: ".68rem", color: "#5b6258", fontWeight: 600, alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", gap: 10 }}>
              <span>📍 {near} nearby</span>
              {ui.anchor && <span>{Math.round(milesBetween(ui.anchor, p))} mi from pin</span>}
            </span>
            {href && (
              <a href={href} onClick={(e) => e.stopPropagation()} style={{ color: "#2c5562", fontWeight: 700, textDecoration: "none" }}>Live status →</a>
            )}
          </div>
        </div>
      </div>
    );
  };

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
              placeholder="Search parks, forests…"
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
                    <button onClick={useNearMe} style={{ display: "flex", alignItems: "center", gap: 5, background: ui.anchor && ui.anchor.isUser ? "#1d4a37" : "#f0e8d5", color: ui.anchor && ui.anchor.isUser ? "#fbf6ea" : "#7a6a3c", border: "none", borderRadius: 999, padding: "6px 13px", fontSize: ".76rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📍 Near me</button>
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
                </div>

                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#b07d3a", marginBottom: 8 }}>On the map</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "9px solid #d2843a", display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Campgrounds &amp; areas</span>
                    <Switch on={ui.campgrounds} onClick={toggle("campgrounds")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50% 50% 50% 0", background: "#2c6b8f", transform: "rotate(-45deg)", display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Lakes</span>
                    <Switch on={ui.destLake} onClick={toggle("destLake")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 14, height: 3, borderRadius: 2, background: TRAIL_STYLE.hiking, display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Hiking trails</span>
                    <Switch on={ui.layerHiking} onClick={toggle("layerHiking")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 14, height: 3, borderRadius: 2, background: TRAIL_STYLE.offroad, display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Off-road / 4x4</span>
                    <Switch on={ui.layerOffroad} onClick={toggle("layerOffroad")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 14, height: 3, borderRadius: 2, background: TRAIL_STYLE.ski, display: "inline-block" }} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: 600, color: "#1a2b21" }}>Ski routes</span>
                    <Switch on={ui.layerSki} onClick={toggle("layerSki")} />
                  </div>
                  <div style={{ fontSize: ".68rem", color: "#8c8473", lineHeight: 1.4 }}>Trail, campground &amp; lake layers draw around the park you select.</div>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  <button onClick={() => patch({ destNational: true, destState: true, destForest: true, destLake: true, campgrounds: true, layerHiking: true, layerOffroad: true, layerSki: true })} style={{ flex: 1, border: "1px solid rgba(140,132,115,.35)", borderRadius: 9, padding: 7, fontSize: ".76rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,.6)", color: "#1d3941" }}>All</button>
                  <button onClick={() => patch({ destNational: false, destState: false, destForest: false, destLake: false, campgrounds: false, layerHiking: false, layerOffroad: false, layerSki: false })} style={{ flex: 1, border: "1px solid rgba(140,132,115,.35)", borderRadius: 9, padding: 7, fontSize: ".76rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,.6)", color: "#1d3941" }}>None</button>
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
                <>
                  {anchoredPark && <div style={{ marginBottom: 11 }}>{renderParkCard(anchoredPark)}</div>}
                  <div style={{ textAlign: "center", color: "#8c8473", fontSize: ".85rem", lineHeight: 1.6, padding: "18px 10px", background: "rgba(255,255,255,.45)", border: "1px dashed rgba(140,132,115,.4)", borderRadius: 14 }}>
                    Tap any pin on the map to explore that place — conditions, details, and what&apos;s nearby.
                  </div>
                </>
              )}
              {ui.listMode && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {sortedVisible.length === 0 && (
                    <div style={{ textAlign: "center", color: "#8c8473", padding: "26px 10px", fontSize: ".85rem" }}>No destinations match this filter right now.</div>
                  )}
                  {sortedVisible.map((p) => renderParkCard(p))}
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

              {selAccess && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: selAccess.level === "none" ? "rgba(191,70,58,.1)" : "rgba(199,154,75,.16)", border: "1px solid " + (selAccess.level === "none" ? "rgba(191,70,58,.25)" : "rgba(199,154,75,.3)"), borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
                  <span style={{ fontSize: "1rem" }}>✈️</span>
                  <div>
                    <b style={{ fontSize: ".8rem", color: selAccess.level === "none" ? "#a8473c" : "#a8791f", display: "block", marginBottom: 2 }}>{selAccess.level === "none" ? "No road access" : "Limited road access"}</b>
                    <span style={{ fontSize: ".76rem", color: "#6b6046", lineHeight: 1.4 }}>{selAccess.text}</span>
                  </div>
                </div>
              )}

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
                <button onClick={() => patch({ detailTab: "trails" })} style={{ flex: 1, border: "none", borderRadius: 9, padding: 8, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: ui.detailTab === "trails" ? "#1d4a37" : "transparent", color: ui.detailTab === "trails" ? "#fff" : "#5b6258" }}>🥾 Trails</button>
              </div>

              {trailStatus && trailStatus.park === sel.name && trailStatus.state !== "done" && (
                <div style={{ fontSize: ".7rem", color: "#8c8473", margin: "-6px 0 12px", display: "flex", alignItems: "center", gap: 6, lineHeight: 1.4 }}>
                  {trailStatus.state === "loading" && <span>⏳ Loading trails around {sel.name}…</span>}
                  {trailStatus.state === "empty" && <span>No mapped trails within 25 mi of the park center yet.</span>}
                  {trailStatus.state === "error" && (
                    <>
                      <span>Couldn't load trails just now.</span>
                      <button onClick={() => loadTrailsFor(sel)} style={{ border: "none", background: "none", color: "#2c5562", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: ".7rem", padding: 0, textDecoration: "underline" }}>Retry</button>
                    </>
                  )}
                </div>
              )}

              {ui.detailTab === "live" && (
                <>
                  <div style={{ background: selVf ? (selVf.ring || selV.bg) : selV.bg, borderRadius: 14, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: selVf ? selVf.c : selV.dot }} />
                      <b style={{ fontSize: "1rem", color: selVf ? selVf.c : selV.dot }}>{selVf ? selVf.word : selV.label}</b>
                    </div>
                    <div style={{ fontSize: ".84rem", color: "#4c5443", lineHeight: 1.5 }}>{selVf ? selVf.sub : selV.note}</div>
                    {selVf && (typeof selVf.temp === "number" || selVf.sky) && (
                      <div style={{ fontSize: ".8rem", fontWeight: 700, color: "#1d3941", marginTop: 9 }}>
                        {[typeof selVf.temp === "number" ? Math.round(selVf.temp) + "°F" : null, selVf.sky || null, typeof selVf.wind === "number" && selVf.wind ? "wind " + Math.round(selVf.wind) + " mph" : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {selVf && selVf.chips && selVf.chips.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                        {selVf.chips.slice(0, 4).map((c, i) => (
                          <span key={i} style={{ fontSize: ".7rem", fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: c.pos ? "rgba(47,125,79,.12)" : "rgba(191,70,58,.1)", color: c.pos ? "#2f7d4f" : "#a8473c" }}>{c.t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selCond && (
                    <div style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 14, padding: "13px 15px", marginBottom: 14, fontSize: ".8rem", color: "#4c5443", lineHeight: 1.55 }}>
                      {(selCond.weatherAlerts || []).length > 0 ? (
                        <>
                          <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#a8473c", marginBottom: 5 }}>⚠ {selCond.weatherAlerts.length} active weather alert{selCond.weatherAlerts.length === 1 ? "" : "s"}</div>
                          {selCond.weatherAlerts.slice(0, 3).map((a, i) => (
                            <div key={i} style={{ fontWeight: 700, color: "#7a3d34" }}>{a.event}</div>
                          ))}
                        </>
                      ) : (
                        <div style={{ fontWeight: 700, color: "#2f7d4f" }}>✓ No active weather alerts</div>
                      )}
                      {(selCond.wildfires || []).length > 0 && (
                        <div style={{ marginTop: 7 }}>🔥 {selCond.wildfires.length} wildfire{selCond.wildfires.length === 1 ? "" : "s"} within ~80 mi{selCond.wildfires[0] && selCond.wildfires[0].name ? " · nearest: " + selCond.wildfires[0].name : ""}</div>
                      )}
                      {selCond.airQuality && (
                        <div style={{ marginTop: 7 }}>Air quality: <b style={{ color: "#1d3941" }}>{selCond.airQuality.aqi}</b> ({selCond.airQuality.category}{selCond.airQuality.parameter ? ", " + selCond.airQuality.parameter : ""})</div>
                      )}
                    </div>
                  )}
                  {statusHrefFor(sel) && (
                    <a href={statusHrefFor(sel)} style={{ display: "block", textAlign: "center", background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", color: "#2c5562", textDecoration: "none", marginBottom: 14 }}>View full live status →</a>
                  )}
                </>
              )}
              {ui.detailTab === "about" && (
                <div style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 14, padding: 16, marginBottom: 14, fontSize: ".84rem", color: "#4c5443", lineHeight: 1.6 }}>
                  {selNps && selNps.park ? (
                    <>
                      {selNps.park.description && <p style={{ margin: "0 0 10px" }}>{selNps.park.description}</p>}
                      {(selNps.park.activities || []).length > 0 && (
                        <>
                          <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#b07d3a", margin: "10px 0 7px" }}>Things to do</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {selNps.park.activities.slice(0, 6).map((a) => (
                              <span key={a} style={{ background: "#eef3e6", color: "#1d4a37", borderRadius: 999, padding: "3px 10px", fontSize: ".72rem", fontWeight: 600 }}>{a}</span>
                            ))}
                          </div>
                        </>
                      )}
                      {(selNps.thingsToDo || []).length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {selNps.thingsToDo.slice(0, 3).map((t) => (
                            <div key={t.title} style={{ fontSize: ".8rem", margin: "4px 0" }}>• {t.title}</div>
                          ))}
                        </div>
                      )}
                      {selNps.park.url && (
                        <a href={selNps.park.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: ".78rem", fontWeight: 700, color: "#2c5562", textDecoration: "none" }}>More on NPS.gov →</a>
                      )}
                    </>
                  ) : sel.type === "national_park" ? (
                    <div style={{ color: "#8c8473", fontSize: ".8rem" }}>Loading park info from NPS.gov…</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 8 }}><b style={{ color: "#1d3941" }}>Type:</b> {selMeta.label}</div>
                      <div style={{ marginBottom: 8 }}><b style={{ color: "#1d3941" }}>State:</b> {sel.state}</div>
                      <div style={{ color: "#8c8473", fontSize: ".78rem" }}>Live conditions on the Live tab · nearby places below.</div>
                    </>
                  )}
                </div>
              )}
              {ui.detailTab === "trails" && (() => {
                const td = trailsData[sel.name];
                const cats = td ? ["hiking", "offroad", "ski"].filter((c) => (td[c] || []).length > 0) : [];
                return (
                  <div style={{ marginBottom: 14 }}>
                    {!td && (
                      <div style={{ textAlign: "center", color: "#8c8473", padding: "16px 10px", fontSize: ".82rem" }}>⏳ Loading trails…</div>
                    )}
                    {td && cats.length === 0 && (
                      <div style={{ textAlign: "center", color: "#8c8473", padding: "16px 10px", fontSize: ".82rem" }}>No mapped trails within 25 mi of the park center yet.</div>
                    )}
                    {cats.map((cat) => (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8c8473", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{TRAIL_CAT_META[cat].icon}</span> {TRAIL_CAT_META[cat].label}s ({td[cat].length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {td[cat].map((t) => (
                            <div key={t.name} onClick={() => selectTrail(sel, cat, t)} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 12, padding: "10px 11px", cursor: "pointer" }}>
                              <span style={{ width: 4, height: 30, borderRadius: 2, background: TRAIL_STYLE[cat], flex: "none" }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <b style={{ fontSize: ".85rem", color: "#163a2b", display: "block" }}>{t.name}</b>
                                {t.trailClass && <span style={{ fontSize: ".7rem", color: "#8c8473" }}>{t.trailClass}</span>}
                              </div>
                              <div style={{ textAlign: "right", flex: "none" }}>
                                <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#8c8473" }}>{t.lengthMi > 0 ? t.lengthMi + " mi" : "—"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <button onClick={() => toggleTripFor(ui.selectedName)} style={{ width: "100%", boxSizing: "border-box", border: "none", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: ".88rem", cursor: "pointer", fontFamily: "inherit", marginBottom: 18, background: tripHas ? "#eef4e6" : "#1d4a37", color: tripHas ? "#1d4a37" : "#fff" }}>
                {tripHas ? "✓ In your trip — tap to remove" : "+ Add to trip"}
              </button>

              {ui.detailTab !== "trails" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#8c8473" }}>Nearby — within {ui.radius} mi (~{driveTimeLabel(ui.radius)} drive)</span>
                  </div>
                  <div style={{ fontSize: ".72rem", color: "#8c8473", margin: "-4px 0 10px", lineHeight: 1.4 }}>
                    {!selPlaces
                      ? "⏳ Loading campgrounds & recreation areas…"
                      : ((selPlaces.facilities || []).length + (selPlaces.recAreas || []).length) === 0
                        ? "No campgrounds found near this park."
                        : "🏕 " + (selPlaces.facilities || []).length + " campgrounds · " + (selPlaces.recAreas || []).length + " recreation areas on the map"}
                    {ui.destLake && lakesData[sel.name] && lakesData[sel.name].length > 0 && (" · 💧 " + lakesData[sel.name].length + " lakes")}
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
                      const handleClick = o.click || (o.href ? () => { window.location.href = o.href; } : undefined);
                      return (
                        <div key={o.name} onClick={handleClick} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 12, padding: "10px 11px", cursor: handleClick ? "pointer" : "default" }}>
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
            </>
          )}

          {/* ========== TRAIL DETAIL VIEW ========== */}
          {ui.view === "trail" && ui.selectedTrail && (() => {
            const tr = ui.selectedTrail;
            const catMeta = TRAIL_CAT_META[tr.category] || { icon: "🥾", label: "Trail" };
            return (
              <>
                <button onClick={() => patch({ view: "detail" })} style={{ background: "none", border: "none", color: "#1d3941", fontWeight: 700, fontSize: ".82rem", cursor: "pointer", fontFamily: "inherit", padding: "4px 4px 12px", display: "flex", alignItems: "center", gap: 5 }}>‹ Back to {tr.parkName}</button>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.3rem" }}>{catMeta.icon}</span>
                  <span style={{ fontFamily: serif, fontSize: "1.2rem", fontWeight: 700, color: "#163a2b" }}>{tr.name}</span>
                </div>
                <div style={{ fontSize: ".78rem", color: "#8c8473", marginBottom: 14 }}>{catMeta.label} · {tr.parkName}</div>

                <TrailPhoto name={tr.name} state={parks.find((p) => p.name === tr.parkName)?.state} />

                <div style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 14, padding: 16, marginTop: 12, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={trailStatLabel}>Length</div>
                      <b style={trailStatValue}>{tr.lengthMi > 0 ? tr.lengthMi + " mi" : "Unknown"}</b>
                    </div>
                    {tr.surface && (
                      <div>
                        <div style={trailStatLabel}>Surface</div>
                        <b style={trailStatValue}>{tr.surface}</b>
                      </div>
                    )}
                    <TrailStats tr={tr} />
                    {tr.trailClass && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={trailStatLabel}>Trail class</div>
                        <b style={trailStatValue}>{tr.trailClass}</b>
                      </div>
                    )}
                  </div>
                  {tr.seasonal && tr.seasonNote && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(140,132,115,.2)", fontSize: ".8rem", color: "#4c5443" }}>
                      <b style={{ color: "#a8791f" }}>Seasonal:</b> {tr.seasonNote}
                    </div>
                  )}
                  {tr.notes && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(140,132,115,.2)", fontSize: ".8rem", color: "#4c5443", lineHeight: 1.5 }}>{tr.notes}</div>
                  )}
                </div>

                {tr.id != null && tr.parkCode && (
                  <a href={"/trail-status?trail=" + tr.id + "&park=" + encodeURIComponent(tr.parkCode)} style={{ display: "block", textAlign: "center", background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", color: "#2c5562", textDecoration: "none", marginBottom: 14 }}>View full details →</a>
                )}

                <div style={{ fontSize: ".7rem", color: "#a7a08c", lineHeight: 1.4, marginBottom: 18 }}>
                  Live per-trail conditions (closures, washouts) aren&apos;t published in a public feed — check the park&apos;s Live tab for general weather &amp; alerts, or the park&apos;s official site before heading out.
                  <div style={{ marginTop: 6 }}>Source: National Park Service (public domain).</div>
                </div>

                <ReviewsSection tr={tr} />
              </>
            );
          })()}

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
