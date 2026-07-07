// POST /api/interior-pdf — generate the print-ready INTERIOR PDF for a Trip Book,
// built to Lulu's spec for the square color hardcover SKU 0850X0850.FC.PRE.CW.080CW444.MXX:
//   • uniform page size = 8.75in × 8.75in = 630 × 630 pt (8.5in trim + 0.125in bleed/edge)
//   • 0.5in safe margin, sRGB, standard PDF (fonts embedded via base-14 for now)
// Returns the PDF bytes. Server-side so it can fetch park photos without CORS and
// produce the artifact Lulu fetches at fulfillment time.
//
// Phase-1 scope + known follow-ups: base-14 fonts (embed Cormorant/Inter TTFs before
// real Lulu submission), captured photos are ~1000px (below 300dpi at full bleed —
// pairs with the photos→object-storage + higher-res-capture work), cover is generated
// separately (needs Lulu's cover-dimensions API + auth).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

const PT = 72;
const PAGE = 8.75 * PT;            // 630pt — full page incl. bleed
const SAFE = 0.625 * PT;          // 0.125 bleed + 0.5 safe ≈ 45pt content inset
const MIN_PAGES = 24;             // casewrap hardcover minimum (pad with endpapers)

const CREAM = rgb(0.965, 0.937, 0.89);
const INK = rgb(0.2, 0.16, 0.12);
const MUTED = rgb(0.54, 0.49, 0.42);
const GOLD = rgb(0.79, 0.64, 0.37);

function err(msg, status = 400) { return Response.json({ error: msg }, { status }); }

function dataUrlToBytes(u) {
  const m = /^data:(image\/\w+);base64,(.*)$/s.exec(u || "");
  if (!m) return null;
  try { return { mime: m[1], bytes: Uint8Array.from(Buffer.from(m[2], "base64")) }; } catch { return null; }
}
async function fetchBytes(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "ParkBuddy/1.0 (trip book)" } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    const ab = await r.arrayBuffer();
    return { mime: ct.includes("png") ? "image/png" : "image/jpeg", bytes: new Uint8Array(ab) };
  } catch { return null; }
}
// Resolve an entry's image: user's own photo first, else the park photo via /api/photo.
async function resolveImage(entry, origin) {
  if (entry.userImg && entry.userImg.startsWith("data:")) { const d = dataUrlToBytes(entry.userImg); if (d) return d; }
  if (entry.userImg && /^https?:/.test(entry.userImg)) { const b = await fetchBytes(entry.userImg); if (b) return b; }
  const q = Array.isArray(entry.q) ? entry.q.join("|") : (entry.place || "");
  if (!q) return null;
  try {
    const r = await fetch(origin + "/api/photo?q=" + encodeURIComponent(q) + "&w=1600&v=6");
    if (!r.ok) return null;
    const d = await r.json();
    const src = d && (d.image || d.thumb);
    return src ? await fetchBytes(src) : null;
  } catch { return null; }
}
async function embed(pdf, img) {
  try { return img.mime === "image/png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes); }
  catch { try { return await pdf.embedPng(img.bytes); } catch { return null; } }
}
function wrap(font, text, size, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = []; let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return err("Bad request."); }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 60) : [];
  if (!entries.length) return err("No trip content to print.");
  const title = String(body.title || "Trip Book").slice(0, 140);
  const dates = String(body.dates || "").slice(0, 60);
  const dedication = String(body.dedication || "").slice(0, 200);
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifIt = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  const blank = () => { const p = pdf.addPage([PAGE, PAGE]); p.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: CREAM }); return p; };
  const center = (p, font, text, size, y, color) => {
    const w = font.widthOfTextAtSize(text, size);
    p.drawText(text, { x: (PAGE - w) / 2, y, size, font, color });
  };

  // ---- title page ----
  {
    const p = blank();
    center(p, sans, "A PARK BUDDY TRIP BOOK", 9, PAGE - SAFE - 20, GOLD);
    const lines = wrap(serif, title, 34, PAGE - SAFE * 2);
    let y = PAGE / 2 + (lines.length - 1) * 20 + 30;
    lines.forEach((ln) => { center(p, serif, ln, 34, y, INK); y -= 40; });
    if (dates) center(p, sans, dates.toUpperCase(), 10, y - 6, MUTED);
    if (dedication) {
      const dl = wrap(serifIt, "“" + dedication + "”", 15, PAGE - SAFE * 2.4);
      let dy = SAFE + dl.length * 20;
      dl.forEach((ln) => { center(p, serifIt, ln, 15, dy, MUTED); dy -= 20; });
    }
  }

  // ---- per stop: full-bleed photo + (optional) story page ----
  for (const e of entries) {
    const photo = blank();
    const img = await resolveImage(e, origin);
    const emb = img ? await embed(pdf, img) : null;
    if (emb) {
      const iw = emb.width, ih = emb.height;
      const s = Math.max(PAGE / iw, PAGE / ih);
      const w = iw * s, h = ih * s;
      photo.drawImage(emb, { x: (PAGE - w) / 2, y: (PAGE - h) / 2, width: w, height: h });
      // caption bar
      photo.drawRectangle({ x: 0, y: 0, width: PAGE, height: 54, color: rgb(0.04, 0.05, 0.05), opacity: 0.62 });
      photo.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: 22, size: 10, font: sans, color: rgb(1, 1, 1) });
    } else {
      // graceful fallback: cream page with the place name
      center(photo, serif, e.place || "", 22, PAGE / 2, INK);
    }
    if (e.cap && String(e.cap).trim()) {
      const p = blank();
      p.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: PAGE - SAFE - 10, size: 9, font: sans, color: GOLD });
      const lines = wrap(serifIt, String(e.cap).trim(), 16, PAGE - SAFE * 2);
      let y = PAGE / 2 + (lines.length * 22) / 2;
      lines.forEach((ln) => { p.drawText(ln, { x: SAFE, y, size: 16, font: serifIt, color: INK }); y -= 22; });
    }
  }

  // ---- closing ----
  {
    const p = blank();
    center(p, serif, "The end — for now", 20, PAGE / 2 + 10, INK);
    center(p, sans, "A PARK BUDDY KEEPSAKE", 9, PAGE / 2 - 20, GOLD);
  }

  // pad to the SKU minimum with blank endpapers (even count)
  while (pdf.getPageCount() < MIN_PAGES || pdf.getPageCount() % 2 !== 0) blank();

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="trip-book-interior.pdf"',
    },
  });
}
