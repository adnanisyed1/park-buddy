// Supabase Storage helper — hosts the generated order PDFs that Lulu downloads at print
// time. Reuses SUPABASE_URL + SUPABASE_SERVICE_KEY.
//
// This bucket used to be PUBLIC with paths built from a timestamp, which meant a
// customer's finished book — their photos, their words, their trip — was readable by
// anyone who guessed or was handed the URL, and was written there BEFORE payment. Lulu
// only needs to fetch each file once during validation, so it doesn't need public
// hosting: it gets a time-limited signed URL instead.
//   Create once in Supabase → Storage → New bucket → name "book-pdfs", Public = OFF.
// Signed URLs work whether or not the bucket is still public, so flipping that switch
// is safe to do at any time and is the step that actually closes the hole.
export const BOOK_BUCKET = process.env.SUPABASE_BOOK_BUCKET || "book-pdfs";

// How long Lulu's download link stays valid. Lulu normalizes the file at job-creation
// time, so this only has to outlive that — a week is generous and bounds the exposure.
const PDF_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

function base() {
  return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
}
export function storageConfigured() {
  return !!(base() && process.env.SUPABASE_SERVICE_KEY);
}

// An unguessable object key. Order paths were `Date.now().toString(36)` + price, which
// anyone could enumerate; a random id makes the path itself a secret.
export function orderKey(prefix = "orders") {
  const rand = (globalThis.crypto && globalThis.crypto.randomUUID)
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return prefix + "/" + rand.replace(/-/g, "");
}

// Upload a PDF and return a time-limited signed URL for it. Named for what it returns:
// a link that expires, not a permanent public address.
export async function uploadSignedPdf(path, bytes, expiresIn = PDF_URL_TTL_SECONDS) {
  const b = base(), key = process.env.SUPABASE_SERVICE_KEY;
  if (!b || !key) throw new Error("Storage not configured");
  const up = await fetch(b + "/storage/v1/object/" + BOOK_BUCKET + "/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": "application/pdf", "x-upsert": "true" },
    body: Buffer.from(bytes),
  });
  if (!up.ok) { const t = await up.text().catch(() => ""); throw new Error("Storage upload failed (" + up.status + ") " + t.slice(0, 140)); }

  const sign = await fetch(b + "/storage/v1/object/sign/" + BOOK_BUCKET + "/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!sign.ok) { const t = await sign.text().catch(() => ""); throw new Error("Storage sign failed (" + sign.status + ") " + t.slice(0, 140)); }
  const d = await sign.json();
  const signed = d && (d.signedURL || d.signedUrl);
  if (!signed) throw new Error("Storage sign returned no URL");
  // Supabase returns a path-relative URL like "/object/sign/bucket/key?token=…".
  return b + "/storage/v1" + (signed.startsWith("/") ? signed : "/" + signed);
}

/* ── Book photos — PRIVATE ────────────────────────────────────────────────────
   A traveller's book photos are private keepsakes, not a feed, so this bucket is
   PRIVATE and is only ever read by our own server (service key) when building the
   proof/print PDF. Nothing client-side reads it: the Studio renders from a small
   local thumbnail, so there is no signed URL to leak and no public path to guess.
     Create once in Supabase → Storage → New bucket → name "book-photos",
     Public = OFF.
   Objects are keyed by user id (<user.id>/<file>) so a per-user delete is
   expressible — see app/api/delete-account. */
export const BOOK_PHOTO_BUCKET = process.env.SUPABASE_BOOK_PHOTO_BUCKET || "book-photos";

export async function uploadPrivateImage(path, bytes, contentType = "image/jpeg") {
  const b = base(), key = process.env.SUPABASE_SERVICE_KEY;
  if (!b || !key) throw new Error("Storage not configured");
  const r = await fetch(b + "/storage/v1/object/" + BOOK_PHOTO_BUCKET + "/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": contentType, "x-upsert": "true" },
    body: Buffer.from(bytes),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("Photo upload failed (" + r.status + ") " + t.slice(0, 140)); }
  return path; // a PATH, never a URL — the bucket is private on purpose.
}

// Server-side read of a private object (the PDF builder's way in).
export async function downloadPrivateImage(path) {
  const b = base(), key = process.env.SUPABASE_SERVICE_KEY;
  if (!b || !key) throw new Error("Storage not configured");
  const r = await fetch(b + "/storage/v1/object/" + BOOK_PHOTO_BUCKET + "/" + path, {
    headers: { Authorization: "Bearer " + key, apikey: key },
  });
  if (!r.ok) throw new Error("Photo fetch failed (" + r.status + ")");
  return Buffer.from(await r.arrayBuffer());
}

// Pines photo uploads. Needs a PUBLIC bucket "pines" (override with SUPABASE_PINES_BUCKET).
//   Create once in Supabase → Storage → New bucket → name "pines", Public = ON.
export const PINES_BUCKET = process.env.SUPABASE_PINES_BUCKET || "pines";

export async function uploadPublicImage(path, bytes, contentType = "image/jpeg") {
  const b = base(), key = process.env.SUPABASE_SERVICE_KEY;
  if (!b || !key) throw new Error("Storage not configured");
  const r = await fetch(b + "/storage/v1/object/" + PINES_BUCKET + "/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": contentType, "x-upsert": "true" },
    body: Buffer.from(bytes),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("Image upload failed (" + r.status + ") " + t.slice(0, 140)); }
  return b + "/storage/v1/object/public/" + PINES_BUCKET + "/" + path;
}
