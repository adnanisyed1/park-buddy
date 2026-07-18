// POST /api/book-price — what a Trip Book costs to make and what we charge for it.
//
// The studio needs a price on every keystroke while someone drags the page count around,
// but Lulu's cost API is a network round trip. So this route learns each SKU's cost curve
// instead of re-asking: Lulu prices linearly (print = fixed + pages × rate, verified across
// 24–240 pages), so two quotes pin a SKU exactly and every later page count is free.
//
// Falls back to the measured model in app/lib/bookPricing.js when Lulu isn't reachable —
// that keeps local dev (no credentials) and any Lulu outage showing honest prices rather
// than a blank. The response always says which source it used.
import { luluConfigured, costCalc } from "../../lib/lulu";
import { enforce } from "../../lib/ratelimit";
import {
  quote as referenceQuote, skuFor, unavailableReason, priceFromLanded,
  BIND_PAGES, TARGET_PROFIT, REFERENCE_SHIPPING,
} from "../../lib/bookPricing";

export const runtime = "nodejs";

// Reference address for the studio's price. Real tax and shipping depend on where the book
// is going, which we don't know until checkout — checkout re-quotes against the real one.
const REF_ADDRESS = {
  city: "Moab", state_code: "UT", postcode: "84532",
  country_code: "US", street1: "1 N Main St", phone_number: "+13035550100",
};

// sku -> { fixed, rate, ship, fee, taxRatio, ts }. Module scope, so it survives across
// requests on a warm serverless instance and resets naturally on redeploy.
const curves = new Map();
const CURVE_TTL = 6 * 60 * 60 * 1000; // re-learn twice a day so price changes get picked up

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

async function luluQuote(sku, pages) {
  const c = await costCalc({
    line_items: [{ page_count: pages, pod_package_id: sku, quantity: 1 }],
    shipping_address: REF_ADDRESS,
    shipping_option: "MAIL",
  });
  const li = c.line_item_costs[0];
  return {
    print: +li.total_cost_excl_tax,
    ship: +c.shipping_cost.total_cost_excl_tax,
    fee: +c.fulfillment_cost.total_cost_excl_tax,
    tax: +c.total_tax,
    landed: +c.total_cost_incl_tax,
  };
}

// Pin a SKU's cost curve with two quotes at different page counts, staying inside the
// binding's legal range so neither probe gets rejected for being out of bounds.
async function learnCurve(sku, cover, pages) {
  const range = BIND_PAGES[cover] || { min: 24, max: 800 };
  const lo = Math.max(range.min, Math.min(pages, range.max));
  let hi = Math.min(range.max, lo + 64);
  if (hi === lo) hi = Math.max(range.min, lo - 32);
  if (hi === lo) return null; // range too narrow to derive a slope

  const [a, b] = await Promise.all([luluQuote(sku, lo), luluQuote(sku, hi)]);
  const rate = (b.print - a.print) / (hi - lo);
  const curve = {
    fixed: a.print - rate * lo,
    rate,
    ship: a.ship,
    fee: a.fee,
    // Tax as a share of print. Lulu's sandbox tax is noisy, so take the higher of the two
    // readings — an allowance that covers what we'll owe rather than a prediction.
    taxRatio: Math.max(a.tax / a.print, b.tax / b.print),
    ts: Date.now(),
  };
  curves.set(sku, curve);
  return curve;
}

function fromCurve(curve, pages) {
  const print = curve.fixed + pages * curve.rate;
  const tax = print * curve.taxRatio;
  const landed = print + curve.fee + curve.ship + tax;
  const priced = priceFromLanded({ landed, shipping: curve.ship });
  return {
    available: true, source: "lulu", isReference: true, pages,
    print: r2(print), fee: r2(curve.fee), shipping: r2(curve.ship), tax: r2(tax), landed: r2(landed),
    ...priced,
  };
}

function r2(n) { return Math.round(n * 100) / 100; }

export async function POST(request) {
  const limited = await enforce(request, "book-price", { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  let body;
  try { body = await request.json(); } catch { return err("Bad request."); }

  const cfg = {
    size: String(body.size || ""), cover: String(body.cover || ""),
    ink: String(body.ink || ""), paper: String(body.paper || ""),
    finish: String(body.finish || "matte"),
    pages: Math.max(1, Math.min(800, parseInt(body.pages, 10) || 0)),
  };
  if (!cfg.pages) return err("A page count is required.");

  // Catalogue rules first — no point asking Lulu about a book it won't print.
  const reason = unavailableReason(cfg);
  if (reason) return Response.json({ available: false, reason, sku: skuFor(cfg) });

  const sku = skuFor(cfg);
  if (!sku) return err("Unknown book configuration.");

  const reference = referenceQuote(cfg);

  if (!luluConfigured()) {
    return Response.json({ ...reference, source: "measured-model" });
  }

  try {
    let curve = curves.get(sku);
    if (!curve || Date.now() - curve.ts > CURVE_TTL) curve = await learnCurve(sku, cfg.cover, cfg.pages);
    if (curve) return Response.json(fromCurve(curve, cfg.pages));
    // Couldn't derive a slope (very narrow page range) — quote this exact page count.
    const one = await luluQuote(sku, cfg.pages);
    return Response.json({
      available: true, source: "lulu", isReference: true, pages: cfg.pages,
      print: r2(one.print), fee: r2(one.fee), shipping: r2(one.ship), tax: r2(one.tax), landed: r2(one.landed),
      ...priceFromLanded({ landed: one.landed, shipping: one.ship }),
    });
  } catch (e) {
    // A 400 from Lulu means the catalogue refused this SKU even though our rules allowed it
    // — surface that as unavailable rather than quietly selling something unprintable.
    if (e && e.status === 400) {
      return Response.json({ available: false, sku, reason: "That combination isn't available to print." });
    }
    // Any other failure (auth, timeout, outage): fall back to the measured model so the
    // studio keeps working, and say so.
    return Response.json({ ...reference, source: "measured-model", degraded: true });
  }
}

// GET → the pricing rules the studio needs to render, without a round trip per option.
export function GET() {
  return Response.json({
    targetProfit: TARGET_PROFIT,
    referenceShipping: REFERENCE_SHIPPING,
    bindPages: BIND_PAGES,
    luluConfigured: luluConfigured(),
  });
}
