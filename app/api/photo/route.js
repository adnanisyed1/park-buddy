// Park Buddy — a representative PHOTO (and short extract) for any destination, from
// Wikipedia / Wikimedia Commons. GET /api/photo?name=White River National Forest
//   → { found, image, thumb, extract, pageUrl, credit }
//
// NPS parks get their photos from the NPS API; this covers everything else (national
// forests, state parks) so the hero isn't a blank placeholder. FREE, no key.
// Wikipedia REST content is CC BY-SA / public domain — always shown with credit.

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
  if (!d) return Response.json({ found: false });

  const image = (d.originalimage && d.originalimage.source) || (d.thumbnail && d.thumbnail.source) || "";
  if (!image) return Response.json({ found: false });

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
