import Link from "next/link";

// Shared look for the new /trail-status, /lake-status, /campground-status
// pages — standalone deep-linkable content pages (SEO + shareable), separate
// from ExploreApp's locked interactive-map panel design. Redesigned 2026-07-03
// to match the user's Trail.dc.html prototype: dark hero over a photo, sticky
// glass header, monospace micro-labels, Space Grotesk stat numbers, cream
// content area below the hero.

export const COLORS = {
  ink: "#22261f", green: "#163a2b", gold: "#c79a4b", goldDark: "#b3862d",
  muted: "#8a8471", cream: "#f3efe7", card: "#fffdf8", line: "#e2dac8",
  dark: "#22261f", heroDark: "#11281d",
};
const sans = "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif";
const serif = "var(--font-spectral), 'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const numeric = "var(--font-space-grotesk), 'Space Grotesk', sans-serif";
const microLabel = { fontFamily: mono, fontSize: ".6rem", letterSpacing: ".16em", textTransform: "uppercase", color: COLORS.muted };

export function StatusShell({ children, hero, backHref, backLabel, headerRight, wide, bare }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.cream, fontFamily: sans, color: COLORS.ink }}>
      <header style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px clamp(16px,4vw,40px)", background: "rgba(16,32,23,.7)", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)", borderBottom: "1px solid rgba(228,190,120,.28)" }}>
        <Link href={backHref || "/explore"} style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "rgba(243,237,224,.92)", fontSize: ".84rem", fontWeight: 700 }}>‹ <span>{backLabel || "Back to map"}</span></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#fbf6ea" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(145deg,#e4be78,#c79a4b)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#15241c"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
          </span>
          <b style={{ fontFamily: serif, fontWeight: 700, fontSize: ".95rem" }}>ParkBuddy</b>
        </div>
        {headerRight || <span />}
      </header>
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
        <span style={{ position: "absolute", top: 14, right: 16, zIndex: 3, background: "rgba(12,26,18,.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.22)", color: "rgba(243,237,224,.9)", fontFamily: mono, fontSize: ".58rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", borderRadius: 999, padding: "5px 11px" }}>{photoBadge}</span>
      )}
      <div style={{ position: "relative", zIndex: 2, maxWidth: tall ? 1180 : 900, margin: "0 auto", width: "100%", padding: "clamp(50px,10vh,90px) clamp(16px,4vw,40px) 36px", boxSizing: "border-box" }}>
        {breadcrumb && <div style={{ ...microLabel, color: COLORS.gold, textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>{breadcrumb}</div>}
        <h1 style={{ fontFamily: serif, fontWeight: 800, color: "#fbf6ea", fontSize: tall ? "clamp(2.4rem,6vw,4.2rem)" : "clamp(2rem,5.4vw,3.4rem)", lineHeight: 1, letterSpacing: "-.02em", margin: "10px 0 0", textShadow: "0 4px 30px rgba(0,0,0,.55)" }}>
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
              <div key={i} style={{ background: "rgba(251,246,234,.07)", border: "1px solid rgba(228,190,120,.24)", borderRadius: 14, padding: "12px 14px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
                <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#c9bf9f" }}>{s.label}</div>
                <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.5rem", color: "#fbf6ea", marginTop: 3, lineHeight: 1 }}>{s.value}{s.unit && <span style={{ fontSize: ".5em", color: "#c9bf9f" }}> {s.unit}</span>}</div>
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(15,32,23,.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(228,190,120,.35)", borderRadius: 999, padding: dot || dots ? "7px 15px 7px 11px" : "7px 14px", fontSize: ".8rem", fontWeight: 700, color: "#f3ede0", textShadow: "0 1px 3px rgba(0,0,0,.4)" }}>
      {dot && <i style={{ width: 9, height: 9, borderRadius: "50%", background: dot, flex: "none" }} />}
      {dots && (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          {Array.from({ length: dots.total }).map((_, i) => (
            <i key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < dots.filled ? "#e4be78" : "rgba(228,190,120,.25)" }} />
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
      {children && <div style={{ fontSize: ".78rem", color: "#6d7263", marginTop: 3, lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
}

// Condition card — light by default, `dark` for the permits/fees treatment
// (matches the prototype's dark "Permits & fees" card).
export function ConditionCard({ label, title, children, dark, cta }) {
  return (
    <div style={dark
      ? { background: COLORS.dark, color: COLORS.cream, borderRadius: 20, padding: 18 }
      : { background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 20, padding: 18 }}>
      {label && <div style={{ ...microLabel, color: dark ? "#b8b19b" : COLORS.muted, marginBottom: 12 }}>{label}</div>}
      {title && <div style={{ fontFamily: numeric, fontWeight: 700, fontSize: "1.2rem" }}>{title}</div>}
      {children && <div style={{ fontSize: ".84rem", color: dark ? "#cfc9b6" : "#4c5443", lineHeight: 1.55, marginTop: title ? 8 : 0 }}>{children}</div>}
      {cta && <div style={{ marginTop: 14 }}>{cta}</div>}
    </div>
  );
}

export function GoldButton({ href, children, onClick }) {
  const style = { textDecoration: "none", display: "inline-block", background: "linear-gradient(120deg,#e4be78,#c79a4b)", color: "#15241c", fontSize: ".78rem", fontWeight: 800, padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit" };
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
          <a key={i} href={it.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 12, padding: "10px 12px", textDecoration: "none", color: COLORS.ink }}>
            <span>
              <b style={{ fontSize: ".85rem", color: COLORS.green, display: "block" }}>{it.name}</b>
              {it.sub && <span style={{ fontSize: ".72rem", color: COLORS.muted }}>{it.sub}</span>}
            </span>
            <span style={{ color: COLORS.muted, fontSize: ".8rem" }}>→</span>
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
        <span key={n} style={{ color: n <= Math.round(value) ? COLORS.gold : "#d9d3c2", fontSize: size || "1rem", lineHeight: 1 }}>★</span>
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
          {r.review_text && <div style={{ fontSize: ".84rem", color: "#4c5443", lineHeight: 1.55 }}>{r.review_text}</div>}
        </div>
      ))}
      {writeHref && (
        <a href={writeHref} style={{ display: "block", textAlign: "center", background: COLORS.card, border: "1px solid " + COLORS.line, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", color: "#2c5562", textDecoration: "none", marginTop: 4 }}>Write a review on the map →</a>
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
