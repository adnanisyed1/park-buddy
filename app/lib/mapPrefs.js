// Platform-wide map appearance: theme (dark / light) + type (roadmap / satellite
// / terrain). Set once (from the map-style menu) and every Google map on the site
// reads it. Persisted in localStorage; changes broadcast to live maps on the page.
const KEY = "pb_map_prefs";
const DEFAULT = { theme: "dark", type: "roadmap" };
let cache = null;

export function getMapPrefs() {
  if (cache) return cache;
  try { cache = { ...DEFAULT, ...(JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "{}")) }; }
  catch { cache = { ...DEFAULT }; }
  if (!["dark", "light"].includes(cache.theme)) cache.theme = DEFAULT.theme;
  if (!["roadmap", "satellite", "terrain"].includes(cache.type)) cache.type = DEFAULT.type;
  return cache;
}

export function setMapPrefs(patch) {
  cache = { ...getMapPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pb-map-prefs", { detail: cache }));
  return cache;
}

// Subscribe to live changes (same page). Returns an unsubscribe fn.
export function subscribeMapPrefs(cb) {
  if (typeof window === "undefined") return () => {};
  const h = () => cb(getMapPrefs());
  window.addEventListener("pb-map-prefs", h);
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cache = null; cb(getMapPrefs()); } });
  return () => window.removeEventListener("pb-map-prefs", h);
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
  const p = prefs || getMapPrefs();
  return { mapTypeId: gmapType(p.type), styles: p.theme === "dark" && p.type === "roadmap" ? (darkStyle || DARK_STYLE) : null };
}
