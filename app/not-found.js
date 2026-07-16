import Link from "next/link";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

// Branded 404. Server component — renders inside RootLayout, so the --pb-* tokens
// and fonts are available. Full-bleed dark root covers the site's cream <body>.
export default function NotFound() {
  return (
    <main style={wrap}>
      <img src="/brand/the-park-buddy-badge.png" alt="The Park Buddy" width={92} height={92} style={{ height: 92, width: 92, objectFit: "contain", filter: "drop-shadow(0 4px 18px rgba(0,0,0,.5))" }} />
      <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Error 404 · Off the map</div>
      <h1 style={heading}>We couldn&rsquo;t find that page.</h1>
      <p style={sub}>The trail you followed may have moved, or it never existed. Let&rsquo;s get you back on solid ground.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 6 }}>
        <Link href="/" style={btnGold}>Back to base camp</Link>
        <Link href="/explore" style={btnGhost}>Explore the map</Link>
      </div>
    </main>
  );
}

const wrap = {
  minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
  gap: 16, padding: "clamp(24px,6vw,64px)",
};
const heading = { fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "clamp(2rem,6vw,3.2rem)", lineHeight: 1.05, textWrap: "balance", margin: "2px 0 0" };
const sub = { maxWidth: 440, color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.55 };
const btnGold = { textDecoration: "none", fontWeight: 700, fontSize: ".9rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "12px 22px" };
const btnGhost = { textDecoration: "none", fontWeight: 600, fontSize: ".9rem", color: "var(--pb-ink)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "12px 22px" };
