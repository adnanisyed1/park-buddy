"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePhoto } from "../components/PhotoThumb";
import SiteHeader from "../components/SiteHeader";
import { Chip } from "../components/ui";

// /parks index — grid of all 63 national parks on the design system (tokens + UI
// kit + shared header), mirroring the Scenic Drives template. Parks are point
// features with strong name matches, so photos use name candidates + coords.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const REGION_LABEL = { alaska: "Alaska", lower48: "Lower 48", hawaii: "Hawaii", territory: "Territories", pacific: "Pacific", west: "West", southwest: "Southwest", rockies: "Rockies", midwest: "Midwest", plains: "Plains", south: "South", east: "East" };

function ParkTile({ p }) {
  const ref = useRef(null);
  const photo = usePhoto([p.name + " National Park", p.name].join("|"), p.lat, p.lng, ref);
  return (
    <Link ref={ref} href={"/parks/" + p.id} prefetch={false}
      style={{ display: "block", textDecoration: "none", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 22, overflow: "hidden", boxShadow: "0 26px 60px -40px rgba(0,0,0,.9)" }}>
      <figure style={{ position: "relative", aspectRatio: "16/10", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 14px,var(--pb-surface) 14px 28px)" }}>
        {photo && photo.url && <img src={photo.url} alt={p.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.12) 40%,rgba(9,24,16,.82) 100%)" }} />
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-gold)" }}>{REGION_LABEL[p.region] || p.region} · est. {p.year}</div>
          <b style={{ display: "block", fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: "1.55rem", lineHeight: 1.06, marginTop: 3, textShadow: "0 2px 14px rgba(0,0,0,.5)" }}>{p.name}</b>
        </div>
      </figure>
      <div style={{ padding: "13px 16px 16px" }}>
        <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{p.state}</div>
        <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.45, marginTop: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.desc}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(217,183,121,.1)" }}>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Live status</span>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", fontWeight: 800 }}>→</span>
        </div>
      </div>
    </Link>
  );
}

export default function ParksIndex({ parks }) {
  const [region, setRegion] = useState("all");

  const regions = useMemo(() => {
    const seen = [];
    parks.forEach((p) => { if (p.region && !seen.includes(p.region)) seen.push(p.region); });
    return ["all", ...seen];
  }, [parks]);

  const list = region === "all" ? parks : parks.filter((p) => p.region === region);
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ minHeight: "100vh", paddingTop: 64, background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader active="explore" />

      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(40px,8vh,84px) clamp(16px,4vw,40px) clamp(28px,5vh,52px)", background: "radial-gradient(1100px 420px at 72% -12%,rgba(228,190,120,.14),transparent 62%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontFamily: mono, fontSize: ".66rem", letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-ink-2)" }}>The U.S. National Parks · live status</div>
          <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.7rem,7vw,4.9rem)", lineHeight: 1.02, letterSpacing: "-.02em", marginTop: 14, maxWidth: 900 }}>The <em style={{ fontStyle: "italic", color: "var(--pb-gold)" }}>national parks</em> index.</h1>
          <p style={{ fontSize: "1.02rem", color: "var(--pb-ink-2)", lineHeight: 1.6, maxWidth: 620, marginTop: 14 }}>All 63 — from Acadia to Zion. Every park links to its live status: today&apos;s weather, alerts, and the honest go / no-go call, plus the trails, lakes, drives and campgrounds around it.</p>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 30, borderTop: "1px solid rgba(217,183,121,.14)" }}>
            <div style={{ padding: "18px 30px 4px 0" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1 }}>{parks.length}</div><div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 5 }}>Parks</div></div>
            <div style={{ padding: "18px 30px 4px", borderLeft: "1px solid rgba(217,183,121,.14)" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1 }}>{regions.length - 1}</div><div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 5 }}>Regions</div></div>
          </div>
        </div>
      </section>

      <div style={{ position: "sticky", top: 64, zIndex: 40, background: "rgba(10,23,18,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--pb-line)", borderBottom: "1px solid var(--pb-line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px clamp(16px,4vw,40px)" }}>
          <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Region</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {regions.map((r) => <Chip key={r} on={region === r} onClick={() => setRegion(r)}>{r === "all" ? "All regions" : (REGION_LABEL[r] || r)}</Chip>)}
          </div>
          <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: ".6rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{sorted.length} of {parks.length} parks</span>
        </div>
      </div>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px,4vh,40px) clamp(16px,4vw,40px) 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {sorted.map((p) => <ParkTile key={p.id} p={p} />)}
        </div>
      </section>
    </div>
  );
}
