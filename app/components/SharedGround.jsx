"use client";

// "You're also standing next to…" — the public land that touches this place.
//
// 41 of 63 national parks border or sit inside a national forest, and almost no
// visitor knows it. The park is the famous bit; the forest wrapped around it is
// usually several times larger, and it's where you go when the park is on timed
// entry or the campgrounds are full.
//
// The neighbours come from real polygon geometry (scripts/build-place-geometry.mjs),
// NOT from shared gateway towns — that proxy called Black Canyon and Mesa Verde
// neighbours while they sit 104 miles apart.
//
// DELIBERATELY NOT SHOWN: a size multiple. NPS acreage is federal fee land and
// USFS gis_acres is the administrative boundary including private inholdings, so
// "9x bigger" would be dividing two different measurements. Both figures are
// printed with their own units and the reader can compare them.
import Link from "next/link";
import ADJ from "../lib/place-adjacency.json";
import GEO from "../lib/place-geo.json";

// The panel knows a place by name; the geometry is keyed by the destinations-table
// id. One lookup built once, rather than threading ids through every caller.
const BY_NAME = (() => {
  const m = new Map();
  for (const [id, p] of Object.entries(GEO.places || {})) m.set(norm(p.name), id);
  return m;
})();
function norm(s) {
  return String(s || "").toLowerCase().replace(/\b(national park|national forest|national forests)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const REL_COPY = {
  within: "surrounds this place",
  borders: "shares a boundary",
  near: "next door",
};
const TYPE_ICON = { national_park: "\u{1F3D4}", national_forest: "\u{1F332}" };

export function neighboursFor(name) {
  const id = BY_NAME.get(norm(name));
  if (!id) return [];
  return ((ADJ.adjacency || {})[id] || [])
    .slice()
    .sort((a, b) => a.gapMi - b.gapMi)
    .slice(0, 3);
}

export default function SharedGround({ place }) {
  const list = neighboursFor(place && place.name);
  if (!list.length) return null;

  const self = BY_NAME.get(norm(place.name));
  const selfAcres = self && GEO.places[self] ? GEO.places[self].acres : null;
  const hasForest = list.some((n) => n.type === "national_forest");

  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
      <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".58rem", letterSpacing: ".14em",
        textTransform: "uppercase", color: "var(--pb-muted)" }}>Public land here</div>

      <div style={{ display: "grid", gap: 2, marginTop: 9 }}>
        {selfAcres ? (
          <Row icon={TYPE_ICON[place.type] || "\u{1F3D4}"} name={place.name}
            sub="you're looking at this" acres={selfAcres} strong />
        ) : null}
        {list.map((n, i) => (
          <Row key={n.id} icon={TYPE_ICON[n.type] || "\u{1F332}"} name={n.name}
            sub={REL_COPY[n.rel] || "nearby"}
            acres={(GEO.places[n.id] || {}).acres}
            href={n.type === "national_forest" ? "/forests/" + slug(n.name) : ""}
            divider={i > 0 || !!selfAcres} />
        ))}
      </div>

      {hasForest && (
        // Hedged on purpose. Dispersed camping on forest land is the general
        // rule, not a guarantee — wilderness permits, seasonal fire closures and
        // district rules all exist. "Usually" and "check" are load-bearing.
        <div style={{ fontSize: ".78rem", color: "var(--pb-ink-2)", lineHeight: 1.5, marginTop: 10,
          paddingTop: 10, borderTop: "1px solid var(--pb-line)" }}>
          National forest land usually allows dispersed camping without a reservation, and rarely has
          an entry fee or timed entry. Rules vary by district &mdash; check before you go.
        </div>
      )}
    </div>
  );
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Row({ icon, name, sub, acres, href, strong, divider }) {
  const body = (
    <>
      <span aria-hidden="true" style={{ flex: "none", fontSize: ".95rem" }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: strong ? 700 : 600, fontSize: ".86rem",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ display: "block", fontFamily: "var(--pb-mono)", fontSize: ".58rem",
          letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 3 }}>{sub}</span>
      </span>
      {acres ? (
        <span style={{ flex: "none", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ display: "block", fontSize: ".84rem", fontWeight: 600 }}>
            {acres >= 1e6 ? (acres / 1e6).toFixed(1) + "M" : Math.round(acres / 1000) + "k"}
          </span>
          <span style={{ display: "block", fontFamily: "var(--pb-mono)", fontSize: ".54rem",
            letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 3 }}>acres</span>
        </span>
      ) : null}
      {href ? <span aria-hidden="true" style={{ flex: "none", color: "var(--pb-gold)" }}>&rsaquo;</span> : null}
    </>
  );
  const style = {
    display: "flex", alignItems: "center", gap: 11, padding: "8px 0",
    borderTop: divider ? "1px solid var(--pb-line)" : "none",
    color: "var(--pb-ink)", textDecoration: "none",
  };
  return href ? <Link href={href} style={style}>{body}</Link> : <div style={style}>{body}</div>;
}
