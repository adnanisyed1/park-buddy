// Shared builder for the print-ready INTERIOR PDF (used by /api/interior-pdf and,
// at fulfillment time, by checkout). Lulu SKU 0850X0850.FC.PRE.CW.080CW444.MXX:
// uniform 630×630pt pages (8.5in trim + 0.125in bleed), 0.5in safe margin, sRGB.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PT = 72;
export const PAGE = 8.75 * PT;      // 630pt page incl. bleed
const SAFE = 0.625 * PT;            // bleed + 0.5in safe ≈ 45pt
export const MIN_PAGES = 24;        // casewrap hardcover minimum

const CREAM = rgb(0.965, 0.937, 0.89);
const INK = rgb(0.2, 0.16, 0.12);
const MUTED = rgb(0.54, 0.49, 0.42);
const GOLD = rgb(0.79, 0.64, 0.37);

function dataUrlToImg(u) {
  const m = /^data:(image\/\w+);base64,(.*)$/s.exec(u || "");
  if (!m) return null;
  try { return { mime: m[1], bytes: Uint8Array.from(Buffer.from(m[2], "base64")) }; } catch { return null; }
}
async function fetchImg(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "ParkBuddy/1.0 (trip book)" } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    return { mime: ct.includes("png") ? "image/png" : "image/jpeg", bytes: new Uint8Array(await r.arrayBuffer()) };
  } catch { return null; }
}
// Resolve an entry's image: the user's own capture first, else the park photo.
export async function resolveEntryImage(entry, origin) {
  if (entry.userImg && entry.userImg.startsWith("data:")) { const d = dataUrlToImg(entry.userImg); if (d) return d; }
  if (entry.userImg && /^https?:/.test(entry.userImg)) { const b = await fetchImg(entry.userImg); if (b) return b; }
  const q = Array.isArray(entry.q) ? entry.q.join("|") : (entry.place || "");
  if (!q) return null;
  try {
    const r = await fetch(origin + "/api/photo?q=" + encodeURIComponent(q) + "&w=1600&v=6");
    if (!r.ok) return null;
    const d = await r.json();
    const src = d && (d.image || d.thumb);
    return src ? await fetchImg(src) : null;
  } catch { return null; }
}
export async function embedImg(pdf, img) {
  if (!img) return null;
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

export async function buildInteriorPdf({ title, dates, dedication, entries, origin }) {
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifIt = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  const blank = () => { const p = pdf.addPage([PAGE, PAGE]); p.drawRectangle({ x: 0, y: 0, width: PAGE, height: PAGE, color: CREAM }); return p; };
  const center = (p, font, text, size, y, color) => {
    const w = font.widthOfTextAtSize(text, size);
    p.drawText(text, { x: (PAGE - w) / 2, y, size, font, color });
  };

  // title page
  {
    const p = blank();
    center(p, sans, "A PARK BUDDY TRIP BOOK", 9, PAGE - SAFE - 20, GOLD);
    const lines = wrap(serif, String(title || "Trip Book"), 34, PAGE - SAFE * 2);
    let y = PAGE / 2 + (lines.length - 1) * 20 + 30;
    lines.forEach((ln) => { center(p, serif, ln, 34, y, INK); y -= 40; });
    if (dates) center(p, sans, String(dates).toUpperCase(), 10, y - 6, MUTED);
    if (dedication) {
      const dl = wrap(serifIt, "“" + dedication + "”", 15, PAGE - SAFE * 2.4);
      let dy = SAFE + dl.length * 20;
      dl.forEach((ln) => { center(p, serifIt, ln, 15, dy, MUTED); dy -= 20; });
    }
  }

  // per stop: full-bleed photo + optional story page
  for (const e of entries) {
    const photo = blank();
    const emb = await embedImg(pdf, await resolveEntryImage(e, origin));
    if (emb) {
      const s = Math.max(PAGE / emb.width, PAGE / emb.height);
      const w = emb.width * s, h = emb.height * s;
      photo.drawImage(emb, { x: (PAGE - w) / 2, y: (PAGE - h) / 2, width: w, height: h });
      photo.drawRectangle({ x: 0, y: 0, width: PAGE, height: 54, color: rgb(0.04, 0.05, 0.05), opacity: 0.62 });
      photo.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: 22, size: 10, font: sans, color: rgb(1, 1, 1) });
    } else {
      center(photo, serif, String(e.place || ""), 22, PAGE / 2, INK);
    }
    if (e.cap && String(e.cap).trim()) {
      const p = blank();
      p.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: PAGE - SAFE - 10, size: 9, font: sans, color: GOLD });
      const lines = wrap(serifIt, String(e.cap).trim(), 16, PAGE - SAFE * 2);
      let y = PAGE / 2 + (lines.length * 22) / 2;
      lines.forEach((ln) => { p.drawText(ln, { x: SAFE, y, size: 16, font: serifIt, color: INK }); y -= 22; });
    }
  }

  // closing
  {
    const p = blank();
    center(p, serif, "The end — for now", 20, PAGE / 2 + 10, INK);
    center(p, sans, "A PARK BUDDY KEEPSAKE", 9, PAGE / 2 - 20, GOLD);
  }

  while (pdf.getPageCount() < MIN_PAGES || pdf.getPageCount() % 2 !== 0) blank();

  const bytes = await pdf.save();
  return { bytes, pageCount: pdf.getPageCount() };
}
