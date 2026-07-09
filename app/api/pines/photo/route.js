// POST /api/pines/photo — post a PHOTO Pine (no Cloudflare needed).
// Signed-in. Body JSON: { imageBase64 (data URL or bare b64), contentType, place_name,
// place_type, place_id, caption, lat, lng, accuracy_m, captured_at, location_source }.
// Uploads the (client-downscaled) image to the public "pines" Storage bucket, then
// writes a pines row (media_type=photo, status=pending → AI/manual moderation).
import { createClient } from "@supabase/supabase-js";
import { uploadPublicImage, storageConfigured } from "../../../lib/storage";
import { moderateImage } from "../../../lib/moderation";

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

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc || !storageConfigured()) return Response.json({ error: "Photo posting isn't set up yet — check back soon." }, { status: 503 });
  const user = await userFromToken(request);
  if (!user) return Response.json({ error: "Sign in to post." }, { status: 401 });

  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }

  const raw = String(b.imageBase64 || "");
  const m = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  const contentType = ((m && m[1]) || b.contentType || "image/jpeg").toLowerCase();
  const b64 = m ? m[2] : raw;
  if (!b64) return Response.json({ error: "Missing photo." }, { status: 400 });

  // Allowlist raster formats only — reject SVG (stored-XSS surface), GIF, etc.
  const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/pjpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = EXT[contentType];
  if (!ext) return Response.json({ error: "Only JPEG, PNG or WebP photos are allowed." }, { status: 400 });

  let bytes;
  try { bytes = Buffer.from(b64, "base64"); } catch { return Response.json({ error: "Bad image data." }, { status: 400 }); }
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return Response.json({ error: "Photo must be under 8 MB (downscale on device)." }, { status: 413 });
  // Magic-byte check — the bytes must actually be the image they claim to be.
  const B = bytes;
  const okJpg = B[0] === 0xff && B[1] === 0xd8;
  const okPng = B[0] === 0x89 && B[1] === 0x50 && B[2] === 0x4e && B[3] === 0x47;
  const okWebp = B.length > 12 && B[0] === 0x52 && B[1] === 0x49 && B[2] === 0x46 && B[3] === 0x46 && B[8] === 0x57 && B[9] === 0x45 && B[10] === 0x42 && B[11] === 0x50;
  if (!(okJpg || okPng || okWebp)) return Response.json({ error: "That doesn't look like a valid image." }, { status: 400 });

  const path = user.id + "/" + Date.now() + "-" + Math.round(Math.random() * 1e6) + "." + ext;

  let image_url;
  try { image_url = await uploadPublicImage(path, bytes, contentType); }
  catch { return Response.json({ error: "Couldn't save your photo." }, { status: 502 }); }

  // AI moderation first-pass: clean → approved (live), flagged → rejected, else pending
  // (manual queue). Never blocks posting — failure/absence falls back to pending.
  const mod = await moderateImage(image_url);
  const status = mod.decision === "approve" ? "approved" : mod.decision === "reject" ? "rejected" : "pending";

  const inRange = (v, lo, hi) => (v != null && v >= lo && v <= hi ? v : null);
  const lat = inRange(num(b.lat), -90, 90), lng = inRange(num(b.lng), -180, 180);
  const PT = new Set(["park", "forest", "state_park", "town", "monument", "lake"]);
  let captured_at = new Date().toISOString();
  if (b.captured_at) { const d = new Date(b.captured_at); if (!isNaN(d.getTime())) captured_at = d.toISOString(); }
  const row = {
    user_id: user.id,
    media_type: "photo",
    image_url,
    poster_url: image_url, // feed uses poster_url uniformly
    place_type: PT.has(String(b.place_type)) ? String(b.place_type) : "park",
    place_id: String(b.place_id || "").slice(0, 60),
    place_name: String(b.place_name || "").slice(0, 120),
    caption: (String(b.caption || "").trim() || "Adventure").slice(0, 300),
    lat, lng, accuracy_m: inRange(num(b.accuracy_m), 0, 1e7),
    location_source: b.location_source === "photo" ? "photo" : "manual",
    captured_at,
    verified: false,
    status, // AI first-pass: approved | rejected | pending (manual queue)
  };

  try {
    const r = await fetch(sb + "/rest/v1/pines", {
      method: "POST",
      headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!r.ok) return Response.json({ error: "Couldn't save your Pine (" + r.status + ")." }, { status: 502 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Couldn't reach the Pines backend." }, { status: 502 }); }
}
