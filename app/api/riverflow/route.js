// GET /api/riverflow?lat=..&lng=..  →  nearest active USGS streamgage's live flow.
// Real data from USGS Water Services (Instantaneous Values), public + no key. Used
// by the park-status Conditions tab's water card. Returns the nearest gauge with a
// discharge reading (cfs) + gauge height if available; null when none nearby. We
// never invent a flow or a flash-flood risk — flash-flood WATCHES come from the NWS
// alerts we already show.
export const revalidate = 900; // 15 min — instantaneous values update ~hourly

function milesBetween(a, b, c, d) {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (c - a) * rad, dLng = (d - b) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  if (!isFinite(lat) || !isFinite(lng)) return Response.json({ error: "lat & lng required" }, { status: 400 });

  const b = 0.4; // ~28 mi box
  const bbox = [lng - b, lat - b, lng + b, lat + b].map((n) => n.toFixed(4)).join(",");
  const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=" + bbox +
    "&parameterCd=00060,00065&siteStatus=active";

  let data;
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000), next: { revalidate: 900 } });
    if (!r.ok) return Response.json({ found: false, degraded: true }, { status: 503 });
    data = await r.json();
  } catch {
    return Response.json({ found: false, degraded: true }, { status: 503 });
  }

  const series = (data && data.value && data.value.timeSeries) || [];
  const sites = {};
  for (const ts of series) {
    const si = ts.sourceInfo || {};
    const code = (si.siteCode && si.siteCode[0] && si.siteCode[0].value) || "";
    if (!code) continue;
    const geo = si.geoLocation && si.geoLocation.geogLocation;
    const paramCode = ts.variable && ts.variable.variableCode && ts.variable.variableCode[0] && ts.variable.variableCode[0].value;
    const v = ts.values && ts.values[0] && ts.values[0].value && ts.values[0].value[0];
    const val = v && v.value != null ? parseFloat(v.value) : null;
    if (val == null || val < 0) continue; // -999999 = no data
    const s = sites[code] || (sites[code] = {
      name: (si.siteName || "").replace(/,?\s*(UT|AZ|CO|NV|WY|MT|CA|NM|ID|OR|WA|TX)$/i, ""),
      lat: geo ? parseFloat(geo.latitude) : null, lng: geo ? parseFloat(geo.longitude) : null,
      cfs: null, gaugeFt: null, dateTime: v.dateTime || null,
    });
    if (paramCode === "00060") s.cfs = Math.round(val);
    if (paramCode === "00065") s.gaugeFt = Math.round(val * 100) / 100;
  }

  const withFlow = Object.values(sites)
    .filter((s) => s.cfs != null && s.lat != null)
    .map((s) => ({ ...s, distanceMi: Math.round(milesBetween(lat, lng, s.lat, s.lng)) }))
    .sort((a, b2) => a.distanceMi - b2.distanceMi);

  if (!withFlow.length) return Response.json({ found: false });
  return Response.json({ found: true, gauge: withFlow[0], source: "USGS Water Services" });
}
