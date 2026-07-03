import {
  StatusShell, HeroBand, StatGrid, BigStat, SectionTitle, TipCard, ConditionCard, GoldButton,
  NearbySection, ReviewsBlock, NotFoundBody,
} from "../components/StatusShell";
import { origin, getParks, parkByUnitCode, getNearby, getTrailReviews, getPhoto, getPointWeather, getParkFees } from "../lib/statusData";
import TrailStatsClient from "./TrailStatsClient";
import TrailRouteChart from "./TrailRouteChart";
import AddToTripButton from "../components/AddToTripButton";

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
  const [parks, nearby, { reviews, avg }, photoUrl, weather] = await Promise.all([
    getParks(),
    getNearby(ref?.lat, ref?.lng, { excludeTrailId: trail.id }),
    getTrailReviews(trail.id),
    getPhoto(trail.name, null),
    getPointWeather(ref?.lat, ref?.lng),
  ]);
  const park = parkByUnitCode(parks, trail.unitCode || searchParams.park);
  const fees = park ? await getParkFees(park.npsCode) : null;
  const catMeta = CAT_META[trail.category] || { icon: "🥾", label: "Trail" };
  const parkHref = park ? "/park-status?park=" + park.id : null;
  const trailKey = "trail:" + (park ? park.name : trail.unitName || "") + "|" + trail.name;

  const pills = [];
  if (weather) pills.push({ label: weather.tempF + "°F · " + weather.short, dot: "#409e5e" });
  if (trail.seasonal) pills.push({ label: "Seasonal access" });

  const tips = [];
  if (trail.seasonNote) tips.push({ title: "Seasonal conditions", body: trail.seasonNote });
  if (trail.notes) tips.push({ title: "Access notes", body: trail.notes });
  tips.push({ title: "Popular trailheads fill early", body: "Lots at well-known trailheads can fill by mid-morning in peak season — arrive early or check the park's shuttle/parking alerts." });
  tips.push({ title: "No live per-trail conditions", body: "Closures and washouts aren't published in a per-trail feed — check the park's live status page or official site before heading out." });

  return (
    <StatusShell
      backHref={parkHref || "/explore"}
      backLabel={park ? "Back to " + park.name : "Back to map"}
      headerRight={park ? <AddToTripButton pid={park.id} label={trail.name} itemName={trail.name} /> : null}
      hero={
        <HeroBand
          photoUrl={photoUrl}
          photoAlt={trail.name}
          breadcrumb={(trail.unitName || "").toString()}
          title={trail.name}
          pills={pills}
        />
      }
    >
      <div style={{ fontSize: ".85rem", color: "#8a8471", marginBottom: 18 }}>{catMeta.label}{trail.unitName ? " · " + trail.unitName : ""}</div>

      <StatGrid>
        <BigStat label="Length" value={trail.lengthMi > 0 ? trail.lengthMi : null} unit="mi" />
        <TrailStatsClient trailKey={trailKey} path={trail.path} lengthMi={trail.lengthMi} />
      </StatGrid>

      <TrailRouteChart trailKey={trailKey} path={trail.path} category={trail.category} />

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Conditions</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <ConditionCard label="Right now" title={weather ? weather.tempF + "°F" : null}>
            {weather ? (weather.short + (weather.wind ? " · wind " + weather.wind : "")) : "Live weather isn't available for this location right now."}
          </ConditionCard>
          {fees ? (
            <ConditionCard
              label="Permits & fees" dark
              title={fees.passes[0] ? fees.passes[0].title : fees.fees[0] ? "$" + fees.fees[0].cost : null}
              cta={park && park.npsCode ? <GoldButton href={"https://www.nps.gov/" + park.npsCode + "/planyourvisit/fees.htm"}>Park fee details ↗</GoldButton> : null}
            >
              {(fees.fees[0] && fees.fees[0].description) || "Entrance fees apply at the park level — see the park's fee page for exact per-trail requirements."}
            </ConditionCard>
          ) : (
            <ConditionCard label="Permits & fees" title="Check the park's site">No park-level fee data was available for this trail's park.</ConditionCard>
          )}
        </div>
      </div>

      {tips.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionTitle>Know before you go</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            {tips.map((t, i) => <TipCard key={i} title={t.title}>{t.body}</TipCard>)}
          </div>
        </div>
      )}

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

      <ReviewsBlock reviews={reviews} avg={avg} writeHref="/explore" />
    </StatusShell>
  );
}
