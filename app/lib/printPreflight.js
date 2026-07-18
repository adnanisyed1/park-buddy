// Preflight checks for print-ready PDFs.
//
// Written after shipping a book whose title printed as "T rat a or". Lulu marked that
// file ACCEPTED — it validates trim, bleed and page count, not whether the words still
// have their letters — so "the printer accepted it" is not evidence the book is right.
//
// BE HONEST ABOUT WHAT THESE CATCH. They are structural invariants: they catch
// regressions that make a file wrong in a mechanical way. They cannot tell you the book
// looks good, and they cannot verify the text renders — the one bug that started all of
// this. That job belongs to the customer-facing proof, which renders the real PDF to
// images before anyone pays.
//
// A rejected idea, recorded so nobody re-derives it: checking font.getCharacterSet()
// does NOT work. pdf-lib reports the same 2091 characters for a subsetted font as for a
// fully embedded one, because it describes what the font declares, not what was actually
// written into the file. It would have passed the exact bug it was meant to catch.
import { PDFDocument } from "pdf-lib";

export class PreflightError extends Error {
  constructor(message, details) { super(message); this.name = "PreflightError"; this.details = details || {}; }
}

const PT = 72;
const BLEED_IN = 0.25; // 0.125in per edge

// Fully embedding three faces costs a few hundred KB. A subsetted build of the same book
// is ~4KB. Requiring the file to carry a real fraction of the font bytes it claims to
// embed is what makes re-enabling subsetting a loud failure instead of a silent one.
const MIN_FONT_SHARE = 0.25;

export async function preflightInterior(bytes, { trimW, trimH, minPages, maxPages, fontBytes }) {
  const problems = [];
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();

  if (!pages.length) problems.push("The interior has no pages.");

  const expW = +((trimW + BLEED_IN) * PT).toFixed(2);
  const expH = +((trimH + BLEED_IN) * PT).toFixed(2);
  const odd = pages
    .map((p, i) => ({ i: i + 1, s: p.getSize() }))
    .filter(({ s }) => Math.abs(s.width - expW) > 1 || Math.abs(s.height - expH) > 1);
  if (odd.length) {
    problems.push(
      `${odd.length} page(s) are the wrong size for this trim — expected ${expW}x${expH}pt, ` +
      `page ${odd[0].i} is ${odd[0].s.width.toFixed(1)}x${odd[0].s.height.toFixed(1)}pt.`
    );
  }

  // Sheets print two-up, so an odd page count cannot be bound.
  if (pages.length % 2 !== 0) problems.push(`Page count must be even; got ${pages.length}.`);
  if (minPages && pages.length < minPages) problems.push(`This binding needs at least ${minPages} pages; got ${pages.length}.`);
  if (maxPages && pages.length > maxPages) problems.push(`This binding tops out at ${maxPages} pages; got ${pages.length}.`);

  fontProblem(bytes, fontBytes, problems);

  if (problems.length) throw new PreflightError("Interior PDF failed preflight.", { problems, pageCount: pages.length });
  return { pageCount: pages.length, width: expW, height: expH };
}

export async function preflightCover(bytes, { coverW, coverH, fontBytes }) {
  const problems = [];
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();

  if (pages.length !== 1) problems.push(`A wraparound cover must be exactly 1 page; got ${pages.length}.`);
  if (pages.length) {
    const s = pages[0].getSize();
    if (Math.abs(s.width - coverW) > 1 || Math.abs(s.height - coverH) > 1) {
      problems.push(
        `Cover is ${s.width.toFixed(1)}x${s.height.toFixed(1)}pt but Lulu requires ` +
        `${coverW.toFixed(1)}x${coverH.toFixed(1)}pt for this SKU and page count.`
      );
    }
  }

  fontProblem(bytes, fontBytes, problems);

  if (problems.length) throw new PreflightError("Cover PDF failed preflight.", { problems });
  return { width: coverW, height: coverH };
}

function fontProblem(bytes, fontBytes, problems) {
  if (!fontBytes) return;
  const share = bytes.length / fontBytes;
  if (share < MIN_FONT_SHARE) {
    problems.push(
      `Fonts do not appear to be fully embedded (file is ${Math.round(bytes.length / 1024)}KB ` +
      `against ${Math.round(fontBytes / 1024)}KB of typefaces). Subsetting silently drops ` +
      `glyphs and prints words with letters missing — see app/lib/pdfFonts.js.`
    );
  }
}
