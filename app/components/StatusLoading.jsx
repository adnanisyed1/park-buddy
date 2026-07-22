// Branded loading skeleton for the deep, server-rendered status/detail pages
// (trail-status, lake-status, campground-status, scenic-drives/[id]). Those pages
// await multi-API server fetches (weather, webcams, Overpass, fees…) with NO
// client-side skeleton, so without this the user stares at a blank tab until the
// server resolves. Next shows this as the route's Suspense fallback — instantly on
// client nav, and as the streamed shell on a cold load. All-dark (#0a1712) to match
// the pages, so there's no flash when the real content swaps in.
import BuddyLoader from "./BuddyLoader";

export default function StatusLoading() {
  const bar = (w, i) => <div key={i} className="pb-sk" style={{ height: 15, width: w, borderRadius: 8 }} />;
  return (
    <div style={{ minHeight: "100vh", background: "#0a1712", color: "#f4f1ea", fontFamily: "var(--pb-sans)" }}>
      <style>{`
        @keyframes pbsheen { 0%{background-position:-360px 0} 100%{background-position:360px 0} }
        .pb-sk { background: linear-gradient(90deg, rgba(217,183,121,.05) 0%, rgba(217,183,121,.13) 50%, rgba(217,183,121,.05) 100%); background-size:720px 100%; animation:pbsheen 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){ .pb-sk{ animation:none } }
      `}</style>

      {/* hero skeleton */}
      <div style={{ position: "relative", minHeight: "clamp(320px,46vh,460px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "clamp(96px,13vh,140px) clamp(16px,4vw,40px) 30px", overflow: "hidden" }}>
        <div className="pb-sk" style={{ position: "absolute", inset: 0 }} />
        {/* the brand over the sheen: badge + orbiting arc + birds */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BuddyLoader text="Reading the outdoors…" />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="pb-sk" style={{ height: 12, width: 130, borderRadius: 6 }} />
          <div className="pb-sk" style={{ height: 46, width: "min(62%,340px)", borderRadius: 12 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[72, 92, 80, 104].map((w, i) => <div key={i} className="pb-sk" style={{ height: 30, width: w, borderRadius: 999 }} />)}
          </div>
        </div>
      </div>

      {/* content skeleton */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "30px 20px 70px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="pb-sk" style={{ height: 120, borderRadius: 16 }} />
        {["90%", "78%", "85%"].map((w, i) => bar(w, i))}
        <div className="pb-sk" style={{ height: 190, borderRadius: 16, marginTop: 8 }} />
      </div>

      <div style={{ position: "fixed", bottom: 20, left: 0, right: 0, textAlign: "center", fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#7f8a82" }}>
        Loading live conditions…
      </div>
    </div>
  );
}
