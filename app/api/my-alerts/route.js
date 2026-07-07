// /api/my-alerts — the signed-in user's park condition-alert subscriptions.
//   GET    → list the alerts tied to their email (park_alerts, active only)
//   DELETE → stop one (?park_id=…), sets active=false
// Auth: caller sends their Supabase access token as `Authorization: Bearer …`.
// We verify it server-side (anon client → getUser) to resolve the real email,
// then read/write park_alerts with the SERVICE key. A user only ever touches
// their own subscriptions. Public subscribing still happens via /api/park-alert.
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function base() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

// Verify the bearer token → the real user's email (can't be spoofed).
async function emailFromToken(sb, request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Not signed in.", status: 401 };
  try {
    const admin = createClient(sb, ANON);
    const { data, error } = await admin.auth.getUser(token);
    const email = data && data.user && data.user.email;
    if (error || !email) return { error: "Session expired — sign in again.", status: 401 };
    return { email };
  } catch { return { error: "Couldn't verify your session.", status: 401 }; }
}

export async function GET(request) {
  const sb = base(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Accounts backend isn't configured." }, { status: 503 });
  const who = await emailFromToken(sb, request);
  if (who.error) return Response.json({ error: who.error }, { status: who.status });

  try {
    const r = await fetch(sb + "/rest/v1/park_alerts?email=eq." + encodeURIComponent(who.email) + "&active=eq.true&order=updated_at.desc&select=park_id,park_name,alert_verdict,alert_permit,alert_road,alert_flood,alert_snow,updated_at", {
      headers: { apikey: svc, Authorization: "Bearer " + svc },
    });
    if (!r.ok) return Response.json({ error: "Couldn't load your alerts." }, { status: 502 });
    const alerts = await r.json();
    return Response.json({ alerts: Array.isArray(alerts) ? alerts : [] });
  } catch { return Response.json({ error: "Couldn't reach the alerts backend." }, { status: 502 }); }
}

export async function DELETE(request) {
  const sb = base(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Accounts backend isn't configured." }, { status: 503 });
  const who = await emailFromToken(sb, request);
  if (who.error) return Response.json({ error: who.error }, { status: who.status });

  const parkId = new URL(request.url).searchParams.get("park_id");
  if (!parkId) return Response.json({ error: "Missing park." }, { status: 400 });

  try {
    // Soft-delete (active=false) so re-subscribing later keeps the row's history.
    const r = await fetch(sb + "/rest/v1/park_alerts?email=eq." + encodeURIComponent(who.email) + "&park_id=eq." + encodeURIComponent(parkId), {
      method: "PATCH",
      headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return Response.json({ error: "Couldn't update (" + r.status + ")." }, { status: 502 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Couldn't reach the alerts backend." }, { status: 502 }); }
}
