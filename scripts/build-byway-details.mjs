// Wikipedia scenic-byway enrichment generator (build-time; modeled on
// build-gateway-gnis.mjs). For each byway it fetches the road article via the
// MediaWiki Action API (action=parse → rendered HTML with junction templates
// already expanded), parses the junction/exit wikitable + History prose +
// References, transforms the raw junctions into a TRAVELER-FRIENDLY itinerary
// (plain-English stops in order with distances — not the engineering table),
// geocodes stops (Wikipedia coordinates first, USGS GNIS fallback), and writes:
//   • public/byways/detail/<id>.json   (heavy record: itinerary, history, images, references, attribution)
//   • endpoints{from,to,via} merged back into public/byways-data.js (gap-fill only)
//
// Sources: Wikipedia is the base (CC BY-SA — attributed per record). NPS/FHWA
// (public domain) top up designation + parkCode for live road status. Each field
// has ONE owner (no duplication) and carries a `src` tag for provenance.
//
// Usage:
//   node scripts/build-byway-details.mjs                 # all all-american byways
//   PB_ONLY=zion-park-scenic-byway,beartooth-highway node scripts/build-byway-details.mjs
//   PB_TIER=all-american,national-scenic-byway node scripts/build-byway-details.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DETAIL_DIR = path.join(ROOT, "public/byways/detail");
const BYWAYS_FILE = path.join(ROOT, "public/byways-data.js");
const CACHE_DIR = path.join(ROOT, "scripts/.cache");
const GEO_CACHE = path.join(CACHE_DIR, "geocode.json");
const UA = "ParkBuddy/1.0 (byway ingest; contact adnansyed899@gmail.com)";
const DETAIL_V = 1; // matches getBywayDetail(...?v=N) in app/lib/statusData.js
const RUN_TS = new Date().toISOString();

const ST_ABBR = { Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",Hawaii:"HI" };
const ST_NAME = Object.fromEntries(Object.entries(ST_ABBR).map(([k, v]) => [v, k]));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function parseArr(file, v) { const t = fs.readFileSync(path.join(ROOT, file), "utf8"); return JSON.parse(t.match(new RegExp(v + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"))[1]); }
function distMi(aLat, aLng, bLat, bLng) { const R = 3958.8, r = (d) => d * Math.PI / 180; const dLat = r(bLat - aLat), dLng = r(bLng - aLng); const s = Math.sin(dLat/2)**2 + Math.cos(r(aLat))*Math.cos(r(bLat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.min(1, Math.sqrt(s))); }
const clean = (s) => (s || "").replace(/\[\d+\]/g, "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

async function pool(items, worker, c) {
  let i = 0, done = 0;
  const run = async () => { while (i < items.length) { const k = i++; await worker(items[k]); if (++done % 5 === 0 || done === items.length) console.log(`  … ${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: c }, run));
}

// Global politeness gate for Wikipedia: serialize wiki.org requests ~220ms apart
// regardless of pool concurrency, so a large batch doesn't trip CDN rate limits.
let wikiChain = Promise.resolve();
function wikiGate() { const p = wikiChain.then(() => sleep(220)); wikiChain = p.catch(() => {}); return p; }

async function getJson(url, opts = {}) {
  const isWiki = /wikipedia\.org/.test(url);
  const tries = opts.tries || 5;
  for (let attempt = 1; attempt <= tries; attempt++) {
    if (isWiki) await wikiGate();
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(opts.timeout || 20000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { if (attempt === tries) { if (opts.soft) return null; throw e; } await sleep(1200 * attempt); }
  }
  return null;
}

// ── State abbreviation helper ────────────────────────────────────────────────
// A byway's `states` field is a display string ("Utah", "Montana · Wyoming").
// Take the FIRST state as the default for "<Town>, ST" geocode/Directions hints.
function primaryStateAbbr(states) {
  const first = String(states || "").split(/[·,/&]|and /i)[0].trim();
  return ST_ABBR[first] || (first.length === 2 ? first.toUpperCase() : "");
}

// ── Article resolution ───────────────────────────────────────────────────────
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/byway-wiki-map.json"), "utf8")).byId || {};
const ROADish = /State (Road|Route|Highway)|U\.?S\.? (Route|Highway)|Interstate|Parkway|Skyway|Highway \d|Route \d/i;
function resolveArticle(drive) {
  if (SEED[drive.id] && SEED[drive.id].road) return SEED[drive.id].road;
  // Never target a "List of …" index page — prefer the named road article, then
  // any non-list wiki entry, then a Wikipedia link, then the drive name.
  const wiki = (drive.wiki || []).filter((w) => !/^List of/i.test(w));
  const road = wiki.find((w) => ROADish.test(w)) || wiki[0];
  if (road) return road;
  if (drive.link && /en\.wikipedia\.org\/wiki\//.test(drive.link)) {
    return decodeURIComponent(drive.link.split("/wiki/")[1] || "").replace(/_/g, " ");
  }
  return (drive.wiki || [])[0] || drive.name;
}

async function fetchArticle(title) {
  const url = "https://en.wikipedia.org/w/api.php?action=parse&page=" + encodeURIComponent(title) +
    "&prop=text%7Csections%7Crevid%7Cdisplaytitle&format=json&formatversion=2&redirects=1";
  const j = await getJson(url, { soft: true, timeout: 25000 });
  if (!j) return { network: true };                       // real fetch/network failure → retry later
  if (j.error || !j.parse || !j.parse.text) return { missing: true }; // no such article title
  const displayTitle = clean(String(j.parse.displaytitle || "").replace(/<[^>]+>/g, "")); // displaytitle is HTML
  return { html: j.parse.text, sections: j.parse.sections || [], revid: j.parse.revid, title: displayTitle || title };
}

// When the exact title is missing, search Wikipedia for the byway's real article
// (many byways live under their underlying state/US route). Accept a hit only if it
// reads like a road AND shares a meaningful word with the byway name — never a blind
// top-result grab.
const STOP = new Set(["scenic", "byway", "historic", "national", "the", "of", "and", "trail", "road", "route", "highway", "drive", "state", "loop", "tour", "all-american"]);
async function searchArticle(name, drive) {
  const url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
    encodeURIComponent(name + " scenic byway") + "&srlimit=6&format=json&formatversion=2";
  const j = await getJson(url, { soft: true, timeout: 15000 });
  const hits = (j && j.query && j.query.search) || [];
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
  // Reject generic state-index pages ("Ohio Scenic Byway", "Minnesota Scenic Byways",
  // "List of …") — they aren't the byway's article and would misattribute the source.
  const stateNames = Object.keys(ST_ABBR).map((s) => s.toLowerCase());
  const isGenericIndex = (t) => /^List of/i.test(t) ||
    new RegExp("^(" + stateNames.join("|") + ")\\s+scenic\\s+byways?$", "i").test(t);
  for (const h of hits) {
    const t = h.title;
    if (isGenericIndex(t)) continue;
    const roadish = ROADish.test(t) || /Byway|Scenic|Trail|Drive|Parkway/i.test(t);
    // Must share a SPECIFIC name token (not just the state name) → avoids grabbing
    // an unrelated road that merely happens to be a byway.
    const shares = tokens.some((w) => !stateNames.includes(w) && t.toLowerCase().includes(w));
    if (roadish && shares) return t;
  }
  return null;
}

// ── Junction wikitable → normalized grid ─────────────────────────────────────
// Header roles we care about. A junction list has a milepost column AND a
// destinations/location column; that signature is how we pick the right table.
function headerRole(text) {
  const t = clean(text).toLowerCase().replace(/\[.*?\]/g, "").trim();
  if (/^county$/.test(t)) return "county";
  if (/^(location|city|town|place)$/.test(t)) return "location";
  if (/^mi\b|^mile|^milepost|^mp\b/.test(t) || t === "mi") return "mi";
  if (/^km\b/.test(t)) return "km";
  if (/^exit/.test(t)) return "exit";
  if (/destination|road|junction|route/.test(t)) return "destinations";
  if (/^note/.test(t)) return "notes";
  return null;
}

// Fill a table into a role-keyed grid, honoring rowspan/colspan (County/Location
// frequently span many rows). Returns { roles, rows }.
function tableToGrid($, table) {
  const trs = $(table).find("tr").toArray();
  if (!trs.length) return null;
  // Header: first row that is all/mostly <th> with a recognizable signature.
  let headIdx = 0, roles = [];
  for (let i = 0; i < Math.min(trs.length, 3); i++) {
    const cells = $(trs[i]).find("th,td").toArray();
    const r = cells.map((c) => headerRole($(c).text()));
    if (r.filter(Boolean).length >= 2) { headIdx = i; roles = r; break; }
  }
  if (!roles.length) return null;
  const ncol = roles.length;
  const has = (role) => roles.includes(role);
  if (!(has("mi") && (has("destinations") || has("location")))) return null;

  const carry = new Array(ncol).fill(null); // {value, left} per column for active rowspans
  const rows = [];
  for (let i = headIdx + 1; i < trs.length; i++) {
    const cells = $(trs[i]).find("th,td").toArray();
    // A single full-width cell = structural marker row (concurrency/terminus band).
    if (cells.length === 1) {
      const cs = parseInt($(cells[0]).attr("colspan") || "1", 10);
      if (cs >= ncol - 1) { rows.push({ _struct: clean($(cells[0]).text()) }); continue; }
    }
    const row = {}; let ci = 0; // pointer into `cells`
    for (let col = 0; col < ncol; col++) {
      const role = roles[col];
      if (carry[col] && carry[col].left > 0) { if (role) row[role] = carry[col].value; carry[col].left--; continue; }
      if (ci >= cells.length) continue;
      const cell = cells[ci++];
      const val = clean($(cell).text());
      const cs = parseInt($(cell).attr("colspan") || "1", 10);
      const rs = parseInt($(cell).attr("rowspan") || "1", 10);
      for (let k = 0; k < cs && col + k < ncol; k++) {
        const rk = roles[col + k];
        if (rk && row[rk] == null) row[rk] = val;
        if (rs > 1) carry[col + k] = { value: val, left: rs - 1 };
      }
      col += cs - 1;
    }
    if (Object.keys(row).length) rows.push(row);
  }
  return { roles, rows };
}

// Pick the best junction table on the page (highest row count among valid ones).
function bestJunctionGrid($) {
  let best = null;
  $("table.wikitable").each((_, t) => {
    const g = tableToGrid($, t);
    if (g && g.rows.length > (best ? best.rows.length : 1)) best = g;
  });
  return best;
}

// ── milepost parsing ─────────────────────────────────────────────────────────
function parseMi(s) {
  if (s == null) return null;
  const m = String(s).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g);
  if (!m) return null;
  return parseFloat(m[0]); // ranges "1.04–1.57" → take the low end
}

// ── Destinations cell → control cities (drop route shields) ──────────────────
function controlCities(dest) {
  let d = clean(dest);
  if (!d) return [];
  // "I-15 – Las Vegas, Cedar City" → keep the part after the en/em dash (the cities)
  const parts = d.split(/\s[–—-]\s/);
  const tail = parts.length > 1 ? parts.slice(1).join(" ") : d;
  return tail.split(/,|·|\//).map((x) => clean(x))
    .filter((x) => x && /^[A-Z]/.test(x)                                  // real place names start capitalized
      && !/^(?:I|US|SR|CR|SH|FM|WYO|Route|Hwy|Highway|Interstate)[-\s]?\d/i.test(x) // not a route shield
      && !/^(To|Toward|Via)$/i.test(x)
      && !/\b(gate|closure|parking|roundabout|elevation|weekend|entrance road)\b/i.test(x) // not a note fragment
      && !/\d{3,}/.test(x) && x.length > 1)
    .slice(0, 4);
}

const CROSSING_RE = /\b(bridge|river|pass|summit|gap|dam|lake|narrows|tunnel|ferry|strait|gorge|canyon)\b/i;
const CROSSING_NAME = /[A-Z][\w.'-]+(?: [A-Z][\w.'-]+)*? (?:Bridge|River|Pass|Summit|Gap|Dam|Lake|Narrows|Tunnel|Gorge|Canyon)/;
const PARK_NAME = /[A-Z][\w.'-]+(?: [A-Z][\w.'-]+)*? (?:National Park|State Park|National Monument|National Forest|National Recreation Area)/;
const PARK_RE = /\b(national park|state park|national monument|national forest|national recreation|wildlife refuge|visitor center|entrance)\b/i;
const TERMINUS_RE = /\bterminus\b/i;

// ── Raw junction rows → traveler itinerary + endpoints + highlight seeds ──────
function transform(grid, drive) {
  const stAb = primaryStateAbbr(drive.states);
  // 1) flatten struct rows into notes on the following/previous row context
  const rows = grid.rows.filter((r) => !r._struct || TERMINUS_RE.test(r._struct));
  // 2) attach mi + parse
  let seq = rows.map((r) => ({
    location: clean(r.location), county: clean(r.county),
    mi: parseMi(r.mi), destinations: clean(r.destinations),
    notes: clean(r.notes || r._struct || ""),
  }));
  // 3) descending milepost? reverse so distance grows along the drive.
  const withMi = seq.filter((r) => r.mi != null);
  let reversed = false;
  if (withMi.length >= 2 && withMi[0].mi > withMi[withMi.length - 1].mi) { seq.reverse(); reversed = true; }

  // 4) termini: first & last rows (or rows whose notes say "terminus")
  const fromRow = seq[0], toRow = seq[seq.length - 1];

  // 5) build stops — keep a row only if it names a real TOWN or is notable
  //    (park entrance / named crossing). County-line, interchange, and bare route
  //    junctions are structural noise → dropped from the traveler view.
  // A town Location must contain a real letter (some tables use a zero-width space
  // or a bare km value for continuation rows — those aren't towns, and letting them
  // pass hides the notable crossing the row actually describes). "…Junction" is a
  // legit town name (Mt. Carmel Junction); bare route junctions have a blank/route
  // Location and are dropped by the isTown/notable gate below.
  const looksTown = (loc) => loc && /[A-Za-z]/.test(loc) && !/\bline$/i.test(loc) && !/^interchange$/i.test(loc);
  const stops = [];
  for (const r of seq) {
    const control = controlCities(r.destinations);
    const isTown = looksTown(r.location);
    const notable = PARK_RE.test(r.destinations + " " + r.notes) || CROSSING_RE.test(r.notes) || CROSSING_RE.test(r.location || "");
    if (!isTown && !notable) continue; // structural row → skip
    let place = isTown ? r.location : "";
    if (!place) place = (r.notes.match(CROSSING_NAME) || r.destinations.match(PARK_NAME) || r.location.match(CROSSING_NAME) || [])[0] || "";
    if (!place || !/[A-Za-z]/.test(place)) continue; // no real place name → skip
    const key = place.toLowerCase();
    const prev = stops[stops.length - 1];
    if (prev && key && prev._key === key) { // same town again → merge
      prev.control = [...new Set([...prev.control, ...control])];
      if (!prev.note && notable) prev.note = friendlyNote(r, control);
      continue;
    }
    stops.push({ _key: key, place: place || (control[0] || ""), county: r.county, mi: r.mi, control, kind: kindOf(r, control), note: friendlyNote(r, control), _raw: r });
  }
  if (!stops.length) return null;

  // 6) mark termini kind + compute distances (termini always read begins/ends)
  stops[0].kind = "terminus"; stops[stops.length - 1].kind = "terminus";
  stops[0].note = "The drive begins here";
  stops[stops.length - 1].note = "The drive ends here";
  const itinerary = stops.map((s, i) => ({
    seq: i + 1, place: s.place, state: stAb, kind: s.kind,
    mileFromStart: s.mi != null ? Math.round(s.mi * 10) / 10 : null,
    toNextMi: null, note: s.note || "", control: s.control, lat: null, lng: null, src: "wikipedia",
  }));
  for (let i = 0; i < itinerary.length - 1; i++) {
    const a = itinerary[i].mileFromStart, b = itinerary[i + 1].mileFromStart;
    if (a != null && b != null && b >= a) itinerary[i].toNextMi = Math.round((b - a) * 10) / 10;
  }

  // 7) endpoints — real termini as "Place, ST" (Google Directions geocodes these),
  //    via = up to 3 evenly-spaced intermediate town stops so the line hugs the road.
  const nameFor = (s) => s && s.place ? (stAb ? s.place + ", " + stAb : s.place) : null;
  const mids = itinerary.slice(1, -1).filter((s) => s.place);
  const via = [];
  if (mids.length) { const step = Math.max(1, Math.floor(mids.length / 3)); for (let i = step - 1; i < mids.length && via.length < 3; i += step) via.push(nameFor(mids[i])); }
  const from = nameFor(itinerary[0]), to = nameFor(itinerary[itinerary.length - 1]);
  // A degenerate route (single town, or from==to) can't draw a line — drop endpoints.
  const endpoints = from && to && from.toLowerCase() !== to.toLowerCase() ? { from, to, via: via.filter(Boolean) } : null;

  // 8) highlight seeds — notable stops (parks/crossings/termini) + a couple marquee towns.
  const highlightSeeds = itinerary.filter((s) => s.kind === "park-entrance" || s.kind === "crossing" || s.kind === "terminus").slice(0, 6);

  return { itinerary, endpoints, highlightSeeds, reversed };
}

function kindOf(r, control) {
  const blob = (r.destinations || "") + " " + (r.notes || "") + " " + (r.location || "");
  if (PARK_RE.test(blob)) return "park-entrance";
  if (CROSSING_RE.test(r.notes || "") || CROSSING_RE.test(r.location || "")) return "crossing";
  return "town";
}
function friendlyNote(r, control) {
  const blob = (r.destinations || "") + " " + (r.notes || "");
  const park = blob.match(/\b([A-Z][\w.'-]+(?: [A-Z][\w.'-]+)*? (?:National Park|State Park|National Monument|National Forest|National Recreation Area))\b/);
  if (park) return "Gateway to " + park[1];
  const cross = (r.notes || "").match(new RegExp("\\b([A-Z][\\w.'-]+(?: [A-Z][\\w.'-]+)*? (?:Bridge|Pass|Summit|Gap|Dam|River|Narrows|Tunnel|Gorge))\\b"));
  if (cross) return "Crosses " + cross[1];
  if (control.length) return "Junction toward " + control.slice(0, 2).join(" & ");
  return "";
}

// ── History + references ─────────────────────────────────────────────────────
function parseHistory($, sections) {
  const has = sections.find((s) => /^history$/i.test(s.line));
  const sec = has ? "History" : (sections.find((s) => /^route description$/i.test(s.line)) ? "Route description" : null);
  if (!sec) return { paragraphs: [], sourceSection: null };
  // Headings render as <div class="mw-heading mw-heading2"><h2 id="History">…</h2></div>
  // (older markup: bare <h2> with a child <span id="History">). Find the id-bearer,
  // then its heading container.
  let head = $("#" + cssId(sec)).first();
  if (!head.length) { $("h2").each((_, h) => { if (!head.length && new RegExp("^" + sec + "$", "i").test(clean($(h).text()))) head = $(h); }); }
  if (!head.length) return { paragraphs: [], sourceSection: null };
  let container = head.closest(".mw-heading");
  if (!container.length) container = head.is("h2,h3,h4") ? head : head.closest("h2,h3,h4");
  if (!container.length) return { paragraphs: [], sourceSection: null };
  // Heading level of an element (via .mw-headingN wrapper or bare Hn tag), 0 if not a heading.
  const level = (el) => {
    if (el.hasClass && el.hasClass("mw-heading")) return el.hasClass("mw-heading2") ? 2 : el.hasClass("mw-heading3") ? 3 : el.hasClass("mw-heading4") ? 4 : 2;
    const t = (el.prop("tagName") || "").toUpperCase();
    return t === "H2" ? 2 : t === "H3" ? 3 : t === "H4" ? 4 : 0;
  };
  // Walk siblings collecting <p>. Stop at the next section of EQUAL/HIGHER level
  // (History's own H3 subsections are part of History — walk through them).
  const paras = [];
  for (let el = container.next(); el.length; el = el.next()) {
    const lvl = level(el);
    if (lvl && lvl <= 2) break; // next top-level section → done
    if ((el.prop("tagName") || "").toUpperCase() === "P") {
      const t = clean(el.text());
      if (t && t.length > 40) paras.push(t);
    }
    if (paras.length >= 4) break;
  }
  return { paragraphs: paras.slice(0, 4), sourceSection: sec };
}
const cssId = (s) => s.replace(/ /g, "_").replace(/[^\w-]/g, "");

function parseReferences($, limit = 8) {
  const out = [];
  $("ol.references li").each((_, li) => {
    if (out.length >= limit) return;
    const $li = $(li);
    $li.find("style, .mw-cite-backlink").remove(); // drop TemplateStyles CSS + back-arrows
    const text = clean($li.find(".reference-text").text() || $li.text());
    if (!text || text.length < 8 || /\.mw-parser-output|\{[^}]*\}/.test(text)) return; // skip CSS blobs
    let url = $li.find("a.external").first().attr("href") || "";
    if (url.startsWith("//")) url = "https:" + url;
    out.push({ n: out.length + 1, text: text.slice(0, 280), url });
  });
  return out;
}

// ── Geocoding: Wikipedia coordinates first (precise, license-free, covers towns
//    AND named landmarks that have an article), USGS GNIS ArcGIS as fallback. ──
let geoCache = {};
try { geoCache = JSON.parse(fs.readFileSync(GEO_CACHE, "utf8")); } catch {}
function geoKey(name, st) { return (name + "|" + (st || "")).toLowerCase(); }

async function wikiCoords(title) {
  const url = "https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=" + encodeURIComponent(title) +
    "&format=json&formatversion=2&redirects=1&colimit=1";
  const j = await getJson(url, { soft: true, timeout: 12000 });
  const pages = j && j.query && j.query.pages;
  const co = pages && pages[0] && pages[0].coordinates && pages[0].coordinates[0];
  return co ? { lat: co.lat, lng: co.lon } : null;
}
async function gnisCoords(name, stName, biasLat, biasLng) {
  // ArcGIS GNIS populated-places (layer 1 incorporated, 3 populated) name search.
  for (const layer of [1, 3]) {
    const params = new URLSearchParams({
      where: "gaz_name = '" + name.replace(/'/g, "''") + "'" + (stName ? " AND state_name = '" + stName + "'" : ""),
      outFields: "gaz_name", returnGeometry: "true", outSR: "4326", resultRecordCount: "50", f: "json",
    });
    const j = await getJson("https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/" + layer + "/query?" + params, { soft: true });
    const feats = (j && j.features) || [];
    let best = null, bestD = Infinity;
    for (const f of feats) {
      const g = f.geometry || {}; if (g.x == null) continue;
      const d = biasLat != null ? distMi(biasLat, biasLng, g.y, g.x) : 0;
      if (d < bestD) { bestD = d; best = { lat: g.y, lng: g.x }; }
    }
    if (best) return best;
  }
  return null;
}
async function geocode(name, st, biasLat, biasLng) {
  if (!name) return null;
  const key = geoKey(name, st);
  if (key in geoCache) return geoCache[key];
  const stName = ST_NAME[st] || "";
  let hit = null;
  // Try Wikipedia article coords: "<name>, <State>" then "<name>"
  if (stName) hit = await wikiCoords(name + ", " + stName);
  if (!hit) hit = await wikiCoords(name);
  // GNIS fallback for plain towns
  if (!hit) hit = await gnisCoords(name, stName, biasLat, biasLng);
  // sanity: within ~250mi of the drive centroid, else reject (wrong-place match)
  if (hit && biasLat != null && distMi(biasLat, biasLng, hit.lat, hit.lng) > 250) hit = null;
  geoCache[key] = hit;
  return hit;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const all = parseArr("public/byways-data.js", "window.BYWAYS_DATA");
const only = (process.env.PB_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const tiers = (process.env.PB_TIER || "all-american").split(",").map((s) => s.trim()).filter(Boolean);
let targets = only.length ? all.filter((d) => only.includes(d.id)) : all.filter((d) => tiers.includes(d.tier));
console.log(`Byway ingest: ${targets.length} drives ${only.length ? "(PB_ONLY)" : "(tiers: " + tiers.join(",") + ")"}\n`);

fs.mkdirSync(DETAIL_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });
const endpointPatch = {}; // id → endpoints, merged into byways-data.js at the end
const flags = [];
let enriched = 0;

await pool(targets, async (drive) => {
  // Incremental: skip drives already enriched (idempotent resume after transient
  // fetch failures). PB_FORCE=1 re-fetches everything (e.g. after a parser change).
  const outPath = path.join(DETAIL_DIR, drive.id + ".json");
  if (!process.env.PB_FORCE && fs.existsSync(outPath)) { enriched++; return; }
  let article = resolveArticle(drive);
  try {
    let art = await fetchArticle(article);
    if (art && art.missing) {                       // wrong/absent title → search for the real one
      const found = await searchArticle(drive.name, drive);
      if (found) { article = found; art = await fetchArticle(found); }
    }
    if (!art || art.network) { flags.push("FETCH FAILED (transient): " + drive.name + " (" + article + ")"); return; }
    if (art.missing) { flags.push("NO ARTICLE: " + drive.name + " (" + article + ")"); return; }
    const $ = load(art.html);
    const grid = bestJunctionGrid($);
    const history = parseHistory($, art.sections);
    const references = parseReferences($);
    const attribution = {
      license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      articleUrl: "https://en.wikipedia.org/wiki/" + encodeURIComponent(article.replace(/ /g, "_")),
      text: 'Route, junction, and history details adapted from the Wikipedia article "' + art.title + '", by Wikipedia contributors, licensed under CC BY-SA 4.0.',
    };
    const sources = [{ name: "Wikipedia", src: "wikipedia", url: attribution.articleUrl, revisionId: art.revid, retrievedAt: RUN_TS }];
    if (drive.parkCode) sources.push({ name: "National Park Service", src: "nps", url: "https://www.nps.gov/" + drive.parkCode, retrievedAt: RUN_TS });
    sources.push({ name: "Federal Highway Administration — National Scenic Byways", src: "fhwa", url: "https://www.fhwa.dot.gov/byways", retrievedAt: RUN_TS });

    let itinerary = [], endpoints = null, highlights = [];
    if (grid) {
      const t = transform(grid, drive);
      if (t) {
        itinerary = t.itinerary; endpoints = t.endpoints;
        if (t.reversed) flags.push("DESCENDING MILEPOST reversed: " + drive.name);
        // geocode itinerary stops (sequential — respectful to the APIs, results cached)
        for (const s of itinerary) { const c = await geocode(s.place, s.state, drive.lat, drive.lng); if (c) { s.lat = c.lat; s.lng = c.lng; } }
        // Milepost sanity snap: a park / large-feature name (e.g. a terminus at
        // "Yellowstone National Park") geocodes to the whole area's centroid, which
        // can sit tens of miles off the actual road point. If a stop lands absurdly
        // far from its milepost-adjacent geocoded neighbor (straight-line ≫ the
        // milepost gap — impossible on a road), snap it onto that neighbor.
        const nearestGeo = (i, dir) => { for (let j = i + dir; j >= 0 && j < itinerary.length; j += dir) { if (itinerary[j].lat != null) return itinerary[j]; } return null; };
        for (let i = 0; i < itinerary.length; i++) {
          const s = itinerary[i]; if (s.lat == null || s.mileFromStart == null) continue;
          const nb = nearestGeo(i, i === itinerary.length - 1 ? -1 : 1) || nearestGeo(i, -1);
          if (!nb || nb.mileFromStart == null) continue;
          if (distMi(s.lat, s.lng, nb.lat, nb.lng) > Math.abs(nb.mileFromStart - s.mileFromStart) * 2 + 5) {
            s.lat = nb.lat; s.lng = nb.lng; s.snapped = true;
            flags.push(`GEOCODE snapped to road (${s.place}): ${drive.name}`);
          }
        }
        // Start/end the route line on the corrected road point (a snapped terminus's
        // name would still geocode Google Directions to the wrong centroid).
        if (endpoints) {
          const f = itinerary[0], l = itinerary[itinerary.length - 1];
          if (f && f.snapped && f.lat != null) endpoints.from = f.lat + "," + f.lng;
          if (l && l.snapped && l.lat != null) endpoints.to = l.lat + "," + l.lng;
        }
        // highlights = notable stops that resolved to a coordinate
        highlights = t.highlightSeeds.map((s) => ({ n: s.place, d: s.note || "A landmark on the route", q: s.place, lat: s.lat, lng: s.lng, src: "wikipedia" }))
          .filter((h) => h.lat != null);
        const unresolved = itinerary.filter((s) => s.lat == null).length;
        if (unresolved) flags.push(`${unresolved}/${itinerary.length} stops ungeocoded: ${drive.name}`);
      }
    } else {
      flags.push("NO JUNCTION TABLE: " + drive.name + " (" + article + ")");
    }
    if (!history.paragraphs.length) flags.push("NO HISTORY: " + drive.name);

    const record = {
      id: drive.id, generatedAt: RUN_TS,
      designation: drive.tier === "all-american" ? "All-American Road" : drive.tier === "landmark" ? "National Historic Landmark" : "National Scenic Byway",
      parkCode: drive.parkCode || null,
      source: { roadArticle: art.title, revisionId: art.revid, url: attribution.articleUrl },
      attribution, sources,
      endpoints: endpoints && endpoints.from && endpoints.to ? endpoints : null,
      itinerary,
      history: { paragraphs: history.paragraphs, sourceSection: history.sourceSection, src: "wikipedia" },
      highlights,
      references,
    };
    fs.writeFileSync(path.join(DETAIL_DIR, drive.id + ".json"), JSON.stringify(record));
    // Merge endpoints into the light index — GAP-FILL ONLY (never clobber curated).
    if (record.endpoints && !drive.endpoints) endpointPatch[drive.id] = record.endpoints;
    enriched++;
    console.log(`  ✓ ${drive.id}  ${itinerary.length ? itinerary.length + " stops" : "no table"}${history.paragraphs.length ? ", history" : ""}${record.endpoints ? ", route" : ""}`);
  } catch (e) {
    flags.push("ERROR: " + drive.name + " — " + (e.message || e));
  }
}, 2);

// Persist geocode cache + merge endpoints into public/byways-data.js
fs.writeFileSync(GEO_CACHE, JSON.stringify(geoCache, null, 0));
if (Object.keys(endpointPatch).length) mergeEndpoints(endpointPatch);

console.log(`\n✓ enriched ${enriched}/${targets.length} · endpoints merged: ${Object.keys(endpointPatch).length}`);
flags.forEach((f) => console.log("  ⚠ " + f));

function mergeEndpoints(patch) {
  const arr = parseArr("public/byways-data.js", "window.BYWAYS_DATA");
  let n = 0;
  for (const d of arr) { if (patch[d.id] && !d.endpoints) { d.endpoints = patch[d.id]; n++; } }
  const raw = fs.readFileSync(BYWAYS_FILE, "utf8");
  const m = raw.match(/(window\.BYWAYS_DATA\s*=\s*)(\[[\s\S]*?\])(;)/);
  const out = raw.slice(0, m.index) + m[1] + JSON.stringify(arr) + m[3] + raw.slice(m.index + m[0].length);
  fs.writeFileSync(BYWAYS_FILE, out);
  console.log(`  · byways-data.js: +${n} endpoints`);
}
