"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePhoto } from "../components/PhotoThumb";
import SiteHeader from "../components/SiteHeader";
import useDarkBody from "../lib/useDarkBody";
import { Chip } from "../components/ui";

// /forests index — grid of U.S. national forests on the design system, grouped by
// region (a state→region map keeps it to a handful of chips instead of 29 states).
// Forests are AREAL, so — like byways — a point geo-search returns junk; photos
// use NAME-ONLY (Wikipedia lead image) or the elegant placeholder. Never geo.

const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";

const REGION = {
  Alaska: "Alaska", Hawaii: "Pacific", California: "West", Oregon: "West", Washington: "West", Nevada: "West",
  Colorado: "Rockies", Montana: "Rockies", Wyoming: "Rockies", Idaho: "Rockies", Utah: "Rockies",
  Arizona: "Southwest", "New Mexico": "Southwest", Texas: "Southwest", Oklahoma: "Southwest",
  Minnesota: "Midwest", Wisconsin: "Midwest", Michigan: "Midwest", Illinois: "Midwest", Indiana: "Midwest", Ohio: "Midwest", Missouri: "Midwest", Nebraska: "Midwest", "South Dakota": "Midwest", "North Dakota": "Midwest",
  Virginia: "South", "West Virginia": "South", Kentucky: "South", Tennessee: "South", "North Carolina": "South", "South Carolina": "South", Georgia: "South", Alabama: "South", Mississippi: "South", Florida: "South", Louisiana: "South", Arkansas: "South",
  Maine: "Northeast", "New Hampshire": "Northeast", Vermont: "Northeast", "New York": "Northeast", Pennsylvania: "Northeast",
};
const regionOf = (state) => REGION[state] || "Other";
const REGION_ORDER = ["West", "Pacific", "Rockies", "Southwest", "Midwest", "South", "Northeast", "Alaska", "Other"];

function ForestTile({ f }) {
  const ref = useRef(null);
  const photo = usePhoto(f.name, null, null, ref);
  const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <Link ref={ref} href={"/forests/" + slug} prefetch={false}
      style={{ display: "block", textDecoration: "none", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 22, overflow: "hidden", boxShadow: "0 26px 60px -40px rgba(0,0,0,.9)" }}>
      <figure style={{ position: "relative", aspectRatio: "16/10", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 14px,var(--pb-surface) 14px 28px)" }}>
        {photo && photo.url && <img src={photo.url} alt={f.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,24,16,.12) 40%,rgba(9,24,16,.82) 100%)" }} />
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-gold)" }}>{regionOf(f.state)} · {f.state}</div>
          <b style={{ display: "block", fontFamily: serif, fontWeight: 700, color: "var(--pb-ink)", fontSize: "1.45rem", lineHeight: 1.08, marginTop: 3, textShadow: "0 2px 14px rgba(0,0,0,.5)" }}>{f.name}</b>
        </div>
      </figure>
      <div style={{ padding: "13px 16px 15px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Live forest status</span>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", fontWeight: 800 }}>→</span>
      </div>
    </Link>
  );
}

export default function ForestsIndex({ forests }) {
  useDarkBody();
  const [region, setRegion] = useState("all");

  const regions = useMemo(() => {
    const present = new Set(forests.map((f) => regionOf(f.state)));
    return ["all", ...REGION_ORDER.filter((r) => present.has(r))];
  }, [forests]);

  const list = region === "all" ? forests : forests.filter((f) => regionOf(f.state) === region);
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ minHeight: "100vh", paddingTop: 64, background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader active="explore" />

      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(118px,14vh,140px) clamp(16px,4vw,40px) clamp(28px,5vh,52px)", background: "radial-gradient(1100px 420px at 72% -12%,rgba(228,190,120,.14),transparent 62%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontFamily: mono, fontSize: ".66rem", letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-ink-2)" }}>U.S. National Forests · public land</div>
          <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(2.7rem,7vw,4.9rem)", lineHeight: 1.02, letterSpacing: "-.02em", marginTop: 14, maxWidth: 900 }}>The <em style={{ fontStyle: "italic", color: "var(--pb-gold)" }}>national forests</em> index.</h1>
          <p style={{ fontSize: "1.02rem", color: "var(--pb-ink-2)", lineHeight: 1.6, maxWidth: 620, marginTop: 14 }}>Millions of acres of public land — the quieter side of the outdoors, with dispersed camping, hiking, and off-road routes the national parks don&apos;t allow. Grouped by region.</p>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 30, borderTop: "1px solid rgba(217,183,121,.14)" }}>
            <div style={{ padding: "18px 30px 4px 0" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1 }}>{forests.length}</div><div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 5 }}>Forests</div></div>
            <div style={{ padding: "18px 30px 4px", borderLeft: "1px solid rgba(217,183,121,.14)" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1 }}>{Math.max(0, regions.length - 1)}</div><div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 5 }}>Regions</div></div>
          </div>
        </div>
      </section>

      <div style={{ position: "sticky", top: 64, zIndex: 40, background: "rgba(10,23,18,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--pb-line)", borderBottom: "1px solid var(--pb-line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px clamp(16px,4vw,40px)" }}>
          <span style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Region</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {regions.map((r) => <Chip key={r} on={region === r} onClick={() => setRegion(r)}>{r === "all" ? "All regions" : r}</Chip>)}
          </div>
          <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: ".6rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{sorted.length} of {forests.length}</span>
        </div>
      </div>

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px,4vh,40px) clamp(16px,4vw,40px) 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {sorted.map((f, i) => <ForestTile key={f.name + i} f={f} />)}
        </div>
      </section>
    </div>
  );
}
