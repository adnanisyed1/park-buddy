import { StatusShell, NotFoundBody, NearbySection } from "../components/StatusShell";
import { getParks, nearestPark, getNearby, getPhotoInfo, getPointWeather, getWaterbody, getLakeAccess, getWebcams, getThingsToDo, getParkContact, formatPhone } from "../lib/statusData";
import LakeLivingHero from "./LakeLivingHero";
import NearbyWater from "./NearbyWater";
import WebcamsSection from "../components/WebcamsSection";
import ThingsToDo from "../components/ThingsToDo";

const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const CARD = "#fffdf7", LINE = "#e7ddca", INK = "#1d4a37", BODY = "#525a46", MUTED = "#8c8473";

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

function SectionHead({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.35rem", color: INK, margin: 0 }}>{children}</h2>
      {right && <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", textTransform: "uppercase", color: MUTED }}>{right}</span>}
    </div>
  );
}
function Card({ label, title, children, dark, muted }) {
  return (
    <div style={dark
      ? { background: "linear-gradient(135deg,#1d4a37,#163a2b)", borderRadius: 20, padding: "15px 16px", boxShadow: "0 18px 44px -22px rgba(28,46,34,.5)" }
      : { background: CARD, border: "1px solid " + LINE, borderRadius: 20, padding: "15px 16px", boxShadow: "0 18px 44px -22px rgba(28,46,34,.35)" }}>
      {label && <div style={{ fontSize: ".6rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: dark ? "rgba(243,237,224,.6)" : MUTED }}>{label}</div>}
      {title && <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.35rem", color: dark ? "#fbf6ea" : (muted ? MUTED : INK), marginTop: 6, lineHeight: 1.05 }}>{title}</div>}
      {children && <div style={{ fontSize: ".76rem", color: dark ? "rgba(243,237,224,.85)" : BODY, lineHeight: 1.5, marginTop: 5 }}>{children}</div>}
    </div>
  );
}

export async function generateMetadata({ searchParams }) {
  const name = searchParams.name;
  if (!name) return { title: "Lake details", robots: { index: false } };
  return { title: name, description: name + ": live weather, surface area, access, and nearby water." };
}

export default async function LakeStatusPage({ searchParams }) {
  const name = (searchParams.name || "").trim();
  const lat = num(searchParams.lat), lng = num(searchParams.lng);
  if (!name || lat == null || lng == null) {
    return (
      <StatusShell backHref="/explore" backLabel="Back to map"><NotFoundBody label="lake" /></StatusShell>
    );
  }

  const kind = searchParams.kind === "reservoir" ? "Reservoir" : "Lake";
  const parks = await getParks();
  const park = nearestPark(parks, lat, lng);
  const state = park ? park.state : "";
  // Webcams/things-to-do only when the lake is genuinely in/near the park.
  const parkRelevant = park && park.dist <= 60;
  const [nearby, photoInfo, weather, waterbody, access, webcams, todos] = await Promise.all([
    getNearby(lat, lng, { excludeName: name }),
    // State-qualified so "Grand Lake" → "Grand Lake (Colorado)", not the
    // disambig page; coords enable the geotagged-photo fallback for the
    // majority of lakes with no article of their own.
    getPhotoInfo(name, state, { lat, lng }),
    getPointWeather(lat, lng),
    getWaterbody(lat, lng),
    getLakeAccess(lat, lng),
    parkRelevant ? getWebcams(park.npsCode, lat, lng) : Promise.resolve([]),
    parkRelevant ? getThingsToDo(park.npsCode, lat, lng) : Promise.resolve([]),
  ]);
  const contact = parkRelevant ? await getParkContact(park.npsCode) : null;
  const photoUrl = photoInfo?.url || null;
  const parkHref = park ? "/park-status?park=" + park.id : null;
  const areaAcres = waterbody ? waterbody.areaAcres : null;
  // Warm big-water palette for reservoirs / large lakes; cool alpine otherwise.
  const palette = kind === "Reservoir" || (areaAcres && areaAcres > 300) ? "warm" : "alpine";
  const typeLabel = kind + (park ? " · near " + park.name : "");

  const waterItems = (nearby.lakes || []).map((l) => ({
    name: l.name,
    href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(),
    q: [l.name, state ? l.name + " (" + state + ")" : "", l.name + " lake"].filter(Boolean).join("|"),
    badge: (l.kind || "lake") === "reservoir" ? "RESERVOIR" : "LAKE",
    lat: l.lat, lng: l.lng, // enables the geotagged-photo fallback per tile
  }));

  return (
    <StatusShell
      wide
      backHref={parkHref || "/explore"}
      backLabel={park ? "Back to " + park.name : "Back to map"}
      hero={
        <LakeLivingHero
          name={name} typeLabel={typeLabel} palette={palette}
          weather={weather} areaAcres={areaAcres} kind={kind}
          parkName={park ? park.name : null} parkDist={park ? park.dist : null}
          lat={lat} lng={lng}
        />
      }
    >
      {/* Right now */}
      <div style={{ marginBottom: 26 }}>
        <SectionHead right="Weather live · water gauges not published">Right now at the lake</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(225px,1fr))", gap: 11 }}>
          <Card label="Air temperature" title={weather ? weather.tempF + "°F" : "—"}>
            {weather ? weather.short : "Live weather isn't available for this location right now."}
          </Card>
          <Card label="Wind" title={weather && weather.wind ? weather.wind : "—"}>
            {weather && weather.wind ? "From the NWS point forecast — wind drives chop; calmest usually at dawn." : "Wind data not available right now."}
          </Card>
          <Card label="Water temperature" title="Not published" muted>
            No public water-temperature gauge exists at this lake — most lakes (especially alpine) aren&apos;t instrumented.
          </Card>
          <Card label="Best window today" title="Plan by the weather" muted>
            No operator publishes a per-lake &quot;best time&quot; feed — mornings are usually calmest; be off exposed water before afternoon storms.
          </Card>
        </div>
      </div>

      {/* Access & facilities */}
      <div style={{ marginBottom: 26 }}>
        <SectionHead right={access.length ? "Existence real · live status not published" : ""}>Access &amp; facilities</SectionHead>
        {access.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 11 }}>
            {access.map((f, i) => (
              // Internal-first: the facility's own reference page carries the
              // Recreation.gov link at its leaf — never link straight out here.
              <a key={i} href={"/campground-status?" + new URLSearchParams({ name: f.name, lat: f.lat, lng: f.lng, type: f.type || "", url: f.url || "" }).toString()} style={{ display: "block", textDecoration: "none", background: CARD, border: "1px solid " + LINE, borderRadius: 20, padding: 16, boxShadow: "0 18px 44px -22px rgba(28,46,34,.35)" }}>
                <div style={{ fontFamily: serif, fontWeight: 700, color: INK, fontSize: "1.02rem" }}>{f.name}</div>
                <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, marginTop: 4 }}>{f.type}</div>
                <span style={{ display: "inline-block", marginTop: 10, fontSize: ".76rem", fontWeight: 700, color: "#2c5562" }}>Details →</span>
              </a>
            ))}
          </div>
        ) : (
          <Card muted title="No public facilities found nearby">
            No boat ramps, marinas, or swim beaches appear in the federal recreation data near this lake. Live ramp waits, lot capacity, and inspection hours aren&apos;t published in any public feed — check the managing agency before you go.
          </Card>
        )}
      </div>

      {/* Getting there + Rules */}
      <div style={{ marginBottom: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 11 }}>
        <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 20, padding: 18, boxShadow: "0 18px 44px -22px rgba(28,46,34,.35)" }}>
          <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.05rem", color: INK, margin: 0 }}>Getting there</h3>
          <p style={{ fontSize: ".88rem", color: BODY, lineHeight: 1.6, marginTop: 8 }}>
            {park ? "In or near " + park.name + " (about " + Math.round(park.dist) + " mi from the park center). See the park's official directions and seasonal road/timed-entry status before you go." : "Check the managing agency's site for directions and seasonal access."}
          </p>
          {/* This page is the leaf endpoint — it carries the raw coordinates
              and the park's phone so a visitor can get authoritative details. */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #efe8d8", fontFamily: mono, fontSize: ".72rem", color: "#4c5443", lineHeight: 1.8 }}>
            Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
            {contact && contact.phone && <><br />Park info: <a href={"tel:" + contact.phone.replace(/[^0-9+]/g, "")} style={{ color: "#2c5562", fontWeight: 700, textDecoration: "none" }}>{formatPhone(contact.phone)}</a></>}
          </div>
        </div>
        <div style={{ background: CARD, border: "1px solid " + LINE, borderRadius: 20, padding: 18, boxShadow: "0 18px 44px -22px rgba(28,46,34,.35)" }}>
          <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.05rem", color: INK, margin: 0 }}>Rules &amp; permits</h3>
          <p style={{ fontSize: ".88rem", color: BODY, lineHeight: 1.6, marginTop: 8 }}>
            Fishing licenses, aquatic-nuisance-species (ANS) inspection, and craft rules are set by the managing agency{park ? " (" + park.name + " / state)" : ""} — not published in a per-lake feed. Confirm current regulations with them.
            {park && park.npsCode && <> <a href={"https://www.nps.gov/" + park.npsCode + "/index.htm"} target="_blank" rel="noreferrer" style={{ color: "#2c5562", fontWeight: 700, textDecoration: "none" }}>Park site ↗</a></>}
          </p>
        </div>
      </div>

      <WebcamsSection webcams={webcams} />
      <ThingsToDo items={todos} parkCode={parkRelevant ? park.npsCode : ""} />

      {/* From the shore */}
      {photoUrl && (
        <div style={{ marginBottom: 26 }}>
          <figure style={{ position: "relative", margin: 0, height: "clamp(260px,38vh,400px)", overflow: "hidden", borderRadius: 24, border: "1px solid " + LINE, background: "repeating-linear-gradient(135deg,#ece5d4 0 12px,#e6dfcd 12px 24px)" }}>
            <img src={photoUrl} alt={name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <figcaption style={{ position: "absolute", left: 14, bottom: 14, background: "rgba(21,36,28,.82)", color: "#f3ede0", fontSize: ".7rem", fontWeight: 800, letterSpacing: ".04em", borderRadius: 999, padding: "5px 13px" }}>
              {name}{photoInfo?.geo ? " · nearby photo" + (photoInfo.photoDate ? ", " + photoInfo.photoDate : "") : ""}
            </figcaption>
          </figure>
        </div>
      )}

      {/* More water nearby */}
      <div style={{ marginBottom: 26 }}>
        <SectionHead>More water nearby</SectionHead>
        <NearbyWater items={waterItems} />
      </div>

      <NearbySection
        title="Nearby trails"
        items={(nearby.trails || []).map((t) => ({ name: t.name, sub: t.lengthMi > 0 ? t.lengthMi + " mi" : null, href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || "") }))}
      />
      <NearbySection
        title="Nearby campgrounds"
        items={(nearby.camps || []).map((c) => ({ name: c.name, sub: c.type || null, href: "/campground-status?" + new URLSearchParams({ name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "" }).toString() }))}
      />

      <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: MUTED, marginTop: 22, paddingTop: 18, borderTop: "1px solid " + LINE }}>
        Weather: NWS · Elevation: USGS/Google · Surface area: USGS NHD · Facilities: Recreation.gov / OpenStreetMap · Location: USGS GNIS
      </div>
    </StatusShell>
  );
}
