// The book palette library — the single source of truth for how a Trip Book looks,
// on screen AND in print.
//
// This lived inside app/trip-book/TripBook.jsx, which meant the PDF builders couldn't
// see it: the printed book was hardcoded cream-and-gold regardless of the palette the
// customer picked, so someone could design a Parchment Royal book and be shipped a black
// one. Both the studio and the print pipeline now read from here.
//
// To add a theme: append an object to the right shelf. Nothing else needs to change.

/* ── Book palette library ─────────────────────────────────────────────────────
   Curated print palettes, grouped into three shelves: Signature (the exclusive
   Park Buddy editions), Dark, and Light. Each palette is {base (paper), ink
   (type), accent (foil/rule), silhouette (the cover layout it was designed for),
   mood (when to reach for it), desc (one-line character)}. base/ink are chosen
   to clear print contrast; accent is the metallic or saturated grace note.
   To add a theme: append an object here — nothing else needs to change (the
   picker, ALL_THEMES and the light/dark auto-detection all read this list). */
export const PALETTES = {
  // The house shelf — the ones we'd hand a customer who says "just make it beautiful."
  signature: [
    { key: "parchment-royal", name: "Parchment Royal", base: "#EDE3CC", ink: "#22301F", accent: "#9A7B2E", silhouette: "manuscript", mood: "The Park Buddy house edition — any park.", desc: "Our parchment with pine ink and struck brass." },
    { key: "midnight-brass", name: "Midnight Brass", base: "#0B1410", ink: "#EFE6D0", accent: "#C9A24A", silhouette: "editorial", mood: "The flagship dark edition — heirloom gift.", desc: "Old-growth black stamped in foil brass." },
    { key: "golden-hour", name: "Golden Hour", base: "#241205", ink: "#F6E6CE", accent: "#E9A23B", silhouette: "full", mood: "The last light before dark — sweeping vistas.", desc: "Campfire amber over deep umber." },
    { key: "moss-agate", name: "Moss Agate", base: "#10201A", ink: "#E8F0E6", accent: "#86C7A0", silhouette: "centered", mood: "Deep forest, luminous and jewel-like.", desc: "Polished moss-agate green." },
    { key: "sierra-topaz", name: "Sierra Topaz", base: "#0D1826", ink: "#E9F1FA", accent: "#E0B24E", silhouette: "centered", mood: "Big skies crowned by gold peaks.", desc: "Sierra night blue set with topaz." },
    { key: "rose-quartz", name: "Rose Quartz", base: "#F0E6E4", ink: "#2E2422", accent: "#A65A6E", silhouette: "split", mood: "Anniversaries, honeymoons, soft light.", desc: "Blush quartz with a dusk-rose seal." },
    { key: "blackthorn", name: "Blackthorn", base: "#131614", ink: "#ECEFEA", accent: "#A9B89E", silhouette: "minimal", mood: "Understated modern luxury.", desc: "Blackthorn charcoal with sage silver." },
    { key: "ivory-foil", name: "Ivory Foil", base: "#F4EEE1", ink: "#2A2318", accent: "#B08D2E", silhouette: "manuscript", mood: "The heirloom edition, in light.", desc: "Ivory laid paper and antique gold foil." },
  ],
  dark: [
    { key: "black-pine", name: "Black Pine", base: "#0C1512", ink: "#E9EFE7", accent: "#C9A24A", silhouette: "manuscript", mood: "Misty forest, redwoods, the Pacific Northwest.", desc: "Old-growth dark with a struck-brass title." },
    { key: "canyon-dusk", name: "Canyon Dusk", base: "#2B1410", ink: "#F3E7DB", accent: "#D9743C", silhouette: "split", mood: "Desert reds — Utah, Sedona, the Colorado Plateau.", desc: "Deep red rock at last light." },
    { key: "cobalt-meridian", name: "Cobalt Meridian", base: "#101E38", ink: "#EAF0FA", accent: "#D8B15C", silhouette: "centered", mood: "Night skies, coastlines, big water.", desc: "Royal blue and pale gold — an atlas, not a scrapbook." },
    { key: "ash-ember", name: "Ash & Ember", base: "#1A1B1D", ink: "#EFEEEB", accent: "#C56B3E", silhouette: "editorial", mood: "Lava fields — Lassen, Volcanoes, the Cascades.", desc: "Volcanic charcoal with a copper spark." },
    { key: "alpenglow", name: "Alpenglow", base: "#241830", ink: "#F1E9F2", accent: "#F2A07C", silhouette: "centered", mood: "Alpine dusk — the Tetons, Rainier.", desc: "Twilight violet warmed by peach on the peaks." },
    { key: "midnight-fern", name: "Midnight Fern", base: "#0A1A1A", ink: "#E4EFE9", accent: "#7FB89A", silhouette: "manuscript", mood: "Rainforest, moss, the Olympic coast.", desc: "Wet-stone teal with a fern glow." },
    { key: "obsidian-gold", name: "Obsidian & Gold", base: "#121013", ink: "#F2ECDF", accent: "#D4AF37", silhouette: "editorial", mood: "Black-tie, formal, any park.", desc: "Obsidian black struck with pure gold." },
    { key: "deep-sequoia", name: "Deep Sequoia", base: "#1C120C", ink: "#F0E4D4", accent: "#B87333", silhouette: "split", mood: "Redwoods, giant sequoia, autumn.", desc: "Fallen-needle brown lit by copper." },
    { key: "tidewater", name: "Tidewater", base: "#0E1A24", ink: "#E6EEF2", accent: "#6FB0C4", silhouette: "centered", mood: "Coastlines, fjords, Acadia at dawn.", desc: "Slate-harbor blue with sea-glass." },
    { key: "aurora-slate", name: "Aurora Slate", base: "#14181A", ink: "#EAEEEC", accent: "#58C08B", silhouette: "minimal", mood: "Northern nights — Glacier, Denali.", desc: "Graphite sky with an aurora flare." },
    { key: "vin-rouge", name: "Vin Rouge", base: "#201018", ink: "#F2E4EA", accent: "#C77B92", silhouette: "split", mood: "Vineyards, sunset ridges, Shenandoah.", desc: "Aged-wine plum warmed by rosé." },
  ],
  light: [
    { key: "cirrus", name: "Cirrus", base: "#F7F8F8", ink: "#22272A", accent: "#3D6DA8", silhouette: "minimal", mood: "Modernist, gift-ready, any park.", desc: "Near-white and quiet — the photographs do the talking." },
    { key: "glacier-milk", name: "Glacier Milk", base: "#E9EFF2", ink: "#172A34", accent: "#1F6F7E", silhouette: "split", mood: "Alpine winter, glaciers, deep lakes.", desc: "Pale meltwater blue with deep lake teal." },
    { key: "lichen-field", name: "Lichen Field", base: "#E7EBE1", ink: "#232E1E", accent: "#8A5A34", silhouette: "manuscript", mood: "Meadows, the Appalachians, spring.", desc: "Soft sage paper, moss ink, bark copper." },
    { key: "sunbleached", name: "Sunbleached", base: "#EBE6DA", ink: "#2A2621", accent: "#2F4A6B", silhouette: "editorial", mood: "Desert, coast, dunes, high summer.", desc: "Sun-faded sand cooled by indigo." },
    { key: "serigraph", name: "Serigraph", base: "#E6E2D6", ink: "#1A2E22", accent: "#AE3A24", silhouette: "editorial", mood: "WPA heritage — Yellowstone, the classics.", desc: "Flat poster inks, straight out of the 1930s park shop." },
    { key: "desert-varnish", name: "Desert Varnish", base: "#EFE7D9", ink: "#3A2A1E", accent: "#A6592C", silhouette: "editorial", mood: "Slot canyons, Zion, the Southwest.", desc: "Sun-warmed sandstone and rust." },
    { key: "sea-oats", name: "Sea Oats", base: "#F1ECE0", ink: "#2B3324", accent: "#4E7C59", silhouette: "minimal", mood: "Dunes, barrier islands, salt marsh.", desc: "Dune-grass cream with a green tide." },
    { key: "morning-fog", name: "Morning Fog", base: "#EBEEEE", ink: "#232B2E", accent: "#547089", silhouette: "split", mood: "Coastal fog, redwoods, Muir Woods.", desc: "Soft fog grey and slate blue." },
    { key: "wildrose", name: "Wildrose", base: "#F3EEE6", ink: "#33261F", accent: "#B4506B", silhouette: "split", mood: "Alpine meadows, summer bloom.", desc: "Warm ivory with a wild-rose accent." },
    { key: "blueprint", name: "Blueprint", base: "#EDF0F2", ink: "#1B2733", accent: "#2C5F8A", silhouette: "minimal", mood: "Modern, architectural, gift-ready.", desc: "Drafting-paper white and ink blue." },
    { key: "gilded-cream", name: "Gilded Cream", base: "#F2EAD8", ink: "#2A2416", accent: "#9C7A28", silhouette: "manuscript", mood: "Heritage, classic, any park.", desc: "Warm cream with an antique-gold rule." },
  ],
};
export const ALL_THEMES = [...PALETTES.signature, ...PALETTES.dark, ...PALETTES.light];

// Hex → pdf-lib rgb() triple (0–1 floats). Print builders take colours as hex strings
// from a palette, exactly like the on-screen studio does.
export function hexToRgb01(hex, fallback = [0, 0, 0]) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function paletteByKey(key) {
  return ALL_THEMES.find((p) => p.key === key) || ALL_THEMES[0];
}

// Relative luminance — decides whether a palette reads as a light or dark book, which
// drives scrim direction and contrast choices in print the same way it does on screen.
export function luminance(hex) {
  const [r, g, b] = hexToRgb01(hex, [1, 1, 1]);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function isLightPalette(pal) {
  return luminance((pal && pal.base) || "#FFFFFF") > 0.35;
}

// Grayscale conversion for B&W interiors, so a book ordered in black & white previews
// and PRINTS the same way rather than being sent to the press in colour.
export function toGray01(hex) {
  const [r, g, b] = hexToRgb01(hex);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [y, y, y];
}
