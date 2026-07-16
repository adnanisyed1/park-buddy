"use client";

import { useEffect } from "react";

// Catastrophic fallback: catches errors thrown in the ROOT layout itself. It
// replaces <html>/<body>, so globals.css (the --pb-* tokens + fonts) is NOT loaded
// here — every value must be a literal. Kept deliberately minimal and dependency-free
// so it can't itself throw.
export default function GlobalError({ error, reset }) {
  useEffect(() => { console.error("Global error:", error); }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main style={{ minHeight: "100vh", background: "#0a1712", color: "#f4f1ea", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16, padding: "40px 24px" }}>
          <img src="/brand/the-park-buddy-badge.png" alt="The Park Buddy" width={88} height={88} style={{ height: 88, width: 88, objectFit: "contain" }} />
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600, fontSize: "clamp(1.8rem,6vw,2.8rem)", lineHeight: 1.1, margin: 0 }}>Something went wrong.</h1>
          <p style={{ maxWidth: 420, color: "#aab0ba", fontSize: "1rem", lineHeight: 1.55, margin: 0 }}>The app hit an unexpected error. Please try again.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 6 }}>
            <button type="button" onClick={() => reset()} style={{ cursor: "pointer", fontWeight: 700, fontSize: ".9rem", color: "#0a1712", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", border: "none", borderRadius: 999, padding: "12px 22px" }}>Try again</button>
            <a href="/" style={{ textDecoration: "none", fontWeight: 600, fontSize: ".9rem", color: "#f4f1ea", background: "transparent", border: "1px solid rgba(217,183,121,.30)", borderRadius: 999, padding: "12px 22px" }}>Back to base camp</a>
          </div>
        </main>
      </body>
    </html>
  );
}
