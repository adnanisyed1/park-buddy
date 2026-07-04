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

  // Same key policy as /api/webcams: DEMO_KEY locally; the real deployment
  // (NETLIFY env var) without NPS_API_KEY fails loudly and uncached.
  const key = process.env.NPS_API_KEY || (process.env.NETLIFY ? "" : "DEMO_KEY");
  if (!key) {
    console.error("[thingstodo] NPS_API_KEY missing in production");
    return Response.json({ items: [], degraded: true }, { status: 503 });
  }
  try {
    const r = await fetch(
      "https://developer.nps.gov/api/v1/thingstodo?parkCode=" + encodeURIComponent(parkCode) + "&limit=30&api_key=" + encodeURIComponent(key),
      { headers: { "User-Agent": "ParkBuddy/1.0" }, next: { revalidate: 21600 }, signal: AbortSignal.timeout(9000) }
    );
    // Upstream failure ≠ "this park has nothing to do" — 503 so it isn't cached as empty.
    if (!r.ok) return Response.json({ items: [], degraded: true }, { status: 503 });
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
    return Response.json({ items: [], degraded: true }, { status: 503 });
  }
}
