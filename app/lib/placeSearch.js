// Google-Places-powered search for the trip search bars: type anything — a business,
// a gas station, "Walmart", a landmark, an address — and get real matches, exactly like
// Google's search box. Uses the Places API (New) JS classes (AutocompleteSuggestion +
// Place), the modern replacement for the legacy AutocompleteService/PlacesService, which
// Google no longer enables on new Cloud projects. Falls back to OpenStreetMap
// (/api/geocode) only when the Places library/API isn't available (e.g. no key locally).
//
// Two-step, like Google: searchPlaces() returns as-you-type predictions (name + a
// secondary line); resolvePlace() turns the chosen one into coordinates on pick.

let sessionToken = null;

function places() {
  if (typeof window === "undefined") return null;
  const g = window.google;
  return g && g.maps && g.maps.places ? g.maps.places : null;
}
function newSession() {
  const p = places();
  sessionToken = p && p.AutocompleteSessionToken ? new p.AutocompleteSessionToken() : null;
}

// [{ id, name, sub, _pred?, lat?, lng?, state? }] — _pred set for Places predictions
// (resolve on pick via toPlace()); lat/lng set for the OSM fallback (already resolved).
export async function searchPlaces(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  const p = places();
  if (p && p.AutocompleteSuggestion) {
    if (!sessionToken) newSession();
    try {
      const { suggestions } = await p.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        sessionToken,
        includedRegionCodes: ["us"],
      });
      if (suggestions && suggestions.length) {
        const out = suggestions
          .map((s) => s.placePrediction)
          .filter(Boolean)
          .slice(0, 6)
          .map((pr) => ({
            id: pr.placeId,
            _pred: pr, // hold the prediction so resolvePlace can call toPlace()
            name: pr.mainText ? pr.mainText.text : (pr.text ? pr.text.text : ""),
            sub: pr.secondaryText ? pr.secondaryText.text : "",
          }))
          .filter((x) => x.name);
        if (out.length) return out;
      }
    } catch {
      // Places errored (e.g. API not enabled) — fall back to OSM.
    }
  }
  return nominatim(q);
}

// Resolve a suggestion to { name, lat, lng, state }. Uses the coords it already has
// (OSM), else a Places details fetch on the held prediction.
export async function resolvePlace(sug) {
  if (!sug) return null;
  if (sug.lat != null) return { name: sug.name, lat: sug.lat, lng: sug.lng, state: sug.state || "" };
  const p = places();
  if (p && sug._pred && sug._pred.toPlace) {
    try {
      const place = sug._pred.toPlace();
      await place.fetchFields({ fields: ["displayName", "location", "addressComponents"] });
      newSession(); // the session token is consumed by the details fetch
      const loc = place.location;
      if (!loc) return null;
      const comps = place.addressComponents || [];
      const st = comps.find((c) => (c.types || []).includes("administrative_area_level_1"));
      return {
        name: sug.name || place.displayName || "",
        lat: loc.lat(),
        lng: loc.lng(),
        state: st ? (st.shortText || st.short_name || "") : "",
      };
    } catch {
      return null;
    }
  }
  return null;
}

async function nominatim(q) {
  try {
    const d = await fetch("/api/geocode?suggest=1&q=" + encodeURIComponent(q)).then((r) => r.json());
    return ((d && d.suggestions) || []).map((s) => ({ id: null, name: s.name, sub: s.sub || s.fullName || s.state || "", lat: s.lat, lng: s.lng, state: s.state }));
  } catch { return []; }
}
