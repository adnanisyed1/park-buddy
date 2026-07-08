// /api/pines/like
//   POST { pine_id }  → toggle the signed-in user's like; returns { liked, like_count }
//   GET  ?pine_id=..  → { liked, like_count } for the signed-in user (heart state)
// Likes live in pine_likes; a DB trigger keeps pines.like_count in sync.
//   Table SQL (run once in Supabase):
//     create table pine_likes (
//       pine_id bigint not null, user_id uuid not null,
//       created_at timestamptz default now(), primary key (pine_id, user_id)
//     );
//     create or replace function pines_sync_like_count() returns trigger language plpgsql as $$
//     begin update pines set like_count = (select count(*) from pine_likes
//       where pine_id = coalesce(new.pine_id, old.pine_id))
//       where id = coalesce(new.pine_id, old.pine_id); return null; end $$;
//     create trigger t_pine_like after insert or delete on pine_likes
//       for each row execute function pines_sync_like_count();
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

async function userFromToken(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try { const a = createClient(sbBase(), ANON); const { data, error } = await a.auth.getUser(token); return error ? null : (data && data.user) || null; } catch { return null; }
}
async function likeCount(sb, svc, pineId) {
  try { const r = await fetch(sb + "/rest/v1/pines?id=eq." + pineId + "&select=like_count", { headers: { apikey: svc, Authorization: "Bearer " + svc } }); const d = await r.json().catch(() => []); return (d[0] && d[0].like_count) || 0; } catch { return 0; }
}

export async function GET(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ liked: false, like_count: 0, configured: false });
  const pineId = parseInt(new URL(request.url).searchParams.get("pine_id"), 10);
  if (!pineId) return Response.json({ error: "Missing pine_id." }, { status: 400 });
  const user = await userFromToken(request);
  let liked = false;
  if (user) {
    try { const r = await fetch(sb + "/rest/v1/pine_likes?pine_id=eq." + pineId + "&user_id=eq." + user.id + "&select=pine_id", { headers: { apikey: svc, Authorization: "Bearer " + svc } }); const d = await r.json().catch(() => []); liked = Array.isArray(d) && d.length > 0; } catch {}
  }
  return Response.json({ liked, like_count: await likeCount(sb, svc, pineId) });
}

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Not configured." }, { status: 503 });
  const user = await userFromToken(request);
  if (!user) return Response.json({ error: "Sign in to like." }, { status: 401 });
  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const pineId = parseInt(b.pine_id, 10);
  if (!pineId) return Response.json({ error: "Missing pine_id." }, { status: 400 });
  const auth = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };

  // already liked?
  let liked = false;
  try { const r = await fetch(sb + "/rest/v1/pine_likes?pine_id=eq." + pineId + "&user_id=eq." + user.id + "&select=pine_id", { headers: auth }); const d = await r.json().catch(() => []); liked = Array.isArray(d) && d.length > 0; } catch {}

  try {
    if (liked) {
      await fetch(sb + "/rest/v1/pine_likes?pine_id=eq." + pineId + "&user_id=eq." + user.id, { method: "DELETE", headers: auth });
    } else {
      await fetch(sb + "/rest/v1/pine_likes", { method: "POST", headers: { ...auth, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ pine_id: pineId, user_id: user.id }) });
    }
  } catch { return Response.json({ error: "Couldn't update like." }, { status: 502 }); }

  return Response.json({ liked: !liked, like_count: await likeCount(sb, svc, pineId) });
}
