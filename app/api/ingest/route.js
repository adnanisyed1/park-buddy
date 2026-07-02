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

// A seed list of major parks (name + center) for ?all=1 runs. Expand over time.
const SEED = [
  ["zion", 37.2982, -113.0263], ["grca", 36.1069, -112.1129], ["yose", 37.8651, -119.5383],
  ["yell", 44.428, -110.5885], ["grte", 43.7904, -110.6818], ["romo", 40.3428, -105.6836],
  ["arch", 38.7331, -109.5925], ["cany", 38.3269, -109.8783], ["brca", 37.593, -112.1871],
  ["glac", 48.7596, -113.787], ["acad", 44.3386, -68.2733], ["grsm", 35.6118, -83.4895],
  ["jotr", 33.8734, -115.901], ["seki", 36.4864, -118.5658], ["olym", 47.8021, -123.6044],
  ["mora", 46.8523, -121.7603], ["shen", 38.4755, -78.4535], ["deva", 36.5054, -117.0794],
  ["care", 38.367, -111.2615], ["sagu", 32.2967, -111.1666], ["badl", 43.8554, -101.9777],
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
  if (!rows.length) return { parkCode, upserted: 0 };
  const resp = await fetch(sb + "/rest/v1/pb_places?on_conflict=id", {
    method: "POST",
    headers: {
      apikey: key, Authorization: "Bearer " + key,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) return { parkCode, error: "supabase " + resp.status + " " + (await resp.text()).slice(0, 120) };
  return { parkCode, upserted: rows.length };
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
