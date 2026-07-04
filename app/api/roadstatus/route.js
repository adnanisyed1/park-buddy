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

    const norm = (a) => ({
      title: a.title || "",
      category: a.category || "Information", // Danger | Caution | Park Closure | Information
      description: (a.description || "").replace(/<[^>]*>/g, "").slice(0, 240),
      url: a.url || "",
    });
    // Prefer alerts that mention THIS road by name — an unrelated campground or
    // trail closure shouldn't drive the road's status. Only if none name the
    // road do we fall back to generic road-word alerts.
    const named = road ? new RegExp(road.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const roadWords = /\b(road|pass|highway|parkway|drive)\b/i;
    const nameHits = named ? all.filter((a) => named.test((a.title || "") + " " + (a.description || ""))) : [];
    const source = nameHits.length ? nameHits : all.filter((a) => roadWords.test((a.title || "") + " " + (a.description || "")));
    const relevant = source.slice(0, 6).map(norm);

    // Honest state from NPS CATEGORY (authoritative), not title keywords: a
    // "Park Closure" alert about the road means closed; Danger/Caution means
    // advisories; Information (even if it says "…Closures" elsewhere) does not
    // close the road.
    let state = "open";
    if (relevant.some((a) => a.category === "Park Closure")) state = "closed";
    else if (relevant.some((a) => a.category === "Danger" || a.category === "Caution")) state = "caution";
    const label = state === "closed" ? "Closures reported on the road" : state === "caution" ? "Open · advisories in effect" : (relevant.length ? "Open · see notices" : "No closures reported");

    return Response.json({ state, label, alerts: relevant, credit: "Road status: National Park Service alerts (live)." });
  } catch {
    return Response.json({ state: "unknown", alerts: [], degraded: true }, { status: 503 });
  }
}
