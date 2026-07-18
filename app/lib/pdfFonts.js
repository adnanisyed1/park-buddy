// Loads + embeds the print PDF fonts (static OFL TTFs in public/fonts) via fontkit.
// Lulu rejects non-embedded fonts, so every PDF must embed real font files — the
// base-14 fonts (Helvetica/Times) are referenced, not embedded, and get rejected.
// Static fonts (not variable) so print RIPs accept them.
import fontkit from "@pdf-lib/fontkit";

const cache = {};
async function fontBytes(origin, name) {
  if (cache[name]) return cache[name];
  const r = await fetch(origin + "/fonts/" + name);
  if (!r.ok) throw new Error("font fetch failed: " + name + " (" + r.status + ")");
  const b = new Uint8Array(await r.arrayBuffer());
  cache[name] = b;
  return b;
}

// Returns { serif, serifIt, sans } fully embedded into the given PDFDocument.
//
// SUBSETTING IS DELIBERATELY OFF. With { subset: false } pdf-lib's fontkit subsetter
// silently dropped glyphs from these EB Garamond faces: "The Great Valley Journey"
// printed as "T rat a or". The advance widths survived, so the line was correctly
// spaced with letters simply missing — it looked like a rendering artefact, not a
// broken file.
//
// Nothing catches this on its own. Lulu ACCEPTED the file, because it validates trim,
// bleed and page count, not whether words still have all their letters. A book would
// have printed and shipped with holes in the words. The only reason it was caught is
// that someone rendered a page and looked at it.
//
// Full embedding costs ~600KB per PDF instead of ~20KB. That is a fine price for a file
// that is printed once, and it is the only version verified to actually render.
export async function embedFonts(pdf, origin) {
  pdf.registerFontkit(fontkit);
  const [s, si, sa] = await Promise.all([
    fontBytes(origin, "serif.ttf"),        // EB Garamond Regular
    fontBytes(origin, "serif-italic.ttf"), // EB Garamond Italic
    fontBytes(origin, "sans.ttf"),         // Inter Medium
  ]);
  return {
    serif: await pdf.embedFont(s, { subset: false }),
    serifIt: await pdf.embedFont(si, { subset: false }),
    sans: await pdf.embedFont(sa, { subset: false }),
    // Total typeface bytes we just embedded. Preflight compares the finished PDF against
    // this: if the file is far smaller than the fonts it claims to carry, subsetting is
    // back on and glyphs are being dropped. See app/lib/printPreflight.js.
    fontBytes: s.length + si.length + sa.length,
  };
}
