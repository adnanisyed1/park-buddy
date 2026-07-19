"use client";

// The ♥ that saves a place. One tap, everywhere — parks, forests, state parks,
// towns, trails, campgrounds, lakes, scenic drives.
//
// Saving is deliberately NOT filing: this writes to the default shelf and nothing
// else. Choosing a bucket happens later, in the account panel, because asking
// "which list?" on every tap is the thing that stops people saving at all.
//
// The place object is passed whole (see app/lib/saved.js). Pass `ref` — a parkCode,
// byway slug, facility id, anything stable — or two same-named places of the same
// kind will collapse into one entry.
import { useEffect, useState, useCallback } from "react";
import { toggleSave, isSaved, makeId } from "../lib/saved";

export default function SaveButton({
  place,
  size = 34,
  variant = "glass",     // "glass" over a photo · "bare" inside a list row
  onSaved,               // (item) => void — the caller shows the "add to bucket" toast
  label,                 // optional visible text, e.g. "Save"
}) {
  const id = place && (place.id || makeId(place));
  const [on, setOn] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Read after mount only — localStorage isn't available during SSR, and reading it
  // in render would produce a server/client mismatch on every heart on the page.
  useEffect(() => {
    if (!id) return;
    setOn(isSaved(id));
  }, [id]);

  const click = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();      // hearts usually sit inside a link to the place
    if (!place || !place.name) return;
    const res = toggleSave(place);
    setOn(!!res.saved);
    if (res.saved) {
      setPulse(true);
      setTimeout(() => setPulse(false), 260);
      if (onSaved) onSaved(res.item);
    }
  }, [place, onSaved]);

  if (!place || !place.name) return null;

  const glass = variant === "glass";
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? "Saved — tap to remove" : "Save this place"}
      title={on ? "Saved" : "Save"}
      style={{
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: label ? 7 : 0,
        height: size,
        minWidth: label ? undefined : size,
        padding: label ? "0 13px" : 0,
        justifyContent: "center",
        borderRadius: 999,
        background: glass ? "var(--pb-glass-strong)" : "transparent",
        border: glass
          ? "1px solid " + (on ? "var(--pb-gold-2)" : "var(--pb-line)")
          : "1px solid transparent",
        color: on ? "var(--pb-gold)" : "var(--pb-muted)",
        fontFamily: "var(--pb-sans)",
        fontWeight: 600,
        fontSize: ".8rem",
        lineHeight: 1,
        transition: "transform .18s ease, color .18s ease, border-color .18s ease",
        transform: pulse ? "scale(1.18)" : "scale(1)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ fontSize: Math.round(size * 0.46), lineHeight: 1 }} aria-hidden="true">
        {on ? "♥" : "♡"}
      </span>
      {label ? <span>{on ? "Saved" : label}</span> : null}
    </button>
  );
}
