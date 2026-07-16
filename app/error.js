"use client";

import { useEffect } from "react";
import Link from "next/link";

// Branded route-level error boundary. Catches render/runtime errors in any page so
// users see an on-brand recovery screen instead of Next's default. Renders inside
// RootLayout, so --pb-* tokens + fonts are available.
export default function Error({ error, reset }) {
  useEffect(() => {
    // Surface for debugging; production digests land in the platform's logs.
    console.error("Route error:", error);
  }, [error]);

  return (
    <main style={wrap}>
      <img src="/brand/the-park-buddy-badge.png" alt="The Park Buddy" width={92} height={92} style={{ height: 92, width: 92, objectFit: "contain", filter: "drop-shadow(0 4px 18px rgba(0,0,0,.5))" }} />
      <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".22em", textTransform: "uppercase", color: "var(--pb-hold)" }}>Something went wrong</div>
      <h1 style={heading}>This page hit a snag.</h1>
      <p style={sub}>An unexpected error stopped it from loading. You can try again, or head back to safe ground.</p>
      {error?.digest && <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", color: "var(--pb-muted)" }}>Ref: {error.digest}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 6 }}>
        <button type="button" onClick={() => reset()} style={btnGold}>Try again</button>
        <Link href="/" style={btnGhost}>Back to base camp</Link>
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
const btnGold = { cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".9rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "12px 22px" };
const btnGhost = { textDecoration: "none", fontWeight: 600, fontSize: ".9rem", color: "var(--pb-ink)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "12px 22px" };
