// Park Buddy — LIVE campsite availability for a Recreation.gov campground.
// GET /api/availability?id=232463&month=2026-07  → compact per-day open counts.
//
// There is NO official booking API (RIDB is read-only), and recreation.gov
// can't be iframed (X-Frame-Options: SAMEORIGIN + a CSP frame-ancestors
// allowlist that excludes us). What we CAN do — and what recreation.gov's own
// "use our data" page encourages ("add links on your pages to our website") —
// is show real availability and deep-link/pop the booking page. This route
// reads the same month endpoint recreation.gov's own site uses and aggregates
// the ~500 KB response down to a tiny per-day {open,total} summary so the
// client payload stays small. Undocumented endpoint → cache + degrade to null.
// Credit: Data Source: Recreation.gov.

export const runtime = "nodejs";
export const revalidate = 1800; // availability moves, but not second-by-second

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16 Safari/605.1.15";

function monthStartISO(month) {
  // month = "YYYY-MM"; recreation.gov wants the 1st at 00:00:00.000Z UTC.
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  const now = new Date();
  const y = m ? +m[1] : now.getUTCFullYear();
  const mo = m ? +m[2] : now.getUTCMonth() + 1;
  if (mo < 1 || mo > 12) return null;
  return { iso: y + "-" + String(mo).padStart(2, "0") + "-01T00:00:00.000Z", y, mo };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").replace(/[^0-9]/g, "");
  const ms = monthStartISO(searchParams.get("month"));
  if (!id || !ms) return Response.json({ error: "id and month=YYYY-MM required" }, { status: 400 });

  try {
    const url = "https://www.recreation.gov/api/camps/availability/campground/" + id + "/month?start_date=" + encodeURIComponent(ms.iso);
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(12000),
    });
    // Upstream failure ≠ "no availability" — 503 so Next doesn't cache an empty result.
    if (!r.ok) return Response.json({ available: false, degraded: true }, { status: 503 });
    const d = await r.json();
    const sites = d.campsites || {};
    const siteIds = Object.keys(sites);
    const total = siteIds.length;
    if (!total) return Response.json({ available: true, total: 0, days: [], bookable: 0 });

    // Aggregate: per calendar day, how many sites are "Available".
    const byDate = {};
    for (const sid of siteIds) {
      const av = sites[sid].availabilities || {};
      for (const ts in av) {
        const day = ts.slice(0, 10); // YYYY-MM-DD
        if (!byDate[day]) byDate[day] = 0;
        if (av[ts] === "Available") byDate[day] += 1;
      }
    }
    const days = Object.keys(byDate).sort().map((date) => ({ date, open: byDate[date] }));
    const openDays = days.filter((x) => x.open > 0);
    const soonest = openDays[0] || null;
    const peak = days.reduce((mx, x) => Math.max(mx, x.open), 0);

    return Response.json({
      available: true,
      id, month: ms.y + "-" + String(ms.mo).padStart(2, "0"),
      total, // total campsites at this campground
      days,  // [{date, open}] for the month
      openDayCount: openDays.length,
      soonest, // {date, open} of the nearest day with any opening, or null
      peakOpen: peak,
      credit: "Availability: Recreation.gov (live).",
    });
  } catch {
    return Response.json({ available: false, degraded: true }, { status: 503 });
  }
}
