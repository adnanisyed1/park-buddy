"use client";

import dynamic from "next/dynamic";

// Same reasoning as the old Explore's client wrapper, and the same bug it was
// written to fix. This is a fully client-only app — it needs window, Google
// Maps and localStorage — and server-rendering it produced hydration
// mismatches (React #418/#423/#425), made worse by browser extensions that
// inject into the DOM before hydration runs.
//
// The rebuild imported the component straight into page.js. It carries
// "use client", which is not the same thing: the component still renders once
// on the server, so every one of those mismatches comes back. ssr:false is what
// actually keeps it off the server.
//
// SEO is unaffected — the crawlable metadata is exported from the server page
// beside this, and the map itself is an app surface rather than content.
const ExploreSplit = dynamic(() => import("./ExploreSplit"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--pb-bg, #0a1712)", color: "var(--pb-gold, #c9a35f)",
      fontFamily: "var(--pb-sans), system-ui, sans-serif", fontWeight: 700 }}>
      Loading the map…
    </div>
  ),
});

export default function ExploreSplitClient() {
  return <ExploreSplit />;
}
