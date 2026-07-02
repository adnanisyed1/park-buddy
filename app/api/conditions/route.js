// Park Buddy — live conditions aggregator.
// GET /api/conditions?lat=..&lng=..  →  { weatherAlerts, wildfires, airQuality }
//
// Combines three authoritative sources, all server-side, each best-effort with a
// graceful empty fallback so the page never breaks:
//   - NWS / weather.gov active alerts (FREE, no key) — floods, fire-weather, heat, winter
//   - NIFC wildfire incidents (FREE, no key) — active fires near the point
//   - AirNow air quality (needs AIRNOW_API_KEY; optional) — smoke / AQI
//
// Set AIRNOW_API_KEY in Netlify env vars to enable air quality (free key at airnowapi.org).
// The wildfire feed URL is a constant below — if NIFC changes it, swap it in one place.

export const runtime = "nodejs";
export const revalidate = 600; // 10 min cache

// NIFC active wildfire incident points (ArcGIS). Best-effort; easy to swap if it moves.
const NIFC_FIRES =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Current_WildlandFire_Locations/FeatureServer/0/query";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
function milesBetween(a, b, c, d) {
  const R = 3958.8, t = (x) => (x * Math.PI) / 180;
  const dLat = t(c - a), dLng = t(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function getJSON(url, opts) {
  try {
    const r = await fetch(url, { ...(opts || {}), next: { revalidate: 600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// --- NWS active weather alerts ----------------------------------------------
async function weatherAlerts(lat, lng) {
  const d = await getJSON("https://api.weather.gov/alerts/active?point=" + lat + "," + lng, {
    headers: { "User-Agent": "ParkBuddy (conditions)", Accept: "application/geo+json" },
  });
  const feats = (d && d.features) || [];
  return feats.slice(0, 8).map((f) => {
    const p = f.properties || {};
    return {
      event: p.event || "Alert",
      severity: p.severity || "",
      urgency: p.urgency || "",
      headline: p.headline || "",
      area: p.areaDesc || "",
      effective: p.effective || "",
      expires: p.expires || p.ends || "",
      instruction: (p.instruction || "").slice(0, 400),
      description: (p.description || "").slice(0, 600),
    };
  });
}

// --- NIFC wildfire incidents near the point ---------------------------------
async function wildfires(lat, lng) {
  // Bounding box ~ 1.2° (~80 mi) around the point, ESRI envelope query.
  const d = 1.2;
  const geometry = [lng - d, lat - d, lng + d, lat + d].join(",");
  const params = new URLSearchParams({
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    resultRecordCount: "25",
  });
  const data = await getJSON(NIFC_FIRES + "?" + params.toString());
  const feats = (data && data.features) || [];
  const out = [];
  for (const ft of feats) {
    const a = ft.attributes || {};
    const g = ft.geometry || {};
    const flat = num(g.y), flng = num(g.x);
    const name = a.IncidentName || a.poly_IncidentName || a.FireName || "Wildfire";
    const acres = a.DailyAcres || a.GISAcres || a.IncidentSize || a.poly_GISAcres || null;
    const contain = a.PercentContained != null ? a.PercentContained : a.poly_PercentContained;
    const dist = flat != null && flng != null ? Math.round(milesBetween(lat, lng, flat, flng)) : null;
    out.push({ name, acres: acres != null ? Math.round(acres) : null, percentContained: contain != null ? Math.round(contain) : null, distanceMi: dist });
  }
  // Nearest first, only those reasonably close.
  return out
    .filter((f) => f.distanceMi == null || f.distanceMi <= 80)
    .sort((a, b) => (a.distanceMi ?? 999) - (b.distanceMi ?? 999))
    .slice(0, 6);
}

// --- AirNow air quality (optional key) --------------------------------------
async function airQuality(lat, lng) {
  const key = process.env.AIRNOW_API_KEY;
  if (!key) return null;
  const url =
    "https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=" +
    lat + "&longitude=" + lng + "&distance=75&API_KEY=" + encodeURIComponent(key);
  const arr = await getJSON(url);
  if (!Array.isArray(arr) || !arr.length) return null;
  // Pick the worst (highest AQI) reading among parameters.
  let worst = null;
  for (const o of arr) {
    if (!worst || (o.AQI || 0) > (worst.AQI || 0)) worst = o;
  }
  if (!worst) return null;
  return {
    aqi: worst.AQI,
    category: (worst.Category && worst.Category.Name) || "",
    parameter: worst.ParameterName || "",
    reportingArea: worst.ReportingArea || "",
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }

  const [wx, fires, air] = await Promise.all([
    weatherAlerts(lat, lng),
    wildfires(lat, lng),
    airQuality(lat, lng),
  ]);

  return Response.json({
    weatherAlerts: wx || [],
    wildfires: fires || [],
    airQuality: air || null,
    sources: { weather: "weather.gov", wildfire: "NIFC", air: process.env.AIRNOW_API_KEY ? "AirNow" : "disabled (set AIRNOW_API_KEY)" },
  });
}
