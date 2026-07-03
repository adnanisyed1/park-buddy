import { StatusShell, StatusHeader, StatCard, StatCell, NearbySection, NotFoundBody } from "../components/StatusShell";
import { getParks, nearestPark, getNearby } from "../lib/statusData";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function generateMetadata({ searchParams }) {
  const name = searchParams.name;
  if (!name) return { title: "Campground details", robots: { index: false } };
  return {
    title: name,
    description: name + ": location, details, and nearby trails & lakes.",
  };
}

export default async function CampgroundStatusPage({ searchParams }) {
  const name = (searchParams.name || "").trim();
  const lat = num(searchParams.lat), lng = num(searchParams.lng);
  if (!name || lat == null || lng == null) {
    return (
      <StatusShell backHref="/explore" backLabel="Back to map">
        <NotFoundBody label="campground" />
      </StatusShell>
    );
  }

  const type = searchParams.type || "Campground";
  const url = searchParams.url || "";
  const phone = searchParams.phone || "";
  const detail = searchParams.detail || "";
  const reservable = searchParams.reservable === "1";

  const [parks, nearby] = await Promise.all([
    getParks(),
    getNearby(lat, lng, { excludeName: name }),
  ]);
  const park = nearestPark(parks, lat, lng);
  const parkHref = park ? "/park-status?park=" + park.id : null;

  return (
    <StatusShell backHref={parkHref || "/explore"} backLabel={park ? "Back to " + park.name : "Back to map"}>
      <StatusHeader icon="🏕️" name={name} sub={type + (park ? " · near " + park.name : "")} />

      <StatCard>
        <StatCell label="Type" value={type} />
        <StatCell label="Reservable" value={reservable ? "Yes, via Recreation.gov" : null} />
        {park && <StatCell label="Nearest park" value={park.name + " (" + Math.round(park.dist) + " mi)"} />}
        {detail && <StatCell label="Details" value={detail} full />}
        {phone && <StatCell label="Phone" value={phone} />}
      </StatCard>

      {url && (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", background: "#fffdf7", border: "1px solid #ece3d0", borderRadius: 12, padding: 11, fontWeight: 700, fontSize: ".84rem", color: "#2c5562", textDecoration: "none", marginBottom: 18 }}>View on Recreation.gov →</a>
      )}

      <div style={{ fontSize: ".72rem", color: "#a7a08c", lineHeight: 1.4, marginBottom: 10 }}>
        Source: Recreation.gov / RIDB (federal) or OpenStreetMap contributors.
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
        title="Nearby lakes"
        items={nearby.lakes.map((l) => ({
          name: l.name,
          href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
        }))}
      />
      <NearbySection
        title="Other nearby campgrounds"
        items={nearby.camps.map((c) => ({
          name: c.name,
          sub: c.type || null,
          href: "/campground-status?" + new URLSearchParams({ name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "" }).toString(),
        }))}
      />
    </StatusShell>
  );
}
