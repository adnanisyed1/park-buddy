import ParkStatusV2 from "./ParkStatusV2";

// Per-park deep status page — /parks/:id (replaces the legacy /park-status?park=
// embed). The client component resolves the park from trip-data.js and wires the
// live NPS / NWS / USGS / AirNow / Recreation.gov data behind the tabbed layout.
export const metadata = {
  title: "Live park status & conditions",
  description:
    "The deep live status for a national park: today's GO / PREPARE / HOLD verdict, NWS alerts, wildfire & air quality, forecast, sun & sky, webcams, trails, permits, campgrounds and what's nearby.",
};

export default function ParkPage({ params }) {
  return <ParkStatusV2 id={params.id} />;
}
