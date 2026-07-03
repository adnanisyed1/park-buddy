// Park Buddy — ingestion job: reconcile sources → upsert into Supabase.
// POST /api/ingest?lat=..&lng=..&parkCode=..   (one location)
// POST /api/ingest?all=1                         (loop a built-in seed list of major parks)
//
// Reads our own /api/explore (which aggregates + dedupes every source), then UPSERTs the
// normalized rows into the pb_places table via the Supabase REST API using the SERVICE-ROLE
// key (server-only). Run it on a schedule (e.g. a daily cron / Netlify scheduled function,
// or hit it manually) so the app serves complete, instant data from the table.
//
// Env vars (Netlify):
//   SUPABASE_URL          e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY  the service_role key (SECRET — never the anon key, never client-side)
//   INGEST_SECRET         optional shared secret; if set, callers must pass ?token=<it>

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All 63 national parks (name + center), generated from public/trip-data.js's
// TRIP_PARKS + NPS_CODE. Used for ?all=1 runs so every park (not just ~21
// hand-picked ones) gets a daily-refreshed campgrounds/rec-areas cache.
const SEED = [
  ["dena", 63.1148, -151.1926], ["gaar", 67.7806, -153.3006], ["glba", 58.6658, -136.9002],
  ["katm", 58.5, -154], ["kefj", 59.9187, -150.1533], ["kova", 67.3561, -159.1229],
  ["lacl", 60.9728, -153.4169], ["wrst", 61.4937, -142.6028], ["grca", 36.0544, -112.1401],
  ["pefo", 34.9828, -109.788], ["sagu", 32.2967, -111.1666], ["hosp", 34.5217, -93.0424],
  ["chis", 34.0069, -119.7785], ["deva", 36.5323, -116.9325], ["jotr", 33.8734, -115.901],
  ["kica", 36.8879, -118.5551], ["lavo", 40.4977, -121.4207], ["pinn", 36.4906, -121.1825],
  ["redw", 41.2132, -124.0046], ["sequ", 36.4864, -118.5658], ["yose", 37.8651, -119.5383],
  ["blca", 38.5754, -107.7416], ["grsa", 37.7325, -105.5945], ["meve", 37.1853, -108.4896],
  ["romo", 40.3428, -105.6836], ["bisc", 25.4824, -80.43], ["drto", 24.6283, -82.8733],
  ["ever", 25.2866, -80.8987], ["hale", 20.7204, -156.1552], ["havo", 19.4194, -155.2885],
  ["indu", 41.653, -87.0524], ["maca", 37.1862, -86.1003], ["acad", 44.3386, -68.2733],
  ["isro", 48, -88.8327], ["voya", 48.4839, -92.8387], ["jeff", 38.6247, -90.1851],
  ["glac", 48.7596, -113.787], ["grba", 38.9831, -114.3006], ["cave", 32.1479, -104.5567],
  ["whsa", 32.7791, -106.1717], ["grsm", 35.6532, -83.507], ["thro", 46.9789, -103.5387],
  ["cuva", 41.2808, -81.5678], ["crla", 42.9446, -122.109], ["cong", 33.7948, -80.782],
  ["badl", 43.8554, -102.3397], ["wica", 43.5569, -103.4784], ["bibe", 29.1275, -103.242],
  ["gumo", 31.923, -104.8714], ["arch", 38.683, -109.5925], ["brca", 37.593, -112.1871],
  ["cany", 38.2, -109.93], ["care", 38.0877, -111.1495], ["zion", 37.2982, -113.0263],
  ["shen", 38.2928, -78.6795], ["mora", 46.8523, -121.7603], ["noca", 48.7718, -121.2985],
  ["olym", 47.8021, -123.6044], ["neri", 38.0742, -80.9998], ["grte", 43.7904, -110.6818],
  ["yell", 44.428, -110.5885], ["viis", 18.3458, -64.7281], ["npsa", -14.2592, -170.0807],
];

function id(name, lat, lng) {
  const s = String(name).toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + lat.toFixed(3) + "_" + lng.toFixed(3);
  let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return "p" + (h >>> 0).toString(36);
}

async function ingestOne(origin, lat, lng, parkCode, sb, key) {
  // Use the FAST places source (RIDB) for caching — not /api/explore, whose slow
  // OpenStreetMap trails/water calls would blow the function timeout in a loop.
  const r = await fetch(origin + "/api/places?lat=" + lat + "&lng=" + lng);
  if (!r.ok) return { parkCode, error: "places failed" };
  const data = await r.json();
  const places = [].concat(
    (data.recAreas || []).map((x) => ({ ...x, type: "recreation-area" })),
    (data.facilities || []).map((x) => ({ ...x, type: /camp/i.test(x.type || "") ? "campground" : "facility" })),
  ).filter((p) => p.lat != null && p.lng != null);
  const rows = places.map((p) => ({
    id: id(p.name, p.lat, p.lng),
    name: p.name, type: p.type, lat: p.lat, lng: p.lng,
    url: p.url || "", detail: p.detail || p.description || "", sources: ["Recreation.gov/RIDB"],
    park_code: parkCode || null, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }));
  // De-dupe by id within this batch — two places with the same name+rounded
  // coords (e.g. an RIDB facility also returned by the OSM fallback) hash to
  // the same id, and Postgres's ON CONFLICT rejects a batch that would affect
  // the same row twice in one statement (seen live: Olympic NP, error 21000).
  const seenId = {};
  const dedupedRows = rows.filter((r) => (seenId[r.id] ? false : (seenId[r.id] = true)));
  if (!dedupedRows.length) return { parkCode, upserted: 0 };
  const resp = await fetch(sb + "/rest/v1/pb_places?on_conflict=id", {
    method: "POST",
    headers: {
      apikey: key, Authorization: "Bearer " + key,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(dedupedRows),
  });
  if (!resp.ok) return { parkCode, error: "supabase " + resp.status + " " + (await resp.text()).slice(0, 120) };
  return { parkCode, upserted: dedupedRows.length };
}

export async function POST(request) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""), key = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) {
    return Response.json({ error: "Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars to enable ingestion." }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  if (process.env.INGEST_SECRET && searchParams.get("token") !== process.env.INGEST_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;

  if (searchParams.get("all")) {
    // Process a small batch per call so we never hit the function timeout.
    // Page through with ?all=1&offset=0, then offset=6, offset=12 …
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
    const batch = SEED.slice(offset, offset + 6);
    const results = [];
    for (const [code, lat, lng] of batch) {
      results.push(await ingestOne(origin, lat, lng, code, sb, key));
    }
    const total = results.reduce((a, r) => a + (r.upserted || 0), 0);
    const nextOffset = offset + 6;
    const done = nextOffset >= SEED.length;
    return Response.json({
      ok: true, batch: results.length, totalUpserted: total, results,
      done, next: done ? null : (origin + "/api/ingest?all=1&offset=" + nextOffset),
    });
  }

  const lat = parseFloat(searchParams.get("lat")), lng = parseFloat(searchParams.get("lng"));
  if (!isFinite(lat) || !isFinite(lng)) {
    return Response.json({ error: "Provide lat & lng, or all=1." }, { status: 400 });
  }
  const out = await ingestOne(origin, lat, lng, searchParams.get("parkCode") || null, sb, key);
  return Response.json({ ok: !out.error, ...out });
}

export async function GET(request) {
  return POST(request); // allow a simple browser/cron GET trigger too
}
