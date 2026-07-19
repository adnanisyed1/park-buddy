// Shared gate for the employee portal.
//
// One place, so every admin endpoint is protected identically. Duplicating a secret
// comparison across routes is how one of them quietly ends up weaker than the rest.
//
// Secret: ADMIN_SECRET, falling back to ORDERS_ADMIN_SECRET so the order desk keeps
// working for anyone who already set that. Sent as `x-admin-secret`.
//
// Comparison is timing-safe: a plain === leaks how much of the secret was right via
// response timing, which is enough to guess it character by character.
import crypto from "crypto";

export function adminSecret() {
  return process.env.ADMIN_SECRET || process.env.ORDERS_ADMIN_SECRET || "";
}

function safeEq(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  if (x.length !== y.length) return false;
  try { return crypto.timingSafeEqual(x, y); } catch { return false; }
}

// Returns null when the caller is allowed; otherwise a ready Response to return.
export function requireAdmin(request) {
  const secret = adminSecret();
  if (!secret) {
    return Response.json(
      { error: "The portal isn't configured yet — set ADMIN_SECRET." },
      { status: 503 }
    );
  }
  if (!safeEq(request.headers.get("x-admin-secret"), secret)) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  return null;
}

// Supabase REST helper, or null when the database isn't configured. Every caller must
// handle null rather than assuming — the portal has to render honestly on a half-set-up
// environment, not crash.
export function db() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return {
    url,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    async select(path) {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers: this.headers, cache: "no-store" });
      if (!r.ok) throw new Error("db " + r.status);
      return r.json();
    },
  };
}
