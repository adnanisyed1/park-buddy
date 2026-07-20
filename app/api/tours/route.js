// GET /api/tours?lat=…&lng=…&limit=8 — Viator tours near a point, normalized.
//
// The browser never talks to Viator and never sees the key; this route is the
// only door. Responses are cached per rounded coordinate for six hours — tour
// catalogs don't churn, and a basic partner key's rate limit is a budget to
// spend on new places, not on re-asking about Estes Park every page view.
import { NextResponse } from "next/server";
import { viatorConfigured, nearestDestinations, searchProducts } from "../../lib/viator";

export const dynamic = "force-dynamic";

// In-memory, per server process. Keyed by 2-decimal coordinates (~0.7mi cells):
// close enough that a town always hits its own cell, coarse enough that repeat
// views share it.
const CACHE = new Map(); // key -> { at, body }
const TTL = 6 * 3600 * 1000;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  // get() returns null when absent, and Number(null) is 0 — a "valid" point in
  // the Gulf of Guinea. Coerce absent to NaN so the guard actually guards.
  const lat = Number(searchParams.get("lat") ?? NaN);
  const lng = Number(searchParams.get("lng") ?? NaN);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 8, 1), 20);

  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }
  // Not configured is a normal state (key pending, or a fork without one):
  // the UI treats an empty list as "render nothing", never an error box.
  if (!viatorConfigured()) {
    return NextResponse.json({ tours: [], configured: false });
  }

  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${limit}`;
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.body, { headers: { "x-pb-cache": "hit" } });
  }

  try {
    const dests = await nearestDestinations(lat, lng, { max: 2, withinMi: 60 });
    let tours = [];
    // Nearest destination first; only ask the second if the first came back
    // thin. Two searches is the ceiling per cache miss.
    for (const d of dests) {
      const got = await searchProducts(d.id, { count: limit });
      tours = tours.concat(got.map((t) => ({ ...t, destination: d.name, destMi: Math.round(d.distMi) })));
      if (tours.length >= limit) break;
    }
    // De-dupe (a tour can list under two nearby destinations) and cap.
    const seen = new Set();
    tours = tours.filter((t) => {
      const k = t.code || t.url;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, limit);

    const body = { tours, configured: true };
    CACHE.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    // Upstream hiccups degrade to an empty section, not a broken page. The
    // message is logged server-side; the client gets no Viator internals.
    console.error("[tours]", e.message);
    return NextResponse.json({ tours: [], configured: true, degraded: true }, { status: 200 });
  }
}
