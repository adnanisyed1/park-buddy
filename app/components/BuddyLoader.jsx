// The branded wait — the landing overture in miniature: a gold pine draws
// itself while birds glide past (owner's ask 2026-07-23: loading should show
// the same story as the page-open animation, not a component-library spinner).
//
// No hooks, no client directive: renders on the server so route-level
// loading.js files can stream it instantly. Keyframes (pb-orbit, pb-fly)
// live in globals.css — NOT in an inline style tag; see ParkStatusV2 for the
// hydration scar that rule comes from. Reduced-motion users get a still
// badge with a static ring: the brand without the theater.
export default function BuddyLoader({ text = "Loading…", size = 84, minHeight }) {
  const ring = size + 30;
  const birdColor = "var(--pb-gold-soft)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16, padding: "18px 0", minHeight }}>
      <div style={{ position: "relative", width: ring + 60, height: ring + 26 }}>
        {/* birds, staggered on the same flight path */}
        {[0, 1, 2].map((i) => (
          <svg key={i} className="pb-bird" viewBox="0 0 22 9" width={13 + i * 3} height={(13 + i * 3) * 0.42}
            style={{ position: "absolute", left: 0, top: 4 + i * 8,
              animation: `pb-fly ${3.6 + i * 0.7}s linear ${i * 1.1}s infinite`, opacity: 0 }}>
            <path d="M1 7 Q 6 1 11 7 M11 7 Q 16 1 21 7" fill="none" stroke={birdColor} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ))}
        {/* the landing overture in miniature: a gold line-art pine draws
            itself stroke by stroke, glows once, and begins again — the same
            "fed by light" story, sized for a wait. pathLength normalizes the
            dash math to 300 no matter the glyph's real length. */}
        <svg className="pb-grow-glow" viewBox="0 0 24 26" width={size} height={size * (26 / 24)}
          style={{ position: "absolute", left: "50%", top: "50%", margin: `${-(size * (26 / 24)) / 2}px 0 0 ${-size / 2}px`,
            animation: "pb-grow-glow 2.6s ease-in-out infinite" }} aria-hidden="true">
          <path className="pb-pine-draw"
            d="M12 2 L16.5 9.5 H14 L18.5 16.5 H15.5 L20 23 H4 L8.5 16.5 H5.5 L10 9.5 H7.5 Z M12 23 V25.5"
            pathLength="300" fill="none" stroke="var(--pb-gold)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: 300, strokeDashoffset: 300, animation: "pb-grow 2.6s ease-in-out infinite" }} />
        </svg>
      </div>
      {text && (
        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".22em",
          textTransform: "uppercase", color: "var(--pb-muted)" }}>{text}</div>
      )}
    </div>
  );
}
