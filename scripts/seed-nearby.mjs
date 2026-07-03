#!/usr/bin/env node
// Park Buddy — one-time (or occasional) seed of TRAIL geometry for all 63
// national parks, sourced from OpenStreetMap/Overpass.
//
// Lakes used to be seeded here too, but now come live from USGS GNIS
// (app/api/water/route.js) — a government service with no rate-limit problem,
// so no seeding is needed for lakes anymore. Trails still need Overpass (no
// free government source has named trail line geometry), so this script is
// still needed for that.
//
// WHY THIS IS A LOCAL SCRIPT, NOT A NETLIFY FUNCTION: Overpass rate-limits and
// blocks datacenter/serverless IPs, so calling it FROM Netlify (even a
// scheduled function) reliably fails. This script fetches from wherever you run
// it (your machine — a normal residential/office network Overpass allows), then
// POSTs the results to the site's /api/ingest-overpass route, which writes to
// Supabase using the SUPABASE_SERVICE_KEY already configured in Netlify. No
// secrets are needed locally — this script never touches Supabase directly.
//
// Run from the repo root:
//   node scripts/seed-nearby.mjs
//   node scripts/seed-nearby.mjs https://theparkbuddy.netlify.app   # override target
//
// Trail geometry barely changes — re-run this every few months, or after
// adding new parks to trip-data.js. Safe to re-run any time (upserts by ID).
// If Overpass is throttling (frequent "FAILED" lines), stop and retry later
// from a different/quieter network rather than looping immediately.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "https://theparkbuddy.netlify.app";
const TRIP_DATA = path.join(__dirname, "..", "public", "trip-data.js");

const js = fs.readFileSync(TRIP_DATA, "utf8");
const parksMatch = js.match(/window\.TRIP_PARKS\s*=\s*(\[[\s\S]*?\]);/);
const codesMatch = js.match(/window\.NPS_CODE\s*=\s*(\{[\s\S]*?\});/);
if (!parksMatch || !codesMatch) {
  console.error("Could not parse TRIP_PARKS / NPS_CODE from " + TRIP_DATA);
  process.exit(1);
}
const PARKS = JSON.parse(parksMatch[1]);
const CODES = JSON.parse(codesMatch[1]);

// maps.mail.ru is fast + generous; overpass-api.de is canonical but rate-limits
// more readily under repeated use (exactly what a 63-park seed run does).
const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: "data=" + encodeURIComponent(query),
      });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.elements)) return d.elements;
      }
    } catch { /* try next mirror */ }
  }
  return null;
}

// NOTE: no relation clause — resolving relation geometries makes the query slow
// enough to hit Overpass's own timeout and silently return 0 elements.
async function trailsFor(p) {
  const A = "(around:25000," + p.lat + "," + p.lng + ")";
  const q =
    "[out:json][timeout:25];(" +
    'way["highway"="path"]["name"]' + A + ";" +
    'way["route"="hiking"]["name"]' + A + ";" +
    'way["highway"="track"]["name"]["tracktype"]' + A + ";" +
    'way["4wd_only"="yes"]["name"]' + A + ";" +
    'way["piste:type"]["name"]' + A + ";" +
    ");out tags geom 100;";
  const els = await overpass(q);
  if (!els) return null;
  const seen = {}, hiking = [], offroad = [], ski = [];
  for (const el of els) {
    const t = el.tags || {}, name = t.name;
    if (!name || seen[name.toLowerCase()]) continue;
    seen[name.toLowerCase()] = 1;
    let pth = null;
    if (Array.isArray(el.geometry) && el.geometry.length) {
      const g = el.geometry, step = Math.max(1, Math.floor(g.length / 25));
      pth = g.filter((_, i) => i % step === 0 || i === g.length - 1).map((pt) => [+pt.lat.toFixed(5), +pt.lon.toFixed(5)]);
    }
    if (!pth || pth.length < 2) continue;
    const item = { name, difficulty: t.sac_scale || t["piste:difficulty"] || t.tracktype || "", path: pth };
    if (t["piste:type"]) { if (ski.length < 10) ski.push(item); }
    else if (t["4wd_only"] === "yes" || (t.highway === "track" && t.tracktype)) { if (offroad.length < 10) offroad.push(item); }
    else { if (hiking.length < 14) hiking.push(item); }
  }
  return { hiking, offroad, ski };
}

async function postIngest(parkCode, trails) {
  const r = await fetch(BASE + "/api/ingest-overpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parkCode, trails: trails || { hiking: [], offroad: [], ski: [] } }),
  });
  if (!r.ok) return { error: "HTTP " + r.status + " " + (await r.text()).slice(0, 150) };
  return r.json();
}

async function main() {
  console.error("Seeding trails for " + PARKS.length + " parks → " + BASE);
  let done = 0;
  const failed = [];
  for (const p of PARKS) {
    const code = CODES[String(p.id)] || p.name.toLowerCase().replace(/[^a-z]/g, "");
    process.stderr.write("[" + (done + 1) + "/" + PARKS.length + "] " + p.name + " ... ");
    const trails = await trailsFor(p);
    await sleep(6000);
    if (!trails) {
      failed.push(p.name);
      process.stderr.write("FAILED (Overpass unreachable — will retry on next run)\n");
      continue;
    }
    const res = await postIngest(code, trails);
    done++;
    if (res.error) process.stderr.write("ingest error: " + res.error + "\n");
    else process.stderr.write("trails:" + res.trailsUpserted + "\n");
  }
  console.error("\nDone. " + done + "/" + PARKS.length + " parks ingested." + (failed.length ? " Failed (re-run to retry): " + failed.join(", ") : ""));
}

main();
