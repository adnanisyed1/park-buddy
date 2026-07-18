// POST /api/lulu-cost — get Lulu's print + shipping + tax quote for a Trip Book to a
// shipping address. Used to (a) show shipping/tax in checkout and (b) make sure the
// Stripe charge always covers fulfillment. Honest 503 when Lulu isn't configured.
import { luluConfigured, costCalc, LULU_SKU, LULU_PRODUCT, luluDiag, costCalcProbe, coverDimensions, createPrintJob, getPrintJob, shippingOptions } from "../../lib/lulu";
import { storageConfigured, uploadSignedPdf, orderKey } from "../../lib/storage";
import { buildInteriorPdf, resolveEntryImage } from "../../lib/interiorPdf";
import { skuFor, unavailableReason, trimInches } from "../../lib/bookPricing";
import { buildCoverPdf } from "../../lib/coverPdf";

export const runtime = "nodejs";

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

// Full end-to-end sandbox fulfillment test: build+host interior & cover PDFs, then
// create a real (sandbox) Lulu print job — returns Lulu's response so we can verify
// PDF acceptance without a Stripe payment. Sandbox jobs never charge or print.
// Takes the same configuration shape checkout does, so the probe exercises the REAL
// order path (customer's trim, binding and SKU) rather than a fixed default product.
async function orderProbe(origin, cfg) {
  if (!luluConfigured() || !storageConfigured()) throw new Error("Lulu or storage not configured");
  const conf = {
    size: cfg.size || "sq-s", cover: cfg.cover || "casewrap", ink: cfg.ink || "fcpre",
    paper: cfg.paper || "coated", finish: cfg.finish || "matte", pages: cfg.pages || 32,
  };
  const look = { palette: cfg.palette || "parchment-royal", layout: cfg.layout || "", bw: conf.ink === "bwpre" || conf.ink === "bwstd" };
  const blocked = unavailableReason(conf);
  if (blocked) throw new Error("config rejected: " + blocked);
  const sku = skuFor(conf);
  const trim = trimInches(conf.size);
  if (!sku || !trim) throw new Error("unknown configuration");

  const entries = [
    { type: "Remember this", place: "Yosemite National Park", cap: "We hit the trail before the light did.", q: ["Yosemite National Park"] },
    { type: "On the road", place: "Sequoia National Park", cap: "Big trees, small us.", q: ["Sequoia National Park"] },
  ];
  const { bytes, pageCount } = await buildInteriorPdf({
    title: "Sandbox Test Book", dates: "May 2026", dedication: "For the detour.", entries, origin,
    trimW: trim.w, trimH: trim.h, cover: conf.cover, minPages: conf.pages,
    palette: look.palette, bw: look.bw, marginIn: Number(cfg.marginIn) || 0,
  });
  const stamp = orderKey("test");
  const interior_url = await uploadSignedPdf(stamp + "-interior.pdf", bytes);
  const dims = await coverDimensions(pageCount, sku);
  const coverImg = await resolveEntryImage(entries[0], origin);
  const coverBytes = await buildCoverPdf({ title: "Sandbox Test Book", dates: "May 2026", coverImage: coverImg, dims, origin,
    palette: look.palette, layout: look.layout, bw: look.bw, trimW: trim.w, trimH: trim.h });
  const cover_url = await uploadSignedPdf(stamp + "-cover.pdf", coverBytes);
  const job = await createPrintJob({
    contact_email: process.env.LULU_CONTACT_EMAIL || "orders@theparkbuddy.com",
    external_id: "sandbox-test-" + stamp.replace("test/", ""),
    line_items: [{ title: "Sandbox Test Book", quantity: 1, printable_normalization: { pod_package_id: sku, cover: { source_url: cover_url }, interior: { source_url: interior_url } } }],
    shipping_address: { name: "Test User", street1: "1 N Main St", city: "Moab", state_code: "UT", postcode: "84532", country_code: "US", phone_number: "+13035550100" },
    shipping_level: "MAIL",
  });
  return {
    ok: true, config: conf, sku, trimIn: trim, pageCount,
    coverDims: dims && { width: dims.width, height: dims.height, unit: dims.unit },
    interior_url, cover_url, job_id: job && job.id, job_status: job && job.status,
  };
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
    // full=1 returns Lulu's whole job payload — including whatever normalized/preview
    // artefacts it produced from our PDFs, which is how we see the book as Lulu sees it.
    const full = u.searchParams.get("full") === "1";
    try {
      const j = await getPrintJob(id);
      if (full) return Response.json(j);
      return Response.json({ id: j.id, status: j.status, line_items: (j.line_items || []).map((l) => ({ status: l.status })) });
    } catch (e) { return err("job probe failed: " + (e && e.message), 502); }
  }
  if (probe === "ship") {
    // What Lulu will actually quote for delivery: levels, cost and day counts.
    const sku = u.searchParams.get("sku") || LULU_SKU;
    const pages = parseInt(u.searchParams.get("pages"), 10) || 32;
    const state = u.searchParams.get("state") || "UT";
    const postcode = u.searchParams.get("postcode") || "84532";
    const city = u.searchParams.get("city") || "Moab";
    const country = u.searchParams.get("country") || "US";
    try {
      const opts = await shippingOptions({
        line_items: [{ page_count: pages, pod_package_id: sku, quantity: 1 }],
        shipping_address: { city, state_code: state, postcode, country_code: country, street1: "1 N Main St", phone_number: "+13035550100" },
      });
      return Response.json(opts);
    } catch (e) {
      return err("shipping probe failed: " + (e && e.message) + " " + JSON.stringify((e && e.data) || {}).slice(0, 300), 502);
    }
  }
  if (probe === "order") {
    const cfg = {
      size: u.searchParams.get("size"), cover: u.searchParams.get("cover"),
      ink: u.searchParams.get("ink"), paper: u.searchParams.get("paper"),
      finish: u.searchParams.get("finish"), pages: parseInt(u.searchParams.get("pages"), 10) || 0,
      palette: u.searchParams.get("palette"), layout: u.searchParams.get("layout"),
      marginIn: parseFloat(u.searchParams.get("margin")) || 0,
    };
    try { return Response.json(await orderProbe(u.origin, cfg)); }
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
