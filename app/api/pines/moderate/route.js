// POST /api/pines/moderate — approve or reject a pending Pine (admin only).
// On APPROVE: flips status → 'approved' (it appears in the feed) AND auto-posts it
// to the Facebook Page (best-effort; a Facebook failure never blocks the approval).
// Auth: send header  x-admin-secret: <PINES_ADMIN_SECRET>  (set in env). This is the
// gate until a full admin UI/role exists — it's how you (or a small admin tool)
// clear the moderation queue.
//   Body: { id: <pine id>, action: "approve" | "reject" }
import { fbConfigured, postToPage, pinePostText } from "../../../lib/facebook";
import crypto from "crypto";

export const runtime = "nodejs";

// Constant-time secret compare (avoids leaking the admin secret via timing).
function safeEq(a, b) { const A = Buffer.from(String(a || "")); const B = Buffer.from(String(b || "")); return A.length === B.length && crypto.timingSafeEqual(A, B); }

function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://park-buddy-gamma.vercel.app";

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY, secret = process.env.PINES_ADMIN_SECRET;
  if (!sb || !svc || !secret) return Response.json({ error: "Moderation isn't configured." }, { status: 503 });
  if (!safeEq(request.headers.get("x-admin-secret"), secret)) return Response.json({ error: "Not authorized." }, { status: 401 });

  let b; try { b = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const id = parseInt(b.id, 10);
  const action = b.action === "reject" ? "reject" : "approve";
  if (!id) return Response.json({ error: "Missing pine id." }, { status: 400 });

  const auth = { apikey: svc, Authorization: "Bearer " + svc };

  // Load the pine (need its fields to compose the FB post).
  let pine, backendErr = false;
  try {
    const r = await fetch(sb + "/rest/v1/pines?id=eq." + id + "&select=id,place_name,place_type,place_id,caption,image_url,poster_url,status", { headers: auth });
    if (!r.ok) backendErr = true;
    else { const rows = await r.json().catch(() => []); pine = Array.isArray(rows) && rows[0]; }
  } catch { backendErr = true; }
  if (backendErr) return Response.json({ error: "Couldn't reach the backend." }, { status: 502 });
  if (!pine) return Response.json({ error: "Pine not found." }, { status: 404 });

  // Flip status.
  const status = action === "approve" ? "approved" : "rejected";
  try {
    const r = await fetch(sb + "/rest/v1/pines?id=eq." + id, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) return Response.json({ error: "Couldn't update (" + r.status + ")." }, { status: 502 });
  } catch { return Response.json({ error: "Couldn't reach the backend." }, { status: 502 }); }

  // Auto-post to Facebook on approve (best-effort — never blocks the approval).
  let facebook = "skipped";
  if (action === "approve" && fbConfigured()) {
    try {
      await postToPage({ message: pinePostText(pine), link: SITE + "/pines", imageUrl: pine.image_url || pine.poster_url || undefined });
      facebook = "posted";
    } catch (e) { facebook = "failed: " + (e.message || "error"); }
  }

  return Response.json({ ok: true, status, facebook });
}
