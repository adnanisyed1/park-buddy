// GET /api/climate?lat=..&lng=..  → what each MONTH is typically like here.
//
// The owner's ask was "forecast for the entire year". Nobody can forecast a
// year — pretending otherwise would poison the page's honesty — but for trip
// planning the real question is "what is October like here", and that has a
// truthful answer: averages over five years of actual observations (ERA5 via
// Open-Meteo's archive — free, keyless, and the reading above matched lived
// reality: Ouachita July high 92°F).
//
// Climate barely moves, so this is cached hard: per-coordinate in memory for
// the process lifetime plus ISR on the upstream fetch.
export const runtime = "nodejs";
export const revalidate = 2592000; // 30 days

const CACHE = new Map(); // "lat,lng" -> body

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = num(searchParams.get("lat"));
  const lng = num(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  const key = lat.toFixed(2) + "," + lng.toFixed(2);
  if (CACHE.has(key)) return Response.json(CACHE.get(key));

  // Five COMPLETE calendar years ending last year — never the running year,
  // whose half-finished months would drag their averages toward whichever
  // seasons have happened so far.
  const endYear = new Date().getFullYear() - 1;
  const startYear = endYear - 4;
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lng),
    start_date: startYear + "-01-01", end_date: endYear + "-12-31",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    temperature_unit: "fahrenheit",
    timezone: "auto",
  });
  try {
    const r = await fetch("https://archive-api.open-meteo.com/v1/archive?" + p.toString(), {
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return Response.json({ months: [], credit: "Open-Meteo / ERA5" }, { status: 200 });
    const data = await r.json();
    const d = data.daily || {};
    const time = d.time || [];
    const acc = Array.from({ length: 12 }, () => ({ hi: 0, lo: 0, n: 0, wet: 0 }));
    for (let i = 0; i < time.length; i++) {
      const m = parseInt(time[i].slice(5, 7), 10) - 1;
      const hi = d.temperature_2m_max[i], lo = d.temperature_2m_min[i], pr = d.precipitation_sum[i];
      if (!isFinite(hi) || !isFinite(lo)) continue;
      acc[m].hi += hi; acc[m].lo += lo; acc[m].n++;
      if (isFinite(pr) && pr >= 1) acc[m].wet++; // >=1mm = a day you'd call wet
    }
    const years = endYear - startYear + 1;
    const months = acc.map((a, i) => ({
      m: MONTHS[i],
      hi: a.n ? Math.round(a.hi / a.n) : null,
      lo: a.n ? Math.round(a.lo / a.n) : null,
      wetDays: a.n ? Math.round(a.wet / years) : null, // typical wet days per month
    }));
    const body = { months, years: startYear + "–" + endYear, credit: "Open-Meteo / ERA5 reanalysis" };
    CACHE.set(key, body);
    return Response.json(body);
  } catch {
    return Response.json({ months: [], credit: "Open-Meteo / ERA5" }, { status: 200 });
  }
}
