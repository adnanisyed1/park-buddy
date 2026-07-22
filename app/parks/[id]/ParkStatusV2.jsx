"use client";

// /parks/:id — deep, tabbed park status page, ported from park-status-v2-preview.html
// onto REAL data. The mock's Zion-only editorial (hand-authored day timeline,
// crowd curve, trip reports) is replaced with live sources or honest empty states —
// we never invent a condition. Live data: verdict engine (weather.gov), /api/nps,
// /api/conditions, /api/roadstatus, /api/webcams, /api/trails, /api/places,
// /api/water, weather.gov forecast, computed sun/moon. Per-park alert subscriptions
// persist to the Supabase park_alerts table (see supabase-park-alerts.sql).

import { useEffect, useRef, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import BuddyLoader from "../../components/BuddyLoader";
import { useThemedBody } from "../../lib/theme";
import { usePhoto } from "../../components/PhotoThumb";
import WeatherTile, { conditionFromSky } from "../../components/WeatherTile";
import ForecastTile from "../../components/ForecastTile";
import SaveButton from "../../components/SaveButton";
import loadScript from "../../components/load-script";
import { getSunTimes, getMoon, fmtTime } from "../../lib/sunmoon";
import { addStop, inTrip } from "../../lib/trip";
import { townHref } from "../../lib/townLink";
import ToursNearby from "../../components/ToursNearby";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
// These flip per theme (globals.css defines a darker set for light, because the
// bright dark-theme green is illegible on a pale card).
const VC = { go: "var(--pb-go)", prepare: "var(--pb-prepare)", hold: "var(--pb-hold)", loading: "var(--pb-muted)" };
const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 18, padding: 18 };
// Small caps label. Two variants, because the same style was being used on the
// hero photograph AND on the page surface, which need opposite inks: #9aa7a0 is
// legible on a dark photo and about 2.5:1 on white.
const microLabel = { fontFamily: mono, fontSize: ".56rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" };
const microOnPhoto = { ...microLabel, color: "rgba(244,241,234,.82)" };
const hatch = "repeating-linear-gradient(135deg,#16321f 0 12px,#12291a 12px 24px)";

function milesBetween(a, b) {
  const R = 3958.8, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function sevColor(sev = "") {
  const s = sev.toLowerCase();
  if (/extreme|severe/.test(s)) return "#e0906a";
  if (/moderate/.test(s)) return "#e8cf9a";
  return "#9aa7a0";
}
function fmtDateTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}
// Weather glyphs used to be emoji here. Two of them — U+1F32B fog and U+1F324
// sun-behind-cloud — have no glyph in plenty of system fonts, so a foggy morning
// or a partly-cloudy Wednesday rendered as a grey tofu box while sunny and rainy
// days looked fine. Drawn shapes can't fail that way, and they animate.
// The strips use app/components/ForecastTile.jsx, drawn natively at 88x46 and
// 78x42 — scaling the big tile down put its rain streaks at 0.75px.

const TABS = [
  ["overview", "Overview"],
  ["conditions", "Conditions"],
  ["trails", "Trails & permits"],
  ["plan", "Plan"],
  ["nearby", "Nearby"],
];
const ALERT_DEFS = [
  ["alert_verdict", "Verdict flips"],
  ["alert_permit", "Permit drops"],
  ["alert_road", "Road & pass opens"],
  ["alert_flood", "Flash-flood watch"],
  ["alert_snow", "First snow"],
];

export default function ParkStatusV2({ id, kind = "park" }) {
  const themeRef = useRef(null);
  useThemedBody(themeRef);
  const isForest = kind === "forest";
  const isStatePark = kind === "state_park";
  const isNP = !isForest && !isStatePark; // national park (NPS) mode
  const KIND_LABEL = isForest ? "National Forest" : isStatePark ? "State Park" : "National Park";
  const [park, setPark] = useState(undefined); // undefined loading, null not found
  const [tab, setTab] = useState("overview");
  const [verdict, setVerdict] = useState(null); // {bucket, ...full}
  const [nps, setNps] = useState(null);
  const [cond, setCond] = useState(null);
  const [road, setRoad] = useState(null);
  const [webcams, setWebcams] = useState(null);
  const [trails, setTrails] = useState(null);
  const [places, setPlaces] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [daily, setDaily] = useState(null);
  const [river, setRiver] = useState(null);
  const [tz, setTz] = useState(null); // park's IANA timezone (from weather.gov points)
  const [nearby, setNearby] = useState(null);
  const [radius, setRadius] = useState(60);
  const [added, setAdded] = useState(false);
  const alertsRef = useRef(null);

  const hero = usePhoto(park ? (isNP ? park.name + " National Park|" + park.name : park.name + "|" + park.name) : null, null, null, undefined, 1600);

  // ---- boot: resolve park + fetch everything ----
  useEffect(() => {
    let on = true;
    (async () => {
      await loadScript("/trip-data.js");
      await loadScript("/pb-verdict.js");
      if (!on) return;
      const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      // The 63 national parks — used to resolve a park AND (in both modes) to list
      // the nearby parks below.
      const all = (typeof window !== "undefined" && window.TRIP_PARKS) || [];
      let p;
      if (isForest) {
        // National forests: resolve from the curated centroid dataset (no NPS id).
        const fd = await fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!on) return;
        const list = (fd && fd.forests) || [];
        // Lenient match — the map's live forest names may omit the "National
        // Forest(s)" suffix the curated list carries, so compare on the base slug.
        const base = (s) => slug(s).replace(/-national-forests?$/, "");
        const f0 = list.find((x) => base(x.name) === base(id)) || list.find((x) => base(x.name).startsWith(base(id)) || base(id).startsWith(base(x.name))) || null;
        if (!f0) { setPark(null); return; }
        p = { ...f0, npsCode: "" };
      } else if (isStatePark) {
        // State parks: resolve from the Supabase destinations table by namespaced id
        // (e.g. state:me-baxter-state-park). Not NPS — live data is all lat/lng-based.
        const dd = await fetch("/api/destinations?id=" + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!on) return;
        const row = dd && dd.destinations && dd.destinations[0];
        if (!row) { setPark(null); return; }
        p = { ...row, npsCode: "" };
      } else {
        // URL param is a string; park ids in trip-data are numbers — compare loosely.
        // Also accept a name-slug (e.g. /parks/zion) for friendlier links.
        const p0 = all.find((x) => String(x.id) === String(id) || slug(x.name) === slug(id)) || null;
        if (!p0) { setPark(null); return; }
        p = { ...p0, npsCode: (window.NPS_CODE || {})[p0.id] || "" };
      }
      const npsCode = p.npsCode;
      setPark(p);
      try { document.title = p.name + " — live " + KIND_LABEL.toLowerCase() + " status · Park Buddy"; } catch {}

      // verdict (weather.gov via pb-verdict)
      const PB = window.PBVerdict;
      if (PB && PB.fetchVerdict) {
        PB.fetchVerdict(p.lat, p.lng, (res) => {
          if (!on) return;
          const r = res && typeof res.score === "number" ? res : res && res.v ? res.v : null;
          if (r) setVerdict({ ...r, bucket: r.score >= 62 ? "go" : r.score >= 42 ? "prepare" : "hold" });
        });
      }

      // live data (parallel, all best-effort)
      const j = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      // NPS unit data + road-closure feed are national-park only (forests & state parks aren't NPS units).
      if (isNP) {
        j("/api/nps?name=" + encodeURIComponent(p.name)).then((d) => on && d && d.park && setNps(d));
        j("/api/roadstatus?park=" + encodeURIComponent(p.id) + "&lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4)).then((d) => on && setRoad(d || {}));
      }
      j("/api/conditions?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4)).then((d) => on && setCond(d || {}));
      j("/api/webcams?name=" + encodeURIComponent(p.name) + (npsCode ? "&parkCode=" + npsCode : "")).then((d) => on && setWebcams((d && (d.webcams || d.cams)) || []));
      j("/api/trails?" + (npsCode ? "parkCode=" + npsCode : "lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=25")).then((d) => on && setTrails(d || { hiking: [], offroad: [], ski: [] }));
      j("/api/places?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=50").then((d) => on && setPlaces(d || { facilities: [], recAreas: [] }));
      j("/api/riverflow?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4)).then((d) => on && setRiver(d || { found: false }));

      // weather.gov forecast (12h hourly + 7-day)
      (async () => {
        try {
          const pts = await j("https://api.weather.gov/points/" + p.lat.toFixed(4) + "," + p.lng.toFixed(4));
          if (!pts || !pts.properties) return;
          if (on && pts.properties.timeZone) setTz(pts.properties.timeZone);
          const [h, d] = await Promise.all([j(pts.properties.forecastHourly), j(pts.properties.forecast)]);
          if (!on) return;
          if (h && h.properties) setHourly(h.properties.periods.slice(0, 13).filter((_, i) => i % 2 === 0).slice(0, 6));
          if (d && d.properties) {
            const per = d.properties.periods;
            const days = [];
            for (let i = 0; i < per.length && days.length < 7; i++) {
              const cur = per[i];
              if (!cur.isDaytime) continue;
              const night = per[i + 1] && !per[i + 1].isDaytime ? per[i + 1] : null;
              days.push({ name: cur.name.replace(/ (Afternoon|Night)/, "").slice(0, 3), hi: cur.temperature, lo: night ? night.temperature : null, sky: cur.shortForecast || "", isDay: true, wind: 0, pop: (cur.probabilityOfPrecipitation && cur.probabilityOfPrecipitation.value) || 0 });
            }
            setDaily(days);
          }
        } catch {}
      })();

      // nearby parks (from trip-data — real + easy), lakes + towns fetched by radius below
      const others = all.filter((x) => x.id !== p.id).map((x) => ({ ...x, distMi: Math.round(milesBetween(p, x)) }));
      setNearby((prev) => ({ ...(prev || {}), parks: others }));
      j("/api/water?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=161").then((d) => on && setNearby((prev) => ({ ...(prev || {}), lakes: (d && d.lakes) || [] })));
      j("/api/gateway?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&state=" + encodeURIComponent(p.state || "")).then((d) => on && setNearby((prev) => ({ ...(prev || {}), towns: (d && (d.towns || d)) || [] })));
      // Other NPS units nearby (monuments, historic sites, seashores…) — a separate
      // category, surfaced as a cross-link, never mixed into the 63 national parks.
      j("/api/destinations?lat=" + p.lat.toFixed(4) + "&lng=" + p.lng.toFixed(4) + "&radius=150&type=nps_unit&limit=12").then((d) => on && setNearby((prev) => ({ ...(prev || {}), npsUnits: (d && d.destinations) || [] })));
    })();
    return () => { on = false; };
  }, [id]);

  // Reflect whether this park is already in the trip.
  useEffect(() => { if (park) setAdded(inTrip(park.name)); }, [park]);

  const scrollToTabs = () => { const el = document.getElementById("ps-tabnav"); if (el) window.scrollTo({ top: el.offsetTop - 64, behavior: "smooth" }); };
  const goAlerts = () => { setTab("conditions"); setTimeout(() => { const el = alertsRef.current; if (el) { window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 80, behavior: "smooth" }); el.style.transition = "box-shadow .4s"; el.style.boxShadow = "0 0 0 2px #e8cf9a,0 30px 70px -40px rgba(0,0,0,.9)"; setTimeout(() => { el.style.boxShadow = ""; }, 1600); } }, 60); };

  if (park === null) {
    return (
      <div ref={themeRef} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
        <SiteHeader acctSlot />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "140px 20px", textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: "2.4rem", fontWeight: 600 }}>{KIND_LABEL} not found</h1>
          <p style={{ color: "var(--pb-ink-2)", marginTop: 10 }}>We couldn&apos;t find a {KIND_LABEL.toLowerCase()} with that id.</p>
          <a href="/explore" style={{ display: "inline-block", marginTop: 18, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "11px 20px", fontWeight: 600, textDecoration: "none" }}>Explore the map →</a>
        </div>
      </div>
    );
  }

  const bucket = verdict ? verdict.bucket : "loading";
  const vColor = VC[bucket];
  const temp = verdict && typeof verdict.temp === "number" ? Math.round(verdict.temp) : null;

  // On a phone the hero grid stacks, which used to drop the verdict card ON
  // TOP of the photograph — the picture became a thin frame around a card.
  // Below 640px the card moves out of the hero entirely and docks just under
  // it instead (slight overlap, so they read as one composition).
  const [phoneHero, setPhoneHero] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setPhoneHero(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // One definition, two possible homes (in the hero grid on desktop, below
  // the hero on a phone) — never two copies to keep in sync.
  const verdictCard = (
    <div style={{ background: "var(--pb-glass-strong)", WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)", border: "1px solid color-mix(in srgb, " + vColor + " 45%, transparent)", borderRadius: 22, padding: phoneHero ? 16 : 22, color: "var(--pb-ink)", boxShadow: "0 30px 80px -50px rgba(0,0,0,.9)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: vColor, boxShadow: "0 0 10px " + vColor, animation: "ps-pulse 2.4s infinite" }} />
        <span style={{ ...microLabel, letterSpacing: ".16em" }}>Today&apos;s call{verdict ? "" : " · loading"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 12, rowGap: 2, marginTop: phoneHero ? 6 : 10 }}>
        <span style={{ fontFamily: serif, fontWeight: 700, fontSize: phoneHero ? "1.9rem" : "clamp(2.4rem,5vw,3.4rem)", lineHeight: 1.05, color: vColor }}>{verdict ? (verdict.word || bucket.toUpperCase()) : "…"}</span>
      </div>
      <p style={{ fontSize: phoneHero ? ".88rem" : ".96rem", color: "var(--pb-ink-2)", lineHeight: 1.5, marginTop: 6 }}>{verdict ? verdict.sub : "Let me read today's conditions from the National Weather Service…"}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: phoneHero ? 10 : 16 }}>
        {temp != null && <span style={chip()}>☀ {temp}°F {verdict.sky || ""}</span>}
        {verdict && typeof verdict.wind === "number" ? <span style={chip()}>🌬 {Math.round(verdict.wind)} mph</span> : null}
        <span style={chip((cond && (cond.weatherAlerts || []).length) ? "warn" : "good")}>{cond ? ((cond.weatherAlerts || []).length ? (cond.weatherAlerts.length + " alert" + (cond.weatherAlerts.length === 1 ? "" : "s")) : "No alerts") : "…"}</span>
      </div>
    </div>
  );
  // Reliable last-resort photo candidates for trail/campground tiles: this place's
  // own article (national parks need the " National Park" suffix; forests & state
  // parks already carry theirs). Used as usePhoto `fallback` so a tile shows its
  // park instead of a blank frame when the specific name + geo photo both fail.
  const areaQ = park ? (isNP ? park.name + " National Park|" + park.name : park.name) : "";

  return (
    <div ref={themeRef} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      {/* dangerouslySetInnerHTML is LOAD-BEARING here, not a shortcut: a
          style tag rendered as a text child gets HTML-escaped by the server
          but not the client, so any apostrophe, quote or angle bracket —
          including the > child combinator, which is legitimate CSS — fails
          hydration for the whole page. This has now bitten twice. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ps-pulse { 0% { box-shadow: 0 0 0 0 rgba(79,217,138,.5);} 70% { box-shadow: 0 0 0 8px rgba(79,217,138,0);} 100% { box-shadow: 0 0 0 0 rgba(79,217,138,0);} }
        @keyframes ps-ken { 0% { transform: scale(1.04);} 100% { transform: scale(1.12);} }
        .ps-tab-panel { display: none; }
        .ps-tab-panel.on { display: block; }
        /* two-column layouts (hero, about, subscribe) — stack on mobile */
        .ps-grid { grid-template-columns: minmax(0,1.2fr) minmax(0,1fr); }
        @media (max-width: 860px) { .ps-grid { grid-template-columns: 1fr !important; } }
        /* On phones the verdict card leaves the hero (see phoneHero), so the
           photo needs a real height of its own — min-height auto collapsed it
           to a sliver behind the title once the card stopped propping it up.
           NOTE: never put quote, apostrophe or angle-bracket characters in
           this style block. The server HTML-escapes them, the client keeps
           them raw, and that mismatch fails hydration for the whole page. */
        @media (max-width: 640px) { .ps-hero { min-height: 48vh !important; padding-top: 84px !important; } }
        /* Live-conditions strip: four cells, one line, no scroll, ANY screen.
           On the phone the cells compact — one-word label, smaller value, no
           prose — because the whole picture in one glance beats details that
           push half the picture off-screen. */
        @media (max-width: 640px) {
          /* weather on a phone: hourly / 7-day tile grids become one
             sideways-scrolling strip; the today tile is full-width everywhere. */
          .ps-hours { display: flex !important; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
          .ps-hours > div { flex: 0 0 104px; }
          .ps-stats { gap: 6px !important; }
          .ps-stats .ps-stat { padding: 10px 8px !important; }
          .ps-stats .ps-stat-lab-full { display: none !important; }
          .ps-stats .ps-stat-lab-short { display: block !important; font-size: .5rem !important; letter-spacing: .1em !important; }
          .ps-stats .ps-stat-val { font-size: 1.05rem !important; margin-top: 7px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .ps-stats .ps-stat-note { display: none !important; }
        }
      ` }} />

      <SiteHeader acctSlot />

      {/* HERO + VERDICT */}
      {/* The hero is the one region that is NOT on the page surface — it's on a
          full-bleed photograph, which is dark whatever the theme is. Inheriting
          --pb-ink meant the park's own name rendered dark forest green on a dark
          photo in light theme. Pinned to a literal light ink here, which is also
          why every colour inside this section stays literal rather than tokenised. */}
      <section className="ps-hero" style={{ position: "relative", overflow: "hidden", minHeight: "min(88vh,700px)", display: "flex", alignItems: "flex-end", color: "#f4f1ea", padding: "clamp(96px,13vh,150px) clamp(16px,4vw,40px) clamp(30px,5vh,54px)" }}>
        {park && hero && hero.url && <img alt="" src={hero.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "ps-ken 24s ease-out both" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.4) 0%,rgba(8,19,13,.12) 38%,rgba(8,19,13,.85) 100%)" }} />
        <div className="ps-grid" style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", width: "100%", display: "grid", gap: "clamp(20px,4vw,44px)", alignItems: "end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Champagne, literal. The light theme's --pb-gold is #a37c3f, a
                  deep gold chosen to be legible as text on cream — on this dark
                  photograph it reads as mud. */}
              <span style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".24em", textTransform: "uppercase", color: "#e8cf9a" }}>{KIND_LABEL} · {park ? park.state : ""}</span>
            </div>
            <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(3rem,8vw,6rem)", lineHeight: 0.92, letterSpacing: "-.02em", textShadow: "0 6px 40px rgba(0,0,0,.5)", marginTop: 10 }}>{park ? park.name : "…"}</h1>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
              <button onClick={addToTrip} style={{ cursor: "pointer", fontSize: ".86rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "12px 22px", boxShadow: "0 10px 30px -14px rgba(217,183,121,.6)" }}>{added ? "✓ In your trip" : "+ Add to trip"}</button>
              {park && (
                <SaveButton
                  size={44}
                  place={{
                    kind: isForest ? "forest" : isStatePark ? "statePark" : "park",
                    name: park.name,
                    ref: park.code || park.id || id,   // parkCode where we have one — keeps same-named places apart
                    state: park.state,
                    lat: park.lat, lng: park.lng,
                    sub: KIND_LABEL,
                    href: "/parks/" + id,
                  }}
                />
              )}
              {/* One primary action, two icons. Save is a heart, Alerts is a
                  bell — both self-explanatory at 44px — and Ask Park Buddy is
                  gone from here because the bottom bar already owns Ask on
                  every page. The hero is for the photograph. These colours
                  stay literal on purpose — this row sits on a photograph, not
                  the page surface, so it can't follow the light/dark tokens. */}
              <button onClick={goAlerts} aria-label="Get alerts for this place" title="Alerts"
                style={{ cursor: "pointer", width: 44, height: 44, borderRadius: 999, fontSize: "1.05rem",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#f4f1ea", background: "rgba(10,23,18,.5)", WebkitBackdropFilter: "blur(10px)",
                  backdropFilter: "blur(10px)", border: "1px solid var(--pb-line-strong)" }}>
                <span aria-hidden="true">🔔</span>
              </button>
            </div>
          </div>
          {/* verdict card — desktop home, beside the title on the photo */}
          {!phoneHero && verdictCard}
        </div>
      </section>

      {/* Phone home for the verdict card: docked just below the hero with a
          slight overlap, so the photograph stays a photograph and today's
          call still reads as part of the same composition. */}
      {phoneHero && (
        <div style={{ position: "relative", zIndex: 3, margin: "-26px 14px 10px" }}>
          {verdictCard}
        </div>
      )}

      {/* The alerts nudge used to sit here, as a full-width band between the hero
          and the tabs — an interstitial across the one path everyone takes into
          the page. It was also a duplicate: it did nothing but scroll to
          SubscribeCard, which already lives inside the Conditions tab where
          alerts belong. The card stays; the promo band is gone, and the way in
          is now a quiet action in the hero beside Add to trip. */}

      {/* STICKY TABS */}
      <div id="ps-tabnav" style={{ position: "sticky", top: 56, zIndex: 50,
        // --pb-glass-strong is the token the design system already defines for a
        // sheet/bar that floats over content, and it exists in both themes. The
        // old value was a hardcoded dark rgba, which put a dark band across the
        // middle of the light theme.
        background: "var(--pb-glass-strong)",
        WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--pb-line)", marginTop: 14 }}>
        <div role="tablist" aria-label="Park sections" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 2, padding: "0 clamp(16px,4vw,40px)", overflowX: "auto" }}>
          {TABS.map(([k, label]) => {
            const on = tab === k;
            return (
              <button key={k} role="tab" aria-selected={on}
                onClick={() => { setTab(k); scrollToTabs(); }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--pb-ink)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--pb-ink-2)"; }}
                style={{ position: "relative", cursor: "pointer", fontFamily: "inherit",
                  fontSize: ".875rem", fontWeight: on ? 700 : 500,
                  letterSpacing: on ? "-.005em" : "0",
                  color: on ? "var(--pb-ink)" : "var(--pb-ink-2)",
                  background: "transparent", border: "none",
                  padding: "16px 16px 15px", whiteSpace: "nowrap",
                  transition: "color .16s ease" }}>
                {label}
                {/* The rule sits on the bar's own bottom border rather than on the
                    button, so the active tab reads as continuous with the panel
                    below it instead of underlined. */}
                <span aria-hidden="true" style={{ position: "absolute", left: 12, right: 12, bottom: -1,
                  height: 2, borderRadius: 2, background: on ? "var(--pb-gold)" : "transparent" }} />
              </button>
            );
          })}
        </div>
      </div>

      <main style={{ padding: "clamp(28px,4vh,48px) clamp(16px,4vw,40px) 8px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {tab === "overview" && <Overview park={park} nps={nps} isForest={isForest} isStatePark={isStatePark} />}
          {tab === "conditions" && <Conditions park={park} cond={cond} road={road} hourly={hourly} daily={daily} webcams={webcams} river={river} tz={tz} alertsRef={alertsRef} isForest={isForest} isStatePark={isStatePark} />}
          {tab === "trails" && <TrailsPermits park={park} trails={trails} isForest={isForest} isStatePark={isStatePark} areaQ={areaQ} />}
          {tab === "plan" && <Plan park={park} nps={nps} places={places} isForest={isForest} isStatePark={isStatePark} areaQ={areaQ} />}
          {tab === "nearby" && <Nearby park={park} nearby={nearby} radius={radius} setRadius={setRadius} />}
        </div>
      </main>

      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(30px,5vh,54px) clamp(16px,4vw,40px)" }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 24 }}>
          <div style={{ ...microLabel, letterSpacing: ".1em", lineHeight: 1.8 }}>Sources: {isForest ? "USDA Forest Service" : isStatePark ? "State park agencies" : "National Park Service"} · National Weather Service · USGS · AirNow — public domain / official feeds.</div>
          <div style={{ fontSize: ".86rem", color: "var(--pb-muted)", fontWeight: 300, marginTop: 8, maxWidth: "60ch" }}>We show live conditions honestly — GO, PREPARE, or HOLD, with the reasons behind it. When data is thin, we say so. We never invent a rating, photo, or condition.</div>
        </div>
      </footer>
    </div>
  );

  function addToTrip() {
    if (!park) return;
    addStop(park.name); // → shared trip store; SiteHeader's TripModal pops open
    setAdded(true);
  }
}

function chip(kind) {
  const base = { borderRadius: 999, padding: "7px 13px", fontSize: ".82rem", fontWeight: 600 };
  if (kind === "good") return { ...base, background: "rgba(79,217,138,.1)", border: "1px solid rgba(79,217,138,.35)", color: "#7fe3a6" };
  if (kind === "warn") return { ...base, background: "rgba(224,144,106,.12)", border: "1px solid rgba(224,144,106,.35)", color: "#e0906a" };
  // Literal, not tokenised: these sit on the verdict card over the hero photo,
  // which is dark in both themes. (An earlier sweep tokenised this by accident
  // and they turned dark-on-dark in light mode.)
  return { ...base, background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", color: "var(--pb-ink)" };
}
const H2 = { fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3vw,1.9rem)" };

/* ---------------- OVERVIEW ---------------- */
// "Pines from here" — surfaces this place's community clips/photos on the park page.
// Matches by place name (compose stores the typed name; GPS→park-id linkage is a later
// step). Honest: shows the real count, or a slim invite to post the first when empty.
function PinesRail({ park }) {
  const [pins, setPins] = useState(null);
  useEffect(() => {
    if (!park) return; let on = true;
    fetch("/api/pines?place_name=" + encodeURIComponent(park.name) + "&limit=12")
      .then((r) => r.json()).then((d) => on && setPins(d.pines || [])).catch(() => on && setPins([]));
    return () => { on = false; };
  }, [park && park.name]);
  if (pins === null) return null;
  return (
    <div style={{ marginBottom: "clamp(20px,4vw,36px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ ...H2, fontSize: "clamp(1.3rem,3vw,1.8rem)", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--pb-grad-gold)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--pb-bg)"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg></span>
          Pines from here
        </h2>
        <a href="/pines" style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--pb-gold)", textDecoration: "none", flex: "none" }}>{pins.length ? "See all ›" : "Open Pines ›"}</a>
      </div>
      {pins.length ? (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }} className="pn-scroll">
          {pins.map((p) => (
            <a key={p.id} href="/pines" style={{ flex: "none", width: 132, textDecoration: "none" }}>
              <div style={{ width: 132, aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: "1px solid var(--pb-line)", background: "#000", position: "relative" }}>
                {(p.image_url || p.poster_url) && <img src={p.image_url || p.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                {p.verified && <span style={{ position: "absolute", top: 6, left: 6, fontFamily: mono, fontSize: ".44rem", letterSpacing: ".08em", textTransform: "uppercase", color: "#4fd98a", background: "rgba(6,14,10,.7)", border: "1px solid rgba(79,217,138,.5)", borderRadius: 999, padding: "2px 6px" }}>✓ On-site</span>}
              </div>
              {p.caption && <div style={{ fontSize: ".72rem", color: "var(--pb-ink-2)", marginTop: 5, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.caption}</div>}
            </a>
          ))}
        </div>
      ) : (
        <a href="/pines" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", border: "1px dashed var(--pb-line-strong)", borderRadius: 14, padding: "14px 16px", background: "rgba(255,255,255,.02)" }}>
          <span style={{ fontSize: "1.3rem" }}>🌲</span>
          <span style={{ color: "var(--pb-ink-2)", fontSize: ".9rem", lineHeight: 1.4 }}>No Pines from {park ? park.name : "here"} yet — <b style={{ color: "var(--pb-gold)" }}>share the first Adventure ›</b></span>
        </a>
      )}
    </div>
  );
}

function Overview({ park, nps, isForest, isStatePark }) {
  const p = nps && nps.park;
  const forestAbout = park
    ? park.name + " is one of the United States' national forests — public land managed by the USDA Forest Service for recreation, timber, watershed and wildlife. The live conditions below come from the nearest weather, wildfire and air-quality stations; check the forest's ranger district for road closures, dispersed-camping rules and any permits."
    : "";
  const stateAbout = park
    ? park.name + " is a state park managed by " + (park.state || "the state") + "'s park agency. The live conditions below come from the nearest National Weather Service, wildfire and air-quality stations; check the park's official page for hours, fees, closures and any reservations."
    : "";

  // NPS descriptions only exist for NPS places, so every forest used to open
  // with the SAME templated sentence — which reads as "no About" the moment
  // you have seen two forest pages (owner, from Ouachita, which has a rich
  // Wikipedia article saying nothing templated at all). We already trust
  // Wikipedia for photos; trust it for the story too. The template stays as
  // the fallback and the operational note stays appended either way.
  const [wiki, setWiki] = useState(null); // {extract, url}
  useEffect(() => {
    if (!park || !(isForest || isStatePark) || (p && p.description)) return;
    let dead = false;
    fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(park.name))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (dead || !d) return;
        // A disambiguation page or a stub is worse than the template.
        if (d.type === "standard" && d.extract && d.extract.length > 120) {
          setWiki({ extract: d.extract, url: d.content_urls?.desktop?.page || null });
        }
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [park && park.name, isForest, isStatePark, !!(p && p.description)]);

  // The Park Buddy overview — OUR editorial, generated at build time from
  // datasets we can prove (visitation, boundaries, dams, towns, climate) and
  // stored in overview-data.json where the owner can edit every word. Neutral
  // guidebook voice by choice. Renders nothing until that dataset has this
  // place; the borrowed About below remains either way.
  const [pbo, setPbo] = useState(null);
  useEffect(() => {
    if (!park || !isFinite(park.lat)) return;
    let dead = false;
    fetch("/api/overview?lat=" + park.lat.toFixed(3) + "&lng=" + park.lng.toFixed(3))
      .then((r) => r.json())
      .then((d) => { if (!dead && d && d.overview) setPbo(d.overview); })
      .catch(() => {});
    return () => { dead = true; };
  }, [park && park.lat, park && park.lng]);

  const aboutHead = isForest ? "About the forest" : isStatePark ? "About this state park" : "About the park";
  const aboutBody = p && p.description ? p.description
    : wiki ? wiki.extract
    : isForest ? forestAbout : isStatePark ? stateAbout : "Pulling this park's story from NPS.gov…";
  const practicalNote = isForest
    ? "Live conditions on this page come from the nearest weather, wildfire and air-quality stations; check the forest's ranger district for road closures, dispersed-camping rules and permits."
    : "Live conditions on this page come from the nearest weather, wildfire and air-quality stations; check the park's official page for hours, fees and reservations.";
  return (
    <>
      <PinesRail park={park} />

      {/* The Park Buddy overview — four short sections, each one backed by a
          dataset this repo owns. This is the house voice; the About below
          stays the source's voice. */}
      {pbo && (
        <div style={{ ...card, marginBottom: "clamp(20px,4vw,36px)", borderColor: "var(--pb-gold-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <img src="/brand/the-park-buddy-badge.png" alt="" width={22} height={22} style={{ objectFit: "contain" }} />
            <div style={{ ...microLabel, letterSpacing: ".16em" }}>The Park Buddy overview</div>
          </div>
          <div style={{ display: "grid", gap: "18px 28px", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
            {[["Why people come", pbo.whyCome], ["What most visitors miss", pbo.dontMiss],
              ["When to go", pbo.whenToGo], ["Where to base", pbo.whereToBase]].map(([h, body]) => body && (
              <div key={h}>
                <div style={{ ...microLabel, fontSize: ".6rem", color: "var(--pb-gold)", marginBottom: 7 }}>{h}</div>
                <p style={{ margin: 0, fontSize: ".92rem", lineHeight: 1.65, color: "var(--pb-ink-2)", fontWeight: 300 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "clamp(20px,4vw,40px)" }} className="ps-grid">
        <div>
          <h2 style={{ ...H2, fontSize: "clamp(1.6rem,3.4vw,2.3rem)" }}>{aboutHead}</h2>
          <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.75, fontWeight: 300, marginTop: 12 }}>
            {aboutBody}
          </p>
          {/* When the story came from Wikipedia, our operational note still
              belongs on the page — as its own quiet paragraph, with the
              source credited where the words came from. */}
          {wiki && (
            <>
              <p style={{ color: "var(--pb-muted)", fontSize: ".88rem", lineHeight: 1.6, fontWeight: 300, marginTop: 10 }}>
                {practicalNote}
              </p>
              {wiki.url && (
                <a href={wiki.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, textDecoration: "none",
                    fontFamily: mono, fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)" }}>
                  From Wikipedia →
                </a>
              )}
            </>
          )}
          {p && (p.activities || []).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              {p.activities.slice(0, 6).map((a) => <span key={a} style={{ fontSize: ".82rem", fontWeight: 500, color: "var(--pb-ink-2)", background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 13px" }}>{a}</span>)}
            </div>
          )}
          {p && p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, textDecoration: "none", fontSize: ".86rem", fontWeight: 600, color: "var(--pb-gold)" }}>More on NPS.gov →</a>}
          {isStatePark && park && <a href={park.url || ("https://www.google.com/search?q=" + encodeURIComponent(park.name + " " + (park.state || "") + " official site"))} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, textDecoration: "none", fontSize: ".86rem", fontWeight: 600, color: "var(--pb-gold)" }}>Official park site →</a>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...card, borderRadius: 16 }}>
            <div style={microLabel}>State</div>
            <div style={{ fontFamily: serif, fontSize: "1.5rem", marginTop: 4 }}>{park ? park.state : "—"}</div>
          </div>
          {p && (nps.thingsToDo || []).length > 0 && (
            <div style={{ ...card, borderRadius: 16 }}>
              <div style={microLabel}>Notable things to do</div>
              <div style={{ fontSize: ".9rem", color: "var(--pb-ink-2)", lineHeight: 1.7, marginTop: 6 }}>{nps.thingsToDo.slice(0, 5).map((t) => t.title).join(" · ")}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 34 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={H2}>Buddy trip reports</h2>
          <span style={{ ...microLabel, letterSpacing: ".12em" }}>From the community · dated &amp; honest</span>
        </div>
        <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)", padding: "26px 16px" }}>
          No trip reports for {park ? park.name : "this park"} yet — real reports from fellow Buddies will appear here. We won&apos;t invent them.
        </div>
      </div>
    </>
  );
}

/* ---------------- CONDITIONS ---------------- */
function Conditions({ park, cond, road, hourly, daily, webcams, river, tz, alertsRef, isForest, isStatePark }) {
  const [now, setNow] = useState(null); // client-only clock — avoids SSR/hydration drift on sun/moon
  useEffect(() => { setNow(new Date()); }, []);

  // "Forecast for the entire year" — the honest version. Nobody can forecast
  // a year, and this page never pretends; what a trip planner actually needs
  // is "what is October like here", and five years of observations answer
  // that truthfully. Labeled as typical, never as forecast.
  const [climate, setClimate] = useState(null);
  useEffect(() => {
    if (!park || !isFinite(park.lat)) return;
    let dead = false;
    fetch("/api/climate?lat=" + park.lat.toFixed(3) + "&lng=" + park.lng.toFixed(3))
      .then((r) => r.json())
      .then((d) => { if (!dead && d && d.months && d.months.length === 12) setClimate(d); })
      .catch(() => {});
    return () => { dead = true; };
  }, [park && park.lat, park && park.lng]);
  const alerts = (cond && cond.weatherAlerts) || [];
  const fires = (cond && cond.wildfires) || [];
  const aqi = cond && cond.airQuality;
  const floodWatch = alerts.find((a) => /flood/i.test(a.event || ""));
  const gauge = river && river.found ? river.gauge : null;
  const sun = (park && now) ? getSunTimes(now, park.lat, park.lng) : null;
  const moon = now ? getMoon(now) : null;
  const roadText = road && (road.summary || road.status || (road.roads && road.roads[0] && road.roads[0].status));
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4fd98a" }} />
        <h2 style={{ fontFamily: mono, fontSize: ".66rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Live conditions</h2>
      </div>
      {/* One line, all four visible, NO scroll (owner: the whole live picture
          in one glance, one place). What gives on a phone is the prose, not
          the line: below 640px each card compacts to short label + value via
          the ps-stat classes in the style block, and the notes disappear —
          the counts ARE the story; the details live in the sections below. */}
      <div className="ps-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard short="Alerts" label="Weather alerts · NWS" value={cond ? (alerts.length ? String(alerts.length) : "None") : "…"} valueColor={alerts.length ? "#e0906a" : "#7fe3a6"} note={alerts.length ? alerts.slice(0, 2).map((a) => a.event).join(" · ") : "No watches or warnings for the park today."} tint={alerts.length ? "warn" : "good"} />
        <StatCard short="Wildfires" label="Wildfires · within 80 mi" value={cond ? String(fires.length) : "…"} note={fires.length ? ("Nearest: " + (fires[0].name || "active fire")) : "No active wildfires reported nearby."} />
        <StatCard short="Air" label="Air quality · AirNow" value={aqi ? String(aqi.aqi) : (cond ? "—" : "…")} valueColor={aqi && aqi.aqi <= 50 ? "#7fe3a6" : "#e8cf9a"} note={aqi ? (aqi.category + (aqi.parameter ? " · " + aqi.parameter : "")) : "Air-quality reading unavailable for this area."} />
        {isForest ? (
          <StatCard short="Roads" label="Roads · USFS" value="Varies" valueColor="#e8cf9a" note="Forest & FS/MVUM roads close seasonally and after storms — check the ranger district before you go." />
        ) : isStatePark ? (
          <StatCard short="Roads" label="Roads &amp; access" value="Varies" valueColor="#e8cf9a" note="Park roads, gates and day-use areas close seasonally and after storms — check the park's official page before you go." />
        ) : (
          <StatCard short="Roads" label="Roads · NPS" value={roadText ? "See note" : (road ? "Open" : "…")} valueColor="#e8cf9a" note={roadText || "No road closures reported. Always check NPS.gov before you go."} />
        )}
      </div>

      {/* FULL alerts — every active NWS alert, in detail */}
      {alerts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...microLabel, letterSpacing: ".14em", color: "#e0906a", marginBottom: 10 }}>⚠ {alerts.length} active weather alert{alerts.length === 1 ? "" : "s"} · National Weather Service</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.map((a, i) => <AlertCard key={i} a={a} />)}
          </div>
        </div>
      )}
      {fires.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...microLabel, letterSpacing: ".14em", marginBottom: 10 }}>🔥 {fires.length} wildfire{fires.length === 1 ? "" : "s"} within ~80 mi</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
            {fires.map((f, i) => (
              <div key={i} style={{ ...card, padding: "14px 16px" }}>
                <b style={{ fontFamily: serif, fontSize: "1.1rem" }}>{f.name}</b>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: ".8rem", color: "var(--pb-ink-2)" }}>
                  {f.distanceMi != null && <span>📍 {f.distanceMi} mi away</span>}
                  {f.acres != null && <span>🔥 {f.acres.toLocaleString()} acres</span>}
                  {f.percentContained != null && <span>🧯 {f.percentContained}% contained</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONE weather card, Weather-Channel shaped (owner's call): today's sky
          animates across the full tile, and the hourly strip and the 7-day
          strip live INSIDE the same card beneath it — one place called
          Weather, not three stacked boxes. The tile is stretched, never
          scaled: the no-scale rule protects the MOTION, and percentage
          particle positions just give the same animation more sky. */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ ...microLabel, marginBottom: 14 }}>Weather · NWS forecast</div>
        {hourly && hourly[0] && conditionFromSky(hourly[0].shortForecast) && (
          <div style={{ marginBottom: 16 }}>
            <WeatherTile
              width="100%"
              condition={conditionFromSky(hourly[0].shortForecast)}
              temp={hourly[0].temperature}
              label={hourly[0].shortForecast}
              place={park ? park.name : ""}
            />
          </div>
        )}
        <div style={{ ...microLabel, letterSpacing: ".1em", margin: "2px 0 10px" }}>Next 12 hours</div>
        {hourly ? (
          <div className="ps-hours" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: 10 }}>
            {hourly.map((h, i) => (
              <div key={i} style={{ textAlign: "center", background: "var(--pb-tint)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "12px 8px" }}>
                <div style={{ ...microLabel, letterSpacing: ".08em" }}>{new Date(h.startTime).toLocaleTimeString("en-US", tz ? { hour: "numeric", timeZone: tz } : { hour: "numeric" })}</div>
                <div style={{ display: "flex", justifyContent: "center", margin: "9px 0 7px" }}>
                  <ForecastTile size={88} seed={String(i)}
                    condition={conditionFromSky(h.shortForecast) || "unknown"}
                    label={h.shortForecast} />
                </div>
                <div style={{ fontFamily: serif, fontSize: "1.3rem" }}>{h.temperature}°</div>
                <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", marginTop: 2 }}>{h.shortForecast}</div>
              </div>
            ))}
          </div>
        ) : <Loading text="Grabbing the next hours from weather.gov…" />}

        <div style={{ ...microLabel, letterSpacing: ".1em", margin: "16px 0 10px" }}>7-day outlook</div>
        {daily ? (
          <div className="ps-hours" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: 8 }}>
            {daily.map((d, i) => (
              <div key={i} style={{ textAlign: "center", background: "var(--pb-tint)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "12px 6px" }}>
                <div style={{ ...microLabel, letterSpacing: ".06em" }}>{d.name}</div>
                <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 6px" }}>
                  <ForecastTile size={78} seed={d.name}
                    condition={conditionFromSky(d.sky) || "unknown"}
                    label={d.sky} />
                </div>
                <div style={{ fontFamily: serif, fontSize: "1.05rem" }}>{d.hi}°{d.lo != null && <span style={{ color: "var(--pb-muted)", fontSize: ".8em" }}> / {d.lo}°</span>}</div>
                <div style={{ fontSize: ".62rem", color: d.pop > 30 ? "#a9c2e0" : "var(--pb-muted)", marginTop: 3 }}>💧 {d.pop}%</div>
              </div>
            ))}
          </div>
        ) : <Loading text="Loading 7-day outlook…" />}
      </div>

      {/* A typical year — historical monthly averages, the truthful answer to
          "what's the forecast for the whole year". Renders only when the data
          arrived; no skeleton, no apology. */}
      {climate && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
            <div style={{ ...microLabel }}>A typical year here</div>
            <div style={{ fontSize: ".64rem", color: "var(--pb-muted)" }}>averages, {climate.years} — not a forecast</div>
          </div>
          <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginBottom: 12 }}>
            The best month to come is the one that matches the trip you want — this is what each one is usually like.
          </div>
          <div className="ps-hours" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 8 }}>
            {climate.months.map((mo) => {
              const isNow = now && MONTH_IDX[mo.m] === now.getMonth();
              return (
                <div key={mo.m} style={{ textAlign: "center", background: "var(--pb-tint)", borderRadius: 12, padding: "12px 6px",
                  border: isNow ? "1px solid var(--pb-gold-2)" : "1px solid rgba(217,183,121,.12)" }}>
                  <div style={{ ...microLabel, letterSpacing: ".08em", color: isNow ? "var(--pb-gold)" : undefined }}>{mo.m}</div>
                  <div style={{ fontFamily: serif, fontSize: "1.15rem", marginTop: 8 }}>
                    {mo.hi != null ? mo.hi + "°" : "—"}
                    {mo.lo != null && <span style={{ color: "var(--pb-muted)", fontSize: ".78em" }}> / {mo.lo}°</span>}
                  </div>
                  <div style={{ fontSize: ".62rem", color: "var(--pb-muted)", marginTop: 4 }}>
                    {mo.wetDays != null ? "💧 " + mo.wetDays + " wet days" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: ".6rem", color: "var(--pb-muted)", marginTop: 10, fontFamily: mono, letterSpacing: ".06em", textTransform: "uppercase" }}>
            {climate.credit}
          </div>
        </div>
      )}

      {/* Sun & sky */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 12 }}>
        <div style={card}>
          <div style={microLabel}>Sun &amp; sky · computed{tz ? " · park time" : ""}</div>
          <Row k="☀ Sunrise" v={fmtTime(sun && sun.sunrise, tz)} />
          <Row k="🌇 Sunset" v={fmtTime(sun && sun.sunset, tz)} />
          <Row k="📸 Golden hour" v={fmtTime(sun && sun.goldenHour, tz)} />
          <Row k="🌙 Moon" v={moon ? moon.name + " · " + Math.round(moon.fraction * 100) + "%" : "…"} />
          {moon && moon.fraction < 0.35 && <div style={{ marginTop: 12, background: "rgba(90,134,201,.1)", border: "1px solid rgba(90,134,201,.3)", borderRadius: 10, padding: "9px 11px", fontSize: ".78rem", color: "#a9c2e0" }}>🔭 Dark-sky night — great for stargazing.</div>}
        </div>
        <div style={card}>
          <div style={microLabel}>{gauge ? "River flow · " + gauge.name + " · USGS" : "River flow · USGS"}</div>
          {gauge ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.9rem", lineHeight: 1, color: "#7fe3a6" }}>{gauge.cfs.toLocaleString()}</span>
                <span style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink-2)" }}>CFS</span>
                {gauge.gaugeFt != null && <span style={{ fontSize: ".78rem", color: "var(--pb-muted)" }}>· {gauge.gaugeFt} ft stage</span>}
              </div>
              {/* CFS means nothing to most people (owner, correctly). Say it
                  in water: gallons per second, a unit everyone can picture. */}
              <div style={{ fontSize: ".78rem", color: "var(--pb-ink-2)", marginTop: 6, lineHeight: 1.5 }}>
                cubic feet per second — about {Math.round(gauge.cfs * 7.48).toLocaleString()} gallons of water
                moving past every second
              </div>
              <div style={{ fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 4 }}>Nearest active streamgage · {gauge.distanceMi} mi away</div>
            </>
          ) : (
            <div style={{ fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 10 }}>{river ? "No active USGS streamgage within ~28 mi of the park center." : "Checking USGS streamgages…"}</div>
          )}
          {floodWatch ? (
            <div style={{ marginTop: 12, background: "rgba(224,144,106,.1)", border: "1px solid rgba(224,144,106,.35)", borderRadius: 10, padding: "9px 11px", fontSize: ".8rem", color: "#e0906a", fontWeight: 600 }}>⚠ {floodWatch.event} in effect — see the alert above before any canyon or river hike.</div>
          ) : (
            <div style={{ fontSize: ".76rem", color: "var(--pb-muted)", marginTop: 10, lineHeight: 1.5 }}>No flash-flood watch active. Always check the NWS forecast before slot canyons or river hikes. <a href="https://www.weather.gov/safety/flood" target="_blank" rel="noopener noreferrer" style={{ color: "var(--pb-gold)", textDecoration: "none", fontWeight: 600 }}>Flood safety →</a></div>
          )}
        </div>
      </div>

      {/* Webcams */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h2 style={H2}>Live webcams</h2>
          <span style={{ ...microLabel, letterSpacing: ".12em" }}>NPS &amp; partner cams</span>
        </div>
        {webcams && webcams.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {webcams.slice(0, 8).map((w, i) => <Webcam key={i} cam={w} park={park} />)}
          </div>
        ) : <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)" }}>{webcams ? "No public webcams published for this park." : "Loading webcams…"}</div>}
      </div>

      {/* SUBSCRIBE */}
      <div style={{ marginTop: 28 }}>
        <SubscribeCard park={park} alertsRef={alertsRef} />
      </div>
    </>
  );
}

const MONTH_IDX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function StatCard({ label, short, value, note, valueColor, tint }) {
  const bg = tint === "good" ? { background: "rgba(79,217,138,.07)", border: "1px solid rgba(79,217,138,.3)" } : tint === "warn" ? { background: "rgba(224,144,106,.07)", border: "1px solid rgba(224,144,106,.3)" } : {};
  return (
    // Two label renditions, CSS-toggled by viewport (see ps-stat rules in the
    // style block): the full source-credited label where there is room, the
    // one-word label in the phone's four-across strip. The note disappears on
    // the phone entirely — the count is the story at that size.
    <div className="ps-stat" style={{ ...card, ...bg, minWidth: 0 }}>
      <div className="ps-stat-lab-full" style={microLabel}>{label}</div>
      <div className="ps-stat-lab-short" style={{ ...microLabel, display: "none" }}>{short || label}</div>
      <div className="ps-stat-val" style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.85rem", lineHeight: 1, marginTop: 10, color: valueColor || "var(--pb-ink)" }}>{value}</div>
      <div className="ps-stat-note" style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", marginTop: 6, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
function Row({ k, v }) { return <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span style={{ fontSize: ".84rem", color: "var(--pb-ink-2)" }}>{k}</span><b style={{ fontSize: ".9rem", color: "var(--pb-ink)" }}>{v}</b></div>; }

function AlertCard({ a }) {
  const [open, setOpen] = useState(false);
  const c = sevColor(a.severity);
  const longDesc = (a.description || "").length > 260;
  return (
    <div style={{ background: c + "12", border: "1px solid " + c + "55", borderRadius: 16, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.2rem", color: c }}>{a.event}</span>
          {a.severity && <span style={{ fontFamily: mono, fontSize: ".5rem", letterSpacing: ".1em", textTransform: "uppercase", color: c, border: "1px solid " + c + "66", borderRadius: 999, padding: "2px 8px" }}>{a.severity}</span>}
        </div>
        {a.expires && <span style={{ ...microLabel, letterSpacing: ".06em" }}>Until {fmtDateTime(a.expires)}</span>}
      </div>
      {a.area && <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 5 }}>{a.area}</div>}
      {a.effective && <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".06em", textTransform: "uppercase", color: "#7f8a82", marginTop: 6 }}>In effect {fmtDateTime(a.effective)}{a.expires ? " → " + fmtDateTime(a.expires) : ""}</div>}
      {a.headline && <p style={{ fontSize: ".9rem", color: "var(--pb-ink-2)", fontWeight: 500, lineHeight: 1.5, marginTop: 10 }}>{a.headline}</p>}
      {a.description && (
        <p style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.6, fontWeight: 300, marginTop: 8, whiteSpace: "pre-line" }}>
          {open || !longDesc ? a.description : a.description.slice(0, 260).trim() + "…"}
        </p>
      )}
      {a.instruction && (open || !longDesc) && (
        <div style={{ marginTop: 10, background: "var(--pb-tint)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ ...microLabel, fontSize: ".5rem", marginBottom: 4 }}>What to do</div>
          <div style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", lineHeight: 1.55, whiteSpace: "pre-line" }}>{a.instruction}</div>
        </div>
      )}
      {longDesc && <button onClick={() => setOpen((o) => !o)} style={{ marginTop: 10, background: "none", border: "none", color: c, fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>{open ? "Show less" : "Read full alert →"}</button>}
    </div>
  );
}
function Loading({ text }) { return <BuddyLoader text={text} size={44} />; }

function Webcam({ cam, park }) {
  const q = (cam && (cam.title || cam.name)) ? (cam.title || cam.name) + "|" + (park ? park.name : "") : (park ? park.name + " National Park" : null);
  const photo = usePhoto(q, null, null, undefined, 700);
  const img = cam && (cam.thumbnail || cam.image || cam.url);
  const src = img && /^https?:/.test(img) ? img : photo && photo.url;
  return (
    <figure style={{ position: "relative", aspectRatio: "16 / 10", margin: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--pb-line)", background: hatch }}>
      {src && <img alt={cam.title || cam.name || "webcam"} src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <span style={{ position: "absolute", left: 10, top: 10, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: ".52rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: "rgba(224,60,60,.85)", borderRadius: 999, padding: "3px 9px" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />Live</span>
      <figcaption style={{ position: "absolute", left: 10, right: 10, bottom: 10, fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "#f7f4ec", textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{cam.title || cam.name || "Live view"}</figcaption>
    </figure>
  );
}

function SubscribeCard({ park, alertsRef }) {
  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState({ alert_verdict: true, alert_flood: true });
  const [status, setStatus] = useState(""); // "", "saving", "done", "error"
  const toggle = (k) => setPrefs((s) => ({ ...s, [k]: !s[k] }));

  async function submit(e) {
    e.preventDefault();
    if (!email || !park) return;
    setStatus("saving");
    try {
      // Persist via the server route (service key), so a public email-only
      // subscribe works without exposing DB writes to the client.
      const r = await fetch("/api/park-alert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Forests have no NPS id — key the subscription on a name slug instead.
          park_id: park.id != null ? park.id : (park.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          park_name: park.name, email: email.trim(),
          alert_verdict: !!prefs.alert_verdict, alert_permit: !!prefs.alert_permit,
          alert_road: !!prefs.alert_road, alert_flood: !!prefs.alert_flood, alert_snow: !!prefs.alert_snow,
        }),
      });
      setStatus(r.ok ? "done" : "error");
    } catch { setStatus("error"); }
  }

  return (
    <div ref={alertsRef} style={{ position: "relative", overflow: "hidden", borderRadius: 22, border: "1px solid var(--pb-line-strong)", background: "linear-gradient(120deg,rgba(31,94,70,.18),rgba(9,22,15,.8))", padding: "clamp(22px,4vw,38px)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(217,183,121,.7),transparent)" }} />
      <div style={{ display: "grid", gap: "clamp(20px,4vw,44px)", alignItems: "center" }} className="ps-grid">
        <div>
          <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Stay in the loop</div>
          <h2 style={{ ...H2, fontSize: "clamp(1.7rem,3.6vw,2.6rem)", lineHeight: 1.04, marginTop: 10 }}>Subscribe to {park ? park.name : "park"} alerts.</h2>
          <p style={{ color: "var(--pb-ink-2)", fontSize: ".95rem", lineHeight: 1.65, fontWeight: 300, marginTop: 10, maxWidth: "42ch" }}>We&apos;ll ping you the moment the verdict flips, a permit drops, a road opens, or a flash-flood watch is issued — for this park only.</p>
        </div>
        <div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {ALERT_DEFS.map(([k, label]) => {
              const on = !!prefs[k];
              return <button key={k} onClick={() => toggle(k)} type="button" style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 500, borderRadius: 999, padding: "8px 14px", border: "1px solid " + (on ? "transparent" : "var(--pb-line-strong)"), background: on ? "var(--pb-grad-gold)" : "var(--pb-tint)", color: on ? "#0b1710" : "var(--pb-ink-2)" }}>{on ? "✓ " : ""}{label}</button>;
            })}
          </div>
          {status === "done" ? (
            <div style={{ marginTop: 16, color: "#7fe3a6", fontWeight: 600, fontSize: ".92rem" }}>✓ You&apos;re subscribed — we&apos;ll email you when it changes.</div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={"Email for " + (park ? park.name : "park") + " alerts"} style={{ flex: 1, minWidth: 190, fontFamily: "inherit", fontSize: ".88rem", color: "var(--pb-ink)", background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 15px", outline: "none" }} />
              <button type="submit" disabled={status === "saving"} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".86rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "12px 22px", whiteSpace: "nowrap" }}>{status === "saving" ? "Saving…" : "Subscribe"}</button>
            </form>
          )}
          <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".04em", color: "var(--pb-muted)", marginTop: 10 }}>
            {status === "error" ? "Couldn't save just now — please try again." : "Pick the alerts that matter — unsubscribe anytime. (Email delivery is rolling out.)"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- TRAILS & PERMITS ---------------- */
// A compact trail row with a small photo (famous trails have one; others fall
// back to a geotagged photo at the trailhead, or the tasteful hatch placeholder).
function TrailRow({ t, park, diff, areaQ }) {
  const pt = (t.path && t.path[0]) || null;
  const photo = usePhoto(t.name + " " + (park ? park.name : "") + "|" + t.name, pt ? pt[0] : null, pt ? pt[1] : null, undefined, 360, areaQ);
  const href = t.id != null && park && park.npsCode ? "/trail-status?trail=" + t.id + "&park=" + park.npsCode : null;
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 11, ...card, padding: 8 }}>
      <span style={{ position: "relative", width: 74, height: 56, flex: "none", borderRadius: 10, overflow: "hidden", background: hatch, display: "block" }}>
        {photo && photo.url && <img alt="" src={photo.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: ".9rem", color: "var(--pb-ink)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</b>
        <span style={{ ...microLabel, letterSpacing: ".08em" }}>{diff}{t.lengthMi > 0 ? " · " + t.lengthMi + " mi" : ""}</span>
      </div>
      {href && <span style={{ color: "var(--pb-gold-soft)", flex: "none" }}>→</span>}
    </div>
  );
  return href ? <a href={href} style={{ textDecoration: "none", display: "block" }}>{inner}</a> : inner;
}

// Compact campground card — photo + a one-line live availability SUMMARY (soonest
// opening / sites open) + Book. Replaces the full 6-month calendar per campground,
// which ate the whole tab; the deep calendar still lives on Recreation.gov.
function CompactCamp({ c, park, recId, areaQ }) {
  const photo = usePhoto(c.name + "|" + c.name + " campground|" + (park ? park.name : ""), c.lat, c.lng, undefined, 700, areaQ);
  const [avail, setAvail] = useState(recId ? undefined : null);
  useEffect(() => {
    if (!recId) return;
    const now = new Date();
    const mp = now.getUTCFullYear() + "-" + String(now.getUTCMonth() + 1).padStart(2, "0");
    let on = true;
    fetch("/api/availability?id=" + encodeURIComponent(recId) + "&month=" + mp)
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (on) setAvail(d && d.available ? d : null); }).catch(() => on && setAvail(null));
    return () => { on = false; };
  }, [recId]);
  const soon = avail && avail.soonest ? new Date(avail.soonest.date + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : null;
  const open = avail && avail.openDayCount > 0;
  const summary = avail === undefined ? "Checking the calendar…"
    : !avail ? "Check dates on Recreation.gov"
    : avail.total === 0 ? "No bookable sites this month"
    : open ? ((avail.peakOpen ? "Up to " + avail.peakOpen + " of " + avail.total + " open" : "Open nights this month") + (soon ? " · soonest " + soon : ""))
    : "No open nights this month";
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <figure style={{ position: "relative", margin: 0, aspectRatio: "16 / 9", background: hatch }}>
        {photo && photo.url && <img alt="" src={photo.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.05) 45%,rgba(8,19,13,.9))" }} />
        <figcaption style={{ position: "absolute", left: 12, right: 12, bottom: 8, fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "#f7f4ec", textShadow: "0 2px 10px rgba(0,0,0,.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</figcaption>
      </figure>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: ".78rem", color: open ? "#7fe3a6" : "var(--pb-ink-2)", lineHeight: 1.4, minHeight: 32 }}>{summary}</div>
        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: ".76rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "7px 13px", textDecoration: "none" }}>{recId ? "Book ↗" : "Details ↗"}</a>}
      </div>
    </div>
  );
}

function TrailsPermits({ park, trails, isForest, isStatePark, areaQ }) {
  const isNP = !isForest && !isStatePark;
  const [filter, setFilter] = useState("all");
  const list = trails ? [].concat(trails.hiking || [], trails.offroad || [], trails.ski || []) : null;
  const diffOf = (t) => (t.lengthMi > 6 ? "Hard" : t.lengthMi > 2.5 ? "Moderate" : "Easy");
  const shown = list ? list.filter((t) => filter === "all" || diffOf(t) === filter) : null;
  const hasTrails = !!(list && list.length); // real trails exist (regardless of the active filter)
  const altSearch = "https://www.alltrails.com/search?q=" + encodeURIComponent(park ? park.name : "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h2 style={H2}>Trails</h2>
        <span style={{ ...microLabel, letterSpacing: ".12em" }}>{isNP ? "Live from NPS trail data" : "Live from OpenStreetMap"}</span>
      </div>
      {/* Difficulty filter — only when there's something to filter. */}
      {hasTrails && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {["all", "Easy", "Moderate", "Hard"].map((f) => {
            const on = filter === f;
            return <button key={f} onClick={() => setFilter(f)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, borderRadius: 999, padding: "7px 14px", border: on ? "none" : "1px solid var(--pb-line-strong)", background: on ? "var(--pb-grad-gold)" : "var(--pb-tint)", color: on ? "#0b1710" : "var(--pb-ink-2)" }}>{f === "all" ? "All" : f}</button>;
          })}
        </div>
      )}
      {!list ? (
        <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)" }}>Loading trails…</div>
      ) : shown.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10 }}>
          {shown.slice(0, 30).map((t, i) => <TrailRow key={i} t={t} park={park} diff={diffOf(t)} areaQ={areaQ} />)}
        </div>
      ) : hasTrails ? (
        <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)" }}>No {filter} trails here — try another filter.</div>
      ) : (
        // Honest, compact empty state — our trail source genuinely lists none here,
        // rather than a misleading "within range" note that ate the whole tab.
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ fontFamily: serif, fontSize: "1.15rem", color: "var(--pb-ink)", marginBottom: 6 }}>No mapped trails here yet</div>
          <div style={{ fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.6, maxWidth: "56ch" }}>
            {isNP
              ? "We map trails from the National Park Service's public trail dataset, and it doesn't list any inside this park yet — the deep backcountry often isn't digitized."
              : isForest
              ? "We map trails from OpenStreetMap, and none are tagged along this forest yet. National-forest trails are best found on the ranger district's own map."
              : "We map trails from OpenStreetMap, and none are tagged for this state park yet."}
          </div>
          <a href={altSearch} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: ".82rem", fontWeight: 600, color: "var(--pb-gold)", textDecoration: "none" }}>Find trails on AllTrails ↗</a>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ ...H2, marginBottom: 14 }}>Permits &amp; reservations</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={microLabel}>Permits &amp; {isNP ? "timed entry" : "passes"}</div>
            <div style={{ fontFamily: serif, fontSize: "1.3rem", marginTop: 8 }}>Varies by {isForest ? "district" : "park"}</div>
            <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 6 }}>{isForest ? "Many forests need permits for wilderness areas, dispersed camping, campfires or day-use in season. We link you to the official source rather than guess the current rules." : isStatePark ? "Many state parks require day-use reservations, campground bookings or activity permits in season. We link you to the official source rather than guess the current rules." : "Many parks require timed-entry or wilderness permits in season. We link you to the official source rather than guess the current rules."}</div>
            <a href={"https://www.recreation.gov/search?q=" + encodeURIComponent((park ? park.name : "") + (isNP ? " National Park" : ""))} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "9px 15px" }}>Check permits on Recreation.gov ↗</a>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={microLabel}>Official {isForest ? "forest" : "park"} rules</div>
            <div style={{ fontFamily: serif, fontSize: "1.3rem", marginTop: 8 }}>{isForest ? "fs.usda.gov" : isStatePark ? "State park site" : "NPS.gov"}</div>
            <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 6 }}>{isForest ? "Fees, closures and fire restrictions change through the year — the forest's own Forest Service page is always current." : isStatePark ? "Fees, hours and closures change through the year — the park's own state-agency page is always current." : "Entrance fees, reservation systems and closures change through the year — the park's own page is always current."}</div>
            <a href={isForest ? "https://www.fs.usda.gov/" : isStatePark ? (park && park.url ? park.url : "https://www.google.com/search?q=" + encodeURIComponent((park ? park.name : "") + " " + (park ? park.state : "") + " official site")) : (park && park.npsCode ? "https://www.nps.gov/" + park.npsCode : "https://www.nps.gov")} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-ink)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 15px" }}>Official site ↗</a>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- PLAN ---------------- */
function Plan({ park, nps, places, isForest, isStatePark, areaQ }) {
  const isNP = !isForest && !isStatePark;
  const camps = places ? (places.facilities || []).filter((f) => /camp/i.test((f.name || "") + " " + (f.type || ""))) : null;
  const p = nps && nps.park;
  const SAFETY = [
    ["⚡ Flash floods", "Check the daily flash-flood potential before slot canyons or river hikes. Never enter with rain in the forecast."],
    ["☀ Heat & water", "Desert and canyon temps can top 100°F. Carry about 1 L of water per hour and start at dawn."],
    ["🐾 Wildlife & pets", "Give wildlife space and store food. Pets are restricted on most trails — check the park's rules."],
    ["🌱 Leave No Trace", "Pack out everything, stay on trail, and protect fragile soils and water sources."],
  ];
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h2 style={H2}>Campgrounds &amp; availability</h2>
        <span style={{ ...microLabel, letterSpacing: ".12em" }}>Recreation.gov</span>
      </div>
      {camps && camps.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
          {camps.slice(0, 9).map((c, i) => {
            const recId = (c.url && (c.url.match(/campgrounds\/(\d+)/) || [])[1]) || null;
            return <CompactCamp key={i} c={c} park={park} recId={recId} areaQ={areaQ} />;
          })}
        </div>
      ) : <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)" }}>{places ? "No campgrounds found within range." : "Loading campgrounds…"}</div>}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ ...H2, marginBottom: 14 }}>Safety &amp; regulations</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {SAFETY.map(([h, d]) => (
            <div key={h} style={{ ...card, borderRadius: 16, padding: 16 }}>
              <b style={{ fontSize: ".92rem" }}>{h}</b>
              <div style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", lineHeight: 1.55, marginTop: 5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        <div style={{ ...card, padding: 20 }}>
          <div style={microLabel}>Getting there</div>
          <div style={{ fontFamily: serif, fontSize: "1.6rem", marginTop: 8 }}>{park ? park.state : ""}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <a href={"https://maps.google.com/?q=" + encodeURIComponent((park ? park.name : "") + (isNP ? " National Park" : ""))} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "9px 15px" }}>Directions ↗</a>
            <a href={isForest ? "https://www.fs.usda.gov/" : isStatePark ? (park && park.url ? park.url : "https://www.google.com/search?q=" + encodeURIComponent((park ? park.name : "") + " " + (park ? park.state : "") + " official site")) : (park && park.npsCode ? "https://www.nps.gov/" + park.npsCode : "https://www.nps.gov")} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-ink)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 15px" }}>Official site ↗</a>
          </div>
        </div>
        {p && (p.activities || []).length > 0 && (
          <div style={{ ...card, padding: 20 }}>
            <div style={microLabel}>What to do</div>
            <div style={{ fontSize: ".9rem", color: "var(--pb-ink-2)", lineHeight: 1.7, marginTop: 8 }}>{p.activities.slice(0, 8).join(" · ")}</div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- NEARBY ---------------- */
function NearbyTile({ o, href, pq }) {
  const photo = usePhoto(pq, o.lat, o.lng, undefined, 600);
  const tile = (
    <figure style={{ position: "relative", margin: 0, aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", border: "1px solid var(--pb-line)", background: hatch }}>
      {photo && photo.url && <img alt={o.name} src={photo.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.08) 40%,rgba(8,19,13,.9))" }} />
      <span style={{ position: "absolute", right: 10, top: 10, fontFamily: mono, fontSize: ".56rem", fontWeight: 700, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "3px 9px" }}>{o.distMi} mi</span>
      {/* Owner's flag (2026-07-21): man-made or natural, and only when we can
          PROVE it — "man-made" is matched against the National Inventory of
          Dams, "natural" is asserted only for sizeable lakes with no dam on
          record. The title carries the receipt (dam name + year). */}
      {o.origin && (
        <span title={o.dam ? (o.dam.name + (o.dam.year ? " · " + o.dam.year : "") + (o.dam.river ? " · " + o.dam.river : "")) : undefined}
          style={{ position: "absolute", left: 10, top: 10, fontFamily: mono, fontSize: ".5rem", fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase", color: "#f4f1ea",
            background: "rgba(10,23,18,.62)", border: "1px solid rgba(244,241,234,.28)",
            WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "3px 8px" }}>
          {o.origin === "man-made" ? "⚙ Man-made" : "🌿 Natural"}
        </span>
      )}
      <figcaption style={{ position: "absolute", left: 12, right: 12, bottom: 10, fontFamily: serif, fontWeight: 600, fontSize: "1.1rem", color: "#f7f4ec", textShadow: "0 2px 10px rgba(0,0,0,.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</figcaption>
    </figure>
  );
  if (!href) return tile;
  const external = /^https?:/.test(href);
  return <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} style={{ textDecoration: "none", display: "block" }}>{tile}</a>;
}

function Nearby({ park, nearby, radius, setRadius }) {
  const st = park ? park.state : "";

  // Owner's layout rule (2026-07-21): no section may grow past TWO ROWS of
  // tiles, on any screen — a page of six endless grids is a wall, two rows
  // with pagination is a shelf. Fixed column counts (4 desktop / 2 phone)
  // because pagination needs a knowable page size, which auto-fill isn't.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const cols = phone ? 2 : 4;
  const pageSize = cols * 2;
  const [pages, setPages] = useState({}); // per-section page index
  useEffect(() => { setPages({}); }, [radius]); // new radius, new deck

  const secs = [
    ["Other parks", (nearby && nearby.parks) || [], (o) => "/parks/" + o.id, "🏔", (o) => o.name + " National Park|" + o.name],
    ["Lakes", (nearby && nearby.lakes) || [], (o) => "/lake-status?" + new URLSearchParams({ name: o.name, lat: o.lat || "", lng: o.lng || "" }), "💧", (o) => o.name],
    // GNIS civil divisions leak into the stored towns ("Justice of the Peace
    // District 3" is a real GNIS name in Arkansas) — a top-5 shortlist has no
    // room for a single one of them. Names, not opinions: these are filings,
    // not places with beds.
    // Towns are PAGES now (~3,200 of them, pre-rendered) — every tile links
    // to its town guide (owner call 2026-07-22: no more dead town text).
    ["Gateway towns", ((nearby && nearby.towns) || []).filter((o) => !/justice of the peace|election precinct|voting precinct|census|township \d|magisterial|supervisor.s district/i.test(o.name || "")), (o) => townHref(o.name, o.state || st), "🏘", (o) => o.name + (o.state || st ? ", " + (o.state || st) : "")],
    ["NPS monuments & sites", (nearby && nearby.npsUnits) || [], (o) => "https://www.nps.gov/" + String(o.id || "").replace(/^nps:/, "") + "/", "🏛", (o) => o.name],
  ];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <h2 style={H2}>What&apos;s nearby</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, ...card, borderRadius: 999, padding: "8px 16px" }}>
          <span style={{ ...microLabel, letterSpacing: ".12em" }}>Within</span>
          <input type="range" min="10" max="150" step="10" value={radius} onChange={(e) => setRadius(+e.target.value)} style={{ width: 130, accentColor: "#c9a35f" }} />
          <span style={{ fontFamily: serif, fontSize: "1.15rem", color: "var(--pb-gold)", minWidth: 56 }}>{radius} mi</span>
        </div>
      </div>
      {secs.map(([title, items, href, icon, pqFn]) => {
        // Gateway towns: the TOP FIVE, not the phone book. Nearest-first is
        // already the sort, and five is a shortlist a person actually reads.
        const cap = title === "Gateway towns" ? 5 : 24;
        const within = items.map((o) => ({ ...o, distMi: o.distMi != null ? o.distMi : (park && o.lat != null ? Math.round(milesBetween(park, o)) : null) })).filter((o) => o.distMi != null && o.distMi <= radius).sort((a, b) => a.distMi - b.distMi).slice(0, cap);
        const totalPages = Math.max(1, Math.ceil(within.length / pageSize));
        const page = Math.min(pages[title] || 0, totalPages - 1);
        const slice = within.slice(page * pageSize, (page + 1) * pageSize);
        const turn = (d) => setPages((prev) => ({ ...prev, [title]: Math.min(Math.max(page + d, 0), totalPages - 1) }));
        return (
          <div key={title} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div style={{ ...microLabel, letterSpacing: ".12em" }}>{icon} {title}{within.length > 0 ? " · " + within.length : ""}</div>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => turn(-1)} disabled={page === 0} aria-label={"Previous " + title}
                    style={{ ...pagerBtn, opacity: page === 0 ? 0.35 : 1 }}>‹</button>
                  <span style={{ ...microLabel, letterSpacing: ".1em" }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => turn(1)} disabled={page === totalPages - 1} aria-label={"Next " + title}
                    style={{ ...pagerBtn, opacity: page === totalPages - 1 ? 0.35 : 1 }}>›</button>
                </div>
              )}
            </div>
            {within.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gap: 10 }}>
                {slice.map((o, i) => <NearbyTile key={page + "-" + i} o={o} href={href(o)} pq={pqFn(o)} />)}
              </div>
            ) : <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)", padding: "14px" }}>{nearby ? "Nothing within " + radius + " mi." : "Loading…"}</div>}
          </div>
        );
      })}
      {park && park.lat != null && <ToursNearby lat={park.lat} lng={park.lng} name={park.name} />}
    </>
  );
}

const pagerBtn = { cursor: "pointer", width: 30, height: 30, borderRadius: 999, background: "var(--pb-tint)",
  border: "1px solid var(--pb-line-strong)", color: "var(--pb-gold)", fontSize: "1rem", lineHeight: 1,
  display: "flex", alignItems: "center", justifyContent: "center" };
