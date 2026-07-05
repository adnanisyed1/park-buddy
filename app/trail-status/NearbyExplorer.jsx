"use client";

import { useEffect, useState } from "react";

// "Near this trailhead" — one radius control (10/25/50/Any mi) filtering five
// sections (trails, lakes, national parks, national forests, gateway towns) that
// were precomputed with distances server-side (getTrailNearby). Every tile shows
// a real photo (resolved per-tile via /api/photo, cached in localStorage exactly
// like ExploreApp's CoverPhoto) and a distance badge. Trails/lakes/parks link to
// their detail pages; forests/towns are context cards (no detail page yet).

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const serif = "var(--font-spectral), 'Spectral', Georgia, serif";
const CARD = "var(--pb-surface)", LINE = "rgba(217,183,121,.16)", INK = "var(--pb-ink)", MUTED = "var(--pb-muted)", GREEN = "var(--pb-ink)", GOLD = "#c9a35f";

const SECTIONS = [
  { key: "trails", title: "Trails nearby", sub: "Same trailhead corridor" },
  { key: "lakes", title: "Lakes nearby", sub: "Alpine & valley lakes" },
  { key: "parks", title: "National parks near me", sub: "NPS units" },
  { key: "forests", title: "National forests near me", sub: "USFS land, fewer crowds" },
  { key: "places", title: "Places to go near me", sub: "Gateway towns — food, fuel, beds" },
];
const RADII = [{ v: 10, l: "10 mi" }, { v: 25, l: "25 mi" }, { v: 50, l: "50 mi" }, { v: 9999, l: "Any" }];

// Photo resolution + cache live in the shared hook (PhotoThumb.jsx, v3 cache
// with the v=2 cache-buster) — one pipeline for every tile and thumbnail.
import { usePhoto } from "../components/PhotoThumb";

function Tile({ item }) {
  const photo = usePhoto(item.q, item.lat, item.lng);
  const url = photo ? photo.url : null;
  const badge = item.badge || (item.distMi != null ? Math.round(item.distMi) + " MI" : null);
  const inner = (
    <>
      <figure style={{ position: "relative", aspectRatio: "16/10", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }}>
        {url && <img src={url} alt={item.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {!url && (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="var(--pb-ink-2)" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><path d="M12 3l5 9h-3l5 9H5l5-9H7z" /></svg>
        )}
        {badge && <span style={{ position: "absolute", left: 9, top: 9, background: "rgba(21,36,28,.85)", color: "var(--pb-ink)", fontFamily: mono, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".08em", borderRadius: 999, padding: "3px 9px" }}>{badge}</span>}
        {photo && photo.geo && (
          <span style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(21,36,28,.75)", color: "rgba(243,237,224,.85)", fontFamily: mono, fontSize: ".52rem", fontWeight: 700, letterSpacing: ".06em", borderRadius: 999, padding: "2px 7px" }}>
            {photo.date ? "NEARBY · " + photo.date.toUpperCase() : "NEARBY PHOTO"}
          </span>
        )}
      </figure>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 13px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: ".86rem", fontWeight: 800, color: INK, lineHeight: 1.25 }}>{item.name}</div>
          {item.sub && <div style={{ fontFamily: mono, fontSize: ".62rem", color: MUTED, marginTop: 2 }}>{item.sub}</div>}
        </div>
        {item.href && <span style={{ flex: "none", color: GOLD, fontWeight: 800 }}>→</span>}
      </div>
    </>
  );
  const style = { display: "block", textDecoration: "none", background: CARD, border: "1px solid " + LINE, borderRadius: 18, overflow: "hidden", color: INK };
  return item.href ? <a href={item.href} style={style}>{inner}</a> : <div style={style}>{inner}</div>;
}

export default function NearbyExplorer({ nearby, refName, refLat, refLng, state }) {
  const [radius, setRadius] = useState(25);
  const [places, setPlaces] = useState(null); // null = still loading gateway towns

  // Gateway towns come from Overpass, which can be slow — fetch them client-side
  // after paint so the page never blocks on it.
  useEffect(() => {
    if (refLat == null || refLng == null) { setPlaces([]); return; }
    let on = true;
    fetch("/api/gateway?lat=" + refLat + "&lng=" + refLng + "&state=" + encodeURIComponent(state || ""))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const items = ((d && d.towns) || []).map((t) => {
          const bare = String(t.name || "").replace(/,.*$/, "").trim();
          return { name: t.name, distMi: t.distanceMi, href: null, lat: t.lat, lng: t.lng, q: [t.name, state ? bare + ", " + state : "", bare].filter(Boolean).join("|") };
        }).sort((a, b) => a.distMi - b.distMi).slice(0, 8);
        if (on) setPlaces(items);
      })
      .catch(() => { if (on) setPlaces([]); });
    return () => { on = false; };
  }, [refLat, refLng, state]);

  const data = { ...nearby, places: places || [] };
  const placesLoading = places === null;
  const within = (arr) => (arr || []).filter((i) => i.distMi == null || i.distMi <= radius);
  const total = SECTIONS.reduce((n, s) => n + within(data[s.key]).length, 0);
  const label = radius >= 9999 ? "any distance" : radius + " mi";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap", margin: "0 2px 14px" }}>
        <div>
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.5rem", margin: 0, color: INK }}>Near this trailhead</h2>
          <div style={{ fontSize: ".82rem", color: "var(--pb-muted)", marginTop: 3 }}>
            {radius >= 9999 ? "Everything around " : "Everything within " + radius + " miles of "}{refName || "the trailhead"}. {total} place{total === 1 ? "" : "s"}.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: MUTED }}>Within</span>
          <div style={{ display: "flex", gap: 6, background: CARD, border: "1px solid " + LINE, borderRadius: 999, padding: 4 }}>
            {RADII.map((o) => {
              const on = o.v === radius;
              return (
                <button key={o.v} onClick={() => setRadius(o.v)} style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: ".76rem", fontWeight: 800, padding: "7px 14px", borderRadius: 999, transition: "background .2s,color .2s", background: on ? "var(--pb-bg)" : "transparent", color: on ? "var(--pb-ink)" : "var(--pb-muted)" }}>{o.l}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {SECTIONS.map((sec) => {
          const items = within(data[sec.key]);
          const loading = sec.key === "places" && placesLoading;
          return (
            <div key={sec.key}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", margin: "0 2px 10px" }}>
                <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.05rem", color: INK, margin: 0 }}>{sec.title}</h3>
                <span style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>{loading ? "finding…" : items.length + " within " + label} · {sec.sub}</span>
              </div>
              {loading ? (
                <div style={{ background: CARD, border: "1px dashed rgba(217,183,121,.16)", borderRadius: 16, padding: "16px 18px", fontSize: ".84rem", color: MUTED }}>Finding nearby towns…</div>
              ) : items.length === 0 ? (
                <div style={{ background: CARD, border: "1px dashed rgba(217,183,121,.16)", borderRadius: 16, padding: "16px 18px", fontSize: ".84rem", color: MUTED }}>Nothing within {label} — widen the radius to see more.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
                  {/* Name-keyed (not index) so radius refilters remount tiles
                      instead of leaving a reused tile showing the previous
                      item's photo/badge. */}
                  {items.map((it) => <Tile key={sec.key + "|" + it.name} item={it} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
