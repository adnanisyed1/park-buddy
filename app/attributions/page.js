import LegalShell from "../components/LegalShell";

export const metadata = {
  title: "Data & Attributions",
  description: "The real public sources behind Park Buddy's live conditions and photos — and our affiliate disclosure.",
  alternates: { canonical: "/attributions" },
};

export default function AttributionsPage() {
  return (
    <LegalShell title="Data & Attributions" updated="July 2026">
      <p>Park Buddy is built on real, public data — never invented. Here's where it comes from, with credit.</p>

      <h2>Live conditions</h2>
      <ul>
        <li><b>National Park Service (NPS)</b> — park info, alerts, hours & fees. Public domain, via the NPS API.</li>
        <li><b>National Weather Service (NWS / weather.gov)</b> — forecasts and active weather alerts. Public domain.</li>
        <li><b>NIFC</b> — active wildfire incidents. Public domain.</li>
        <li><b>AirNow (EPA)</b> — air quality. Used under AirNow's terms.</li>
        <li><b>USGS</b> — river flow and named water features (GNIS). Public domain.</li>
        <li><b>Recreation.gov (RIDB)</b> — campgrounds & permits. Used under its terms.</li>
        <li><b>OpenStreetMap contributors</b> — trail and place geometry, © OpenStreetMap contributors, ODbL.</li>
      </ul>

      <h2>Photos</h2>
      <p>Representative photos come from <b>Wikipedia / Wikimedia Commons</b> and are licensed <b>CC BY-SA</b>; each is credited to its author where shown. Some park images come from the NPS (public domain). User-posted Pines belong to the people who took them.</p>

      <h2>Scenic-drive routes, itineraries & history</h2>
      <p>For scenic drives, the route stops, junction details, and history text are adapted from the matching <b>Wikipedia</b> article, by Wikipedia contributors, licensed <b>CC BY-SA 4.0</b> — each drive page links its source article, revision, and cited references. Official designation (All-American Road / National Scenic Byway) comes from the <b>Federal Highway Administration</b> and live road status from the <b>National Park Service</b> (both public domain).</p>

      <h2>Maps</h2>
      <p>Maps are provided by <b>Google Maps</b> and used under the Google Maps Platform Terms of Service.</p>

      <h2>Affiliate disclosure</h2>
      <p>Some links to partners (stays, campsites, cars, gear, tours) are affiliate links — if you book or buy through them, Park Buddy may earn a commission, <b>at no extra cost to you</b>. It never changes your price, and it never changes what we show you: we don't invent reviews, ratings, or availability, and we tell you when something isn't live yet.</p>

      <p>Something look wrong or want a credit corrected? Email <a href="mailto:support@theparkbuddy.com">support@theparkbuddy.com</a>.</p>
    </LegalShell>
  );
}
