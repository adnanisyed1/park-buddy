// Park Buddy — LIVE road status for a scenic drive, from real government feeds.
// GET /api/roadstatus?road=...&lat=..&lng=..&season=..&states=..&parkCode=..
//   → { state, label, alerts:[{title,category,description,url,source}], season, credit, sources:[] }
//
// We never hardcode per-segment open/closed states (they go stale in hours and
// would be dishonest). Instead we merge live, authoritative sources:
//   • NPS alerts        — for byways inside a national park (parkCode). Free key.
//   • NWS / weather.gov — active driving-hazard alerts at the road's point. Free,
//                         no key: winter storms, ice, high wind, floods, fog…
//   • State DOT "511"   — real closures/conditions, per state (key-gated hook).
//   • Seasonal open/close — passed through from the byway record.
// …and derive one honest overall read (open / caution / closed).

export const runtime = "nodejs";
export const revalidate = 900; // conditions change through the day

const UA = { "User-Agent": "ParkBuddy/1.0 (road status; contact adnansyed899@gmail.com)" };
async function getJSON(url, opts = {}) {
  try {
    const r = await fetch(url, { headers: { ...UA, ...(opts.headers || {}) }, next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── NPS alerts (park byways) ─────────────────────────────────────────────────
async function npsAlerts(parkCode, road) {
  const key = process.env.NPS_API_KEY || ((process.env.NETLIFY || process.env.VERCEL) ? "" : "DEMO_KEY");
  if (!key) return { state: null, alerts: [] };
  const d = await getJSON("https://developer.nps.gov/api/v1/alerts?parkCode=" + encodeURIComponent(parkCode) + "&limit=50&api_key=" + encodeURIComponent(key));
  if (!d) return { state: null, alerts: [] };
  const all = d.data || [];
  const named = road ? new RegExp(road.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const roadWords = /\b(road|pass|highway|parkway|drive)\b/i;
  const nameHits = named ? all.filter((a) => named.test((a.title || "") + " " + (a.description || ""))) : [];
  const src = nameHits.length ? nameHits : all.filter((a) => roadWords.test((a.title || "") + " " + (a.description || "")));
  const alerts = src.slice(0, 6).map((a) => ({ title: a.title || "", category: a.category || "Information", description: (a.description || "").replace(/<[^>]*>/g, "").slice(0, 240), url: a.url || "", source: "NPS" }));
  let state = "open";
  if (alerts.some((a) => a.category === "Park Closure")) state = "closed";
  else if (alerts.some((a) => a.category === "Danger" || a.category === "Caution")) state = "caution";
  return { state, alerts };
}

// ── NWS active weather alerts (everywhere, free) ─────────────────────────────
// Only the events that actually affect DRIVING a road / mountain pass.
const DRIVE_EVENT = /winter storm|blizzard|ice storm|snow squall|lake effect|freezing|wind chill|high wind|wind advisory|dense fog|flood|fire weather|red flag|avalanche|hard freeze|winter weather|heavy snow|ice/i;
async function nwsAlerts(lat, lng) {
  const d = await getJSON("https://api.weather.gov/alerts/active?point=" + lat + "," + lng, { headers: { Accept: "application/geo+json" } });
  const feats = (d && d.features) || [];
  const alerts = [];
  let worst = 0; // 0 open, 1 caution, 2 severe
  for (const f of feats) {
    const p = f.properties || {};
    const ev = p.event || "Alert";
    if (!DRIVE_EVENT.test(ev)) continue;
    // A "Warning" is an active road hazard → caution. "Watch"/"Advisory" is a
    // heads-up → listed as a notice but the road stays open. (Severity alone
    // over-flags: NWS marks even a Fire Weather Watch "Severe".)
    const isWarn = /warning/i.test(ev);
    worst = Math.max(worst, isWarn ? 2 : 1);
    alerts.push({ title: ev, category: isWarn ? "Caution" : "Advisory", description: (p.headline || p.description || "").replace(/<[^>]*>/g, "").slice(0, 240), url: "https://www.weather.gov/", source: "NWS", expires: p.expires || p.ends || "" });
    if (alerts.length >= 6) break;
  }
  // Only WARNING-level hazards flip the road to caution; watches/advisories are
  // listed as notices but the road stays "open · see notices".
  return { state: worst >= 2 ? "caution" : "open", alerts };
}

// ── State DOT 511 (real closures/conditions) — key-gated hook ────────────────
// Every state runs its own 511 system; most need a free registered API key. Add
// keys as env vars to light these up (MDT_API_KEY, WYDOT_API_KEY, …). Without a
// key the hook is a no-op, so the endpoint still works everywhere on NWS + NPS.
async function dotAlerts(states) {
  const out = [];
  const list = (states || "").split(/[·,/&]| and /i).map((s) => s.trim().toLowerCase());
  if (list.some((s) => /montana|^mt$/.test(s)) && process.env.MDT_API_KEY) {
    // scaffold: shape a real MDT roadreport call here once the key is provisioned
  }
  if (list.some((s) => /wyoming|^wy$/.test(s)) && process.env.WYDOT_API_KEY) {
    // scaffold: WYDOT CARS / 511 events call here once the key is provisioned
  }
  return { state: null, alerts: out };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parkCode = (searchParams.get("parkCode") || "").trim().toLowerCase();
  const road = (searchParams.get("road") || "").trim();
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const season = (searchParams.get("season") || "").trim();
  const states = (searchParams.get("states") || "").trim();

  const jobs = [];
  if (parkCode) jobs.push(npsAlerts(parkCode, road).then((r) => ({ ...r, src: "NPS" })));
  if (Number.isFinite(lat) && Number.isFinite(lng)) jobs.push(nwsAlerts(lat, lng).then((r) => ({ ...r, src: "NWS" })));
  if (states) jobs.push(dotAlerts(states).then((r) => ({ ...r, src: "DOT" })));

  const results = (await Promise.allSettled(jobs)).filter((r) => r.status === "fulfilled").map((r) => r.value);
  const alerts = results.flatMap((r) => r.alerts || []);
  const sources = [];
  if (results.some((r) => r.src === "NPS")) sources.push("National Park Service");
  if (results.some((r) => r.src === "NWS")) sources.push("National Weather Service");
  if (results.some((r) => r.src === "DOT" && r.alerts && r.alerts.length)) sources.push("State DOT 511");

  const RANK = { closed: 3, caution: 2, open: 1 };
  let state = "open";
  let any = false;
  for (const r of results) if (r.state) { any = true; if ((RANK[r.state] || 0) > (RANK[state] || 0)) state = r.state; }
  if (!any) state = "unknown";

  const label = state === "closed" ? "Closures reported on the road"
    : state === "caution" ? "Open · weather advisories in effect"
    : state === "open" ? (alerts.length ? "Open · see notices" : "No closures or hazards reported")
    : (season ? "Seasonal road" : "Status unavailable — see official page");

  const credit = sources.length ? "Live from " + sources.join(" · ") + "." : "";
  return Response.json({ state, label, alerts, season, credit, sources });
}
