// POST /api/interior-pdf — generate the print-ready interior PDF from trip content
// and return the bytes (used by the Step 3 "Print-ready PDF" preview button, and
// the same builder is reused at fulfillment). Layout/spec live in lib/interiorPdf.
import { buildInteriorPdf } from "../../lib/interiorPdf";
import { trimInches } from "../../lib/bookPricing";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 60) : [];
  if (!entries.length) return Response.json({ error: "No trip content to print." }, { status: 400 });
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  // Preview the customer's ACTUAL trim and binding — this button is meant to show what
  // will be printed, and it previously rendered square no matter what they picked.
  const cfg = body.config || {};
  const trim = trimInches(String(cfg.size || "")) || { w: 8.5, h: 8.5 };

  const { bytes } = await buildInteriorPdf({
    title: body.title, dates: body.dates, dedication: body.dedication, entries, origin,
    trimW: trim.w, trimH: trim.h, cover: String(cfg.cover || ""), minPages: parseInt(cfg.pages, 10) || 0,
  });
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="trip-book-interior.pdf"' },
  });
}
