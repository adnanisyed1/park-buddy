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

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2012-08-29 11:59:27" (or richer HTML-wrapped forms) -> "Aug 2012"; null if unparseable.
function captureDate(extmetadata) {
  const raw = (extmetadata && extmetadata.DateTimeOriginal && extmetadata.DateTimeOriginal.value) || "";
  const m = String(raw).match(/(\d{4})-(\d{2})/);
  if (!m) return null;
  const mo = parseInt(m[2], 10);
  return mo >= 1 && mo <= 12 ? MONTHS[mo - 1] + " " + m[1] : m[1];
}

// GEO fallback: a real photograph TAKEN AT these coordinates, from Wikimedia
// Commons' geosearch (geotagged files, nearest first). For the huge majority of
// trails/lakes/towns with no Wikipedia article of their own, this returns an
// actual photo of the spot instead of nothing. Marked geo:true + photoDate so
// the UI labels it honestly (a real photo, not a live view). CC-licensed;
// pageUrl links to the file page for attribution.
async function geoPhoto(lat, lng) {
  for (const radius of [3000, 10000]) {
    try {
      const params = new URLSearchParams({
        action: "query", format: "json", generator: "geosearch",
        ggscoord: lat + "|" + lng, ggsradius: String(radius), ggslimit: "12", ggsnamespace: "6",
        prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "960",
      });
      const r = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
        headers: { "User-Agent": "ParkBuddy/1.0 (park status)" },
        next: { revalidate: 604800 },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const pages = Object.values((d.query && d.query.pages) || {})
        .sort((a, b) => (a.index ?? 99) - (b.index ?? 99)); // generator index = distance order
      for (const p of pages) {
        const ii = p.imageinfo && p.imageinfo[0];
        const full = ii && ii.url;
        if (!full || badFile(full)) continue;
        return {
          found: true,
          image: full,
          thumb: ii.thumburl || full,
          extract: "",
          pageUrl: ii.descriptionurl || "",
          title: (p.title || "").replace(/^File:/, ""),
          credit: "Photo: Wikimedia Commons contributors (CC), taken near this spot.",
          geo: true,
          photoDate: captureDate(ii.extmetadata),
        };
      }
    } catch {
      /* try wider radius / give up */
    }
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim();
  const state = (searchParams.get("state") || "").trim();
  // `q` = caller-supplied pipe-separated candidate titles, tried first in order
  // (e.g. "Longs Peak|Rocky Mountain National Park"). Lets callers steer the
  // lookup toward a nearby named feature that actually has a good photo.
  const q = (searchParams.get("q") || "").trim();
  // Optional coordinates: enables the geotagged-Commons fallback when no
  // name-based photo exists (most trails, small lakes, towns).
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (!name && !q && lat == null) return Response.json({ error: "name, q, or lat/lng required" }, { status: 400 });

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
    // Then: a real geotagged photo taken at the coordinates, if the caller gave any.
    if (lat != null && lng != null) {
      const gp = await geoPhoto(lat, lng);
      if (gp) return Response.json(gp);
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
