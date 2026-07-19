// Re-rank gateway towns by distance to the place BOUNDARY instead of its centroid.
//
// The stored distance_mi is centroid-based, and on a big forest that is not a
// small error — it is the wrong answer. White River NF, as stored:
//
//     Eagle 9 · Gypsum 12 · Basalt 15 · Avon 18 · Aspen 21 … Vail 25 …
//     Frisco 38 · Silverthorne 39 · Breckenridge 41
//
// Vail, Breckenridge, Frisco and Silverthorne are IN that forest. Gypsum, which
// leads, is outside it. The list is upside down, and no amount of curation on
// top of it helps.
//
// Needs scripts/.cache/rings.json — run build-place-geometry.mjs first.
//
//   node scripts/build-town-distances.mjs --from towns.json   # any {place_id,bare_name,lat,lng}[]
//   node scripts/build-town-distances.mjs                     # all towns, needs Supabase env
//
// Writes app/lib/gateway-ranked.json. It does NOT touch the gateway_towns table:
// the stored rows stay as they are until someone decides to migrate them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { signedMilesToBoundary } from "./build-place-geometry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RINGS = path.join(ROOT, "scripts/.cache/rings.json");
const OUT = path.join(ROOT, "app/lib/gateway-ranked.json");

const args = process.argv.slice(2);
const FROM = args.includes("--from") ? args[args.indexOf("--from") + 1] : "";
// Beyond this a town is not a basecamp for the place, it's just a town that
// exists. The stored table runs to 150 miles.
const KEEP_MI = 40;

async function loadTowns() {
  if (FROM) return JSON.parse(fs.readFileSync(path.resolve(FROM), "utf8"));
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("No --from file and no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exit(1);
  }
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/gateway_towns?select=place_id,bare_name,name,lat,lng&order=id`, {
      headers: { apikey: key, Authorization: "Bearer " + key, Range: `${from}-${from + 999}` },
    });
    const page = await r.json();
    if (!Array.isArray(page) || !page.length) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function main() {
  if (!fs.existsSync(RINGS)) {
    console.error("Missing scripts/.cache/rings.json — run build-place-geometry.mjs first.");
    process.exit(1);
  }
  const rings = new Map(JSON.parse(fs.readFileSync(RINGS, "utf8")).map((p) => [p.id, p.rings]));

  return loadTowns().then((towns) => {
    const byPlace = new Map();
    let noGeom = 0;
    for (const t of towns) {
      const rg = rings.get(t.place_id);
      if (!rg) { noGeom++; continue; }
      const lat = Number(t.lat), lng = Number(t.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      const edge = signedMilesToBoundary(lat, lng, rg);
      if (edge > KEEP_MI) continue;                       // not a basecamp for this place
      if (!byPlace.has(t.place_id)) byPlace.set(t.place_id, []);
      byPlace.get(t.place_id).push({
        name: t.bare_name || t.name,
        lat: +lat.toFixed(4), lng: +lng.toFixed(4),
        // negative = inside the boundary, which is the interesting case
        edgeMi: Math.round(edge * 10) / 10,
        inside: edge < 0,
      });
    }
    for (const list of byPlace.values()) list.sort((a, b) => a.edgeMi - b.edgeMi);

    const places = Object.fromEntries(byPlace);
    fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), keepMi: KEEP_MI, places }, null, 0));

    const kept = Object.values(places).reduce((n, l) => n + l.length, 0);
    console.log(`towns in: ${towns.length}`);
    console.log(`no geometry for their place: ${noGeom}`);
    console.log(`kept within ${KEEP_MI}mi of a boundary: ${kept}`);
    console.log(`places covered: ${Object.keys(places).length}`);
    console.log(`wrote -> app/lib/gateway-ranked.json`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
