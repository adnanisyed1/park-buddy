// Server-only Cloudflare Stream client for Pines (short vertical video).
// Env vars (add in Vercel, never in chat):
//   CLOUDFLARE_ACCOUNT_ID           — Cloudflare account id
//   CLOUDFLARE_STREAM_API_TOKEN     — API token scoped to Stream:Edit only
//   CLOUDFLARE_STREAM_WEBHOOK_SECRET — the signing secret Cloudflare shows when you
//                                      register the Stream webhook (for HMAC verify)
// Video bytes go client → Cloudflare directly; our server only mints upload URLs and
// stores metadata. Until the token is set, Pines upload degrades honestly (503).
import crypto from "crypto";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN || "";
const API = "https://api.cloudflare.com/client/v4";

export function streamConfigured() { return !!(ACCOUNT && TOKEN); }

// A short, resumable/direct one-time upload URL the client PUTs the recorded clip to.
// maxDurationSeconds caps clip length (Pines are ≤60s). requireSignedURLs off for MVP
// (public approved content); revisit if we gate playback.
export async function createDirectUpload({ maxDurationSeconds = 60, creator } = {}) {
  if (!streamConfigured()) { const e = new Error("Cloudflare Stream not configured"); e.status = 503; throw e; }
  const r = await fetch(API + "/accounts/" + ACCOUNT + "/stream/direct_upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ maxDurationSeconds, creator, requireSignedURLs: false }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) { const e = new Error("Stream upload URL failed (" + r.status + ")"); e.status = 502; throw e; }
  return { uploadURL: d.result.uploadURL, uid: d.result.uid };
}

// Playback + poster URLs for a ready clip. Cloudflare serves these on its own CDN.
export function playbackUrls(uid) {
  return {
    hls: "https://videodelivery.net/" + uid + "/manifest/video.m3u8",
    iframe: "https://iframe.videodelivery.net/" + uid,
    poster: "https://videodelivery.net/" + uid + "/thumbnails/thumbnail.jpg?time=1s&height=1200",
  };
}

// Verify the Cloudflare Stream webhook signature.
// Header "Webhook-Signature: time=<ts>,sig1=<hex>"; signed value is `${ts}.${rawBody}`
// HMAC-SHA256 with the webhook secret. Returns true/false.
export function verifyWebhook(rawBody, header) {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(",").map((kv) => kv.split("=")));
  const ts = parts.time, sig = parts.sig1;
  if (!ts || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(ts + "." + rawBody).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}
