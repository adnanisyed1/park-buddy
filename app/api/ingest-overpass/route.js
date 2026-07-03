// Park Buddy — receive PRE-FETCHED Overpass trail data for one park and upsert
// it into Supabase (pb_trails).
//
// This endpoint deliberately does NOT call Overpass itself. Overpass rate-limits
// and blocks datacenter/serverless IPs (Netlify's included). Instead,
// scripts/seed-nearby.mjs fetches from a network Overpass actually allows (run
// locally) and POSTs the results here. This route only needs
// SUPABASE_SERVICE_KEY, already configured in Netlify for the other ingest routes.
//
// Lakes used to go through here too (pb_places, type=water), but now come live
// from USGS GNIS (app/api/water/route.js) — a government service with no
// rate-limit problem, so no seeding is needed for lakes anymore.
//
// POST /api/ingest-overpass?token=<INGEST_SECRET, optional>
// Body: { parkCode, trails: {hiking:[],offroad:[],ski:[]} }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trailId(parkCode, category, name, idx) {
  const s = "trail_" + parkCode + "_" + category + "_" + String(name).toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + idx;
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return "t" + (h >>> 0).toString(36);
}

export async function POST(request) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) {
    return Response.json({ error: "Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars to enable ingestion." }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  if (process.env.INGEST_SECRET && searchParams.get("token") !== process.env.INGEST_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
  const { parkCode, trails } = body || {};
  if (!parkCode) return Response.json({ error: "parkCode required" }, { status: 400 });

  const now = new Date().toISOString();
  let trailsUpserted = 0;

  if (trails && typeof trails === "object") {
    const rows = [];
    ["hiking", "offroad", "ski"].forEach((cat) => {
      (trails[cat] || []).forEach((t, idx) => {
        if (!t || !Array.isArray(t.path) || t.path.length < 2) return;
        const mid = t.path[Math.floor(t.path.length / 2)];
        rows.push({
          id: trailId(parkCode, cat, t.name || "trail", idx), name: t.name || "Unnamed trail", category: cat,
          difficulty: t.difficulty || "", path: t.path, lat: mid[0], lng: mid[1],
          park_code: parkCode, fetched_at: now, updated_at: now,
        });
      });
    });
    if (rows.length) {
      const r = await fetch(sb + "/rest/v1/pb_trails?on_conflict=id", {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!r.ok) return Response.json({ error: "trails upsert failed " + r.status + " " + (await r.text()).slice(0, 150) }, { status: 502 });
      trailsUpserted = rows.length;
    }
  }

  return Response.json({ ok: true, parkCode, trailsUpserted });
}
