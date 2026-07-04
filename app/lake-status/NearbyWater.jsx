"use client";

// Photo cards for "More water nearby" on /lake-status — same per-tile photo
// resolution + localStorage cache as the explore/nearby tiles.
const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Photo resolution + cache live in the shared hook (PhotoThumb.jsx, v3 cache
// with the v=2 cache-buster) — one pipeline for every tile and thumbnail.
import { usePhoto } from "../components/PhotoThumb";

function Tile({ it }) {
  const photo = usePhoto(it.q, it.lat, it.lng);
  const url = photo ? photo.url : null;
  return (
    <a href={it.href} style={{ display: "block", textDecoration: "none", background: "#fffdf7", border: "1px solid #e7ddca", borderRadius: 20, overflow: "hidden", boxShadow: "0 18px 44px -22px rgba(28,46,34,.35)", color: "#1d4a37" }}>
      <figure style={{ position: "relative", aspectRatio: "16/9", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,#ece5d4 0 12px,#e6dfcd 12px 24px)" }}>
        {url && <img src={url} alt={it.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {it.badge && <span style={{ position: "absolute", left: 10, top: 10, background: "rgba(21,36,28,.82)", color: "#f3ede0", fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".1em", borderRadius: 999, padding: "3px 9px" }}>{it.badge}</span>}
        {photo && photo.geo && (
          <span style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(21,36,28,.75)", color: "rgba(243,237,224,.85)", fontFamily: mono, fontSize: ".52rem", fontWeight: 700, letterSpacing: ".06em", borderRadius: 999, padding: "2px 7px" }}>
            {photo.date ? "NEARBY · " + photo.date.toUpperCase() : "NEARBY PHOTO"}
          </span>
        )}
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
      {/* Name-keyed so list changes remount tiles rather than reusing one with stale photo state. */}
      {items.map((it) => <Tile key={it.name} it={it} />)}
    </div>
  );
}
