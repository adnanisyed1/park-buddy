// POST /api/checkout — create a Stripe Checkout Session for a printed Trip Book.
// Uses STRIPE_SECRET_KEY (server-side only). Returns { url } to redirect to Stripe.
// Degrades honestly to 503 when no key is set, so the client falls back to the
// no-charge reservation flow. IMPORTANT: only switch to LIVE keys once Lulu
// fulfillment (print-ready PDF → print job) is wired — don't charge for a book we
// can't yet produce. Test keys (sk_test_…) are safe to exercise now.
import Stripe from "stripe";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

export async function POST(request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return err("Payments aren't live yet — check back soon.", 503);
  // SAFETY GUARD: refuse to use a LIVE key (sk_live_…) unless fulfillment is ready
  // and explicitly enabled with STRIPE_LIVE_OK=1. This prevents charging real cards
  // for a book we can't yet print/ship — the app falls back to the no-charge
  // reservation flow instead. Test keys (sk_test_…) are unaffected.
  if (/^sk_live_/.test(key) && process.env.STRIPE_LIVE_OK !== "1") {
    return err("Payments aren't live yet — check back soon.", 503);
  }

  let body;
  try { body = await request.json(); } catch { return err("Bad request."); }
  const email = String(body.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email address.");
  const qty = Math.max(1, Math.min(20, parseInt(body.quantity, 10) || 1));
  const price = parseFloat(String(body.price).replace(/[^0-9.]/g, "")) || 0;
  if (!price) return err("Invalid price.");
  const title = String(body.title || "Trip Book").slice(0, 120);
  const theme = String(body.theme || "").slice(0, 60);
  const size = String(body.size || "").slice(0, 20);
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        quantity: qty,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(price * 100),
          product_data: {
            name: "Trip Book — " + title,
            description: [size, theme, "hardcover"].filter(Boolean).join(" · "),
          },
        },
      }],
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      metadata: { trip_title: title, theme, size, quantity: String(qty) },
      success_url: origin + "/trip-book?order=success",
      cancel_url: origin + "/trip-book?order=cancel",
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return err("Couldn't start checkout" + (e && e.message ? ": " + e.message : "."), 502);
  }
}
