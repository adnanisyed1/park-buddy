// POST /api/book-order — reserve a printed Trip Book. Writes to the Supabase
// `book_orders` table with the SERVICE key (server-side), same pattern as
// /api/park-alert. This is a RESERVATION, not a charge: real fulfillment (a Lulu
// print job) + payment (Stripe) are wired once those accounts + keys exist. Until
// the `book_orders` table is created it degrades honestly (no false "saved").
//
// Table SQL (run once in Supabase):
//   create table book_orders (
//     id bigint generated always as identity primary key,
//     email text not null, name text, trip_title text, theme text,
//     size text, price text, quantity int default 1, shipping text, note text,
//     status text default 'reserved', created_at timestamptz default now()
//   );
import { enforce } from "../../lib/ratelimit";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

export async function POST(request) {
  const limited = await enforce(request, "book-order", { limit: 4, windowMs: 60_000 });
  if (limited) return limited;
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;

  let body;
  try { body = await request.json(); } catch { return err("Bad request."); }
  const email = String(body.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address.");

  const row = {
    email,
    name: String(body.name || "").slice(0, 120),
    trip_title: String(body.title || "").slice(0, 200),
    theme: String(body.theme || "").slice(0, 60),
    size: String(body.size || "").slice(0, 20),
    price: String(body.price || "").slice(0, 20),
    quantity: Math.max(1, Math.min(20, parseInt(body.quantity, 10) || 1)),
    shipping: String(body.shipping || "").slice(0, 500),
    note: String(body.note || "").slice(0, 500),
    status: "reserved",
    created_at: new Date().toISOString(),
  };

  if (!sb || !key) return err("Print ordering isn't live yet — check back soon.", 503);

  try {
    const resp = await fetch(sb + "/rest/v1/book_orders", {
      method: "POST",
      headers: {
        apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!resp.ok) return err("Couldn't save your reservation (" + resp.status + "). Print ordering is still being set up.", 502);
    return Response.json({ ok: true });
  } catch {
    return err("Couldn't reach the reservations backend.", 502);
  }
}
