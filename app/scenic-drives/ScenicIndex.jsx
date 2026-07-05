"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePhoto } from "../components/PhotoThumb";

// /scenic-drives index — scroll-animated grid of America's Byways tiles with
// designation + region filter chips. Ported 1:1 from the Claude-design spec;
// data is real federal byway records, photos via our shared pipeline, tiles
// link internally to /scenic-drives/<id> (route param, not localStorage).

const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

function DriveTile({ d }) {
  const tileRef = useRef(null);
  const photo = usePhoto([...(d.wiki || []), d.name].join("|"), d.lat, d.lng, tileRef);
  const bm = d.tier === "all-american"
    ? { bg: "linear-gradient(135deg,#f0d38a,#c79a4b)", ink: "#4a3410", label: "All-American Road" }
    : d.tier === "landmark"
    ? { bg: "linear-gradient(135deg,#d9b38a,#a9764a)", ink: "#3f2a12", label: "National Historic Landmark" }
    : { bg: "linear-gradient(135deg,#e6e8ea,#a9b0b6)", ink: "#2c3338", label: "National Scenic Byway" };
  const bg = bm.bg, ink = bm.ink, badge = bm.label;
  return (
    <Link ref={tileRef} href={"/scenic-drives/" + d.id} style={{ display: "block", textDecoration: "none", cursor: "pointer", background: "#12291a", border: "1px solid rgba(251,246,234,.12)", borderRadius: 22, overflow: "hidden", boxShadow: "0 26px 60px -40px rgba(0,0,0,.9)" }}>
      <figure style={{ position: "relative", aspectRatio: "16/10", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,#16321f 0 14px,#12291a 14px 28px)" }}>
        {photo && photo.url && <img src={photo.url} alt={d.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.15) 40%,rgba(9,24,16,.8) 100%)" }} />
        <div style={{ position: "absolute", left: 12, top: 12, display: "inline-flex", alignItems: "center", gap: 7, background: bg, borderRadius: 12, padding: "6px 11px", boxShadow: "0 10px 26px -12px rgba(0,0,0,.7)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={ink} style={{ flex: "none" }}><path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5L2.6 8.8l6.5-.9z" /></svg>
          <b style={{ fontFamily: serif, fontWeight: 800, fontSize: ".74rem", color: ink }}>{badge}</b>
        </div>
        {d.length && <div style={{ position: "absolute", right: 12, top: 12, background: "rgba(15,32,23,.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(251,246,234,.2)", borderRadius: 999, padding: "5px 11px", fontFamily: mono, fontSize: ".62rem", fontWeight: 700, color: "#f3ede0" }}>{d.length}</div>}
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#e4be78" }}>{d.regionLabel} · {d.states}</div>
          <b style={{ display: "block", fontFamily: serif, fontWeight: 700, color: "#fbf6ea", fontSize: "1.5rem", lineHeight: 1.08, marginTop: 3, textShadow: "0 2px 14px rgba(0,0,0,.5)" }}>{d.name}</b>
        </div>
      </figure>
      <div style={{ padding: "13px 16px 16px" }}>
        <div style={{ fontSize: ".82rem", color: "#b8b19b", lineHeight: 1.4 }}>{d.sub}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
          {(d.qualities || []).slice(0, 4).map((ql) => (
            <span key={ql} style={{ fontFamily: mono, fontSize: ".56rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#b8b19b", border: "1px solid rgba(251,246,234,.18)", borderRadius: 999, padding: "3px 8px" }}>{ql}</span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(251,246,234,.1)" }}>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#8a8471" }}>Explore the drive</span>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(120deg,#e4be78,#c79a4b)", color: "#15241c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", fontWeight: 800 }}>→</span>
        </div>
      </div>
    </Link>
  );
}

export default function ScenicIndex({ drives }) {
  const [fTier, setFTier] = useState("all");
  const [fRegion, setFRegion] = useState("all");
  const regions = useMemo(() => {
    const seen = [];
    drives.forEach((d) => { if (d.region && !seen.find((r) => r[0] === d.region)) seen.push([d.region, d.regionLabel ? d.region : d.region]); });
    return [["all", "All regions"], ...seen.map((r) => [r[0], r[0]])];
  }, [drives]);
  const aarCount = drives.filter((d) => d.tier === "all-american").length;

  const list = drives.filter((d) => {
    if (fTier === "all-american" && d.tier !== "all-american") return false;
    if (fTier === "byway" && d.tier === "all-american") return false;
    if (fRegion !== "all" && d.region !== fRegion) return false;
    return true;
  });

  const chip = (active, label, onClick, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".74rem", fontWeight: 700, borderRadius: 999, padding: "7px 13px", border: "1px solid " + (active ? "transparent" : "rgba(251,246,234,.22)"), background: active ? "linear-gradient(120deg,#e4be78,#c79a4b)" : "transparent", color: active ? "#15241c" : "#d8d2c2" }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f2017", color: "#f3ede0", fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px clamp(16px,4vw,40px)", borderBottom: "1px solid rgba(251,246,234,.12)" }}>
        <Link href="/explore" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#b8b19b", fontSize: ".84rem", fontWeight: 700 }}>← <span>Explore</span></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: "linear-gradient(145deg,#e4be78,#c79a4b)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="#15241c"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg></span>
          <b style={{ fontFamily: serif, fontSize: "1rem" }}>ParkBuddy</b>
          <span style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#b8b19b", border: "1px solid rgba(251,246,234,.2)", borderRadius: 999, padding: "3px 9px" }}>/scenic-drives</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mono, fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#e4be78" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#e4be78" }} />Federal byways</span>
      </header>

      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(40px,8vh,84px) clamp(16px,4vw,40px) clamp(28px,5vh,52px)", background: "radial-gradient(1100px 420px at 72% -12%,rgba(228,190,120,.14),transparent 62%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontFamily: mono, fontSize: ".66rem", letterSpacing: ".24em", textTransform: "uppercase", color: "#b8b19b" }}>America&apos;s Byways · curated for ParkBuddy</div>
          <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.7rem,7vw,4.9rem)", lineHeight: 1.02, letterSpacing: "-.02em", marginTop: 14, maxWidth: 900 }}>The <em style={{ fontStyle: "italic", color: "#e4be78" }}>scenic drive</em> index.</h1>
          <p style={{ fontSize: "1.02rem", color: "#b8b19b", lineHeight: 1.6, maxWidth: 600, marginTop: 14 }}>The roads that are destinations in themselves — federally designated for their scenery, nature, and history. Every drive links to the parks, trails, and overlooks along its route.</p>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 30, borderTop: "1px solid rgba(251,246,234,.14)" }}>
            <div style={{ padding: "18px 30px 4px 0" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1 }}>{drives.length}</div><div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#8a8471", marginTop: 5 }}>Drives</div></div>
            <div style={{ padding: "18px 30px 4px", borderLeft: "1px solid rgba(251,246,234,.14)" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1 }}>{aarCount}</div><div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#8a8471", marginTop: 5 }}>All-American</div></div>
          </div>
        </div>
      </section>

      <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(15,32,23,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid rgba(251,246,234,.12)", borderBottom: "1px solid rgba(251,246,234,.12)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", padding: "12px clamp(16px,4vw,40px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#8a8471" }}>Designation</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["all", "All"], ["all-american", "All-American Roads"], ["byway", "National Scenic Byways"]].map((t) => chip(fTier === t[0], t[1], () => setFTier(t[0]), t[0]))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#8a8471" }}>Region</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {regions.map((t) => chip(fRegion === t[0], t[1], () => setFRegion(t[0]), t[0]))}
            </div>
          </div>
          <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#b8b19b" }}>{list.length} of {drives.length} drives</span>
        </div>
      </div>

      <section style={{ padding: "clamp(22px,4vh,40px) clamp(16px,4vw,40px) 44px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {list.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
              {list.map((d) => <DriveTile key={d.id} d={d} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#8a8471" }}>
              <div style={{ fontFamily: serif, fontSize: "1.4rem", color: "#b8b19b" }}>No drives match these filters</div>
              <div style={{ fontSize: ".85rem", marginTop: 6 }}>Try widening the designation or region.</div>
            </div>
          )}
        </div>
      </section>

      <footer style={{ textAlign: "center", fontFamily: mono, fontSize: ".62rem", letterSpacing: ".12em", textTransform: "uppercase", color: "#8a8471", padding: 22, borderTop: "1px solid rgba(251,246,234,.12)" }}>Designation &amp; length from federal byway records · Photos via Wikimedia · ParkBuddy</footer>
    </div>
  );
}
