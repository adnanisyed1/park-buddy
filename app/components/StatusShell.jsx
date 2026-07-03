import Link from "next/link";

// Shared look for the new /trail-status, /lake-status, /campground-status
// pages — standalone deep-linkable content pages (SEO + shareable), separate
// from ExploreApp's locked interactive-map panel design. Same brand tokens
// (colors/fonts) as the rest of the app, own simple layout since these have
// no map/interactivity of their own.

export const COLORS = { ink: "#1d3941", green: "#163a2b", gold: "#c79a4b", muted: "#8c8473", cream: "#fffdf7", line: "#ece3d0" };
const sans = "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif";
const serif = "var(--font-spectral), 'Spectral', Georgia, serif";

export function StatusShell({ children, backHref, backLabel }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f1e4", fontFamily: sans, color: COLORS.ink }}>
      <header style={{ padding: "16px 20px", borderBottom: "1px solid " + COLORS.line, background: COLORS.cream }}>
        <Link href="/" style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.05rem", color: COLORS.green, textDecoration: "none" }}>ParkBuddy</Link>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
        {backHref && (
          <Link href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.ink, fontWeight: 700, fontSize: ".85rem", textDecoration: "none", marginBottom: 18 }}>‹ {backLabel || "Back"}</Link>
        )}
        {children}
      </main>
    </div>
  );
}

export function StatusHeader({ icon, name, sub }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: "1.5rem" }}>{icon}</span>
        <h1 style={{ fontFamily: serif, fontSize: "1.5rem", fontWeight: 700, color: COLORS.green, margin: 0 }}>{name}</h1>
      </div>
      {sub && <div style={{ fontSize: ".85rem", color: COLORS.muted, marginBottom: 18 }}>{sub}</div>}
    </>
  );
}

export function StatCard({ children }) {
  return (
    <div style={{ background: COLORS.cream, border: "1px solid " + COLORS.line, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>
    </div>
  );
}

export function StatCell({ label, value, full }) {
  if (value == null || value === "") return null;
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 3 }}>{label}</div>
      <b style={{ fontSize: ".92rem", color: COLORS.green }}>{value}</b>
    </div>
  );
}

export function NearbySection({ title, items }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <a key={i} href={it.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: COLORS.cream, border: "1px solid " + COLORS.line, borderRadius: 12, padding: "10px 12px", textDecoration: "none", color: COLORS.ink }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: COLORS.muted }}>Reviews</span>
        {avg != null && (
          <span style={{ fontSize: ".78rem", color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
            <Stars value={avg} size=".85rem" /> {avg.toFixed(1)} ({reviews.length})
          </span>
        )}
      </div>
      {reviews.length === 0 && <div style={{ fontSize: ".8rem", color: COLORS.muted, marginBottom: 10 }}>No reviews yet.</div>}
      {reviews.map((r, i) => (
        <div key={i} style={{ background: COLORS.cream, border: "1px solid " + COLORS.line, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <b style={{ fontSize: ".82rem", color: COLORS.green }}>{r.author_name || "Explorer"}</b>
            <Stars value={r.rating} size=".8rem" />
          </div>
          {r.review_text && <div style={{ fontSize: ".8rem", color: "#4c5443", lineHeight: 1.5 }}>{r.review_text}</div>}
        </div>
      ))}
      {writeHref && (
        <a href={writeHref} style={{ display: "block", textAlign: "center", background: COLORS.cream, border: "1px solid " + COLORS.line, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", color: "#2c5562", textDecoration: "none", marginTop: 4 }}>Write a review on the map →</a>
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
