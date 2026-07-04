import {
  StatusShell, HeroBand, SectionTitle, TipCard, ConditionCard, GoldButton,
  ReviewsBlock, NotFoundBody, NearbySection,
} from "../components/StatusShell";
import { origin, getParks, parkByUnitCode, getTrailNearby, getTrailReviews, getPhotoInfo, getPointWeather, getParkFees, getWebcams, getThingsToDo, getParkContact, formatPhone, getNearbyByways } from "../lib/statusData";
import TrailHeroStats from "./TrailHeroStats";
import TrailRouteChart from "./TrailRouteChart";
import NearbyExplorer from "./NearbyExplorer";
import AddToTripButton from "../components/AddToTripButton";
import WebcamsSection from "../components/WebcamsSection";
import ThingsToDo from "../components/ThingsToDo";

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
    description: "Trail details for " + trail.name + place + ": length, surface, trail class, milestone photos, and what's nearby.",
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
  const parks = await getParks();
  const park = parkByUnitCode(parks, trail.unitCode || searchParams.park);
  const [nearby, { reviews, avg }, photoInfo, weather, webcams, todos] = await Promise.all([
    getTrailNearby(ref, {
      state: park?.state || "",
      excludeTrailId: trail.id,
      currentParkId: park?.id || null,
      currentUnitCode: trail.unitCode || "",
    }),
    getTrailReviews(trail.id),
    // Name lookup first; if the trail has no photo of its own, /api/photo falls
    // back to a real geotagged photo taken at the trail's coordinates.
    getPhotoInfo(trail.name, null, ref),
    getPointWeather(ref?.lat, ref?.lng),
    getWebcams(park?.npsCode, ref?.lat, ref?.lng),
    getThingsToDo(park?.npsCode, ref?.lat, ref?.lng),
  ]);
  const scenicDrives = await getNearbyByways(ref?.lat, ref?.lng, { parkCode: park?.npsCode, limit: 4 });
  const driveSub = (d) => (d.tier === "all-american" ? "All-American Road" : d.tier === "landmark" ? "Historic landmark road" : "National Scenic Byway") + (d.length ? " · " + d.length : "") + (d.distMi != null ? " · " + d.distMi + " mi" : "");
  // Guarantee a hero photo: trail's own → geotagged nearby (labeled) → park's.
  const heroInfo = photoInfo || (park ? await getPhotoInfo(park.name + " National Park", park.state) : null);
  const heroPhoto = heroInfo?.url || null;
  const heroBadge = heroInfo?.geo ? "Nearby photo" + (heroInfo.photoDate ? " · " + heroInfo.photoDate : "") : null;
  const [fees, contact] = park ? await Promise.all([getParkFees(park.npsCode), getParkContact(park.npsCode)]) : [null, null];
  const trailhead = Array.isArray(trail.path) && trail.path.length ? trail.path[0] : null;
  const catMeta = CAT_META[trail.category] || { icon: "🥾", label: "Trail" };
  const parkHref = park ? "/park-status?park=" + park.id : null;
  const trailKey = "trail:" + (park ? park.name : trail.unitName || "") + "|" + trail.name;

  const pills = [];
  if (weather) pills.push({ label: weather.tempF + "°F · " + weather.short, dot: "#7fc98f" });
  pills.push({ label: catMeta.label });
  if (trail.trailClass) pills.push({ label: trail.trailClass });
  if (trail.seasonal) pills.push({ label: "Seasonal access" });

  const tips = [];
  if (trail.seasonNote) tips.push({ title: "Seasonal conditions", body: trail.seasonNote });
  if (trail.notes) tips.push({ title: "Access notes", body: trail.notes });
  tips.push({ title: "Popular trailheads fill early", body: "Lots at well-known trailheads can fill by mid-morning in peak season — arrive early or check the park's shuttle/parking alerts." });
  tips.push({ title: "No live per-trail conditions", body: "Closures and washouts aren't published in a per-trail feed — check the park's live status page or official site before heading out." });

  return (
    <StatusShell
      wide
      backHref={parkHref || "/explore"}
      backLabel={park ? "Back to " + park.name : "Back to map"}
      headerRight={park ? <AddToTripButton pid={park.id} label={trail.name} itemName={trail.name} /> : null}
      hero={
        <HeroBand
          photoUrl={heroPhoto}
          photoAlt={trail.name}
          photoBadge={heroBadge}
          breadcrumb={((trail.unitName || "") + (catMeta.label ? " · " + catMeta.label : "")).trim()}
          title={trail.name}
          pills={pills}
          statsSlot={<TrailHeroStats trailKey={trailKey} path={trail.path} lengthMi={trail.lengthMi} />}
        />
      }
    >
      <TrailRouteChart trailKey={trailKey} path={trail.path} category={trail.category} />

      <div style={{ marginBottom: 26 }}>
        <SectionTitle>Conditions</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
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
          {tips.slice(0, 1).map((t, i) => (
            <ConditionCard key={i} label="Heads up" title={t.title}>{t.body}</ConditionCard>
          ))}
          {/* Leaf-endpoint info: trailhead coordinates + the park's phone for
              authoritative, current details. */}
          <ConditionCard label="Trailhead & contact" title={trailhead ? trailhead[0].toFixed(4) + ", " + trailhead[1].toFixed(4) : null}>
            {contact && contact.phone
              ? "Trailhead GPS coordinates. For current conditions call " + (park ? park.name : "the park") + ": " + formatPhone(contact.phone)
              : "Trailhead GPS coordinates — confirm current conditions with the park before heading out."}
          </ConditionCard>
        </div>
      </div>

      {tips.length > 1 && (
        <div style={{ marginBottom: 26 }}>
          <SectionTitle>Know before you go</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {tips.slice(1).map((t, i) => <TipCard key={i} title={t.title}>{t.body}</TipCard>)}
          </div>
        </div>
      )}

      <WebcamsSection webcams={webcams} />
      <ThingsToDo items={todos} parkCode={park?.npsCode || ""} />
      <NearbySection
        title="Scenic drives nearby"
        items={scenicDrives.map((d) => ({ name: d.name, sub: driveSub(d), href: "/scenic-drives/" + d.id, q: [...(d.wiki || []), d.name].join("|"), lat: d.lat, lng: d.lng }))}
      />

      <div style={{ marginBottom: 26 }}>
        <NearbyExplorer nearby={nearby} refName={trail.name} refLat={ref?.lat} refLng={ref?.lng} state={park?.state || ""} />
      </div>

      <ReviewsBlock reviews={reviews} avg={avg} writeHref="/explore" />
    </StatusShell>
  );
}
