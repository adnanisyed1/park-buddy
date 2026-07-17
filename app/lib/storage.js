// Supabase Storage helper — hosts generated order PDFs at PUBLIC URLs that Lulu
// downloads at print time. Requires a PUBLIC bucket (default "book-pdfs"; override
// with SUPABASE_BOOK_BUCKET). Reuses SUPABASE_URL + SUPABASE_SERVICE_KEY.
//   Create the bucket once in Supabase → Storage → New bucket → name "book-pdfs",
//   Public = ON.
export const BOOK_BUCKET = process.env.SUPABASE_BOOK_BUCKET || "book-pdfs";

function base() {
  return (process.env.SUPABASE_URL || "").replace(/\/+(rest(\/v1)?)?\/*$/i, "");
}
export function storageConfigured() {
  return !!(base() && process.env.SUPABASE_SERVICE_KEY);
}

export async function uploadPublicPdf(path, bytes) {
  const b = base(), key = process.env.SUPABASE_SERVICE_KEY;
  if (!b || !key) throw new Error("Storage not configured");
  const r = await fetch(b + "/storage/v1/object/" + BOOK_BUCKET + "/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, apikey: key, "Content-Type": "application/pdf", "x-upsert": "true" },
    body: Buffer.from(bytes),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("Storage upload failed (" + r.status + ") " + t.slice(0, 140)); }
  return b + "/storage/v1/object/public/" + BOOK_BUCKET + "/" + path;
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
