// Park Buddy — destinations ingest: state parks + national forests → Supabase `destinations`.
// GET/POST /api/destinations-ingest?all=1            loop all states (paged, 1 per call)
//          /api/destinations-ingest?state=Colorado   one state (optional &m=1 to rotate mirror)
//
// Source: OpenStreetMap via Overpass (named protected areas) — a free, programmatic stand-in
// for PAD-US returning clean named state parks & national forests with center coords.
// Uses fast BBOX queries (not slow area[] resolution) with a short abort so the serverless
// function always responds under the platform timeout (no 502). Upserts via SERVICE-ROLE key.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (+ optional INGEST_SECRET ?token=)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "Florida","Georgia","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana",
  "Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana",
  "Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","Hawaii",
];
const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };
// south, west, north, east
const STATE_BBOX = {
  Alabama:[30.1,-88.5,35.1,-84.9],Alaska:[51.2,-179.9,71.5,-129.9],Arizona:[31.3,-114.9,37.0,-109.0],Arkansas:[33.0,-94.7,36.5,-89.6],California:[32.5,-124.5,42.1,-114.1],Colorado:[36.9,-109.1,41.1,-102.0],Connecticut:[40.9,-73.8,42.1,-71.7],Delaware:[38.4,-75.8,39.9,-75.0],Florida:[24.4,-87.7,31.1,-79.9],Georgia:[30.3,-85.7,35.1,-80.8],Idaho:[41.9,-117.3,49.1,-111.0],Illinois:[36.9,-91.6,42.6,-87.4],Indiana:[37.7,-88.1,41.8,-84.7],Iowa:[40.3,-96.7,43.6,-90.1],Kansas:[36.9,-102.1,40.1,-94.5],Kentucky:[36.5,-89.6,39.2,-81.9],Louisiana:[28.9,-94.1,33.1,-88.8],Maine:[42.9,-71.1,47.5,-66.9],Maryland:[37.9,-79.5,39.8,-75.0],Massachusetts:[41.2,-73.6,42.9,-69.9],Michigan:[41.6,-90.5,48.3,-82.3],Minnesota:[43.4,-97.3,49.5,-89.4],Mississippi:[30.1,-91.7,35.1,-88.0],Missouri:[35.9,-95.8,40.7,-89.0],Montana:[44.3,-116.1,49.1,-104.0],Nebraska:[39.9,-104.1,43.1,-95.2],Nevada:[35.0,-120.1,42.1,-114.0],"New Hampshire":[42.6,-72.6,45.4,-70.6],"New Jersey":[38.8,-75.6,41.4,-73.8],"New Mexico":[31.3,-109.1,37.1,-103.0],"New York":[40.4,-79.8,45.1,-71.8],"North Carolina":[33.8,-84.4,36.6,-75.4],"North Dakota":[45.9,-104.1,49.1,-96.5],Ohio:[38.3,-84.9,42.4,-80.5],Oklahoma:[33.6,-103.1,37.1,-94.4],Oregon:[41.9,-124.6,46.3,-116.4],Pennsylvania:[39.7,-80.6,42.3,-74.7],"Rhode Island":[41.1,-71.9,42.1,-71.1],"South Carolina":[32.0,-83.4,35.3,-78.5],"South Dakota":[42.4,-104.1,46.0,-96.4],Tennessee:[34.9,-90.4,36.7,-81.6],Texas:[25.8,-106.7,36.6,-93.5],Utah:[36.9,-114.1,42.1,-109.0],Vermont:[42.7,-73.5,45.1,-71.5],Virginia:[36.5,-83.7,39.5,-75.2],Washington:[45.5,-124.9,49.1,-116.9],"West Virginia":[37.1,-82.7,40.7,-77.7],Wisconsin:[42.4,-92.9,47.1,-86.8],Wyoming:[40.9,-111.1,45.1,-104.0],Hawaii:[18.9,-160.3,22.3,-154.8],
};

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

async function overpass(query, mirrorIdx) {
  const url = OVERPASS_MIRRORS[(mirrorIdx || 0) % OVERPASS_MIRRORS.length];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy/1.0 (destinations ingest)" },
      body: "data=" + encodeURIComponent(query),
    });
    clearTimeout(timer);
    if (r.ok) return r.json();
    throw new Error("overpass " + r.status);
  } catch (e) { clearTimeout(timer); throw new Error(String(e.message || e)); }
}

function buildQ(box){
  return `[out:json][timeout:14];
(
  relation["boundary"="protected_area"]["name"~"National Forest"](${box});
  relation["boundary"="protected_area"]["protection_title"~"State Park",i](${box});
  relation["leisure"="park"]["name"~"State Park"](${box});
);
out center tags;`;
}
function collect(data, stateName, seen, out){
  for (const el of (data.elements || [])) {
    const t = el.tags || {}; const name = t.name; if (!name) continue;
    const lat = el.lat || (el.center && el.center.lat), lng = el.lon || (el.center && el.center.lon);
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const isForest = /National Forest/i.test(name);
    const id = (isForest ? "usfs:" : "state:") + (ST_ABBR[stateName] || "").toLowerCase() + "-" + slug(name);
    if (seen[id]) continue; seen[id] = 1;
    out.push({
      id, name, type: isForest ? "national_forest" : "state_park", source: isForest ? "usfs" : "state",
      lat, lng, state: stateName, url: t.website || t.url || "", detail: t["description"] || "",
      tier: 1, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
  }
}
async function fetchState(stateName, mirrorIdx) {
  const bb = STATE_BBOX[stateName]; if (!bb) return [];
  const [s, w, n, e] = bb;
  // Large states get tiled into a grid so each Overpass query stays small & fast (avoids 504/timeout).
  const area = (n - s) * (e - w);
  const grid = area > 60 ? 3 : area > 22 ? 2 : 1;
  const seen = {}, out = [];
  let mi = mirrorIdx || 0;
  const deadline = Date.now() + 50000; // overall budget, under maxDuration
  for (let ix = 0; ix < grid; ix++) {
    for (let iy = 0; iy < grid; iy++) {
      if (Date.now() > deadline) return out;
      const ts = s + (n - s) * iy / grid, tn = s + (n - s) * (iy + 1) / grid;
      const tw = w + (e - w) * ix / grid, te = w + (e - w) * (ix + 1) / grid;
      const box = [ts.toFixed(3), tw.toFixed(3), tn.toFixed(3), te.toFixed(3)].join(",");
      try { const data = await overpass(buildQ(box), mi++); collect(data, stateName, seen, out); }
      catch (e) { /* skip this tile; a re-run fills gaps (upsert is idempotent) */ }
    }
  }
  return out;
}

async function upsert(sb, key, rows) {
  if (!rows.length) return 0;
  const resp = await fetch(sb + "/rest/v1/destinations?on_conflict=id", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) throw new Error("supabase " + resp.status + " " + (await resp.text()).slice(0, 140));
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

  async function one(stateName, mirrorIdx) {
    try { const rows = await fetchState(stateName, mirrorIdx); const n = await upsert(sb, key, rows); return { state: stateName, upserted: n }; }
    catch (e) { return { state: stateName, error: String(e.message || e).slice(0, 140) }; }
  }

  if (searchParams.get("all")) {
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
    const stateName = STATES[offset];
    const result = stateName ? await one(stateName, offset) : null;
    const nextOffset = offset + 1, done = nextOffset >= STATES.length;
    return Response.json({
      ok: true, results: result ? [result] : [], totalUpserted: (result && result.upserted) || 0,
      done, next: done ? null : (origin + "/api/destinations-ingest?all=1&offset=" + nextOffset),
    });
  }

  const st = searchParams.get("state");
  if (!st) return Response.json({ error: "Provide ?state=<name> or ?all=1." }, { status: 400 });
  const out = await one(st, parseInt(searchParams.get("m") || "0", 10) || 0);
  return Response.json({ ok: !out.error, ...out });
}

export async function GET(request) { return POST(request); }
