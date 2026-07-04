// Park Buddy — LIVE road status for a scenic drive, from the NPS alerts feed.
// GET /api/roadstatus?parkCode=glac&road=Going-to-the-Sun Road
//   → { state, label, alerts:[...], updated }
//
// We deliberately do NOT hardcode per-segment open/closed states — those go
// stale within hours and would be dishonest. Instead we read the park's live
// NPS alerts and surface the ones that mention the road, deriving an honest
// overall read (open / caution / closure). Always points to the official page.

export const runtime = "nodejs";
export const revalidate = 900; // road alerts change through the day

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parkCode = (searchParams.get("parkCode") || "").trim().toLowerCase();
  const road = (searchParams.get("road") || "").trim();
  if (!parkCode) return Response.json({ state: "unknown", alerts: [] });

  const key = process.env.NPS_API_KEY || (process.env.NETLIFY ? "" : "DEMO_KEY");
  if (!key) return Response.json({ state: "unknown", alerts: [], degraded: true }, { status: 503 });

  try {
    const r = await fetch(
      "https://developer.nps.gov/api/v1/alerts?parkCode=" + encodeURIComponent(parkCode) + "&limit=50&api_key=" + encodeURIComponent(key),
      { headers: { "User-Agent": "ParkBuddy/1.0" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) }
    );
    if (!r.ok) return Response.json({ state: "unknown", alerts: [], degraded: true }, { status: 503 });
    const d = await r.json();
    const all = d.data || [];

    // Road-relevant: mentions the specific road, or the words road/pass/closed/
    // highway/parkway. Fall back to closures/cautions if the road name isn't hit.
    const roadWords = /road|pass|highway|parkway|drive|closed|closure/i;
    const named = road ? new RegExp(road.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const relevant = all.filter((a) => {
      const t = (a.title || "") + " " + (a.description || "");
      return (named && named.test(t)) || roadWords.test(t);
    }).slice(0, 6).map((a) => ({
      title: a.title || "",
      category: a.category || "Information", // Danger | Caution | Park Closure | Information
      description: (a.description || "").replace(/<[^>]*>/g, "").slice(0, 240),
      url: a.url || "",
    }));

    // Derive an honest overall state from alert severity.
    let state = "open";
    if (relevant.some((a) => a.category === "Park Closure" || /closed|closure/i.test(a.title))) state = "closed";
    else if (relevant.some((a) => a.category === "Danger" || a.category === "Caution")) state = "caution";
    const label = state === "closed" ? "Closures reported" : state === "caution" ? "Open · advisories in effect" : "No closures reported";

    return Response.json({ state, label, alerts: relevant, credit: "Road status: National Park Service alerts (live)." });
  } catch {
    return Response.json({ state: "unknown", alerts: [], degraded: true }, { status: 503 });
  }
}
