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
import { usePhoto } from "../../components/PhotoThumb";
import loadScript from "../../components/load-script";
import { getSunTimes, getMoon, fmtTime } from "../../lib/sunmoon";
import { addStop, inTrip } from "../../lib/trip";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const VC = { go: "#4fd98a", prepare: "#e8cf9a", hold: "#e0906a", loading: "#b3ab97" };
const VHEAD = { go: "Great day to go", prepare: "Go prepared", hold: "Hold off today", loading: "Checking today's call…" };
const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 18, padding: 18 };
const microLabel = { fontFamily: mono, fontSize: ".56rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#9aa7a0" };
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
function wxEmoji(text = "") {
  const t = text.toLowerCase();
  if (/thunder|t-storm|tstorm/.test(t)) return "⛈";
  if (/snow|flurr|wintry|sleet/.test(t)) return "❄";
  if (/rain|shower|drizzle/.test(t)) return "🌧";
  if (/fog|haze|mist/.test(t)) return "🌫";
  if (/cloud|overcast/.test(t)) return /partly|few|mostly sunny/.test(t) ? "🌤" : "☁";
  if (/clear|sunny/.test(t)) return "☀";
  return "🌡";
}

const TABS = [
  ["overview", "Overview"],
  ["conditions", "Conditions 🔔"],
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
  const isForest = kind === "forest";
  const KIND_LABEL = isForest ? "National Forest" : "National Park";
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

  const hero = usePhoto(park ? (isForest ? park.name + "|" + park.name : park.name + " National Park|" + park.name) : null, null, null, undefined, 1600);

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
      // NPS unit data + road-closure feed are national-park only (forests aren't NPS units).
      if (!isForest) {
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
              days.push({ name: cur.name.replace(/ (Afternoon|Night)/, "").slice(0, 3), hi: cur.temperature, lo: night ? night.temperature : null, icon: wxEmoji(cur.shortForecast), pop: (cur.probabilityOfPrecipitation && cur.probabilityOfPrecipitation.value) || 0 });
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
    })();
    return () => { on = false; };
  }, [id]);

  // Reflect whether this park is already in the trip.
  useEffect(() => { if (park) setAdded(inTrip(park.name)); }, [park]);

  const scrollToTabs = () => { const el = document.getElementById("ps-tabnav"); if (el) window.scrollTo({ top: el.offsetTop - 64, behavior: "smooth" }); };
  const goAlerts = () => { setTab("conditions"); setTimeout(() => { const el = alertsRef.current; if (el) { window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 80, behavior: "smooth" }); el.style.transition = "box-shadow .4s"; el.style.boxShadow = "0 0 0 2px #e8cf9a,0 30px 70px -40px rgba(0,0,0,.9)"; setTimeout(() => { el.style.boxShadow = ""; }, 1600); } }, 60); };

  if (park === null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
        <SiteHeader acctSlot />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "140px 20px", textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: "2.4rem", fontWeight: 600 }}>Park not found</h1>
          <p style={{ color: "var(--pb-ink-2)", marginTop: 10 }}>We couldn&apos;t find a national park with that id.</p>
          <a href="/explore" style={{ display: "inline-block", marginTop: 18, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "11px 20px", fontWeight: 600, textDecoration: "none" }}>Explore the map →</a>
        </div>
      </div>
    );
  }

  const bucket = verdict ? verdict.bucket : "loading";
  const vColor = VC[bucket];
  const temp = verdict && typeof verdict.temp === "number" ? Math.round(verdict.temp) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        @keyframes ps-pulse { 0% { box-shadow: 0 0 0 0 rgba(79,217,138,.5);} 70% { box-shadow: 0 0 0 8px rgba(79,217,138,0);} 100% { box-shadow: 0 0 0 0 rgba(79,217,138,0);} }
        @keyframes ps-ken { 0% { transform: scale(1.04);} 100% { transform: scale(1.12);} }
        .ps-tab-panel { display: none; }
        .ps-tab-panel.on { display: block; }
        /* two-column layouts (hero, about, subscribe) — stack on mobile */
        .ps-grid { grid-template-columns: minmax(0,1.2fr) minmax(0,1fr); }
        @media (max-width: 860px) { .ps-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .ps-hero { min-height: auto !important; } }
      `}</style>

      <SiteHeader acctSlot />

      {/* HERO + VERDICT */}
      <section className="ps-hero" style={{ position: "relative", overflow: "hidden", minHeight: "min(88vh,700px)", display: "flex", alignItems: "flex-end", padding: "clamp(96px,13vh,150px) clamp(16px,4vw,40px) clamp(30px,5vh,54px)" }}>
        {park && hero && hero.url && <img alt="" src={hero.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "ps-ken 24s ease-out both" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,19,13,.4) 0%,rgba(8,19,13,.12) 38%,rgba(8,19,13,.85) 100%)" }} />
        <div className="ps-grid" style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", width: "100%", display: "grid", gap: "clamp(20px,4vw,44px)", alignItems: "end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: mono, fontSize: ".64rem", letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-gold)" }}>{KIND_LABEL} · {park ? park.state : ""}</span>
            </div>
            <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(3rem,8vw,6rem)", lineHeight: 0.92, letterSpacing: "-.02em", textShadow: "0 6px 40px rgba(0,0,0,.5)", marginTop: 10 }}>{park ? park.name : "…"}</h1>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
              <button onClick={addToTrip} style={{ cursor: "pointer", fontSize: ".86rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "12px 22px", boxShadow: "0 10px 30px -14px rgba(217,183,121,.6)" }}>{added ? "✓ In your trip" : "+ Add to trip"}</button>
              <a href="/#ask" style={{ textDecoration: "none", cursor: "pointer", fontSize: ".86rem", fontWeight: 600, color: "#f4f1ea", background: "rgba(10,23,18,.5)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "12px 22px" }}>✦ Ask Park Buddy</a>
            </div>
          </div>
          {/* verdict card */}
          <div style={{ background: "rgba(10,23,18,.62)", WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)", border: "1px solid " + vColor + "66", borderRadius: 22, padding: 22, boxShadow: "0 30px 80px -50px rgba(0,0,0,.9)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: vColor, boxShadow: "0 0 10px " + vColor, animation: "ps-pulse 2.4s infinite" }} />
              <span style={{ ...microLabel, letterSpacing: ".16em" }}>Today&apos;s call{verdict ? "" : " · loading"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10 }}>
              <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(2.4rem,5vw,3.4rem)", lineHeight: 1, color: vColor }}>{verdict ? (verdict.word || bucket.toUpperCase()) : "…"}</span>
              <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: "1.4rem", color: "#e7e3d8" }}>{VHEAD[bucket]}</span>
            </div>
            <p style={{ fontSize: ".96rem", color: "#d3d8d1", lineHeight: 1.5, marginTop: 6 }}>{verdict ? verdict.sub : "Reading today's conditions from the National Weather Service…"}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {temp != null && <span style={chip()}>☀ {temp}°F {verdict.sky || ""}</span>}
              {verdict && typeof verdict.wind === "number" ? <span style={chip()}>🌬 {Math.round(verdict.wind)} mph</span> : null}
              <span style={chip((cond && (cond.weatherAlerts || []).length) ? "warn" : "good")}>{cond ? ((cond.weatherAlerts || []).length ? (cond.weatherAlerts.length + " alert" + (cond.weatherAlerts.length === 1 ? "" : "s")) : "No alerts") : "…"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ALERTS NUDGE */}
      <div style={{ padding: "14px clamp(16px,4vw,40px) 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "linear-gradient(120deg,rgba(217,183,121,.16),rgba(31,94,70,.14))", border: "1px solid var(--pb-line-strong)", borderRadius: 16, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: "rgba(10,23,18,.4)", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.15rem" }}>🔔</span>
            <div>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.15rem", lineHeight: 1.1 }}>Planning a trip? Turn on {park ? park.name : ""} alerts.</div>
              <div style={{ fontSize: ".84rem", color: "#c3c8d0", fontWeight: 300, marginTop: 1 }}>Know the moment the verdict flips, a permit drops, or a flash-flood watch is issued.</div>
            </div>
          </div>
          <button onClick={goAlerts} style={{ cursor: "pointer", flex: "none", fontFamily: "inherit", fontSize: ".84rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "11px 20px", boxShadow: "0 10px 30px -14px rgba(217,183,121,.6)" }}>Set up alerts →</button>
        </div>
      </div>

      {/* STICKY TABS */}
      <div id="ps-tabnav" style={{ position: "sticky", top: 56, zIndex: 50, background: "rgba(10,23,18,.85)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--pb-line)", marginTop: 14 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 4, padding: "0 clamp(16px,4vw,40px)", overflowX: "auto" }}>
          {TABS.map(([k, label]) => {
            const on = tab === k;
            return <button key={k} onClick={() => { setTab(k); scrollToTabs(); }} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".84rem", fontWeight: 600, color: on ? "#f4f1ea" : "#8a938b", background: "transparent", border: "none", borderBottom: "2px solid " + (on ? "#e8cf9a" : "transparent"), padding: "15px 16px", whiteSpace: "nowrap" }}>{label}</button>;
          })}
        </div>
      </div>

      <main style={{ padding: "clamp(28px,4vh,48px) clamp(16px,4vw,40px) 8px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {tab === "overview" && <Overview park={park} nps={nps} isForest={isForest} />}
          {tab === "conditions" && <Conditions park={park} cond={cond} road={road} hourly={hourly} daily={daily} webcams={webcams} river={river} tz={tz} alertsRef={alertsRef} isForest={isForest} />}
          {tab === "trails" && <TrailsPermits park={park} trails={trails} isForest={isForest} />}
          {tab === "plan" && <Plan park={park} nps={nps} places={places} isForest={isForest} />}
          {tab === "nearby" && <Nearby park={park} nearby={nearby} radius={radius} setRadius={setRadius} />}
        </div>
      </main>

      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(30px,5vh,54px) clamp(16px,4vw,40px)" }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 24 }}>
          <div style={{ ...microLabel, letterSpacing: ".1em", lineHeight: 1.8 }}>Sources: {isForest ? "USDA Forest Service" : "National Park Service"} · National Weather Service · USGS · AirNow — public domain / official feeds.</div>
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
  return { ...base, background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line)", color: "#f4f1ea" };
}
const H2 = { fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3vw,1.9rem)" };

/* ---------------- OVERVIEW ---------------- */
function Overview({ park, nps, isForest }) {
  const p = nps && nps.park;
  const forestAbout = park
    ? park.name + " is one of the United States' national forests — public land managed by the USDA Forest Service for recreation, timber, watershed and wildlife. The live conditions below come from the nearest weather, wildfire and air-quality stations; check the forest's ranger district for road closures, dispersed-camping rules and any permits."
    : "";
  return (
    <>
      <div style={{ display: "grid", gap: "clamp(20px,4vw,40px)" }} className="ps-grid">
        <div>
          <h2 style={{ ...H2, fontSize: "clamp(1.6rem,3.4vw,2.3rem)" }}>{isForest ? "About the forest" : "About the park"}</h2>
          <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.75, fontWeight: 300, marginTop: 12 }}>
            {p && p.description ? p.description : isForest ? forestAbout : "Loading park overview from NPS.gov…"}
          </p>
          {p && (p.activities || []).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              {p.activities.slice(0, 6).map((a) => <span key={a} style={{ fontSize: ".82rem", fontWeight: 500, color: "#e7e3d8", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 13px" }}>{a}</span>)}
            </div>
          )}
          {p && p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, textDecoration: "none", fontSize: ".86rem", fontWeight: 600, color: "var(--pb-gold)" }}>More on NPS.gov →</a>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...card, borderRadius: 16 }}>
            <div style={microLabel}>State</div>
            <div style={{ fontFamily: serif, fontSize: "1.5rem", marginTop: 4 }}>{park ? park.state : "—"}</div>
          </div>
          {p && (nps.thingsToDo || []).length > 0 && (
            <div style={{ ...card, borderRadius: 16 }}>
              <div style={microLabel}>Notable things to do</div>
              <div style={{ fontSize: ".9rem", color: "#e7e3d8", lineHeight: 1.7, marginTop: 6 }}>{nps.thingsToDo.slice(0, 5).map((t) => t.title).join(" · ")}</div>
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
function Conditions({ park, cond, road, hourly, daily, webcams, river, tz, alertsRef, isForest }) {
  const alerts = (cond && cond.weatherAlerts) || [];
  const fires = (cond && cond.wildfires) || [];
  const aqi = cond && cond.airQuality;
  const floodWatch = alerts.find((a) => /flood/i.test(a.event || ""));
  const gauge = river && river.found ? river.gauge : null;
  const sun = park ? getSunTimes(new Date(), park.lat, park.lng) : null;
  const moon = getMoon(new Date());
  const roadText = road && (road.summary || road.status || (road.roads && road.roads[0] && road.roads[0].status));
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4fd98a" }} />
        <h2 style={{ fontFamily: mono, fontSize: ".66rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Live conditions</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <StatCard label="Weather alerts · NWS" value={cond ? (alerts.length ? String(alerts.length) : "None active") : "…"} valueColor={alerts.length ? "#e0906a" : "#7fe3a6"} note={alerts.length ? alerts.slice(0, 2).map((a) => a.event).join(" · ") : "No watches or warnings for the park today."} tint={alerts.length ? "warn" : "good"} />
        <StatCard label="Wildfires · within 80 mi" value={cond ? String(fires.length) : "…"} note={fires.length ? ("Nearest: " + (fires[0].name || "active fire")) : "No active wildfires reported nearby."} />
        <StatCard label="Air quality · AirNow" value={aqi ? String(aqi.aqi) : (cond ? "—" : "…")} valueColor={aqi && aqi.aqi <= 50 ? "#7fe3a6" : "#e8cf9a"} note={aqi ? (aqi.category + (aqi.parameter ? " · " + aqi.parameter : "")) : "Air-quality reading unavailable for this area."} />
        {isForest ? (
          <StatCard label="Roads · USFS" value="Check district" valueColor="#e8cf9a" note="Forest & FS/MVUM roads close seasonally and after storms — check the ranger district before you go." />
        ) : (
          <StatCard label="Roads · NPS" value={roadText ? "See note" : (road ? "Open" : "…")} valueColor="#e8cf9a" note={roadText || "No road closures reported. Always check NPS.gov before you go."} />
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

      {/* 12h forecast */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ ...microLabel, marginBottom: 14 }}>Next 12 hours · NWS forecast</div>
        {hourly ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: 10 }}>
            {hourly.map((h, i) => (
              <div key={i} style={{ textAlign: "center", background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "12px 8px" }}>
                <div style={{ ...microLabel, letterSpacing: ".08em" }}>{new Date(h.startTime).toLocaleTimeString("en-US", tz ? { hour: "numeric", timeZone: tz } : { hour: "numeric" })}</div>
                <div style={{ fontSize: "1.4rem", margin: "6px 0" }}>{wxEmoji(h.shortForecast)}</div>
                <div style={{ fontFamily: serif, fontSize: "1.3rem" }}>{h.temperature}°</div>
                <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", marginTop: 2 }}>{h.shortForecast}</div>
              </div>
            ))}
          </div>
        ) : <Loading text="Loading hourly forecast from weather.gov…" />}
      </div>

      {/* 7-day */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ ...microLabel, marginBottom: 14 }}>7-day outlook · NWS</div>
        {daily ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: 8 }}>
            {daily.map((d, i) => (
              <div key={i} style={{ textAlign: "center", background: "rgba(255,255,255,.03)", border: "1px solid rgba(217,183,121,.12)", borderRadius: 12, padding: "12px 6px" }}>
                <div style={{ ...microLabel, letterSpacing: ".06em" }}>{d.name}</div>
                <div style={{ fontSize: "1.3rem", margin: "5px 0" }}>{d.icon}</div>
                <div style={{ fontFamily: serif, fontSize: "1.05rem" }}>{d.hi}°{d.lo != null && <span style={{ color: "var(--pb-muted)", fontSize: ".8em" }}> / {d.lo}°</span>}</div>
                <div style={{ fontSize: ".62rem", color: d.pop > 30 ? "#a9c2e0" : "var(--pb-muted)", marginTop: 3 }}>💧 {d.pop}%</div>
              </div>
            ))}
          </div>
        ) : <Loading text="Loading 7-day outlook…" />}
      </div>

      {/* Sun & sky */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 12 }}>
        <div style={card}>
          <div style={microLabel}>Sun &amp; sky · computed{tz ? " · park time" : ""}</div>
          <Row k="☀ Sunrise" v={fmtTime(sun && sun.sunrise, tz)} />
          <Row k="🌇 Sunset" v={fmtTime(sun && sun.sunset, tz)} />
          <Row k="📸 Golden hour" v={fmtTime(sun && sun.goldenHour, tz)} />
          <Row k="🌙 Moon" v={moon.name + " · " + Math.round(moon.fraction * 100) + "%"} />
          {moon.fraction < 0.35 && <div style={{ marginTop: 12, background: "rgba(90,134,201,.1)", border: "1px solid rgba(90,134,201,.3)", borderRadius: 10, padding: "9px 11px", fontSize: ".78rem", color: "#a9c2e0" }}>🔭 Dark-sky night — great for stargazing.</div>}
        </div>
        <div style={card}>
          <div style={microLabel}>{gauge ? gauge.name + " · USGS" : "River flow · USGS"}</div>
          {gauge ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.9rem", lineHeight: 1, color: "#7fe3a6" }}>{gauge.cfs.toLocaleString()}</span>
                <span style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink-2)" }}>cfs</span>
                {gauge.gaugeFt != null && <span style={{ fontSize: ".78rem", color: "var(--pb-muted)" }}>· {gauge.gaugeFt} ft stage</span>}
              </div>
              <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 6 }}>Nearest active streamgage · {gauge.distanceMi} mi away</div>
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

function StatCard({ label, value, note, valueColor, tint }) {
  const bg = tint === "good" ? { background: "rgba(79,217,138,.07)", border: "1px solid rgba(79,217,138,.3)" } : tint === "warn" ? { background: "rgba(224,144,106,.07)", border: "1px solid rgba(224,144,106,.3)" } : {};
  return (
    <div style={{ ...card, ...bg }}>
      <div style={microLabel}>{label}</div>
      <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.85rem", lineHeight: 1, marginTop: 10, color: valueColor || "#f4f1ea" }}>{value}</div>
      <div style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", marginTop: 6, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
function Row({ k, v }) { return <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span style={{ fontSize: ".84rem", color: "var(--pb-ink-2)" }}>{k}</span><b style={{ fontSize: ".9rem", color: "#f4f1ea" }}>{v}</b></div>; }

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
      {a.headline && <p style={{ fontSize: ".9rem", color: "#e7e3d8", fontWeight: 500, lineHeight: 1.5, marginTop: 10 }}>{a.headline}</p>}
      {a.description && (
        <p style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.6, fontWeight: 300, marginTop: 8, whiteSpace: "pre-line" }}>
          {open || !longDesc ? a.description : a.description.slice(0, 260).trim() + "…"}
        </p>
      )}
      {a.instruction && (open || !longDesc) && (
        <div style={{ marginTop: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ ...microLabel, fontSize: ".5rem", marginBottom: 4 }}>What to do</div>
          <div style={{ fontSize: ".82rem", color: "#e7e3d8", lineHeight: 1.55, whiteSpace: "pre-line" }}>{a.instruction}</div>
        </div>
      )}
      {longDesc && <button onClick={() => setOpen((o) => !o)} style={{ marginTop: 10, background: "none", border: "none", color: c, fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>{open ? "Show less" : "Read full alert →"}</button>}
    </div>
  );
}
function Loading({ text }) { return <div style={{ textAlign: "center", color: "var(--pb-muted)", fontSize: ".84rem", padding: "10px 0" }}>{text}</div>; }

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
              return <button key={k} onClick={() => toggle(k)} type="button" style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 500, borderRadius: 999, padding: "8px 14px", border: "1px solid " + (on ? "transparent" : "var(--pb-line-strong)"), background: on ? "var(--pb-grad-gold)" : "rgba(255,255,255,.03)", color: on ? "#0b1710" : "#c3c8d0" }}>{on ? "✓ " : ""}{label}</button>;
            })}
          </div>
          {status === "done" ? (
            <div style={{ marginTop: 16, color: "#7fe3a6", fontWeight: 600, fontSize: ".92rem" }}>✓ You&apos;re subscribed — we&apos;ll email you when it changes.</div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={"Email for " + (park ? park.name : "park") + " alerts"} style={{ flex: 1, minWidth: 190, fontFamily: "inherit", fontSize: ".88rem", color: "#f4f1ea", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 15px", outline: "none" }} />
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
function TrailRow({ t, park, diff }) {
  const pt = (t.path && t.path[0]) || null;
  const photo = usePhoto(t.name + " " + (park ? park.name : "") + "|" + t.name, pt ? pt[0] : null, pt ? pt[1] : null, undefined, 360);
  const href = t.id != null && park && park.npsCode ? "/trail-status?trail=" + t.id + "&park=" + park.npsCode : null;
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 11, ...card, padding: 8 }}>
      <span style={{ position: "relative", width: 74, height: 56, flex: "none", borderRadius: 10, overflow: "hidden", background: hatch, display: "block" }}>
        {photo && photo.url && <img alt="" src={photo.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: ".9rem", color: "#f4f1ea", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</b>
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
function CompactCamp({ c, park, recId }) {
  const photo = usePhoto(c.name + "|" + c.name + " campground|" + (park ? park.name : ""), c.lat, c.lng, undefined, 700);
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
  const summary = avail === undefined ? "Checking availability…"
    : !avail ? "Availability on Recreation.gov"
    : avail.total === 0 ? "No bookable sites this month"
    : open ? "Up to " + (avail.peakOpen || 0) + " of " + avail.total + " open" + (soon ? " · soonest " + soon : "")
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

function TrailsPermits({ park, trails, isForest }) {
  const [filter, setFilter] = useState("all");
  const list = trails ? [].concat(trails.hiking || [], trails.offroad || [], trails.ski || []) : null;
  const diffOf = (t) => (t.lengthMi > 6 ? "Hard" : t.lengthMi > 2.5 ? "Moderate" : "Easy");
  const shown = list ? list.filter((t) => filter === "all" || diffOf(t) === filter) : null;
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h2 style={H2}>Trails</h2>
        <span style={{ ...microLabel, letterSpacing: ".12em" }}>{isForest ? "Live from OpenStreetMap" : "Live from NPS trail data"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {["all", "Easy", "Moderate", "Hard"].map((f) => {
          const on = filter === f;
          return <button key={f} onClick={() => setFilter(f)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, borderRadius: 999, padding: "7px 14px", border: on ? "none" : "1px solid var(--pb-line-strong)", background: on ? "var(--pb-grad-gold)" : "rgba(255,255,255,.03)", color: on ? "#0b1710" : "#c3c8d0" }}>{f === "all" ? "All" : f}</button>;
        })}
      </div>
      {shown && shown.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10 }}>
          {shown.slice(0, 30).map((t, i) => <TrailRow key={i} t={t} park={park} diff={diffOf(t)} />)}
        </div>
      ) : <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)" }}>{trails ? "No mapped trails within range yet." : "Loading trails…"}</div>}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ ...H2, marginBottom: 14 }}>Permits &amp; reservations</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={microLabel}>Permits &amp; {isForest ? "passes" : "timed entry"}</div>
            <div style={{ fontFamily: serif, fontSize: "1.3rem", marginTop: 8 }}>Varies by {isForest ? "district" : "park"}</div>
            <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 6 }}>{isForest ? "Many forests need permits for wilderness areas, dispersed camping, campfires or day-use in season. We link you to the official source rather than guess the current rules." : "Many parks require timed-entry or wilderness permits in season. We link you to the official source rather than guess the current rules."}</div>
            <a href={"https://www.recreation.gov/search?q=" + encodeURIComponent((park ? park.name : "") + (isForest ? "" : " National Park"))} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "9px 15px" }}>Check permits on Recreation.gov ↗</a>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <div style={microLabel}>Official {isForest ? "forest" : "park"} rules</div>
            <div style={{ fontFamily: serif, fontSize: "1.3rem", marginTop: 8 }}>{isForest ? "fs.usda.gov" : "NPS.gov"}</div>
            <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.6, marginTop: 6 }}>{isForest ? "Fees, closures and fire restrictions change through the year — the forest's own Forest Service page is always current." : "Entrance fees, reservation systems and closures change through the year — the park's own page is always current."}</div>
            <a href={isForest ? "https://www.fs.usda.gov/" : (park && park.npsCode ? "https://www.nps.gov/" + park.npsCode : "https://www.nps.gov")} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "#f4f1ea", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 15px" }}>Official site ↗</a>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- PLAN ---------------- */
function Plan({ park, nps, places, isForest }) {
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
            return <CompactCamp key={i} c={c} park={park} recId={recId} />;
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
            <a href={"https://maps.google.com/?q=" + encodeURIComponent((park ? park.name : "") + (isForest ? "" : " National Park"))} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "#0b1710", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "9px 15px" }}>Directions ↗</a>
            <a href={isForest ? "https://www.fs.usda.gov/" : (park && park.npsCode ? "https://www.nps.gov/" + park.npsCode : "https://www.nps.gov")} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", fontSize: ".8rem", fontWeight: 600, color: "#f4f1ea", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 15px" }}>Official site ↗</a>
          </div>
        </div>
        {p && (p.activities || []).length > 0 && (
          <div style={{ ...card, padding: 20 }}>
            <div style={microLabel}>What to do</div>
            <div style={{ fontSize: ".9rem", color: "#e7e3d8", lineHeight: 1.7, marginTop: 8 }}>{p.activities.slice(0, 8).join(" · ")}</div>
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
      <figcaption style={{ position: "absolute", left: 12, right: 12, bottom: 10, fontFamily: serif, fontWeight: 600, fontSize: "1.1rem", color: "#f7f4ec", textShadow: "0 2px 10px rgba(0,0,0,.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</figcaption>
    </figure>
  );
  return href ? <a href={href} style={{ textDecoration: "none", display: "block" }}>{tile}</a> : tile;
}

function Nearby({ park, nearby, radius, setRadius }) {
  const st = park ? park.state : "";
  const secs = [
    ["Other parks", (nearby && nearby.parks) || [], (o) => "/parks/" + o.id, "🏔", (o) => o.name + " National Park|" + o.name],
    ["Lakes", (nearby && nearby.lakes) || [], (o) => "/lake-status?" + new URLSearchParams({ name: o.name, lat: o.lat || "", lng: o.lng || "" }), "💧", (o) => o.name],
    ["Gateway towns", (nearby && nearby.towns) || [], () => null, "🏘", (o) => o.name + (o.state || st ? ", " + (o.state || st) : "")],
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
        const within = items.map((o) => ({ ...o, distMi: o.distMi != null ? o.distMi : (park && o.lat != null ? Math.round(milesBetween(park, o)) : null) })).filter((o) => o.distMi != null && o.distMi <= radius).sort((a, b) => a.distMi - b.distMi).slice(0, 8);
        return (
          <div key={title} style={{ marginBottom: 24 }}>
            <div style={{ ...microLabel, letterSpacing: ".12em", marginBottom: 12 }}>{icon} {title}</div>
            {within.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10 }}>
                {within.map((o, i) => <NearbyTile key={i} o={o} href={href(o)} pq={pqFn(o)} />)}
              </div>
            ) : <div style={{ ...card, textAlign: "center", color: "var(--pb-muted)", padding: "14px" }}>{nearby ? "Nothing within " + radius + " mi." : "Loading…"}</div>}
          </div>
        );
      })}
    </>
  );
}
