// POST /api/lulu-cost — get Lulu's print + shipping + tax quote for a Trip Book to a
// shipping address. Used to (a) show shipping/tax in checkout and (b) make sure the
// Stripe charge always covers fulfillment. Honest 503 when Lulu isn't configured.
import { luluConfigured, costCalc, LULU_SKU, LULU_PRODUCT, luluDiag, costCalcProbe, coverDimensions, createPrintJob, getPrintJob } from "../../lib/lulu";
import { storageConfigured, uploadPublicPdf } from "../../lib/storage";
import { buildInteriorPdf, resolveEntryImage } from "../../lib/interiorPdf";
import { buildCoverPdf } from "../../lib/coverPdf";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

// Full end-to-end sandbox fulfillment test: build+host interior & cover PDFs, then
// create a real (sandbox) Lulu print job — returns Lulu's response so we can verify
// PDF acceptance without a Stripe payment. Sandbox jobs never charge or print.
async function orderProbe(origin) {
  if (!luluConfigured() || !storageConfigured()) throw new Error("Lulu or storage not configured");
  const entries = [
    { type: "Remember this", place: "Yosemite National Park", cap: "We hit the trail before the light did.", q: ["Yosemite National Park"] },
    { type: "On the road", place: "Sequoia National Park", cap: "Big trees, small us.", q: ["Sequoia National Park"] },
  ];
  const { bytes, pageCount } = await buildInteriorPdf({ title: "Sandbox Test Book", dates: "May 2026", dedication: "For the detour.", entries, origin, trimIn: LULU_PRODUCT.trimIn });
  const stamp = Date.now().toString(36);
  const interior_url = await uploadPublicPdf("test/" + stamp + "-interior.pdf", bytes);
  const dims = await coverDimensions(pageCount, LULU_PRODUCT.sku);
  const coverImg = await resolveEntryImage(entries[0], origin);
  const coverBytes = await buildCoverPdf({ title: "Sandbox Test Book", dates: "May 2026", coverImage: coverImg, dims, origin });
  const cover_url = await uploadPublicPdf("test/" + stamp + "-cover.pdf", coverBytes);
  const job = await createPrintJob({
    contact_email: process.env.LULU_CONTACT_EMAIL || "orders@theparkbuddy.com",
    external_id: "sandbox-test-" + stamp,
    line_items: [{ title: "Sandbox Test Book", quantity: 1, printable_normalization: { pod_package_id: LULU_PRODUCT.sku, cover: { source_url: cover_url }, interior: { source_url: interior_url } } }],
    shipping_address: { name: "Test User", street1: "1 Main St", city: "Moab", state_code: "UT", postcode: "84532", country_code: "US", phone_number: "+13035550100" },
    shipping_level: LULU_PRODUCT.shipping,
  });
  return { ok: true, pageCount, sku: LULU_PRODUCT.sku, interior_url, cover_url, job_id: job && job.id, job_status: job && job.status };
}

// GET → environment/auth diagnostic. With ?probe=sandbox|production&sku=... it runs
// a cost-calc against that environment with the current creds (env/creds mismatch check).
export async function GET(request) {
  const u = new URL(request.url);
  const probe = u.searchParams.get("probe");
  // Diagnostics are sandbox-only — never let a public GET create/inspect jobs in prod.
  if (probe && (process.env.LULU_ENV || "").toLowerCase() === "production") {
    return err("Diagnostics are disabled in production.", 403);
  }
  if (probe === "job") {
    const id = u.searchParams.get("id");
    try { const j = await getPrintJob(id); return Response.json({ id: j.id, status: j.status, line_items: (j.line_items || []).map((l) => ({ status: l.status })) }); }
    catch (e) { return err("job probe failed: " + (e && e.message), 502); }
  }
  if (probe === "order") {
    try { return Response.json(await orderProbe(u.origin)); }
    catch (e) { return err("order probe failed: " + (e && e.message ? e.message : "unknown"), 502); }
  }
  if (probe) {
    const sku = u.searchParams.get("sku") || LULU_SKU;
    const ship = u.searchParams.get("ship") || "MAIL";
    try { return Response.json(await costCalcProbe(probe, sku, 32, ship)); }
    catch (e) { return err("probe failed: " + (e && e.message), 502); }
  }
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
      shipping_option: String(body.shipping_option || LULU_PRODUCT.shipping),
    });
    return Response.json({ ok: true, cost });
  } catch (e) {
    return Response.json({
      error: "Lulu cost calculation failed" + (e && e.status ? " (" + e.status + ")" : "") + ".",
      detail: (e && e.data) || null,
    }, { status: 502 });
  }
}
