// POST /api/checkout — create a Stripe Checkout Session for a printed Trip Book.
// When fulfillment is configured (Lulu creds + a public storage bucket), it first
// generates + hosts the interior & cover PDFs and passes their URLs in the session
// metadata, so /api/stripe-webhook can create the Lulu print job on payment.
// Degrades honestly (503) with no Stripe key; refuses live keys unless STRIPE_LIVE_OK=1.
import Stripe from "stripe";
import { luluConfigured, coverDimensions, LULU_PRODUCT } from "../../lib/lulu";
import { storageConfigured, uploadPublicPdf } from "../../lib/storage";
import { buildInteriorPdf, resolveEntryImage } from "../../lib/interiorPdf";
import { buildCoverPdf } from "../../lib/coverPdf";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

export async function POST(request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return err("Payments aren't live yet — check back soon.", 503);
  // SAFETY GUARD: refuse a LIVE key unless fulfillment is ready + explicitly enabled.
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

  // Fulfillment prep: generate + host the print PDFs so the webhook can order them.
  // Only runs when both Lulu and storage are configured; otherwise this is a plain
  // (test) checkout with no auto-print.
  let fulfillMeta = {};
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 60) : [];
  if (luluConfigured() && storageConfigured() && entries.length) {
    try {
      const { bytes: interiorBytes, pageCount } = await buildInteriorPdf({
        title, dates: body.dates, dedication: body.dedication, entries, origin, trimIn: LULU_PRODUCT.trimIn,
      });
      const stamp = Date.now().toString(36) + "-" + Math.round(price);
      const interior_url = await uploadPublicPdf("orders/" + stamp + "-interior.pdf", interiorBytes);
      const dims = await coverDimensions(pageCount, LULU_PRODUCT.sku);
      const coverEntry = entries.find((e) => e.type === "Remember this") || entries[0];
      const coverImage = await resolveEntryImage(coverEntry, origin);
      const coverBytes = await buildCoverPdf({ title, dates: body.dates, edition: "", coverImage, dims });
      const cover_url = await uploadPublicPdf("orders/" + stamp + "-cover.pdf", coverBytes);
      fulfillMeta = { interior_url, cover_url, page_count: String(pageCount) };
    } catch (e) {
      return err("Couldn't prepare your book for print: " + (e && e.message ? e.message : "unknown"), 502);
    }
  }

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
          product_data: { name: "Trip Book — " + title, description: [size, theme, "hardcover"].filter(Boolean).join(" · ") },
        },
      }],
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      phone_number_collection: { enabled: true },
      metadata: { trip_title: title, theme, size, quantity: String(qty), ...fulfillMeta },
      success_url: origin + "/trip-book?order=success",
      cancel_url: origin + "/trip-book?order=cancel",
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return err("Couldn't start checkout" + (e && e.message ? ": " + e.message : "."), 502);
  }
}
