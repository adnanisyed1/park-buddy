// Build destinations rows for the ~415 non-"National Park" NPS units (monuments,
// historic parks, seashores, recreation areas, preserves, memorials…). Kept as a
// SEPARATE category (type=nps_unit) — never mixed with the 63 national parks.
// Fetches the live NPS index (/api/nps?index=1), filters OUT park designations,
// emits destinations upsert SQL to scratchpad (chunked for MCP execute_sql).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = "/private/tmp/claude-501/-Users-adnansyed-Documents-Park-Buddy-nextjs/8336892d-b650-4328-a419-ca723866ccea/scratchpad";
const NPS = process.env.NPS_URL || "http://localhost:3001/api/nps?index=1";
const CHUNK = 150;

const ABBR_FULL = { AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",HI:"Hawaii",DC:"District of Columbia",PR:"Puerto Rico",VI:"U.S. Virgin Islands",GU:"Guam",AS:"American Samoa",MP:"Northern Mariana Islands" };
const fullStates = (s) => String(s || "").split(",").map((a) => ABBR_FULL[a.trim()] || a.trim()).filter(Boolean).join(" / ");

// Same park designations we already loaded as national_park — exclude them here.
const PARK_DES = new Set(["National Park", "National Park & Preserve", "National Parks", "National and State Parks"]);
const isPark = (u) => PARK_DES.has(u.designation) || /national park\b/i.test(u.fullName);

const { units, total } = await fetch(NPS).then((r) => r.json());
const q = (s) => (s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'");
const r5 = (n) => Math.round(n * 1e5) / 1e5;

const rows = [];
let skipped = 0;
for (const u of units) {
  if (isPark(u)) continue;
  if (!u.parkCode || u.lat == null || u.lng == null) { skipped++; continue; }
  rows.push(`(${q("nps:" + u.parkCode)},${q(u.parkCode)},${q(u.fullName || u.name)},'nps_unit','nps',${q(fullStates(u.states))},${r5(u.lat)},${r5(u.lng)},${q(u.designation || "")},2,now())`);
}

const header = "insert into destinations (id,code,name,type,source,state,lat,lng,detail,tier,updated_at) values\n";
const footer = "\non conflict (id) do update set code=excluded.code,name=excluded.name,type=excluded.type,source=excluded.source,state=excluded.state,lat=excluded.lat,lng=excluded.lng,detail=excluded.detail,tier=excluded.tier,updated_at=now();";
let files = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  fs.writeFileSync(path.join(SCRATCH, `nps-units-${files + 1}.sql`), header + chunk.join(",\n") + footer);
  files++;
}
console.log(`total NPS units: ${total} | non-park rows: ${rows.length} | skipped(no code/coords): ${skipped} | wrote ${files} chunk file(s)`);
// designation breakdown for a sanity check
const byDes = {};
for (const u of units) { if (!isPark(u)) byDes[u.designation] = (byDes[u.designation] || 0) + 1; }
console.log(Object.entries(byDes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `  ${String(v).padStart(3)} ${k || "(none)"}`).join("\n"));
