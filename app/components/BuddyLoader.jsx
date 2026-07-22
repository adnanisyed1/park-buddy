// The branded wait — the parchment badge with a gold ring circling it and a
// few birds gliding past (owner's ask: loading should feel like Park Buddy,
// not like a spinner from a component library).
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
        {/* static track + orbiting gold arc */}
        <div style={{ position: "absolute", left: "50%", top: "50%", width: ring, height: ring,
          margin: `${-ring / 2}px 0 0 ${-ring / 2}px`, borderRadius: "50%",
          border: "1.5px solid var(--pb-line)" }} />
        <div className="pb-orbit-arc" style={{ position: "absolute", left: "50%", top: "50%", width: ring, height: ring,
          margin: `${-ring / 2}px 0 0 ${-ring / 2}px`, borderRadius: "50%",
          border: "2px solid transparent", borderTopColor: "var(--pb-gold)", borderRightColor: "rgba(217,183,121,.35)",
          animation: "pb-orbit 1.5s linear infinite" }} />
        <img src="/brand/the-park-buddy-badge.png" alt="" width={size} height={size}
          style={{ position: "absolute", left: "50%", top: "50%", margin: `${-size / 2}px 0 0 ${-size / 2}px`,
            objectFit: "contain", filter: "drop-shadow(0 4px 14px rgba(0,0,0,.35))" }} />
      </div>
      {text && (
        <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".6rem", letterSpacing: ".22em",
          textTransform: "uppercase", color: "var(--pb-muted)" }}>{text}</div>
      )}
    </div>
  );
}
