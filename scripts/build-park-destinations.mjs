// Match our canonical 63 National Parks (public/trip-data.js) to their real NPS
// parkCode + designation from the live NPS index, and emit destinations rows
// (type=national_park, code=parkCode). Coords/state stay ours (consistent with the
// rest of the app + the gateway sweep); parkCode is the new live-data key.
// Writes scratchpad JSON: { rows: [...], unmatched: [...] }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "/private/tmp/claude-501/-Users-adnansyed-Documents-Park-Buddy-nextjs/8336892d-b650-4328-a419-ca723866ccea/scratchpad/park-destinations.json";
const NPS = process.env.NPS_URL || "http://localhost:3001/api/nps?index=1";

function parseArr(file, v) {
  const t = fs.readFileSync(path.join(ROOT, file), "utf8");
  const m = t.match(new RegExp(v + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"));
  return JSON.parse(m[1]);
}
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (s) => norm(s).replace(/ /g, "-");
const stAbbr = (s) => norm(s).replace(/ /g, "-"); // unused

const parks = parseArr("public/trip-data.js", "window.TRIP_PARKS");
const { units } = await fetch(NPS).then((r) => r.json());
// The park designations, incl. the oddballs: "& Preserve" (Denali…), plural
// "National Parks" (Sequoia & Kings Canyon), and "National and State Parks" (Redwood).
const PARK_DES = new Set(["National Park", "National Park & Preserve", "National Parks", "National and State Parks"]);
const parkUnits = units.filter((u) => PARK_DES.has(u.designation) || /national park/i.test(u.fullName));

function match(p) {
  const np = norm(p.name);
  // 1) exact-ish: NPS name equals ours
  let hit = parkUnits.find((u) => norm(u.name) === np);
  // 2) fullName contains our name (handles "Sequoia & Kings Canyon National Parks")
  if (!hit) hit = parkUnits.find((u) => norm(u.fullName).includes(np));
  // 3) our name contains NPS name
  if (!hit) hit = parkUnits.find((u) => np.includes(norm(u.name)) && norm(u.name).length > 4);
  // 4) token-overlap fallback (Wrangell - St Elias vs Wrangell-St. Elias)
  if (!hit) {
    const pt = new Set(np.split(" ").filter((w) => w.length > 2));
    let best = null, bestScore = 0;
    for (const u of parkUnits) {
      const ut = norm(u.fullName).split(" ").filter((w) => w.length > 2);
      const overlap = ut.filter((w) => pt.has(w)).length;
      if (overlap > bestScore) { bestScore = overlap; best = u; }
    }
    if (bestScore >= 2) hit = best;
  }
  return hit;
}

const rows = [], unmatched = [];
for (const p of parks) {
  const u = match(p);
  if (!u) { unmatched.push(p.name); continue; }
  rows.push({
    id: "nps:" + slug(p.name),
    code: u.parkCode,
    name: p.name,
    type: "national_park",
    source: "nps",
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    detail: u.designation || "National Park",
    url: "https://www.nps.gov/" + u.parkCode + "/",
    tier: 1,
    _npsName: u.fullName,
  });
}
fs.writeFileSync(OUT, JSON.stringify({ count: rows.length, unmatched, rows }, null, 2));
console.log("matched:", rows.length, "/", parks.length, "| unmatched:", unmatched.length);
if (unmatched.length) console.log("UNMATCHED:", unmatched.join(", "));
// show the shared-code cases (Sequoia/Kings Canyon → seki)
const byCode = {};
rows.forEach((r) => { (byCode[r.code] ||= []).push(r.name); });
Object.entries(byCode).filter(([, v]) => v.length > 1).forEach(([c, v]) => console.log("shared code", c, "→", v.join(" + ")));
