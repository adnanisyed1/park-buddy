"use client";

// A back control that returns you to WHERE YOU CAME FROM (owner call
// 2026-07-23) — real browser history, so a trail opened from the live map
// goes back to the map, from a park page back to the park, from search back
// to search. Only when there's no in-app history to step back into (a direct
// link, a fresh tab) does it fall back to `href` (the map, or the park).
export default function BackPill({ href = "/explore", label = "Back", className, top = 108 }) {
  const onClick = (e) => {
    if (typeof window === "undefined") return;
    // history.length > 1 means this tab has navigated at least once — stepping
    // back lands on the previous page. A length of 1 is a direct arrival, so we
    // let the <a href> take over as a sensible fallback.
    if (window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  };
  return (
    <a
      href={href}
      onClick={onClick}
      className={className}
      style={{
        position: "fixed", top, left: "clamp(12px,3vw,22px)", zIndex: 60,
        display: "inline-flex", alignItems: "center", gap: 7,
        background: "var(--pb-glass, rgba(11,23,16,.6))",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)", backdropFilter: "blur(16px) saturate(1.4)",
        border: "1px solid var(--pb-line-strong, rgba(217,183,121,.3))", borderRadius: 999,
        padding: "9px 16px 9px 13px", color: "#f4f1ea", textDecoration: "none",
        fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 600, whiteSpace: "nowrap",
        boxShadow: "0 10px 30px -14px rgba(0,0,0,.7)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "1.05rem", lineHeight: 1, marginTop: -1 }}>‹</span>
      {label}
    </a>
  );
}
