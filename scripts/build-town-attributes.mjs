// What each town actually IS — the gate, and the attributes the UI shows.
//
// Boundary distance told us Vail is in White River NF and Gypsum isn't. It does
// not tell us that Vail has forty places to sleep and Gypsum has none, and that
// is the difference between a basecamp and a town you drive through.
//
// THIS DOES NOT RANK. It counts things and writes them down. The gate is binary
// and objective — a real settlement, somewhere to sleep or eat, inside the
// boundary radius — and it exists to remove "La Barranca Colorada" and the GNIS
// ghost towns, not to decide that Vail beats Ouray. That judgement stays with a
// human, or with the reader sorting the list themselves.
//
//   node scripts/build-town-attributes.mjs                 # every ranked town
//   node scripts/build-town-attributes.mjs --limit 40      # a sample
//
// Reads app/lib/gateway-ranked.json, writes app/lib/town-attributes.json.
// Overpass is rate-limited and run by volunteers: one request at a time, a real
// pause between them, two mirrors, and a cache so a re-run costs nothing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = path.join(ROOT, "app/lib/gateway-ranked.json");
const OUT = path.join(ROOT, "app/lib/town-attributes.json");
const CACHE = path.join(ROOT, "scripts/.cache/town-osm.json");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const RADIUS_M = 3000;          // a town centre, not its county
const PAUSE_MS = 1400;          // be a good citizen
const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Categories are deliberately coarse. Fine-grained tagging varies enormously by
// region, and a category that only exists where mappers are keen would smuggle
// mapping density into what looks like a fact about the place.
const CATS = {
  lodging: (t) => /^(hotel|motel|guest_house|hostel|chalet|apartment|alpine_hut|wilderness_hut)$/.test(t.tourism || ""),
  food: (t) => /^(restaurant|cafe|bar|pub|fast_food|biergarten)$/.test(t.amenity || ""),
  outfitter: (t) =>
    /^(sports|outdoor|ski|bicycle|fishing|hunting)$/.test(t.shop || "") ||
    /^(ski_rental|bicycle_rental)$/.test(t.amenity || ""),
  culture: (t) => /^(museum|gallery|artwork|attraction|viewpoint)$/.test(t.tourism || "") || !!t.historic,
  groceries: (t) => /^(supermarket|convenience|general)$/.test(t.shop || ""),
};
// Character tags — present or absent, never scored.
const TAGS = {
  ski: (t) => !!t.aerialway || t.landuse === "winter_sports" || /piste/.test(Object.keys(t).join(",")),
  "hot springs": (t) => t.natural === "hot_spring" || t.amenity === "public_bath" || /hot.?spring/i.test(t.name || ""),
  historic: (t) => t.historic === "district" || t.historic === "town",
  brewery: (t) => t.craft === "brewery" || t.microbrewery === "yes",
};

function q(lat, lng) {
  const a = `(around:${RADIUS_M},${lat},${lng})`;
  return `[out:json][timeout:60];(
    nwr${a}["tourism"];
    nwr${a}["amenity"~"^(restaurant|cafe|bar|pub|fast_food|biergarten|ski_rental|bicycle_rental|public_bath)$"];
    nwr${a}["shop"~"^(sports|outdoor|ski|bicycle|fishing|hunting|supermarket|convenience|general)$"];
    nwr${a}["historic"];
    nwr${a}["aerialway"];
    nwr${a}["natural"="hot_spring"];
    nwr${a}["craft"="brewery"];
    node${a}["place"];
  );out tags;`;
}

async function overpass(body, tries = 3) {
  for (let a = 0; a < tries; a++) {
    const url = MIRRORS[a % MIRRORS.length];
    try {
      const r = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(body),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ParkBuddy/1.0 (basecamp town attributes)" },
        signal: AbortSignal.timeout(75000),
      });
      if (r.status === 429 || r.status === 504) throw new Error("busy " + r.status);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (a === tries - 1) throw e;
      await sleep(3000 * (a + 1));
    }
  }
}

// Significance order. Taking the FIRST place node in the response tagged Fort
// Collins — a city of 170,000 — as a "neighbourhood", because a neighbourhood
// node happened to come back first. Within 3km of a town centre there are
// usually several place nodes; the biggest one is the town.
const PLACE_RANK = ["city", "town", "village", "borough", "municipality", "hamlet",
  "suburb", "quarter", "neighbourhood", "locality", "isolated_dwelling", "farm"];

function summarise(elements) {
  const counts = Object.fromEntries(Object.keys(CATS).map((k) => [k, 0]));
  const tags = new Set();
  const places = [];
  for (const el of elements) {
    const t = el.tags || {};
    // Only settlement values. Durango came back tagged place=county, because a
    // county node sits within 3km of the town centre — and "county" then became
    // the town's own type.
    if (t.place && PLACE_RANK.includes(t.place)) {
      places.push({ place: t.place, name: t.name || "", population: /^\d+$/.test(t.population || "") ? Number(t.population) : null });
    }
    for (const [k, fn] of Object.entries(CATS)) if (fn(t)) counts[k]++;
    for (const [k, fn] of Object.entries(TAGS)) if (fn(t)) tags.add(k);
  }
  places.sort((a, b) => {
    const ra = PLACE_RANK.indexOf(a.place), rb = PLACE_RANK.indexOf(b.place);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
  });
  const best = places[0] || {};
  return {
    place: best.place || "",
    population: best.population ?? null,
    // kept so the choice can be re-derived without another Overpass round trip
    placeCandidates: places.slice(0, 6),
    counts, tags: [...tags],
  };
}

// THE GATE. Binary and boring on purpose.
//   · has to be a settlement people live in — not a locality, not a GNIS ghost
//   · has to have somewhere to sleep, or enough food that staying nearby works
// Everything else about the town is reported, not judged.
function passes(a) {
  // Deny-list, not allow-list. Nederland is tagged "hamlet" and has 4 places to
  // sleep and 13 to eat — an allow-list of city/town/village threw it out, which
  // is exactly the kind of real basecamp this is supposed to find. Only exclude
  // tags that mean "nobody lives here".
  const notASettlement = /^(locality|isolated_dwelling|farm|allotments|plot)$/.test(a.place || "");
  if (notASettlement) return false;

  const hasBeds = a.counts.lodging >= 1;
  const hasFood = a.counts.food >= 3;

  // A missing place node is usually a GNIS ghost — but not always. Farmington NM
  // (~46k people, 6 hotels, 72 restaurants) has no place node within 3km of the
  // stored coordinate, and dropping it was plainly wrong. The place tag is only a
  // PROXY for "people live here"; a town's amenities are direct evidence. So
  // strong amenities stand on their own.
  if (!a.place) return a.counts.lodging >= 3 && a.counts.food >= 5;

  return hasBeds || hasFood;
}

async function main() {
  if (!fs.existsSync(IN)) {
    console.error("Missing app/lib/gateway-ranked.json — run build-town-distances.mjs first.");
    process.exit(1);
  }
  const ranked = JSON.parse(fs.readFileSync(IN, "utf8")).places;
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};

  // One town can serve several places — fetch it once.
  const uniq = new Map();
  for (const [placeId, towns] of Object.entries(ranked)) {
    for (const t of towns) {
      const key = `${t.name}|${t.lat.toFixed(3)},${t.lng.toFixed(3)}`;
      if (!uniq.has(key)) uniq.set(key, { ...t, key, places: [] });
      uniq.get(key).places.push(placeId);
    }
  }
  const list = [...uniq.values()].slice(0, LIMIT);
  console.log(`towns to describe: ${list.length} (${uniq.size} unique across ${Object.keys(ranked).length} places)`);

  let fetched = 0, cached = 0, failed = 0;
  for (const t of list) {
    if (cache[t.key]) { cached++; continue; }
    try {
      const d = await overpass(q(t.lat, t.lng));
      cache[t.key] = summarise(d.elements || []);
      fetched++;
      process.stdout.write(".");
      fs.writeFileSync(CACHE, JSON.stringify(cache));   // checkpoint — Overpass will fail eventually
      await sleep(PAUSE_MS);
    } catch (e) {
      failed++;
      process.stdout.write("!");
      await sleep(4000);
    }
  }
  console.log(`\nfetched ${fetched}, cached ${cached}, failed ${failed}`);

  const towns = {};
  for (const t of list) {
    const a = cache[t.key];
    if (!a) continue;
    towns[t.key] = {
      name: t.name, lat: t.lat, lng: t.lng,
      serves: t.places,
      place: a.place || null,
      population: a.population,
      counts: a.counts,
      tags: a.tags,
      // Reported, not ranked. The UI sorts by distance-to-boundary by default.
      passes: passes(a),
    };
  }
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), radiusM: RADIUS_M, towns }, null, 0));

  const kept = Object.values(towns).filter((t) => t.passes).length;
  console.log(`gate: ${kept} pass / ${Object.keys(towns).length} described`);
  console.log(`wrote -> app/lib/town-attributes.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
