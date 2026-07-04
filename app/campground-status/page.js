import { StatusShell, HeroBand, StatGrid, BigStat, GoldButton, NearbySection, NotFoundBody } from "../components/StatusShell";
import { getParks, nearestPark, getNearby, getPhotoInfo, getParkContact, formatPhone } from "../lib/statusData";

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

  const [parks, nearby, photoInfo] = await Promise.all([
    getParks(),
    getNearby(lat, lng, { excludeName: name }),
    getPhotoInfo(name, null, { lat, lng }), // geotagged fallback when the campground has no article
  ]);
  const park = nearestPark(parks, lat, lng);
  const parkHref = park ? "/park-status?park=" + park.id : null;
  const contact = park && park.dist <= 60 ? await getParkContact(park.npsCode) : null;
  const photoUrl = photoInfo?.url || null;
  // A geotagged archive photo must carry its provenance label, same as the trail hero.
  const photoBadge = photoInfo?.geo ? "Nearby photo" + (photoInfo.photoDate ? " · " + photoInfo.photoDate : "") : null;

  return (
    <StatusShell
      backHref={parkHref || "/explore"}
      backLabel={park ? "Back to " + park.name : "Back to map"}
      hero={<HeroBand photoUrl={photoUrl} photoAlt={name} photoBadge={photoBadge} breadcrumb={park ? park.name : type} title={name} pills={reservable ? [{ label: "Reservable via Recreation.gov" }] : []} />}
    >
      <div style={{ fontSize: ".85rem", color: "#8a8471", marginBottom: 18 }}>{type}{park ? " · near " + park.name : ""}</div>

      <StatGrid>
        <BigStat label="Type" value={type} />
        {park && <BigStat label="Nearest park" value={park.name} unit={Math.round(park.dist) + " mi away"} />}
      </StatGrid>

      {detail && <div style={{ fontSize: ".84rem", color: "#4c5443", lineHeight: 1.55, marginBottom: 18 }}>{detail}</div>}
      {phone && <div style={{ fontSize: ".8rem", color: "#6d7263", marginBottom: 18 }}>Phone: {phone}</div>}

      {/* Leaf-endpoint info: raw coordinates + the park's phone for details. */}
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: ".74rem", color: "#4c5443", lineHeight: 1.8, marginBottom: 18 }}>
        Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
        {contact && contact.phone && <><br />Park info: <a href={"tel:" + contact.phone.replace(/[^0-9+]/g, "")} style={{ color: "#2c5562", fontWeight: 700, textDecoration: "none" }}>{formatPhone(contact.phone)}</a>{park ? " (" + park.name + ")" : ""}</>}
      </div>

      {url && <div style={{ marginBottom: 18 }}><GoldButton href={url}>View on Recreation.gov ↗</GoldButton></div>}

      <div style={{ fontSize: ".72rem", color: "#a7a08c", lineHeight: 1.4, marginBottom: 18 }}>
        Source: Recreation.gov / RIDB (federal) or OpenStreetMap contributors.
      </div>

      <NearbySection
        title="Nearby trails"
        items={nearby.trails.map((t) => {
          const mp = Array.isArray(t.path) && t.path.length ? t.path[Math.floor(t.path.length / 2)] : null;
          return {
            name: t.name,
            sub: t.lengthMi > 0 ? t.lengthMi + " mi" : null,
            href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || ""),
            q: t.name, lat: mp ? mp[0] : null, lng: mp ? mp[1] : null,
          };
        })}
      />
      <NearbySection
        title="Nearby lakes"
        items={nearby.lakes.map((l) => ({
          name: l.name,
          href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
          q: l.name, lat: l.lat, lng: l.lng,
        }))}
      />
      <NearbySection
        title="Other nearby campgrounds"
        items={nearby.camps.map((c) => ({
          name: c.name,
          sub: c.type || null,
          href: "/campground-status?" + new URLSearchParams({ name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "" }).toString(),
          q: c.name, lat: c.lat, lng: c.lng,
        }))}
      />
    </StatusShell>
  );
}
