"use client";

// /towns/[slug] — the case for basing in one town.
//
// From design_handoff_gateway_towns/TownPage.dc.html, in the platform's skin —
// same four swaps as the index (gold not terracotta, our type families, our
// chrome, both themes). See TownsIndex.jsx for why.
//
// The section that matters most is "What you can reach". A national forest is
// usually many times the size of the park beside it and typically has no timed
// entry, no fee and allows dispersed camping — and almost nobody knows. That
// contrast is the reason this page exists rather than being a directory row.
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { useThemedBody } from "../../lib/theme";
import { usePhoto } from "../../components/PhotoThumb";
import { lodgingOffers, townPicks } from "../../lib/lodging";

const mono = { fontFamily: "var(--pb-mono)", lineHeight: 1, textTransform: "uppercase" };
const GUTTER = "clamp(20px, 5vw, 64px)";
const WRAP = { maxWidth: 1240, margin: "0 auto" };

const METRICS = [
  ["lodging", "Sleep"], ["food", "Eat"], ["outfitter", "Gear"],
  ["culture", "Culture"], ["groceries", "Groceries"],
];

export default function TownPage({ town }) {
  const themeRef = useRef(null);
  useThemedBody(themeRef);

  const photo = usePhoto(
    town.name + ", " + (town.state || "") + "|" + town.name,
    town.lat, town.lng, "town:" + town.name, 1200
  );
  const primary = town.serves[0];

  return (
    <div ref={themeRef} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        @keyframes tpKen { from { transform: scale(1.04) } to { transform: scale(1.14) } }
        .tp-ken { animation: tpKen 24s ease-in-out infinite alternate; }
        .tp-2col { display: grid; grid-template-columns: 1fr 560px; gap: 48px; align-items: center; }
        .tp-metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .tp-landrow { display: grid; grid-template-columns: 300px 1fr auto; gap: 32px; align-items: center; }
        @media (max-width: 1024px) {
          .tp-2col { grid-template-columns: 1fr; }
          .tp-metrics { grid-template-columns: repeat(2, 1fr); }
          .tp-landrow { grid-template-columns: 1fr; gap: 14px; }
        }
        @media (prefers-reduced-motion: reduce) { .tp-ken { animation: none; } }
      `}</style>

      <SiteHeader active="towns" acctSlot />

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: `clamp(104px,13vh,150px) ${GUTTER} clamp(28px,5vh,64px)` }}>
        <div style={WRAP}>
          <div className="tp-2col">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--pb-gold)",
                  background: "var(--pb-tint)", border: "1px solid var(--pb-line)", padding: "6px 12px", borderRadius: 100 }}>
                  Town profile
                </span>
                <span style={{ ...mono, fontSize: 11, fontWeight: 500, letterSpacing: ".1em", color: "var(--pb-muted)" }}>
                  {town.state}
                </span>
              </div>

              <h1 style={{ margin: "22px 0 0", fontFamily: "var(--pb-serif)", fontWeight: 400,
                fontSize: "clamp(2.6rem,6.5vw,4.5rem)", lineHeight: 1.02, letterSpacing: "-.02em" }}>
                {town.name}
              </h1>

              {town.place && (
                <div style={{ fontFamily: "var(--pb-serif)", fontStyle: "italic", fontSize: "1.4rem",
                  color: "var(--pb-muted)", marginTop: 8, textTransform: "capitalize" }}>
                  {town.place}{town.state ? " · " + town.state : ""}
                </div>
              )}

              {primary && (
                <div style={{ marginTop: 26, padding: "16px 18px", borderRadius: 8,
                  background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Compass />
                    <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--pb-gold)" }}>
                      Gateway proximity
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--pb-serif)", fontSize: "1.15rem", marginTop: 8, lineHeight: 1.35 }}>
                    {primary.inside
                      ? <>Inside <b style={{ fontWeight: 600 }}>{primary.name}</b></>
                      : <>{primary.distanceMi < 1 ? "Under a mile" : Math.round(primary.distanceMi) + " miles"} from <b style={{ fontWeight: 600 }}>{primary.name}</b></>}
                  </div>
                </div>
              )}
              {/* No blurb slot. We have hand-written copy for ~22 places, all
                  national parks — so most towns have none, and the page has to be
                  complete without it rather than showing a gap. */}
            </div>

            <div style={{ position: "relative", height: 480, borderRadius: 12, overflow: "hidden",
              background: "var(--pb-surface-2)" }}>
              {photo && photo.url ? (
                <div className="tp-ken" style={{ position: "absolute", inset: 0,
                  background: `url(${photo.url}) center / cover no-repeat` }} />
              ) : (
                <NoPhoto />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── character ────────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--pb-line)", borderBottom: "1px solid var(--pb-line)", padding: `16px ${GUTTER}` }}>
        <div style={{ ...WRAP, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: ".86rem" }}>Characteristics</span>
            {(town.tags || []).length ? town.tags.map((t) => (
              <span key={t} style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
                color: "var(--pb-gold)", background: "var(--pb-tint)",
                border: "1px solid var(--pb-gold-2)", padding: "6px 11px", borderRadius: 20 }}>{t}</span>
            )) : (
              <span style={{ fontSize: ".84rem", color: "var(--pb-muted)" }}>Nothing distinctive listed</span>
            )}
          </div>
          {/* Says out loud what the whole product does. */}
          <span style={{ ...mono, fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--pb-muted)" }}>
            Unranked field entry
          </span>
        </div>
      </section>

      {/* ── metrics ──────────────────────────────────────────────────────── */}
      <section style={{ background: "var(--pb-bg-2)", padding: `clamp(36px,6vh,72px) ${GUTTER}` }}>
        <div style={WRAP}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: "var(--pb-gold)" }}>
            Basecamp metrics
          </div>
          <h2 style={{ margin: "10px 0 24px", fontFamily: "var(--pb-serif)", fontWeight: 400, fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
            Why base in {town.name}?
          </h2>
          <div className="tp-metrics">
            {METRICS.map(([k, label]) => {
              const n = town.counts ? town.counts[k] : null;
              const none = !n;
              return (
                <div key={k} style={{ background: "var(--pb-bg)", border: "1px solid var(--pb-line)",
                  borderRadius: 8, padding: 22 }}>
                  <div style={{ fontWeight: 700, fontSize: ".95rem" }}>{label}</div>
                  {/* A zero is "none listed", never a score of nought. Muted, not
                      alarming — an absence is not a warning. */}
                  <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "2.5rem",
                    lineHeight: 1, marginTop: 14, fontVariantNumeric: "tabular-nums",
                    color: none ? "var(--pb-muted)" : "var(--pb-ink)" }}>
                    {none ? "—" : n}
                  </div>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: ".1em", marginTop: 8,
                    color: "var(--pb-muted)" }}>
                    {none ? "none listed" : "verified listings"}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 16 }}>
            Counted from OpenStreetMap within 3 km of the town centre
          </div>
        </div>
      </section>

      {/* ── what you can reach ───────────────────────────────────────────── */}
      <section style={{ padding: `clamp(40px,7vh,80px) ${GUTTER}` }}>
        <div style={WRAP}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: "var(--pb-gold)" }}>
            Accessible public lands
          </div>
          <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--pb-serif)", fontWeight: 400, fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
            What you can reach from {town.name}
          </h2>

          {town.serves.some((s) => s.type === "national_forest") && (
            <div style={{ display: "flex", gap: 12, padding: "16px 18px", borderRadius: 8,
              background: "var(--pb-tint)", border: "1px solid var(--pb-line)", marginBottom: 22 }}>
              <span aria-hidden="true" style={{ color: "var(--pb-gold)", flex: "none" }}>✳</span>
              <p style={{ margin: 0, fontSize: ".92rem", lineHeight: 1.55, color: "var(--pb-ink-2)" }}>
                <b style={{ fontWeight: 600, color: "var(--pb-ink)" }}>Field note.</b>{" "}
                The national forest is usually many times larger than the park beside it, and typically
                has no timed entry, no entry fee and allows dispersed camping. Rules vary by district —
                check before you go.
              </p>
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {town.serves.map((s) => <LandRow key={s.id} s={s} />)}
          </div>
        </div>
      </section>

      {/* ── where to rest ────────────────────────────────────────────────── */}
      <section style={{ background: "var(--pb-bg-2)", padding: `clamp(36px,6vh,72px) ${GUTTER}` }}>
        <div style={WRAP}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: "var(--pb-gold)" }}>
                Where to rest
              </div>
              <h2 style={{ margin: "10px 0 0", fontFamily: "var(--pb-serif)", fontWeight: 400, fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
                Cabins &amp; stays near {town.name}
              </h2>
            </div>
            {/* The disclosure is part of the module, not a footnote bolted on
                later. It ships even while the slot is empty. */}
            <p style={{ margin: 0, maxWidth: 380, fontSize: ".78rem", lineHeight: 1.5, color: "var(--pb-muted)",
              borderLeft: "2px solid var(--pb-line)", paddingLeft: 14 }}>
              Booking links earn Park Buddy a commission at no cost to you. Affiliate partnerships never
              influence which towns appear or their order.
            </p>
          </div>

          <LodgingOffers town={town} />
        </div>
      </section>

      <footer style={{ ...WRAP, padding: `clamp(32px,6vh,64px) ${GUTTER}` }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 22 }}>
          <div style={{ ...mono, fontSize: ".58rem", letterSpacing: ".1em", lineHeight: 1.8, color: "var(--pb-muted)" }}>
            Town from USGS GNIS · boundaries from the National Park Service and USDA Forest Service ·
            what&rsquo;s in town from OpenStreetMap contributors · photo from Wikipedia.
          </div>
          <Link href="/towns" style={{ display: "inline-block", marginTop: 16, fontSize: ".86rem",
            color: "var(--pb-gold)", textDecoration: "none" }}>
            ‹ All gateway towns
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */
// The two lodging hand-offs. Which partners exist, and how their URLs are built,
// is entirely app/lib/lodging.js — this only renders what that returns, so an
// approved Hipcamp or a re-minted link needs no change here.
//
// `today` starts null and is filled in after mount. These pages are statically
// generated, so a date computed during render would be the BUILD date: a link
// minted for a fortnight in July would still look current in September. Reading
// the real clock on the client fixes that, and deferring it to an effect keeps
// the first paint identical to the server HTML instead of tripping hydration.
function LodgingOffers({ town }) {
  const [today, setToday] = useState(null);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  const offers = lodgingOffers(town, today);
  const picks = townPicks(town);
  if (!offers.length && !picks.length) return null;

  return (
    <>
      {/* Named properties we vouch for — above the searches, because a specific
          recommendation is worth more than "here are 143 results". Renders
          nothing until a town has real picks; no placeholder card. */}
      {picks.length > 0 && (
        <div style={{ marginTop: 24, display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {picks.map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="sponsored noopener noreferrer"
              style={{ display: "flex", flexDirection: "column", gap: 10, textDecoration: "none", color: "inherit",
                background: "var(--pb-surface)", border: "1px solid var(--pb-gold-2)", borderRadius: 8, padding: "24px 26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "var(--pb-gold)" }}>
                  Park Buddy pick
                </span>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "var(--pb-muted)" }}>
                  {p.partner}
                </span>
              </div>
              <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.2 }}>
                {p.name}
              </div>
              <p style={{ margin: 0, fontSize: ".88rem", lineHeight: 1.55, color: "var(--pb-ink-2)", flex: 1 }}>
                {p.note}
              </p>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-gold)" }}>
                See rooms &amp; rates →
              </span>
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: picks.length ? 14 : 24, display: "grid", gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {offers.map((o) => (
        <a key={o.key} href={o.url} target="_blank" rel="sponsored noopener noreferrer"
          style={{ display: "flex", flexDirection: "column", gap: 10, textDecoration: "none", color: "inherit",
            background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 8, padding: "24px 26px" }}>
          <div style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "var(--pb-muted)" }}>
            {o.partner}
          </div>
          <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.2 }}>
            {o.title}
          </div>
          <p style={{ margin: 0, fontSize: ".88rem", lineHeight: 1.55, color: "var(--pb-ink-2)", flex: 1 }}>
            {o.blurb}
          </p>
          <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-gold)" }}>
            {o.cta} →
          </span>
        </a>
      ))}
      {/* Dates are the visitor's to choose. We deliberately don't pre-fill a
          range, because any range we picked would be wrong for most people and
          silently stale for the rest. */}
      <p style={{ gridColumn: "1 / -1", margin: 0, ...mono, fontSize: 10, letterSpacing: ".06em",
        color: "var(--pb-muted)" }}>
        Searches open undated — pick your nights on the partner&rsquo;s site.
      </p>
      </div>
    </>
  );
}

function LandRow({ s }) {
  const isForest = s.type === "national_forest";
  const href = isForest
    ? "/forests/" + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";
  const inner = (
    <div className="tp-landrow" style={{ background: "var(--pb-surface)", border: "1px solid var(--pb-line)",
      borderRadius: 8, padding: "26px 28px" }}>
      <div>
        <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.35rem", lineHeight: 1.15 }}>{s.name}</div>
        <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-gold)", marginTop: 8 }}>
          {s.acres >= 1e6 ? (s.acres / 1e6).toFixed(1) + "M acres" : Math.round(s.acres / 1000) + "k acres"}
        </div>
        <div style={{ ...mono, fontSize: 10, letterSpacing: ".08em", color: "var(--pb-muted)", marginTop: 6 }}>
          {s.inside ? "Town sits inside it" : (s.distanceMi < 1 ? "Under a mile away" : Math.round(s.distanceMi) + " mi away")}
        </div>
      </div>
      <div style={{ fontSize: ".9rem", lineHeight: 1.55, color: "var(--pb-ink-2)" }}>
        {isForest
          ? "National forest land — usually open for dispersed camping without a reservation, and rarely with an entry fee or timed entry."
          : "National park land — often has an entrance fee, and may require a timed-entry or permit reservation in season."}
      </div>
      <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", whiteSpace: "nowrap",
        padding: "8px 12px", borderRadius: 4,
        color: isForest ? "var(--pb-ink)" : "var(--pb-gold)",
        background: isForest ? "var(--pb-bg-2)" : "var(--pb-tint)",
        border: "1px solid " + (isForest ? "var(--pb-line)" : "var(--pb-gold-2)") }}>
        {isForest ? "Forest · open" : "Park · regulated"}
      </span>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link> : inner;
}

function NoPhoto() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--pb-bg-2)",
      backgroundImage: "radial-gradient(circle at 50% 50%, var(--pb-line) 1px, transparent 1px)",
      backgroundSize: "24px 24px", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10 }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" stroke="var(--pb-muted)" strokeWidth="1.4" />
        <circle cx="12" cy="10" r="2.4" stroke="var(--pb-muted)" strokeWidth="1.4" />
      </svg>
      <span style={{ fontSize: ".84rem", color: "var(--pb-muted)" }}>No verified photo available</span>
    </div>
  );
}
function Compass() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flex: "none" }} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="var(--pb-gold)" strokeWidth="1.6" />
      <path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z" fill="var(--pb-gold)" />
    </svg>
  );
}
