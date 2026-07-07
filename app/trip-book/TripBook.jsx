"use client";

import { useEffect, useRef } from "react";
import "./studio.css";
import { MARKUP, mountStudio } from "./studioSource";

// Trip Book Studio — a living travel-diary keepsake. Ported 1:1 from the Claude
// Design preview (see studioSource.js): a 3-step hub (living diary → theme &
// settings with a live openable preview → a real openable 3D hardcover). The
// engine is imperative, so we inject its markup and run it on mount; the swaps
// (server-cached /api/photo, real photo capture, localStorage persistence) live
// in studioSource.js.
export default function TripBook() {
  const rootRef = useRef(null);

  useEffect(() => {
    // The ported inline styles reference fonts by their literal family names,
    // but next/font self-hosts them under hashed names — so load the literal
    // families for this page (the app isn't CSP-restricted).
    const FID = "tb-studio-fonts";
    if (!document.getElementById(FID)) {
      const l = document.createElement("link");
      l.id = FID;
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap";
      document.head.appendChild(l);
    }

    const el = rootRef.current;
    if (!el) return;
    el.innerHTML = MARKUP;
    let studio;
    try {
      studio = mountStudio();
    } catch (e) {
      console.error("Trip Book Studio failed to mount:", e);
    }
    return () => {
      try {
        studio && studio.destroy && studio.destroy();
      } catch (e) {}
      if (el) el.innerHTML = "";
    };
  }, []);

  return <div className="tbstudio" ref={rootRef} />;
}
