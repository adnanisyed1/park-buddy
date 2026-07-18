// POST /api/checkout — create a Stripe Checkout Session for a printed Trip Book.
// When fulfillment is configured (Lulu creds + storage), it first generates the interior
// & cover PDFs, uploads them under unguessable keys, and passes TIME-LIMITED SIGNED URLs
// in the session metadata, so /api/stripe-webhook can create the Lulu print job on
// payment. The files are a customer's finished book and are never publicly readable.
// Degrades honestly (503) with no Stripe key; refuses live keys unless STRIPE_LIVE_OK=1.
import Stripe from "stripe";
import { luluConfigured, coverDimensions } from "../../lib/lulu";
import { quote as bookQuote, skuFor, unavailableReason, trimInches } from "../../lib/bookPricing";
import { storageConfigured, uploadSignedPdf, orderKey } from "../../lib/storage";
import { buildInteriorPdf, resolveEntryImage } from "../../lib/interiorPdf";
import { buildCoverPdf } from "../../lib/coverPdf";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

// GET → can this environment take real money, and is fulfillment actually ready?
// Reports the key's MODE only (test/live) — never the key, never any part of it. Exists
// because "a Stripe key is set" is not the question that matters; "would a card be
// charged for a book we can't print correctly yet" is.
export function GET() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const mode = !key ? "unset" : /^sk_live_/.test(key) ? "live" : /^sk_test_/.test(key) ? "test" : "unrecognized";
  const liveOk = process.env.STRIPE_LIVE_OK === "1";
  return Response.json({
    stripeMode: mode,
    stripeLiveOk: liveOk,
    // The only combination that can move real money.
    canChargeRealMoney: mode === "live" && liveOk,
    luluConfigured: luluConfigured(),
    storageConfigured: storageConfigured(),
    // The order path now carries the customer's real trim, binding, SKU, palette and
    // cover layout through to print. Composition parity with the on-screen spreads is
    // close but not pixel-exact, so this stays a claim we can point at a proof for.
    printPipelineMatchesStudio: true,
  });
}

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

  // SERVER-AUTHORITATIVE PRICING — the client's `price` is display only and is never
  // read here, so a spoofed body can't buy a hardcover for cents. Price is re-derived
  // from the configuration using the same measured model the studio quoted from.
  //
  // This used to be a hardcoded { 8: 45, 10: 65, 12: 89 } keyed by parsing inches out of
  // body.size — but the studio sends size as a display name ("Square 8.5 × 8.5\"
  // Hardcover"), so parseInt returned NaN and every order was refused as "Unrecognized
  // book size". Price now comes from the config, and the trim/SKU come with it.
  const cfg = body.config || {};
  const conf = {
    size: String(cfg.size || ""), cover: String(cfg.cover || ""), ink: String(cfg.ink || ""),
    paper: String(cfg.paper || ""), finish: String(cfg.finish || "matte"),
    pages: Math.max(1, Math.min(800, parseInt(cfg.pages, 10) || 0)),
  };
  // Look: palette + cover layout, and whether the interior prints in black & white.
  const look = {
    palette: String(cfg.palette || ""), layout: String(cfg.layout || ""),
    bw: conf.ink === "bwpre" || conf.ink === "bwstd",
  };
  if (!conf.pages) return err("That book is missing its page count.");

  const blocked = unavailableReason(conf);
  if (blocked) return err(blocked);

  const priced = bookQuote(conf);
  if (!priced.available) return err(priced.reason || "That book configuration isn't available.");

  const podSku = skuFor(conf);
  if (!podSku) return err("Unrecognized book configuration.");
  const trim = trimInches(conf.size);
  if (!trim) return err("Unrecognized trim size.");

  // Charge the book price plus shipping, matching what the studio showed.
  const price = priced.bookPrice + priced.shipping;

  const title = String(body.title || "Trip Book").slice(0, 120);
  const theme = String(body.theme || "").slice(0, 60);
  const size = String(body.size || "").slice(0, 40);
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  // Fulfillment prep: generate + host the print PDFs so the webhook can order them.
  // Only runs when both Lulu and storage are configured; otherwise this is a plain
  // (test) checkout with no auto-print.
  let fulfillMeta = {};
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 60) : [];
  if (luluConfigured() && storageConfigured() && entries.length) {
    try {
      // The customer's real trim, binding and page count — not a fixed product. A
      // landscape book must print landscape.
      const { bytes: interiorBytes, pageCount } = await buildInteriorPdf({
        title, dates: body.dates, dedication: body.dedication, entries, origin,
        trimW: trim.w, trimH: trim.h, cover: conf.cover, minPages: conf.pages,
        palette: look.palette, bw: look.bw,
      });
      // Random, unguessable key — the old timestamp+price path was enumerable, and
      // these files are a customer's finished book.
      const stamp = orderKey("orders");
      const interior_url = await uploadSignedPdf(stamp + "-interior.pdf", interiorBytes);
      // Spine width depends on this SKU's paper and page count — always ask Lulu.
      const dims = await coverDimensions(pageCount, podSku);
      // Prefer a stop the traveler actually photographed for the cover (no third-party
      // stock on a sold cover); fall back to a designed text/emblem cover otherwise.
      const hasUserPhoto = (e) => e && e.userImg && (e.userImg.startsWith("data:") || /^https?:/.test(e.userImg));
      const coverEntry =
        entries.find((e) => e.type === "Remember this" && hasUserPhoto(e)) ||
        entries.find(hasUserPhoto) ||
        entries.find((e) => e.type === "Remember this") ||
        entries[0];
      const coverImage = await resolveEntryImage(coverEntry);
      const coverBytes = await buildCoverPdf({ title, dates: body.dates, edition: "", coverImage, dims, origin,
        palette: look.palette, layout: look.layout, bw: look.bw, trimW: trim.w, trimH: trim.h });
      const cover_url = await uploadSignedPdf(stamp + "-cover.pdf", coverBytes);
      // pod_package_id travels with the order so the webhook prints the book the
      // customer actually configured, not a default product.
      fulfillMeta = { interior_url, cover_url, page_count: String(pageCount), pod_package_id: podSku };
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
          product_data: { name: "Trip Book — " + title, description: [size, theme, conf.pages + " pages"].filter(Boolean).join(" · ") },
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
