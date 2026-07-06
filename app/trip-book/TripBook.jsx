"use client";

// /trip-book — an on-screen PREVIEW of the keepsake book made from a trip. Cream
// "book paper" pages: a cover, then a page per stop with the photos captured in Trip
// Mode and a story the traveller writes. This is the vision — a honeymoon in Utah, a
// first solo overland run of Black Bear Pass — turned into something to keep. No
// ordering yet (that needs a print-on-demand partner + payment); the "make it real"
// button just registers interest for now.

import { useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import loadScript from "../components/load-script";
import { getStops, getMeta } from "../lib/trip";
import { getPhotosFor, addPhoto, removePhoto, fileToDataUrl, getStory, setStory, subscribeTripMode, photoCount } from "../lib/tripmode";

const serif = "var(--pb-serif), 'Spectral', Georgia, serif";
const sans = "var(--pb-sans), 'Hanken Grotesk', system-ui, sans-serif";

const fmtDate = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch { return iso; } };

export default function TripBook() {
  const [stops, setStops] = useState([]);
  const [meta, setMeta] = useState({});
  const [ready, setReady] = useState(false);
  const [heroPhoto, setHeroPhoto] = useState(null); // park photo fallback for the cover
  const [, force] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      const raw = getStops();
      const m = getMeta();
      const coord = {};
      try { await loadScript("/trip-data.js"); (window.TRIP_PARKS || []).forEach((p) => { if (p && p.name) coord[p.name] = { lat: p.lat, lng: p.lng, state: p.state }; }); } catch {}
      try { const fd = await fetch("/national-forests.json").then((r) => (r.ok ? r.json() : null)).catch(() => null); ((fd && fd.forests) || []).forEach((f) => { if (f && f.name) coord[f.name] = { lat: f.lat, lng: f.lng, state: f.state }; }); } catch {}
      const resolved = raw.map((s) => { const c = s.lat != null ? s : coord[s.name]; return { name: s.name, state: s.state || (c ? c.state : "") || "", custom: !!s.custom }; });
      if (!on) return;
      setStops(resolved); setMeta(m); setReady(true);
      // cover fallback image — first stop's park photo
      if (resolved[0]) {
        fetch("/api/photo?q=" + encodeURIComponent(resolved[0].name + (resolved[0].custom ? "" : " National Park") + "|" + resolved[0].name) + "&w=1600&v=6").then((r) => (r.ok ? r.json() : null)).then((d) => { if (on && d && d.found) setHeroPhoto(d.thumb || d.image); }).catch(() => {});
      }
    })();
    return () => { on = false; };
  }, []);

  useEffect(() => subscribeTripMode(() => force((n) => n + 1)), []);

  const firstCaptured = (() => { for (const s of stops) { const ph = getPhotosFor(s.name); if (ph.length) return ph[0].url; } return null; })();
  const coverImg = firstCaptured || heroPhoto;
  const totalNights = 0; // display uses meta

  const page = { background: "#fbf7ee", color: "#241f16", borderRadius: 6, boxShadow: "0 30px 70px -40px rgba(0,0,0,.7), 0 1px 0 rgba(0,0,0,.05)", overflow: "hidden", border: "1px solid #e7ddc7" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: sans }}>
      <SiteHeader acctSlot />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(80px,12vh,120px) clamp(14px,4vw,24px) 70px" }}>

        {/* intro / actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".58rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-gold)" }}>Preview · your keepsake</div>
            <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.7rem,4.5vw,2.4rem)", margin: "4px 0 0" }}>The Trip Book</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/trip-mode" style={{ textDecoration: "none", fontSize: ".84rem", fontWeight: 700, color: "#e7e3d8", background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "10px 18px" }}>📸 Add photos in Trip Mode</a>
            <button onClick={() => { try { localStorage.setItem("pb_book_interest", JSON.stringify({ at: new Date().toISOString(), trip: meta.tripName || "" })); } catch {}; alert("Thanks — we’ve noted you’d love a printed copy. We’ll email you when the press is ready."); }} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".84rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "10px 18px" }}>I&apos;d print this →</button>
          </div>
        </div>
        <p style={{ color: "var(--pb-ink-2)", fontSize: ".92rem", lineHeight: 1.6, margin: "0 0 24px", maxWidth: "60ch" }}>
          A page for every stop, with the photos you snap in Trip Mode and the story you write along the way. This is a live preview — printing &amp; binding come next.
        </p>

        {!ready ? (
          <div style={{ textAlign: "center", color: "var(--pb-muted)", padding: "40px 0" }}>Assembling your book…</div>
        ) : stops.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--pb-muted)", padding: "40px 0" }}>Your trip is empty. <a href="/build-trip" style={{ color: "var(--pb-gold)" }}>Build it first →</a></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {/* COVER */}
            <div style={{ ...page, position: "relative", minHeight: 420, display: "flex", alignItems: "flex-end", color: "#fff" }}>
              {coverImg ? <img src={coverImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#33555f,#1d3941)" }} />}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,16,12,.15) 30%,rgba(8,16,12,.82))" }} />
              <div style={{ position: "relative", padding: "clamp(22px,5vw,40px)" }}>
                <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".24em", textTransform: "uppercase", color: "#e4be78" }}>A Park Buddy keepsake</div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2rem,6vw,3.2rem)", lineHeight: 1.02, marginTop: 8, textShadow: "0 3px 24px rgba(0,0,0,.5)" }}>{meta.tripName || "Our trip"}</div>
                <div style={{ fontSize: ".95rem", marginTop: 10, color: "rgba(255,255,255,.85)" }}>
                  {meta.startDate ? fmtDate(meta.startDate) : ""}{meta.endDate ? " – " + fmtDate(meta.endDate) : ""} · {stops.length} stop{stops.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {/* STOP PAGES */}
            {stops.map((s, i) => <BookPage key={s.name} s={s} index={i} />)}

            {/* CLOSING */}
            <div style={{ ...page, padding: "clamp(26px,5vw,44px)", textAlign: "center" }}>
              <div style={{ fontFamily: serif, fontSize: "1.5rem", fontWeight: 600 }}>The end — for now.</div>
              <p style={{ color: "#6a6146", fontSize: ".92rem", lineHeight: 1.6, maxWidth: "48ch", margin: "10px auto 0" }}>
                {photoCount() ? photoCount() + " photos and counting. " : ""}Keep adding moments in Trip Mode — every stop, every perfect snap, becomes a page you&apos;ll keep for life.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookPage({ s, index }) {
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const storyRef = useRef(null);
  const photos = getPhotosFor(s.name);
  const story = getStory()[s.name] || "";
  const page = { background: "#fbf7ee", color: "#241f16", borderRadius: 6, boxShadow: "0 30px 70px -40px rgba(0,0,0,.7)", border: "1px solid #e7ddc7", overflow: "hidden" };

  async function onFile(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return; setBusy(true);
    try { const url = await fileToDataUrl(file); addPhoto(s.name, { url }); } catch {}
    setBusy(false);
  }

  return (
    <div style={{ ...page, padding: "clamp(20px,4vw,34px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: serif, fontSize: "2.4rem", fontWeight: 700, color: "#c79a4b", lineHeight: 1 }}>{index + 1}</span>
        <div>
          <div style={{ fontFamily: serif, fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.1 }}>{s.name}</div>
          {s.state && <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#a2986f", marginTop: 3 }}>{s.state}</div>}
        </div>
      </div>

      {/* photo collage */}
      <div style={{ display: "grid", gridTemplateColumns: photos.length ? "repeat(auto-fill,minmax(120px,1fr))" : "1fr", gap: 8, marginTop: 16 }}>
        {photos.map((p) => (
          <span key={p.id} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 4, overflow: "hidden", border: "3px solid #fff", boxShadow: "0 6px 16px -8px rgba(0,0,0,.4)" }}>
            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => { removePhoto(s.name, p.id); force((n) => n + 1); }} title="Remove" style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(8,16,12,.7)", color: "#fff", fontSize: ".8rem", cursor: "pointer", lineHeight: 1 }}>×</button>
          </span>
        ))}
        {!photos.length && (
          <label style={{ cursor: "pointer", aspectRatio: "16/6", borderRadius: 6, border: "2px dashed #d8ccae", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#a2986f", fontSize: ".85rem", fontWeight: 600, background: "#f6f0e2" }}>
            <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
            📷 {busy ? "Saving…" : "Add a photo from this stop"}
          </label>
        )}
      </div>
      {photos.length > 0 && (
        <label style={{ display: "inline-flex", cursor: "pointer", marginTop: 10, alignItems: "center", gap: 6, fontSize: ".74rem", fontWeight: 700, color: "#c79a4b" }}>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />+ add another photo
        </label>
      )}

      {/* story */}
      <textarea
        ref={storyRef}
        defaultValue={story}
        onBlur={(e) => setStory(s.name, e.target.value)}
        placeholder={"Write the story of " + s.name + " — what you saw, how it felt, the moment you want to remember…"}
        style={{ width: "100%", marginTop: 16, minHeight: 96, resize: "vertical", boxSizing: "border-box", background: "transparent", border: "none", borderTop: "1px solid #e7ddc7", paddingTop: 14, fontFamily: serif, fontSize: "1.02rem", lineHeight: 1.65, color: "#3a3122", outline: "none" }}
      />
    </div>
  );
}
