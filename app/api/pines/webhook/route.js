// POST /api/pines/webhook — Cloudflare Stream calls this when a clip finishes encoding.
// We verify the signature, then flip the Pine from 'processing' → 'pending' (awaiting
// moderation) and store its real duration/poster. AI moderation (auto approve/reject,
// route the uncertain to the manual queue) hooks in HERE once a moderation provider is
// configured — until then a Pine sits at 'pending' for manual review.
import { verifyWebhook, playbackUrls } from "../../../lib/cloudflareStream";

export const runtime = "nodejs";

function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }

export async function POST(request) {
  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get("webhook-signature"))) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  let body; try { body = JSON.parse(raw); } catch { return Response.json({ error: "bad body" }, { status: 400 }); }
  const uid = body.uid;
  const ready = body.readyToStream === true || (body.status && body.status.state === "ready");
  if (!uid) return Response.json({ ok: true }); // nothing to do

  const patch = ready
    ? { status: "pending", duration_s: body.duration ? Math.round(body.duration) : undefined, ...playbackUrls(uid) }
    : { status: "rejected" }; // encoding error → don't leave it stuck in 'processing'
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  try {
    const r = await fetch(sb + "/rest/v1/pines?cf_uid=eq." + encodeURIComponent(uid), {
      method: "PATCH",
      headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    // If the write failed, return non-2xx so Cloudflare retries — otherwise the Pine
    // would be stuck in 'processing' forever (the webhook is the only thing that advances it).
    if (!r.ok) return Response.json({ error: "update failed" }, { status: 502 });
  } catch { return Response.json({ error: "backend unreachable" }, { status: 502 }); }
  return Response.json({ ok: true });
}
