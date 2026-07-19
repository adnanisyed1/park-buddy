// GET /api/admin/overview — everything the portal home needs, in one call.
//
// Three questions, answered from real sources or explicitly marked unavailable:
//   1. What money came in?        → Stripe
//   2. What's happening to orders? → book_orders + the printer
//   3. Is anything broken?         → the env each dependency actually needs
//
// NOTHING here is estimated or filled in. A section that can't be read says so, because
// a dashboard that quietly shows zero when it means "couldn't check" is worse than no
// dashboard: it reads as "no sales" instead of "ask again".
import Stripe from "stripe";
import { requireAdmin, db } from "../../../lib/adminAuth";
import { luluConfigured, luluDiag } from "../../../lib/lulu";
import { mailConfigured } from "../../../lib/mail";
import { storageConfigured } from "../../../lib/storage";
import { PROFIT_RANGE } from "../../../lib/bookPricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86400;
const LATE_AFTER_DAYS = 14;

const money = (cents) => Math.round((cents || 0)) / 100;
const daysSince = (iso) => {
  const t = Date.parse(iso || "");
  return isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
};

// ---------------------------------------------------------------------------
// Money — real Stripe sessions, not our own record of them
// ---------------------------------------------------------------------------
async function takings() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { available: false, why: "Stripe isn't configured." };
  const mode = /^sk_live_/.test(key) ? "live" : "test";
  try {
    const stripe = new Stripe(key);
    const since = Math.floor(Date.now() / 1000) - 30 * DAY;
    // Paid sessions only — an abandoned checkout is not revenue.
    const res = await stripe.checkout.sessions.list({ limit: 100, created: { gte: since } });
    const paid = res.data.filter((s) => s.payment_status === "paid");

    const inWindow = (days) => {
      const cut = Math.floor(Date.now() / 1000) - days * DAY;
      return paid.filter((s) => s.created >= cut);
    };
    const sum = (list) => list.reduce((t, s) => t + (s.amount_total || 0), 0);

    const d1 = inWindow(1), d7 = inWindow(7), d30 = paid;
    return {
      available: true,
      mode,                                   // test takings are not real money
      today: { count: d1.length, gross: money(sum(d1)) },
      week: { count: d7.length, gross: money(sum(d7)) },
      month: { count: d30.length, gross: money(sum(d30)) },
      averageOrder: d30.length ? money(sum(d30) / d30.length) : 0,
      // What we keep is NOT gross. Print, shipping and Stripe's cut come out of it, and
      // the margin varies by destination — so give the honest band, not a fake total.
      estimatedProfit: {
        low: +(d30.length * PROFIT_RANGE.min).toFixed(2),
        typical: +(d30.length * PROFIT_RANGE.typical).toFixed(2),
        note: "Per-book profit varies with destination tax; this is a band, not a figure.",
      },
      abandoned: res.data.length - paid.length,
    };
  } catch (e) {
    return { available: false, why: "Couldn't read Stripe: " + (e && e.message ? e.message.slice(0, 90) : "unknown") };
  }
}

// ---------------------------------------------------------------------------
// Orders — our own record, plus what needs a human
// ---------------------------------------------------------------------------
async function orders() {
  const d = db();
  if (!d) return { available: false, why: "Database isn't configured." };
  try {
    const rows = await d.select("book_orders?select=id,email,trip_title,status,created_at,note&order=created_at.desc&limit=200");
    const inProd = rows.filter((r) => r.status === "in_production");
    const late = inProd.filter((r) => (daysSince(r.created_at) || 0) >= LATE_AFTER_DAYS);
    const dueSoon = inProd.filter((r) => {
      const a = daysSince(r.created_at) || 0;
      return a >= LATE_AFTER_DAYS - 4 && a < LATE_AFTER_DAYS;
    });
    return {
      available: true,
      total: rows.length,
      inProduction: inProd.length,
      shipped: rows.filter((r) => r.status === "shipped").length,
      late: late.length,
      dueSoon: dueSoon.length,
      recent: rows.slice(0, 8).map((r) => ({
        id: r.id,
        title: r.trip_title || "Trip Book",
        email: r.email,
        status: r.status,
        ageDays: daysSince(r.created_at),
        late: (daysSince(r.created_at) || 0) >= LATE_AFTER_DAYS && r.status === "in_production",
      })),
    };
  } catch (e) {
    return { available: false, why: "Couldn't read orders." };
  }
}

// ---------------------------------------------------------------------------
// Health — can we actually take an order end to end right now?
// ---------------------------------------------------------------------------
async function health() {
  const sk = process.env.STRIPE_SECRET_KEY || "";
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const skMode = !sk ? null : /^sk_live_/.test(sk) ? "live" : /^sk_test_/.test(sk) ? "test" : "odd";
  const pkMode = !pk ? null : /^pk_live_/.test(pk) ? "live" : /^pk_test_/.test(pk) ? "test" : "odd";

  let printer = { ok: false, detail: "not configured" };
  if (luluConfigured()) {
    try {
      const d = await luluDiag();
      printer = { ok: !!d.tokenOk, detail: d.tokenOk ? d.env : "credentials rejected (" + (d.tokenErr || "") + ")" };
    } catch { printer = { ok: false, detail: "unreachable" }; }
  }

  return [
    { key: "payments", label: "Taking payments", ok: !!skMode && skMode === pkMode,
      detail: !skMode ? "no secret key"
        : !pkMode ? "no publishable key — checkout falls back to Stripe's hosted page"
        : skMode !== pkMode ? `mismatched: secret is ${skMode}, browser key is ${pkMode}`
        : `${skMode} mode`,
      warn: skMode === "test" ? "Test mode — no real money moves." : null },
    { key: "printer", label: "Printer", ok: printer.ok, detail: printer.detail,
      warn: printer.detail === "sandbox" ? "Sandbox — jobs validate but never print." : null },
    { key: "storage", label: "Print file storage", ok: storageConfigured(),
      detail: storageConfigured() ? "configured" : "not configured — orders can't be sent to print" },
    { key: "database", label: "Order records", ok: !!db(),
      detail: db() ? "configured" : "not configured — orders won't be recorded" },
    { key: "email", label: "Customer email", ok: mailConfigured(),
      detail: mailConfigured() ? "configured" : "not configured — no confirmations or tracking notices" },
    { key: "tracking", label: "Tracking poller", ok: !!process.env.ORDER_CRON_SECRET,
      detail: process.env.ORDER_CRON_SECRET ? "configured" : "no ORDER_CRON_SECRET — shipping notices never send" },
  ];
}

export async function GET(request) {
  const gate = requireAdmin(request);
  if (gate) return gate;

  const [money_, orders_, health_] = await Promise.all([takings(), orders(), health()]);
  const blocking = health_.filter((h) => !h.ok);

  return Response.json({
    generatedAt: new Date().toISOString(),
    money: money_,
    orders: orders_,
    health: health_,
    // One honest headline: can this shop actually complete a sale right now?
    canSell: blocking.length === 0,
    blocking: blocking.map((h) => h.label),
  });
}
