// POST /api/stripe-webhook — Stripe → Park Buddy fulfillment trigger.
// On `checkout.session.completed`, if the session carries hosted interior/cover PDF
// URLs (set by /api/checkout when fulfillment is configured), create a Lulu print
// job for the buyer's shipping address. Verifies the Stripe signature.
//   Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (from the Stripe dashboard webhook),
//        LULU_* (see lib/lulu), optional LULU_CONTACT_EMAIL.
//   Add the endpoint in Stripe → Developers → Webhooks → checkout.session.completed.
import Stripe from "stripe";
import { luluConfigured, createPrintJob, LULU_PRODUCT } from "../../lib/lulu";
import { sendMail, orderConfirmation, mailConfigured } from "../../lib/mail";

export const runtime = "nodejs";

export async function POST(request) {
  const key = process.env.STRIPE_SECRET_KEY, whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whsec) return Response.json({ error: "Webhook not configured" }, { status: 503 });

  const sig = request.headers.get("stripe-signature");
  const raw = await request.text();
  const stripe = new Stripe(key);
  let event;
  try { event = stripe.webhooks.constructEvent(raw, sig, whsec); }
  catch (e) { return Response.json({ error: "Invalid signature" }, { status: 400 }); }

  if (event.type === "checkout.session.completed") {
    // Re-fetch with the shipping rate expanded: the event payload carries only the rate's
    // id, and we need its metadata to know WHICH speed the customer paid for.
    let session = event.data.object;
    try {
      session = await stripe.checkout.sessions.retrieve(session.id, { expand: ["shipping_cost.shipping_rate"] });
    } catch { /* fall back to the unexpanded object; fulfillment still works at base speed */ }
    try { await fulfill(session); }
    catch (e) {
      // 500 so Stripe retries the delivery; log for diagnosis.
      console.error("Trip Book fulfillment failed:", e);
      return Response.json({ received: true, fulfilled: false, error: String(e && e.message) }, { status: 500 });
    }
  }
  return Response.json({ received: true });
}

// Which shipping speed did they pay for? Read it off the expanded Stripe shipping rate.
// Falls back to the base level rather than throwing — a missing rate must not block a
// paid order from being printed.
function chosenLevel(session) {
  try {
    const rate = session.shipping_cost && session.shipping_cost.shipping_rate;
    const level = rate && rate.metadata && rate.metadata.lulu_level;
    if (level) return level;
  } catch { /* fall through */ }
  return LULU_PRODUCT.shipping;
}

async function fulfill(session) {
  const m = session.metadata || {};
  // Not a fulfillable Trip Book order (e.g. a test session with no hosted PDFs).
  if (!luluConfigured() || !m.interior_url || !m.cover_url) return;

  const ship = session.shipping_details || {};
  const cust = session.customer_details || {};
  const addr = ship.address || cust.address || {};
  const payload = {
    contact_email: process.env.LULU_CONTACT_EMAIL || "orders@theparkbuddy.com",
    external_id: session.id,
    line_items: [{
      title: m.trip_title || "Trip Book",
      quantity: Math.max(1, parseInt(m.quantity, 10) || 1),
      printable_normalization: {
        // The SKU the customer actually configured, carried through checkout's metadata.
        // Falling back to the default product would print a different book than the one
        // they paid for, so only fall back when metadata is genuinely absent.
        pod_package_id: m.pod_package_id || LULU_PRODUCT.sku,
        cover: { source_url: m.cover_url },
        interior: { source_url: m.interior_url },
      },
    }],
    shipping_address: {
      name: ship.name || cust.name || "Customer",
      street1: addr.line1 || "",
      street2: addr.line2 || "",
      city: addr.city || "",
      state_code: addr.state || "",
      postcode: addr.postal_code || "",
      country_code: addr.country || "US",
      phone_number: cust.phone || "+10000000000",
    },
    // Ship at the speed the customer actually paid for. This was hardcoded, so someone
    // could buy overnight delivery and still wait 10–12 days.
    shipping_level: chosenLevel(session),
  };

  const job = await createPrintJob(payload);
  await recordJob(session, m, job).catch(() => {});

  // Tell the customer their book is being made. Until now they paid and heard nothing
  // at all until a parcel turned up. Never let this fail the order — the book is already
  // at the press, so an email problem must not surface as a fulfillment error.
  try {
    const to = (session.customer_details && session.customer_details.email) || session.customer_email;
    const amount = typeof session.amount_total === "number"
      ? "$" + (session.amount_total / 100).toFixed(2)
      : "";
    const msg = orderConfirmation({
      name: (session.shipping_details && session.shipping_details.name) || (session.customer_details && session.customer_details.name),
      title: m.trip_title || "Trip Book",
      pages: m.page_count || "",
      binding: m.binding || "",
      size: m.size || "",
      total: amount,
    });
    const res = await sendMail({ to, ...msg });
    if (!res.sent) console.warn("[order] confirmation not sent:", res.reason, "— order", session.id);
  } catch (e) {
    console.warn("[order] confirmation threw:", e && e.message);
  }
}

// Best-effort fulfillment log into the existing book_orders table (no schema change
// needed — the job id + status go in the note field).
async function recordJob(session, m, job) {
  const sb = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !key) return;
  const row = {
    email: (session.customer_details && session.customer_details.email) || "",
    trip_title: m.trip_title || "Trip Book",
    theme: m.theme || "", size: m.size || "",
    quantity: Math.max(1, parseInt(m.quantity, 10) || 1),
    status: "in_production",
    note: "Lulu job " + (job && job.id) + " · " + (job && job.status && job.status.name ? job.status.name : "CREATED") + " · stripe " + session.id,
    created_at: new Date().toISOString(),
  };
  await fetch(sb + "/rest/v1/book_orders", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
}
