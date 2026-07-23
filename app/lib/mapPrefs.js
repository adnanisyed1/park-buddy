// Platform-wide map appearance: theme (auto / dark / light) + type (auto /
// roadmap / satellite / terrain). Set once (account settings or the map-style
// menu) and every Google map on the site reads it. Persisted in localStorage;
// changes broadcast to live maps on the page.
//
// "auto" is the default and follows the SITE theme (owner call 2026-07-23):
// light theme → terrain imagery with light labels; dark theme → the dark
// roadmap style. An explicit dark/light choice overrides the follow.
import { getTheme, subscribeTheme } from "./theme";

const KEY = "pb_map_prefs";
const DEFAULT = { theme: "auto", type: "auto" };
let cache = null;

export function getMapPrefs() {
  if (cache) return cache;
  try { cache = { ...DEFAULT, ...(JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "{}")) }; }
  catch { cache = { ...DEFAULT }; }
  if (!["auto", "dark", "light"].includes(cache.theme)) cache.theme = DEFAULT.theme;
  if (!["auto", "roadmap", "satellite", "terrain"].includes(cache.type)) cache.type = DEFAULT.type;
  return cache;
}

// The concrete theme/type a map should render right now — "auto" resolved
// against the live site theme.
export function resolveMapPrefs(prefs) {
  const p = prefs || getMapPrefs();
  const siteLight = typeof document !== "undefined" && getTheme() === "light";
  const theme = p.theme === "auto" ? (siteLight ? "light" : "dark") : p.theme;
  const type = p.type === "auto" ? (theme === "light" ? "terrain" : "roadmap") : p.type;
  return { theme, type };
}

export function setMapPrefs(patch) {
  cache = { ...getMapPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pb-map-prefs", { detail: cache }));
  return cache;
}

// Subscribe to live changes (same page). Fires on explicit pref changes AND on
// site-theme flips — in auto mode a theme toggle restyles every live map.
// Returns an unsubscribe fn.
export function subscribeMapPrefs(cb) {
  if (typeof window === "undefined") return () => {};
  const h = () => cb(getMapPrefs());
  window.addEventListener("pb-map-prefs", h);
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cache = null; cb(getMapPrefs()); } });
  const offTheme = subscribeTheme(() => {
    const p = getMapPrefs();
    if (p.theme === "auto" || p.type === "auto") cb(p);
  });
  return () => { window.removeEventListener("pb-map-prefs", h); if (typeof offTheme === "function") offTheme(); };
}

// Map our type name → Google's mapTypeId ("satellite" shows hybrid so labels stay).
export function gmapType(type) {
  return type === "satellite" ? "hybrid" : type === "terrain" ? "terrain" : "roadmap";
}

// A general dark roadmap theme (roads dimmed, kept visible) for maps that don't
// ship their own dark style. Trip Studio / Explore pass their own tuned styles.
export const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0f2318" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a938b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1712" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a4436" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#aab0ba" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#123322" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#16401f" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#26332b" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b756d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b262b" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// The Google Map options for the current prefs, given a page's dark-style array
// (falls back to the shared DARK_STYLE). Dark styling only affects the roadmap
// base; satellite/terrain imagery ignores it.
export function mapOptionsFor(prefs, darkStyle) {
  const r = resolveMapPrefs(prefs);
  return { mapTypeId: gmapType(r.type), styles: r.theme === "dark" && r.type === "roadmap" ? (darkStyle || DARK_STYLE) : null };
}
