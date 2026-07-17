"use client";

// Platform light/dark theme store. The user's choice ("light" | "dark") is written
// to <html data-theme> and persisted in localStorage; a no-flash script in the root
// layout applies it before first paint (default = the device's prefers-color-scheme).
// Light values for the --pb-* tokens live in globals.css under
// `html[data-theme="light"] .pb-theme` — so a page only goes light when it opts in
// with the `.pb-theme` class (the landing does; the rest of the platform stays dark
// until each page is migrated — one step at a time).
import { useState, useEffect, useRef, createElement } from "react";

const KEY = "pb_theme";
const listeners = new Set();

/* ── THE THEME REGISTRY — the one place themes are declared ────────────────────
   To ADD A THEME, this is the whole job:
     1) Add an entry here: { id, label }.
     2) Add a matching palette block in globals.css:
          html[data-theme="<id>"] .pb-theme { --pb-bg: …; --pb-ink: …; … }
        (copy the TEMPLATE comment there and change the colors — nothing else).
   Everything downstream — the toggle/cycle control, persistence, the no-flash
   boot script, <ThemedBody>, every page that opted in with `.pb-theme` — picks it
   up automatically. "dark" is the base palette (globals.css :root); it needs no
   block. No page code changes to add a theme. */
export const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];
const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme() {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.getAttribute("data-theme");
  return THEME_IDS.includes(t) ? t : "dark";
}

export function setTheme(t) {
  if (typeof document === "undefined") return;
  const v = THEME_IDS.includes(t) ? t : "dark";
  document.documentElement.setAttribute("data-theme", v);
  try { localStorage.setItem(KEY, v); } catch {}
  listeners.forEach((l) => l());
}

// Advance to the next registered theme — one control cycles through any number.
export function cycleTheme() {
  const i = THEME_IDS.indexOf(getTheme());
  setTheme(THEME_IDS[(i + 1) % THEME_IDS.length]);
}
// Back-compat name: cycles (dark↔light with two themes; rotates if more are added).
export function toggleTheme() { cycleTheme(); }

export function subscribeTheme(cb) { listeners.add(cb); return () => listeners.delete(cb); }

// Paint <body> to match a themed page's own background, so overscroll / the header
// strip never flash the other theme — and it follows the toggle live. Pass a ref to
// the page's `.pb-theme` root; we copy its resolved background onto <body> while
// mounted and clear it on unmount. (Replaces useDarkBody for pages that honor the
// light/dark toggle; dark-only pages like Explore keep useDarkBody.)
export function useThemedBody(ref) {
  useEffect(() => {
    const apply = () => { const el = ref && ref.current; if (el) document.body.style.background = getComputedStyle(el).backgroundColor; };
    apply();
    const un = subscribeTheme(apply);
    return () => { un(); document.body.style.background = ""; };
  }, [ref]);
}

// Renderable form for SERVER components (e.g. StatusShell): drop <ThemedBody /> inside
// a `.pb-theme` root. It reads that root's resolved background and paints <body> to
// match (following the toggle), so overscroll never flashes the other theme.
export function ThemedBody() {
  const ref = useRef(null);
  useEffect(() => {
    const apply = () => {
      const scope = ref.current && ref.current.closest(".pb-theme");
      if (scope) document.body.style.background = getComputedStyle(scope).backgroundColor;
    };
    apply();
    const un = subscribeTheme(apply);
    return () => { un(); document.body.style.background = ""; };
  }, []);
  return createElement("span", { ref, "aria-hidden": "true", style: { display: "none" } });
}

// SSR-safe: starts "dark" (matches the server render), then syncs to the real
// data-theme after mount so there's no hydration mismatch.
export function useTheme() {
  const [t, setT] = useState("dark");
  useEffect(() => {
    setT(getTheme());
    return subscribeTheme(() => setT(getTheme()));
  }, []);
  return t;
}
