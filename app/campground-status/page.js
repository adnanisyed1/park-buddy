import { StatusShell, HeroBand, StatGrid, BigStat, GoldButton, NearbySection, NotFoundBody } from "../components/StatusShell";
import { getParks, nearestPark, getNearby, getPhotoInfo, getParkContact, formatPhone } from "../lib/statusData";
import CampAvailability from "./CampAvailability";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
// Recreation.gov campground booking URLs carry the facility id we need for the
// live-availability endpoint: /camping/campgrounds/<id>.
function recGovCampId(url) {
  const m = /recreation\.gov\/camping\/campgrounds\/(\d+)/.exec(url || "");
  return m ? m[1] : null;
}

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
  // Photo: the campground's own name → a real geotagged nearby photo → and finally
  // the nearest national park's article, so the hero is never a blank frame.
  const parkFallback = park && park.dist <= 60 ? ((/national park/i.test(park.name) ? park.name : park.name + " National Park") + "|" + park.name) : "";
  const photoInfo = await getPhotoInfo(name, null, { lat, lng, fallback: parkFallback });
  const parkHref = park ? "/parks/" + park.id : null;
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
      <div style={{ fontSize: ".85rem", color: "var(--pb-muted)", marginBottom: 18 }}>{type}{park ? " · near " + park.name : ""}</div>

      <StatGrid>
        <BigStat label="Type" value={type} />
        {park && <BigStat label="Nearest park" value={park.name} unit={Math.round(park.dist) + " mi away"} />}
      </StatGrid>

      {detail && <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.55, marginBottom: 18 }}>{detail}</div>}
      {phone && <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", marginBottom: 18 }}>Phone: {phone}</div>}

      {/* Leaf-endpoint info: raw coordinates + the park's phone for details. */}
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: ".74rem", color: "var(--pb-ink-2)", lineHeight: 1.8, marginBottom: 18 }}>
        Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
        {contact && contact.phone && <><br />Park info: <a href={"tel:" + contact.phone.replace(/[^0-9+]/g, "")} style={{ color: "#2c5562", fontWeight: 700, textDecoration: "none" }}>{formatPhone(contact.phone)}</a>{park ? " (" + park.name + ")" : ""}</>}
      </div>

      {/* Live availability + booking popup for reservable Recreation.gov
          campgrounds; plain link for everything else (state/OSM campgrounds). */}
      {recGovCampId(url) ? (
        <CampAvailability campgroundId={recGovCampId(url)} bookUrl={url} name={name} />
      ) : (
        url && <div style={{ marginBottom: 18 }}><GoldButton href={url}>View on Recreation.gov ↗</GoldButton></div>
      )}

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
