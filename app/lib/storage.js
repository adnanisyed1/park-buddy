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
