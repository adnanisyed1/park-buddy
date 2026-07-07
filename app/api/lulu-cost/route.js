// POST /api/lulu-cost — get Lulu's print + shipping + tax quote for a Trip Book to a
// shipping address. Used to (a) show shipping/tax in checkout and (b) make sure the
// Stripe charge always covers fulfillment. Honest 503 when Lulu isn't configured.
import { luluConfigured, costCalc, LULU_SKU, luluDiag } from "../../lib/lulu";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

// GET → environment + auth diagnostic (no secrets), to debug SKU/env issues.
export async function GET() {
  return Response.json(await luluDiag());
}

export async function POST(request) {
  if (!luluConfigured()) return err("Print fulfillment isn't configured yet.", 503);
  let body;
  try { body = await request.json(); } catch { return err("Bad request."); }

  const qty = Math.max(1, Math.min(20, parseInt(body.quantity, 10) || 1));
  const page_count = Math.max(24, parseInt(body.page_count, 10) || 24);
  const a = body.shipping_address || {};
  // cost-calc needs at least city, country_code, postcode, state_code (US/CA)
  const shipping_address = {
    city: String(a.city || ""), country_code: String(a.country_code || "US"),
    postcode: String(a.postcode || ""), state_code: String(a.state_code || ""),
    street1: String(a.street1 || ""), phone_number: String(a.phone_number || ""),
  };

  // Allow a pod_package_id override so we can probe which SKUs the sandbox carries
  // without redeploying per attempt (defaults to the configured LULU_SKU).
  const sku = String(body.pod_package_id || LULU_SKU);
  try {
    const cost = await costCalc({
      line_items: [{ page_count, pod_package_id: sku, quantity: qty }],
      shipping_address,
      shipping_option: String(body.shipping_option || "GROUND"),
    });
    return Response.json({ ok: true, cost });
  } catch (e) {
    return Response.json({
      error: "Lulu cost calculation failed" + (e && e.status ? " (" + e.status + ")" : "") + ".",
      detail: (e && e.data) || null,
    }, { status: 502 });
  }
}
