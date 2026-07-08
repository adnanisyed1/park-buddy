// /api/pines
//   POST → create a Pine's metadata row after the video was uploaded to Cloudflare
//          (signed-in; GPS-stamped; status starts 'processing' until the webhook fires)
//   GET  → the public feed of APPROVED Pines (optionally ?place=park:yell), paged
//
// Table SQL (run once in Supabase):
//   create table pines (
//     id bigint generated always as identity primary key,
//     user_id uuid not null,
//     cf_uid text not null,
//     place_type text, place_id text, place_name text,
//     caption text, duration_s int,
//     poster_url text, hls_url text, iframe_url text,
//     lat float8, lng float8, accuracy_m float8, captured_at timestamptz,
//     verified boolean default false,
//     display_lat float8, display_lng float8,
//     status text default 'processing',   -- processing|pending|approved|rejected|removed
//     like_count int default 0, view_count int default 0,
//     created_at timestamptz default now()
//   );
//   create index on pines (status, created_at desc);
//   create index on pines (place_type, place_id, status);
//   create unique index on pines (cf_uid);
import { createClient } from "@supabase/supabase-js";
import { playbackUrls } from "../../lib/cloudflareStream";

export const runtime = "nodejs";

function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

async function userFromToken(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const admin = createClient(sbBase(), ANON);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Pines backend isn't configured." }, { status: 503 });
  const user = await userFromToken(request);
  if (!user) return Response.json({ error: "Sign in to post a Pine." }, { status: 401 });

  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const cf_uid = String(b.uid || "").trim();
  if (!cf_uid) return Response.json({ error: "Missing video." }, { status: 400 });

  const lat = num(b.lat), lng = num(b.lng);
  // Public display coords are snapped to the place (privacy); precise coords stay private.
  // GPS re-verification against the place boundary lands in Phase 1b — for now we record
  // the stamp and leave verified=false (honest: not yet confirmed on-site).
  const row = {
    user_id: user.id,
    cf_uid,
    place_type: String(b.place_type || "").slice(0, 20),
    place_id: String(b.place_id || "").slice(0, 60),
    place_name: String(b.place_name || "").slice(0, 120),
    caption: String(b.caption || "").slice(0, 300),
    duration_s: Number.isFinite(b.duration_s) ? Math.min(120, Math.max(0, parseInt(b.duration_s, 10))) : null,
    lat, lng, accuracy_m: num(b.accuracy_m),
    captured_at: b.captured_at || new Date().toISOString(),
    verified: false,
    ...playbackUrls(cf_uid), // poster/hls/iframe (usable once encoding completes)
    status: "processing",
  };

  try {
    const r = await fetch(sb + "/rest/v1/pines", {
      method: "POST",
      headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!r.ok) return Response.json({ error: "Couldn't save your Pine (" + r.status + ")." }, { status: 502 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Couldn't reach the Pines backend." }, { status: 502 }); }
}

export async function GET(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ pines: [], configured: false });

  const url = new URL(request.url);
  const place = url.searchParams.get("place"); // e.g. "park:yell"
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 20));
  const before = url.searchParams.get("before"); // created_at cursor

  let q = sb + "/rest/v1/pines?status=eq.approved&order=created_at.desc&limit=" + limit +
    "&select=id,cf_uid,place_type,place_id,place_name,caption,duration_s,poster_url,hls_url,iframe_url,verified,display_lat,display_lng,like_count,view_count,created_at";
  if (place && place.includes(":")) {
    const [pt, pid] = place.split(":");
    q += "&place_type=eq." + encodeURIComponent(pt) + "&place_id=eq." + encodeURIComponent(pid);
  }
  if (before) q += "&created_at=lt." + encodeURIComponent(before);

  try {
    const r = await fetch(q, { headers: { apikey: svc, Authorization: "Bearer " + svc } });
    if (!r.ok) return Response.json({ pines: [], configured: true });
    const pines = await r.json();
    return Response.json({ pines: Array.isArray(pines) ? pines : [], configured: true });
  } catch { return Response.json({ pines: [], configured: true }); }
}
