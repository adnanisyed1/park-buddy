"use client";

// Platform light/dark theme store. The user's choice ("light" | "dark") is written
// to <html data-theme> and persisted in localStorage; a no-flash script in the root
// layout applies it before first paint (default = the device's prefers-color-scheme).
// Light values for the --pb-* tokens live in globals.css under
// `html[data-theme="light"] .pb-theme` — so a page only goes light when it opts in
// with the `.pb-theme` class (the landing does; the rest of the platform stays dark
// until each page is migrated — one step at a time).
import { useState, useEffect } from "react";

const KEY = "pb_theme";
const listeners = new Set();

export function getTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setTheme(t) {
  if (typeof document === "undefined") return;
  const v = t === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", v);
  try { localStorage.setItem(KEY, v); } catch {}
  listeners.forEach((l) => l());
}

export function toggleTheme() { setTheme(getTheme() === "light" ? "dark" : "light"); }

export function subscribeTheme(cb) { listeners.add(cb); return () => listeners.delete(cb); }

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
