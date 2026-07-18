// Server-only Lulu Print API client (OAuth2 client_credentials).
// Env vars (add in Vercel, never in chat):
//   LULU_CLIENT_KEY, LULU_CLIENT_SECRET  — from developers.sandbox.lulu.com (sandbox)
//   LULU_ENV = "sandbox" (default) | "production"
// Sandbox never charges/prints but runs the full create→pay→production state machine.
// Docs brief gathered this session (see scratchpad lulu_openapi.yml).

const ENV = (process.env.LULU_ENV || "sandbox").toLowerCase();
export const LULU_BASE = ENV === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
const AUTH_URL = LULU_BASE + "/auth/realms/glasstree/protocol/openid-connect/token";

// Square full-color premium casewrap hardcover. The SANDBOX catalog is limited and
// only carries 7.5×7.5 of this family, so we test at 7.5 and ship the real 8.5×8.5
// in production. trimIn drives the interior PDF page size (trim + 0.25in bleed).
export const LULU_PRODUCT = ENV === "production"
  ? { sku: "0850.FC.PRE.CW.080CW444.MXX", trimIn: 8.5, shipping: "GROUND" }
  : { sku: "0750X0750.FC.PRE.CW.080CW444.MXX", trimIn: 7.5, shipping: "MAIL" };
export const LULU_SKU = LULU_PRODUCT.sku; // back-compat

export function luluConfigured() {
  return !!(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET);
}

// module-scoped token cache (per serverless instance)
let _token = null;
let _exp = 0;

async function getToken() {
  if (_token && Date.now() < _exp - 30000) return _token;
  const key = process.env.LULU_CLIENT_KEY, secret = process.env.LULU_CLIENT_SECRET;
  if (!key || !secret) throw new Error("Lulu credentials not configured");
  const basic = Buffer.from(key + ":" + secret).toString("base64");
  const r = await fetch(AUTH_URL, {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) { const e = new Error("Lulu auth failed (" + r.status + ")"); e.status = r.status; throw e; }
  const d = await r.json();
  _token = d.access_token;
  _exp = Date.now() + ((d.expires_in || 300) * 1000);
  return _token;
}

async function api(path, opts = {}) {
  const t = await getToken();
  const r = await fetch(LULU_BASE + path, {
    ...opts,
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) { const e = new Error("Lulu " + path + " " + r.status); e.status = r.status; e.data = data; throw e; }
  return data;
}

// Wraparound cover dimensions (spine width depends on page count + paper) — never
// hardcode; ask Lulu per SKU + page count. Returns { width, height, unit }.
export function coverDimensions(interior_page_count, pod_package_id = LULU_SKU, unit = "pt") {
  return api("/cover-dimensions/", { method: "POST", body: JSON.stringify({ pod_package_id, interior_page_count, unit }) });
}

// Print + shipping + tax quote for a cart. line_items here carry page_count at the
// top level (NOT printable_normalization); shipping field is shipping_option.
export function costCalc({ line_items, shipping_address, shipping_option = "GROUND" }) {
  return api("/print-job-cost-calculations/", { method: "POST", body: JSON.stringify({ line_items, shipping_address, shipping_option }) });
}

// Shipping levels for a specific book + destination, with Lulu's own delivery estimates.
// Returns entries carrying: level (MAIL/GROUND/EXPEDITED/EXPRESS), cost, and the day
// counts — `printable_shipping_days` (time at the press) plus `min/max_delivery_date`
// or transit days. This is the ONLY honest source for "when will it arrive"; never
// invent a delivery window.
export function shippingOptions({ line_items, shipping_address, currency = "USD" }) {
  return api("/shipping-options/", {
    method: "POST",
    body: JSON.stringify({ currency, line_items, shipping_address }),
  });
}

// Create a print job. Interior + cover PDFs are supplied as publicly-fetchable
// source_url inside printable_normalization. Job lands UNPAID (does not auto-print).
export function createPrintJob(payload) {
  return api("/print-jobs/", { method: "POST", body: JSON.stringify(payload) });
}

export function getPrintJob(id) {
  return api("/print-jobs/" + id + "/", { method: "GET" });
}

// Diagnostic probe: run auth + a cost-calc against an explicit environment
// ("sandbox" | "production") using the same creds, to detect an env/creds mismatch.
export async function costCalcProbe(whichEnv, sku, page_count = 32, shipping = "MAIL") {
  const base = whichEnv === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
  const key = process.env.LULU_CLIENT_KEY, secret = process.env.LULU_CLIENT_SECRET;
  if (!key || !secret) return { base, error: "not configured" };
  const basic = Buffer.from(key + ":" + secret).toString("base64");
  const tr = await fetch(base + "/auth/realms/glasstree/protocol/openid-connect/token", {
    method: "POST", headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials",
  });
  if (!tr.ok) return { base, stage: "auth", status: tr.status };
  const { access_token } = await tr.json();
  const r = await fetch(base + "/print-job-cost-calculations/", {
    method: "POST", headers: { Authorization: "Bearer " + access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ line_items: [{ page_count, pod_package_id: sku, quantity: 1 }], shipping_address: { city: "Moab", state_code: "UT", postcode: "84532", country_code: "US", street1: "1 Main St", phone_number: "+13035550100" }, shipping_option: shipping }),
  });
  const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { base, stage: "cost", status: r.status, data };
}

// Diagnostic: which environment/base we're on + whether auth works. No secrets.
export async function luluDiag() {
  const d = { env: process.env.LULU_ENV || "(unset → sandbox)", base: LULU_BASE, configured: luluConfigured() };
  try { const t = await getToken(); d.tokenOk = !!t; }
  catch (e) { d.tokenOk = false; d.tokenErr = String(e && e.message); }
  return d;
}
