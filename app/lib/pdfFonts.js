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

// Returns { serif, serifIt, sans } embedded (subset) into the given PDFDocument.
export async function embedFonts(pdf, origin) {
  pdf.registerFontkit(fontkit);
  const [s, si, sa] = await Promise.all([
    fontBytes(origin, "serif.ttf"),        // EB Garamond Regular
    fontBytes(origin, "serif-italic.ttf"), // EB Garamond Italic
    fontBytes(origin, "sans.ttf"),         // Inter Medium
  ]);
  return {
    serif: await pdf.embedFont(s, { subset: true }),
    serifIt: await pdf.embedFont(si, { subset: true }),
    sans: await pdf.embedFont(sa, { subset: true }),
  };
}
