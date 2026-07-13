// Live park alerts for the landing ticker — pulls the NPS /alerts feed (closures,
// hazards, caution notices) and pairs each with its park's real name. Key comes from
// NPS_API_KEY (Vercel); DEMO_KEY keeps local dev working. Cached at the edge.
const BASE = "https://developer.nps.gov/api/v1";
export const revalidate = 900; // 15 min

// Graceful fallback so the ticker is never empty (shown if NPS is unconfigured/down).
const FALLBACK = [
  { park: "Yellowstone", text: "Caution · watch for bison on the road", category: "Caution" },
  { park: "Rocky Mountain", text: "Info · timed-entry reservations in effect", category: "Information" },
  { park: "Glacier", text: "Caution · Going-to-the-Sun plowing underway", category: "Caution" },
  { park: "Yosemite", text: "Info · Firefall window · reservations required", category: "Information" },
];

const RANK = { "Park Closure": 0, Danger: 1, Caution: 2, Information: 3 };

export async function GET(request) {
  const key = process.env.NPS_API_KEY || ((process.env.NETLIFY || process.env.VERCEL) ? "" : "DEMO_KEY");
  const debug = new URL(request.url).searchParams.get("debug");
  const headers = { "X-Api-Key": key || "", "User-Agent": "ParkBuddy" };
  const getJSON = async (url) => { try { const r = await fetch(url, { headers, next: { revalidate: 900 } }); return r.ok ? await r.json() : null; } catch { return null; } };

  if (!key) return Response.json({ alerts: FALLBACK, live: false, ...(debug ? { reason: "no NPS_API_KEY" } : {}) });

  const feed = await getJSON(BASE + "/alerts?limit=200");
  const rows = (feed && Array.isArray(feed.data)) ? feed.data : [];
  if (!rows.length) return Response.json({ alerts: FALLBACK, live: false, ...(debug ? { npsReturned: 0 } : {}) });

  // Resolve parkCode → full name in one bulk request.
  const codes = [...new Set(rows.map((a) => a.parkCode).filter(Boolean))].slice(0, 100);
  const parksResp = await getJSON(BASE + "/parks?limit=" + codes.length + "&fields=fullName&parkCode=" + codes.join(","));
  const nameByCode = {};
  ((parksResp && parksResp.data) || []).forEach((p) => { if (p.parkCode) nameByCode[p.parkCode] = p.fullName; });

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const isNP = (code) => / National Park\b/.test(nameByCode[code] || ""); // flagship 63 read best in the ticker
  const alerts = rows
    .filter((a) => a.parkCode && nameByCode[a.parkCode] && a.title)
    .sort((a, b) => (isNP(b.parkCode) - isNP(a.parkCode)) || ((RANK[a.category] ?? 4) - (RANK[b.category] ?? 4)))
    .slice(0, 18)
    .map((a) => ({
      park: nameByCode[a.parkCode].replace(/ National Park.*$| National Monument.*$| National Recreation Area.*$/,'').trim() || nameByCode[a.parkCode],
      text: (a.category ? a.category + " · " : "") + clean(a.title).slice(0, 90),
      category: a.category || "",
      url: a.url || "",
    }));

  return Response.json({ alerts: alerts.length ? alerts : FALLBACK, live: alerts.length > 0, ...(debug ? { npsReturned: rows.length, resolved: alerts.length } : {}) });
}
