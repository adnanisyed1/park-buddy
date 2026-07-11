// Give every scenic drive a card/hero image. Enriched drives already have a gallery
// (we use its first photo); for the rest, do a light Wikimedia Commons lookup on the
// road/byway name. Writes a `cardImage` URL onto each drive in public/byways-data.js.
// The index card and detail hero prefer this over the flaky Wikipedia-lead lookup.
//
// Usage: node scripts/build-card-images.mjs   (PB_FORCE=1 to refetch existing)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BYWAYS = path.join(ROOT, "public/byways-data.js");
const DETAIL = path.join(ROOT, "public/byways/detail");
const UA = "ParkBuddy/1.0 (card images; contact adnansyed899@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function commons(params) {
  const u = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", formatversion: "2", ...params });
  for (let a = 1; a <= 3; a++) {
    try { const r = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    catch { if (a === 3) return null; await sleep(700 * a); }
  }
}
const BAD = /\b(map|locator|diagram|logo|seal|sign|marker|plaque|nrhp|haer|lccn|survey|document|elevation profile|route|flag|shield|icon)\b|\.(svg|tif|tiff|pdf|gif)$/i;
function firstPhoto(pages) {
  for (const p of (pages || [])) {
    const t = p.title || ""; if (!/\.(jpe?g|png)$/i.test(t) || BAD.test(t)) continue;
    const ii = p.imageinfo && p.imageinfo[0]; if (ii && ii.thumburl) return ii.thumburl;
  }
  return null;
}
async function cardFor(drive, detail) {
  const names = [...new Set([detail && detail.source && detail.source.roadArticle, drive.name, (drive.wiki || [])[0]].filter(Boolean))];
  for (const name of names) {
    const j = await commons({ action: "query", generator: "categorymembers", gcmtitle: "Category:" + name, gcmtype: "file", gcmlimit: "25", prop: "imageinfo", iiprop: "url", iiurlwidth: "1200" });
    const url = firstPhoto(j && j.query && j.query.pages); if (url) return url;
    await sleep(150);
  }
  // search fallback
  const j = await commons({ action: "query", generator: "search", gsrsearch: names[0], gsrnamespace: "6", gsrlimit: "25", prop: "imageinfo", iiprop: "url", iiurlwidth: "1200" });
  return firstPhoto(j && j.query && j.query.pages);
}

let raw = fs.readFileSync(BYWAYS, "utf8");
const m = raw.match(/(window\.BYWAYS_DATA\s*=\s*)(\[[\s\S]*?\])(;)/);
const arr = JSON.parse(m[2]);
let set = 0, had = 0, miss = 0, done = 0;
for (const d of arr) {
  let detail = null; try { detail = JSON.parse(fs.readFileSync(path.join(DETAIL, d.id + ".json"), "utf8")); } catch {}
  const galleryUrl = detail && detail.gallery && detail.gallery[0] && detail.gallery[0].url;
  if (galleryUrl) { d.cardImage = galleryUrl; had++; }
  else if (d.cardImage && !process.env.PB_FORCE) { had++; }
  else {
    const url = await cardFor(d, detail);
    if (url) { d.cardImage = url; set++; } else { miss++; }
  }
  if (++done % 15 === 0) console.log(`  … ${done}/${arr.length}`);
}
fs.writeFileSync(BYWAYS, raw.slice(0, m.index) + m[1] + JSON.stringify(arr) + m[3] + raw.slice(m.index + m[0].length));
const total = arr.filter((d) => d.cardImage).length;
console.log(`\n✓ cardImage: ${total}/${arr.length} drives (from gallery/existing: ${had}, newly fetched: ${set}, no photo: ${miss})`);
