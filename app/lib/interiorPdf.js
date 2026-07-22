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
import { preflightInterior } from "./printPreflight";

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
// SSRF guard (security audit 2026-07-22): these URLs arrive from the client,
// and this fetch runs server-side — without a gate it could be pointed at
// cloud metadata (169.254.169.254), localhost, or internal services and the
// bytes would come back embedded in the returned PDF. Customer photos live
// in Supabase storage; the studio preview may hand us Wikimedia URLs. HTTPS
// + host allowlist + no redirects; everything else resolves to the designed
// typographic page, same as any other unloadable photo.
const IMG_HOST_OK = /(^|\.)supabase\.(co|in)$|(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/i;
function imgUrlAllowed(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!IMG_HOST_OK.test(u.hostname)) return false;
    return true;
  } catch { return false; }
}
async function fetchImg(url) {
  if (!imgUrlAllowed(url)) return null;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "ParkBuddy/1.0 (trip book)" },
      redirect: "error", // a redirect off the allowlist is a bypass — refuse
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!/^image\//i.test(ct)) return null;
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

// Every photo the customer put on a stop, in order — plus their location stamps as
// coordinate records. The book used to print only entry.userImg, so a stop with four
// photos printed one and silently dropped the rest.
export async function resolveEntryPhotos(entry) {
  const recs = Array.isArray(entry.photos) && entry.photos.length
    ? entry.photos
    : (entry.userImg ? [{ url: entry.userImg }] : []);
  const out = [];
  let failed = 0;
  for (const r of recs) {
    if (r && r.stamp) { out.push({ kind: "stamp", stamp: r.stamp }); continue; }
    const u = r && r.url;
    if (!u) continue;
    const img = u.startsWith("data:") ? dataUrlToImg(u) : (/^https?:/.test(u) ? await fetchImg(u) : null);
    if (img) out.push({ kind: "photo", img });
    else failed++;   // a photo the customer placed that we could not load
  }
  out.failed = failed;
  return out;
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
  palette, bw, marginIn,
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
  const { serif, serifIt, sans, fontBytes } = await embedFonts(pdf, origin);

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

  // Per stop: every photo the customer placed, laid out across as many pages as it
  // takes, then the story page. One photo fills the page; two split it; three or four
  // make a grid — so a stop with four photos prints four photos, not one.
  //
  // A location stamp is drawn by us (coordinates + rule + place, in the palette) rather
  // than fetched as map imagery. Map tiles from Google/Mapbox et al can't be printed
  // into a product we sell without a licensed provider and attribution, and drawing our
  // own removes the dependency entirely — no API key, nothing to expire.
  const INSET = Math.max(0, (marginIn || 0)) * PT;   // the customer's chosen page frame

  const drawStamp = (page, box, st) => {
    const { x, y, w, h } = box;
    page.drawRectangle({ x, y, width: w, height: h, color: INK, opacity: 0.06 });
    page.drawRectangle({ x, y, width: w, height: h, borderColor: GOLD, borderWidth: 0.8, color: undefined });
    const lat = Number(st.lat), lng = Number(st.lng);
    const coord = (isFinite(lat) && isFinite(lng))
      ? `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}   ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`
      : "";
    const label = String(st.label || "").toUpperCase().slice(0, 40);
    const cx = x + w / 2;
    const put = (font, text, size, yy, color) => {
      if (!text) return;
      const tw = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: cx - tw / 2, y: yy, size, font, color });
    };
    put(sans, "LOCATION", 7, y + h / 2 + 26, GOLD);
    put(sans, coord, Math.min(11, w / 22), y + h / 2 + 4, INK);
    page.drawRectangle({ x: cx - 18, y: y + h / 2 - 8, width: 36, height: 0.8, color: GOLD });
    put(sans, label, 8, y + h / 2 - 24, MUTED);
  };

  const drawTile = (page, box, item, full) => {
    if (item.kind === "stamp") return drawStamp(page, box, item.stamp);
    const emb = item.emb;
    if (!emb) return;
    const { x, y, w, h } = box;
    // pdf-lib has no clipping path, so an overflowing image can only be hidden by
    // painting over it — and painting over it erases whatever was drawn before. That's
    // why tiles must never overflow their cell: fit INSIDE it.
    //
    // The one exception is a single photo on a full-bleed page, where the cell IS the
    // page: there we cover-fit deliberately and the page boundary does the clipping.
    const sc = full
      ? Math.max(w / emb.width, h / emb.height)
      : Math.min(w / emb.width, h / emb.height);
    const iw = emb.width * sc, ih = emb.height * sc;
    page.drawImage(emb, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
  };

  // How many tiles share a page, and where each sits.
  const cellsFor = (n) => {
    const L = INSET, R = W - INSET, B = INSET, T = H - INSET;
    const iw = R - L, ih = T - B, g = n > 1 ? 10 : 0;
    if (n === 1) return [{ x: L, y: B, w: iw, h: ih }];
    if (n === 2) return [
      { x: L, y: B + ih / 2 + g / 2, w: iw, h: ih / 2 - g / 2 },
      { x: L, y: B, w: iw, h: ih / 2 - g / 2 },
    ];
    const cw = iw / 2 - g / 2, ch = ih / 2 - g / 2;
    return [
      { x: L, y: B + ch + g, w: cw, h: ch }, { x: L + cw + g, y: B + ch + g, w: cw, h: ch },
      { x: L, y: B, w: cw, h: ch }, { x: L + cw + g, y: B, w: cw, h: ch },
    ];
  };

  // A photo that fails to load must never be silently omitted — that is how a customer
  // pays for a four-photo spread and receives two. Count the failures and refuse the
  // book, rather than printing a quietly incomplete one.
  let missingPhotos = 0;
  for (const e of entries) {
    const items = await resolveEntryPhotos(e);
    missingPhotos += items.failed || 0;
    for (const it of items) {
      if (it.kind === "photo") it.emb = await embedImg(pdf, it.img);
    }
    const usable = items.filter((it) => it.kind === "stamp" || it.emb);

    if (!usable.length) {
      // Designed "no photo" chapter page: eyebrow · place · accent rule · time.
      const photo = blank();
      if (e.type) center(photo, sans, String(e.type).toUpperCase(), 9, H / 2 + 58, GOLD);
      const nm = wrap(serif, String(e.place || "A stop along the way"), 26, W - SAFE * 2);
      let y = H / 2 + (nm.length - 1) * 16 + 6;
      nm.forEach((ln) => { center(photo, serif, ln, 26, y, INK); y -= 32; });
      photo.drawRectangle({ x: W / 2 - 24, y: y + 4, width: 48, height: 1.4, color: GOLD });
      if (e.time) center(photo, sans, String(e.time).toUpperCase(), 8.5, y - 14, MUTED);
    } else {
      // Up to 4 tiles per page; a long stop simply runs on to more pages.
      for (let i = 0; i < usable.length; i += 4) {
        const group = usable.slice(i, i + 4);
        const page = blank();
        const cells = cellsFor(group.length);
        const fullBleedSingle = group.length === 1 && INSET === 0;
        group.forEach((it, k) => drawTile(page, cells[k], it, fullBleedSingle));
        // Caption band only on the first page of a stop, so the name isn't repeated.
        if (i === 0) {
          page.drawRectangle({ x: 0, y: 0, width: W, height: 54, color: INK, opacity: 0.72 });
          page.drawText(String(e.place || "").toUpperCase(), { x: SAFE, y: 22, size: 10, font: sans, color: CREAM });
        }
      }
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

  if (missingPhotos > 0) {
    const err = new Error("Some photos couldn't be loaded for print.");
    err.details = { problems: [
      `${missingPhotos} photo${missingPhotos === 1 ? "" : "s"} in this book couldn't be loaded, so ` +
      `the book would print without ${missingPhotos === 1 ? "it" : "them"}. Nothing has been ordered — ` +
      `please re-upload the affected photos and try again.`,
    ] };
    throw err;
  }

  const bytes = await pdf.save();
  // Never hand a file to the printer without checking it is structurally the book we
  // said it was. Throws with a specific reason rather than shipping something wrong.
  await preflightInterior(bytes, {
    trimW: inW, trimH: inH,
    minPages: range ? range.min : undefined,
    maxPages: range ? range.max : undefined,
    fontBytes,
  });
  return { bytes, pageCount: pdf.getPageCount() };
}
