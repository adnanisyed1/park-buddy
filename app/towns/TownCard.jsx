"use client";

// Directory card, from design_handoff_gateway_towns/TownCard.dc.html.
//
// Geometry is the handoff's, verbatim: 220px photo, 20px body padding, 16px
// column gap, 6px within groups, 24px serif name, 13px serves line, 10px mono
// pills at 5x10 / radius 100, a 1px rule, then the metrics row.
//
// What is NOT the handoff's: the palette and the type families. The mock is a
// warm guidebook in Fraunces/Geist with a terracotta accent. Measured against
// globals.css, its NEUTRALS are already ours to within a few units — paper Δ4,
// sand Δ6, card Δ0 — so those just become tokens. The accent is the exception:
// the mock's terracotta (#bd5338) is Δ16 from --pb-hold (#c85e3c), which in this
// product MEANS "hold off, don't go today". Using it decoratively would put
// eyebrows and "none listed" in the same hue as a flash-flood advisory, so the
// accent is --pb-gold and terracotta stays reserved for real warnings.
import Link from "next/link";
import { usePhoto } from "../components/PhotoThumb";

const mono = {
  fontFamily: "var(--pb-mono)", lineHeight: 1, textTransform: "uppercase",
  fontVariantNumeric: "tabular-nums",
};

export default function TownCard({ town }) {
  const first = (town.serves && town.serves[0]) || null;
  const serves = first
    ? first.name + " · " + (first.inside ? "inside" : Math.round(first.distanceMi) + " mi")
    : "";
  const c = town.counts || {};
  // Omit a metric whose count is null; a real 0 still prints, because "0 gear"
  // is a fact and a blank is an absence of one.
  const metrics = [
    ["lodging", "sleep"], ["food", "eat"], ["outfitter", "gear"],
  ].filter(([k]) => c[k] != null).map(([k, label]) => c[k] + " " + label);

  const photo = usePhoto(
    town.name + ", " + (town.state || "") + "|" + town.name,
    town.lat, town.lng, "town:" + town.name, 700
  );

  return (
    <Link href={"/towns/" + town.slug} className="gt-card"
      style={{ display: "flex", flexDirection: "column", textDecoration: "none",
        background: "var(--pb-bg)", borderRadius: 8, overflow: "hidden",
        boxShadow: "inset 0 0 0 1px var(--pb-line)",
        transition: "transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s" }}>

      <div style={{ position: "relative", height: 220, overflow: "hidden", flexShrink: 0 }}>
        {photo && photo.url ? (
          <div className="gt-img" style={{ position: "absolute", inset: 0,
            background: `url(${photo.url}) center / cover no-repeat`,
            transition: "transform .6s cubic-bezier(.2,.8,.2,1)" }} />
        ) : (
          // The designed no-photo state. Not a broken image and not a grey box —
          // a town with no usable Wikipedia photo is common, and it has to look
          // like a decision.
          <div style={{ position: "absolute", inset: 0, background: "var(--pb-bg-2)",
            backgroundImage: "radial-gradient(circle at 50% 50%, var(--pb-line) 1px, transparent 1px)",
            backgroundSize: "22px 22px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8 }}>
            <PinIcon />
            <span style={{ fontFamily: "var(--pb-sans)", fontSize: 12, fontWeight: 500, color: "var(--pb-muted)" }}>
              No verified photo available
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: 24, lineHeight: 1, color: "var(--pb-ink)" }}>
            {town.name}{town.stateShort ? ", " + town.stateShort : ""}
          </div>
          {serves && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CompassIcon />
              <span style={{ fontFamily: "var(--pb-sans)", fontWeight: 500, fontSize: 13, lineHeight: 1, color: "var(--pb-ink-2)" }}>
                {serves}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 4 }}>
          {(town.tags || []).map((t) => (
            <span key={t} style={{ ...mono, fontWeight: 600, fontSize: 10, color: "var(--pb-ink-2)",
              background: "var(--pb-bg-2)", padding: "5px 10px", borderRadius: 100 }}>{t}</span>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ height: 1, background: "var(--pb-line)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...mono, fontWeight: 700, fontSize: 12, color: "var(--pb-ink)", textTransform: "none" }}>
              {metrics.join(" · ")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CompassIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flex: "none" }} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="var(--pb-gold)" strokeWidth="1.6" />
      <path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z" fill="var(--pb-gold)" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" stroke="var(--pb-muted)" strokeWidth="1.4" />
      <circle cx="12" cy="10" r="2.4" stroke="var(--pb-muted)" strokeWidth="1.4" />
    </svg>
  );
}
