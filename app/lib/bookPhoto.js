"use client";

// Book photo pipeline — print-resolution, unlike Trip Mode's on-trail snapshots.
//
// tripmode.js's fileToDataUrl() re-encodes to 1280px so a handful of photos fit in
// localStorage. That's right for a phone snapshot you check on the trail; it's wrong
// for something Lulu prints at 300 DPI, where an 8.5" page needs ~2550px. The Book
// Studio used to share that path, so every book photo was halved before anyone saw
// it and the original was gone for good.
//
// So each photo becomes TWO things:
//   • full  — up to PRINT_MAX px, uploaded to private storage, used only by the PDF
//   • thumb — THUMB_MAX px, kept in localStorage, all the Studio ever renders
// The browser therefore holds ~40 KB per photo instead of ~1 MB, which is what made
// photo #5 silently vanish against the ~5 MB quota.
//
// Both go through a canvas re-encode, which also strips EXIF — including the GPS in
// a phone photo. That's a side effect rather than a guarantee, so the server treats
// anything a client sends as untrusted regardless.

import { getAccessToken } from "./auth";

/* Sized to the LARGEST slot the catalogue can print, not the common one: the
   landscape book's 11" page full-bleed is 11.25" wide, so 300 DPI needs 3375px.
   Sizing this to the square book (2625px) would have quietly shipped ~273 DPI
   landscape books that looked fine on screen. Beyond ~3400 is bytes nobody sees. */
export const PRINT_MAX = 3400;
const THUMB_MAX = 480;
const PRINT_QUALITY = 0.92; // print JPEG — artefacts that hide on screen show in ink
const THUMB_QUALITY = 0.8;

// iOS Safari silently returns a blank canvas past ~16.7 MP, so clamp before drawing.
const MAX_CANVAS_PX = 16_000_000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image we can read.")); };
    img.src = url;
  });
}

function encode(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  let w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  if (w * h > MAX_CANVAS_PX) { const f = Math.sqrt(MAX_CANVAS_PX / (w * h)); w = Math.round(w * f); h = Math.round(h * f); }
  if (!w || !h) throw new Error("That image has no usable dimensions.");
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Your browser wouldn't give us a canvas to resize with.");
  ctx.drawImage(img, 0, 0, w, h);
  const out = c.toDataURL("image/jpeg", quality);
  if (!out || out.length < 200) throw new Error("That image couldn't be re-encoded.");
  return { url: out, w, h };
}

/* Read a file into what the book needs, WITHOUT committing it. `srcW`/`srcH` are the
   original's true pixels — the number a resolution warning must be judged on, since
   it's what the traveller actually handed us. */
export async function preparePhoto(file) {
  const img = await loadImage(file);
  const srcW = img.width, srcH = img.height;
  const full = encode(img, PRINT_MAX, PRINT_QUALITY);
  const thumb = encode(img, THUMB_MAX, THUMB_QUALITY);
  return { full, thumb, srcW, srcH };
}

/* Upload the print copy; hand back the record the book stores. `url` is the THUMB —
   the Studio renders it directly, so nothing client-side ever reads private storage
   and there's no signed URL to expire or leak. `path` is where the real pixels are. */
export async function uploadBookPhoto(file) {
  const { full, thumb, srcW, srcH } = await preparePhoto(file);
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to add photos to your book.");

  const r = await fetch("/api/book-photo", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: full.url, contentType: "image/jpeg", w: full.w, h: full.h }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save your photo.");

  return { url: thumb.url, path: j.path, w: full.w, h: full.h, srcW, srcH };
}

/* ── Print resolution ────────────────────────────────────────────────────────
   Judged against the slot the photo actually fills, because the same photo can be
   ample on a quarter page and thin across a full one. */
export const PRINT_DPI = 300; // Lulu's requirement

// Inches across one printed slot, from the book's trim and how many photos share the page.
export function slotInches(trim, count, full) {
  const wIn = (parseInt(String(trim).slice(0, 4), 10) || 850) / 100;
  if (full) return wIn + 0.25;      // full-bleed cover: trim + bleed both edges
  return count === 4 ? wIn / 2 : wIn; // 4-up is a 2×2 grid; 1/2/3-up run full width
}

export function dpiFor(px, inches) { return inches > 0 ? Math.round(px / inches) : 0; }

// Deliberately three states, not pass/fail: "good enough to print but soft" is the
// honest verdict for a lot of real holiday photos, and hiding it behind a hard
// reject would refuse photos people would happily accept.
export function resVerdict(px, inches) {
  const dpi = dpiFor(px, inches);
  if (dpi >= PRINT_DPI) return { level: "ok", dpi, label: dpi + " DPI", note: "Prints sharp." };
  if (dpi >= 150) return { level: "soft", dpi, label: dpi + " DPI", note: "Prints a little soft — fine at arm's length, not crisp." };
  return { level: "low", dpi, label: dpi + " DPI", note: "Too low for this size — it'll look blurry in print." };
}
