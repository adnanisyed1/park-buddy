// POST /api/pines/upload-url — mint a Cloudflare Stream direct-upload URL for a Pine.
// Signed-in only (in-app capture). Client PUTs the recorded clip to the returned
// uploadURL, then calls POST /api/pines with the uid + place + GPS to create the row.
import { createClient } from "@supabase/supabase-js";
import { createDirectUpload, streamConfigured } from "../../../lib/cloudflareStream";

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
  if (!streamConfigured()) return Response.json({ error: "Pines video isn't set up yet — check back soon." }, { status: 503 });
  const user = await userFromToken(request);
  if (!user) return Response.json({ error: "Sign in to post a Pine." }, { status: 401 });

  try {
    const { uploadURL, uid } = await createDirectUpload({ maxDurationSeconds: 60, creator: user.id });
    return Response.json({ uploadURL, uid });
  } catch (e) {
    return Response.json({ error: "Couldn't start the upload." }, { status: e.status || 502 });
  }
}
