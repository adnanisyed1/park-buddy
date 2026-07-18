// Shared builder for the print-ready INTERIOR PDF (used by /api/interior-pdf and,
// at fulfillment time, by checkout). Pages are the customer's REAL trim plus 0.125in
// bleed per edge, 0.5in safe margin, sRGB.
//
// This used to hardcode square pages from a single `trimIn`, which meant a customer who
// chose US Letter Landscape (11 × 8.5") got a square book. Trim is now width × height.
import { PDFDocument, rgb } from "pdf-lib";
import { embedFonts } from "./pdfFonts";
import { BIND_PAGES } from "./bookPricing";
import { paletteByKey, hexToRgb01, toGray01 } from "./bookThemes";

const PT = 72;
const SAFE = 0.625 * PT;            // bleed + 0.5in safe ≈ 45pt
export const MIN_PAGES = 24;        // casewrap hardcover minimum (default when unknown)

// Colours come from the customer's chosen palette, not from constants. The book they
// designed on screen and the book that arrives should be the same object.
function paletteColors(palKey, bw) {
  const pal = paletteByKey(palKey);
  const conv = bw ? toGray01 : hexToRgb01;   // B&W interiors print grey, as previewed
  const paper = rgb(...conv(pal.base));
  const ink = rgb(...conv(pal.ink));
  const accent = rgb(...conv(pal.accent));
  // Muted = ink softened toward the paper, so it stays legible on any palette rather
  // than being a fixed grey that vanishes on dark stock.
  const [ir, ig, ib] = conv(pal.ink);
  const [pr, pg, pb] = conv(pal.base);
  const mix = (a, b) => a + (b - a) * 0.42;
  const muted = rgb(mix(ir, pr), mix(ig, pg), mix(ib, pb));
  return { pal, paper, ink, accent, muted };
}

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
// Resolve an entry's image — the TRAVELER'S OWN photo ONLY.
// We deliberately do NOT fall back to a stock/Wikimedia park photo here: this builder
// produces the PRINTED, SOLD book, and third-party (CC BY-SA etc.) imagery can't be
// embedded in a commercial, resold product without per-image license compliance +
// visible attribution. Stops without a personal photo get a designed typographic page
// instead (see buildInteriorPdf). The on-screen studio PREVIEW may still show stock
// park photos — that's ephemeral on-screen context, not the artifact we sell/ship.
export async function resolveEntryImage(entry) {
  if (entry.userImg && entry.userImg.startsWith("data:")) { const d = dataUrlToImg(entry.userImg); if (d) return d; }
  if (entry.userImg && /^https?:/.test(entry.userImg)) { const b = await fetchImg(entry.userImg); if (b) return b; }
  return null;
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

export async function buildInteriorPdf({
  title, dates, dedication, entries, origin,
  trimW, trimH, trimIn, cover, minPages,
  palette, bw,
}) {
  const { paper: CREAM, ink: INK, accent: GOLD, muted: MUTED } = paletteColors(palette, bw);
  // trimIn is the legacy square form, still accepted so /api/interior-pdf and the older
  // sandbox probes keep working; trimW/trimH is the real one.
  const inW = trimW || trimIn || 8.5;
  const inH = trimH || trimIn || 8.5;
  const W = (inW + 0.25) * PT;        // trim + 0.125in bleed per edge
  const H = (inH + 0.25) * PT;

  // Page floor comes from the binding the customer chose — padding a 4-page saddle-stitch
  // book out to 24 pages would both cost them more and be rejected by Lulu (max 48).
  const range = BIND_PAGES[cover] || null;
  const floor = Math.max(range ? range.min : MIN_PAGES, Math.min(minPages || 0, range ? range.max : 800));
  const ceiling = range ? range.max : 800;

  const pdf = await PDFDocument.create();
  const { serif, serifIt, sans } = await embedFonts(pdf, origin);

  const blank = () => { const p = pdf.addPage([W, H]); p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM }); return p; };
  const center = (p, font, text, size, y, color) => {
    const w = font.widthOfTextAtSize(text, size);
    p.drawText(text, { x: (W - w) / 2, y, size, font, color });
  };

  // title page
  {
    const p = blank();
    center(p, sans, "A PARK BUDDY TRIP BOOK", 9, H - SAFE - 20, GOLD);
    const lines = wrap(serif, String(title || "Trip Book"), 34, W - SAFE * 2);
    let y = H / 2 + (lines.length - 1) * 20 + 30;
    lines.forEach((ln) => { center(p, serif, ln, 34, y, INK); y -= 40; });
    if (dates) center(p, sans, String(dates).toUpperCase(), 10, y - 6, MUTED);
    if (dedication) {
      const dl = wrap(serifIt, "“" + dedication + "”", 15, W - SAFE * 2.4);
      let dy = SAFE + dl.length * 20;
      dl.forEach((ln) => { center(p, serifIt, ln, 15, dy, MUTED); dy -= 20; });
    }
  }

  // per stop: full-bleed photo (traveler's own) + optional story page. A stop with no
  // personal photo gets a designed typographic page — never a third-party stock photo.
  for (const e of entries) {
    const photo = blank();
    const emb = await embedImg(pdf, await resolveEntryImage(e));
    if (emb) {
      const s = Math.max(W / emb.width, H / emb.height);
      const w = emb.width * s, h = emb.height * s;
      photo.drawImage(emb, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
      // Caption bar in the palette's own ink, with the place name in its paper colour —
      // so the band reads as part of the book's design rather than a generic black bar.
      photo.drawRectangle({ x: 0, y: 0, width: W, height: 54, color: INK, opacity: 0.72 });
      photo.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: 22, size: 10, font: sans, color: CREAM });
    } else {
      // Designed "no photo" chapter page: type eyebrow · place · gold rule · time.
      if (e.type) center(photo, sans, String(e.type).toUpperCase(), 9, H / 2 + 58, GOLD);
      const nm = wrap(serif, String(e.place || "A stop along the way"), 26, W - SAFE * 2);
      let y = H / 2 + (nm.length - 1) * 16 + 6;
      nm.forEach((ln) => { center(photo, serif, ln, 26, y, INK); y -= 32; });
      photo.drawRectangle({ x: W / 2 - 24, y: y + 4, width: 48, height: 1.4, color: GOLD });
      if (e.time) center(photo, sans, String(e.time).toUpperCase(), 8.5, y - 14, MUTED);
    }
    if (e.cap && String(e.cap).trim()) {
      const p = blank();
      p.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: H - SAFE - 10, size: 9, font: sans, color: GOLD });
      const lines = wrap(serifIt, String(e.cap).trim(), 16, W - SAFE * 2);
      let y = H / 2 + (lines.length * 22) / 2;
      lines.forEach((ln) => { p.drawText(ln, { x: SAFE, y, size: 16, font: serifIt, color: INK }); y -= 22; });
    }
  }

  // closing
  {
    const p = blank();
    center(p, serif, "The end — for now", 20, H / 2 + 10, INK);
    center(p, sans, "A PARK BUDDY KEEPSAKE", 9, H / 2 - 20, GOLD);
  }

  // Pad to the binding's floor and to an even count (sheets are printed two-up), but
  // never past what the binding can hold.
  while ((pdf.getPageCount() < floor || pdf.getPageCount() % 2 !== 0) && pdf.getPageCount() < ceiling) blank();

  const bytes = await pdf.save();
  return { bytes, pageCount: pdf.getPageCount() };
}
