"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ensureMapsLoaded } from "../../lib/googleMapsLoader";
import { usePhoto } from "../../components/PhotoThumb";

// /scenic-drives/<id> detail — ported 1:1 from the Claude-design spec. Real
// data: federal byway record (name/tier/states/length/qualities/blurb), live
// NPS road status, real photos (hero + filmstrip + highlight cards), a REAL
// Google map with numbered overlook markers wired two-way to the highlight
// cards (hover a card → its marker haloes; hover a marker → its card lifts),
// and internal cross-links to the parks/trails/lakes along the route.

const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const KEYFRAMES = `
@keyframes sd-ken{0%{transform:scale(1.08) translate(0,0)}100%{transform:scale(1.18) translate(-2.4%,-2.2%)}}
@keyframes sd-fadeup{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes sd-chip{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
@keyframes sd-shine{0%{background-position:-140% 0}60%,100%{background-position:240% 0}}
@keyframes sd-pulse{0%{box-shadow:0 0 0 0 rgba(228,190,120,.55)}70%{box-shadow:0 0 0 12px rgba(228,190,120,0)}100%{box-shadow:0 0 0 0 rgba(228,190,120,0)}}
@media(prefers-reduced-motion:reduce){.sd-anim{animation:none!important}}
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

function Badge({ tier }) {
  const top = tier === "all-american";
  const grad = top ? "linear-gradient(135deg,#f0d38a,#c79a4b)" : "linear-gradient(135deg,#e6e8ea,#a9b0b6)";
  const ink = top ? "#4a3410" : "#2c3338";
  return (
    <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 10, background: grad, borderRadius: 16, padding: "10px 15px", boxShadow: "0 16px 40px -18px rgba(0,0,0,.7)" }}>
      <div className="sd-anim" style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%)", backgroundSize: "220% 100%", animation: "sd-shine 4.5s ease-in-out infinite" }} />
      <svg width="22" height="22" viewBox="0 0 24 24" fill={ink} style={{ position: "relative", flex: "none" }}><path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5L2.6 8.8l6.5-.9z" /></svg>
      <span style={{ position: "relative", display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <b style={{ fontFamily: serif, fontWeight: 800, fontSize: ".98rem", color: ink }}>{top ? "All-American Road" : "National Scenic Byway"}</b>
        <span style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ink, opacity: .8 }}>{top ? "Top tier · unique in the nation" : "Nationally significant"}</span>
      </span>
    </div>
  );
}

function CrossTile({ c }) {
  const photo = usePhoto(c.q, c.lat, c.lng);
  const routeCol = { "National Park": "#1d4a37", "National Forest": "#3f6a4a", "State Park": "#6b7a3f", Trail: "#b3862d", Lake: "#2f6d7a", Campground: "#7a5a2f" };
  const col = routeCol[c.type] || "#1d4a37";
  return (
    <Link href={c.href} style={{ textDecoration: "none", position: "relative", display: "block", aspectRatio: "1/1", borderRadius: 20, overflow: "hidden", border: "1px solid #e7ddca", boxShadow: "0 18px 44px -24px rgba(28,46,34,.4)", background: "repeating-linear-gradient(135deg,#ece5d4 0 12px,#e6dfcd 12px 24px)" }}>
      {photo && photo.url && <img src={photo.url} alt={c.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.05) 40%,rgba(9,24,16,.82) 100%)" }} />
      <span style={{ position: "absolute", left: 11, top: 11, background: col, color: "#f3ede0", fontFamily: mono, fontSize: ".54rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", borderRadius: 999, padding: "4px 9px" }}>{c.type}</span>
      <b style={{ position: "absolute", left: 12, right: 12, bottom: 11, fontFamily: serif, fontWeight: 700, color: "#fbf6ea", fontSize: "1.02rem", lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{c.name}</b>
    </Link>
  );
}

export default function ScenicDrive({ drive, cross }) {
  const heroPhoto = usePhoto([...(drive.wiki || []), drive.name].join("|"), drive.lat, drive.lng);
  const [road, setRoad] = useState(undefined);
  const [highlights, setHighlights] = useState(drive.highlights || null);
  const [film, setFilm] = useState([]);
  const [filmIdx, setFilmIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapDivRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const filmTimer = useRef(null);

  // Live road status
  useEffect(() => {
    if (!drive.parkCode) { setRoad(null); return; }
    let on = true;
    fetch("/api/roadstatus?parkCode=" + drive.parkCode + "&road=" + encodeURIComponent(drive.name))
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (on) setRoad(d); }).catch(() => { if (on) setRoad(null); });
    return () => { on = false; };
  }, [drive.parkCode, drive.name]);

  // Highlights: curated (flagships) or derived from real named features on the route.
  useEffect(() => {
    if (drive.highlights && drive.highlights.length) { setHighlights(drive.highlights); return; }
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
      Promise.all(drive.film.map((f) =>
        fetch("/api/photo?q=" + encodeURIComponent(f.q.join("|")) + "&lat=" + drive.lat + "&lng=" + drive.lng + "&v=3")
          .then((r) => (r.ok ? r.json() : null)).then((d) => (d && d.found ? { url: d.image || d.thumb, cap: f.cap } : null)).catch(() => null)
      )).then((arr) => { if (on) setFilm(arr.filter(Boolean)); });
    } else {
      fetch("/api/photo?geolist=1&lat=" + drive.lat + "&lng=" + drive.lng + "&n=6")
        .then((r) => (r.ok ? r.json() : null)).then((d) => { if (on) setFilm(((d && d.photos) || []).map((p) => ({ url: p.image || p.thumb, cap: p.cap, date: p.date }))); }).catch(() => {});
    }
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
    const map = new g.maps.Map(mapDivRef.current, { mapTypeId: "terrain", mapTypeControl: true, streetViewControl: false, fullscreenControl: false, gestureHandling: "cooperative" });
    mapObjRef.current = map;
    map.setCenter({ lat: drive.lat, lng: drive.lng });
    map.setZoom(9);
  }, [mapsLoaded, drive.lat, drive.lng]);

  // (Re)draw markers when highlights resolve.
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const pts = (highlights || []).filter((h) => h.lat != null);
    if (!pts.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    pts.forEach((h, i) => {
      const mk = new window.google.maps.Marker({
        position: { lat: h.lat, lng: h.lng }, map,
        label: { text: String(i + 1), color: "#15241c", fontSize: "12px", fontWeight: "800" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#e4be78", fillOpacity: 1, strokeColor: "#15241c", strokeWeight: 2 },
      });
      mk.addListener("mouseover", () => setHoverIdx(i));
      mk.addListener("mouseout", () => setHoverIdx(null));
      markersRef.current.push(mk);
      bounds.extend({ lat: h.lat, lng: h.lng });
    });
    map.fitBounds(bounds, 60);
  }, [highlights, mapsLoaded]);

  // Two-way hover link: restyle the hovered marker.
  useEffect(() => {
    if (!window.google) return;
    markersRef.current.forEach((mk, i) => {
      const on = i === hoverIdx;
      mk.setIcon({ path: window.google.maps.SymbolPath.CIRCLE, scale: on ? 17 : 12, fillColor: on ? "#1d4a37" : "#e4be78", fillOpacity: 1, strokeColor: on ? "#e4be78" : "#15241c", strokeWeight: on ? 3 : 2 });
      mk.setLabel({ text: String(i + 1), color: on ? "#fff" : "#15241c", fontSize: "12px", fontWeight: "800" });
    });
  }, [hoverIdx]);

  const hl = highlights || [];
  const pill = (k, v) => (
    <span style={{ display: "inline-flex", flexDirection: "column", background: "rgba(10,26,18,.5)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(251,246,234,.2)", borderRadius: 15, padding: "10px 16px" }}>
      <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(243,237,224,.65)" }}>{k}</span>
      <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.15rem", color: "#fbf6ea", lineHeight: 1, marginTop: 3 }}>{v}</span>
    </span>
  );

  const roadDot = road && road.state === "closed" ? "#d0563a" : road && road.state === "caution" ? "#e0a53a" : "#46d97f";

  return (
    <div style={{ minHeight: "100vh", background: "#11281d", fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}>
      <style>{KEYFRAMES}</style>
      <header style={{ position: "sticky", top: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px clamp(16px,4vw,40px)", background: "rgba(17,40,29,.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(251,246,234,.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fbf6ea" }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(145deg,#e4be78,#c79a4b)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#15241c"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg></span>
          <div><b style={{ fontFamily: serif, fontSize: "1.05rem", fontWeight: 700, display: "block", lineHeight: 1.05 }}>ParkBuddy</b><span style={{ color: "rgba(243,237,224,.6)", fontSize: ".62rem", letterSpacing: ".16em", textTransform: "uppercase", fontFamily: mono }}>Scenic drive</span></div>
        </div>
        <Link href="/scenic-drives" style={{ color: "rgba(243,237,224,.92)", textDecoration: "none", fontSize: ".8rem", fontWeight: 600, border: "1px solid rgba(255,255,255,.22)", padding: "7px 13px", borderRadius: 999 }}>← All scenic drives</Link>
      </header>

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "min(88vh,760px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "clamp(80px,12vh,140px) clamp(16px,4vw,40px) clamp(40px,6vh,64px)" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0e2318" }}>
          {heroPhoto && heroPhoto.url && <img className="sd-anim" alt={drive.name} src={heroPhoto.url} style={{ position: "absolute", inset: "-6%", width: "112%", height: "112%", objectFit: "cover", transformOrigin: "60% 40%", animation: "sd-ken 26s ease-in-out infinite alternate" }} />}
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.42) 0%,rgba(9,24,16,.05) 34%,rgba(9,24,16,.55) 82%,rgba(9,24,16,.86) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 80% 0%,rgba(228,190,120,.14),transparent 55%)" }} />
        <div style={{ position: "absolute", top: "clamp(64px,9vh,88px)", right: "clamp(16px,4vw,40px)", zIndex: 4 }}><Badge tier={drive.tier} /></div>
        <div style={{ position: "relative", zIndex: 3, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div className="sd-anim" style={{ fontFamily: mono, fontSize: ".68rem", fontWeight: 700, letterSpacing: ".24em", textTransform: "uppercase", color: "#e4be78", animation: "sd-fadeup .6s ease both" }}>{drive.regionLabel} · {drive.states}</div>
          <h1 className="sd-anim" style={{ fontFamily: serif, fontWeight: 800, color: "#fbf6ea", fontSize: "clamp(2.6rem,7.4vw,5.4rem)", lineHeight: .94, letterSpacing: "-.025em", textShadow: "0 6px 40px rgba(0,0,0,.5)", marginTop: 12, maxWidth: "16ch", animation: "sd-fadeup .7s .06s ease both" }}>{drive.name}</h1>
          <div className="sd-anim" style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center", marginTop: 22, animation: "sd-fadeup .75s .14s ease both" }}>
            {pill("Length", drive.length)}{pill("States", drive.states)}{drive.time && pill("Drive time", drive.time)}
          </div>
        </div>
      </section>

      <div style={{ position: "relative", zIndex: 5, background: "#f3efe7", borderRadius: "30px 30px 0 0", marginTop: -30, boxShadow: "0 -30px 70px -34px rgba(8,18,12,.6)" }}>
        {/* ROAD STATUS */}
        <section style={{ padding: "clamp(22px,3.5vh,34px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ position: "relative", overflow: "hidden", background: "#fffdf7", border: "1px solid #e7ddca", borderRadius: 22, padding: "clamp(16px,2.4vw,22px)", boxShadow: "0 22px 54px -34px rgba(28,46,34,.5)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, flex: "1 1 auto", minWidth: 240 }}>
                  <span className="sd-anim" style={{ width: 16, height: 16, borderRadius: "50%", background: roadDot, boxShadow: "0 0 12px 1px " + roadDot, flex: "none", animation: "sd-pulse 2.2s infinite" }} />
                  <div>
                    <b style={{ fontFamily: serif, fontWeight: 800, fontSize: "1.35rem", color: "#163a2b", lineHeight: 1 }}>
                      {road === undefined ? "Checking road status…" : (road && road.label) ? road.label : (drive.parkCode ? "Status unavailable — see official page" : "Seasonal mountain road")}
                    </b>
                    <div style={{ fontSize: ".94rem", color: "#3f4a3c", lineHeight: 1.5, marginTop: 5, fontWeight: 600 }}>
                      {road && road.alerts && road.alerts.length ? road.alerts[0].title : drive.season ? "Typically open " + drive.season + "." : "Check the official page for current conditions."}
                    </div>
                  </div>
                </div>
                {drive.season && (
                  <div style={{ flex: "none", alignSelf: "center", display: "inline-flex", flexDirection: "column", gap: 2, background: "#fdf3e4", border: "1px solid #eeddc0", borderRadius: 14, padding: "9px 14px" }}>
                    <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#8a6a2f" }}>Open season</span>
                    <span style={{ fontSize: ".82rem", fontWeight: 700, color: "#5a3f12" }}>{drive.season}</span>
                  </div>
                )}
              </div>
              {road && road.alerts && road.alerts.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #efe8d8", display: "flex", flexDirection: "column", gap: 8 }}>
                  {road.alerts.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ fontSize: ".82rem", color: "#525a46", lineHeight: 1.5 }}>
                      <b style={{ color: a.category === "Park Closure" ? "#9c3f2c" : a.category === "Danger" || a.category === "Caution" ? "#8a6a2f" : "#1d6b3f" }}>{a.title}</b>
                      {a.description ? " — " + a.description : ""}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: ".76rem", color: "#8c8473", marginTop: 12 }}>
                {road && road.alerts ? "Live from the National Park Service. " : ""}Always confirm on the official page before you go. <a href={drive.link} target="_blank" rel="noreferrer" style={{ color: "#2c5562", fontWeight: 700, textDecoration: "none" }}>Official road status ↗</a>
              </div>
            </div>
          </div>
        </section>

        {/* INTRINSIC QUALITIES */}
        <section style={{ padding: "clamp(24px,3.5vh,40px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#8c8473" }}>Designated for its</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {(drive.qualities || []).map((q, i) => {
                const m = QUAL_META[q] || { ic: "◈", d: "" };
                return (
                  <span key={q} className="sd-anim" style={{ animation: "sd-chip .5s " + (0.05 + i * 0.08) + "s both", display: "inline-flex", alignItems: "center", gap: 11, background: "#fffdf7", border: "1px solid #e7ddca", borderRadius: 16, padding: "11px 16px 11px 13px", boxShadow: "0 14px 34px -22px rgba(28,46,34,.4)" }}>
                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 11, background: "linear-gradient(145deg,#f3e3bd,#e4be78)", color: "#5a3f12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{m.ic}</span>
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}><b style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.02rem", color: "#1d4a37" }}>{q}</b><span style={{ fontSize: ".72rem", color: "#8c8473" }}>{m.d}</span></span>
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        {/* THE DRIVE */}
        <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 8 }}>
            <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.5rem,3.4vw,2.1rem)", color: "#163a2b", lineHeight: 1.1 }}>The drive</h2>
            <p style={{ fontSize: "clamp(1rem,1.5vw,1.12rem)", color: "#3f4a3c", lineHeight: 1.72 }}>{drive.blurb}</p>
          </div>
        </section>

        {/* ROUTE MAP */}
        <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "#163a2b" }}>The route</h2>
              <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#8c8473" }}>Hover an overlook ↔ its map marker</span>
            </div>
            <figure style={{ position: "relative", margin: "14px 0 0", height: "clamp(300px,44vh,460px)", overflow: "hidden", borderRadius: 24, border: "1px solid #e7ddca", background: "#0e2318" }}>
              <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
              {drive.mapCap && <figcaption style={{ position: "absolute", left: 14, bottom: 14, zIndex: 3, background: "rgba(21,36,28,.82)", color: "#f3ede0", fontSize: ".72rem", fontWeight: 700, borderRadius: 999, padding: "6px 14px", pointerEvents: "none" }}>{drive.mapCap}</figcaption>}
            </figure>
          </div>
        </section>

        {/* FILMSTRIP */}
        {film.length > 0 && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "#163a2b" }}>Along the drive</h2>
                <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#8c8473" }}>Auto-advancing · tap the dots</span>
              </div>
              <div style={{ marginTop: 14, position: "relative", borderRadius: 24, overflow: "hidden", border: "1px solid #e7ddca", background: "#0e2318", boxShadow: "0 30px 70px -40px rgba(8,18,12,.7)" }}>
                <div style={{ display: "flex", transition: "transform .7s cubic-bezier(.4,0,.15,1)", transform: "translateX(-" + filmIdx * 100 + "%)" }}>
                  {film.map((f, i) => (
                    <figure key={i} style={{ flex: "0 0 100%", margin: 0, position: "relative", aspectRatio: "16/9", background: "repeating-linear-gradient(135deg,#16321f 0 14px,#12291a 14px 28px)", overflow: "hidden" }}>
                      {f.url && <img src={f.url} alt={f.cap || ""} loading={i <= 1 ? "eager" : "lazy"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                    </figure>
                  ))}
                </div>
                <button onClick={() => setFilmIdx((i) => (i - 1 + film.length) % film.length)} aria-label="Previous" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 4, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", background: "rgba(15,32,24,.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#fbf6ea", fontSize: "1.1rem", cursor: "pointer" }}>‹</button>
                <button onClick={() => setFilmIdx((i) => (i + 1) % film.length)} aria-label="Next" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 4, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", background: "rgba(15,32,24,.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#fbf6ea", fontSize: "1.1rem", cursor: "pointer" }}>›</button>
                {film[filmIdx] && (film[filmIdx].cap || film[filmIdx].date) && (
                  <div style={{ position: "absolute", left: 16, bottom: 14, zIndex: 4, background: "rgba(21,36,28,.82)", color: "#f3ede0", fontSize: ".72rem", fontWeight: 700, borderRadius: 999, padding: "6px 14px" }}>{(filmIdx + 1) + " / " + film.length}{film[filmIdx].cap ? " · " + film[filmIdx].cap : ""}{film[filmIdx].date ? " · " + film[filmIdx].date : ""}</div>
                )}
                <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 4, display: "flex", gap: 6 }}>
                  {film.map((_, i) => <span key={i} onClick={() => setFilmIdx(i)} style={{ width: 8, height: 8, borderRadius: "50%", background: i === filmIdx ? "#e4be78" : "rgba(251,246,234,.4)", cursor: "pointer" }} />)}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HIGHLIGHTS */}
        {hl.length > 0 && (
          <section style={{ padding: "clamp(28px,4vh,44px) clamp(16px,4vw,40px) 6px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "#163a2b" }}>Highlights along the way</h2>
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
                <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "clamp(1.4rem,3vw,1.9rem)", color: "#163a2b" }}>Parks &amp; trails on this route</h2>
                <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#8c8473" }}>Cross-links into ParkBuddy</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
                {cross.map((c, i) => <CrossTile key={i} c={c} />)}
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
                  <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(243,237,224,.6)" }}>Plan this drive</div>
                  <h2 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(1.5rem,3vw,2.1rem)", color: "#fbf6ea", marginTop: 8, lineHeight: 1.08 }}>Time it for the open season</h2>
                  <p style={{ fontSize: ".95rem", color: "rgba(243,237,224,.85)", lineHeight: 1.65, marginTop: 10, maxWidth: "52ch" }}>{drive.planNote || ("Best driven " + (drive.season || "in the warm months") + " — check the official page for current road status and any seasonal closures before you go.")}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "rgba(251,246,234,.08)", border: "1px solid rgba(251,246,234,.16)", borderRadius: 16, padding: "14px 16px" }}>
                    <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(243,237,224,.55)" }}>Best season</div>
                    <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.3rem", color: "#fbf6ea", marginTop: 4 }}>{drive.season || "Warm months"}</div>
                  </div>
                  <a href={drive.link} target="_blank" rel="noreferrer" style={{ textAlign: "center", textDecoration: "none", fontFamily: "inherit", fontSize: ".84rem", fontWeight: 800, color: "#163a2b", background: "linear-gradient(120deg,#e4be78,#c79a4b)", padding: "11px 18px", borderRadius: 999 }}>Official byway page ↗</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer style={{ textAlign: "center", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#8c8473", padding: 22, borderTop: "1px solid #e7ddca" }}>Designation &amp; qualities from federal byway records · Photos via Wikimedia · Road status via NPS · ParkBuddy</footer>
      </div>
    </div>
  );
}

function HighlightCard({ h, i, active, onHover }) {
  const photo = usePhoto(Array.isArray(h.q) ? h.q.join("|") : h.q || h.n, h.lat, h.lng);
  return (
    <div onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)} style={{ background: "#fffdf7", border: "1px solid " + (active ? "#e4be78" : "#e7ddca"), borderRadius: 20, overflow: "hidden", boxShadow: active ? "0 24px 50px -22px rgba(28,46,34,.6)" : "0 18px 44px -24px rgba(28,46,34,.4)", transform: active ? "translateY(-4px)" : "none", transition: "transform .25s,box-shadow .25s,border-color .25s" }}>
      <figure style={{ position: "relative", aspectRatio: "4/3", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,#ece5d4 0 12px,#e6dfcd 12px 24px)" }}>
        {photo && photo.url && <img src={photo.url} alt={h.n} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <span style={{ position: "absolute", left: 10, top: 10, width: 26, height: 26, borderRadius: "50%", background: "rgba(21,36,28,.82)", color: "#e4be78", fontFamily: mono, fontSize: ".72rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
      </figure>
      <div style={{ padding: "13px 15px 15px" }}>
        <b style={{ fontFamily: serif, fontWeight: 700, color: "#1d4a37", fontSize: "1.05rem", lineHeight: 1.15, display: "block" }}>{h.n}</b>
        <div style={{ fontSize: ".8rem", color: "#525a46", lineHeight: 1.5, marginTop: 5 }}>{h.d}</div>
      </div>
    </div>
  );
}
