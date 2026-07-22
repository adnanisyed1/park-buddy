// GET /api/tour?code=450284P1 — everything Basic access knows about ONE tour:
// full product content (description, gallery, inclusions, itinerary, meeting
// point, cancellation policy) + the availability SCHEDULE (which days it
// runs, departure times, from-price). This powers the on-site listing page
// (/tours/[code]); checkout stays on viator.com per Basic-access terms — the
// productUrl already carries our affiliate attribution.
//
// Basic access ≠ real-time availability: the schedule endpoint returns the
// RECURRING pattern (seasons, days-of-week, start times), which is honest to
// display as "runs most days at 8:00 AM", never as "available on YOUR date"
// — that phrasing waits for Full access.
import { viatorHeaders, viatorConfigured } from "../../lib/viator";

export const runtime = "nodejs";

const BASE = "https://api.viator.com/partner";
const CACHE = new Map(); // code -> { at, body }
const TTL = 6 * 3600 * 1000;

const DAY_LABELS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function summarizeSchedule(sch) {
  if (!sch || !Array.isArray(sch.bookableItems)) return null;
  const days = new Set();
  const times = new Set();
  let from = null;
  for (const item of sch.bookableItems) {
    for (const season of item.seasons || []) {
      for (const rec of season.pricingRecords || []) {
        (rec.daysOfWeek || []).forEach((d) => days.add(d));
        for (const te of rec.timedEntries || []) if (te.startTime) times.add(te.startTime);
        for (const pr of (rec.pricingDetails || [])) {
          const p = pr && pr.price && (pr.price.original ? pr.price.original.recommendedRetailPrice : null);
          if (isFinite(p) && (from == null || p < from)) from = p;
        }
      }
    }
  }
  const daysArr = DAY_LABELS.filter((d) => days.has(d));
  return {
    daily: daysArr.length === 7,
    days: daysArr.map((d) => d.slice(0, 3)),
    startTimes: [...times].sort().slice(0, 6),
    fromPrice: from,
    currency: sch.currency || "USD",
  };
}

export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(code)) return Response.json({ error: "bad code" }, { status: 400 });
  if (!viatorConfigured()) return Response.json({ configured: false }, { status: 200 });

  const hit = CACHE.get(code);
  if (hit && Date.now() - hit.at < TTL) return Response.json(hit.body);

  try {
    const [pRes, sRes] = await Promise.all([
      fetch(`${BASE}/products/${encodeURIComponent(code)}`, { headers: viatorHeaders(), cache: "no-store" }),
      fetch(`${BASE}/availability/schedules/${encodeURIComponent(code)}`, { headers: viatorHeaders(), cache: "no-store" }),
    ]);
    if (!pRes.ok) {
      const body = (await pRes.text().catch(() => "")).slice(0, 200);
      return Response.json({ error: "viator " + pRes.status, detail: body }, { status: 502 });
    }
    const p = await pRes.json();
    const sch = sRes.ok ? await sRes.json().catch(() => null) : null;

    const images = (p.images || [])
      .map((img) => {
        const v = (img.variants || []).slice().sort((a, b) => Math.abs((a.width || 0) - 900) - Math.abs((b.width || 0) - 900))[0];
        return v && v.url;
      })
      .filter(Boolean)
      .slice(0, 10);

    const body = {
      code,
      title: p.title || "",
      description: p.description || "",
      images,
      rating: p.reviews && p.reviews.combinedAverageRating ? Math.round(p.reviews.combinedAverageRating * 10) / 10 : null,
      reviews: p.reviews ? p.reviews.totalReviews : null,
      durationHours: p.itinerary && p.itinerary.duration && p.itinerary.duration.fixedDurationInMinutes
        ? Math.round((p.itinerary.duration.fixedDurationInMinutes / 60) * 10) / 10 : null,
      inclusions: (p.inclusions || []).map((i) => i.otherDescription || i.typeDescription || i.description).filter(Boolean).slice(0, 12),
      exclusions: (p.exclusions || []).map((i) => i.otherDescription || i.typeDescription || i.description).filter(Boolean).slice(0, 8),
      stops: p.itinerary && Array.isArray(p.itinerary.itineraryItems)
        ? p.itinerary.itineraryItems.map((it) => (it.pointOfInterestLocation && it.description) || it.description).filter(Boolean).slice(0, 10)
        : [],
      meetingPoint: p.logistics && p.logistics.start && p.logistics.start[0] && p.logistics.start[0].description || null,
      freeCancellation: !!(p.cancellationPolicy && p.cancellationPolicy.type === "STANDARD"),
      cancellationNote: p.cancellationPolicy && p.cancellationPolicy.description || null,
      productUrl: p.productUrl || null, // carries our affiliate attribution
      schedule: summarizeSchedule(sch),
    };
    CACHE.set(code, { at: Date.now(), body });
    return Response.json(body);
  } catch (e) {
    return Response.json({ error: "upstream", detail: String(e && e.message || e).slice(0, 200) }, { status: 502 });
  }
}
