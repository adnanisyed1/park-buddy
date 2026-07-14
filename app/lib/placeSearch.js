// Google-Places-powered search for the trip search bars: type anything — a business,
// a gas station, "Walmart", a landmark, an address — and get real matches, exactly
// like Google's search box. Falls back to OpenStreetMap (/api/geocode) when the
// Places library/API isn't available (e.g. no key, or Places API not enabled).
//
// Two-step, like Google: searchPlaces() returns as-you-type predictions (name + a
// secondary line); resolvePlace() turns the chosen one into coordinates on pick.

let acSvc = null, plSvc = null, sessionToken = null;

function places() {
  if (typeof window === "undefined") return null;
  const g = window.google;
  return g && g.maps && g.maps.places ? g.maps.places : null;
}
function ensureSvc() {
  const p = places();
  if (!p) return null;
  if (!acSvc) acSvc = new p.AutocompleteService();
  if (!plSvc) plSvc = new p.PlacesService(document.createElement("div"));
  return p;
}
function newSession() { const p = places(); sessionToken = p && p.AutocompleteSessionToken ? new p.AutocompleteSessionToken() : null; }

// [{ id, name, sub, lat?, lng?, state? }] — id set for Google predictions (resolve on
// pick); lat/lng set for the OSM fallback (already resolved).
export async function searchPlaces(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  const p = ensureSvc();
  if (p) {
    if (!sessionToken) newSession();
    const preds = await new Promise((resolve) => {
      try {
        acSvc.getPlacePredictions({ input: q, sessionToken, componentRestrictions: { country: "us" } }, (r, status) => {
          resolve(status === p.PlacesServiceStatus.OK && r ? r : null);
        });
      } catch { resolve(null); }
    });
    if (preds) return preds.slice(0, 6).map((pr) => ({
      id: pr.place_id,
      name: pr.structured_formatting ? pr.structured_formatting.main_text : pr.description,
      sub: pr.structured_formatting ? pr.structured_formatting.secondary_text : "",
    }));
    // Places errored (e.g. API not enabled) — fall back to OSM.
  }
  return nominatim(q);
}

// Resolve a suggestion to { name, lat, lng, state }. Uses the coords it already has
// (OSM), else a Places details lookup.
export async function resolvePlace(sug) {
  if (!sug) return null;
  if (sug.lat != null) return { name: sug.name, lat: sug.lat, lng: sug.lng, state: sug.state || "" };
  const p = ensureSvc();
  if (p && sug.id) {
    return new Promise((resolve) => {
      try {
        plSvc.getDetails({ placeId: sug.id, fields: ["name", "geometry", "address_components"], sessionToken }, (place, status) => {
          newSession(); // token is consumed by the details call
          if (status !== p.PlacesServiceStatus.OK || !place || !place.geometry) { resolve(null); return; }
          const st = (place.address_components || []).find((c) => c.types.includes("administrative_area_level_1"));
          resolve({ name: sug.name || place.name, lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), state: st ? st.short_name : "" });
        });
      } catch { resolve(null); }
    });
  }
  return null;
}

async function nominatim(q) {
  try {
    const d = await fetch("/api/geocode?suggest=1&q=" + encodeURIComponent(q)).then((r) => r.json());
    return ((d && d.suggestions) || []).map((s) => ({ id: null, name: s.name, sub: s.fullName || s.state || "", lat: s.lat, lng: s.lng, state: s.state }));
  } catch { return []; }
}
