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
      resultRecordCount: "200", f: "json",
    });
    const r = await fetch("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/" + layer + "/query?" + params.toString(), {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.features || []).map((f) => {
      const raw = (f.attributes || {}).gaz_name;
      // GNIS incorporated names carry a legal prefix ("Town of Estes Park") —
      // strip it for display.
      const name = raw ? String(raw).replace(/^(Town|City|Village|Township) of /i, "") : "";
      const g = f.geometry || {};
      const pt = (g.points && g.points[0]) || (g.x != null ? [g.x, g.y] : null);
      if (!name || !pt || pt[0] == null) return null;
      return { tags: { name, place, population: "0" }, lat: pt[1], lon: pt[0] };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function gnisTowns(lat, lng, radiusKm) {
  // Layer 1 = Incorporated Places (real towns/cities — Estes Park, Grand Lake);
  // layer 3 = unincorporated Populated Places. Incorporated ranked as "city"
  // tier so they beat scattered subdivisions, matching the OSM tier logic.
  const [inc, pop] = await Promise.all([
    gnisLayer(1, lat, lng, radiusKm, "city"),
    gnisLayer(3, lat, lng, radiusKm, "town"),
  ]);
  return inc.concat(pop);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  const stateName = (searchParams.get("state") || "").trim();
  const stAbbr = ST_ABBR[stateName] || "";

  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }

  // Widen the search only if the first pass comes up short (remote forests / deserts).
  let els = await osmTowns(lat, lng, 90);
  if (els.length < 3) {
    const wide = await osmTowns(lat, lng, 160);
    if (wide.length) els = wide;
  }
  // Overpass gave nothing at all → USGS GNIS populated places (reliable from server IPs).
  if (!els.length) {
    els = await gnisTowns(lat, lng, 60);
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
    credit: "Towns: OpenStreetMap contributors (ODbL).",
  });
}
