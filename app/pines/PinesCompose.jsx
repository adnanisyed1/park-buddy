"use client";

// Post a photo Pine. Pick/take a photo → we read its EXIF GPS and SUGGEST the nearest
// real place (from our parks + forests datasets); the user confirms or taps "Change"
// and SELECTS the real location from a searchable list — never free-typed. This keeps
// place tags honest (only places we actually model) and links place_type/place_id so
// Pines surface on the right park pages. Downscales on-device → /api/pines/photo →
// moderation. Portaled to <body>, on the design system.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import exifr from "exifr";
import { getAccessToken } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const field = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 11, padding: "12px 13px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".92rem", outline: "none" };
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };

function miles(a, b, c, d) {
  const R = 3958.8, t = (x) => (x * Math.PI) / 180;
  const dLat = t(c - a), dLng = t(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Downscale to <=1440px longest edge → JPEG data URL (also strips EXIF for privacy;
// we've already pulled the GPS we need before this).
function downscale(file, max = 1440, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function PinesCompose({ open, onClose, onPosted }) {
  const [places, setPlaces] = useState([]);       // real parks + forests
  const [dataUrl, setDataUrl] = useState("");
  const [gps, setGps] = useState(null);            // {lat,lng} from EXIF
  const [capturedAt, setCapturedAt] = useState("");
  const [place, setPlace] = useState(null);        // selected {type,id,name,short,state,lat,lng}
  const [detected, setDetected] = useState(false); // place came from photo GPS
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  // Load the real place list once (parks + national forests).
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [pTxt, fTxt] = await Promise.all([
          fetch("/trip-data.js").then((r) => r.text()).catch(() => ""),
          fetch("/forest-data.js").then((r) => r.text()).catch(() => ""),
        ]);
        const pm = pTxt.match(/window\.TRIP_PARKS\s*=\s*(\[.*?\]);/);
        const fm = fTxt.match(/window\.FOREST_DATA\s*=\s*(\[[\s\S]*?\]);/);
        const parks = pm ? JSON.parse(pm[1]).map((p) => ({ type: "park", id: String(p.id), name: p.name + " National Park", short: p.name, state: p.state, lat: p.lat, lng: p.lng })) : [];
        const forests = fm ? JSON.parse(fm[1]).map((f) => ({ type: "forest", id: slug(f.name), name: f.name, short: f.name, state: f.state, lat: f.lat, lng: f.lng })) : [];
        if (on) setPlaces([...parks, ...forests]);
      } catch {}
    })();
    return () => { on = false; };
  }, []);

  // When a photo's GPS + the place list are both available, suggest the nearest place.
  useEffect(() => {
    if (!gps || !places.length) return;
    let best = null, bd = 1e9;
    for (const pl of places) { if (pl.lat == null) continue; const d = miles(gps.lat, gps.lng, pl.lat, pl.lng); if (d < bd) { bd = d; best = pl; } }
    if (best && bd < 120) { setPlace(best); setDetected(true); }
  }, [gps, places.length]); // eslint-disable-line

  if (!open) return null;

  const reset = () => { setDataUrl(""); setGps(null); setCapturedAt(""); setPlace(null); setDetected(false); setQuery(""); setCaption(""); setErr(""); setDone(false); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr(""); setPlace(null); setDetected(false); setGps(null);
    try {
      const [g, meta] = await Promise.all([
        exifr.gps(file).catch(() => null),
        exifr.parse(file, ["DateTimeOriginal"]).catch(() => null),
      ]);
      if (g && isFinite(g.latitude) && isFinite(g.longitude)) setGps({ lat: g.latitude, lng: g.longitude });
      if (meta && meta.DateTimeOriginal) { try { setCapturedAt(new Date(meta.DateTimeOriginal).toISOString()); } catch {} }
      setDataUrl(await downscale(file));
    } catch { setErr("Couldn't read that image — try another."); }
  };

  const submit = async () => {
    setErr("");
    if (!dataUrl) { setErr("Add a photo first."); return; }
    if (!place) { setErr("Select the location for this Adventure."); return; }
    setBusy(true);
    try {
      const t = await getAccessToken();
      if (!t) { setErr("Sign in to post."); setBusy(false); return; }
      const body = {
        imageBase64: dataUrl,
        caption: caption.trim() || "Adventure",
        place_type: place.type, place_id: place.id, place_name: place.name,
        location_source: gps && detected ? "photo" : "manual",
        captured_at: capturedAt || undefined,
        lat: gps ? gps.lat : place.lat, lng: gps ? gps.lng : place.lng,
      };
      const r = await fetch("/api/pines/photo", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setDone(true); if (onPosted) onPosted(); }
      else setErr(d.error || "Couldn't post your Pine.");
    } catch { setErr("Couldn't post your Pine."); }
    setBusy(false);
  };

  const filtered = query.trim()
    ? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()) || (p.short || "").toLowerCase().includes(query.trim().toLowerCase())).slice(0, 24)
    : [];

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(4,7,5,.72)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(16px,6vh,80px) 16px", overflowY: "auto", fontFamily: "var(--pb-sans)" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--pb-bg)", border: "1px solid var(--pb-line-strong)", borderRadius: 16, boxShadow: "var(--pb-shadow)", padding: "clamp(20px,4vw,26px)", position: "relative" }}>
        <button onClick={close} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, cursor: "pointer", width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink-2)", fontSize: "1rem" }}>×</button>

        {done ? (
          <div style={{ textAlign: "center", padding: "16px 4px" }}>
            <div style={{ fontSize: "2rem" }}>🌲</div>
            <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", margin: "8px 0 6px", color: "var(--pb-ink)" }}>Pinned — in review</h3>
            <p style={{ color: "var(--pb-ink-2)", fontSize: ".92rem", lineHeight: 1.55 }}>Your Adventure is up for a quick safety check. You'll find it under <b style={{ color: "var(--pb-ink)" }}>Mine</b>, and it goes live once approved.</p>
            <button onClick={close} style={{ ...goldBtn(), marginTop: 16, width: "auto", padding: "11px 22px" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ ...micro, color: "var(--pb-gold-soft)" }}>Post a Pine</div>
            <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.55rem", margin: "4px 0 16px", color: "var(--pb-ink)" }}>Share an Adventure</h3>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: "none" }} />
            {dataUrl ? (
              <button onClick={() => fileRef.current && fileRef.current.click()} style={{ width: "100%", border: "1px solid var(--pb-line)", borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "#000", padding: 0, display: "block" }}>
                <img src={dataUrl} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
              </button>
            ) : (
              <button onClick={() => fileRef.current && fileRef.current.click()} style={{ width: "100%", minHeight: 160, border: "1px dashed var(--pb-line-strong)", borderRadius: 12, cursor: "pointer", background: "rgba(255,255,255,.03)", color: "var(--pb-ink-2)", fontFamily: "inherit", fontSize: ".92rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: "1.8rem" }}>📷</span>Take or choose a photo
              </button>
            )}

            {/* LOCATION — selected place chip, or a searchable picker of real places */}
            {dataUrl && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...micro, marginBottom: 7 }}>Location</div>
                {place ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.04)", border: "1px solid " + (detected ? "rgba(79,217,138,.4)" : "var(--pb-line-strong)"), borderRadius: 11, padding: "10px 12px" }}>
                    <span style={{ fontSize: "1rem" }}>📍</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: ".92rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</div>
                      <div style={{ fontSize: ".7rem", color: detected ? "var(--pb-go,#4fd98a)" : "var(--pb-muted)", marginTop: 1 }}>{detected ? "Detected from photo — tap Change if it's wrong" : (place.type === "forest" ? "National Forest" : "National Park") + (place.state ? " · " + place.state : "")}</div>
                    </div>
                    <button onClick={() => { setPlace(null); setDetected(false); setQuery(""); }} style={{ cursor: "pointer", flex: "none", fontFamily: "inherit", fontSize: ".74rem", fontWeight: 600, color: "var(--pb-ink)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "6px 12px" }}>Change</button>
                  </div>
                ) : (
                  <div>
                    <input style={field} placeholder="Search a park or forest…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
                    {query.trim() && (
                      <div style={{ marginTop: 6, maxHeight: 190, overflowY: "auto", border: "1px solid var(--pb-line)", borderRadius: 11, background: "var(--pb-surface)" }}>
                        {filtered.length ? filtered.map((pl) => (
                          <button key={pl.type + pl.id} onClick={() => { setPlace(pl); setDetected(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", cursor: "pointer", background: "none", border: "none", borderBottom: "1px solid var(--pb-line)", padding: "10px 12px" }}>
                            <span style={{ fontSize: ".88rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span>
                            <span style={{ ...micro, fontSize: ".5rem", flex: "none", color: "var(--pb-gold-soft)" }}>{pl.type === "forest" ? "Forest" : "Park"}{pl.state ? " · " + pl.state : ""}</span>
                          </button>
                        )) : <div style={{ padding: "12px", color: "var(--pb-muted)", fontSize: ".84rem", lineHeight: 1.5 }}>No match — only real parks &amp; forests can be tagged{places.length ? "." : " (loading places…)"}</div>}
                      </div>
                    )}
                    {gps && <div style={{ ...micro, letterSpacing: ".04em", textTransform: "none", color: "var(--pb-muted)", marginTop: 7 }}>This photo has GPS but isn't near a park we recognize — pick the closest real place.</div>}
                  </div>
                )}
                <input style={{ ...field, marginTop: 10 }} placeholder="Caption — Adventure" value={caption} onChange={(e) => setCaption(e.target.value)} />
              </div>
            )}

            {err && <div style={{ color: "var(--pb-hold)", fontSize: ".82rem", marginTop: 10 }}>{err}</div>}

            <button onClick={submit} disabled={busy} style={{ ...goldBtn(), marginTop: 16 }}>{busy ? "Posting…" : "Post Pine →"}</button>
            <div style={{ ...micro, letterSpacing: ".06em", textTransform: "none", color: "var(--pb-muted)", marginTop: 12, lineHeight: 1.5 }}>Photos are reviewed before they go live. Real, on-site shots only — no stock.</div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function goldBtn() { return { cursor: "pointer", width: "100%", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".92rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "13px 18px" }; }
