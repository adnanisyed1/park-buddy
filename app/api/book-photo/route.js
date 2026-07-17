// POST /api/book-photo — store one full-resolution book photo.
// Signed-in. Body JSON: { imageBase64 (data URL or bare b64), contentType, w, h }.
//
// Why this exists: book photos used to ride Trip Mode's on-trail snapshot path,
// which re-encodes to 1280px and drops the original. Lulu prints at 300 DPI, so an
// 8.5" page needs ~2550px — every full-page photo was printing at half the required
// resolution, irreversibly. Print-resolution photos can't live in localStorage
// either (~1MB each against a ~5MB browser cap), so they live here instead and the
// browser keeps only a thumbnail.
//
// The bucket is PRIVATE and nothing client-side reads it — the PDF builder pulls
// bytes server-side with the service key. Objects are keyed by user id so account
// deletion can actually remove them.
import { createClient } from "@supabase/supabase-js";
import { uploadPrivateImage, storageConfigured } from "../../lib/storage";
import { rateLimit } from "../../lib/ratelimit";

export const runtime = "nodejs";

function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

async function userFromToken(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const admin = createClient(sbBase(), ANON);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

export async function POST(request) {
  if (!sbBase() || !process.env.SUPABASE_SERVICE_KEY || !storageConfigured()) {
    return Response.json({ error: "Photo storage isn't set up yet." }, { status: 503 });
  }
  const user = await userFromToken(request);
  if (!user) return Response.json({ error: "Sign in to add photos to your book." }, { status: 401 });
  const rl = await rateLimit("book-photo:" + user.id, { limit: 60, windowMs: 300_000 });
  if (!rl.ok) return Response.json({ error: rl.error }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }

  const raw = String(b.imageBase64 || "");
  const m = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  const contentType = ((m && m[1]) || b.contentType || "image/jpeg").toLowerCase();
  const b64 = m ? m[2] : raw;
  if (!b64) return Response.json({ error: "Missing photo." }, { status: 400 });

  // Allowlist raster formats only — reject SVG (stored-XSS surface) and anything
  // the print pipeline can't embed.
  const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/pjpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = EXT[contentType];
  if (!ext) return Response.json({ error: "Only JPEG, PNG or WebP photos are allowed." }, { status: 400 });

  let bytes;
  try { bytes = Buffer.from(b64, "base64"); } catch { return Response.json({ error: "Bad image data." }, { status: 400 }); }
  // 16 MB: print photos are much larger than the Pines feed's 8 MB screen copies.
  if (!bytes.length || bytes.length > 16 * 1024 * 1024) {
    return Response.json({ error: "Photo must be under 16 MB." }, { status: 413 });
  }
  // Magic-byte check — the bytes must actually be the image they claim to be.
  const B = bytes;
  const okJpg = B[0] === 0xff && B[1] === 0xd8;
  const okPng = B[0] === 0x89 && B[1] === 0x50 && B[2] === 0x4e && B[3] === 0x47;
  const okWebp = B.length > 12 && B[0] === 0x52 && B[1] === 0x49 && B[2] === 0x46 && B[3] === 0x46 && B[8] === 0x57 && B[9] === 0x45 && B[10] === 0x42 && B[11] === 0x50;
  if (!(okJpg || okPng || okWebp)) return Response.json({ error: "That doesn't look like a valid image." }, { status: 400 });

  const path = user.id + "/" + Date.now() + "-" + Math.round(Math.random() * 1e6) + "." + ext;
  try { await uploadPrivateImage(path, bytes, contentType); }
  catch { return Response.json({ error: "Couldn't save your photo." }, { status: 502 }); }

  // w/h are the client's measurement of its own canvas, used only to show the print
  // resolution back to the traveller. They can't be trusted for anything else, and
  // nothing downstream relies on them — the PDF measures the real bytes.
  const dim = (v) => (typeof v === "number" && isFinite(v) && v > 0 && v < 30000 ? Math.round(v) : null);
  return Response.json({ ok: true, path, w: dim(b.w), h: dim(b.h), bytes: bytes.length });
}
