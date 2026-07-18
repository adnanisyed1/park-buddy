// Figma-designed Lulu book renders — integration manifest + warp math.
// Spec: Figma file 1IuuEX2vq8RVRnyGaEUlMl, node 9-72 ("Deliverable Structure").
//
// To go live:
//   1. Export the TRANSPARENT cover-cutout PNGs (1600×1600, PNG-24) to
//      public/brand/mockups/ using the spec's names, e.g. mockup-hardcover-square.png.
//   2. Paste the cover-hole corner coordinates the designer provides into QUADS below,
//      keyed by the file base name — order is [TL, TR, BR, BL] in the 1600×1600 space.
//
// Until an entry has BOTH a file on disk AND a quad here, the studio falls back to the
// built-in CSS mockup — so shipping this empty changes nothing.

export const MOCKUP_CANVAS = 1600; // the renders' native square canvas (px)

// our binding key → the designer's file-name stem
const FILE = { paperback: "paperback", saddle: "saddle", coil: "coil", casewrap: "hardcover", linen: "linen" };
const ORIENTS = ["square", "landscape", "portrait"];

// ── COORDINATES (Figma node 11-2) ────────────────────────────────────────────
// [TL, TR, BR, BL] in 1600×1600 space. Square set below is the designer's ESTIMATE
// — the 3D artist will hand over exact values; swap them in when they do. Landscape
// & portrait still pending (those bindings stay on the CSS fallback until added).
export const QUADS = {
  "mockup-paperback-square": [[435, 280], [1165, 310], [1165, 1290], [435, 1260]],
  "mockup-hardcover-square": [[420, 270], [1180, 300], [1180, 1310], [420, 1280]],
  "mockup-coil-square": [[470, 280], [1170, 300], [1170, 1290], [470, 1270]],
  "mockup-saddle-square": [[440, 290], [1160, 310], [1160, 1280], [440, 1260]],
  "mockup-linen-square": [[425, 275], [1175, 305], [1175, 1305], [425, 1275]],
};
// ─────────────────────────────────────────────────────────────────────────────

export const BOOK_MOCKUPS = {};
for (const [bk, fn] of Object.entries(FILE)) {
  for (const o of ORIENTS) {
    const base = `mockup-${fn}-${o}`;
    BOOK_MOCKUPS[`${bk}-${o}`] = {
      img: `/brand/mockups/${base}.png`,          // transparent cover-cutout render
      sample: `/brand/mockups/${base}-sample.png`, // pretty version with a sample cover
      quad: QUADS[base] || null,
    };
  }
}

// Homography: map a source rectangle (0,0)–(w,h) onto an arbitrary quad [TL,TR,BR,BL]
// and return the 16-element CSS matrix3d() array. Standard projective-transform math
// (basis-to-points → adjugate → compose), so a flat cover element lands exactly inside
// the render's angled cover hole.
function adj(m) { return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]]; }
function mmm(a, b) { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s; } return c; }
function mmv(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function basis(p) { const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; const v = mmv(adj(m), [p[3][0], p[3][1], 1]); return mmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
export function quadMatrix3d(w, h, quad) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const H = mmm(basis(quad), adj(basis(src)));
  for (let i = 0; i < 9; i++) H[i] /= H[8];
  return [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, H[8]];
}
