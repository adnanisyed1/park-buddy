import Link from "next/link";
import PhotoThumb from "./PhotoThumb";
import SiteHeader from "./SiteHeader";

// Shared look for the new /trail-status, /lake-status, /campground-status
// pages — standalone deep-linkable content pages (SEO + shareable), separate
// from ExploreApp's locked interactive-map panel design. Redesigned 2026-07-03
// to match the user's Trail.dc.html prototype: dark hero over a photo, sticky
// glass header, monospace micro-labels, Space Grotesk stat numbers, cream
// content area below the hero.

// Migrated to the platform design tokens (dark futuristic-royal). `ink`/`green`
// are TEXT colors (now light); `cream`/`card`/`dark`/`heroDark` are BACKGROUNDS
// (now dark). The one place COLORS.cream was used as light TEXT (the dark
// ConditionCard) is fixed inline below to a literal light value.
export const COLORS = {
  ink: "#f4f1ea", green: "#f4f1ea", gold: "#e8cf9a", goldDark: "#c9a35f",
  muted: "#7f8a82", cream: "#0a1712", card: "#0b1710", line: "rgba(217,183,121,.16)",
  dark: "#0e2016", heroDark: "#0a1712",
};
const sans = "var(--pb-sans)";
const serif = "var(--pb-serif)";
const mono = "var(--pb-mono)";
const numeric = "var(--pb-serif)";
const microLabel = { fontFamily: mono, fontSize: ".6rem", letterSpacing: ".16em", textTransform: "uppercase", color: COLORS.muted };

export function StatusShell({ children, hero, backHref, backLabel, headerRight, wide, bare }) {
  return (
    <div style={{ minHeight: "100vh", paddingTop: 62, background: COLORS.cream, fontFamily: sans, color: COLORS.ink }}>
      <SiteHeader active="explore" />
      {headerRight && <div style={{ position: "fixed", top: 11, right: "clamp(16px,4vw,54px)", zIndex: 101 }}>{headerRight}</div>}
      {hero}
      <div style={{ position: "relative", zIndex: 3, background: COLORS.cream, borderRadius: hero ? "24px 24px 0 0" : 0, marginTop: hero ? -20 : 0 }}>
        {bare ? children : (
          <main style={{ maxWidth: wide ? 1180 : 760, margin: "0 auto", padding: wide ? "22px clamp(16px,4vw,40px) 60px" : "26px 20px 60px" }}>
            {children}
          </main>
        )}
      </div>
    </div>
  );
}

// Full-bleed dark hero: photo (optional) + gradient + breadcrumb + title + pill
// row, plus an optional glassy stat-chip row (trail-status moves its stats up
// here over the photo). When `stats` is present the hero grows taller/wider.
export function HeroBand({ photoUrl, photoAlt, breadcrumb, title, titleSub, pills, stats, statsSlot, photoBadge }) {
  const tall = statsSlot != null || (stats && stats.length > 0);
  return (
    <section style={{ position: "relative", overflow: "hidden", minHeight: tall ? "clamp(380px,56vh,560px)" : "clamp(320px,46vh,460px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: COLORS.heroDark }}>
      {photoUrl ? (
        <img src={photoUrl} alt={photoAlt || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,#26413a 0 12px,#21372f 12px 24px)" }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,18,12,.55) 0%,rgba(8,18,12,.12) 36%,rgba(8,18,12,.46) 66%,rgba(8,18,12,.94) 100%)" }} />
      {/* Honest provenance label for the hero photo (e.g. a geotagged nearby
          photo with its capture date) — never passes an archive photo off as
          a live view. */}
      {photoUrl && photoBadge && (
        <span style={{ position: "absolute", top: 14, right: 16, zIndex: 3, background: "rgba(12,26,18,.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.22)", color: "rgba(244,241,234,.9)", fontFamily: mono, fontSize: ".58rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", borderRadius: 999, padding: "5px 11px" }}>{photoBadge}</span>
      )}
      <div style={{ position: "relative", zIndex: 2, maxWidth: tall ? 1180 : 900, margin: "0 auto", width: "100%", padding: "clamp(112px,13vh,138px) clamp(16px,4vw,40px) 36px", boxSizing: "border-box" }}>
        {breadcrumb && <div style={{ ...microLabel, color: COLORS.gold, textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>{breadcrumb}</div>}
        <h1 style={{ fontFamily: serif, fontWeight: 800, color: "#f4f1ea", fontSize: tall ? "clamp(2.4rem,6vw,4.2rem)" : "clamp(2rem,5.4vw,3.4rem)", lineHeight: 1, letterSpacing: "-.02em", margin: "10px 0 0", textShadow: "0 4px 30px rgba(0,0,0,.55)" }}>
          {title}{titleSub && <span style={{ fontStyle: "italic", color: "rgba(251,246,234,.72)", fontWeight: 500, fontSize: ".42em", letterSpacing: 0, display: "block", marginTop: 6 }}>{titleSub}</span>}
        </h1>
        {pills && pills.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {pills.map((p, i) => <HeroPill key={i} {...p} />)}
          </div>
        )}
        {statsSlot ? <div style={{ marginTop: 22 }}>{statsSlot}</div> : tall && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginTop: 22 }}>
            {stats.filter((s) => s && s.value != null && s.value !== "").map((s, i) => (
              <div key={i} style={{ background: "rgba(251,246,234,.07)", border: "1px solid rgba(217,183,121,.24)", borderRadius: 14, padding: "12px 14px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
                <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#c9bf9f" }}>{s.label}</div>
                <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.5rem", color: "#f4f1ea", marginTop: 3, lineHeight: 1 }}>{s.value}{s.unit && <span style={{ fontSize: ".5em", color: "#c9bf9f" }}> {s.unit}</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function HeroPill({ label, dot, dots }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(15,32,23,.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(217,183,121,.35)", borderRadius: 999, padding: dot || dots ? "7px 15px 7px 11px" : "7px 14px", fontSize: ".8rem", fontWeight: 700, color: "#f4f1ea", textShadow: "0 1px 3px rgba(0,0,0,.4)" }}>
      {dot && <i style={{ width: 9, height: 9, borderRadius: "50%", background: dot, flex: "none" }} />}
      {dots && (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          {Array.from({ length: dots.total }).map((_, i) => (
            <i key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < dots.filled ? "#e8cf9a" : "rgba(217,183,121,.25)" }} />
          ))}
        </span>
      )}
      {label}
    </span>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
      <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.1rem", margin: 0, color: COLORS.green }}>{children}</h2>
      {right && <span style={microLabel}>{right}</span>}
    </div>
  );
}

// Stat grid (Distance / Elev gain / High point / Est time / Trailhead, etc).
export function StatGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 22 }}>{children}</div>;
}
export function BigStat({ label, value, unit }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 16, padding: "14px 16px" }}>
      <div style={microLabel}>{label}</div>
      <div style={{ fontFamily: numeric, fontWeight: 700, fontSize: "1.5rem", marginTop: 5, lineHeight: 1, color: COLORS.ink }}>
        {value} {unit && <span style={{ fontSize: ".5em", color: COLORS.muted }}>{unit}</span>}
      </div>
    </div>
  );
}

// Small tip card ("Know before you go").
export function TipCard({ title, children }) {
  return (
    <div style={{ background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 16, padding: "14px 16px" }}>
      <b style={{ fontSize: ".88rem", color: COLORS.ink }}>{title}</b>
      {children && <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 3, lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
}

// Condition card — light by default, `dark` for the permits/fees treatment
// (matches the prototype's dark "Permits & fees" card).
export function ConditionCard({ label, title, children, dark, cta }) {
  return (
    <div style={dark
      ? { background: COLORS.dark, color: "#f4f1ea", border: "1px solid " + COLORS.line, borderRadius: 20, padding: 18 }
      : { background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 20, padding: 18 }}>
      {label && <div style={{ ...microLabel, color: dark ? "var(--pb-gold-soft)" : COLORS.muted, marginBottom: 12 }}>{label}</div>}
      {title && <div style={{ fontFamily: numeric, fontWeight: 700, fontSize: "1.2rem" }}>{title}</div>}
      {children && <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.55, marginTop: title ? 8 : 0 }}>{children}</div>}
      {cta && <div style={{ marginTop: 14 }}>{cta}</div>}
    </div>
  );
}

export function GoldButton({ href, children, onClick }) {
  const style = { textDecoration: "none", display: "inline-block", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontSize: ".78rem", fontWeight: 800, padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit" };
  return href
    ? <a href={href} target="_blank" rel="noreferrer" style={style}>{children}</a>
    : <button onClick={onClick} style={style}>{children}</button>;
}

export function StatCard({ children }) {
  return (
    <div style={{ background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>
    </div>
  );
}

export function StatCell({ label, value, full }) {
  if (value == null || value === "") return null;
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <div style={microLabel}>{label}</div>
      <b style={{ fontSize: ".92rem", color: COLORS.green }}>{value}</b>
    </div>
  );
}

export function NearbySection({ title, items }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <a key={i} href={it.href} style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 12, padding: "8px 12px 8px 8px", textDecoration: "none", color: COLORS.ink }}>
            {/* Every row gets a real photo when the item carries q (name
                candidates) — geotagged fallback via coords, like the big tiles. */}
            {it.q && <PhotoThumb q={it.q} lat={it.lat} lng={it.lng} alt={it.name} />}
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: ".85rem", color: COLORS.green, display: "block" }}>{it.name}</b>
              {it.sub && <span style={{ fontSize: ".72rem", color: COLORS.muted }}>{it.sub}</span>}
            </span>
            <span style={{ color: COLORS.muted, fontSize: ".8rem", flex: "none" }}>→</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function Stars({ value, size }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= Math.round(value) ? COLORS.gold : "rgba(255,255,255,.15)", fontSize: size || "1rem", lineHeight: 1 }}>★</span>
      ))}
    </span>
  );
}

// Read-only — writing a review needs a signed-in session, which only exists
// client-side (in ExploreApp's ReviewsSection). Link to the interactive
// panel is the write path from a shared/standalone page like this one.
export function ReviewsBlock({ reviews, avg, writeHref }) {
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle>Trip reports</SectionTitle>
      {avg != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -4, marginBottom: 10, fontSize: ".78rem", color: COLORS.muted }}>
          <Stars value={avg} size=".85rem" /> {avg.toFixed(1)} ({reviews.length})
        </div>
      )}
      {reviews.length === 0 && <div style={{ fontSize: ".8rem", color: COLORS.muted, marginBottom: 10 }}>No reviews yet.</div>}
      {reviews.map((r, i) => (
        <div key={i} style={{ background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <b style={{ fontSize: ".85rem", color: COLORS.green }}>{r.author_name || "Explorer"}</b>
            <Stars value={r.rating} size=".8rem" />
          </div>
          {r.review_text && <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.55 }}>{r.review_text}</div>}
        </div>
      ))}
      {writeHref && (
        <a href={writeHref} style={{ display: "block", textAlign: "center", background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", color: "var(--pb-gold)", textDecoration: "none", marginTop: 4 }}>Write a review on the map →</a>
      )}
    </div>
  );
}

export function NotFoundBody({ label }) {
  return (
    <div style={{ textAlign: "center", color: COLORS.muted, padding: "40px 10px" }}>
      <div style={{ fontFamily: serif, fontSize: "1.2rem", color: COLORS.green, marginBottom: 8 }}>Couldn&apos;t find that {label}</div>
      <div style={{ fontSize: ".85rem" }}>It may have moved, or the link is out of date.</div>
    </div>
  );
}
