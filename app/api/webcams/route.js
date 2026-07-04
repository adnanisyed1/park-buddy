// Park Buddy — LIVE National Park Service webcams for a park unit.
// GET /api/webcams?parkCode=romo → { webcams: [{title, pageUrl, lat, lng, ...}] }
//
// These are the NPS's own real cameras (Longs Peak, Alpine Visitor Center, …) —
// the one genuinely REAL-TIME view of conditions that exists. We surface the
// listing and deep-link to NPS's own live player page rather than re-hosting
// frames. Server-side NPS_API_KEY (same as /api/photo's NPS fallback);
// DEMO_KEY keeps local dev working at a low rate limit.

export const runtime = "nodejs";
export const revalidate = 3600; // the camera LIST barely changes; the feeds themselves live on nps.gov

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parkCode = (searchParams.get("parkCode") || "").trim().toLowerCase();
  if (!parkCode) return Response.json({ error: "parkCode required" }, { status: 400 });

  const key = process.env.NPS_API_KEY || "DEMO_KEY";
  try {
    const r = await fetch(
      "https://developer.nps.gov/api/v1/webcams?parkCode=" + encodeURIComponent(parkCode) + "&limit=50&api_key=" + encodeURIComponent(key),
      { headers: { "User-Agent": "ParkBuddy/1.0" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) }
    );
    if (!r.ok) return Response.json({ webcams: [] });
    const d = await r.json();
    const webcams = (d.data || [])
      .filter((w) => w.status === "Active")
      .map((w) => ({
        title: w.title || "Webcam",
        pageUrl: w.url || "",
        lat: num(w.latitude),
        lng: num(w.longitude),
        isStreaming: !!w.isStreaming,
        description: (w.description || "").slice(0, 220),
        img: (w.images && w.images[0] && w.images[0].url) || "",
      }))
      .filter((w) => w.pageUrl);
    return Response.json({ webcams, credit: "Webcams: National Park Service (live feeds on nps.gov)." });
  } catch {
    return Response.json({ webcams: [] });
  }
}
