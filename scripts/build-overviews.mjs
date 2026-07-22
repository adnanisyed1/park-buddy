// The Park Buddy overview — a neutral-guidebook editorial per place, written
// by Claude AT BUILD TIME from a dossier of facts we can prove, then stored
// and committed like every other fixed dataset. Nothing is generated at
// request time, and the owner can read/edit every word before it ships.
//
//   node scripts/build-overviews.mjs --dossier <id-substring>   # print one dossier, no AI
//   node scripts/build-overviews.mjs                            # crawl + generate + emit
//   node scripts/build-overviews.mjs --emit                     # rebuild output from cache
//
// Needs ANTHROPIC_API_KEY (env or .env.local) for generation; dossier assembly
// is keyless. Decisions (owner, 2026-07-21): neutral guidebook voice, four
// structured sections, popularity proven by real visitation numbers AND
// famous-for landmarks AND our own data superlatives.
//
// THE HONESTY CONTRACT: the model may only phrase what the dossier states.
// Every number, name and relationship comes from a dataset in this repo or a
// federal API probed in this session:
//   · place-geo.json         acres, type, state
//   · place-adjacency.json   which forests border which parks, gap in miles
//   · gateway-ranked.json + town-attributes.json   basecamp towns + what's in them
//   · lake-data.json         flagship lakes, dams (NID), rec evidence (RIDB)
//   · NPS irma stats         real annual visitation by park code (public)
//   · Wikipedia summary      the place's own story
//   · Open-Meteo ERA5        monthly climate normals (5 complete years)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const load = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const GEO = load("app/lib/place-geo.json");
const ADJ = load("app/lib/place-adjacency.json").adjacency || {};
const RANKED = load("app/lib/gateway-ranked.json");
const ATTRS = load("app/lib/town-attributes.json");
const LAKES = load("app/lib/lake-data.json");

const OUT = join(ROOT, "app/lib/overview-data.json");
const CACHE_DIR = join(HERE, ".overview-cache");
const safe = (id) => id.replace(/[^a-z0-9-]+/gi, "_");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ANTHROPIC_API_KEY from env or .env.local — same convention as every other
// key in this repo.
function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const env = readFileSync(join(ROOT, ".env.local"), "utf8");
    const m = env.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

async function fetchJson(url, { tries = 2, timeoutMs = 30000, init } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) return await r.json();
      if (r.status < 500) return null;
    } catch { /* retry */ }
    await sleep(2000 * (i + 1));
  }
  return null;
}

// ---- park codes (public/nps-codes.js has normalized-name -> code) ----------
const CODE_SRC = readFileSync(join(ROOT, "public/nps-codes.js"), "utf8");
const CODES = {};
for (const m of CODE_SRC.matchAll(/([a-z]+):\s*'([a-z]{4})'/g)) CODES[m[1]] = m[2];
const norm = (name) => name.toLowerCase().replace(/[^a-z]/g, "");

// ---- visitation: one pass over all parks, so rank is computable ------------
async function visitationTable() {
  const metaFile = join(CACHE_DIR, "_visitation.json");
  if (existsSync(metaFile)) return JSON.parse(readFileSync(metaFile, "utf8"));
  const year = new Date().getFullYear() - 1;
  const totals = {};
  for (const [id, p] of Object.entries(GEO.places)) {
    if (p.type !== "national_park") continue;
    const code = CODES[norm(p.name)];
    if (!code) continue;
    const rows = await fetchJson(
      `https://irmaservices.nps.gov/v3/rest/stats/visitation?unitCodes=${code}&startMonth=1&startYear=${year}&endMonth=12&endYear=${year}&format=json`
    );
    const total = (rows || []).reduce((a, r) => a + (r.RecreationVisitors || 0), 0);
    if (total > 0) totals[id] = { code, year, visits: total };
    await sleep(250);
  }
  const ranked = Object.entries(totals).sort((a, b) => b[1].visits - a[1].visits);
  ranked.forEach(([id], i) => { totals[id].rankAmongParks = i + 1; totals[id].ofParks = ranked.length; });
  writeFileSync(metaFile, JSON.stringify(totals, null, 1));
  return totals;
}

// ---- towns: top basecamps with what's actually in them ---------------------
const attrKey = (name, lat, lng) => `${name}|${lat.toFixed(3)},${lng.toFixed(3)}`;
function topTowns(placeId, n = 5) {
  const rows = (RANKED.places || {})[placeId] || [];
  const JUNK = /justice of the peace|election precinct|voting precinct|census|township \d|magisterial/i;
  return rows
    .filter((t) => !JUNK.test(t.name))
    .sort((a, b) => (a.inside === b.inside ? Math.abs(a.edgeMi) - Math.abs(b.edgeMi) : a.inside ? -1 : 1))
    .slice(0, n)
    .map((t) => {
      const a = ATTRS.towns[attrKey(t.name, t.lat, t.lng)];
      return {
        name: t.name,
        inside: !!t.inside,
        milesFromBoundary: t.inside ? 0 : Math.round(Math.abs(t.edgeMi) * 10) / 10,
        lodgingCount: a ? a.counts.lodging : null,
        foodCount: a ? a.counts.food : null,
        tags: a ? a.tags : [],
      };
    });
}

// ---- climate: same math as /api/climate, run once per place ----------------
async function climateMonths(lat, lng) {
  const endYear = new Date().getFullYear() - 1;
  const p = new URLSearchParams({
    latitude: lat, longitude: lng,
    start_date: (endYear - 4) + "-01-01", end_date: endYear + "-12-31",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    temperature_unit: "fahrenheit", timezone: "auto",
  });
  const data = await fetchJson("https://archive-api.open-meteo.com/v1/archive?" + p, { timeoutMs: 25000 });
  const d = data && data.daily;
  if (!d || !d.time) return null;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const acc = Array.from({ length: 12 }, () => ({ hi: 0, lo: 0, n: 0, wet: 0 }));
  for (let i = 0; i < d.time.length; i++) {
    const m = +d.time[i].slice(5, 7) - 1;
    if (!isFinite(d.temperature_2m_max[i])) continue;
    acc[m].hi += d.temperature_2m_max[i]; acc[m].lo += d.temperature_2m_min[i]; acc[m].n++;
    if (d.precipitation_sum[i] >= 1) acc[m].wet++;
  }
  return acc.map((a, i) => ({
    m: MONTHS[i],
    hi: a.n ? Math.round(a.hi / a.n) : null,
    lo: a.n ? Math.round(a.lo / a.n) : null,
    wetDaysPerMonth: a.n ? Math.round(a.wet / 5) : null,
  }));
}

// ---- landmarks: trip-data desc (hand-written) + Wikipedia lede -------------
const TRIP_SRC = readFileSync(join(ROOT, "public/trip-data.js"), "utf8");
function tripDesc(name) {
  const rx = new RegExp(`"name":"${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^}]*"desc":"((?:[^"\\\\]|\\\\.)*)"`);
  const m = TRIP_SRC.match(rx);
  return m ? m[1].replace(/\\"/g, '"') : null;
}
async function wikiLede(name) {
  const d = await fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(name));
  return d && d.type === "standard" && d.extract && d.extract.length > 80 ? d.extract : null;
}

// ---- the dossier ------------------------------------------------------------
export async function buildDossier(id) {
  const p = GEO.places[id];
  const TYPE_LABEL = { national_park: "National Park", national_forest: "National Forest", state_park: "State Park" };
  const lakes = (LAKES.places || {})[id] || [];
  const neighbors = (ADJ[id] || []).map((n) => ({
    name: n.name, type: TYPE_LABEL[n.type] || n.type, rel: n.rel, gapMi: n.gapMi,
    acres: GEO.places[n.id] ? Math.round(GEO.places[n.id].acres) : null,
  }));
  const vis = (await visitationTable())[id] || null;
  return {
    name: p.name,
    kind: TYPE_LABEL[p.type] || p.type,
    state: p.state,
    acres: Math.round(p.acres) || null,
    annualVisitation: vis ? { visits: vis.visits, year: vis.year, rankAmongUSNationalParks: vis.rankAmongParks + " of " + vis.ofParks } : null,
    handWrittenSummary: tripDesc(p.name),
    wikipediaLede: await wikiLede(p.name),
    bordering: neighbors,
    flagshipLakes: lakes.slice(0, 5).map((l) => ({
      name: l.name, sizeKm2: l.sizeKm2, origin: l.origin || null,
      dam: l.dam ? { name: l.dam.name, river: l.dam.river, year: l.dam.year, owner: l.dam.owner } : null,
      recreation: l.rec ? { campgroundsAndFacilities: l.rec.facilities, recAreas: l.rec.recAreas, namedRecArea: l.rec.namedRecArea } : null,
    })),
    basecampTowns: topTowns(id),
    typicalMonths: await climateMonths(
      (p.bbox[1] + p.bbox[3]) / 2, (p.bbox[0] + p.bbox[2]) / 2
    ),
  };
}

// ---- generation --------------------------------------------------------------
const SYSTEM = `You write place overviews for Park Buddy, a US parks travel platform whose brand is HONESTY. Voice: neutral premium guidebook — knowledgeable, warm, zero hype.

You receive a DOSSIER of verified facts. THE ONLY facts you may state are the ones in the dossier. Never invent a trail, view, animal, event, or claim. Every number you write must appear in the dossier, verbatim or correctly rounded. If a section lacks enough dossier material, return null for it.

Write only from facts that ARE present. Never mention that a fact is missing, unavailable, or "not recorded" — the reader is a traveler, not a data auditor. A gap in the dossier is silently omitted, never narrated.

Return STRICT JSON, no markdown:
{
 "whyCome": "...",    // 40-75 words. What draws people: visitation numbers/rank when present, the hand-written summary's landmarks, the lede's essence.
 "dontMiss": "...",   // 40-75 words. Our data's edge: bordering public land and what that means (fees/permits are NOT in the dossier — do not claim them), flagship lakes with their dams or recreation evidence, size superlatives.
 "whenToGo": "...",   // 30-60 words. Read typicalMonths: name 1-2 windows with their real temps/wet days. These are historical averages — phrase as "typically", never as forecast.
 "whereToBase": "..." // 30-60 words. From basecampTowns only: name up to 3, use inside/milesFromBoundary and lodging/food counts as given.
}`;

async function generateOverview(dossier, key) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      // Opus 4.8 — the strongest prose writer. The whole 180-place run costs
      // ~$4-5 at its pricing; on customer-facing editorial that is the
      // cheapest quality upgrade this product will ever buy.
      model: "claude-opus-4-8",
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: "user", content: "DOSSIER:\n" + JSON.stringify(dossier, null, 1) }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  for (const k of ["whyCome", "dontMiss", "whenToGo", "whereToBase"]) if (!(k in json)) json[k] = null;
  return json;
}

function emitFromCache() {
  const out = { generatedAt: new Date().toISOString(), places: {} };
  for (const f of readdirSync(CACHE_DIR)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    const d = JSON.parse(readFileSync(join(CACHE_DIR, f), "utf8"));
    if (d.overview) out.places[d.id] = d.overview;
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`Wrote ${OUT}: ${Object.keys(out.places).length} overviews`);
}

export async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  const di = process.argv.indexOf("--dossier");
  if (di > -1) {
    const q = (process.argv[di + 1] || "").toLowerCase();
    const id = Object.keys(GEO.places).find((k) => k.toLowerCase().includes(q));
    if (!id) return console.log("no place matches", q);
    console.log(JSON.stringify(await buildDossier(id), null, 1));
    return;
  }
  if (process.argv.includes("--emit")) return emitFromCache();

  const key = apiKey();
  if (!key) {
    console.log("ANTHROPIC_API_KEY not set (env or .env.local). Dossiers work without it; generation does not.");
    process.exit(1);
  }
  // --only zion,yellowstone → pilot a handful of places before paying for
  // the full set (voice review comes before volume).
  const oi = process.argv.indexOf("--only");
  const only = oi > -1 ? (process.argv[oi + 1] || "").toLowerCase().split(",").filter(Boolean) : null;
  const ids = Object.keys(GEO.places).filter(
    (id) => !only || only.some((q) => id.toLowerCase().includes(q)));
  let done = 0;
  for (const id of ids) {
    const file = join(CACHE_DIR, safe(id) + ".json");
    if (existsSync(file)) { done++; continue; }
    try {
      const dossier = await buildDossier(id);
      const overview = await generateOverview(dossier, key);
      writeFileSync(file, JSON.stringify({ id, dossier, overview }, null, 1));
      done++;
      console.log(`✓ ${id} (${done}/${ids.length})`);
    } catch (e) {
      console.log(`✗ ${id} — ${e.message} (will retry on rerun)`);
      await sleep(4000);
    }
    await sleep(800);
  }
  emitFromCache();
}

// pathToFileURL, not a template literal: the repo path contains a space.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
