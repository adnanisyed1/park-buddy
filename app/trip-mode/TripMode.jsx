"use client";

// /trip-mode — the live, on-trip companion. With the traveller's permission it
// watches location, tells them which stop they're near / heading to, prompts them
// to snap a photo for their book when they arrive at a stop, keeps a smart packing
// checklist, surfaces today's safety & conditions for each stop, and records a
// breadcrumb of where they've been. All client-side (works while the app is open);
// true background push when the app is closed needs a backend + service worker,
// which we flag honestly. Photos + checklist feed the Trip Book.

import { useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import loadScript from "../components/load-script";
import { getStops, getMeta } from "../lib/trip";
import { subscribeTripMode, getPhotosFor, addPhoto, removePhoto, fileToDataUrl, getChecklist, toggleChecklist, getBreadcrumb, addCrumb, photoCount, distMiles } from "../lib/tripmode";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 18, padding: 18 };
const microLabel = { fontFamily: mono, fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };
const VC = { go: "#4fd98a", prepare: "#e8cf9a", hold: "#e0906a" };

const CHECKLIST = {
  Essentials: ["America the Beautiful pass", "Water — ~1 L / person / hour", "Layers + rain shell", "Sun: hat, sunscreen, sunglasses", "First-aid + medications", "Headlamp / flashlight", "Offline maps downloaded", "Power bank / car charger"],
  "On the road": ["Rental car + insurance", "Snacks & cooler", "Cash for gateway towns", "Roadside kit"],
  "Stay & permits": ["Lodging / camp confirmations", "Timed-entry / wilderness permits", "Camping gear if needed"],
  "For the story": ["Camera space cleared", "A small notebook", "Photo reminders on (below)"],
};
const ARRIVE_MI = 2; // within this many miles of a stop = "you've arrived"

export default function TripMode() {
  const [stops, setStops] = useState([]);
  const [meta, setMeta] = useState({});
  const [ready, setReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [pos, setPos] = useState(null); // {lat,lng,accuracy}
  const [geoErr, setGeoErr] = useState("");
  const [cond, setCond] = useState({}); // stopName -> {verdict, alerts, fires}
  const [tick, setTick] = useState(0); // re-render on tripmode store changes
  const watchRef = useRef(null);
  const notifiedRef = useRef({}); // stopName -> true (avoid duplicate arrival notices)

  useEffect(() => {
    let on = true;
    (async () => {
      const raw = getStops();
      const m = getMeta();
      const coord = {};
      try { await loadScript("/trip-data.js"); (window.TRIP_PARKS || []).forEach((p) => { if (p && p.name) coord[p.name] = { lat: p.lat, lng: p.lng, state: p.state }; }); } catch {}
      try { const fd = await fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).catch(() => null); ((fd && fd.forests) || []).forEach((f) => { if (f && f.name) coord[f.name] = { lat: f.lat, lng: f.lng, state: f.state }; }); } catch {}
      const resolved = raw.map((s) => { const c = s.lat != null ? s : coord[s.name]; return c ? { name: s.name, state: s.state || (c.state || ""), lat: c.lat, lng: c.lng, custom: !!s.custom } : null; }).filter(Boolean);
      if (!on) return;
      setStops(resolved); setMeta(m); setReady(true);
      // fetch today's conditions per stop (best-effort)
      loadScript("/pb-verdict.js").catch(() => {});
      resolved.forEach((s) => {
        fetch("/api/conditions?lat=" + s.lat.toFixed(4) + "&lng=" + s.lng.toFixed(4)).then((r) => (r.ok ? r.json() : null)).then((d) => {
          if (!on || !d) return;
          setCond((prev) => ({ ...prev, [s.name]: { alerts: d.weatherAlerts || [], fires: d.wildfires || [], aqi: d.airQuality || null } }));
        }).catch(() => {});
        const PB = window.PBVerdict;
        if (PB && PB.fetchVerdict) PB.fetchVerdict(s.lat, s.lng, (res) => {
          if (!on) return; const r = res && typeof res.score === "number" ? res : res && res.v ? res.v : null;
          if (r) setCond((prev) => ({ ...prev, [s.name]: { ...(prev[s.name] || {}), verdict: { ...r, bucket: r.score >= 62 ? "go" : r.score >= 42 ? "prepare" : "hold" } } }));
        });
      });
    })();
    return () => { on = false; };
  }, []);

  useEffect(() => subscribeTripMode(() => setTick((t) => t + 1)), []);
  useEffect(() => () => { if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current); }, []);

  function startTracking() {
    if (!navigator.geolocation) { setGeoErr("Location isn't available on this device/browser."); return; }
    setGeoErr("");
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch {}
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setPos(c); setTracking(true); addCrumb(c.lat, c.lng);
        // arrival detection
        stops.forEach((s) => {
          if (distMiles(c.lat, c.lng, s.lat, s.lng) <= ARRIVE_MI && !notifiedRef.current[s.name]) {
            notifiedRef.current[s.name] = true;
            try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("You've reached " + s.name + " 📸", { body: "Snap a photo for your trip book." }); } catch {}
          }
        });
      },
      (err) => { setGeoErr(err.code === 1 ? "Location permission denied — enable it to use Trip Mode." : "Couldn't get your location. Try again with a clear sky view."); setTracking(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }
  function stopTracking() {
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null; setTracking(false);
  }

  // nearest + next stop given current position
  const withDist = pos ? stops.map((s) => ({ ...s, d: distMiles(pos.lat, pos.lng, s.lat, s.lng) })) : [];
  const nearest = withDist.length ? withDist.reduce((a, b) => (b.d < a.d ? b : a)) : null;
  const atStop = nearest && nearest.d <= ARRIVE_MI ? nearest : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader acctSlot />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(80px,12vh,120px) clamp(16px,4vw,28px) 60px" }}>

        {/* hero / control */}
        <div style={{ ...card, padding: "clamp(20px,4vw,30px)", background: "linear-gradient(160deg,rgba(16,34,24,.9),rgba(9,20,14,.9))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: tracking ? "#4fd98a" : "#8a938b", boxShadow: tracking ? "0 0 0 4px rgba(79,217,138,.2)" : "none" }} />
            <span style={microLabel}>{tracking ? "Trip Mode is on" : "Trip Mode"}</span>
          </div>
          <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.9rem,5vw,2.8rem)", lineHeight: 1.05, margin: 0 }}>{meta.tripName || "Your trip"}</h1>
          <p style={{ color: "var(--pb-ink-2)", fontSize: ".98rem", lineHeight: 1.6, margin: "10px 0 0", maxWidth: "56ch" }}>
            Turn this on as you travel. We&apos;ll show where you are on the route, nudge you to grab a photo at each stop for your book, keep your checklist, and surface today&apos;s conditions for where you&apos;re headed.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
            {!tracking ? (
              <button onClick={startTracking} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".9rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "13px 24px" }}>◉ Start Trip Mode</button>
            ) : (
              <button onClick={stopTracking} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".9rem", fontWeight: 700, color: "#e7e3d8", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "13px 24px" }}>■ Stop tracking</button>
            )}
            <a href="/trip-book" style={{ textDecoration: "none", fontSize: ".9rem", fontWeight: 700, color: "#e7e3d8", background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "13px 22px" }}>📖 Turn this into a book →</a>
            <span style={{ fontFamily: mono, fontSize: ".62rem", color: "var(--pb-muted)" }}>{photoCount()} photos · {getBreadcrumb().length} track points</span>
          </div>
          {geoErr && <div style={{ marginTop: 12, fontSize: ".84rem", color: "#e0906a" }}>{geoErr}</div>}
          {tracking && pos && (
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line)" }}>
              {atStop ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <b style={{ color: "#4fd98a" }}>You&apos;re at {atStop.name} 📍</b>
                  <span style={{ fontSize: ".85rem", color: "var(--pb-ink-2)" }}>Perfect time for a photo — scroll to {atStop.name} below and add one for your book.</span>
                </div>
              ) : nearest ? (
                <div style={{ fontSize: ".9rem", color: "var(--pb-ink-2)" }}>Nearest stop: <b style={{ color: "var(--pb-ink)" }}>{nearest.name}</b> · {nearest.d < 10 ? nearest.d.toFixed(1) : Math.round(nearest.d)} mi away{pos.accuracy ? " · ~" + Math.round(pos.accuracy * 3.28) + " ft GPS accuracy" : ""}</div>
              ) : null}
            </div>
          )}
          <div style={{ marginTop: 10, fontFamily: mono, fontSize: ".56rem", letterSpacing: ".06em", color: "var(--pb-muted)", lineHeight: 1.5 }}>
            Location stays on your device. Reminders work while Park Buddy is open — background alerts when the app is closed are coming with accounts.
          </div>
        </div>

        {!ready ? (
          <div style={{ textAlign: "center", color: "var(--pb-muted)", padding: "40px 0" }}>Loading your trip…</div>
        ) : stops.length === 0 ? (
          <div style={{ ...card, textAlign: "center", marginTop: 20, color: "var(--pb-muted)" }}>Your trip is empty. <a href="/build-trip" style={{ color: "var(--pb-gold)" }}>Build it first →</a></div>
        ) : (
          <>
            {/* stops: photos + conditions */}
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", margin: "30px 0 14px" }}>Your stops</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {stops.map((s) => <StopCard key={s.name} s={s} cond={cond[s.name]} pos={pos} />)}
            </div>

            {/* checklist */}
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", margin: "34px 0 14px" }}>Packing &amp; prep</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              {Object.entries(CHECKLIST).map(([group, items]) => <ChecklistCard key={group} group={group} items={items} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StopCard({ s, cond, pos }) {
  const [busy, setBusy] = useState(false);
  const photos = getPhotosFor(s.name);
  const v = cond && cond.verdict;
  const alerts = (cond && cond.alerts) || [];
  const fires = (cond && cond.fires) || [];
  const d = pos ? distMiles(pos.lat, pos.lng, s.lat, s.lng) : null;

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { const url = await fileToDataUrl(file); addPhoto(s.name, { url, lat: pos ? pos.lat : null, lng: pos ? pos.lng : null }); } catch {}
    setBusy(false);
  }

  return (
    <div style={{ ...card }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: "1.2rem", fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", marginTop: 1 }}>{[s.state, d != null ? (d < 10 ? d.toFixed(1) : Math.round(d)) + " mi away" : null, s.custom ? "custom stop" : null].filter(Boolean).join(" · ")}</div>
        </div>
        {v && <span style={{ fontFamily: mono, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: VC[v.bucket] || "#b3ab97", border: "1px solid " + (VC[v.bucket] || "#b3ab97") + "55", borderRadius: 999, padding: "4px 10px" }}>● {v.bucket === "go" ? "Good to go" : v.bucket === "prepare" ? "Go prepared" : "Hold off"}{typeof v.temp === "number" ? " · " + Math.round(v.temp) + "°" : ""}</span>}
      </div>

      {/* alerts */}
      {(alerts.length > 0 || fires.length > 0) && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {alerts.slice(0, 2).map((a, i) => <div key={i} style={{ fontSize: ".8rem", color: "#e0906a", background: "rgba(224,144,106,.1)", border: "1px solid rgba(224,144,106,.3)", borderRadius: 9, padding: "6px 10px" }}>⚠ {a.event}</div>)}
          {fires.length > 0 && <div style={{ fontSize: ".8rem", color: "#e0a56a", background: "rgba(224,144,106,.08)", border: "1px solid rgba(224,144,106,.25)", borderRadius: 9, padding: "6px 10px" }}>🔥 {fires.length} wildfire{fires.length === 1 ? "" : "s"} within 80 mi</div>}
        </div>
      )}
      {cond && !alerts.length && !fires.length && <div style={{ marginTop: 10, fontSize: ".8rem", color: "#7fe3a6" }}>✓ No active alerts here today.</div>}

      {/* photos */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {photos.map((p) => (
          <span key={p.id} style={{ position: "relative", width: 78, height: 78, borderRadius: 12, overflow: "hidden", border: "1px solid var(--pb-line-strong)" }}>
            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => removePhoto(s.name, p.id)} title="Remove" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(8,16,12,.8)", color: "#fff", fontSize: ".8rem", cursor: "pointer", lineHeight: 1 }}>×</button>
          </span>
        ))}
        <label style={{ cursor: "pointer", width: 78, height: 78, borderRadius: 12, border: "1.5px dashed var(--pb-line-strong)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: "var(--pb-gold-soft)", fontSize: ".64rem", fontWeight: 700, background: "rgba(255,255,255,.03)" }}>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
          <span style={{ fontSize: "1.3rem" }}>{busy ? "…" : "📸"}</span>{busy ? "Saving" : "Add photo"}
        </label>
      </div>
    </div>
  );
}

function ChecklistCard({ group, items }) {
  const [, force] = useState(0);
  const checked = getChecklist();
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: ".92rem", marginBottom: 8 }}>{group}</div>
      {items.map((it) => {
        const key = group + "|" + it;
        const on = !!checked[key];
        return (
          <button key={it} onClick={() => { toggleChecklist(key); force((n) => n + 1); }} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 9, padding: "6px 2px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
            <span style={{ width: 16, height: 16, flex: "none", marginTop: 1, borderRadius: 4, border: "1.5px solid " + (on ? "#4fd98a" : "var(--pb-line-strong)"), background: on ? "#4fd98a" : "transparent", color: "#0b1710", fontSize: ".7rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{on ? "✓" : ""}</span>
            <span style={{ fontSize: ".85rem", color: on ? "var(--pb-muted)" : "var(--pb-ink-2)", textDecoration: on ? "line-through" : "none" }}>{it}</span>
          </button>
        );
      })}
    </div>
  );
}
