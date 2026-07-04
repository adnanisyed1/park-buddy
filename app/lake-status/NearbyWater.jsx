"use client";

import { useEffect, useState } from "react";

// Photo cards for "More water nearby" on /lake-status — same per-tile photo
// resolution + localStorage cache as the explore/nearby tiles.
const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

let cache = null;
function readCache() { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem("pb_photo_cache_v2") || "{}"); } catch { cache = {}; } return cache; }
function saveCache() { try { localStorage.setItem("pb_photo_cache_v2", JSON.stringify(cache)); } catch {} }

function usePhoto(q) {
  const [url, setUrl] = useState(() => { const c = readCache(); return q in c ? c[q] || null : undefined; });
  useEffect(() => {
    if (url !== undefined) return;
    let on = true;
    fetch("/api/photo?q=" + encodeURIComponent(q)).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const u = d && d.found ? d.thumb || d.image : null;
      const c = readCache(); c[q] = u || false; saveCache();
      if (on) setUrl(u || null);
    }).catch(() => { const c = readCache(); c[q] = false; saveCache(); if (on) setUrl(null); });
    return () => { on = false; };
  }, [q, url]);
  return url;
}

function Tile({ it }) {
  const url = usePhoto(it.q);
  return (
    <a href={it.href} style={{ display: "block", textDecoration: "none", background: "#fffdf7", border: "1px solid #e7ddca", borderRadius: 20, overflow: "hidden", boxShadow: "0 18px 44px -22px rgba(28,46,34,.35)", color: "#1d4a37" }}>
      <figure style={{ position: "relative", aspectRatio: "16/9", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,#ece5d4 0 12px,#e6dfcd 12px 24px)" }}>
        {url && <img src={url} alt={it.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {it.badge && <span style={{ position: "absolute", left: 10, top: 10, background: "rgba(21,36,28,.82)", color: "#f3ede0", fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".1em", borderRadius: 999, padding: "3px 9px" }}>{it.badge}</span>}
      </figure>
      <div style={{ padding: "13px 15px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <b style={{ fontFamily: serif, fontWeight: 700, color: "#1d4a37", fontSize: "1rem" }}>{it.name}</b>
        {it.sub && <span style={{ fontFamily: mono, fontSize: ".62rem", color: "#8c8473", flex: "none" }}>{it.sub}</span>}
      </div>
    </a>
  );
}

export default function NearbyWater({ items }) {
  if (!items || !items.length) {
    return <div style={{ background: "#fffdf7", border: "1px dashed #d8d0bc", borderRadius: 16, padding: "16px 18px", fontSize: ".84rem", color: "#8c8473" }}>No other named water found nearby in the data.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 11 }}>
      {items.map((it, i) => <Tile key={i} it={it} />)}
    </div>
  );
}
