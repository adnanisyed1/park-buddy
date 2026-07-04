// Park Buddy — a representative PHOTO (and short extract) for any destination.
// GET /api/photo?name=Zion National Park&state=UT
//   → { found, image, thumb, extract, pageUrl, credit }
//
// Primary source: Wikipedia / Wikimedia Commons (FREE, no key, CC BY-SA — credited).
// For national parks, if Wikipedia has no image we fall back to the official NPS
// photo via the NPS API using the SERVER-SIDE NPS_API_KEY (never exposed to the
// browser). This replaces the old client-side "paste your NPS key" flow.

export const runtime = "nodejs";
export const revalidate = 604800; // a week — lead images rarely change

async function summary(title) {
  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title) + "?redirect=true";
    const r = await fetch(url, { headers: { accept: "application/json", "User-Agent": "ParkBuddy/1.0 (park status)" }, next: { revalidate: 604800 } });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.type === "disambiguation") return null;
    return d;
  } catch {
    return null;
  }
}

// Official NPS photo — national parks only, server-side key.
async function npsPhoto(name) {
  const key = process.env.NPS_API_KEY;
  if (!key) return null;
  try {
    const q = name.replace(/\s+national park.*/i, "").trim() || name;
    const r = await fetch("https://developer.nps.gov/api/v1/parks?q=" + encodeURIComponent(q) + "&limit=1&api_key=" + encodeURIComponent(key), {
      headers: { "User-Agent": "ParkBuddy/1.0" }, next: { revalidate: 604800 },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const hit = data && data.data && data.data[0];
    const img = hit && hit.images && hit.images[0] && hit.images[0].url;
    return img
      ? { found: true, image: img, thumb: img, extract: (hit.description || "").slice(0, 600), pageUrl: hit.url || "", title: hit.fullName || name, credit: "Photo: National Park Service (NPS.gov)." }
      : null;
  } catch {
    return null;
  }
}

// Reject images that aren't real photos — Wikipedia summaries sometimes lead
// with a locator map, logo, seal, flag, or a vector/animated file. Callers want
// a representative PHOTO, so skip these and fall through to the next candidate.
function badFile(u) {
  const f = (u || "").split("/").pop() || "";
  return /\.(gif|svg)(\?|$)/i.test(u || "") || /map|locator|logo|diagram|seal|flag|icon/i.test(f);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim();
  const state = (searchParams.get("state") || "").trim();
  // `q` = caller-supplied pipe-separated candidate titles, tried first in order
  // (e.g. "Longs Peak|Rocky Mountain National Park"). Lets callers steer the
  // lookup toward a nearby named feature that actually has a good photo.
  const q = (searchParams.get("q") || "").trim();
  if (!name && !q) return Response.json({ error: "name or q required" }, { status: 400 });

  // Caller candidates first, then variants of `name` for disambiguation.
  const tries = q ? q.split("|").map((s) => s.trim()).filter(Boolean) : [];
  if (name) tries.push(name);
  if (state) tries.push(name + " (" + state + ")");
  // Singular variant: "… National Forests" → "… National Forest".
  if (/national forests$/i.test(name)) tries.push(name.replace(/forests$/i, "Forest"));
  // A few state parks are titled "<Name> State Park" already; a bare-name fallback helps others.
  if (/state park/i.test(name)) tries.push(name.replace(/s$/i, ""));
  // Combined/administrative forest names — e.g. "Arapaho and Roosevelt National
  // Forests", "Grand Mesa, Uncompahgre and Gunnison National Forests",
  // "Medicine Bow-Routt National Forest" — rarely have one Wikipedia page. Fall
  // back to each constituent forest (first with an image wins).
  const fm = name.match(/^(.*?)\s+National Forests?$/i);
  if (fm) {
    fm[1].split(/,|\s+and\s+|–|-/).map((s) => s.trim()).filter(Boolean).forEach((part) => tries.push(part + " National Forest"));
  }
  // De-dupe while preserving order.
  const seenTry = new Set();
  const queue = tries.filter((t) => t && !seenTry.has(t.toLowerCase()) && seenTry.add(t.toLowerCase()));

  let d = null, image = "";
  for (const t of queue) {
    const s = await summary(t);
    const img = s ? (s.originalimage && s.originalimage.source) || (s.thumbnail && s.thumbnail.source) || "" : "";
    if (img && !badFile(img)) { d = s; image = img; break; }
  }

  if (!image) {
    // Wikipedia had nothing usable — for national parks, fall back to the official NPS photo.
    if (/national park/i.test(name)) {
      const nps = await npsPhoto(name);
      if (nps) return Response.json(nps);
    }
    return Response.json({ found: false });
  }

  return Response.json({
    found: true,
    image,
    thumb: (d.thumbnail && d.thumbnail.source) || image,
    extract: (d.extract || "").slice(0, 600),
    pageUrl: (d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page) || "",
    title: d.title || name,
    credit: "Photo: Wikimedia Commons / Wikipedia (CC BY-SA).",
  });
}
