"use client";

// Post a photo Pine. Pick/take a photo → we read its EXIF GPS (auto-detect location)
// and downscale it on-device → tag a place + caption (defaults to "Adventure") → upload
// to Supabase Storage via /api/pines/photo → enters moderation. Video capture is the
// next increment (needs Cloudflare). Portaled to <body>, on the design system.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import exifr from "exifr";
import { getAccessToken } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const field = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 11, padding: "12px 13px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".92rem", outline: "none" };
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };

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
  const [dataUrl, setDataUrl] = useState("");
  const [gps, setGps] = useState(null);          // {lat,lng} from EXIF
  const [capturedAt, setCapturedAt] = useState("");
  const [place, setPlace] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  if (!open) return null;

  const reset = () => { setDataUrl(""); setGps(null); setCapturedAt(""); setPlace(""); setCaption(""); setErr(""); setDone(false); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr("");
    try {
      // Read EXIF GPS + capture time BEFORE downscaling (which strips metadata).
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
    if (!place.trim() && !gps) { setErr("Add a location, or use a photo that has one."); return; }
    setBusy(true);
    try {
      const t = await getAccessToken();
      if (!t) { setErr("Sign in to post."); setBusy(false); return; }
      const body = {
        imageBase64: dataUrl,
        caption: caption.trim() || "Adventure",
        place_name: place.trim(),
        location_source: gps ? "photo" : "manual",
        captured_at: capturedAt || undefined,
        ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
      };
      const r = await fetch("/api/pines/photo", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setDone(true); if (onPosted) onPosted(); }
      else setErr(d.error || "Couldn't post your Pine.");
    } catch { setErr("Couldn't post your Pine."); }
    setBusy(false);
  };

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

            {gps && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7, color: "var(--pb-go, #4fd98a)", fontSize: ".8rem" }}>
                <span>📍</span> Location detected from photo
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={field} placeholder={gps ? "Name this place (optional)" : "Where was this? e.g. Yosemite National Park"} value={place} onChange={(e) => setPlace(e.target.value)} />
              <input style={field} placeholder="Caption — Adventure" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>

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
