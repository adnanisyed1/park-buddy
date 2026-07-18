// Trip Book pricing — every constant here was MEASURED against Lulu's live
// print-job-cost-calculations API, not estimated. 96 tier×binding×ink×paper combos were
// each quoted at two page counts to derive the cost curve, and 178 full configurations
// were quoted end to end to verify it.
//
// Lulu prices a print run perfectly linearly:
//     print = fixed(tier, binding) + pages × rate(tier, ink, paper)
// Verified across 24/32/48/60/80/120/200/240 pages to within a cent, and the two factors
// are genuinely separable — fixed never moved with ink/paper, rate never moved with binding.
//
// This module is the INSTANT price the studio shows while someone is still choosing.
// /api/book-price re-quotes Lulu live for the real number, and checkout must always
// re-quote before charging — see quote().isReference.

// ---------------------------------------------------------------------------
// Business rules
// ---------------------------------------------------------------------------

// Flat profit per book, after Lulu and Stripe are both paid. Chosen deliberately over a
// percentage so cheap books stay competitive; the trade-off is that a $58 heirloom earns
// the same as a $21 paperback.
export const TARGET_PROFIT = 10;

export const STRIPE_PCT = 0.029;
export const STRIPE_FLAT = 0.3;

// Lulu's per-order fulfillment fee. Flat, every order, regardless of configuration.
export const FULFILLMENT_FEE = 0.75;

// One copy, MAIL, US domestic. Real shipping depends on destination and speed, so this is
// a reference figure for display only; checkout quotes the customer's actual address.
export const REFERENCE_SHIPPING = 5.69;

// Sales tax allowance, deliberately set to the HIGHEST rate observed (Utah, 9.35%).
//
// Tax cannot be modelled properly here for two reasons. It legally depends on the
// destination address, which is unknown while someone is still designing their book. And
// Lulu's sandbox tax output is not deterministic: 27 of 30 SKU families quoted at ~9.34%
// of print while 3 quoted ~7.45%, with no structure explaining it — premium-colour
// hardcover came back at 7.45% in one sweep and 9.41% in another for the same product.
// Fitting a curve to that is fitting noise.
//
// So this is an allowance, not a prediction: taking the top of the observed range means
// the reference price always covers the tax we'll owe rather than quietly eating it, and
// low-tax destinations simply land as extra margin. The live quote at checkout is
// authoritative for the real figure.
export const REFERENCE_TAX_RATE = 0.0935;

// ---------------------------------------------------------------------------
// Measured cost model
// ---------------------------------------------------------------------------

// All 14 trim sizes collapse into exactly two price tiers — measured, not assumed.
// Letter, A4, Royal, Executive, Crown, both landscapes and both squares price identically.
// `comic` is absent from Lulu's catalogue entirely: every quote for it was rejected.
export const SIZE_TIER = {
  "sq-s": "standard", sq: "standard", "land-s": "standard", "land-l": "standard",
  royal: "standard", exec: "standard", crown: "standard", a4: "standard", letter: "standard",
  pocket: "compact", digest: "compact", a5: "compact", trade: "compact",
  comic: null,
};

// Binding is pure fixed cost — the per-page rate is identical across all four.
export const BIND_FIXED = {
  standard: { paperback: 2.15, saddle: 4.36, coil: 6.94, casewrap: 10.97 },
  compact: { paperback: 1.98, saddle: 3.76, coil: 6.35, casewrap: 10.67 },
};

// Per-page rate. Ink is by far the biggest lever: premium colour costs ~5× standard B&W.
// `null` means Lulu rejects that ink/paper pairing outright (see AVAILABILITY).
export const PAGE_RATE = {
  standard: {
    fcpre: { coated: 0.2149, white: 0.2006, cream: null },
    fcstd: { coated: 0.0635, white: 0.0561, cream: null },
    bwpre: { coated: 0.0561, white: 0.05, cream: 0.05 },
    bwstd: { coated: 0.0442, white: 0.0385, cream: 0.0385 },
  },
  compact: {
    fcpre: { coated: 0.139, white: 0.1256, cream: null },
    fcstd: { coated: 0.0505, white: 0.0442, cream: null },
    bwpre: { coated: 0.0442, white: 0.037, cream: 0.037 },
    bwstd: { coated: 0.0311, white: 0.025, cream: 0.025 },
  },
};

// Page ranges Lulu enforces. Paperback needs a spine, so it genuinely starts at 32 —
// every 24-page paperback quote was refused.
export const BIND_PAGES = {
  paperback: { min: 32, max: 800 },
  saddle: { min: 4, max: 48 },
  coil: { min: 3, max: 470 },
  casewrap: { min: 24, max: 800 },
  linen: { min: 24, max: 800 },
};

const COLOR_INKS = ["fcpre", "fcstd"];

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

// Why a configuration can't be printed, in words a customer can act on — or null if it can.
// Every rule here came from a real 400 from Lulu's catalogue, and each held identically in
// both size tiers (20 rejections, 10 per tier, perfectly symmetric).
export function unavailableReason({ size, cover, ink, paper, pages }) {
  if (cover === "linen") {
    return "Linen and foil aren't available to order yet.";
  }
  if (size && SIZE_TIER[size] === null) {
    return "That trim size isn't in Lulu's catalogue.";
  }
  if (paper === "cream" && COLOR_INKS.indexOf(ink) >= 0) {
    return "Cream paper is only offered with black & white interiors.";
  }
  if (cover === "saddle" && ink === "fcstd") {
    return "Saddle stitch is only offered with premium colour or black & white.";
  }
  const range = BIND_PAGES[cover];
  if (range && typeof pages === "number") {
    if (pages < range.min) return "That binding needs at least " + range.min + " pages.";
    if (pages > range.max) return "That binding tops out at " + range.max + " pages.";
  }
  return null;
}

export function isAvailable(cfg) {
  return unavailableReason(cfg) === null;
}

// ---------------------------------------------------------------------------
// Cost + price
// ---------------------------------------------------------------------------

// Lulu's SKU grammar: TRIM.INK.BINDING.PAPER.FINISH
const TRIM_CODE = {
  "sq-s": "0750X0750", sq: "0850X0850", "land-s": "0900X0700", "land-l": "1100X0850",
  pocket: "0425X0687", digest: "0550X0850", a5: "0583X0827", trade: "0600X0900",
  royal: "0614X0921", exec: "0700X1000", crown: "0744X0968", comic: "0663X1025",
  a4: "0827X1169", letter: "0850X1100",
};
const INK_CODE = { fcpre: "FC.PRE", fcstd: "FC.STD", bwpre: "BW.PRE", bwstd: "BW.STD" };
const BIND_CODE = { paperback: "PB", saddle: "SS", coil: "CO", casewrap: "CW", linen: "LW" };
const PAPER_CODE = { coated: "080CW444", white: "060UW444", cream: "060UC444" };

// Real trim in inches, parsed from the SKU's own trim code (0850X1100 → 8.5 × 11").
// The print PDF must use these — a book is only square when the customer chose a square.
export function trimInches(size) {
  const code = TRIM_CODE[size];
  if (!code) return null;
  const w = parseInt(code.slice(0, 4), 10) / 100;
  const h = parseInt(code.slice(5, 9), 10) / 100;
  return w > 0 && h > 0 ? { w, h } : null;
}

export function skuFor({ size, cover, ink, paper, finish }) {
  const trim = TRIM_CODE[size], ic = INK_CODE[ink], bc = BIND_CODE[cover], pc = PAPER_CODE[paper];
  if (!trim || !ic || !bc || !pc) return null;
  return [trim, ic, bc, pc, (finish === "gloss" ? "G" : "M") + "XX"].join(".");
}

// What Lulu charges to print one copy, before fee/shipping/tax.
export function printCost({ size, cover, ink, paper, pages }) {
  const tier = SIZE_TIER[size];
  if (!tier) return null;
  const fixed = (BIND_FIXED[tier] || {})[cover];
  const byInk = (PAGE_RATE[tier] || {})[ink];
  const rate = byInk ? byInk[paper] : null;
  if (typeof fixed !== "number" || typeof rate !== "number") return null;
  return fixed + pages * rate;
}

// Charge enough that, after Lulu's landed cost and Stripe's cut, exactly TARGET_PROFIT is
// left. Solving R - (R×2.9% + $0.30) - landed = profit gives R = (landed + profit + 0.30) / 0.971.
function priceForProfit(landed, profit) {
  return (landed + profit + STRIPE_FLAT) / (1 - STRIPE_PCT);
}

// Full breakdown for a configuration. Shipping is quoted separately rather than folded into
// the sticker — it keeps the entry book near $16 instead of $22, and the profit works out
// identically either way because the customer is charged the same total.
//
// Returns isReference: true — these are reference figures using US-average shipping and the
// highest observed tax rate. Never charge from them; re-quote via /api/book-price first.
export function quote({ size, cover, ink, paper, finish, pages, profit }) {
  const reason = unavailableReason({ size, cover, ink, paper, pages });
  if (reason) return { available: false, reason, sku: skuFor({ size, cover, ink, paper, finish }) };

  const print = printCost({ size, cover, ink, paper, pages });
  if (print == null) return { available: false, reason: "That combination isn't available.", sku: null };

  const target = typeof profit === "number" ? profit : TARGET_PROFIT;
  const tax = print * REFERENCE_TAX_RATE;
  const landed = print + FULFILLMENT_FEE + REFERENCE_SHIPPING + tax;

  // Round the book price up to a whole dollar, then derive everything else from the amount
  // actually charged — so the reported profit is the real one, never the pre-rounding target.
  const bookPrice = Math.ceil(priceForProfit(landed, target) - REFERENCE_SHIPPING);
  const customerPays = bookPrice + REFERENCE_SHIPPING;
  const stripeFee = customerPays * STRIPE_PCT + STRIPE_FLAT;

  return {
    available: true,
    isReference: true,
    sku: skuFor({ size, cover, ink, paper, finish }),
    pages,
    print: round2(print),
    fee: FULFILLMENT_FEE,
    shipping: REFERENCE_SHIPPING,
    tax: round2(tax),
    landed: round2(landed),
    bookPrice,
    customerPays: round2(customerPays),
    stripeFee: round2(stripeFee),
    profit: round2(customerPays - stripeFee - landed),
  };
}

// Same margin rule applied to a real Lulu quote (actual shipping + actual destination tax),
// so /api/book-price and checkout price identically to the studio.
export function priceFromLanded({ landed, shipping, profit }) {
  const target = typeof profit === "number" ? profit : TARGET_PROFIT;
  const ship = typeof shipping === "number" ? shipping : REFERENCE_SHIPPING;
  const bookPrice = Math.ceil(priceForProfit(landed, target) - ship);
  const customerPays = bookPrice + ship;
  const stripeFee = customerPays * STRIPE_PCT + STRIPE_FLAT;
  return {
    bookPrice,
    shipping: round2(ship),
    customerPays: round2(customerPays),
    stripeFee: round2(stripeFee),
    profit: round2(customerPays - stripeFee - landed),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
