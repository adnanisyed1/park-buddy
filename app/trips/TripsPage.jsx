"use client";

import SiteHeader from "../components/SiteHeader";
import useDarkBody from "../lib/useDarkBody";
import TripLibrary from "../components/TripLibrary";

export default function TripsPage() {
  useDarkBody();
  return (
    <div style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)" }}>
      <SiteHeader acctSlot />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(116px,15vh,148px) clamp(16px,4vw,28px) 60px" }}>
        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>Your itineraries</div>
        <h1 style={{ fontFamily: "var(--pb-serif)", fontWeight: 800, fontSize: "clamp(2.1rem,5.5vw,3.2rem)", lineHeight: 1.02, margin: "8px 0 8px" }}>My Trips</h1>
        <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.6, margin: "0 0 26px", maxWidth: "54ch" }}>
          Save any itinerary by name, then search and reopen it anytime. Signed in, your trips follow you across devices.
        </p>
        <TripLibrary />
      </div>
    </div>
  );
}
