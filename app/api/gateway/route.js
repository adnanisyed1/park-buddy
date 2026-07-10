// Park Buddy — gateway / basecamp towns for ANY destination.
// GET /api/gateway?lat=..&lng=..&state=Colorado
//   → nearest real towns & cities (for lodging, food, gas, outfitters), ranked by a
//     blend of distance and population, from live OpenStreetMap data.
//
// This guarantees EVERY park / forest / state park shows real gateway towns — not just
// the curated marquee ones. The client uses its hand-picked list first (editorial quality)
// and falls back to this endpoint for everything else. OSM is free / no key.
// Credit: OpenStreetMap contributors (ODbL).

export const runtime = "nodejs";
export const revalidate = 86400; // towns don't move — cache a day

const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// Great-circle distance in miles.
function distMi(aLat, aLng, bLat, bLng) {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Nearest named towns / cities from OSM. Bounded so it can never stall the response.
async function osmTowns(lat, lng, radiusKm) {
  const rM = Math.round(radiusKm * 1000);
  const A = "(around:" + rM + "," + lat + "," + lng + ")";
  const oq = "[out:json][timeout:15];(" +
    'node["place"="city"]["name"]' + A + ";" +
    'node["place"="town"]["name"]' + A + ";" +
    'node["place"="village"]["name"]' + A + ");out tags 300;";
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy" },
        body: "data=" + encodeURIComponent(oq),
        signal: AbortSignal.timeout(9000),
        next: { revalidate: 86400 },
      });
      if (!r.ok) continue;
      const d = await r.json();
      return d.elements || [];
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

// USGS GNIS "Populated Place" fallback for when Overpass is rate-limiting this
// server's IP (a known, recurring problem — the reason trails/lakes left
// Overpass). Returns pseudo-elements shaped like Overpass nodes so the same
// dedupe/rank pipeline below works unchanged. GNIS has no population data, so
// these rank purely by distance ("town" tier, pop 0) — still real towns.
async function gnisLayer(layer, lat, lng, radiusKm, place) {
  try {
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const params = new URLSearchParams({
      geometry: [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(","),
      geometryType: "esriGeometryEnvelope", inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      where: "1=1",
      outFields: "gaz_name", returnGeometry: "true", outSR: "4326",
      // ArcGIS truncates by OBJECTID (arbitrary order), not proximity — in
      // dense regions a low cap could drop the genuinely nearest town, so ask
      // for the server max; callers keep radii small for the dense layer.
      resultRecordCount: "1000", f: "json",
    });
    const r = await fetch("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/" + layer + "/query?" + params.toString(), {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.features || []).map((f) => {
      const raw = (f.attributes || {}).gaz_name;
      // GNIS incorporated names carry a legal prefix ("Town of Estes Park",
      // "City and County of Denver") — strip it for display.
      const name = raw ? String(raw).replace(/^((City|Town|Village|Township|Borough|Municipality)( and (County|Borough))? of )/i, "") : "";
      const g = f.geometry || {};
      const pt = (g.points && g.points[0]) || (g.x != null ? [g.x, g.y] : null);
      if (!name || !pt || pt[0] == null) return null;
      return { tags: { name, place, population: "0" }, lat: pt[1], lon: pt[0] };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function gnisTowns(lat, lng) {
  // Layer 1 = Incorporated Places (real towns/cities — Estes Park, Grand Lake);
  // layer 3 = unincorporated Populated Places. Incorporated ranked as "city"
  // tier so they beat scattered subdivisions, matching the OSM tier logic.
  // Radii differ deliberately: incorporated places are sparse (60 km stays
  // well under the record cap), but layer 3 counts thousands near metros, so
  // it gets a tight 25 km where the cap can't shadow the nearest places.
  const [inc, pop] = await Promise.all([
    gnisLayer(1, lat, lng, 60, "city"),
    gnisLayer(3, lat, lng, 25, "town"),
  ]);
  return inc.concat(pop);
}

// SOLID FIRST: known parks/forests have precomputed gateway towns in Supabase
// (destinations + gateway_towns). Match the request coords to a stored place and
// return its towns instantly — no live OSM/GNIS call, so a flaky upstream can never
// blank out a known park's gateways. Falls back to live only for coordinates we
// don't have stored (arbitrary user locations, state parks).
async function storedTowns(lat, lng) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return null;
  const h = { apikey: svc, Authorization: "Bearer " + svc };
  const d = 0.06; // ~4mi bbox; callers pass the place's own coords so this matches exactly
  try {
    const dUrl = sb + "/rest/v1/destinations?select=id,lat,lng&type=in.(national_park,national_forest)" +
      "&lat=gte." + (lat - d) + "&lat=lte." + (lat + d) + "&lng=gte." + (lng - d) + "&lng=lte." + (lng + d);
    const dr = await fetch(dUrl, { headers: h, cache: "no-store" });
    if (!dr.ok) return null;
    const rows = await dr.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    let best = null, bestD = Infinity;
    for (const r of rows) { const dm = distMi(lat, lng, r.lat, r.lng); if (dm < bestD) { bestD = dm; best = r; } }
    if (!best || bestD > 3) return null;
    const gUrl = sb + "/rest/v1/gateway_towns?place_id=eq." + encodeURIComponent(best.id) + "&order=rank.asc&select=name,bare_name,lat,lng,distance_mi";
    const gr = await fetch(gUrl, { headers: h, cache: "no-store" });
    if (!gr.ok) return null;
    const towns = (await gr.json() || []).map((t) => ({ name: t.name, bareName: t.bare_name, lat: t.lat, lng: t.lng, distanceMi: t.distance_mi }));
    return towns.length ? towns : null;
  } catch { return null; }
}

// TOWN-CENTRIC search: every basecamp town near a location, regardless of which
// park/forest it's tied to. Dedupes towns that serve several places (Estes Park →
// Rocky Mountain NP + Arapaho-Roosevelt NF) and annotates each with the places it's
// a gateway for. Reads the stored gateway_towns (with a join to destinations).
async function townsNear(lat, lng, radiusMi) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return { towns: [], configured: false };
  const dLat = radiusMi / 69, dLng = radiusMi / (69 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const sel = "select=name,bare_name,lat,lng,distance_mi,place_id,destinations(name,type)";
  const url = sb + "/rest/v1/gateway_towns?" + sel +
    "&lat=gte." + (lat - dLat) + "&lat=lte." + (lat + dLat) + "&lng=gte." + (lng - dLng) + "&lng=lte." + (lng + dLng) + "&limit=600";
  try {
    const r = await fetch(url, { headers: { apikey: svc, Authorization: "Bearer " + svc }, cache: "no-store" });
    if (!r.ok) return { towns: [] };
    const rows = await r.json();
    const map = new Map();
    for (const t of Array.isArray(rows) ? rows : []) {
      const dm = distMi(lat, lng, t.lat, t.lng);
      if (dm > radiusMi) continue;
      const key = (t.bare_name || t.name).toLowerCase();
      const place = t.destinations ? { name: t.destinations.name, type: t.destinations.type } : null;
      let e = map.get(key);
      if (!e) { e = { name: t.name, bareName: t.bare_name, lat: t.lat, lng: t.lng, distanceMi: Math.round(dm), places: [] }; map.set(key, e); }
      if (dm < e.distanceMi) { e.distanceMi = Math.round(dm); e.name = t.name; e.lat = t.lat; e.lng = t.lng; }
      if (place && !e.places.some((p) => p.name === place.name)) e.places.push(place);
    }
    const towns = [...map.values()].sort((a, b) => a.distanceMi - b.distanceMi).slice(0, 30);
    return { towns, credit: "Basecamp towns: curated + USGS GNIS (public domain)." };
  } catch { return { towns: [] }; }
}

// Map mode: EVERY basecamp town inside a viewport rectangle (not just near a point),
// deduped + annotated with the places each serves. This is what the Explore layer
// uses so all towns in view appear, not a nearest-N sample.
async function townsInBbox(bbox) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return { towns: [], configured: false };
  const p = String(bbox).split(",").map(Number);
  if (p.length !== 4 || p.some((n) => !isFinite(n))) return { towns: [] };
  const [minLng, minLat, maxLng, maxLat] = p;
  const sel = "select=name,bare_name,lat,lng,place_id,destinations(name,type)";
  const url = sb + "/rest/v1/gateway_towns?" + sel +
    "&lat=gte." + minLat + "&lat=lte." + maxLat + "&lng=gte." + minLng + "&lng=lte." + maxLng + "&limit=1500";
  try {
    const r = await fetch(url, { headers: { apikey: svc, Authorization: "Bearer " + svc }, cache: "no-store" });
    if (!r.ok) return { towns: [] };
    const rows = await r.json();
    const map = new Map();
    for (const t of Array.isArray(rows) ? rows : []) {
      if (typeof t.lat !== "number" || typeof t.lng !== "number") continue;
      // one pin per town: same name at ~same spot (a town serving several parks) merges.
      const key = (t.bare_name || t.name || "").toLowerCase() + "@" + t.lat.toFixed(1) + "," + t.lng.toFixed(1);
      const place = t.destinations ? { name: t.destinations.name, type: t.destinations.type } : null;
      let e = map.get(key);
      if (!e) { e = { name: t.name, bareName: t.bare_name, lat: t.lat, lng: t.lng, places: [] }; map.set(key, e); }
      if (place && !e.places.some((x) => x.name === place.name)) e.places.push(place);
    }
    return { towns: [...map.values()].slice(0, 700), credit: "Basecamp towns: curated + USGS GNIS (public domain)." };
  } catch { return { towns: [] }; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // Map mode: all basecamp towns in a viewport bbox (no lat/lng needed).
  if (searchParams.get("townsNear") && searchParams.get("bbox")) {
    return Response.json(await townsInBbox(searchParams.get("bbox")));
  }
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  const stateName = (searchParams.get("state") || "").trim();
  const stAbbr = ST_ABBR[stateName] || "";

  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }

  // Town-centric mode: nearest basecamp towns to a point (Ask Park Buddy uses this).
  if (searchParams.get("townsNear")) {
    const radius = Math.min(200, Math.max(5, num(searchParams.get("radius")) || 60));
    return Response.json(await townsNear(lat, lng, radius));
  }

  // Serve the stored, verified towns first — instant, no upstream dependency.
  const stored = await storedTowns(lat, lng);
  if (stored) {
    return Response.json({
      towns: stored,
      blurb: "Closest towns for lodging, food, gas and outfitters — nearest first.",
      dynamic: false,
      source: "stored",
      credit: "Gateway towns: curated + USGS GNIS (public domain).",
    });
  }

  // Widen the search only if the first pass comes up short (remote forests / deserts).
  let els = await osmTowns(lat, lng, 90);
  if (els.length < 3) {
    const wide = await osmTowns(lat, lng, 160);
    if (wide.length) els = wide;
  }
  // Overpass gave nothing at all → USGS GNIS populated places (reliable from server IPs).
  let source = "osm";
  if (!els.length) {
    els = await gnisTowns(lat, lng);
    if (els.length) source = "gnis";
  }

  // Rank tiers: city > town > village. Within a tier, nearer is better. A bigger place a
  // little farther still beats a hamlet next door — that's what makes a real basecamp.
  const RANK = { city: 0, town: 1, village: 2 };
  const rows = els.map((el) => {
    const t = el.tags || {};
    const d = distMi(lat, lng, el.lat, el.lon);
    const pop = parseInt((t.population || "0").replace(/[^0-9]/g, ""), 10) || 0;
    const place = t.place || "town";
    return { bare: t.name, place, distanceMi: Math.round(d), pop, lat: el.lat, lng: el.lon };
  }).filter((r) => r.bare && r.distanceMi <= 160);

  // Dedupe by name (keep the nearest instance).
  const seen = {};
  const uniq = rows.filter((r) => { const k = r.bare.toLowerCase(); if (seen[k] && seen[k] <= r.distanceMi) return false; seen[k] = r.distanceMi; return true; });

  uniq.sort((a, b) => {
    // score = distance + tier penalty − population credit (log-scaled, capped).
    const score = (r) => r.distanceMi + RANK[r.place] * 18 - Math.min(35, Math.log10(r.pop + 1) * 12);
    return score(a) - score(b);
  });

  const towns = uniq.slice(0, 5).map((r) => ({
    name: stAbbr ? r.bare + ", " + stAbbr : r.bare,
    bareName: r.bare,
    lat: r.lat,
    lng: r.lng,
    distanceMi: r.distanceMi,
  }));

  return Response.json({
    towns,
    blurb: towns.length
      ? "Closest towns for lodging, food, gas and outfitters — nearest first."
      : "",
    dynamic: true,
    credit: source === "gnis"
      ? "Towns: USGS Geographic Names Information System (public domain)."
      : "Towns: OpenStreetMap contributors (ODbL).",
  });
}
