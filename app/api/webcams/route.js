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

  // DEMO_KEY is a LOCAL convenience only (30 req/hr shared quota) — on the
  // real deployment (NETLIFY env var present) a missing NPS_API_KEY fails
  // loudly (503, uncached, logged) instead of silently degrading every park
  // page to a rate-limited shared key. NODE_ENV can't tell local `npm start`
  // apart from Netlify, so gate on the platform var instead.
  const key = process.env.NPS_API_KEY || (process.env.NETLIFY ? "" : "DEMO_KEY");
  if (!key) {
    console.error("[webcams] NPS_API_KEY missing in production");
    return Response.json({ webcams: [], degraded: true }, { status: 503 });
  }
  try {
    const r = await fetch(
      "https://developer.nps.gov/api/v1/webcams?parkCode=" + encodeURIComponent(parkCode) + "&limit=50&api_key=" + encodeURIComponent(key),
      { headers: { "User-Agent": "ParkBuddy/1.0" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) }
    );
    // Upstream failure ≠ "this park has no webcams" — 503 so it isn't cached as empty.
    if (!r.ok) return Response.json({ webcams: [], degraded: true }, { status: 503 });
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
    return Response.json({ webcams: [], degraded: true }, { status: 503 });
  }
}
