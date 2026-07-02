// Next.js App Router Route Handler — replaces the old Netlify function (netlify/functions/nps.js).
// Your secret NPS key is read from the NPS_API_KEY environment variable (set in Vercel),
// NEVER shipped to the browser. The page calls /api/nps?name=Yosemite ; this adds the key.

const BASE = "https://developer.nps.gov/api/v1";

export const revalidate = 900; // cache responses for 15 min at the edge

export async function GET(request) {
  const key = process.env.NPS_API_KEY;
  const { searchParams } = new URL(request.url);
  const headers = { "X-Api-Key": key || "", "User-Agent": "ParkPulse" };

  const getJSON = async (url) => {
    try {
      const r = await fetch(url, { headers, next: { revalidate: 900 } });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  };

  // Safe diagnostic: /api/nps?debug=1
  if (searchParams.get("debug")) {
    let npsStatus = "not tested (no key set)";
    if (key) {
      try {
        const r = await fetch(BASE + "/parks?limit=1", { headers });
        npsStatus = r.status;
      } catch (e) {
        npsStatus = "fetch error: " + (e.message || e);
      }
    }
    return Response.json({ keyDetected: !!key, keyLength: key ? key.length : 0, npsStatus });
  }

  if (!key) {
    return Response.json(
      { error: "NPS_API_KEY is not set in the project environment variables." },
      { status: 500 }
    );
  }

  const name = (searchParams.get("name") || "").trim();
  let parkCode = (searchParams.get("parkCode") || "").trim().toLowerCase();

  try {
    const fields =
      "images,operatingHours,entranceFees,entrancePasses,contacts,addresses,designation,activities,directionsInfo,weatherInfo";
    let park = null;
    if (!parkCode && name) {
      const d = await getJSON(BASE + "/parks?limit=8&q=" + encodeURIComponent(name) + "&fields=" + fields);
      const list = (d && d.data) || [];
      const lc = name.toLowerCase();
      park =
        list.find((p) => (p.fullName || "").toLowerCase().includes(lc)) ||
        list.find((p) => (p.name || "").toLowerCase() === lc) ||
        list[0] ||
        null;
      parkCode = park ? park.parkCode : "";
    } else if (parkCode) {
      const d = await getJSON(BASE + "/parks?parkCode=" + encodeURIComponent(parkCode) + "&fields=" + fields);
      park = (d && d.data && d.data[0]) || null;
    }
    if (!parkCode) {
      return Response.json({ parkCode: "", park: null, alerts: [], thingsToDo: [], campgrounds: [], visitorCenters: [] });
    }

    const pc = encodeURIComponent(parkCode);
    const [alertsD, tdD, cgD, vcD, evD, nrD, plD] = await Promise.all([
      getJSON(BASE + "/alerts?limit=15&parkCode=" + pc),
      getJSON(BASE + "/thingstodo?limit=12&parkCode=" + pc),
      getJSON(BASE + "/campgrounds?limit=10&parkCode=" + pc),
      getJSON(BASE + "/visitorcenters?limit=10&parkCode=" + pc),
      getJSON(BASE + "/events?limit=8&parkCode=" + pc),
      getJSON(BASE + "/newsreleases?limit=8&parkCode=" + pc),
      getJSON(BASE + "/places?limit=10&parkCode=" + pc),
    ]);

    const slim = park
      ? {
          parkCode,
          fullName: park.fullName,
          description: park.description,
          url: park.url,
          designation: park.designation,
          weatherInfo: park.weatherInfo || "",
          directionsInfo: park.directionsInfo || "",
          images: (park.images || []).slice(0, 8).map((i) => ({ url: i.url, alt: i.altText || i.title || "", caption: i.caption || "" })),
          entranceFees: (park.entranceFees || []).map((f) => ({ cost: f.cost, title: f.title, description: f.description })),
          entrancePasses: (park.entrancePasses || []).map((f) => ({ cost: f.cost, title: f.title })),
          operatingHours: (park.operatingHours || []).slice(0, 1).map((h) => ({ name: h.name, description: h.description, standardHours: h.standardHours })),
          activities: (park.activities || []).map((a) => a.name),
        }
      : null;

    const thingsToDo = ((tdD && tdD.data) || []).slice(0, 10).map((t) => ({
      title: t.title,
      shortDescription: t.shortDescription || (t.longDescription ? String(t.longDescription).replace(/<[^>]+>/g, "").slice(0, 220) : ""),
      duration: t.duration || "",
      url: t.url || "",
      image: (t.images && t.images[0] && t.images[0].url) || "",
    }));
    const campgrounds = ((cgD && cgD.data) || []).slice(0, 8).map((c) => ({
      name: c.name,
      description: (c.description || "").slice(0, 200),
      reservationUrl: c.reservationUrl || "",
      reservationInfo: (c.reservationInfo || "").slice(0, 160),
      totalSites: (c.campsites && c.campsites.totalSites) || "",
      url: c.url || "",
    }));
    const visitorCenters = ((vcD && vcD.data) || []).slice(0, 8).map((v) => ({
      name: v.name,
      description: (v.description || "").slice(0, 180),
      url: v.url || "",
    }));
    const events = ((evD && evD.data) || []).slice(0, 6).map((e) => ({
      title: e.title,
      date: e.datestart || (e.dates && e.dates[0]) || "",
      times: (e.times && e.times[0] && e.times[0].timestart + "\u2013" + e.times[0].timeend) || "",
      description: String(e.description || "").replace(/<[^>]+>/g, "").slice(0, 200),
      location: e.location || "",
      url: e.infourl || e.url || "",
    }));
    const news = ((nrD && nrD.data) || []).slice(0, 6).map((n) => ({
      title: n.title,
      date: n.releasedate || "",
      abstract: String(n.abstract || "").replace(/<[^>]+>/g, "").slice(0, 220),
      url: n.url || "",
    }));
    const places = ((plD && plD.data) || []).slice(0, 8).map((pl) => ({
      title: pl.title,
      description: String(pl.listingdescription || pl.bodyText || "").replace(/<[^>]+>/g, "").slice(0, 180),
      image: (pl.images && pl.images[0] && pl.images[0].url) || "",
      url: pl.url || "",
    }));

    return Response.json({
      parkCode,
      park: slim,
      alerts: ((alertsD && alertsD.data) || []).map((a) => ({ title: a.title, category: a.category, description: a.description, url: a.url })),
      thingsToDo,
      campgrounds,
      visitorCenters,
      events,
      news,
      places,
    });
  } catch (e) {
    return Response.json({ error: "NPS request failed", detail: String(e.message || e) }, { status: 502 });
  }
}
