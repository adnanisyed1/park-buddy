// Shared Google Maps JS script loader — browser-only. ExploreApp.jsx loads
// the Maps script itself as part of rendering the main map; pages/components
// with no map of their own (elevation lookups, or a standalone trail map)
// need to load it on demand instead. Idempotent and shared across callers —
// only one <script> tag is ever injected, and every caller awaits the same
// promise, so e.g. an elevation fetch and a map render on the same page never
// race to load the script twice.
//
// Same key resolution as ExploreApp: env-injected window.GMAPS_KEY
// (app/layout.js, site-wide) → localStorage dev fallback (pb_gmaps_key).
let mapsLoadPromise = null;
export function ensureMapsLoaded() {
  if (window.google && window.google.maps) return Promise.resolve(true);
  if (mapsLoadPromise) return mapsLoadPromise;
  let key = "";
  try { key = localStorage.getItem("pb_gmaps_key") || ""; } catch {}
  if (!key && window.GMAPS_KEY) key = window.GMAPS_KEY;
  if (!key) return Promise.resolve(false);
  mapsLoadPromise = new Promise((resolve) => {
    if (document.getElementById("pb-shared-gm-js")) {
      const check = setInterval(() => {
        if (window.google && window.google.maps) { clearInterval(check); resolve(true); }
      }, 200);
      return;
    }
    window.__pbSharedMapsInit = () => resolve(true);
    const s = document.createElement("script");
    s.id = "pb-shared-gm-js";
    s.async = true;
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&libraries=geometry&v=weekly&loading=async&callback=__pbSharedMapsInit";
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}
