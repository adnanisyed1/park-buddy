import EmbeddedSite from "../components/EmbeddedSite";

// Per-park live status page. Reads ?park=<id> exactly like the original.
// Canonical points at the base path so the many ?park= variants aren't indexed
// as duplicate pages.
export const metadata = {
  title: "Live park status & conditions",
  description:
    "Live status for any national park: current weather, National Weather Service alerts, wildfire and air-quality conditions, plus fees and hours.",
  alternates: { canonical: "/park-status" },
  openGraph: {
    title: "Live park status & conditions · ParkBuddy",
    description:
      "Current weather, alerts, wildfire and air-quality conditions for any national park.",
    url: "/park-status",
  },
};

export default function ParkStatusPage() {
  return <EmbeddedSite page="park-status" />;
}
