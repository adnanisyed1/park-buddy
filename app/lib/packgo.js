// Pack & Go — generate a trip-aware packing/prep checklist from the real trip, plus a
// light "describe your trip" parser. Ported from the legacy public/checklist.js so the
// smart checklist survives in the React app. Items are { cat, label, why } where cat is
// one of "pack" (at home) / "grab" (on the way) / "do" (at the destination).
//
// The "describe your trip" bar currently uses these keyword rules (offline, deterministic);
// wiring it to the server agent (/api/agent) for free-form generation is the next step.

export const CATS = [
  ["pack", "🎒", "Pack before you leave"],
  ["grab", "🛒", "Grab on the way"],
  ["do", "📍", "Do at the destination"],
];

// Park-specific knowledge (matched on the stop name) — the things first-timers forget.
const PARK_TIPS = {
  zion: { pack: ["Water shoes for the Narrows", "Quick-dry layers"], grab: ["Extra water — desert heat"], do: ["Reserve an Angels Landing permit", "Ride the canyon shuttle (no cars)"] },
  yosemite: { pack: ["Bear canister for food", "Layers — valley vs high country"], do: ["Half Dome permit (if hiking)", "Catch the valley shuttle"] },
  yellowstone: { pack: ["Bear spray", "Warm layers — weather swings fast"], do: ["Stay 100 yds from wildlife", "Time an Old Faithful eruption"] },
  teton: { pack: ["Bear spray", "Binoculars for wildlife"], do: ["Sunrise at Schwabacher Landing"] },
  "grand canyon": { pack: ["1 gal water per person/day", "Sun hat & high-SPF"], do: ["Watch sunset from the rim", "Don't try rim-to-rim unprepared"] },
  arches: { pack: ["Lots of water", "Sun protection — no shade"], do: ["Delicate Arch at golden hour"] },
  bryce: { pack: ["Warm layers — 8,000 ft & cold", "Traction in shoulder season"], do: ["Sunrise at Sunrise Point"] },
  glacier: { pack: ["Bear spray", "Rain shell"], do: ["Drive Going-to-the-Sun Road early"] },
  rocky: { pack: ["Altitude meds / hydrate", "Afternoon rain shell"], do: ["Timed-entry reservation", "Hike early — afternoon storms"] },
  "great smoky": { pack: ["Rain shell — wettest park", "Bug spray"], do: ["Cades Cove loop at dawn"] },
  "joshua tree": { pack: ["Tons of water", "Headlamp for stargazing"], do: ["Stay for the dark-sky stars"] },
  acadia: { pack: ["Layers & wind shell"], do: ["Sunrise on Cadillac Mountain (reserve)"] },
  olympic: { pack: ["Rain shell", "Layers for 3 ecosystems"], do: ["Tide-pool at low tide"] },
  sequoia: { pack: ["Bear canister", "Layers — elevation swings"], do: ["Stand under General Sherman"] },
};

// Build a starter checklist from the trip's stops (+ season from the start month).
export function generateFromTrip(stops = [], monthIdx = null) {
  const out = [];
  const add = (cat, label, why) => out.push({ cat, label, why: why || "" });
  add("pack", "Water — ~1 L per person per hour", "Every park");
  add("pack", "Layers + a rain shell", "Mountain weather swings");
  add("pack", "Sun protection: hat, sunscreen, sunglasses", "");
  add("pack", "First-aid kit + any medications", "");
  add("pack", "Offline maps downloaded", "No signal in most parks");
  add("pack", "Headlamp / flashlight", "");
  add("grab", "America the Beautiful pass", "Covers park entry");
  add("grab", "Snacks & a cooler", "");
  add("grab", "Cash for small gateway towns", "");
  (stops || []).forEach((s) => {
    const name = (s.name || "").toLowerCase();
    const key = Object.keys(PARK_TIPS).find((k) => name.includes(k));
    if (!key) return;
    const t = PARK_TIPS[key];
    ["pack", "grab", "do"].forEach((c) => (t[c] || []).forEach((label) => add(c, label, s.name)));
  });
  if (monthIdx != null) {
    if ([11, 0, 1].includes(monthIdx)) add("pack", "Insulated layers & traction", "Winter conditions");
    else if ([5, 6, 7].includes(monthIdx)) add("pack", "Extra water & electrolytes", "Summer heat");
  }
  return dedupe(out);
}

// Turn a free-form Pack & Go line into items. TWO MODES, and we DEFAULT to taking the
// user literally (add exactly what they named). We only EXPAND a request into a kit when
// they describe a GOAL/activity ("I want to bake a cake", "camping with a baby").
//
// Food / consumables you'd buy on the way → the "Grab" section.
const FOOD_RE = /\b(chicken|meat|beef|pork|steak|fish|shrimp|bacon|sausage|hot ?dogs?|burgers?|marinad\w*|food|snacks?|meals?|bread|buns?|eggs?|milk|cheese|butter|sugar|flour|salt|pepper|spice\w*|oil|rice|pasta|cereal|coffee|tea|beer|wine|soda|ice|drinks?|juice|fruit|veg\w*|salad|produce|charcoal|propane|firewood|s'?mores|marshmallows?|chips|jerky|oatmeal|granola|water)\b/i;
// Things you do / arrange → the "Do" section.
const DO_RE = /\b(permits?|reserv\w*|book\w*|licen\w*|tickets?|passes?|register|confirm|download|call)\b/i;
function categorizeItem(s) { if (FOOD_RE.test(s)) return "grab"; if (DO_RE.test(s)) return "do"; return "pack"; }
function titleCaseItem(s) { return s.replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()); }

// Signals that the user is describing a GOAL/activity to expand into items, rather than
// naming items to add. Phrasing ("I want to…", "for our…", "when we…") OR an activity verb.
const GOAL_RE = /\b(i wanna|i want|i'?d like|we want|we'?d like|i'?m going|we'?re going|going to|gonna|planning|plan to|so (i|we) can|for (a|my|our)|when (i|we)|need everything|everything (i|we) need|ingredients? for|help me|what (do|should)|trip|weekend|vacation|getaway|road ?trip|picnic|cookout|bbq|barbecue)\b/i;
const ACTIVITY_RE = /\b(bak\w+|cook\w+|grill\w*|camp\w*|hik\w*|trek\w+|backpack\w*|fish\w*|ski\w*|snowshoe\w*|climb\w*|paddl\w*|kayak\w*|canoe\w*|stargaz\w*|photograph\w*|birdwatch\w*)\b/i;
// A short phrase ending in a concrete gear noun is a NAMED ITEM ("trekking poles",
// "fishing rod", "camping stove"), not an activity to expand — take it literally.
const GEAR_NOUN_RE = /\b(poles?|rods?|reels?|gear|boots?|bags?|tent|stove|lantern|headlamp|helmet|harness|rope|skis?|paddle|waders?|gloves?|jacket|knife|cooler)\b/i;

export function parseDescription(text) {
  // Strip conversational wrappers so "please add sugar to my checklist" → "sugar".
  const raw = (text || "").trim()
    .replace(/^\s*(hey\s+|ok\s+|please\s+|can you\s+|could you\s+|i wanna\s+add\s+|i want to add\s+|add\s+)+/i, "")
    .replace(/\s+to (my|the)\s+(pack\s*&?\s*go\s*)?(check\s*list|list|pack list)\s*$/i, "")
    .trim();
  const t = " " + raw.toLowerCase() + " ";
  const out = [];
  const a = (cat, label, why) => out.push({ cat, label, why: why || "From your description" });

  const namedGear = raw.split(/\s+/).filter(Boolean).length <= 3 && GEAR_NOUN_RE.test(raw);
  const isGoal = !namedGear && (GOAL_RE.test(raw) || ACTIVITY_RE.test(raw));

  // MODE 1 — the user NAMED item(s): add exactly those, verbatim. This is the default and
  // it WINS over keyword interpretation (so "trekking poles" adds the poles, not a kit).
  if (!isGoal && raw) {
    const items = raw.split(/,|;|\band\b|&|\/|\+/i).map((s) => s.trim()).filter(Boolean);
    (items.length ? items : [raw]).forEach((it) => a(categorizeItem(it), titleCaseItem(it), "You added this"));
    return out;
  }

  // MODE 2 — the user described a GOAL/activity: expand it into the items it needs.
  if (/(bak\w+|cake|cupcake|cookies?|brownies?|dessert|pie)\b/.test(t)) { a("grab", "Flour, sugar & eggs"); a("grab", "Butter & baking basics"); a("pack", "Baking pan & mixing bowl"); }
  if (/(baby|babies|toddler|infant|kids?|children)/.test(t)) { a("pack", "Diapers / wipes & kid snacks"); a("pack", "Carrier or kid backpack"); }
  if (/(cookout|bbq|barbecue|grill|cook|camp meal)/.test(t)) { a("grab", "Charcoal / propane & lighter"); a("pack", "Grill grate & utensils"); }
  if (/(camp|tent|sleep)/.test(t)) { a("pack", "Tent, sleeping bag & pad"); a("pack", "Headlamp"); }
  if (/(hik|trail|trek|backpack)/.test(t)) { a("pack", "Day pack & first-aid kit"); a("grab", "Water & trail snacks"); }
  if (/(dog|pet)/.test(t)) { a("pack", "Pet leash, food & water bowl"); a("do", "Check pet rules for each park"); }
  if (/(photo|camera|stargaz|astro)/.test(t)) { a("pack", "Camera, batteries & headlamp"); a("do", "Scout a dark-sky spot"); }
  if (/(fish)/.test(t)) { a("pack", "Fishing gear"); a("do", "Buy a fishing license"); }
  if (/(rain|wet|storm)/.test(t)) { a("pack", "Rain shell & dry bags"); }
  if (/(cold|snow|winter|ski)/.test(t)) { a("pack", "Insulated layers & traction"); }
  if (/(hot|desert|summer|heat)/.test(t)) { a("pack", "Extra water & sun protection"); }
  if (!out.length) { a("pack", "Snacks, water & layers"); a("do", "Note one must-do for the trip"); }
  return out;
}

function dedupe(items) {
  const seen = new Set(), out = [];
  for (const i of items) { const k = i.label.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(i); } }
  return out;
}
