// POST /api/pines/report — a viewer flags a Pine (UGC safety / DMCA takedown path).
// Body JSON: { pine_id, reason }. Optional auth (Bearer) attributes the report to a
// user; otherwise it's attributed to the caller IP. A unique index keeps one report
// per (pine, reporter) so a single griefer can't inflate the count. When a Pine
// crosses PINES_REPORT_THRESHOLD distinct reports it is AUTO-HIDDEN (status →
// 'under_review'), dropping out of the public feed (which only shows 'approved')
// pending an admin decision in the moderation queue. This gives us a working
// notice-and-takedown mechanism (DMCA safe harbor) before a full trust&safety stack.
//
//   Table SQL (run once in Supabase):
//     create table pine_reports (
//       id bigint generated always as identity primary key,
//       pine_id bigint not null,
//       reporter_id uuid,
//       reporter_ip text,
//       reason text,
//       created_at timestamptz default now()
//     );
//     create unique index pine_reports_uniq on pine_reports
//       (pine_id, coalesce(reporter_id::text, reporter_ip));
//     create index on pine_reports (pine_id);
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp } from "../../../lib/ratelimit";

export const runtime = "nodejs";

function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";
const THRESHOLD = Number(process.env.PINES_REPORT_THRESHOLD || 3);

async function userFromToken(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try { const a = createClient(sbBase(), ANON); const { data, error } = await a.auth.getUser(token); return error ? null : (data && data.user) || null; } catch { return null; }
}

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Reporting isn't set up yet — check back soon." }, { status: 503 });

  const ip = clientIp(request);
  const rl = await rateLimit("pines-report:" + ip, { limit: 20, windowMs: 300_000 });
  if (!rl.ok) return Response.json({ error: rl.error }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const pineId = parseInt(b.pine_id, 10);
  const reason = String(b.reason || "").trim().slice(0, 500);
  if (!pineId) return Response.json({ error: "Missing pine id." }, { status: 400 });

  const user = await userFromToken(request);
  const auth = { apikey: svc, Authorization: "Bearer " + svc };

  // Insert the report (ignore duplicate from the same reporter via the unique index).
  try {
    const r = await fetch(sb + "/rest/v1/pine_reports", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ pine_id: pineId, reporter_id: user ? user.id : null, reporter_ip: user ? null : ip, reason: reason || null }),
    });
    // 404/400 typically means the table hasn't been created yet — degrade honestly.
    if (r.status === 404 || r.status === 400) return Response.json({ error: "Reporting isn't set up yet — check back soon." }, { status: 503 });
    if (!r.ok && r.status !== 409) return Response.json({ error: "Couldn't file the report just now." }, { status: 502 });
  } catch { return Response.json({ error: "Couldn't reach the backend." }, { status: 502 }); }

  // Count distinct reports; auto-hide once the threshold is crossed.
  try {
    const c = await fetch(sb + "/rest/v1/pine_reports?pine_id=eq." + pineId + "&select=id", { headers: { ...auth, Prefer: "count=exact" } });
    const total = Number((c.headers.get("content-range") || "").split("/")[1] || 0);
    if (total >= THRESHOLD) {
      // Only pull down a currently-live Pine; never resurrect an already-removed one.
      await fetch(sb + "/rest/v1/pines?id=eq." + pineId + "&status=eq.approved", {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "under_review" }),
      });
    }
  } catch { /* the report is filed; count/hide is best-effort */ }

  return Response.json({ ok: true, reported: true });
}
