// Wraparound COVER PDF builder. Size (width/height incl. bleed + spine) MUST come from
// Lulu's /cover-dimensions API for the exact SKU + page count — never hardcode.
//
// The cover is rendered in the customer's chosen palette and cover layout, matching what
// CoverPreview shows in the studio. It used to render one fixed dark design with a black
// scrim over any photo, which meant someone could design a Parchment Royal book on cream
// and be shipped a near-black one — confirmed by Lulu's own cover thumbnail.
import { PDFDocument, rgb, degrees } from "pdf-lib";
import { embedFonts } from "./pdfFonts";
import { paletteByKey, hexToRgb01, toGray01, isLightPalette } from "./bookThemes";

export async function buildCoverPdf({ title, dates, edition, coverImage, dims, origin, palette, layout, bw }) {
  const W = Number(dims.width), H = Number(dims.height);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const { serif, sans } = await embedFonts(pdf, origin);

  const pal = paletteByKey(palette);
  const conv = bw ? toGray01 : hexToRgb01;
  const paper = rgb(...conv(pal.base));
  const ink = rgb(...conv(pal.ink));
  const accent = rgb(...conv(pal.accent));
  const light = isLightPalette(pal);
  const style = layout || pal.silhouette || "manuscript";

  // Ground is the palette's paper, so a light edition is genuinely a light book.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });

  const PT = 72;
  // Front panel ≈ the right ~42% of the wraparound (back | spine | front).
  const frontX = W * 0.58, frontW = W * 0.42;
  const cx = frontX + frontW / 2;

  // "full" runs the photo across the whole wraparound; every other layout keeps the
  // photograph on the front panel so the palette's paper stays visible and the book
  // reads as designed rather than as a photo with text on it.
  const fullBleed = style === "full";
  let hasPhoto = false;
  if (coverImage) {
    let emb = null;
    try { emb = coverImage.mime === "image/png" ? await pdf.embedPng(coverImage.bytes) : await pdf.embedJpg(coverImage.bytes); }
    catch { try { emb = await pdf.embedPng(coverImage.bytes); } catch { emb = null; } }
    if (emb) {
      hasPhoto = true;
      const box = fullBleed
        ? { x: 0, y: 0, w: W, h: H }
        // A window on the front panel, inset from the trim and sitting above the title.
        : { x: frontX + 0.35 * PT, y: H * 0.42, w: frontW - 0.7 * PT, h: H * 0.46 };
      const s = Math.max(box.w / emb.width, box.h / emb.height);
      const w = emb.width * s, h = emb.height * s;
      // Clip by drawing the image then masking the overflow with the paper colour.
      page.drawImage(emb, { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, width: w, height: h });
      if (!fullBleed) {
        page.drawRectangle({ x: 0, y: 0, width: W, height: box.y, color: paper });
        page.drawRectangle({ x: 0, y: box.y + box.h, width: W, height: H - (box.y + box.h), color: paper });
        page.drawRectangle({ x: 0, y: box.y, width: box.x, height: box.h, color: paper });
        page.drawRectangle({ x: box.x + box.w, y: box.y, width: W - (box.x + box.w), height: box.h, color: paper });
      }
    }
  }

  // Only a full-bleed photo needs a scrim, and it's tinted toward the palette's ink
  // rather than pure black so the cover keeps its character.
  if (hasPhoto && fullBleed) {
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: ink, opacity: light ? 0.32 : 0.5 });
  }

  // Type sits on the photo only when the photo is full-bleed; otherwise it sits on paper.
  const onPhoto = hasPhoto && fullBleed;
  const titleColor = onPhoto ? (light ? paper : paper) : ink;
  const metaColor = onPhoto ? paper : accent;

  const centerFront = (font, text, size, y, color) => {
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - tw / 2, y, size, font, color });
  };

  const maxW = frontW - 0.5 * PT;
  const words = String(title || "Trip Book").split(/\s+/);
  const lines = []; let line = "";
  for (const wd of words) {
    const t = line ? line + " " + wd : wd;
    if (serif.widthOfTextAtSize(t, 26) > maxW && line) { lines.push(line); line = wd; } else line = t;
  }
  if (line) lines.push(line);

  // With a windowed photo the title sits below it; full-bleed keeps it centred.
  let y = hasPhoto && !fullBleed ? H * 0.30 + lines.length * 15 : H / 2 + lines.length * 15;

  centerFront(sans, "A PARK BUDDY TRIP BOOK", 8, y + 26, metaColor);
  lines.forEach((ln) => { centerFront(serif, ln, 26, y, titleColor); y -= 30; });

  // The accent rule — the same gesture the studio draws under a cover title.
  page.drawRectangle({ x: cx - 24, y: y + 6, width: 48, height: 1.4, color: accent });

  if (dates) centerFront(sans, String(dates).toUpperCase(), 8, y - 12, metaColor);
  if (edition) centerFront(sans, String(edition).toUpperCase(), 7, 0.6 * PT, accent);

  // Spine title, in ink on paper (or paper on a full-bleed photo).
  const spineTxt = String(title || "").slice(0, 40);
  page.drawText(spineTxt, {
    x: W / 2 + 4, y: H / 2 - serif.widthOfTextAtSize(spineTxt, 10) / 2,
    size: 10, font: serif, color: onPhoto ? paper : ink, rotate: degrees(90),
  });

  // Back colophon.
  page.drawText("A Park Buddy keepsake — printed on demand.", {
    x: 0.6 * PT, y: 0.6 * PT, size: 8, font: sans, color: onPhoto ? paper : ink, opacity: 0.75,
  });

  return await pdf.save();
}
