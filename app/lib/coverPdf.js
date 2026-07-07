// Wraparound COVER PDF builder. Size (width/height incl. bleed + spine) MUST come
// from Lulu's /cover-dimensions API for the exact SKU + page count — never hardcode.
// Layout is a first-pass proof: full-bleed cover photo + scrim, title on the front
// panel, spine title, colophon on the back. Refine panel geometry against Lulu's
// downloadable cover template after the first sandbox proof.
import { PDFDocument, rgb, degrees } from "pdf-lib";
import { embedFonts } from "./pdfFonts";

export async function buildCoverPdf({ title, dates, edition, coverImage, dims, origin }) {
  const W = Number(dims.width), H = Number(dims.height);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const { serif, sans } = await embedFonts(pdf, origin);

  // background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.055, 0.055, 0.047) });

  // full-bleed cover photo (cover-fit across the whole wraparound)
  if (coverImage) {
    let emb = null;
    try { emb = coverImage.mime === "image/png" ? await pdf.embedPng(coverImage.bytes) : await pdf.embedJpg(coverImage.bytes); }
    catch { try { emb = await pdf.embedPng(coverImage.bytes); } catch { emb = null; } }
    if (emb) {
      const s = Math.max(W / emb.width, H / emb.height);
      const w = emb.width * s, h = emb.height * s;
      page.drawImage(emb, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
    }
  }
  // legibility scrim
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0, 0, 0), opacity: 0.4 });

  const PT = 72;
  // Front panel ≈ right ~42% (approximate until we use Lulu's template geometry).
  const frontX = W * 0.58;
  const frontW = W * 0.42;
  const cx = frontX + frontW / 2;
  const centerFront = (font, text, size, y, color) => {
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - tw / 2, y, size, font, color });
  };
  // title (wrap within the front panel)
  const maxW = frontW - 0.5 * PT;
  const words = String(title || "Trip Book").split(/\s+/);
  const lines = []; let line = "";
  for (const wd of words) { const t = line ? line + " " + wd : wd; if (serif.widthOfTextAtSize(t, 26) > maxW && line) { lines.push(line); line = wd; } else line = t; }
  if (line) lines.push(line);
  let y = H / 2 + lines.length * 15;
  centerFront(sans, "A PARK BUDDY TRIP BOOK", 8, y + 26, rgb(0.85, 0.78, 0.6));
  lines.forEach((ln) => { centerFront(serif, ln, 26, y, rgb(1, 1, 1)); y -= 30; });
  if (dates) centerFront(sans, String(dates).toUpperCase(), 8, y - 4, rgb(0.85, 0.82, 0.75));
  if (edition) centerFront(sans, String(edition).toUpperCase(), 7, 0.6 * PT, rgb(0.8, 0.72, 0.5));

  // spine title (vertical, centered)
  const spineTxt = String(title || "").slice(0, 40);
  page.drawText(spineTxt, { x: W / 2 + 4, y: H / 2 - serif.widthOfTextAtSize(spineTxt, 10) / 2, size: 10, font: serif, color: rgb(0.9, 0.85, 0.7), rotate: degrees(90) });

  // back colophon
  page.drawText("A Park Buddy keepsake — printed on demand.", { x: 0.6 * PT, y: 0.6 * PT, size: 8, font: sans, color: rgb(0.8, 0.78, 0.72) });

  return await pdf.save();
}
