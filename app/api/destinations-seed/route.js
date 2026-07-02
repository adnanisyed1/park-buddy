// Park Buddy — destinations SEED: load curated, in-repo datasets into Supabase `destinations`.
// GET/POST /api/destinations-seed            seeds national forests (+ any future curated sets)
//
// Reads /national-forests.json (shipped in the repo — never times out, always complete) and
// UPSERTs each as a destination. This is the RELIABLE core: it does not depend on any live
// public API, so the forest layer is always available even if Overpass is down.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (+ optional INGEST_SECRET ?token=)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };

async function upsert(sb, key, rows) {
  if (!rows.length) return 0;
  const resp = await fetch(sb + "/rest/v1/destinations?on_conflict=id", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) throw new Error("supabase " + resp.status + " " + (await resp.text()).slice(0, 160));
  return rows.length;
}

export async function POST(request) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""), key = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) return Response.json({ error: "Set SUPABASE_URL and SUPABASE_SERVICE_KEY." }, { status: 500 });
  const { searchParams } = new URL(request.url);
  if (process.env.INGEST_SECRET && searchParams.get("token") !== process.env.INGEST_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;
  const now = new Date().toISOString();
  const out = {};

  // --- National Forests (curated, in-repo) ---
  try {
    const r = await fetch(origin + "/national-forests.json", { cache: "no-cache" });
    const j = await r.json();
    const rows = (j.forests || []).filter((f) => typeof f.lat === "number" && typeof f.lng === "number").map((f) => ({
      id: "usfs:" + (ST_ABBR[f.state] || "us").toLowerCase() + "-" + slug(f.name),
      name: f.name, type: "national_forest", source: "usfs",
      lat: f.lat, lng: f.lng, state: f.state, url: f.url || "", detail: f.detail || "",
      tier: 1, fetched_at: now, updated_at: now,
    }));
    out.national_forests = await upsert(sb, key, rows);
  } catch (e) { out.national_forests_error = String(e.message || e).slice(0, 160); }

  // --- State Parks (curated, in-repo) ---
  try {
    const r = await fetch(origin + "/state-parks.json", { cache: "no-cache" });
    const j = await r.json();
    const rows = (j.parks || []).filter((f) => typeof f.lat === "number" && typeof f.lng === "number").map((f) => ({
      id: "state:" + (ST_ABBR[f.state] || "us").toLowerCase() + "-" + slug(f.name),
      name: f.name, type: "state_park", source: "state",
      lat: f.lat, lng: f.lng, state: f.state, url: f.url || "", detail: f.detail || "",
      tier: 1, fetched_at: now, updated_at: now,
    }));
    out.state_parks = await upsert(sb, key, rows);
  } catch (e) { out.state_parks_error = String(e.message || e).slice(0, 160); }

  return Response.json({ ok: true, seeded: out });
}

export async function GET(request) { return POST(request); }
