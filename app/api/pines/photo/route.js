// POST /api/pines/photo — post a PHOTO Pine (no Cloudflare needed).
// Signed-in. Body JSON: { imageBase64 (data URL or bare b64), contentType, place_name,
// place_type, place_id, caption, lat, lng, accuracy_m, captured_at, location_source }.
// Uploads the (client-downscaled) image to the public "pines" Storage bucket, then
// writes a pines row (media_type=photo, status=pending → AI/manual moderation).
import { createClient } from "@supabase/supabase-js";
import { uploadPublicImage, storageConfigured } from "../../../lib/storage";

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
  const m = raw.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  const contentType = (m && m[1]) || b.contentType || "image/jpeg";
  const b64 = m ? m[2] : raw;
  if (!b64) return Response.json({ error: "Missing photo." }, { status: 400 });

  let bytes;
  try { bytes = Buffer.from(b64, "base64"); } catch { return Response.json({ error: "Bad image data." }, { status: 400 }); }
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return Response.json({ error: "Photo must be under 8 MB (downscale on device)." }, { status: 413 });

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = user.id + "/" + Date.now() + "-" + Math.round(Math.random() * 1e6) + "." + ext;

  let image_url;
  try { image_url = await uploadPublicImage(path, bytes, contentType); }
  catch { return Response.json({ error: "Couldn't save your photo." }, { status: 502 }); }

  const lat = num(b.lat), lng = num(b.lng);
  const row = {
    user_id: user.id,
    media_type: "photo",
    image_url,
    poster_url: image_url, // feed uses poster_url uniformly
    place_type: String(b.place_type || "").slice(0, 20),
    place_id: String(b.place_id || "").slice(0, 60),
    place_name: String(b.place_name || "").slice(0, 120),
    caption: (String(b.caption || "").trim() || "Adventure").slice(0, 300),
    lat, lng, accuracy_m: num(b.accuracy_m),
    location_source: b.location_source === "photo" ? "photo" : "manual",
    captured_at: b.captured_at || new Date().toISOString(),
    verified: false,
    status: "pending", // awaiting moderation (AI hook / manual queue)
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
