// POST /api/interior-pdf — generate the print-ready interior PDF from trip content
// and return the bytes (used by the Step 3 "Print-ready PDF" preview button, and
// the same builder is reused at fulfillment). Layout/spec live in lib/interiorPdf.
import { buildInteriorPdf } from "../../lib/interiorPdf";
import { trimInches } from "../../lib/bookPricing";
import { enforce } from "../../lib/ratelimit";

export const runtime = "nodejs";

export async function POST(request) {
  // Expensive path (full print-PDF build + image fetches) with no auth —
  // rate-limit it so it can't be used as a compute hose (audit 2026-07-22).
  const limited = await enforce(request, "interior-pdf", { limit: 6, windowMs: 60_000 });
  if (limited) return limited;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 60) : [];
  if (!entries.length) return Response.json({ error: "No trip content to print." }, { status: 400 });
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  // Preview the customer's ACTUAL trim and binding — this button is meant to show what
  // will be printed, and it previously rendered square no matter what they picked.
  const cfg = body.config || {};
  const trim = trimInches(String(cfg.size || "")) || { w: 8.5, h: 8.5 };

  let bytes;
  try {
    ({ bytes } = await buildInteriorPdf({
      title: body.title, dates: body.dates, dedication: body.dedication, entries, origin,
      trimW: trim.w, trimH: trim.h, cover: String(cfg.cover || ""), minPages: parseInt(cfg.pages, 10) || 0,
      palette: String(cfg.palette || ""), bw: cfg.ink === "bwpre" || cfg.ink === "bwstd",
    marginIn: Number(body.marginIn) || 0,
    }));
  } catch (e) {
    // Preflight failures carry the specific reasons — say them out loud rather than
    // returning a bare 500, so a broken build is diagnosable from the response.
    const problems = (e && e.details && e.details.problems) || null;
    return Response.json({
      error: problems ? "This book didn't pass print preflight." : "Couldn't build the print PDF.",
      problems, detail: !problems && e && e.message ? e.message : undefined,
    }, { status: 500 });
  }
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="trip-book-interior.pdf"' },
  });
}
