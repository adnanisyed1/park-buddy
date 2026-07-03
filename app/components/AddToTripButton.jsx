"use client";

import { useState } from "react";

// Writes to the SAME pp_trip2 localStorage schema the legacy park-status/
// build-trip embed pages already use ({ s: [{ pid, ni, lo }] }), cloud-synced
// via public/auth.js's TRACK list. The new React ExploreApp/BuildTripApp
// don't read this key yet (their own trip state isn't persisted at all) —
// this is still the one real, working trip-cart mechanism in the app today.
function addToTrip(pid, label) {
  if (pid == null) return { ok: false, exists: false };
  let t = {};
  try { t = JSON.parse(localStorage.getItem("pp_trip2") || "{}") || {}; } catch { t = {}; }
  if (!t.s) t.s = [];
  const exists = t.s.some((s) => s.pid === pid && s.lo === label);
  if (!exists) {
    t.s.push({ pid, ni: 1, lo: label || "" });
    try { localStorage.setItem("pp_trip2", JSON.stringify(t)); } catch {}
  }
  return { ok: true, exists };
}

export default function AddToTripButton({ pid, label, itemName }) {
  const [msg, setMsg] = useState(null);
  if (pid == null) return null;
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => {
          const { exists } = addToTrip(pid, label);
          setMsg(exists ? (itemName || "This") + " is already in your trip" : "Added " + (itemName || "it") + " to your trip ✓");
          clearTimeout(window.__pbTripMsgT);
          window.__pbTripMsgT = setTimeout(() => setMsg(null), 2400);
        }}
        style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: ".78rem", fontWeight: 800, color: "#15241c", background: "linear-gradient(120deg,#e4be78,#c79a4b)", padding: "9px 16px", borderRadius: 999 }}
      >
        + Add to trip
      </button>
      {msg && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#22261f", color: "#f3efe7", fontSize: ".76rem", fontWeight: 700, padding: "8px 13px", borderRadius: 999, whiteSpace: "nowrap", boxShadow: "0 10px 26px -12px rgba(0,0,0,.5)" }}>{msg}</div>
      )}
    </div>
  );
}
