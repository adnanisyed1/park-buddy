// GET /api/my-orders — returns the signed-in user's Trip Book orders.
// Auth: the caller sends their Supabase access token as `Authorization: Bearer …`.
// We verify it server-side (anon client → getUser), then read book_orders for that
// user's email with the SERVICE key. So a user only ever sees their own orders.
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function base() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

export async function GET(request) {
  const sb = base(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Accounts backend isn't configured." }, { status: 503 });

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

  // Verify the token → the real user (can't be spoofed with just an email).
  let email = "";
  try {
    const admin = createClient(sb, ANON);
    const { data, error } = await admin.auth.getUser(token);
    email = data && data.user && data.user.email;
    if (error || !email) return Response.json({ error: "Session expired — sign in again." }, { status: 401 });
  } catch { return Response.json({ error: "Couldn't verify your session." }, { status: 401 }); }

  try {
    const r = await fetch(sb + "/rest/v1/book_orders?email=eq." + encodeURIComponent(email) + "&order=created_at.desc&select=trip_title,theme,size,price,quantity,status,created_at,note", {
      headers: { apikey: svc, Authorization: "Bearer " + svc },
    });
    if (!r.ok) return Response.json({ error: "Couldn't load your orders." }, { status: 502 });
    const orders = await r.json();
    return Response.json({ orders: Array.isArray(orders) ? orders : [] });
  } catch { return Response.json({ error: "Couldn't reach the orders backend." }, { status: 502 }); }
}
