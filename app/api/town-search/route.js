// GET /api/town-search?q=este — name search over EVERY gateway town that has
// a page (~3,200, from gateway-ranked via towns.js). Powers the Explore
// typeahead's "Gateway towns" group (owner call 2026-07-22: every town must
// be searchable). The town list is built once per process and indexed
// lowercase; a query costs a linear scan of 3k strings — microseconds.
import { allTowns } from "../../lib/towns";

export const runtime = "nodejs";

let INDEX = null; // [{ name, stateShort, slug, lat, lng, serves }]
function index() {
  if (INDEX) return INDEX;
  INDEX = allTowns().map((t) => ({
    name: t.name,
    st: t.stateShort,
    slug: t.slug,
    lat: t.coords && t.coords[0] ? t.coords[0][0] : null,
    lng: t.coords && t.coords[0] ? t.coords[0][1] : null,
    serves: (t.serves || []).slice(0, 2).map((s) => s.name),
    lower: (t.name + " " + t.stateShort).toLowerCase(),
  }));
  return INDEX;
}

export async function GET(request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return Response.json({ towns: [] });
  const starts = [], contains = [];
  for (const t of index()) {
    const at = t.lower.indexOf(q);
    if (at === 0) starts.push(t);
    else if (at > 0) contains.push(t);
    if (starts.length >= 8) break;
  }
  const out = [...starts, ...contains].slice(0, 8)
    .map(({ lower, ...t }) => t);
  return Response.json({ towns: out }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
