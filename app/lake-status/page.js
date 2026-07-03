import { StatusShell, StatusHeader, StatCard, StatCell, NearbySection, NotFoundBody } from "../components/StatusShell";
import { getParks, nearestPark, getNearby } from "../lib/statusData";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function generateMetadata({ searchParams }) {
  const name = searchParams.name;
  if (!name) return { title: "Lake details", robots: { index: false } };
  return {
    title: name,
    description: name + ": location and nearby trails & campgrounds.",
  };
}

export default async function LakeStatusPage({ searchParams }) {
  const name = (searchParams.name || "").trim();
  const lat = num(searchParams.lat), lng = num(searchParams.lng);
  if (!name || lat == null || lng == null) {
    return (
      <StatusShell backHref="/explore" backLabel="Back to map">
        <NotFoundBody label="lake" />
      </StatusShell>
    );
  }

  const kind = searchParams.kind === "reservoir" ? "Reservoir" : "Lake";
  const [parks, nearby] = await Promise.all([
    getParks(),
    getNearby(lat, lng, { excludeName: name }),
  ]);
  const park = nearestPark(parks, lat, lng);
  const parkHref = park ? "/park-status?park=" + park.id : null;

  return (
    <StatusShell backHref={parkHref || "/explore"} backLabel={park ? "Back to " + park.name : "Back to map"}>
      <StatusHeader icon="💧" name={name} sub={kind + (park ? " · near " + park.name : "")} />

      <StatCard>
        <StatCell label="Type" value={kind} />
        {park && <StatCell label="Nearest park" value={park.name + " (" + Math.round(park.dist) + " mi)"} />}
      </StatCard>

      <div style={{ fontSize: ".72rem", color: "#a7a08c", lineHeight: 1.4, marginBottom: 10 }}>
        Source: USGS GNIS / The National Map (public domain).
      </div>

      <NearbySection
        title="Nearby trails"
        items={nearby.trails.map((t) => ({
          name: t.name,
          sub: t.lengthMi > 0 ? t.lengthMi + " mi" : null,
          href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || ""),
        }))}
      />
      <NearbySection
        title="Other nearby lakes"
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
    </StatusShell>
  );
}
