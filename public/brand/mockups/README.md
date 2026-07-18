# Book mockup assets (drop-in)

Figma-designed Lulu book renders for the Book Studio → **Select Book Type** step.
Spec: Figma file `1IuuEX2vq8RVRnyGaEUlMl`, node **9-72**.

## Drop the exported PNGs here
Transparent cover-**cutout** renders, 1600×1600, PNG-24, sRGB. 15 files:

```
mockup-paperback-square.png    mockup-paperback-landscape.png    mockup-paperback-portrait.png
mockup-hardcover-square.png    mockup-hardcover-landscape.png    mockup-hardcover-portrait.png
mockup-coil-square.png         mockup-coil-landscape.png         mockup-coil-portrait.png
mockup-saddle-square.png       mockup-saddle-landscape.png       mockup-saddle-portrait.png
mockup-linen-square.png        mockup-linen-landscape.png        mockup-linen-portrait.png
```

(Optional pretty versions with a sample cover baked in: same names + `-sample.png`.)

> Note: our binding key `casewrap` maps to the file stem `hardcover`.

## Paste the cover-hole coordinates
Open `app/trip-book/bookMockups.js` and fill `QUADS` — keyed by file base name, the
cover hole's four corners **[TL, TR, BR, BL]** in the 1600×1600 render space:

```js
export const QUADS = {
  "mockup-hardcover-square": [[420,300],[1180,340],[1180,1300],[420,1260]],
  // …one line per file…
};
```

An entry only goes live once it has **both** a PNG here **and** a quad there.
Missing/incomplete entries fall back to the built-in CSS mockup automatically, so
adding assets is incremental and safe.

## Also welcome (used elsewhere in the step)
- Linen cloth swatches: `linen-forest|navy|black|gray|red|tan.png`
- Foil chips: `foil-gold|silver|white.png`
- Binding icons (SVG): `icon-paperback|hardcover|coil|saddle|linen.svg`
