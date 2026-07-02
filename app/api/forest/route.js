// Park Buddy — national-forest (and other federal land) DETAIL from Recreation.gov / RIDB.
// GET /api/forest?name=White River National Forest&lat=..&lng=..
//   → activities, rec areas and campgrounds that actually sit INSIDE the forest, plus a
//     description/directions when a matching rec area exists.
//
// Why geo, not name: RIDB does NOT store whole forests as rec areas — it stores the specific
// recreation areas within them (Maroon Bells, Hanging Lake…). Searching by the forest name
// returns nothing, so we search by LOCATION and aggregate what's there. Needs RIDB_API_KEY.
// Credit: Recreation.gov / RIDB (U.S. Forest Service, BLM & partner agencies).

export const runtime = "nodejs";
export const revalidate = 86400;

const BASE = "https://ridb.recreation.gov/api/v1";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
function clean(s, n) { return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 400); }
function normName(s) { return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, ""); }

async function ridb(path, params, key) {
  try {
    const url = BASE + path + "?" + new URLSearchParams(params).toString();
    const r = await fetch(url, { headers: { apikey: key, accept: "application/json" }, next: { revalidate: 86400 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(request) {
  const key = process.env.RIDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim();
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (!key) return Response.json({ found: false, note: "RIDB_API_KEY not configured" });
  if (lat == null || lng == null) return Response.json({ error: "lat/lng required" }, { status: 400 });

  const geo = { latitude: lat, longitude: lng, radius: "60" };

  // Rec areas INSIDE the forest (by location), full=true for activities + descriptions.
  const [recD, campD] = await Promise.all([
    ridb("/recareas", { ...geo, limit: "50", full: "true" }, key),
    ridb("/facilities", { ...geo, activity: "9", limit: "60" }, key), // activity 9 = camping
  ]);

  const recList = (recD && recD.RECDATA) || [];
  const target = normName(name);

  // A rec area that matches the forest name gives us the best description/directions/links.
  const primary = recList.find((r) => normName(r.RecAreaName) === target)
    || recList.find((r) => target && normName(r.RecAreaName).indexOf(target) >= 0)
    || null;

  // Aggregate the activity types available across all rec areas in the forest.
  const actSet = {};
  recList.forEach((r) => (r.ACTIVITY || []).forEach((a) => { const n = a.ActivityName; if (n) actSet[n] = 1; }));
  const activities = Object.keys(actSet).slice(0, 20);

  // Rec areas as "points of interest" — nearest / most complete first.
  const seenR = {};
  const recAreas = recList
    .map((r) => ({ name: r.RecAreaName, description: clean(r.RecAreaDescription, 160), url: r.RecAreaID ? "https://www.recreation.gov/gateways/" + r.RecAreaID : "" }))
    .filter((r) => { if (!r.name) return false; const k = r.name.toLowerCase(); if (seenR[k]) return false; seenR[k] = 1; return true; })
    .slice(0, 12);

  // Campgrounds inside the forest.
  const seenC = {};
  const campgrounds = ((campD && campD.RECDATA) || [])
    .filter((f) => /camp/i.test((f.FacilityTypeDescription || "") + " " + (f.FacilityName || "")))
    .map((f) => ({ name: f.FacilityName, description: clean(f.FacilityDescription, 180), reservable: !!f.Reservable, url: f.FacilityID ? "https://www.recreation.gov/camping/campgrounds/" + f.FacilityID : "" }))
    .filter((c) => { if (!c.name) return false; const k = c.name.toLowerCase(); if (seenC[k]) return false; seenC[k] = 1; return true; })
    .slice(0, 12);

  const links = ((primary && primary.LINK) || []).map((l) => ({ title: l.Title, url: l.URL, type: l.LinkType })).filter((l) => l.url);
  const official = (links.find((l) => /official|home|web/i.test(l.type + " " + l.title)) || links[0] || {}).url || "";

  const found = !!(activities.length || recAreas.length || campgrounds.length || primary);

  return Response.json({
    found,
    name: (primary && primary.RecAreaName) || name,
    description: primary ? clean(primary.RecAreaDescription, 700) : "",
    directions: primary ? clean(primary.RecAreaDirections, 500) : "",
    phone: (primary && (primary.RecAreaPhone || "")).trim(),
    official,
    activities,
    recAreas,
    campgrounds,
    credit: "Recreation.gov / RIDB — U.S. Forest Service & partner agencies.",
  });
}
