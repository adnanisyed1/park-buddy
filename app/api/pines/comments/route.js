// /api/pines/comments
//   GET  ?pine_id=..  → { comments: [...] }  (visible comments, oldest→newest)
//   POST { pine_id, body }  → add a comment (signed-in); returns { ok }
// A DB trigger keeps pines.comment_count in sync.
//   Table SQL (run once in Supabase):
//     create table pine_comments (
//       id bigint generated always as identity primary key,
//       pine_id bigint not null, user_id uuid not null,
//       author_name text, body text not null,
//       status text default 'visible', created_at timestamptz default now()
//     );
//     create index on pine_comments (pine_id, created_at);
//     create or replace function pines_sync_comment_count() returns trigger language plpgsql as $$
//     begin update pines set comment_count = (select count(*) from pine_comments
//       where pine_id = coalesce(new.pine_id, old.pine_id) and status = 'visible')
//       where id = coalesce(new.pine_id, old.pine_id); return null; end $$;
//     create trigger t_pine_comment after insert or update or delete on pine_comments
//       for each row execute function pines_sync_comment_count();
import { createClient } from "@supabase/supabase-js";
import { moderateText } from "../../../lib/moderation";

export const runtime = "nodejs";
function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

async function userFromToken(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try { const a = createClient(sbBase(), ANON); const { data, error } = await a.auth.getUser(token); return error ? null : (data && data.user) || null; } catch { return null; }
}

export async function GET(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ comments: [], configured: false });
  const pineId = parseInt(new URL(request.url).searchParams.get("pine_id"), 10);
  if (!pineId) return Response.json({ error: "Missing pine_id." }, { status: 400 });
  try {
    const r = await fetch(sb + "/rest/v1/pine_comments?pine_id=eq." + pineId + "&status=eq.visible&order=created_at.asc&limit=200&select=id,author_name,body,created_at", { headers: { apikey: svc, Authorization: "Bearer " + svc } });
    const comments = await r.json().catch(() => []);
    return Response.json({ comments: Array.isArray(comments) ? comments : [] });
  } catch { return Response.json({ comments: [] }); }
}

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Not configured." }, { status: 503 });
  const user = await userFromToken(request);
  if (!user) return Response.json({ error: "Sign in to comment." }, { status: 401 });
  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const pineId = parseInt(b.pine_id, 10);
  const body = String(b.body || "").trim().slice(0, 600);
  if (!pineId || !body) return Response.json({ error: "Missing comment." }, { status: 400 });
  // Moderate the text. Comments are ephemeral (no manual queue), so only a definite
  // "reject" blocks; clean/unconfigured pass through (a provider outage never eats comments).
  const mod = await moderateText(body);
  if (mod.decision === "reject") return Response.json({ error: "That comment can't be posted — it was flagged by moderation." }, { status: 422 });
  const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "").split("@")[0];
  try {
    const r = await fetch(sb + "/rest/v1/pine_comments", {
      method: "POST",
      headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ pine_id: pineId, user_id: user.id, author_name: name, body, status: "visible" }),
    });
    if (!r.ok) return Response.json({ error: "Couldn't post (" + r.status + ")." }, { status: 502 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Couldn't reach the backend." }, { status: 502 }); }
}
