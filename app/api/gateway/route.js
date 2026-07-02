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
