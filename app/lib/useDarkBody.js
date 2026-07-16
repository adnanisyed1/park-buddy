"use client";

import { useEffect } from "react";

// The platform's default <body> background is cream (--bg, #ece4d3) — correct for
// the light pages (home, Book, Shop, legal). Dark pages draw their own dark root,
// but the bare <body>/<html> still shows through anywhere the dark root doesn't
// cover: a fixed-header top strip, or elastic/rubber-band overscroll past the
// content on mobile & trackpads. That reads as a stray cream "banner"/flash.
//
// Any dark page calls useDarkBody() to paint <body> --pb-bg while it's mounted and
// restore the site default on unmount. One hook, applied at each dark shell, kills
// the whole cream-bleed class platform-wide.
export default function useDarkBody() {
  useEffect(() => {
    const prevBg = document.body.style.background;
    document.body.style.background = "var(--pb-bg)";
    return () => { document.body.style.background = prevBg; };
  }, []);
}

// Renderable form for SERVER components (e.g. StatusShell), which can't call hooks
// but can render this client child. Drop <DarkBody /> anywhere in a dark server page.
export function DarkBody() {
  useDarkBody();
  return null;
}
