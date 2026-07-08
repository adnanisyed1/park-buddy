// Park Buddy — scheduled data refresh (Vercel Cron).
// Replaces the old Netlify Scheduled Function (netlify/functions/scheduled-ingest.mjs).
//
// Vercel invokes this on the schedule declared in vercel.json (`crons`), sending
// GET with an `Authorization: Bearer ${CRON_SECRET}` header when CRON_SECRET is
// set. We re-ingest every seed park into Supabase so the cached dataset stays
// fresh with zero manual clicking — by paging our own /api/ingest until done.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // ingest pages through all 63 parks; needs Vercel Pro headroom

export async function GET(request) {
  // Auth: reject anything that isn't Vercel's cron (or a caller with the secret).
  // Fail closed — if CRON_SECRET isn't set, refuse rather than run openly.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== "Bearer " + secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Derive our own origin from the incoming request (no host-specific env needed).
  const base = new URL(request.url).origin;
  const token = process.env.INGEST_SECRET ? "&token=" + encodeURIComponent(process.env.INGEST_SECRET) : "";
  const summary = [];
  let offset = 0, guard = 0;

  // Page through the batched ingest until it reports done (guard caps the loop).
  while (guard++ < 20) {
    try {
      const r = await fetch(base + "/api/ingest?all=1&offset=" + offset + token);
      const data = await r.json();
      summary.push({ offset, upserted: data.totalUpserted, ok: data.ok });
      if (data.done) break;
      offset += 6;
    } catch (e) {
      summary.push({ offset, error: String((e && e.message) || e) });
      break;
    }
  }

  const total = summary.reduce((a, s) => a + (s.upserted || 0), 0);
  return Response.json({ ok: true, ranAt: new Date().toISOString(), totalUpserted: total, batches: summary });
}
