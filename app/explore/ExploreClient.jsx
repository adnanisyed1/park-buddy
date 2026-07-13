"use client";

import dynamic from "next/dynamic";

// The map is a fully client-only app (needs window, Google Maps, localStorage).
// Server-rendering it produced hydration mismatches (React #418/#423/#425) —
// worsened by browser extensions (Grammarly) injecting into the DOM before
// hydration. Loading it with ssr:false renders it purely on the client, which
// removes those errors entirely. SEO isn't affected: the map is an app surface,
// and the crawlable metadata still comes from the server page.
const ExploreApp = dynamic(() => import("./ExploreApp"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#dbe6ea", color: "#1d4a37", fontFamily: "var(--pb-sans), system-ui, sans-serif", fontWeight: 700 }}>
      Loading the map…
    </div>
  ),
});

export default function ExploreClient() {
  return <ExploreApp />;
}
