// Server-only Lulu Print API client (OAuth2 client_credentials).
// Env vars (add in Vercel, never in chat):
//   LULU_CLIENT_KEY, LULU_CLIENT_SECRET  — from developers.sandbox.lulu.com (sandbox)
//   LULU_ENV = "sandbox" (default) | "production"
// Sandbox never charges/prints but runs the full create→pay→production state machine.
// Docs brief gathered this session (see scratchpad lulu_openapi.yml).

const ENV = (process.env.LULU_ENV || "sandbox").toLowerCase();
export const LULU_BASE = ENV === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
const AUTH_URL = LULU_BASE + "/auth/realms/glasstree/protocol/openid-connect/token";

// Square color hardcover photo-book SKU (8.5×8.5, full color, premium, casewrap,
// 80# coated white, matte). Interior PDF = 630×630pt, min 24 pages.
export const LULU_SKU = "0850X0850.FC.PRE.CW.080CW444.MXX";

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

// Create a print job. Interior + cover PDFs are supplied as publicly-fetchable
// source_url inside printable_normalization. Job lands UNPAID (does not auto-print).
export function createPrintJob(payload) {
  return api("/print-jobs/", { method: "POST", body: JSON.stringify(payload) });
}

export function getPrintJob(id) {
  return api("/print-jobs/" + id + "/", { method: "GET" });
}
