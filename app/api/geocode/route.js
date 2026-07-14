// GET /api/geocode?q=<address or place>
// Turns a typed address / hotel / town into coordinates so Build My Trip can add it
// as a stop. Uses OpenStreetMap's Nominatim (free, no key) server-side so we control
// the User-Agent + caching and don't depend on the Google key having the Geocoding
// API enabled. US-focused (this is a US parks app) but falls back to a global lookup.
export const revalidate = 86400; // a resolved address is stable — cache a day

async function nominatimMany(q, usOnly, limit) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=" + limit + "&addressdetails=1" +
    (usOnly ? "&countrycodes=us" : "") +
    "&q=" + encodeURIComponent(q);
  const r = await fetch(url, {
    headers: { "User-Agent": "ParkBuddy/1.0 (national-parks trip planner)", "Accept-Language": "en" },
    next: { revalidate: 86400 },
  });
  if (!r.ok) return [];
  const arr = await r.json().catch(() => null);
  return Array.isArray(arr) ? arr : [];
}
async function nominatim(q, usOnly) {
  const arr = await nominatimMany(q, usOnly, 1);
  return arr[0] || null;
}
function shortLabel(hit, fallback) {
  const a = hit.address || {};
  // Lead with the feature's own name (Nominatim jsonv2 returns a top-level `name` for
  // any named POI — "Walmart Supercenter", "Zion Lodge") so a business reads as itself,
  // not as its street address. Fall back to typed tags (shop/amenity cover retail, which
  // isn't in tourism/leisure), then the street line, then the town.
  return (hit.name ||
    a.shop || a.amenity || a.tourism || a.attraction || a.hotel || a.leisure || a.office || a.craft || a.building ||
    [a.house_number, a.road].filter(Boolean).join(" ") ||
    a.hamlet || a.village || a.town || a.city ||
    (hit.display_name || fallback || "").split(",")[0] || fallback || "").slice(0, 60);
}
// The secondary line: the address, with the redundant leading name stripped so it reads
// like Google's own secondary_text ("123 Main St, City, ST") rather than repeating "Walmart".
function subLabel(hit, name) {
  const full = hit.display_name || "";
  if (name && full.toLowerCase().startsWith(name.toLowerCase())) return full.slice(name.length).replace(/^[,\s]+/, "");
  return full;
}

// US state abbreviations for the short label.
const ST = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY" };

export async function GET(request) {
  const params = new URL(request.url).searchParams;

  // Reverse mode: turn the device's current lat/lng into a place name.
  if (params.get("rev")) {
    const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
    if (!isFinite(lat) || !isFinite(lng)) return Response.json({ found: false, error: "lat/lng required" }, { status: 400 });
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=" + lat + "&lon=" + lng, { headers: { "User-Agent": "ParkBuddy/1.0 (national-parks trip planner)", "Accept-Language": "en" }, next: { revalidate: 3600 } });
      const hit = r.ok ? await r.json().catch(() => null) : null;
      const a = (hit && hit.address) || {};
      const short = a.town || a.city || a.village || a.hamlet || a.suburb || a.county || (hit && hit.display_name || "").split(",")[0] || "My location";
      return Response.json({ found: true, name: short.slice(0, 60), fullName: (hit && hit.display_name) || "", lat, lng, state: ST[a.state] || "" });
    } catch {
      return Response.json({ found: true, name: "My location", lat, lng, state: "" });
    }
  }

  const q = (params.get("q") || "").trim();
  if (!q) return Response.json({ found: false, error: "q required" }, { status: 400 });

  // Autocomplete mode: return up to 5 matches for a typeahead dropdown.
  if (params.get("suggest")) {
    try {
      let rows = await nominatimMany(q, true, 5);
      if (!rows.length) rows = await nominatimMany(q, false, 5);
      const suggestions = rows
        .filter((h) => h && h.lat != null && h.lon != null)
        .map((h) => { const name = shortLabel(h, q); return { name, sub: subLabel(h, name), fullName: h.display_name || "", lat: Number(h.lat), lng: Number(h.lon), state: ST[(h.address || {}).state] || "" }; });
      return Response.json({ suggestions });
    } catch {
      return Response.json({ suggestions: [] });
    }
  }

  try {
    let hit = await nominatim(q, true);
    if (!hit) hit = await nominatim(q, false); // widen beyond the US if nothing found
    if (!hit || hit.lat == null || hit.lon == null) return Response.json({ found: false });
    const a = hit.address || {};
    const stateName = a.state || "";
    // A short, human label — prefer a named place, else the first line of the address.
    const short =
      a.tourism || a.attraction || a.hotel || a.leisure || a.building ||
      [a.house_number, a.road].filter(Boolean).join(" ") ||
      a.hamlet || a.village || a.town || a.city ||
      (hit.display_name || q).split(",")[0];
    return Response.json({
      found: true,
      name: (short || q).slice(0, 60),
      fullName: hit.display_name || "",
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      state: ST[stateName] || (a.country_code === "us" ? stateName : ""),
    });
  } catch {
    return Response.json({ found: false, error: "geocode failed" }, { status: 503 });
  }
}
