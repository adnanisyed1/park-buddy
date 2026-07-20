"use client";

// /towns — the basecamp directory.
//
// Structure, spacing and type scale are the Claude Design handoff's
// (design_handoff_gateway_towns). What changed, and why, so nobody "fixes" it
// back later:
//
//   · Terracotta accent -> --pb-gold. The mock's #bd5338 is Δ16 from --pb-hold
//     (#c85e3c), which in this product means "hold off, don't go today". Gold
//     eyebrows read as chrome; terracotta eyebrows read as warnings.
//   · Fraunces/Geist/Geist Mono -> Cormorant/Inter/Space Mono, the families the
//     rest of the site already loads. Three new families on one page is the
//     loudest possible "different site" signal.
//   · The mock's own nav and footer -> SiteHeader and the platform footer. The
//     mock also assumes a region-scoped product ("REGION: COLORADO"); we aren't.
//   · The mock is light-only. Everything here is tokenised so dark works too.
//
// The mock's NEUTRALS were kept because they were already ours: paper Δ4,
// sand Δ6, card Δ0 against globals.css.
import { useMemo, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { useThemedBody } from "../lib/theme";
import TownCard from "./TownCard";
import { usePhoto } from "../components/PhotoThumb";
import { directoryTowns, insideTowns, countsSummary, SORTS } from "../lib/towns";

const mono = { fontFamily: "var(--pb-mono)", lineHeight: 1, textTransform: "uppercase" };
const GUTTER = "clamp(20px, 5vw, 64px)";

const SORT_OPTS = [
  ["boundary", "Nearest boundary"],
  ["stay", "Most lodging"],
  ["small", "Smallest"],
];
const TAG_OPTS = ["ski", "hot springs", "brewery", "historic"];

export default function TownsIndex() {
  const themeRef = useRef(null);
  useThemedBody(themeRef);

  const [sort, setSort] = useState("boundary");
  const [tag, setTag] = useState(null);
  const [state, setState] = useState("");

  const all = useMemo(() => directoryTowns(), []);
  const inside = useMemo(() => insideTowns(3), []);
  const summary = useMemo(() => countsSummary(), []);
  const states = useMemo(
    () => [...new Set(all.map((t) => t.state).filter(Boolean))].sort(),
    [all]
  );

  const shown = useMemo(() => {
    let out = all;
    if (tag) out = out.filter((t) => (t.tags || []).includes(tag));
    if (state) out = out.filter((t) => t.state === state);
    return out.slice().sort(SORTS[sort]);
  }, [all, tag, state, sort]);

  return (
    <div ref={themeRef} className="pb-theme" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        .gt-card:hover { transform: translateY(-4px); box-shadow: inset 0 0 0 1px var(--pb-gold-2); }
        .gt-card:hover .gt-img { transform: scale(1.05); }
        .gt-ed:hover .gt-edimg { transform: scale(1.06); }
        @keyframes gtUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .gt-up { animation: gtUp .6s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .gt-up { animation: none; }
          .gt-card, .gt-img, .gt-edimg { transition: none !important; }
        }
        .gt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .gt-split { display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
        @media (max-width: 980px) { .gt-grid { grid-template-columns: 1fr; } .gt-split { flex-direction: column; align-items: flex-start; gap: 20px; } }
      `}</style>

      <SiteHeader active="towns" acctSlot />

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      {/* Top padding clears the FLOATING nav pill, which is position:fixed and
          overlaps anything that starts at the top of the page. Same clamp the
          park page hero uses — I shipped this page once without it and the
          eyebrow rendered underneath the logo. */}
      <section style={{ padding: `clamp(104px,13vh,150px) ${GUTTER} clamp(28px,5vh,64px)` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div className="gt-up" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
              color: "var(--pb-gold)", background: "var(--pb-tint)",
              border: "1px solid var(--pb-line)", padding: "6px 12px", borderRadius: 100 }}>
              Field directory
            </span>
            <span style={{ ...mono, fontSize: 11, fontWeight: 500, letterSpacing: ".1em", color: "var(--pb-muted)" }}>
              {summary.towns} towns across {summary.places} parks &amp; forests
            </span>
          </div>

          <div className="gt-split gt-up" style={{ marginTop: 28 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--pb-serif)", fontWeight: 400,
              fontSize: "clamp(2.6rem, 7vw, 4.5rem)", lineHeight: 1.02, letterSpacing: "-.02em" }}>
              Gateway Towns
            </h1>
            <p style={{ margin: 0, maxWidth: 580, fontSize: "clamp(1rem,1.4vw,1.125rem)", lineHeight: 1.6, color: "var(--pb-ink-2)" }}>
              The town you actually sleep, eat and gear up in. Every entry is measured from the real
              boundary of the park or forest it serves — not from a dot in the middle of it — and
              described by what&rsquo;s genuinely there.
            </p>
          </div>
        </div>
      </section>

      {/* ── editorial: towns inside the boundary ─────────────────────────── */}
      {inside.length > 0 && (
        <section style={{ background: "var(--pb-bg-2)", padding: `clamp(32px,6vh,64px) ${GUTTER}` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <div className="gt-split" style={{ alignItems: "flex-end", marginBottom: 28 }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "clamp(1.4rem,2.4vw,1.6rem)" }}>
                  Towns inside the forest
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: ".9rem", color: "var(--pb-muted)" }}>
                  Not near it — within the boundary itself.
                </p>
              </div>
            </div>
            <div className="gt-grid">
              {inside.map((t) => <EditorialCard key={t.slug} town={t} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── filters ──────────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--pb-line)", borderBottom: "1px solid var(--pb-line)",
        padding: `18px ${GUTTER}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Field label="State">
              <select value={state} onChange={(e) => setState(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-muted)" }}>Tags</span>
              {TAG_OPTS.map((t) => {
                const on = tag === t;
                return (
                  <button key={t} onClick={() => setTag(on ? null : t)}
                    style={{ cursor: "pointer", ...mono, fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
                      padding: "6px 11px", borderRadius: 100, background: "transparent",
                      color: on ? "var(--pb-gold)" : "var(--pb-ink-2)",
                      border: "1px solid " + (on ? "var(--pb-gold-2)" : "var(--pb-line)") }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Sort by">
            <div style={{ display: "flex", border: "1px solid var(--pb-line)", borderRadius: 100, overflow: "hidden" }}>
              {SORT_OPTS.map(([k, label]) => {
                const on = sort === k;
                return (
                  <button key={k} onClick={() => setSort(k)}
                    style={{ cursor: "pointer", fontFamily: "var(--pb-sans)", fontSize: ".78rem", fontWeight: 600,
                      padding: "7px 14px", border: "none",
                      background: on ? "var(--pb-ink)" : "transparent",
                      color: on ? "var(--pb-bg)" : "var(--pb-ink-2)" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </section>

      {/* ── directory ────────────────────────────────────────────────────── */}
      <section style={{ padding: `clamp(36px,7vh,88px) ${GUTTER} clamp(40px,8vh,96px)` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: "var(--pb-gold)" }}>
            All field entries ({shown.length})
          </div>
          <h2 style={{ margin: "10px 0 28px", fontFamily: "var(--pb-serif)", fontWeight: 400,
            fontSize: "clamp(1.7rem,3vw,2rem)" }}>
            Verified basecamp directory
          </h2>

          {shown.length ? (
            <div className="gt-grid">
              {shown.map((t) => <TownCard key={t.slug} town={t} />)}
            </div>
          ) : (
            <p style={{ color: "var(--pb-muted)", fontSize: ".92rem", maxWidth: "56ch", lineHeight: 1.6 }}>
              Nothing matches that combination yet. Towns appear here once we&rsquo;ve checked what&rsquo;s
              actually in them — somewhere to sleep or eat, and a real settlement rather than a name
              on a map.
            </p>
          )}
        </div>
      </section>

      <footer style={{ maxWidth: 1240, margin: "0 auto", padding: `0 ${GUTTER} clamp(40px,7vh,72px)` }}>
        <div style={{ borderTop: "1px solid var(--pb-line)", paddingTop: 24 }}>
          <div style={{ ...mono, fontSize: ".58rem", letterSpacing: ".1em", lineHeight: 1.8, color: "var(--pb-muted)" }}>
            Towns from USGS GNIS · boundaries from the National Park Service and USDA Forest Service ·
            what&rsquo;s in each town from OpenStreetMap contributors.
          </div>
          <div style={{ fontSize: ".86rem", color: "var(--pb-muted)", fontWeight: 300, marginTop: 8, maxWidth: "62ch", lineHeight: 1.6 }}>
            We don&rsquo;t rank these towns. Counts are of real listed places, distances are measured to the
            actual boundary, and the order is whatever you choose. Where a town has nothing listed, we
            say so rather than leaving a gap.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */
const selectStyle = {
  fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 500, color: "var(--pb-ink)",
  background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 4,
  padding: "6px 10px", cursor: "pointer",
};

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-muted)" }}>{label}</span>
      {children}
    </div>
  );
}

// The editorial card: photo-led, name over a gradient. Same idea as the mock's
// "inside the forest" row.
function EditorialCard({ town }) {
  const s = town.serves[0];
  const photo = usePhoto(
    town.name + ", " + (town.state || "") + "|" + town.name,
    town.lat, town.lng, "town:" + town.name, 900
  );
  return (
    <a href={"/towns/" + town.slug} className="gt-ed"
      style={{ position: "relative", display: "block", height: 320, borderRadius: 8,
        overflow: "hidden", textDecoration: "none", background: "var(--pb-surface-2)" }}>
      <div className="gt-edimg" style={{ position: "absolute", inset: 0,
        background: photo && photo.url
          ? `url(${photo.url}) center / cover no-repeat`
          : "var(--pb-surface-2)",
        transition: "transform .6s cubic-bezier(.2,.8,.2,1)" }} />
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(rgba(22,46,32,.15), rgba(22,46,32,.72))" }} />
      {s && (
        <span style={{ position: "absolute", top: 16, left: 16, ...mono, fontSize: 10, fontWeight: 700,
          letterSpacing: ".08em", color: "#fff", background: "rgba(255,255,255,.18)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.5)", padding: "6px 11px", borderRadius: 100 }}>
          Inside {s.name}
        </span>
      )}
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 18 }}>
        {/* Literal white, not a token: this sits on a photograph, which is dark
            in both themes. */}
        <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 400, fontSize: "2rem", color: "#fff", lineHeight: 1.05 }}>
          {town.name}
        </div>
        {town.counts && (
          <div style={{ fontSize: ".82rem", color: "rgba(255,255,255,.88)", marginTop: 5 }}>
            {town.counts.lodging} places to sleep · {town.counts.food} to eat
          </div>
        )}
      </div>
    </a>
  );
}
