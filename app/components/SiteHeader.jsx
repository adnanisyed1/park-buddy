"use client";

import Link from "next/link";

// The one header for the whole platform (Phase A of the design-system rollout).
// Extracted from the approved landing page's glass nav so it matches exactly, and
// built entirely on the --pb-* design tokens (see DESIGN.md). "Plan a trip" is
// intentionally gone — Ask Park Buddy is the planner. Drop <SiteHeader /> at the
// top of any page for instant cross-platform consistency.
//
// Props:
//   active     — optional key to highlight the current section ("explore" | "drives" | ...)
//   solid      — if true, use a solid bar (for pages that scroll under it); default glass.
//   tripCount  — if a number, show a "My Trip" pill with the count (explore uses this).
//   onTripClick— click handler for the My Trip pill.
//   acctSlot   — if true, render the #pp-acct-slot that auth.js mounts the real
//                account / Sign-in UI into (explore), instead of the static button.

const LINKS = [
  { key: "explore", label: "Explore", href: "/explore" },
  { key: "drives", label: "Scenic Drives", href: "/scenic-drives" },
  { key: "stay", label: "Stay & Gear", href: "/#stay" },
  { key: "pro", label: "Pro", href: "/#pro" },
  { key: "learn", label: "Learn", href: "/#learn" },
];

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--pb-ink)" }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--pb-grad-gold)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(217,183,121,.35)" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--pb-bg)"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
      </span>
      <span style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.4rem", letterSpacing: ".01em" }}>Park Buddy</span>
    </Link>
  );
}

export default function SiteHeader({ active, solid = false, tripCount = null, onTripClick, acctSlot = false }) {
  const askBuddy = () => {
    // Trigger the global Ask Park Buddy assistant if it's mounted; otherwise send
    // the visitor to the home hero where the assistant lives.
    const fab = typeof document !== "undefined" && document.querySelector(".pbask-fab, #askPill");
    if (fab) fab.click();
    else if (typeof window !== "undefined") window.location.href = "/#ask";
  };

  return (
    <nav
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "15px clamp(16px,4vw,54px)",
        background: solid ? "var(--pb-bg)" : "rgba(7,10,16,.55)",
        WebkitBackdropFilter: solid ? "none" : "blur(18px) saturate(1.3)",
        backdropFilter: solid ? "none" : "blur(18px) saturate(1.3)",
        borderBottom: "1px solid var(--pb-line)",
        fontFamily: "var(--pb-sans)",
      }}
    >
      <Logo />
      <div className="pb-nav-links" style={{ display: "flex", alignItems: "center", gap: 26, fontSize: ".82rem", fontWeight: 500, color: "#c3c8d0" }}>
        {LINKS.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            style={{ textDecoration: "none", color: active === l.key ? "var(--pb-gold)" : "inherit", transition: "color .3s" }}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {tripCount != null && (
          <button
            type="button"
            onClick={onTripClick}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: "#e7e3d8", fontSize: ".82rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 15px" }}
          >
            🎒 My Trip
            <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".58rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "2px 7px" }}>{tripCount}</span>
          </button>
        )}
        {acctSlot ? (
          // auth.js mounts the real account / Sign-in UI here (falls back to a plain
          // circle pre-load), so sign-in lives in the header — not floating below it.
          <span id="pp-acct-slot" style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(145deg,#33555f,#1d3941)", border: "1px solid rgba(228,190,120,.4)" }} />
          </span>
        ) : (
          <button
            type="button"
            style={{ cursor: "pointer", fontFamily: "inherit", color: "#e7e3d8", fontSize: ".82rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 16px" }}
          >
            Sign in
          </button>
        )}
        <button
          type="button"
          onClick={askBuddy}
          style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", padding: "9px 17px", borderRadius: 999 }}
        >
          Ask Park Buddy
        </button>
      </div>
    </nav>
  );
}
