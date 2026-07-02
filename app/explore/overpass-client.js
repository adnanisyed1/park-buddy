"use client";

// Browser-side Overpass (OpenStreetMap) client for lakes & trails.
//
// Why client-side: Overpass rate-limits / blocks datacenter IPs, so calling it
// from the Netlify serverless function reliably fails (504 from overpass-api.de,
// timeouts from mirrors). Called from the browser it uses the visitor's own IP,
// which Overpass serves normally, and it supports CORS. Data is cached in
// localStorage so we don't re-hit Overpass for viewports already seen.

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function overpass(query, timeoutMs = 20000) {
  for (const url of ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: "data=" + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      if (r.ok) {
        const d = await r.json();
        if (d && Array.isArray(d.elements)) return d.elements;
      }
    } catch {
      /* next mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };

// ---- lakes & water bodies near a point (radius in km) ----
export async function fetchLakes(lat, lng, radiusKm = 35) {
  const A = "(around:" + Math.min(radiusKm, 80) * 1000 + "," + lat + "," + lng + ")";
  const q =
    "[out:json][timeout:25];(" +
    'way["natural"="water"]["name"]' + A + ";" +
    'relation["natural"="water"]["name"]' + A + ";" +
    'way["water"="lake"]["name"]' + A + ";" +
    'way["water"="reservoir"]["name"]' + A + ";" +
    ");out tags center 80;";
  const els = await overpass(q);
  if (!els) return null; // null = fetch failed (distinct from empty)
  const seen = {}, out = [];
  for (const el of els) {
    const t = el.tags || {};
    const name = t.name;
    if (!name || seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = 1;
    const c = el.center || {};
    const la = num(c.lat), ln = num(c.lon);
    if (la == null || ln == null) continue;
    out.push({ name, lat: la, lng: ln, kind: t.water || t.natural || "water" });
    if (out.length >= 24) break;
  }
  return out;
}

// ---- hiking / off-road / ski routes near a point (radius in km) ----
export async function fetchTrails(lat, lng, radiusKm = 25) {
  const A = "(around:" + Math.min(radiusKm, 60) * 1000 + "," + lat + "," + lng + ")";
  const q =
    "[out:json][timeout:20];(" +
    'way["highway"="path"]["name"]' + A + ";" +
    'way["route"="hiking"]["name"]' + A + ";" +
    'relation["route"="hiking"]["name"]' + A + ";" +
    'way["highway"="track"]["name"]["tracktype"]' + A + ";" +
    'way["4wd_only"="yes"]["name"]' + A + ";" +
    'way["piste:type"]["name"]' + A + ";" +
    ");out tags geom 120;";
  const els = await overpass(q);
  if (!els) return null;
  const seen = {}, hiking = [], offroad = [], ski = [];
  for (const el of els) {
    const t = el.tags || {};
    const name = t.name;
    if (!name || seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = 1;
    let path = null;
    if (Array.isArray(el.geometry) && el.geometry.length) {
      const g = el.geometry, step = Math.max(1, Math.floor(g.length / 40));
      path = g.filter((_, i) => i % step === 0 || i === g.length - 1).map((pt) => [pt.lat, pt.lon]);
    }
    if (!path || path.length < 2) continue;
    const item = { name, difficulty: t.sac_scale || t["piste:difficulty"] || t.tracktype || "", path };
    if (t["piste:type"]) { if (ski.length < 12) ski.push(item); }
    else if (t["4wd_only"] === "yes" || (t.highway === "track" && t.tracktype)) { if (offroad.length < 12) offroad.push(item); }
    else { if (hiking.length < 16) hiking.push(item); }
  }
  return { hiking, offroad, ski };
}
