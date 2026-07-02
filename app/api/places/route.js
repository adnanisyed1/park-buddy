// Park Buddy — places & recreation (RIDB / Recreation.gov + OpenStreetMap campgrounds).
// GET /api/places?lat=..&lng=..&q=..&radius=..  → nearby recreation areas, federal
// campgrounds & facilities (RIDB), PLUS state-park / private / dispersed campgrounds (OSM).
//
// Needs RIDB_API_KEY (free, ridb.recreation.gov). OSM is free/no key.
// Credit: Recreation.gov / RIDB (federal agencies) + OpenStreetMap contributors.

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = "https://ridb.recreation.gov/api/v1";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

async function ridb(path, params, key) {
  try {
    const url = BASE + path + "?" + new URLSearchParams(params).toString();
    const r = await fetch(url, { headers: { apikey: key, accept: "application/json" }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// State-park / private / dispersed campgrounds from OpenStreetMap. Bounded to 8s so it
// can NEVER stall the response; returns [] on any failure or timeout.
async function osmCamps(lat, lng, radiusMi) {
  try {
    const rM = Math.min(radiusMi, 60) * 1609;
    const A = "(around:" + rM + "," + lat + "," + lng + ")";
    const oq = "[out:json][timeout:8];(" +
      'node["tourism"="camp_site"]["name"]' + A + ";" +
      'way["tourism"="camp_site"]["name"]' + A + ");out tags center 50;";
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy" },
      body: "data=" + encodeURIComponent(oq),
      signal: AbortSignal.timeout(8500),
      next: { revalidate: 86400 },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.elements || []).map((el) => {
      const t = el.tags || {}, c = el.center || el;
      return { name: t.name, type: "campground", description: t.operator || "State / local / private campground", lat: num(c.lat), lng: num(c.lon), url: t.website || "", source: "OpenStreetMap" };
    }).filter((c) => c.name && c.lat != null && c.lng != null);
  } catch {
    return [];
  }
}

export async function GET(request) {
  const key = process.env.RIDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  const q = (searchParams.get("q") || "").trim();
  const radius = Math.min(parseInt(searchParams.get("radius") || "50", 10) || 50, 200);

  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }

  const geo = { latitude: lat, longitude: lng, radius: radius, limit: "50" };

  // Everything runs in PARALLEL (RIDB passes + OSM), so total time = the slowest one,
  // not the sum. OSM is bounded to 8s and degrades to [] — never blocks RIDB pins.
  const [facD, facCampD, recD, osm] = await Promise.all([
    key ? ridb("/facilities", { ...geo, ...(q ? { query: q } : {}) }, key) : null,
    key ? ridb("/facilities", { ...geo, activity: "9" }, key) : null,
    key ? ridb("/recareas", { ...geo, ...(q ? { query: q } : {}) }, key) : null,
    osmCamps(lat, lng, radius),
  ]);

  const clean = (s, n) => String(s || "").replace(/<[^>]+>/g, "").slice(0, n || 200);
  const seenFac = {};

  const rawFac = [].concat((facCampD && facCampD.RECDATA) || [], (facD && facD.RECDATA) || []);
  const facilities = rawFac.map((f) => ({
    name: f.FacilityName,
    type: f.FacilityTypeDescription || "",
    description: clean(f.FacilityDescription, 220),
    lat: num(f.FacilityLatitude),
    lng: num(f.FacilityLongitude),
    reservable: !!f.Reservable,
    phone: f.FacilityPhone || "",
    url: f.FacilityID ? "https://www.recreation.gov/camping/campgrounds/" + f.FacilityID : "",
  })).filter((f) => {
    if (!f.name || f.lat == null || f.lng == null || (f.lat === 0 && f.lng === 0)) return false;
    const k = f.name.toLowerCase(); if (seenFac[k]) return false; seenFac[k] = 1; return true;
  });

  // Merge OSM campgrounds, skipping any already covered by RIDB (by name).
  const osmAdd = (osm || []).filter((c) => { const k = c.name.toLowerCase(); if (seenFac[k]) return false; seenFac[k] = 1; return true; }).slice(0, 30);

  const recAreas = ((recD && recD.RECDATA) || []).map((r) => ({
    name: r.RecAreaName,
    description: clean(r.RecAreaDescription, 220),
    lat: num(r.RecAreaLatitude),
    lng: num(r.RecAreaLongitude),
    phone: r.RecAreaPhone || "",
    url: r.RecAreaID ? "https://www.recreation.gov/gateways/" + r.RecAreaID : "",
  })).filter((r) => r.name && r.lat != null && r.lng != null);

  return Response.json({
    facilities: facilities.concat(osmAdd).slice(0, 70),
    recAreas: recAreas.slice(0, 20),
    credit: "Recreation.gov / RIDB (federal) + OpenStreetMap contributors (state/local/private campgrounds).",
  });
}
