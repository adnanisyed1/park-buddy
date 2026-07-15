"use client";

// Shared shell for the legal / policy pages — the standard platform header, a
// readable centered prose column on the design system, and a footer that cross-links
// the policies. Content is passed as children (plain elements).
import SiteHeader from "./SiteHeader";
import Link from "next/link";

export default function LegalShell({ title, updated, children }) {
  return (
    <>
      <SiteHeader solid />
      <main style={{ background: "var(--pb-bg)", minHeight: "100vh", paddingTop: 118 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 clamp(18px,4vw,28px) 40px", fontFamily: "var(--pb-sans)" }}>
          <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Park Buddy</div>
          <h1 style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "clamp(2rem,5vw,2.8rem)", lineHeight: 1.05, color: "var(--pb-ink)", margin: "6px 0 6px" }}>{title}</h1>
          {updated && <div style={{ fontSize: ".82rem", color: "var(--pb-muted)", marginBottom: 22 }}>Last updated {updated}</div>}
          <div className="pb-legal" style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.7 }}>{children}</div>
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--pb-line)", display: "flex", gap: 18, flexWrap: "wrap", fontSize: ".85rem" }}>
            <Link href="/privacy" style={{ color: "var(--pb-gold)", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "var(--pb-gold)", textDecoration: "none" }}>Terms</Link>
            <Link href="/affiliate-disclosure" style={{ color: "var(--pb-gold)", textDecoration: "none" }}>Affiliate disclosure</Link>
            <Link href="/attributions" style={{ color: "var(--pb-gold)", textDecoration: "none" }}>Data &amp; attributions</Link>
            <Link href="/" style={{ color: "var(--pb-ink-2)", textDecoration: "none" }}>← Back to Park Buddy</Link>
          </div>
        </div>
      </main>
      <style>{`.pb-legal h2{font-family:var(--pb-serif);font-weight:600;font-size:1.35rem;color:var(--pb-ink);margin:28px 0 8px}.pb-legal p{margin:0 0 12px}.pb-legal ul{margin:0 0 12px;padding-left:20px}.pb-legal li{margin:0 0 6px}.pb-legal a{color:var(--pb-gold)}.pb-legal b{color:var(--pb-ink)}`}</style>
    </>
  );
}
