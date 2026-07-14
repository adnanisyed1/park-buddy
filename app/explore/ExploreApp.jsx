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
import SiteHeader from "../components/SiteHeader";
import { getClient, initAuth, openAuth } from "../lib/auth";
import { estimateTimeLabel, estimateDifficulty, routeTypeFor } from "../lib/trailStats";
import { fetchElevationProfile } from "../lib/elevationClient";
import { getStops as tripStops, addStop as tripAdd, removeStop as tripRemove, subscribeTrip } from "../lib/trip";
import { getMapPrefs, setMapPrefs, mapOptionsFor, subscribeMapPrefs } from "../lib/mapPrefs";
// Lakes and trails come live from /api/water (USGS GNIS) and /api/trails (NPS
// Public Trails) — government ArcGIS REST services, no auth/rate-limiting/
// seeding needed (unlike OpenStreetMap/Overpass, which blocks datacenter IPs).
// Both are scoped to the selected park, same as campgrounds (/api/places).

/* ---------------- design constants (verbatim from Explore.dc.html) ---------------- */

// Verdict palette — the design's bright, dark-friendly tones (read cleanly on the
// forest-green map + panels). These are LITERAL hex on purpose: they feed Google
// Maps marker fillColors, which can't resolve CSS vars. bg/border are the design's
// low-opacity tint + edge for the verdict card. headline/subline drive the Live tab.
const V = {
  go:      { dot: "#4fd98a", label: "Go",       headline: "Great day to go",  note: "Conditions are about as good as it gets — pack up and enjoy.", bg: "rgba(79,217,138,.10)", border: "rgba(79,217,138,.36)" },
  prepare: { dot: "#e8cf9a", label: "Prepare",  headline: "Go prepared",      note: "Doable, but conditions need planning. Check alerts before you leave.", bg: "rgba(232,207,154,.10)", border: "rgba(232,207,154,.36)" },
  hold:    { dot: "#e0906a", label: "Hold off", headline: "Hold off today",   note: "An advisory is in effect — consider rescheduling or picking another spot nearby.", bg: "rgba(224,144,106,.10)", border: "rgba(224,144,106,.36)" },
  loading: { dot: "#b3ab97", label: "Loading",  headline: "Checking today's call…", note: "We don't have a live read yet — check back shortly.", bg: "rgba(179,171,151,.08)", border: "rgba(179,171,151,.3)" },
};

const TYPE_META = {
  national_park:   { label: "National Park",  icon: "🏔️", color: null }, // null => verdict color
  state_park:      { label: "State Park",     icon: "🌳", color: "#c9a35f" },
  national_forest: { label: "National Forest", icon: "🌲", color: "#3f5d2f" },
  lake:            { label: "Lake",           icon: "💧", color: "#2c6b8f" },
  campground:      { label: "Campground",     icon: "🏕️", color: "#b9823f" },
  basecamp_town:   { label: "Basecamp Town",  icon: "🏘️", color: "#d9a441" },
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

// Dark forest map style — matches the futuristic-royal panels so the map reads as
// part of the page, not a bright rectangle behind it. ALL colors are literal hex:
// Google Maps can't resolve CSS vars inside a style array (the same gotcha that
// broke build-trip). Applies to the "roadmap" base; roads/POI labels are hidden so
// the verdict pins stay the focus.
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

// Two map looks the user can switch between (remembered in localStorage):
//   dark     — the futuristic-royal forest style above (matches the panels)
//   standard — the familiar Google terrain map, for anyone who prefers it
const MAP_STYLES = {
  dark: { mapTypeId: "roadmap", styles: MAP_STYLE, backgroundColor: "#0a1712" },
  standard: { mapTypeId: "terrain", styles: null, backgroundColor: "#dbe6ea" },
};

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

// A distinct SHAPE per type (not just color) so they read apart at a glance, each
// on a light outline so it pops on the dark map. National parks are a round dot in
// the live-verdict color; state parks a diamond, forests a triangle, lakes a
// droplet. All fills are literal hex — Google Maps can't resolve CSS vars here.
function markerIconUrl(type, color) {
  const shapes = {
    national_park: '<circle cx="9" cy="9" r="6" fill="' + color + '" stroke="#fffdf7" stroke-width="2"/>',
    state_park: '<polygon points="9,2 16,9 9,16 2,9" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
    national_forest: '<polygon points="9,2 16,16 2,16" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
    lake: '<path d="M9,2 C5,8 3,11 3,13.2 A6,5.6 0 0,0 15,13.2 C15,11 13,8 9,2 Z" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
    basecamp_town: '<rect x="4" y="4" width="10" height="10" rx="2.5" fill="' + color + '" stroke="#fffdf7" stroke-width="1.5"/>',
  };
  const svg = shapes[type] || shapes.national_park;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">' + svg + "</svg>");
}

// Icon object for a marker of a given type — small (18px), centered.
function markerIcon(g, type, color) {
  return { url: markerIconUrl(type, color), scaledSize: new g.maps.Size(18, 18), anchor: new g.maps.Point(9, 9) };
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

// v3 key: v2 still cached a permanent `false` on TRANSIENT failures (a rate-limited
// 503 or a network blip cached as "no photo forever"), which poisoned dozens of
// parks. v3 both starts fresh AND the fetchers below only cache `false` on a
// DEFINITIVE found:false — transient failures return null without caching, so they
// retry on the next visit.
let photoCache = null;
function getPhotoCache() {
  if (photoCache) return photoCache;
  try { photoCache = JSON.parse(localStorage.getItem("pb_photo_cache_v6") || "{}"); } catch { photoCache = {}; }
  return photoCache;
}
function savePhotoCache() {
  try { localStorage.setItem("pb_photo_cache_v6", JSON.stringify(photoCache)); } catch {}
}

// Photos resolve SERVER-SIDE via /api/photo (Wikipedia/Wikimedia + the NPS lookup
// handled on the server with NPS_API_KEY). No key is ever asked of the user or
// stored in the browser. Resolved URLs are cached to localStorage.
function fetchPhoto(p) {
  const cache = getPhotoCache();
  const cached = cache[p.name];
  if (cached) return Promise.resolve(cached);
  if (cached === false) return Promise.resolve(null);
  return fetch("/api/photo?name=" + encodeURIComponent(photoTitleFor(p)) + "&state=" + encodeURIComponent(p.state || "") + "&v=6")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.found) { const url = d.thumb || d.image || null; if (url) { cache[p.name] = url; savePhotoCache(); } return url; }
      if (d && d.found === false) { cache[p.name] = false; savePhotoCache(); return null; } // definitive: no photo exists
      return null; // transient (bad/failed response) — don't poison the cache; retry next time
    })
    .catch(() => null);
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
  return fetch("/api/photo?name=" + encodeURIComponent(name) + "&state=" + encodeURIComponent(state || "") + "&v=6")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.found) { const url = d.thumb || d.image || null; if (url) { cache[key] = url; savePhotoCache(); } return url; }
      if (d && d.found === false) { cache[key] = false; savePhotoCache(); return null; }
      return null; // transient — don't cache
    })
    .catch(() => null);
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
// Elevation gain comes from app/lib/elevationClient.js (Google's
// ElevationService); difficulty/time/route-type (app/lib/trailStats.js) are
// then derived from length + gain. All clearly labeled "Est." in the UI since
// they're computed, not authoritative trail-agency ratings. Shared with
// /trail-status's route/elevation-chart client island — one implementation.

const trailStatLabel = { fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--pb-muted)", marginBottom: 3 };
const trailStatValue = { fontSize: ".92rem", color: "var(--pb-ink)" };

function TrailStats({ tr }) {
  const [gainFt, setGainFt] = useState(undefined); // undefined = loading, null = unavailable
  useEffect(() => {
    let on = true;
    setGainFt(undefined);
    fetchElevationProfile("trail:" + tr.parkName + "|" + tr.name, tr.path).then((p) => { if (on) setGainFt(p.gainFt); });
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
  useEffect(() => { initAuth(); setSupa(getClient()); }, []);
  return supa;
}

function StarRow({ value, onChange, size }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={onChange ? () => onChange(n) : undefined} style={{ cursor: onChange ? "pointer" : "default", color: n <= value ? "#c9a35f" : "rgba(217,183,121,.16)", fontSize: size || "1.1rem", lineHeight: 1 }}>★</span>
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
        <span style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Reviews</span>
        {avg != null && (
          <span style={{ fontSize: ".78rem", color: "var(--pb-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <StarRow value={Math.round(avg)} size=".85rem" /> {avg.toFixed(1)} ({reviews.length})
          </span>
        )}
      </div>

      {(!supa || reviews === null) && <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginBottom: 10 }}>Loading reviews…</div>}

      {supa && reviews && reviews.length === 0 && (
        <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginBottom: 10 }}>No notes from the trail yet — be the first to leave one.</div>
      )}

      {supa && reviews && reviews.map((r) => (
        <div key={r.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <b style={{ fontSize: ".82rem", color: "var(--pb-ink)" }}>{r.author_name || "Explorer"}</b>
            <StarRow value={r.rating} size=".8rem" />
          </div>
          {r.review_text && <div style={{ fontSize: ".8rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>{r.review_text}</div>}
        </div>
      ))}

      {supa && !user && (
        <button onClick={() => openAuth()} style={{ width: "100%", border: "1px solid rgba(217,183,121,.3)", borderRadius: 10, padding: 10, fontSize: ".8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,.04)", color: "#e7e3d8", marginTop: 4 }}>Sign in to write a review</button>
      )}

      {supa && user && (
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 600, color: "#e7e3d8", marginBottom: 6 }}>{myRating ? "Your review" : "Rate this trail"}</div>
          <StarRow value={myRating} onChange={setMyRating} size="1.2rem" />
          <textarea value={myText} onChange={(e) => setMyText(e.target.value)} placeholder="Share tips, conditions, or highlights (optional)" rows={3} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid rgba(217,183,121,.2)", background: "rgba(255,255,255,.04)", color: "#f4f1ea", fontFamily: "inherit", fontSize: ".8rem", resize: "vertical", outline: "none" }} />
          <button onClick={submit} disabled={!myRating || saving} style={{ width: "100%", marginTop: 8, border: "none", borderRadius: 10, padding: 10, fontSize: ".8rem", fontWeight: 600, cursor: myRating ? "pointer" : "default", fontFamily: "inherit", background: myRating ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.06)", color: myRating ? "#0b1710" : "#7f8a82" }}>{saving ? "Saving…" : "Submit review"}</button>
        </div>
      )}
    </div>
  );
}

/* "Pines from here" peek for the detail panel — a compact line linking into the
   feed. Matches by place name (like the park-page rail); honest count / invite. */
function PinesPeek({ name }) {
  const [pins, setPins] = useState(null);
  useEffect(() => {
    if (!name) return; let on = true;
    fetch("/api/pines?place_name=" + encodeURIComponent(name) + "&limit=1")
      .then((r) => r.json()).then((d) => on && setPins(d.pines || [])).catch(() => on && setPins([]));
    return () => { on = false; };
  }, [name]);
  if (pins === null) return null;
  return (
    <a href="/pines" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", border: "1px solid rgba(217,183,121,.2)", borderRadius: 12, padding: "10px 12px", marginBottom: 14, background: "rgba(255,255,255,.02)" }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#0a1712"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: ".82rem", fontWeight: 600, color: "#e7e3d8" }}>{pins.length ? "Pines from here" : "Be the first to pin a Pine here"}</span>
      <span style={{ fontSize: ".78rem", fontWeight: 600, color: "#e8cf9a", flex: "none" }}>→</span>
    </a>
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
  const [busy, setBusy] = useState(false); // true while the map is fetching destinations for the view (Run-button feedback)
  const [selGateways, setSelGateways] = useState(null); // full stored gateway towns for the selected park/forest
  const [ui, setUi] = useState({
    panelOpen: true, filtersOpen: true, radius: 150, mapStyle: "dark",
    stateFilter: "", liveLoc: false,
    destNational: true, destState: true, destForest: true,
    // Off by default: these fetch per-park data (campgrounds via RIDB, trails via
    // NPS, lakes via USGS GNIS) — no reason to hit those services until the user
    // opts in. Once on, clicking any pin loads them immediately (see
    // maybeLoadCampgrounds / maybeLoadTrails / maybeLoadLakes), and turning one
    // on while already viewing a pin loads it right then too.
    campgrounds: false, layerHiking: false, layerOffroad: false, layerSki: false, destLake: false, destTowns: false,
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
  const mapStyleRef = useRef("dark"); // 'dark' | 'standard' — read from localStorage at boot, used by draw()
  const liveWatchRef = useRef(null); // navigator.geolocation.watchPosition id
  const liveMarkerRef = useRef(null); // live "you are here" blue dot
  const gatewayMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const seenDestRef = useRef(new Set()); // dedupe live destinations across pans
  const townMarkersRef = useRef([]); // isolated "basecamp towns" layer (own markers, off by default)
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
    if (s.stateFilter) out = out.filter((p) => p.state === s.stateFilter);
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

      // Remembered map appearance (dark vs. standard terrain).
      try { const ms = localStorage.getItem("pb_map_style"); if (ms === "standard") { mapStyleRef.current = "standard"; patch({ mapStyle: "standard" }); } } catch {}

      // Maps key: env-injected (Netlify) → localStorage (design's paste flow) → legacy global.
      let key = "";
      try { key = localStorage.getItem("pb_gmaps_key") || ""; } catch {}
      if (!key) key = process.env.NEXT_PUBLIC_GMAPS_KEY || "";
      if (!key && window.GMAPS_KEY) key = window.GMAPS_KEY;
      if (!key) { patch({ keyOverlay: true }); }
      else loadGoogle(key, all);

      // Auth is now the React store + SiteHeader modal (no legacy auth.js here —
      // that caused a second, different sign-in panel on this page).
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
        icon: markerIcon(g, p.type, color),
      });
      // Design behavior: a pin click flies to the place and opens its detail panel
      // directly (no intermediate white InfoWindow, which clashed with the dark UI).
      marker.addListener("click", () => selectPark(p.name));
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
    const mo = mapOptionsFor(getMapPrefs(), MAP_STYLE);
    const map = new g.maps.Map(el, {
      center: { lat: 39.5, lng: -98.5 }, zoom: 4, minZoom: 3, maxZoom: 14,
      mapTypeId: mo.mapTypeId, disableDefaultUI: true, gestureHandling: "cooperative",
      backgroundColor: getMapPrefs().theme === "dark" ? "#0a1712" : "#dbe6ea", styles: mo.styles,
    });
    mapObjRef.current = map;
    // Follow the platform-wide map style set from any map's "Map style" menu.
    subscribeMapPrefs((p) => { const m = mapObjRef.current; if (m) { const o = mapOptionsFor(p, MAP_STYLE); m.setOptions({ mapTypeId: o.mapTypeId, styles: o.styles, backgroundColor: p.theme === "dark" ? "#0a1712" : "#dbe6ea" }); } });
    markersRef.current = new Map();

    const bounds = new g.maps.LatLngBounds();
    all.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    ensureMarkers();

    map.fitBounds(bounds, 40);
    g.maps.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > 5) map.setZoom(5); });
    map.addListener("idle", () => {
      // debounce: only fetch after the map has settled for a beat
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => { loadViewportDestinations(); loadViewportTowns(); }, 700);
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

    setBusy(true);
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
    finally { setBusy(false); }

    mergeAdditions(additions);
  }

  // "Run" the filters: fit the map to the currently-visible destinations, then let
  // the idle handler pull fresh data for that view (with the busy spinner).
  function runFilter() {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    const vis = visibleParks();
    if (!vis.length) return;
    setBusy(true);
    const b = new g.maps.LatLngBounds();
    vis.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(b, 60);
    patch({ panelOpen: window.innerWidth > 820 }); // on phones, close the panel to reveal the map
    setTimeout(() => setBusy(false), 2500); // safety: clear the spinner even if the view didn't move
  }

  function mergeAdditions(adds) {
    if (!adds.length) return;
    const merged = parksRef.current.concat(adds);
    parksRef.current = merged;
    setParks(merged);
  }

  // ISOLATED "basecamp towns" layer — its own marker array, fully guarded, OFF by
  // default. It never touches the parks model / verdict system, so a failure here
  // can't affect the rest of the map (worst case: no town pins appear). Reads the
  // town-centric gateway search (all basecamp towns in view, deduped + annotated).
  function clearTownMarkers() {
    try { townMarkersRef.current.forEach((m) => m.setMap(null)); } catch {}
    townMarkersRef.current = [];
  }
  async function loadViewportTowns() {
    const g = window.google, map = mapObjRef.current;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!g || !map) return;
    if (!uiRef.current || !uiRef.current.destTowns) { clearTownMarkers(); return; }
    try {
      const b = map.getBounds();
      if (!b) return;
      const sw = b.getSouthWest(), ne = b.getNorthEast();
      // Query by the actual viewport rectangle so EVERY town in view shows (not a
      // nearest-N sample around the center).
      const bbox = sw.lng().toFixed(3) + "," + sw.lat().toFixed(3) + "," + ne.lng().toFixed(3) + "," + ne.lat().toFixed(3);
      const d = await fetch("/api/gateway?townsNear=1&bbox=" + bbox).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!uiRef.current.destTowns) { clearTownMarkers(); return; } // toggled off mid-fetch
      clearTownMarkers();
      const towns = (d && d.towns) || [];
      const meta = TYPE_META.basecamp_town;
      for (const t of towns) {
        if (typeof t.lat !== "number" || typeof t.lng !== "number") continue;
        const forNames = (t.places || []).map((p) => p.name).join(" · ");
        const m = new g.maps.Marker({
          position: { lat: t.lat, lng: t.lng }, map,
          icon: markerIcon(g, "basecamp_town", meta.color),
          title: t.name + (forNames ? " — basecamp for " + forNames : ""), zIndex: 20,
        });
        m.addListener("click", () => {
          const iw = infoWindowRef.current || (infoWindowRef.current = new g.maps.InfoWindow());
          iw.setContent('<div style="font-family:var(--pb-sans);min-width:160px"><div style="font-weight:700;color:#0b1710;font-size:.95rem">' + esc(t.name) + '</div>' +
            (forNames ? '<div style="color:#3a5a44;font-size:.75rem;margin-top:2px">Basecamp for ' + esc(forNames) + '</div>' : '') +
            '<a href="/book?cat=stays" style="display:inline-block;margin-top:8px;font-size:.78rem;font-weight:700;color:#0b1710;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border-radius:8px;padding:6px 12px;text-decoration:none">Find stays →</a></div>');
          iw.setPosition({ lat: t.lat, lng: t.lng });
          iw.open(map);
        });
        townMarkersRef.current.push(m);
      }
    } catch { /* isolated — never breaks the map */ }
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
                m.setIcon(markerIcon(window.google, "national_park", V[bucket].dot));
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
      '<div style="font-family:var(--pb-sans);padding:2px 2px 4px;min-width:190px">' +
      '<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">' +
      '<span style="font-size:1.1rem">' + meta.icon + "</span>" +
      '<b style="font-family:var(--pb-serif);font-size:.98rem;color:var(--pb-ink)">' + p.name + "</b></div>" +
      '<div style="font-size:.72rem;color:var(--pb-muted);margin-bottom:8px">' + meta.label + " · " + p.state + "</div>" +
      '<div style="display:inline-flex;align-items:center;gap:5px;background:' + v.dot + "18;color:" + v.dot + ';font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;margin-bottom:10px">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:' + v.dot + '"></span>' + v.label + "</div>" +
      (access ? '<div style="display:flex;align-items:flex-start;gap:5px;background:rgba(199,154,75,.16);border-radius:8px;padding:6px 8px;margin-bottom:10px;font-size:.68rem;color:#c9a35f;line-height:1.35"><span>✈️</span><span>' + (access.level === "none" ? "No road access" : "Limited road access") + "</span></div>" : "") +
      '<button onclick="window.__pbExPreview()" style="display:block;width:100%;box-sizing:border-box;border:none;border-radius:9px;padding:8px;background:#c9a35f;color:#fff;font-weight:700;font-size:.8rem;cursor:pointer;font-family:inherit">View details →</button>' +
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
    if (p && map) {
      map.panTo({ lat: p.lat, lng: p.lng });
      if (map.getZoom() < 7) map.setZoom(7);
      // Draw the radius ring around the selected place (resizes with the Nearby
      // slider, which drives ui.radius → setRadius updates this same circle).
      drawSelectRing(p);
    }
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
    // Drop the selection ring unless the user has a standing "near me" anchor.
    if (!uiRef.current.anchor && nearCircleRef.current) nearCircleRef.current.setMap(null);
  }

  // Radius ring around a selected place (gold-soft, per the design). Shares the
  // nearCircleRef with the "near me" anchor circle so there's only ever one ring.
  function drawSelectRing(p) {
    const g = window.google, map = mapObjRef.current;
    if (!g || !map) return;
    const pos = { lat: p.lat, lng: p.lng }, r = uiRef.current.radius * 1609.34;
    if (!nearCircleRef.current) {
      nearCircleRef.current = new g.maps.Circle({ center: pos, radius: r, map, strokeColor: "#d9b779", strokeWeight: 1.5, fillColor: "#d9b779", fillOpacity: 0.06 });
    } else {
      nearCircleRef.current.setCenter(pos);
      nearCircleRef.current.setRadius(r);
      nearCircleRef.current.setMap(map);
    }
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
      '<div style="font-family:var(--pb-sans);max-width:220px"><b style="color:#1d3941">' + title + "</b>" +
      '<div style="font-size:12px;color:var(--pb-muted);margin-top:3px">' + sub + "</div>" +
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
          const link = x.url ? '<a href="' + x.url + '" target="_blank" rel="noreferrer" style="font-size:12px;color:var(--pb-gold);font-weight:700;display:inline-block;margin-top:6px">Recreation.gov →</a>' : "";
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
          strokeColor: "#d9b779", strokeWeight: 1.5, fillColor: "#d9b779", fillOpacity: 0.06,
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

  // Isolated basecamp-towns layer: load/clear when its toggle flips (own markers).
  useEffect(() => { loadViewportTowns(); }, [ui.destTowns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full stored gateway towns for the selected park/forest (all of them, not just the
  // single curated one PB_GATEWAY knows about). Powers the detail panel's town list.
  useEffect(() => {
    const p = parksRef.current.find((x) => x.name === ui.selectedName);
    if (!p || p.lat == null || p.lng == null) { setSelGateways(null); return; }
    let on = true;
    fetch("/api/gateway?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&state=" + encodeURIComponent(p.state || ""))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (on) setSelGateways((d && d.towns) || []); })
      .catch(() => { if (on) setSelGateways([]); });
    return () => { on = false; };
  }, [ui.selectedName]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- misc actions ---------------- */

  function saveKey() {
    const v = keyInputRef.current && keyInputRef.current.value.trim();
    if (!v) return;
    try { localStorage.setItem("pb_gmaps_key", v); } catch {}
    window.location.reload();
  }

  function toggleTripFor(name) {
    if (!name) return;
    // The shared trip store (app/lib/trip.js) is the source of truth; our ui.trip
    // is a derived mirror kept in sync by the subscription below. Adding fires the
    // platform-wide trip modal (via the store's `pb:trip` event).
    if (ui.trip.indexOf(name) === -1) tripAdd(name); else tripRemove(name);
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

  // Live location — a distinct blue "you are here" dot that follows the device
  // (watchPosition), separate from the "Near me" radius anchor. Toggle on/off.
  const LIVE_DOT = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="10" fill="#3aa0d0" fill-opacity=".22"/><circle cx="11" cy="11" r="5.5" fill="#2c7a9e" stroke="#ffffff" stroke-width="2.5"/></svg>');
  function toggleLiveLocation() {
    const g = window.google;
    if (uiRef.current.liveLoc) {
      if (liveWatchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(liveWatchRef.current);
      liveWatchRef.current = null;
      if (liveMarkerRef.current) liveMarkerRef.current.setMap(null);
      patch({ liveLoc: false });
      return;
    }
    if (!navigator.geolocation) return;
    patch({ liveLoc: true });
    let first = true;
    liveWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapObjRef.current;
        if (!window.google || !map) return;
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!liveMarkerRef.current) {
          liveMarkerRef.current = new window.google.maps.Marker({
            position: p, map, zIndex: 60, title: "Your live location",
            icon: { url: LIVE_DOT, scaledSize: new window.google.maps.Size(22, 22), anchor: new window.google.maps.Point(11, 11) },
          });
        } else { liveMarkerRef.current.setPosition(p); liveMarkerRef.current.setMap(map); }
        if (first) { map.panTo(p); if (map.getZoom() < 7) map.setZoom(8); first = false; }
      },
      () => { patch({ liveLoc: false }); if (liveWatchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(liveWatchRef.current); liveWatchRef.current = null; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }
  // Stop watching on unmount so GPS isn't left polling in the background.
  useEffect(() => () => { if (liveWatchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(liveWatchRef.current); }, []);

  // Consume the pre-flight filters the landing page's map modal wrote to
  // pb_map_filters, so "Design your adventure → Enter the map" actually carries
  // the selection into /explore. One-shot: we clear it after applying so a normal
  // later visit to /explore isn't silently re-filtered.
  useEffect(() => {
    let raw;
    try { raw = localStorage.getItem("pb_map_filters"); } catch { return; }
    if (!raw) return;
    try { localStorage.removeItem("pb_map_filters"); } catch {}
    let f;
    try { f = JSON.parse(raw); } catch { return; }
    if (!f || !f.types) return;
    const MAP = { np: "destNational", sp: "destState", nf: "destForest", camp: "campgrounds", lakes: "destLake", hike: "layerHiking", ohv: "layerOffroad", ski: "layerSki" };
    const next = {};
    Object.keys(MAP).forEach((k) => { if (k in f.types) next[MAP[k]] = !!f.types[k]; });
    if (f.radius) next.radius = f.radius;
    patch(next);
    if (f.near && typeof f.near.lat === "number") {
      setAnchor({ lat: f.near.lat, lng: f.near.lng, label: "your location", isUser: true }, true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // My Trip mirrors the shared trip store (app/lib/trip.js), which owns
  // persistence. Seed ui.trip from it on mount and keep it in sync — so a stop
  // added or removed anywhere (park page, the trip modal) reflects here too.
  useEffect(() => {
    const sync = () => patch({ trip: tripStops().map((s) => s.name) });
    sync();
    return subscribeTrip(sync);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setMapStyle(s) {
    if (s !== "dark" && s !== "standard") return;
    mapStyleRef.current = s;
    patch({ mapStyle: s });
    // Drive the platform-wide map pref so the choice carries to every other map
    // (the subscription applies it to this map live).
    setMapPrefs(s === "dark" ? { theme: "dark", type: "roadmap" } : { theme: "light", type: "terrain" });
  }

  const zoomIn = () => { const m = mapObjRef.current; if (m) m.setZoom(m.getZoom() + 1); };
  const zoomOut = () => { const m = mapObjRef.current; if (m) m.setZoom(m.getZoom() - 1); };
  const askParkBuddy = () => { const fab = document.querySelector(".pbask-fab"); if (fab) fab.click(); };

  /* ---------------- derived render values ---------------- */

  const onTrack = "#c9a35f", offTrack = "rgba(217,183,121,.16)";
  const activeFilterCount =
    [ui.destNational, ui.destState, ui.destForest, ui.destLake, ui.campgrounds, ui.layerHiking, ui.layerOffroad, ui.layerSki].filter(Boolean).length + (ui.anchor ? 1 : 0) + (ui.stateFilter ? 1 : 0);

  // Distinct states present in the loaded destinations, for the State filter.
  const stateOptions = Array.from(new Set(parks.map((p) => p.state).filter(Boolean))).sort();

  // Search matches NAME or STATE, then splits into the divided type sections
  // (National Parks / State Parks / National Forests) the design calls for.
  const q = ui.searchQuery.trim().toLowerCase();
  const searchResults = q
    ? parks.filter((p) => p.name.toLowerCase().indexOf(q) > -1 || (p.state || "").toLowerCase().indexOf(q) > -1).slice(0, 18)
    : [];
  const searchGroups = ["national_park", "state_park", "national_forest", "lake"]
    .map((t) => ({ type: t, items: searchResults.filter((r) => r.type === t) }))
    .filter((g) => g.items.length);

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
    p
      ? p.type === "national_park" && p.id
        ? "/parks/" + p.id
        : p.type === "national_forest"
        ? "/forests/" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : p.type === "state_park" && p.destId
        ? "/state-parks/" + encodeURIComponent(p.destId)
        : p.destId
        ? "/park-status?dest=" + encodeURIComponent(p.destId)
        : null
      : null;

  // The pinned destination, shown as a card in Map mode (pin tap → card in the panel).
  const anchoredPark = ui.anchor && !ui.anchor.isUser ? parks.find((p) => p.name === ui.anchor.label) || null : null;

  // One card renderer for List view AND the pinned-location card in Map view —
  // identical markup so the look stays exactly the same everywhere.
  const renderParkCard = (p) => {
    const v = vOf(p);
    const meta = TYPE_META[p.type];
    const vf = verdictFull[p.name];
    const temp = vf && typeof vf.temp === "number" ? Math.round(vf.temp) + "°" : null;
    const access = roadAccessNote(p.name);
    return (
      <div key={p.name} onClick={() => selectPark(p.name)} style={{ cursor: "pointer", position: "relative", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(217,183,121,.16)", aspectRatio: "5 / 4", background: "repeating-linear-gradient(135deg,#16321f 0 14px,#12291a 14px 28px)" }}>
        <CoverPhoto park={p} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.1) 40%,rgba(8,19,13,.9))" }} />
        <span style={{ position: "absolute", left: 11, top: 11, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".04em", color: v.dot, background: "rgba(8,19,13,.7)", border: "1px solid " + v.dot + "55", borderRadius: 999, padding: "4px 9px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: v.dot }} />{v.label}
        </span>
        {temp && <span style={{ position: "absolute", right: 12, top: 10, fontFamily: serif, fontSize: "1.15rem", color: "#f4f1ea", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{temp}</span>}
        {access && (
          <span style={{ position: "absolute", left: 11, top: 40, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: mono, fontSize: ".5rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#e0906a", background: "rgba(8,19,13,.7)", border: "1px solid rgba(224,144,106,.4)", borderRadius: 999, padding: "3px 8px" }}>✈ {access.level === "none" ? "No road" : "Ltd road"}</span>
        )}
        <div style={{ position: "absolute", left: 13, right: 13, bottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#e8cf9a" }}>{meta.label} · {p.state}</div>
          <b style={{ fontFamily: serif, fontWeight: 500, fontSize: "1.3rem", color: "#f7f4ec", lineHeight: 1.05, display: "block" }}>{p.name}</b>
          {ui.anchor && <div style={{ fontFamily: mono, fontSize: ".54rem", color: "#aab0ba", marginTop: 3 }}>{Math.round(milesBetween(ui.anchor, p))} mi from {ui.anchor.label}</div>}
        </div>
      </div>
    );
  };

  const tripItems = ui.trip.map((n) => parks.find((p) => p.name === n)).filter(Boolean);

  const sans = "var(--pb-sans)";
  const serif = "var(--pb-serif)";
  const mono = "var(--pb-mono)";

  const toggle = (key) => () => patch((s) => ({ [key]: !s[key] }));
  const Switch = ({ on, onClick }) => (
    // stopPropagation: the switch sits inside a clickable TogRow, so without this a
    // click on the switch fires the toggle twice (button + bubbling row) → no net change.
    <button type="button" onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }} style={{ position: "relative", width: 40, height: 22, borderRadius: 999, flex: "none", cursor: "pointer", padding: 0, background: on ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.09)", border: on ? "1px solid transparent" : "1px solid rgba(217,183,121,.22)", transition: "background .3s" }}>
      <span style={{ position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform .3s" }} />
    </button>
  );

  // Small reusable bits for the dark panels (design tokens inlined so the look is
  // pixel-faithful to explore-map-preview.html).
  const KV = ({ k, v }) => (
    <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#7f8a82" }}>{k}</div>
      <div style={{ fontFamily: serif, fontSize: "1.2rem", color: "#f4f1ea", marginTop: 2 }}>{v}</div>
    </div>
  );
  const monoLabel = { fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#9aa7a0" };
  const panelGlass = { background: "rgba(11,23,16,.92)", WebkitBackdropFilter: "blur(18px) saturate(1.4)", backdropFilter: "blur(18px) saturate(1.4)", border: "1px solid rgba(217,183,121,.2)", boxShadow: "0 30px 70px -40px rgba(0,0,0,.9)" };
  const TogRow = ({ glyph, color, label, on, onClick }) => (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", cursor: "pointer", borderTop: "1px solid rgba(217,183,121,.08)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ color, fontSize: ".8rem", width: 14, textAlign: "center" }}>{glyph}</span>
        <span style={{ fontSize: ".86rem", color: "#e7e3d8" }}>{label}</span>
      </span>
      <Switch on={on} onClick={onClick} />
    </div>
  );

  /* ================================ render ================================ */

  return (
    <div style={{ fontFamily: sans, color: "var(--pb-ink)", position: "fixed", inset: 0, background: "var(--pb-bg)", overflow: "hidden" }}>
      <style>{`
        .ex-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
        .ex-scroll::-webkit-scrollbar { background: transparent; }
        .ex-scroll::-webkit-scrollbar-thumb { background: rgba(217,183,121,.22); border-radius: 9px; }
        .ex-scroll::-webkit-scrollbar-thumb:hover { background: rgba(217,183,121,.38); }
        .ex-scroll { scrollbar-width: thin; scrollbar-color: rgba(217,183,121,.22) transparent; }
        @keyframes ex-sheen { 0% { transform: translateY(-30%) rotate(8deg); opacity: 0; } 18% { opacity: .5; } 45% { opacity: 0; } 100% { transform: translateY(120%) rotate(8deg); opacity: 0; } }
        @keyframes ex-loc { 0% { box-shadow: 0 0 0 0 rgba(228,190,120,.55); } 70% { box-shadow: 0 0 0 10px rgba(228,190,120,0); } 100% { box-shadow: 0 0 0 0 rgba(228,190,120,0); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        .pbask-fab { display: none !important; } /* design's own button triggers the panel */
        ::selection { background: #c9a35f; color: #15241c; }
        /* --- Mobile: the 400px filter/detail panel is wider than a phone, so it
           covered the whole map with its collapse button off-screen. Make it
           full-width (still dismissable via the now-visible ‹ button) and pull the
           floating search out from behind it so it's reachable. --- */
        @media (max-width: 640px) {
          .ex-panel { width: 100vw !important; }
          .ex-search { left: 12px !important; right: 12px !important; }
          .ex-hide-mobile { display: none !important; }
          .ex-reopen { top: 126px !important; }
        }
      `}</style>

      {/* Shared platform header — with My Trip + the real account/Sign-in slot in it
          (matches the prototype banner; nothing floats below the header for those). */}
      {/* My Trip opens the shared TripModal (real route map + full planner) — same
          experience as every other page — instead of a bare in-page list. */}
      <SiteHeader active="explore" tripCount={ui.trip.length} acctSlot />

      {/* map fills the whole viewport */}
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

      {/* key prompt overlay (design's dev fallback — production uses NEXT_PUBLIC_GMAPS_KEY) */}
      <div style={{ display: ui.keyOverlay ? "flex" : "none", position: "absolute", inset: 0, zIndex: 700, background: "rgba(14,42,29,.72)", backdropFilter: "blur(3px)", alignItems: "center", justifyContent: "center", padding: 30 }}>
        <div style={{ background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 16, padding: "24px 26px", maxWidth: 420, boxShadow: "0 16px 40px -16px rgba(0,0,0,.4)" }}>
          <h3 style={{ fontFamily: serif, color: "#c9a35f", fontSize: "1.15rem", margin: "0 0 8px" }}>Load the live map</h3>
          <p style={{ color: "#666", fontSize: ".88rem", lineHeight: 1.55, margin: "0 0 12px" }}>{ui.keyMsg}</p>
          <input ref={keyInputRef} placeholder="Your Maps JS API key" style={{ width: "100%", border: "1px solid rgba(217,183,121,.16)", borderRadius: 10, padding: "11px 12px", fontSize: ".86rem", fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box" }} />
          <button onClick={saveKey} style={{ width: "100%", marginTop: 10, border: "none", cursor: "pointer", borderRadius: 10, padding: 12, fontWeight: 800, color: "#fff", background: "#c9a35f", fontFamily: "inherit", boxShadow: "0 5px 0 #10271d" }}>Load map</button>
          <p style={{ fontSize: ".72rem", color: "var(--pb-muted)", margin: "11px 0 0", lineHeight: 1.45 }}>Use an unrestricted dev key for testing, or add this preview's URL to the key's allowed referrers in Google Cloud.</p>
        </div>
      </div>

      {/* ============ FLOATING SEARCH (over the map, clears the left panel) ============ */}
      <div className={"ex-search" + (ui.panelOpen ? " ex-hide-mobile" : "")} style={{ position: "absolute", top: 74, left: 452, right: 24, zIndex: 88, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 460, pointerEvents: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, ...panelGlass, borderRadius: 999, padding: "11px 18px" }}>
            <span style={{ color: "#9aa7a0", fontSize: ".95rem" }}>⌕</span>
            <input value={ui.searchQuery} onChange={(e) => patch({ searchQuery: e.target.value })} placeholder="Search parks, forests, lakes…" autoComplete="off" style={{ flex: 1, background: "transparent", border: "none", color: "#f4f1ea", fontSize: ".92rem", outline: "none", fontFamily: "inherit" }} />
            <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#7f8a82" }}>⌘K</span>
          </div>
          {q && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 70, ...panelGlass, borderRadius: 16, overflow: "hidden", maxHeight: 380, overflowY: "auto" }}>
              {searchGroups.length === 0 && (
                <div style={{ padding: "16px", textAlign: "center", color: "#7f8a82", fontSize: ".84rem" }}>Hmm, I can't find anything matching “{ui.searchQuery.trim()}” — try a park, forest or state-park name.</div>
              )}
              {searchGroups.map((g) => (
                <div key={g.type}>
                  <div style={{ ...monoLabel, padding: "9px 15px 4px", display: "flex", alignItems: "center", gap: 7 }}>
                    <span>{TYPE_META[g.type].icon}</span>{TYPE_META[g.type].label}s
                    <span style={{ color: "#5f6a62" }}>· {g.items.length}</span>
                  </div>
                  {g.items.map((r) => {
                    const rv = V[bucketOf(r.name, r.type)];
                    return (
                      <button key={r.name} onClick={() => { patch({ searchQuery: "" }); selectPark(r.name); }} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", display: "flex", alignItems: "center", gap: 11, padding: "10px 15px", border: "none", borderBottom: "1px solid rgba(217,183,121,.06)", background: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: rv.dot, flex: "none" }} />
                        <span style={{ fontSize: ".9rem", color: "#f4f1ea", flex: 1 }}>{r.name}</span>
                        <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".08em", textTransform: "uppercase", color: "#8a938b" }}>{r.state}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* reopen pill when the panel is collapsed */}
      {!ui.panelOpen && (
        <button onClick={() => patch({ panelOpen: true })} className="ex-reopen" style={{ position: "absolute", top: 74, left: 16, zIndex: 25, cursor: "pointer", ...panelGlass, borderRadius: 999, padding: "11px 16px", color: "#e8cf9a", fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase" }}>☰ Filters &amp; browse</button>
      )}

      {/* ============ ONE LEFT PANEL — Filters · List · Detail · Trip ============ */}
      <aside className="ex-panel" style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 400, zIndex: 40, background: "linear-gradient(180deg,rgba(14,32,22,.96),rgba(9,20,14,.96))", WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)", borderRight: "1px solid rgba(217,183,121,.2)", boxShadow: "18px 0 70px -40px rgba(0,0,0,.9)", display: "flex", flexDirection: "column", transform: ui.panelOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform .45s cubic-bezier(.16,.8,.24,1)" }}>
        <button onClick={() => patch({ panelOpen: false })} title="Hide panel" style={{ position: "absolute", top: 72, right: 10, zIndex: 3, width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(217,183,121,.3)", background: "rgba(9,22,15,.85)", color: "#9aa7a0", fontSize: "1rem", lineHeight: 1, cursor: "pointer" }}>‹</button>

        <div className="ex-scroll" style={{ flex: 1, overflowY: "auto", padding: "72px 16px 16px", boxSizing: "border-box" }}>

          {/* ========== BROWSE VIEW ========== */}
          {ui.view === "browse" && (
            <>
              {/* Filters show in Map mode; List mode is a clean "All parks" grid. */}
              {!ui.listMode && (
              <>
              <button onClick={toggle("filtersOpen")} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 9, padding: "4px 2px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ ...monoLabel, color: "#d9b779", flex: 1 }}>Filters</span>
                <span style={{ minWidth: 20, height: 18, padding: "0 6px", borderRadius: 999, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0b1710", fontFamily: mono, fontSize: ".56rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeFilterCount}</span>
                <span style={{ color: "#9aa7a0", fontSize: ".8rem", transform: ui.filtersOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </button>

              <div style={{ display: ui.filtersOpen ? "block" : "none" }}>
                <div style={{ ...monoLabel, margin: "4px 0 10px" }}>Search radius</div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: ".88rem", fontWeight: 600, color: "#e7e3d8" }}>Within {ui.radius} mi</span>
                    <button onClick={useNearMe} style={{ cursor: "pointer", fontFamily: mono, fontSize: ".58rem", letterSpacing: ".06em", color: ui.anchor && ui.anchor.isUser ? "#0b1710" : "#d9b779", background: ui.anchor && ui.anchor.isUser ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "transparent", border: "1px solid rgba(217,183,121,.3)", borderRadius: 999, padding: "5px 10px" }}>◎ Near me</button>
                  </div>
                  <input type="range" min="10" max="300" step="10" value={ui.radius} onChange={(e) => setRadius(+e.target.value)} style={{ width: "100%", marginTop: 10, accentColor: "#c9a35f" }} />
                  <button onClick={useNearMe} style={{ cursor: "pointer", width: "100%", marginTop: 8, fontSize: ".78rem", fontWeight: 600, color: "#0b1710", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", border: "none", borderRadius: 10, padding: 9, fontFamily: "inherit" }}>Use my location</button>
                </div>

                <div style={{ ...monoLabel, marginBottom: 8 }}>State</div>
                <div style={{ position: "relative", marginBottom: 18 }}>
                  <select
                    value={ui.stateFilter}
                    onChange={(e) => patch({ stateFilter: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "inherit", fontSize: ".84rem", fontWeight: 600, color: ui.stateFilter ? "#f4f1ea" : "#c3c8d0", background: "rgba(255,255,255,.04)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 10, padding: "10px 34px 10px 12px", outline: "none" }}
                  >
                    <option value="">All states</option>
                    {stateOptions.map((st) => (<option key={st} value={st}>{st}</option>))}
                  </select>
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa7a0", fontSize: ".7rem", pointerEvents: "none" }}>▾</span>
                  {ui.stateFilter && (
                    <button aria-label="Clear state filter" onClick={() => patch({ stateFilter: "" })} style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#d9b779", fontSize: ".8rem", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  )}
                </div>

                <div style={{ ...monoLabel, marginBottom: 6 }}>Destination types</div>
                <div style={{ marginBottom: 16 }}>
                  <TogRow glyph="●" color="#4f9e6a" label="National Parks" on={ui.destNational} onClick={toggle("destNational")} />
                  <TogRow glyph="◆" color="#d9a441" label="State Parks" on={ui.destState} onClick={toggle("destState")} />
                  <TogRow glyph="▲" color="#6f9e5a" label="National Forests" on={ui.destForest} onClick={toggle("destForest")} />
                  <TogRow glyph="■" color="#d9a441" label="Basecamp Towns" on={ui.destTowns} onClick={toggle("destTowns")} />
                </div>

                <div style={{ ...monoLabel, marginBottom: 6 }}>On the map</div>
                <div style={{ marginBottom: 8 }}>
                  <TogRow glyph="▲" color="#d08a4b" label="Campgrounds & areas" on={ui.campgrounds} onClick={toggle("campgrounds")} />
                  <TogRow glyph="●" color="#4f96c9" label="Lakes" on={ui.destLake} onClick={toggle("destLake")} />
                  <TogRow glyph="▬" color={TRAIL_STYLE.hiking} label="Hiking trails" on={ui.layerHiking} onClick={toggle("layerHiking")} />
                  <TogRow glyph="▬" color={TRAIL_STYLE.offroad} label="Off-road / 4x4" on={ui.layerOffroad} onClick={toggle("layerOffroad")} />
                  <TogRow glyph="▬" color={TRAIL_STYLE.ski} label="Ski routes" on={ui.layerSki} onClick={toggle("layerSki")} />
                </div>
                <div style={{ fontSize: ".68rem", color: "#7f8a82", lineHeight: 1.4, marginBottom: 12 }}>Trail, campground &amp; lake layers draw around the park you select.</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button onClick={() => patch({ destNational: true, destState: true, destForest: true, destLake: true, campgrounds: true, layerHiking: true, layerOffroad: true, layerSki: true })} style={{ flex: 1, cursor: "pointer", fontSize: ".78rem", fontWeight: 600, color: "#e7e3d8", background: "rgba(255,255,255,.04)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 10, padding: 8, fontFamily: "inherit" }}>All</button>
                  <button onClick={() => patch({ destNational: false, destState: false, destForest: false, destLake: false, campgrounds: false, layerHiking: false, layerOffroad: false, layerSki: false })} style={{ flex: 1, cursor: "pointer", fontSize: ".78rem", fontWeight: 600, color: "#e7e3d8", background: "rgba(255,255,255,.04)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 10, padding: 8, fontFamily: "inherit" }}>None</button>
                </div>
                {/* Run the filters — fit the map to results, with a loading spinner while data streams in */}
                <button onClick={runFilter} disabled={busy} style={{ width: "100%", boxSizing: "border-box", marginBottom: 16, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: ".86rem", fontWeight: 700, fontFamily: "inherit", color: "#0b1710", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", border: "none", borderRadius: 12, padding: 12, boxShadow: "0 12px 30px -14px rgba(217,183,121,.6)", opacity: busy ? 0.85 : 1 }}>
                  {busy
                    ? <><span style={{ width: 15, height: 15, border: "2px solid rgba(11,23,16,.35)", borderTopColor: "#0b1710", borderRadius: "50%", display: "inline-block", animation: "ppspin .7s linear infinite" }} />Loading…</>
                    : <>◎ Run · {visible.length} result{visible.length === 1 ? "" : "s"}</>}
                </button>
              </div>
              </>
              )}

              {ui.listMode && (
                <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "1.5rem", color: "#f4f1ea", margin: "2px 0 12px" }}>All parks</h2>
              )}

              <div style={{ display: "flex", gap: 8, margin: "6px 0 14px" }}>
                <button onClick={() => patch({ listMode: false })} style={{ flex: 1, cursor: "pointer", fontSize: ".8rem", fontWeight: 600, borderRadius: 10, padding: 9, fontFamily: "inherit", border: !ui.listMode ? "none" : "1px solid rgba(217,183,121,.2)", background: !ui.listMode ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.04)", color: !ui.listMode ? "#0b1710" : "#c3c8d0" }}>◉ Map</button>
                <button onClick={() => patch({ listMode: true })} style={{ flex: 1, cursor: "pointer", fontSize: ".8rem", fontWeight: 600, borderRadius: 10, padding: 9, fontFamily: "inherit", border: ui.listMode ? "none" : "1px solid rgba(217,183,121,.2)", background: ui.listMode ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.04)", color: ui.listMode ? "#0b1710" : "#c3c8d0" }}>☰ List</button>
              </div>

              {ui.anchor && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(217,183,121,.12)", border: "1px solid rgba(217,183,121,.3)", borderRadius: 11, padding: "8px 11px", marginBottom: 10 }}>
                  <span style={{ color: "#d9b779" }}>◎</span>
                  <span style={{ flex: 1, fontSize: ".78rem", fontWeight: 600, color: "#e8cf9a" }}>Around {ui.anchor.label}</span>
                  <button aria-label="Clear location anchor" onClick={clearAnchor} style={{ background: "none", border: "none", color: "#d9b779", fontSize: ".8rem", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                </div>
              )}

              <div style={{ ...monoLabel, marginBottom: 10 }}>{visible.length} of {parks.length} match</div>

              {!ui.listMode && (
                <>
                  {anchoredPark && <div style={{ marginBottom: 11 }}>{renderParkCard(anchoredPark)}</div>}
                  <div style={{ textAlign: "center", color: "#7f8a82", fontSize: ".85rem", lineHeight: 1.6, padding: "20px 12px", background: "rgba(255,255,255,.03)", border: "1px dashed rgba(217,183,121,.2)", borderRadius: 14 }}>
                    Tap any pin on the map to explore that place — conditions, details, and what&apos;s nearby.
                  </div>
                </>
              )}
              {ui.listMode && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sortedVisible.length === 0 && (
                    <div style={{ textAlign: "center", color: "#7f8a82", padding: "26px 10px", fontSize: ".85rem" }}>Nothing here with these filters — try widening the radius or turning a few back on.</div>
                  )}
                  {sortedVisible.map((p) => renderParkCard(p))}
                </div>
              )}
            </>
          )}

          {/* ========== DETAIL VIEW ========== */}
          {ui.view === "detail" && sel && (
            <>
              {/* HERO — full-bleed photo + verdict-forward title */}
              <div style={{ position: "relative", height: 190, margin: "-72px -16px 0", overflow: "hidden", background: "repeating-linear-gradient(135deg,#16321f 0 14px,#12291a 14px 28px)" }}>
                <CoverPhoto park={sel} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.12) 35%,rgba(8,19,13,.94))" }} />
                <button onClick={backToBrowse} style={{ position: "absolute", top: 70, left: 16, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(9,22,15,.66)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", border: "1px solid rgba(217,183,121,.25)", borderRadius: 999, padding: "6px 13px", color: "#e7e3d8", fontSize: ".76rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>‹ Back to browse</button>
                <div style={{ position: "absolute", left: 18, right: 18, bottom: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#e8cf9a" }}>{selMeta.icon} {selMeta.label} · {sel.state}</div>
                  <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "1.9rem", lineHeight: 1, color: "#f7f4ec", textShadow: "0 2px 14px rgba(0,0,0,.6)", margin: "2px 0 0" }}>{sel.name}</h2>
                </div>
              </div>
              <div style={{ height: 14 }} />

              {selAccess && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: selAccess.level === "none" ? "rgba(224,144,106,.1)" : "rgba(217,183,121,.1)", border: "1px solid " + (selAccess.level === "none" ? "rgba(224,144,106,.32)" : "rgba(217,183,121,.3)"), borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
                  <span style={{ fontSize: "1rem" }}>✈️</span>
                  <div>
                    <b style={{ fontSize: ".8rem", color: selAccess.level === "none" ? "#e0906a" : "#e8cf9a", display: "block", marginBottom: 2 }}>{selAccess.level === "none" ? "No road access" : "Limited road access"}</b>
                    <span style={{ fontSize: ".76rem", color: "#8a938b", lineHeight: 1.4 }}>{selAccess.text}</span>
                  </div>
                </div>
              )}

              {(gateway || (selGateways && selGateways.length > 0)) && (() => {
                const rest = (selGateways || []).filter((t) => !(gateway && gateway.town && gateway.town.indexOf(t.bareName) > -1));
                return (
                  <div style={{ background: "rgba(217,183,121,.1)", border: "1px solid rgba(217,183,121,.28)", borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
                    <div style={{ fontFamily: mono, fontSize: ".52rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#d9b779", marginBottom: 3 }}>🏘 Gateway {(selGateways && selGateways.length > 1) ? "towns · " + selGateways.length : "town"}</div>
                    <b style={{ fontSize: ".86rem", color: "#f4f1ea", display: "block" }}>{(gateway && gateway.town) || (selGateways && selGateways[0] && selGateways[0].name)}</b>
                    {gateway && gateway.blurb && <div style={{ fontSize: ".76rem", color: "#8a938b", marginTop: 3, lineHeight: 1.4 }}>{gateway.blurb}</div>}
                    {rest.length > 0 && (
                      <div style={{ marginTop: 8, maxHeight: 148, overflowY: "auto", borderTop: "1px solid rgba(217,183,121,.15)", paddingTop: 6 }}>
                        {rest.map((t, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: ".76rem", color: "#c3c8d0", padding: "3px 0" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                            <span style={{ color: "#7f8a82", flex: "none" }}>{t.distanceMi} mi</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[["live", "☀ Live"], ["about", "ⓘ About"], ["trails", "🥾 Trails"]].map(([t, lbl]) => {
                  const on = ui.detailTab === t;
                  return <button key={t} onClick={() => patch({ detailTab: t })} style={{ flex: 1, cursor: "pointer", fontSize: ".82rem", fontWeight: 600, borderRadius: 12, padding: 9, fontFamily: "inherit", border: on ? "1px solid transparent" : "1px solid rgba(217,183,121,.18)", background: on ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "rgba(255,255,255,.03)", color: on ? "#0b1710" : "#c3c8d0" }}>{lbl}</button>;
                })}
              </div>

              {trailStatus && trailStatus.park === sel.name && trailStatus.state !== "done" && (
                <div style={{ fontSize: ".7rem", color: "#8a938b", margin: "-4px 0 12px", display: "flex", alignItems: "center", gap: 6, lineHeight: 1.4 }}>
                  {trailStatus.state === "loading" && <span>⏳ Rounding up the trails near {sel.name}…</span>}
                  {trailStatus.state === "empty" && <span>No mapped trails within 25 mi of the park center yet — I'll keep looking as data grows.</span>}
                  {trailStatus.state === "error" && (
                    <>
                      <span>Couldn't pull the trails just now.</span>
                      <button onClick={() => loadTrailsFor(sel)} style={{ border: "none", background: "none", color: "#d9b779", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: ".7rem", padding: 0, textDecoration: "underline" }}>Retry</button>
                    </>
                  )}
                </div>
              )}

              {ui.detailTab === "live" && (
                <>
                  <div style={{ background: selV.bg, border: "1px solid " + selV.border, borderRadius: 16, padding: "15px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 11, height: 11, borderRadius: "50%", background: selV.dot, boxShadow: "0 0 8px " + selV.dot }} />
                      <b style={{ fontFamily: serif, fontWeight: 500, fontSize: "1.4rem", color: selV.dot }}>{selV.headline}</b>
                    </div>
                    <p style={{ fontSize: ".84rem", color: "#aab0ba", lineHeight: 1.5, fontWeight: 300, margin: "6px 0 0" }}>{selVf && selVf.sub ? selVf.sub : selV.note}</p>
                    {selVf && (typeof selVf.temp === "number" || selVf.sky) && (
                      <div style={{ fontSize: ".86rem", fontWeight: 500, color: "#e7e3d8", marginTop: 10 }}>
                        {[typeof selVf.temp === "number" ? Math.round(selVf.temp) + "°F" : null, selVf.sky || null, typeof selVf.wind === "number" && selVf.wind ? "wind " + Math.round(selVf.wind) + " mph" : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {selVf && selVf.chips && selVf.chips.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {selVf.chips.slice(0, 4).map((c, i) => (
                          <span key={i} style={{ fontSize: ".7rem", fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: c.pos ? "rgba(79,217,138,.12)" : "rgba(224,144,106,.14)", border: "1px solid " + (c.pos ? "rgba(79,217,138,.3)" : "rgba(224,144,106,.35)"), color: c.pos ? "#4fd98a" : "#e0906a" }}>{c.t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selCond && (
                    <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 14, padding: "13px 15px", marginBottom: 12, fontSize: ".8rem", color: "#aab0ba", lineHeight: 1.55 }}>
                      {(selCond.weatherAlerts || []).length > 0 ? (
                        <>
                          <div style={{ fontFamily: mono, fontSize: ".52rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#e0906a", marginBottom: 5 }}>⚠ {selCond.weatherAlerts.length} active weather alert{selCond.weatherAlerts.length === 1 ? "" : "s"}</div>
                          {selCond.weatherAlerts.slice(0, 3).map((a, i) => (
                            <div key={i} style={{ fontWeight: 600, color: "#e0906a" }}>{a.event}</div>
                          ))}
                        </>
                      ) : (
                        <div style={{ fontWeight: 600, color: "#4fd98a" }}>✓ No active weather alerts</div>
                      )}
                      {(selCond.wildfires || []).length > 0 && (
                        <div style={{ marginTop: 7 }}>🔥 {selCond.wildfires.length} wildfire{selCond.wildfires.length === 1 ? "" : "s"} within ~80 mi{selCond.wildfires[0] && selCond.wildfires[0].name ? " · nearest: " + selCond.wildfires[0].name : ""}</div>
                      )}
                      {selCond.airQuality && (
                        <div style={{ marginTop: 7 }}>Air quality: <b style={{ color: "#e7e3d8" }}>{selCond.airQuality.aqi}</b> ({selCond.airQuality.category}{selCond.airQuality.parameter ? ", " + selCond.airQuality.parameter : ""})</div>
                      )}
                    </div>
                  )}
                  {statusHrefFor(sel) && (
                    <a href={statusHrefFor(sel)} style={{ display: "block", textAlign: "center", border: "1px solid rgba(217,183,121,.2)", borderRadius: 12, padding: 11, fontWeight: 600, fontSize: ".84rem", color: "#e8cf9a", textDecoration: "none", marginBottom: 14 }}>View full live status →</a>
                  )}
                  <PinesPeek name={sel.name} />
                </>
              )}
              {ui.detailTab === "about" && (
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 14, padding: 16, marginBottom: 14, fontSize: ".88rem", color: "#aab0ba", lineHeight: 1.65, fontWeight: 300 }}>
                  {selNps && selNps.park ? (
                    <>
                      {selNps.park.description && <p style={{ margin: "0 0 10px" }}>{selNps.park.description}</p>}
                      {(selNps.park.activities || []).length > 0 && (
                        <>
                          <div style={{ fontFamily: mono, fontSize: ".52rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#9aa7a0", margin: "12px 0 8px" }}>Things to do</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {selNps.park.activities.slice(0, 6).map((a) => (
                              <span key={a} style={{ background: "rgba(217,183,121,.12)", color: "#e8cf9a", border: "1px solid rgba(217,183,121,.2)", borderRadius: 999, padding: "3px 10px", fontSize: ".72rem", fontWeight: 600 }}>{a}</span>
                            ))}
                          </div>
                        </>
                      )}
                      {(selNps.thingsToDo || []).length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {selNps.thingsToDo.slice(0, 3).map((t) => (
                            <div key={t.title} style={{ fontSize: ".82rem", margin: "5px 0", display: "flex", gap: 8 }}><span style={{ color: "#d9b779" }}>•</span>{t.title}</div>
                          ))}
                        </div>
                      )}
                      {selNps.park.url && (
                        <a href={selNps.park.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: ".78rem", fontWeight: 600, color: "#e8cf9a", textDecoration: "none" }}>More on NPS.gov →</a>
                      )}
                    </>
                  ) : sel.type === "national_park" ? (
                    <div style={{ color: "#8a938b", fontSize: ".8rem" }}>Pulling the latest from NPS.gov…</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 8 }}><b style={{ color: "#e7e3d8" }}>Type:</b> {selMeta.label}</div>
                      <div style={{ marginBottom: 8 }}><b style={{ color: "#e7e3d8" }}>State:</b> {sel.state}</div>
                      <div style={{ color: "#8a938b", fontSize: ".78rem" }}>Live conditions on the Live tab · nearby places below.</div>
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
                      <div style={{ textAlign: "center", color: "var(--pb-muted)", padding: "16px 10px", fontSize: ".82rem" }}>⏳ Rounding up the trails…</div>
                    )}
                    {td && cats.length === 0 && (
                      <div style={{ textAlign: "center", color: "var(--pb-muted)", padding: "16px 10px", fontSize: ".82rem" }}>No mapped trails within 25 mi of the park center yet — I'll keep looking as data grows.</div>
                    )}
                    {cats.map((cat) => (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#9aa7a0", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{TRAIL_CAT_META[cat].icon}</span> {TRAIL_CAT_META[cat].label}s ({td[cat].length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {td[cat].map((t) => (
                            <button key={t.name} onClick={() => selectTrail(sel, cat, t)} style={{ textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "11px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ width: 6, height: 26, borderRadius: 3, background: TRAIL_STYLE[cat], flex: "none" }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <b style={{ fontSize: ".88rem", color: "#f4f1ea", display: "block" }}>{t.name}</b>
                                {t.trailClass && <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".04em", color: "#8a938b" }}>{t.trailClass}</span>}
                              </div>
                              <div style={{ textAlign: "right", flex: "none" }}>
                                <div style={{ fontFamily: serif, fontSize: "1.05rem", color: "#d9b779" }}>{t.lengthMi > 0 ? t.lengthMi + " mi" : "—"}</div>
                                <span style={{ color: "#d9b779", fontSize: ".8rem" }}>→</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <button onClick={() => toggleTripFor(ui.selectedName)} style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: 13, fontWeight: 600, fontSize: ".88rem", cursor: "pointer", fontFamily: "inherit", marginBottom: 18, background: tripHas ? "transparent" : "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: tripHas ? "#e7e3d8" : "#0b1710", border: tripHas ? "1px solid rgba(217,183,121,.3)" : "none" }}>
                {tripHas ? "✓ In your trip — tap to remove" : "+ Add to trip"}
              </button>

              {ui.detailTab !== "trails" && (
                <>
                  <div style={{ ...monoLabel, marginBottom: 8 }}>Nearby — within {ui.radius} mi (~{driveTimeLabel(ui.radius)} drive)</div>
                  <div style={{ fontSize: ".72rem", color: "#8a938b", margin: "0 0 10px", lineHeight: 1.4 }}>
                    {!selPlaces
                      ? "⏳ Checking campgrounds & recreation areas…"
                      : ((selPlaces.facilities || []).length + (selPlaces.recAreas || []).length) === 0
                        ? "No campgrounds turned up near this park."
                        : "🏕 " + (selPlaces.facilities || []).length + " campgrounds · " + (selPlaces.recAreas || []).length + " recreation areas on the map"}
                    {ui.destLake && lakesData[sel.name] && lakesData[sel.name].length > 0 && (" · 💧 " + lakesData[sel.name].length + " lakes")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <button aria-label="Decrease nearby radius" onClick={() => setRadius(ui.radius - 25)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(217,183,121,.22)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>−</button>
                    <input type="range" min="10" max="300" step="10" value={ui.radius} onChange={(e) => setRadius(+e.target.value)} aria-label="Nearby radius in miles" style={{ flex: 1, accentColor: "#c9a35f" }} />
                    <button aria-label="Increase nearby radius" onClick={() => setRadius(ui.radius + 25)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(217,183,121,.22)", background: "rgba(255,255,255,.04)", color: "#e8cf9a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {nearbyItems.length === 0 && (
                      <div style={{ textAlign: "center", color: "#7f8a82", padding: "16px 10px", fontSize: ".82rem" }}>Nothing within {ui.radius} mi — try widening the radius above.</div>
                    )}
                    {nearbyItems.map((o) => {
                      const meta = TYPE_META[o.type];
                      const handleClick = o.click || (o.href ? () => { window.location.href = o.href; } : undefined);
                      return (
                        <div key={o.name} onClick={handleClick} style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "10px 12px", cursor: handleClick ? "pointer" : "default" }}>
                          <span style={{ fontSize: "1rem" }}>{meta.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ fontSize: ".86rem", color: "#f4f1ea", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</b>
                            <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".06em", textTransform: "uppercase", color: "#8a938b" }}>{meta.label}</span>
                          </div>
                          <div style={{ textAlign: "right", flex: "none" }}>
                            <div style={{ fontFamily: serif, fontSize: "1.05rem", color: "#e7e3d8" }}>{Math.round(o.dist)} mi</div>
                            <div style={{ fontSize: ".6rem", color: "#7f8a82" }}>~{driveTimeLabel(o.dist)} drive</div>
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
                <button onClick={() => patch({ view: "detail" })} style={{ background: "none", border: "none", color: "#e8cf9a", fontWeight: 600, fontSize: ".8rem", cursor: "pointer", fontFamily: "inherit", padding: "4px 4px 12px", display: "flex", alignItems: "center", gap: 5 }}>‹ {tr.parkName} trails</button>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.3rem" }}>{catMeta.icon}</span>
                  <span style={{ fontFamily: serif, fontSize: "1.4rem", fontWeight: 500, color: "#f4f1ea" }}>{tr.name}</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#8a938b", marginBottom: 14 }}>{catMeta.label} · {tr.parkName}</div>

                <TrailPhoto name={tr.name} state={parks.find((p) => p.name === tr.parkName)?.state} />

                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 14, padding: 16, marginTop: 12, marginBottom: 14 }}>
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
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(217,183,121,.14)", fontSize: ".8rem", color: "#aab0ba" }}>
                      <b style={{ color: "#e8cf9a" }}>Seasonal:</b> {tr.seasonNote}
                    </div>
                  )}
                  {tr.notes && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(217,183,121,.14)", fontSize: ".8rem", color: "#aab0ba", lineHeight: 1.5 }}>{tr.notes}</div>
                  )}
                </div>

                {tr.id != null && tr.parkCode && (
                  <a href={"/trail-status?trail=" + tr.id + "&park=" + encodeURIComponent(tr.parkCode)} style={{ display: "block", textAlign: "center", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", borderRadius: 12, padding: 12, fontWeight: 600, fontSize: ".86rem", color: "#0b1710", textDecoration: "none", marginBottom: 14 }}>Open full trail status →</a>
                )}

                <div style={{ fontSize: ".7rem", color: "#7f8a82", lineHeight: 1.4, marginBottom: 18 }}>
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
              <button onClick={backToBrowse} style={{ background: "none", border: "none", color: "#e8cf9a", fontWeight: 600, fontSize: ".8rem", cursor: "pointer", fontFamily: "inherit", padding: "4px 4px 12px", display: "flex", alignItems: "center", gap: 5 }}>‹ Back to browse</button>
              <div style={{ fontFamily: serif, fontSize: "1.5rem", fontWeight: 500, color: "#f4f1ea", marginBottom: 4 }}>My Trip</div>
              <div style={{ ...monoLabel, marginBottom: 14 }}>
                {ui.trip.length ? ui.trip.length + " place" + (ui.trip.length === 1 ? "" : "s") + " added" : "No places yet"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
                {tripItems.length === 0 && (
                  <div style={{ textAlign: "center", color: "#7f8a82", padding: "24px 10px", fontSize: ".85rem", lineHeight: 1.5 }}>Your trip&apos;s empty for now — pick a place and hit &quot;Add to trip,&quot; and I&apos;ll start building the route.</div>
                )}
                {tripItems.map((p, i) => {
                  const meta = TYPE_META[p.type];
                  return (
                    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "10px 12px" }}>
                      <span style={{ width: 24, height: 24, flex: "none", borderRadius: "50%", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0b1710", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: ".72rem", fontWeight: 700 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: ".86rem", color: "#f4f1ea", display: "block" }}>{p.name}</b>
                        <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".06em", textTransform: "uppercase", color: "#8a938b" }}>{meta.label} · {p.state}</span>
                      </div>
                      <button aria-label={"Remove " + p.name + " from trip"} onClick={() => patch((s) => ({ trip: s.trip.filter((n) => n !== p.name) }))} style={{ background: "none", border: "none", color: "#e0906a", cursor: "pointer", fontSize: "1.15rem", lineHeight: 1 }}>×</button>
                    </div>
                  );
                })}
              </div>
              {ui.trip.length > 0 && (
                <a href="/build-trip" style={{ display: "block", textAlign: "center", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0b1710", padding: 13, borderRadius: 12, fontWeight: 600, fontSize: ".9rem", textDecoration: "none" }}>Build this trip →</a>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ---- bottom-left: Home + verdict legend (clears the left panel when open) ---- */}
      <div style={{ position: "absolute", left: ui.panelOpen ? 416 : 16, bottom: 18, zIndex: 20, display: "flex", alignItems: "center", gap: 9, transition: "left .45s cubic-bezier(.16,.8,.24,1)" }}>
        <button onClick={() => { window.location.href = "/"; }} style={{ display: "flex", alignItems: "center", gap: 7, ...panelGlass, borderRadius: 999, padding: "9px 15px", fontFamily: "inherit", fontWeight: 600, fontSize: ".8rem", color: "#e7e3d8", cursor: "pointer" }}>
          <span style={{ color: "#e8cf9a" }}>▲</span>Home
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, ...panelGlass, borderRadius: 999, padding: "9px 16px" }}>
          <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#9aa7a0" }}>Today&apos;s call</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".58rem", fontWeight: 700, color: "#4fd98a" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#4fd98a" }} />GO</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".58rem", fontWeight: 700, color: "#e8cf9a" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#e8cf9a" }} />PREPARE</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".58rem", fontWeight: 700, color: "#e0906a" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#e0906a" }} />HOLD</span>
        </div>
        {/* map appearance: dark (default) vs. familiar Google terrain */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, ...panelGlass, borderRadius: 999, padding: 3 }} title="Map appearance">
          {[["dark", "◐ Dark"], ["standard", "◑ Map"]].map(([k, lbl]) => {
            const on = ui.mapStyle === k;
            return (
              <button key={k} onClick={() => setMapStyle(k)} style={{ cursor: "pointer", fontFamily: mono, fontSize: ".54rem", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700, border: "none", borderRadius: 999, padding: "6px 11px", background: on ? "linear-gradient(120deg,#e8cf9a,#c9a35f)" : "transparent", color: on ? "#0b1710" : "#c3c8d0" }}>{lbl}</button>
            );
          })}
        </div>
      </div>

      {/* ---- right-center: zoom controls ---- */}
      <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", zIndex: 22, display: "flex", flexDirection: "column", borderRadius: 14, overflow: "hidden", ...panelGlass }}>
        <button onClick={zoomIn} aria-label="Zoom in" style={{ cursor: "pointer", width: 42, height: 42, background: "transparent", border: "none", borderBottom: "1px solid rgba(217,183,121,.16)", color: "#e8cf9a", fontSize: "1.2rem", fontWeight: 600 }}>+</button>
        <button onClick={zoomOut} aria-label="Zoom out" style={{ cursor: "pointer", width: 42, height: 42, background: "transparent", border: "none", borderBottom: "1px solid rgba(217,183,121,.16)", color: "#e8cf9a", fontSize: "1.2rem", fontWeight: 600 }}>−</button>
        <button onClick={() => { const m = mapObjRef.current; if (m) { m.setZoom(4); m.setCenter({ lat: 39.5, lng: -98.5 }); } }} aria-label="Reset view" style={{ cursor: "pointer", width: 42, height: 42, background: "transparent", border: "none", color: "#e8cf9a", fontSize: ".9rem" }}>⌂</button>
      </div>

      {/* ---- bottom-right: my location + fullscreen + Ask Park Buddy ---- */}
      <button aria-label={ui.liveLoc ? "Hide my live location" : "Show my live location"} title={ui.liveLoc ? "Hide my live location" : "Show my live location"} onClick={toggleLiveLocation} style={{ position: "absolute", right: 16, bottom: 120, zIndex: 20, width: 38, height: 38, borderRadius: "50%", ...panelGlass, border: ui.liveLoc ? "1px solid #3aa0d0" : panelGlass.border, color: ui.liveLoc ? "#3aa0d0" : "#e8cf9a", fontSize: "1.05rem", cursor: "pointer" }}>◉</button>
      <button aria-label="Toggle fullscreen" title="Fullscreen" onClick={() => { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen(); else if (document.exitFullscreen) document.exitFullscreen(); }} style={{ position: "absolute", right: 16, bottom: 72, zIndex: 20, width: 38, height: 38, borderRadius: "50%", ...panelGlass, color: "#e8cf9a", fontSize: "1rem", cursor: "pointer" }}>⤢</button>
      <button onClick={askParkBuddy} style={{ position: "absolute", right: 16, bottom: 18, zIndex: 20, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0b1710", border: "none", borderRadius: 999, padding: "12px 18px", fontFamily: "inherit", fontWeight: 600, fontSize: ".84rem", cursor: "pointer", boxShadow: "0 14px 32px -14px rgba(0,0,0,.7)" }}>
        <span>✦</span>Ask Park Buddy
      </button>
    </div>
  );
}
