// Our own reference page for an NPS "thing to do" — every card on the site
// links HERE first (internal-first navigation, per the site rule); this page
// is the leaf endpoint that carries the external NPS link, the coordinates,
// and the park's phone number "to get the details".
import { StatusShell, HeroBand, SectionTitle, ConditionCard, GoldButton, NearbySection, NotFoundBody } from "../components/StatusShell";
import { getParks, parkByUnitCode, nearestPark, getNearby, getParkContact, formatPhone } from "../lib/statusData";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

export async function generateMetadata({ searchParams }) {
  const title = (searchParams.t || "").trim();
  if (!title) return { title: "Things to do", robots: { index: false } };
  return { title, description: title + " — details, location, and what's nearby." };
}

export default async function TodoStatusPage({ searchParams }) {
  const title = (searchParams.t || "").trim();
  const desc = (searchParams.d || "").trim();
  const img = (searchParams.img || "").trim();
  const duration = (searchParams.dur || "").trim();
  const npsUrl = (searchParams.url || "").trim();
  const pc = (searchParams.pc || "").trim();
  const lat = num(searchParams.lat), lng = num(searchParams.lng);
  const activities = (searchParams.act || "").split("|").map((s) => s.trim()).filter(Boolean);
  const reservation = searchParams.res === "1";

  if (!title) {
    return (
      <StatusShell backHref="/explore" backLabel="Back to map">
        <NotFoundBody label="activity" />
      </StatusShell>
    );
  }

  const parks = await getParks();
  const park = pc ? parkByUnitCode(parks, pc) : (lat != null ? nearestPark(parks, lat, lng) : null);
  const [contact, nearby] = await Promise.all([
    getParkContact(pc || park?.npsCode),
    lat != null && lng != null ? getNearby(lat, lng, {}) : Promise.resolve({ trails: [], lakes: [], camps: [] }),
  ]);
  const parkHref = park ? "/park-status?park=" + park.id : null;

  const pills = [];
  if (duration) pills.push({ label: "⏱ " + duration });
  activities.slice(0, 2).forEach((a) => pills.push({ label: a }));
  if (reservation) pills.push({ label: "Reservation required" });

  return (
    <StatusShell
      backHref={parkHref || "/explore"}
      backLabel={park ? "Back to " + park.name : "Back to map"}
      hero={
        <HeroBand
          photoUrl={img || null}
          photoAlt={title}
          breadcrumb={((park ? park.name : "") + " · Things to do").replace(/^ · /, "")}
          title={title}
          pills={pills}
        />
      }
    >
      {desc && <div style={{ fontSize: ".95rem", color: "#4c5443", lineHeight: 1.65, marginBottom: 22, maxWidth: 640 }}>{desc}</div>}

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Plan &amp; contact</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {lat != null && lng != null && (
            <ConditionCard label="Coordinates" title={lat.toFixed(4) + ", " + lng.toFixed(4)}>
              GPS location of this activity — drop it into your navigation app of choice.
            </ConditionCard>
          )}
          {contact && (contact.phone || contact.url) ? (
            <ConditionCard label="Contact the park" title={contact.phone ? formatPhone(contact.phone) : null}>
              {(contact.fullName || (park ? park.name : "The park")) + " can confirm current conditions, closures, and requirements."}
            </ConditionCard>
          ) : (
            <ConditionCard label="Contact the park" title="Check the park's site">Current conditions and requirements come from the park directly.</ConditionCard>
          )}
          <ConditionCard
            label="Official details" dark
            title="NPS.gov"
            cta={npsUrl ? <GoldButton href={npsUrl}>Full details on NPS.gov ↗</GoldButton> : (contact && contact.url ? <GoldButton href={contact.url}>Park website ↗</GoldButton> : null)}
          >
            The National Park Service page for this activity is the authoritative source.
          </ConditionCard>
        </div>
      </div>

      <NearbySection
        title="Trails nearby"
        items={(nearby.trails || []).map((t) => ({
          name: t.name,
          sub: t.lengthMi > 0 ? t.lengthMi + " mi" : null,
          href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || pc || ""),
        }))}
      />
      <NearbySection
        title="Lakes nearby"
        items={(nearby.lakes || []).map((l) => ({
          name: l.name,
          href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
        }))}
      />
      <NearbySection
        title="Campgrounds nearby"
        items={(nearby.camps || []).map((c) => ({
          name: c.name,
          sub: c.type || null,
          href: "/campground-status?" + new URLSearchParams({ name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "" }).toString(),
        }))}
      />
    </StatusShell>
  );
}
