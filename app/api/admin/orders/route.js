// Admin order desk — see every Trip Book order, spot the ones going wrong, and write
// to the customer.
//
// Auth: header `x-admin-secret: <ORDERS_ADMIN_SECRET>`, compared timing-safely. Same
// pattern as the Pines moderation queue. This screen shows customer names and email
// addresses, so it is never public and the page is noindex.
//
//   GET  ?live=1   list orders, optionally refreshing each open print job from Lulu
//   POST { id, message }   email the customer about their order
import { luluConfigured, getPrintJob } from "../../../lib/lulu";
import { requireAdmin } from "../../../lib/adminAuth";
import { sendMail, mailConfigured } from "../../../lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A book takes 10–12 days door to door. Past that, something probably needs a human.
const LATE_AFTER_DAYS = 14;
const STUCK_AFTER_DAYS = 3;   // still not ACCEPTED by the printer after this long

function sbBase() { return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, ""); }

const jobIdFrom = (note) => { const m = /job\s+(\d+)/i.exec(String(note || "")); return m ? m[1] : null; };
const trackFrom = (note) => { const m = /(https?:\/\/\S+)/.exec(String(note || "")); return m ? m[1] : null; };
const daysSince = (iso) => {
  const t = Date.parse(iso || "");
  return isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
};

// Why this order needs attention — or null if it's fine. Ordered most urgent first so a
// single line can carry the reason.
function concernOf(row, job) {
  const age = daysSince(row.created_at);
  const itemStatus = job && ((job.line_items || [])[0] || {}).status;
  const name = itemStatus && itemStatus.name;

  if (name === "REJECTED" || name === "ERROR") {
    const msg = (itemStatus.messages && (itemStatus.messages.error || itemStatus.messages.info)) || "";
    return { level: "error", text: "The printer rejected this book" + (msg ? ": " + String(msg).slice(0, 120) : ".") };
  }
  if (row.status === "in_production" && age != null && age >= LATE_AFTER_DAYS) {
    return { level: "error", text: `Still unshipped after ${age} days — a book normally ships well inside ${LATE_AFTER_DAYS}.` };
  }
  if (name && name !== "ACCEPTED" && name !== "SHIPPED" && age != null && age >= STUCK_AFTER_DAYS) {
    return { level: "warn", text: `Print job has sat at ${name} for ${age} days.` };
  }
  if (row.status === "in_production" && age != null && age >= LATE_AFTER_DAYS - 4) {
    return { level: "warn", text: `Day ${age} — due to ship about now.` };
  }
  return null;
}

export async function GET(request) {
  const gate = requireAdmin(request);
  if (gate) return gate;

  const sb = sbBase(), svc = process.env.SUPABASE_SERVICE_KEY;
  if (!sb || !svc) return Response.json({ error: "Database isn't configured." }, { status: 503 });

  const u = new URL(request.url);
  const live = u.searchParams.get("live") === "1";

  const sel = "id,email,trip_title,theme,size,quantity,status,note,created_at";
  const r = await fetch(`${sb}/rest/v1/book_orders?select=${sel}&order=created_at.desc&limit=200`,
    { headers: { apikey: svc, Authorization: "Bearer " + svc }, cache: "no-store" });
  if (!r.ok) return Response.json({ error: "Couldn't load orders." }, { status: 502 });
  const rows = await r.json().catch(() => []);

  const out = [];
  for (const row of rows) {
    const jobId = jobIdFrom(row.note);
    let job = null;
    // Only refresh jobs that could still change — a shipped order won't tell us anything new.
    if (live && luluConfigured() && jobId && row.status !== "shipped") {
      try { job = await getPrintJob(jobId); } catch { /* leave job null; the row still lists */ }
    }
    const itemStatus = job && ((job.line_items || [])[0] || {}).status;
    out.push({
      id: row.id,
      email: row.email,
      title: row.trip_title,
      size: row.size,
      quantity: row.quantity,
      status: row.status,
      createdAt: row.created_at,
      ageDays: daysSince(row.created_at),
      jobId,
      jobStatus: (itemStatus && itemStatus.name) || null,
      tracking: trackFrom(row.note),
      concern: concernOf(row, job),
      note: row.note,
    });
  }

  return Response.json({
    orders: out,
    liveChecked: live && luluConfigured(),
    canEmail: mailConfigured(),
    needingAttention: out.filter((o) => o.concern).length,
  });
}

// Write to a customer about their order. Kept deliberately plain: a subject and a body
// the owner typed, in the Park Buddy shell — no templated apology language, because the
// situations that need a human are exactly the ones a template gets wrong.
export async function POST(request) {
  const gate = requireAdmin(request);
  if (gate) return gate;
  if (!mailConfigured()) return Response.json({ error: "Email isn't configured (RESEND_API_KEY)." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }

  const to = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const title = String(body.title || "your Trip Book").slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return Response.json({ error: "That order has no usable email address." }, { status: 400 });
  if (message.length < 10) return Response.json({ error: "Write a little more than that." }, { status: 400 });

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = message.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#F5EFE0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EFE0;padding:32px 16px;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"
style="max-width:520px;background:#FFFCF4;border:1px solid #D9CCAD;border-radius:12px;">
<tr><td style="padding:28px 30px;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#22301F;">
<div style="font:600 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9A7B2E;">Park Buddy</div>
<h1 style="font:400 24px/1.25 Georgia,serif;margin:14px 0 18px;">About ${esc(title)}</h1>
${paras}
<div style="border-top:1px solid #D9CCAD;margin-top:20px;padding-top:14px;font-size:13px;color:#6C6452;">
Just reply to this message and it reaches us directly.</div>
</td></tr></table></td></tr></table></body></html>`;

  const res = await sendMail({
    to,
    subject: `About your Trip Book — ${title}`,
    html,
    text: message + "\n\nJust reply to this message and it reaches us directly.",
  });
  if (!res.sent) return Response.json({ error: "Couldn't send: " + res.reason }, { status: 502 });
  return Response.json({ ok: true, id: res.id });
}
