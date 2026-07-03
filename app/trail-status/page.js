import { StatusShell, StatusHeader, StatCard, StatCell, NearbySection, ReviewsBlock, NotFoundBody } from "../components/StatusShell";
import { origin, getParks, parkByUnitCode, getNearby, getTrailReviews } from "../lib/statusData";

const CAT_META = {
  hiking: { icon: "🥾", label: "Hiking trail" },
  offroad: { icon: "🚙", label: "Off-road / 4x4 route" },
  ski: { icon: "⛷️", label: "Ski route" },
};

async function getTrail(id) {
  if (!id) return null;
  try {
    const r = await fetch(origin() + "/api/trails?id=" + encodeURIComponent(id), { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    return d.trail || null;
  } catch {
    return null;
  }
}

function midpoint(path) {
  if (!Array.isArray(path) || !path.length) return null;
  const p = path[Math.floor(path.length / 2)];
  return { lat: p[0], lng: p[1] };
}

export async function generateMetadata({ searchParams }) {
  const trail = await getTrail(searchParams.trail);
  if (!trail) return { title: "Trail details", robots: { index: false } };
  const place = trail.unitName ? " in " + trail.unitName : "";
  return {
    title: trail.name + (trail.unitName ? " — " + trail.unitName : ""),
    description: "Trail details for " + trail.name + place + ": length, surface, trail class, and nearby lakes & campgrounds.",
  };
}

export default async function TrailStatusPage({ searchParams }) {
  const trail = await getTrail(searchParams.trail);
  if (!trail) {
    return (
      <StatusShell backHref="/explore" backLabel="Back to map">
        <NotFoundBody label="trail" />
      </StatusShell>
    );
  }

  const ref = midpoint(trail.path);
  const [parks, nearby, { reviews, avg }] = await Promise.all([
    getParks(),
    getNearby(ref?.lat, ref?.lng, { excludeTrailId: trail.id }),
    getTrailReviews(trail.id),
  ]);
  const park = parkByUnitCode(parks, trail.unitCode || searchParams.park);
  const catMeta = CAT_META[trail.category] || { icon: "🥾", label: "Trail" };
  const parkHref = park ? "/park-status?park=" + park.id : null;

  return (
    <StatusShell backHref={parkHref || "/explore"} backLabel={park ? "Back to " + park.name : "Back to map"}>
      <StatusHeader icon={catMeta.icon} name={trail.name} sub={catMeta.label + (trail.unitName ? " · " + trail.unitName : "")} />

      <StatCard>
        <StatCell label="Length" value={trail.lengthMi > 0 ? trail.lengthMi + " mi" : "Unknown"} />
        <StatCell label="Surface" value={trail.surface} />
        <StatCell label="Trail class" value={trail.trailClass} full={!trail.surface} />
        {trail.seasonal && trail.seasonNote && <StatCell label="Seasonal" value={trail.seasonNote} full />}
        {trail.notes && <StatCell label="Notes" value={trail.notes} full />}
      </StatCard>

      <div style={{ fontSize: ".72rem", color: "#a7a08c", lineHeight: 1.4, marginBottom: 10 }}>
        Live per-trail conditions (closures, washouts) aren&apos;t published in a public feed — check the park&apos;s live status page or official site before heading out.
        <div style={{ marginTop: 6 }}>Source: National Park Service (public domain).</div>
      </div>

      <NearbySection
        title="Nearby trails"
        items={nearby.trails.map((t) => ({
          name: t.name,
          sub: t.lengthMi > 0 ? t.lengthMi + " mi" : null,
          href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || trail.unitCode || ""),
        }))}
      />
      <NearbySection
        title="Nearby lakes"
        items={nearby.lakes.map((l) => ({
          name: l.name,
          href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
        }))}
      />
      <NearbySection
        title="Nearby campgrounds"
        items={nearby.camps.map((c) => ({
          name: c.name,
          sub: c.type || null,
          href: "/campground-status?" + new URLSearchParams({ name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "" }).toString(),
        }))}
      />

      <ReviewsBlock reviews={reviews} avg={avg} writeHref="/" />
    </StatusShell>
  );
}
