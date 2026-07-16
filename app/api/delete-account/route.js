// POST /api/delete-account — the signed-in user erases their OWN account + data.
// Data-subject right (GDPR/CCPA "right to erasure"). Auth: Bearer access token; we
// verify it server-side, then the SERVICE key cascades a delete across every table
// that holds this user's data, wipes their Pines storage folder, and finally deletes
// the Supabase auth user. Each step is best-effort (a missing table is ignored) so a
// not-yet-created table never blocks the erasure. The user can only ever delete
// themselves — we key strictly off the verified token's id + email.
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp } from "../../lib/ratelimit";

export const runtime = "nodejs";

function base() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";
const PINES_BUCKET = process.env.SUPABASE_PINES_BUCKET || "pines";

export async function POST(request) {
  const sb = base(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Accounts backend isn't configured." }, { status: 503 });

  const rl = await rateLimit("delete-account:" + clientIp(request), { limit: 5, windowMs: 300_000 });
  if (!rl.ok) return Response.json({ error: rl.error }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

  // Verify the token → the real user (id + email). Can't be spoofed.
  let user;
  try {
    const anon = createClient(sb, ANON);
    const { data, error } = await anon.auth.getUser(token);
    user = data && data.user;
    if (error || !user) return Response.json({ error: "Session expired — sign in again." }, { status: 401 });
  } catch { return Response.json({ error: "Couldn't verify your session." }, { status: 401 }); }

  const admin = createClient(sb, svc, { auth: { autoRefreshToken: false, persistSession: false } });
  const id = user.id, email = (user.email || "").toLowerCase();
  const deleted = [];
  const attempt = async (label, fn) => { try { await fn(); deleted.push(label); } catch { /* table may not exist — skip */ } };

  // 1. User-keyed rows (delete dependents before the auth user).
  await attempt("pines", () => admin.from("pines").delete().eq("user_id", id));
  await attempt("pine_likes", () => admin.from("pine_likes").delete().eq("user_id", id));
  await attempt("pine_comments", () => admin.from("pine_comments").delete().eq("user_id", id));
  await attempt("pine_reports", () => admin.from("pine_reports").delete().eq("reporter_id", id));
  await attempt("user_data", () => admin.from("user_data").delete().eq("id", id));
  if (email) {
    await attempt("book_orders", () => admin.from("book_orders").delete().eq("email", email));
    await attempt("park_alerts", () => admin.from("park_alerts").delete().eq("email", email));
    await attempt("pines_waitlist", () => admin.from("pines_waitlist").delete().eq("email", email));
  }

  // 2. Their uploaded Pines photos (stored under <bucket>/<user.id>/…).
  await attempt("pines-storage", async () => {
    const { data: files } = await admin.storage.from(PINES_BUCKET).list(id, { limit: 1000 });
    if (files && files.length) await admin.storage.from(PINES_BUCKET).remove(files.map((f) => id + "/" + f.name));
  });

  // 3. The auth user itself — last, so a failure above doesn't orphan an authless account.
  let authDeleted = false;
  try { const { error } = await admin.auth.admin.deleteUser(id); authDeleted = !error; } catch {}

  return Response.json({ ok: true, authDeleted, deleted });
}
