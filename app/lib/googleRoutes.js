// Routes API (New) client — the modern replacement for the legacy DirectionsService,
// which Google no longer enables on new Cloud projects. Called client-side with the same
// public, referrer-restricted Maps key the app already uses (Google serves this endpoint
// with CORS, so a browser fetch works exactly like the old JS service did).
//
// Returns a normalized shape the callers already expect, so route lines keep hugging the
// road: `path` is the precise per-step geometry decoded via the geometry library, falling
// back to the route's overview polyline.
//   { ok, path: [google.maps.LatLng], meters, secs, legEndpoints: [{lat,lng}], status }

function mapsKey() {
  try { const k = localStorage.getItem("pb_gmaps_key"); if (k) return k; } catch {}
  return (typeof window !== "undefined" && window.GMAPS_KEY) || "";
}

// A request waypoint from either {lat,lng}, a google LatLng, or a string address —
// matching what the legacy DirectionsService accepted for origin/destination/waypoints.
function waypoint(p) {
  if (p == null) return null;
  if (typeof p === "string") return { address: p };
  const lat = typeof p.lat === "function" ? p.lat() : p.lat;
  const lng = typeof p.lng === "function" ? p.lng() : p.lng;
  if (lat == null || lng == null) return null;
  return { location: { latLng: { latitude: lat, longitude: lng } } };
}
function llOf(loc) {
  const c = loc && loc.latLng;
  if (!c) return null;
  return { lat: c.latitude, lng: c.longitude };
}

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.polyline.encodedPolyline",
  "routes.legs.startLocation",
  "routes.legs.endLocation",
].join(",");

// Compute one driving route a → b (with optional intermediate `opts.via` waypoints).
export async function computeRoute(a, b, opts = {}) {
  const key = mapsKey();
  const g = typeof window !== "undefined" ? window.google : null;
  if (!key || !g || !g.maps) return { ok: false, status: "NO_KEY" };
  const origin = waypoint(a), destination = waypoint(b);
  if (!origin || !destination) return { ok: false, status: "BAD_INPUT" };
  const via = (opts.via || []).map(waypoint).filter(Boolean);
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify({
        origin, destination,
        ...(via.length ? { intermediates: via } : {}),
        travelMode: "DRIVE",
        polylineQuality: "HIGH_QUALITY",
      }),
    });
    if (!res.ok) return { ok: false, status: res.status === 403 ? "REQUEST_DENIED" : String(res.status) };
    const data = await res.json();
    const route = data && data.routes && data.routes[0];
    if (!route) return { ok: false, status: "ZERO_RESULTS" };
    const enc = g.maps.geometry && g.maps.geometry.encoding;
    let path = [];
    const legs = route.legs || [];
    for (const leg of legs)
      for (const step of (leg.steps || []))
        if (enc && step.polyline && step.polyline.encodedPolyline) path = path.concat(enc.decodePath(step.polyline.encodedPolyline));
    if (!path.length && enc && route.polyline && route.polyline.encodedPolyline) path = enc.decodePath(route.polyline.encodedPolyline);
    const legEndpoints = legs.length ? [llOf(legs[0].startLocation), ...legs.map((l) => llOf(l.endLocation))].filter(Boolean) : [];
    const secs = route.duration ? (parseInt(String(route.duration), 10) || 0) : 0;
    return { ok: path.length > 0, path, meters: route.distanceMeters || 0, secs, legEndpoints, status: "OK" };
  } catch (e) {
    return { ok: false, status: "ERROR", error: String(e) };
  }
}
