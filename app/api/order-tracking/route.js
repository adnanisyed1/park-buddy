// GET /api/order-tracking — poll open print jobs, record tracking, email when shipped.
//
// The printer knows a parcel's carrier and tracking number, but nothing ever asked it.
// Customers paid and then heard nothing until a box arrived. This closes that loop.
//
// Run it on a schedule (Vercel Cron, every few hours is plenty — books take days to
// print). Protect it with ORDER_CRON_SECRET so it isn't a public trigger:
//     GET /api/order-tracking?key=<ORDER_CRON_SECRET>
//
// Safe to run repeatedly: an order is only emailed once, because the row is moved to
// `shipped` in the same pass and only `in_production` rows are ever picked up.
import { luluConfigured, getPrintJob } from "../../lib/lulu";
import { sendMail, shippedNotice, mailConfigured } from "../../lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_RUN = 40;

function sb() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url, key, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" } } : null;
}

// The print job id was written into the note as "… job <id> · …" by the webhook.
function jobIdFrom(note) {
  const m = /job\s+(\d+)/i.exec(String(note || ""));
  return m ? m[1] : null;
}

// Lulu reports tracking per line item once a parcel is handed to the carrier.
function trackingOf(job) {
  const items = (job && job.line_items) || [];
  const urls = [];
  let carrier = null;
  for (const li of items) {
    if (Array.isArray(li.tracking_urls)) urls.push(...li.tracking_urls.filter(Boolean));
    else if (li.tracking_id) urls.push(String(li.tracking_id));
    if (li.carrier_name) carrier = li.carrier_name;
  }
  const status = (job && job.status && job.status.name) || "";
  return { urls: [...new Set(urls)], carrier, status };
}

export async function GET(request) {
  const u = new URL(request.url);
  const secret = process.env.ORDER_CRON_SECRET;
  if (!secret || u.searchParams.get("key") !== secret) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!luluConfigured()) return Response.json({ error: "Print fulfillment isn't configured." }, { status: 503 });
  const db = sb();
  if (!db) return Response.json({ error: "Database isn't configured." }, { status: 503 });

  // Only orders we believe are still at the press.
  const r = await fetch(
    `${db.url}/rest/v1/book_orders?status=eq.in_production&select=id,email,trip_title,note&order=created_at.asc&limit=${MAX_PER_RUN}`,
    { headers: db.headers, cache: "no-store" }
  );
  if (!r.ok) return Response.json({ error: "Couldn't read orders." }, { status: 502 });
  const rows = await r.json();

  const out = { checked: 0, shipped: 0, emailed: 0, skipped: [], mailConfigured: mailConfigured() };

  for (const row of rows) {
    const jobId = jobIdFrom(row.note);
    if (!jobId) { out.skipped.push({ id: row.id, why: "no job id in note" }); continue; }

    let job;
    try { job = await getPrintJob(jobId); }
    catch (e) { out.skipped.push({ id: row.id, why: "job fetch failed" }); continue; }
    out.checked++;

    const { urls, carrier, status } = trackingOf(job);
    // Nothing to tell the customer until the printer hands it to a carrier.
    if (!urls.length && status !== "SHIPPED") continue;

    // Record first, then email. If the email fails we still know it shipped, and the
    // customer isn't emailed twice on the next run.
    const patch = {
      status: "shipped",
      note: String(row.note || "") + " · shipped " + new Date().toISOString().slice(0, 10) +
            (carrier ? " · " + carrier : "") + (urls.length ? " · " + urls[0] : ""),
    };
    const up = await fetch(`${db.url}/rest/v1/book_orders?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { ...db.headers, Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (!up.ok) { out.skipped.push({ id: row.id, why: "couldn't update row" }); continue; }
    out.shipped++;

    const msg = shippedNotice({ title: row.trip_title || "Trip Book", carrier, trackingUrls: urls });
    const sent = await sendMail({ to: row.email, ...msg });
    if (sent.sent) out.emailed++;
    else out.skipped.push({ id: row.id, why: "email: " + sent.reason });
  }

  return Response.json(out);
}
