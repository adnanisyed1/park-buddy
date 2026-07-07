// POST /api/interior-pdf — generate the print-ready interior PDF from trip content
// and return the bytes (used by the Step 3 "Print-ready PDF" preview button, and
// the same builder is reused at fulfillment). Layout/spec live in lib/interiorPdf.
import { buildInteriorPdf } from "../../lib/interiorPdf";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 60) : [];
  if (!entries.length) return Response.json({ error: "No trip content to print." }, { status: 400 });
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  const { bytes } = await buildInteriorPdf({
    title: body.title, dates: body.dates, dedication: body.dedication, entries, origin,
  });
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="trip-book-interior.pdf"' },
  });
}
