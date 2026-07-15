// Generic durable per-key rate limiter for public POST endpoints (abuse control).
// ----------------------------------------------------------------------------
// Reuses the same Supabase `pb_kv` table the agent limiter uses (durable +
// shared across serverless instances); falls back to an in-memory Map for local
// dev when Supabase isn't configured. Soft cap (read-modify-write, not atomic) —
// a determined abuser racing concurrent requests can overshoot slightly, but the
// ceiling holds within a few requests, which is all we need to blunt spam/floods.
//
// CAPTCHA slots in later: when hCaptcha/Turnstile keys exist, verify the token
// FIRST in the route, then still call rateLimit() as a second layer.
// ----------------------------------------------------------------------------
const memory = new Map();
let storePromise;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

async function getBackend() {
  if (storePromise !== undefined) return storePromise;
  storePromise = (async () => {
    if (!SB_URL || !SB_KEY) return null; // local dev → in-memory
    const headers = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
    try {
      const probe = await fetch(`${SB_URL}/rest/v1/pb_kv?select=key&limit=1`, { headers });
      if (!probe.ok) return null;
    } catch { return null; }
    return {
      async get(key) {
        try {
          const r = await fetch(`${SB_URL}/rest/v1/pb_kv?key=eq.${encodeURIComponent(key)}&select=val`, { headers, cache: "no-store" });
          if (!r.ok) return null;
          const rows = await r.json();
          return rows && rows[0] ? rows[0].val : null;
        } catch { return null; }
      },
      async set(key, val) {
        try {
          await fetch(`${SB_URL}/rest/v1/pb_kv`, {
            method: "POST",
            headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ key, val, updated_at: new Date().toISOString() }),
          });
        } catch { /* soft-fail: limiter degrades to allow rather than error the request */ }
      },
    };
  })();
  return storePromise;
}
async function readKey(key) { const b = await getBackend(); return b ? b.get(key) : (memory.get(key) || null); }
async function writeKey(key, val) { const b = await getBackend(); if (b) return b.set(key, val); memory.set(key, val); }

// Best-effort client IP from the platform's forwarding headers.
export function clientIp(request) {
  const h = request.headers;
  const xff = h.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || h.get("x-real-ip") || "unknown").trim() || "unknown";
}

// Durable per-key sliding-window limiter.
//   const rl = await rateLimit("waitlist:" + clientIp(request), { limit: 5, windowMs: 60_000 });
//   if (!rl.ok) return Response.json({ error: rl.error }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
export async function rateLimit(key, { limit = 10, windowMs = 60_000 } = {}, now = Date.now()) {
  const rlKey = "rl2:" + key;
  const rec = await readKey(rlKey);
  if (!rec || now - rec.windowStart > windowMs) {
    await writeKey(rlKey, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1 };
  }
  if (rec.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((rec.windowStart + windowMs - now) / 1000));
    return { ok: false, status: 429, retryAfter, error: "Too many requests — please wait a moment and try again." };
  }
  await writeKey(rlKey, { count: rec.count + 1, windowStart: rec.windowStart });
  return { ok: true, remaining: limit - rec.count - 1 };
}

// Convenience: apply a limit and return a ready 429 Response if exceeded, else null.
export async function enforce(request, bucket, opts) {
  const rl = await rateLimit(bucket + ":" + clientIp(request), opts);
  if (rl.ok) return null;
  return Response.json({ error: rl.error }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
}
