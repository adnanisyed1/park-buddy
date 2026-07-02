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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim();
  const state = (searchParams.get("state") || "").trim();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  // Try the exact name, then a state-qualified variant (helps disambiguate common names).
  const tries = [name];
  if (state) tries.push(name + " (" + state + ")");
  // A few state parks are titled "<Name> State Park" already; a bare-name fallback helps others.
  if (/national forest|state park/i.test(name)) tries.push(name.replace(/s$/i, ""));

  let d = null;
  for (const t of tries) {
    d = await summary(t);
    if (d && (d.originalimage || d.thumbnail)) break;
    d = null;
  }

  const image = d ? (d.originalimage && d.originalimage.source) || (d.thumbnail && d.thumbnail.source) || "" : "";
  if (!image) {
    // Wikipedia had nothing — for national parks, fall back to the official NPS photo.
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
