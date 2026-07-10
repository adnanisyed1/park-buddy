// Turn the generated app/lib/gateway-data.json (parks) into gateway_towns upsert
// SQL, mapping each park to its destinations id (nps:<slug>) via the park name.
// Writes scratchpad SQL: delete existing national_park rows, then insert fresh.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = "/private/tmp/claude-501/-Users-adnansyed-Documents-Park-Buddy-nextjs/8336892d-b650-4328-a419-ca723866ccea/scratchpad";
const gw = JSON.parse(fs.readFileSync(path.join(ROOT, "app/lib/gateway-data.json"), "utf8"));
const dest = JSON.parse(fs.readFileSync(path.join(SCRATCH, "park-destinations.json"), "utf8"));

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const byName = new Map(dest.rows.map((r) => [norm(r.name), r.id]));

const q = (s) => (s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'");
const rows = [];
let missing = [];
for (const p of Object.values(gw.parks)) {
  const placeId = byName.get(norm(p.name));
  if (!placeId) { missing.push(p.name); continue; }
  (p.towns || []).forEach((t, i) => {
    const r5 = (n) => Math.round(n * 1e5) / 1e5;
    rows.push(`(${q(placeId)},'national_park',${q(t.name)},${q(t.bareName)},${r5(t.lat)},${r5(t.lng)},${t.distanceMi},${i},${q(t.source || p.townSource || "gnis")},now())`);
  });
}
const sql = "delete from gateway_towns where place_type='national_park';\n" +
  "insert into gateway_towns (place_id,place_type,name,bare_name,lat,lng,distance_mi,rank,source,updated_at) values\n" +
  rows.join(",\n") + ";";
fs.writeFileSync(path.join(SCRATCH, "gateway-towns.sql"), sql);
console.log("town rows:", rows.length, "| parks with towns:", new Set(rows.map((r) => r.split(",")[0])).size);
if (missing.length) console.log("UNMAPPED parks:", missing.join(", "));
