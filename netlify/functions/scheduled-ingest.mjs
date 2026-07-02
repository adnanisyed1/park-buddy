// Park Buddy — scheduled data refresh (Netlify Scheduled Function).
// Runs on a cron and re-ingests every seed park into Supabase automatically,
// so the cached dataset stays fresh with zero manual clicking.
//
// Netlify picks this up automatically (file in netlify/functions/ with a `config.schedule`).
// Default: daily at 09:00 UTC. Change the cron string below to adjust.
//
// It simply calls our own /api/ingest endpoint for each batch offset, paging until done.

export const config = {
  schedule: "0 9 * * *", // every day at 09:00 UTC
};

export default async function handler() {
  const base = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/+$/, "");
  if (!base) {
    return new Response(JSON.stringify({ ok: false, error: "No site URL available." }), { status: 500 });
  }
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
      summary.push({ offset, error: String(e && e.message || e) });
      break;
    }
  }

  const total = summary.reduce((a, s) => a + (s.upserted || 0), 0);
  return new Response(JSON.stringify({ ok: true, ranAt: new Date().toISOString(), totalUpserted: total, batches: summary }), {
    headers: { "Content-Type": "application/json" },
  });
}
