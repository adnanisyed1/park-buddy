// Durable rate limiting + daily spend cap for the AI agent.
// ----------------------------------------------------------------------------
// The old limiter was an in-memory Map: it reset on every cold start and wasn't
// shared across concurrent function instances, so on Netlify it barely limited
// anything and gave NO protection against a runaway Anthropic bill.
//
// This version persists counters in Supabase (durable + shared across
// instances) and falls back to an in-memory store for local dev, where Supabase
// isn't configured. It adds two protections the old one lacked:
//   1. A GLOBAL daily request cap (across all IPs).
//   2. A GLOBAL daily USD spend cap, computed from real token usage.
// Both are soft caps (read-modify-write, not atomic) — fine for cost control at
// this scale; a determined abuser racing concurrent requests can overshoot
// slightly, but the ceiling holds within a few requests.
// ----------------------------------------------------------------------------

// --- Tunable knobs (override via env in the host dashboard) ------------------
export const PER_IP_LIMIT = Number(process.env.AGENT_RATE_LIMIT || 8); // requests / window / IP
export const PER_IP_WINDOW_MS = Number(process.env.AGENT_RATE_WINDOW_MS || 60_000);
export const DAILY_REQUEST_CAP = Number(process.env.AGENT_DAILY_REQUESTS || 5_000);
export const DAILY_USD_CAP = Number(process.env.AGENT_DAILY_USD || 10); // dollars/day, all users

// Claude Haiku 4.5 pricing, USD per million tokens (see claude-api reference).
// Cache writes bill ~1.25x input, cache reads ~0.1x input.
const PRICE = { in: 1.0, out: 5.0, cacheWrite: 1.25, cacheRead: 0.1 };

// Compute the USD cost of one Anthropic response from its usage block.
export function usageCostUsd(usage) {
  if (!usage) return 0;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cw = usage.cache_creation_input_tokens || 0;
  const cr = usage.cache_read_input_tokens || 0;
  return (
    (inTok * PRICE.in + outTok * PRICE.out + cw * PRICE.cacheWrite + cr * PRICE.cacheRead) /
    1_000_000
  );
}

// --- Storage backend: Supabase (pb_kv table), or in-memory for local dev -----
// Reuses the Supabase project the app already uses (service-role key, server
// only). Counters live in a tiny key/value table:
//   create table pb_kv (key text primary key, val jsonb, updated_at timestamptz default now());
// See supabase-kv.sql. If Supabase env isn't configured OR the table is missing,
// we transparently fall back to an in-memory Map (fine for local dev).
const memory = new Map();
let storePromise; // memoized backend probe so we set up once

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

async function getBackend() {
  if (storePromise !== undefined) return storePromise;
  storePromise = (async () => {
    if (!SB_URL || !SB_KEY) return null; // local dev → in-memory
    const headers = {
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
    };
    try {
      // Probe the table so we fail over cleanly if pb_kv hasn't been created yet.
      const probe = await fetch(`${SB_URL}/rest/v1/pb_kv?select=key&limit=1`, { headers });
      if (!probe.ok) return null;
    } catch {
      return null; // signal: use in-memory fallback
    }
    return {
      async get(key) {
        try {
          const r = await fetch(
            `${SB_URL}/rest/v1/pb_kv?key=eq.${encodeURIComponent(key)}&select=val`,
            { headers, cache: "no-store" }
          );
          if (!r.ok) return null;
          const rows = await r.json();
          return rows && rows[0] ? rows[0].val : null;
        } catch {
          return null;
        }
      },
      async set(key, val) {
        try {
          // Upsert on the primary key (merge-duplicates), don't return the row.
          await fetch(`${SB_URL}/rest/v1/pb_kv`, {
            method: "POST",
            headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ key, val, updated_at: new Date().toISOString() }),
          });
        } catch {
          /* soft-fail: cost caps degrade to best-effort rather than erroring the agent */
        }
      },
    };
  })();
  return storePromise;
}

async function readKey(key) {
  const backend = await getBackend();
  if (backend) return backend.get(key);
  return memory.get(key) || null;
}
async function writeKey(key, val) {
  const backend = await getBackend();
  if (backend) return backend.set(key, val);
  memory.set(key, val);
}

function today(now) {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// --- Public API --------------------------------------------------------------
// Call BEFORE hitting the model. Returns { ok } or { ok:false, status, error }.
export async function checkLimits(ip, now = Date.now()) {
  // 1. Per-IP sliding window.
  const rlKey = "rl:" + ip;
  const rec = await readKey(rlKey);
  if (!rec || now - rec.windowStart > PER_IP_WINDOW_MS) {
    await writeKey(rlKey, { count: 1, windowStart: now });
  } else {
    if (rec.count >= PER_IP_LIMIT) {
      return { ok: false, status: 429, error: "Too many requests — please wait a moment and try again." };
    }
    await writeKey(rlKey, { count: rec.count + 1, windowStart: rec.windowStart });
  }

  // 2. Global daily request cap.
  const day = today(now);
  const reqKey = "req:" + day;
  const reqCount = (await readKey(reqKey)) || 0;
  if (reqCount >= DAILY_REQUEST_CAP) {
    return { ok: false, status: 429, error: "The assistant is resting for today — please try again tomorrow." };
  }
  await writeKey(reqKey, reqCount + 1);

  // 3. Global daily spend cap (checked against spend recorded so far).
  const usd = (await readKey("usd:" + day)) || 0;
  if (usd >= DAILY_USD_CAP) {
    return { ok: false, status: 429, error: "The assistant is resting for today — please try again tomorrow." };
  }

  return { ok: true };
}

// Call AFTER each model response to accumulate real spend.
export async function recordSpend(usd, now = Date.now()) {
  if (!usd) return;
  const key = "usd:" + today(now);
  const prev = (await readKey(key)) || 0;
  await writeKey(key, prev + usd);
}
