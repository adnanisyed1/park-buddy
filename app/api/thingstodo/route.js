// Park Buddy — the NPS's own curated "Things to Do" for a park unit.
// GET /api/thingstodo?parkCode=romo → { items: [{title, short, img, url, ...}] }
//
// Real, ranger-curated activities (with NPS photos and detail pages) — not
// generated filler. Same server-side key handling as /api/webcams.

export const runtime = "nodejs";
export const revalidate = 21600; // curated content — refresh a few times a day

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parkCode = (searchParams.get("parkCode") || "").trim().toLowerCase();
  if (!parkCode) return Response.json({ error: "parkCode required" }, { status: 400 });

  const key = process.env.NPS_API_KEY || "DEMO_KEY";
  try {
    const r = await fetch(
      "https://developer.nps.gov/api/v1/thingstodo?parkCode=" + encodeURIComponent(parkCode) + "&limit=30&api_key=" + encodeURIComponent(key),
      { headers: { "User-Agent": "ParkBuddy/1.0" }, next: { revalidate: 21600 }, signal: AbortSignal.timeout(9000) }
    );
    if (!r.ok) return Response.json({ items: [] });
    const d = await r.json();
    const items = (d.data || [])
      .map((t) => ({
        title: (t.title || "").trim(),
        short: (t.shortDescription || "").replace(/<[^>]*>/g, "").slice(0, 160),
        img: (t.images && t.images[0] && t.images[0].url) || "",
        url: t.url || "",
        duration: (t.duration || "").trim() || null,
        lat: num(t.latitude),
        lng: num(t.longitude),
        activities: (t.activities || []).map((a) => a.name).filter(Boolean).slice(0, 3),
        reservation: t.isReservationRequired === "true" || t.isReservationRequired === true,
      }))
      .filter((t) => t.title && t.url);
    return Response.json({ items, credit: "Things to do: National Park Service." });
  } catch {
    return Response.json({ items: [] });
  }
}
