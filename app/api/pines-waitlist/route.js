// POST /api/pines-waitlist — capture an email for early access to Pines.
// Writes to the Supabase `pines_waitlist` table with the SERVICE key (server-side),
// same public-subscribe pattern as /api/park-alert. Builds a pre-launch audience.
//   Table SQL (run once in Supabase):
//     create table pines_waitlist (
//       id bigint generated always as identity primary key,
//       email text not null unique,
//       source text, created_at timestamptz default now()
//     );
export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

export async function POST(request) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) return err("Waitlist isn't set up yet — check back soon.", 503);

  let body; try { body = await request.json(); } catch { return err("Bad request."); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address.");

  try {
    const r = await fetch(sb + "/rest/v1/pines_waitlist?on_conflict=email", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ email, source: String(body.source || "pines").slice(0, 40), created_at: new Date().toISOString() }),
    });
    if (!r.ok) return err("Couldn't save (" + r.status + ").", 502);
    return Response.json({ ok: true });
  } catch { return err("Couldn't reach the waitlist backend.", 502); }
}
