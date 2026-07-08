// POST /api/park-alert — subscribe an email to a park's condition alerts.
// Writes to the Supabase `park_alerts` table with the SERVICE key (server-side),
// which is the right pattern for a public subscribe form: it bypasses RLS safely,
// keeps DB credentials off the client, and lets us validate + rate-shape here.
// The row stores WHICH alerts they want; the actual email SENDER (a scheduled job
// that checks conditions and mails via Resend/SendGrid) is the production
// follow-up — this endpoint just persists the subscription.
export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

export async function POST(request) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) return err("Alerts aren't set up yet — check back soon.", 503);

  let body;
  try { body = await request.json(); } catch { return err("Bad request."); }
  const email = String(body.email || "").trim();
  const parkId = String(body.park_id || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address.");
  if (!parkId) return err("Missing park.");

  const row = {
    park_id: parkId,
    park_name: String(body.park_name || "").slice(0, 120),
    email,
    user_id: null, // email-only subscription for now; account linking is a later step
    alert_verdict: !!body.alert_verdict,
    alert_permit: !!body.alert_permit,
    alert_road: !!body.alert_road,
    alert_flood: !!body.alert_flood,
    alert_snow: !!body.alert_snow,
    active: true,
    updated_at: new Date().toISOString(),
  };

  try {
    // Upsert on (park_id,email) so re-subscribing updates the chosen alert types.
    const resp = await fetch(sb + "/rest/v1/park_alerts?on_conflict=park_id,email", {
      method: "POST",
      headers: {
        apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!resp.ok) return err("Could not save (" + resp.status + ").", 502);
    return Response.json({ ok: true });
  } catch {
    return err("Could not reach the alerts backend.", 502);
  }
}
