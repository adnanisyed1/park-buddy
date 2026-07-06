import ParkStatusV2 from "../../parks/[id]/ParkStatusV2";

// Per-forest deep status page — /forests/:slug. Reuses the park-status component in
// its forest mode (kind="forest"): it resolves the forest from the curated centroid
// dataset (public/national-forests.json) and wires the same lat/lng-based live data
// — verdict, NWS alerts, wildfire, air, forecast, sun & sky, river flow, trails,
// nearby — while skipping the NPS-only pieces that don't apply to a forest.
export const metadata = {
  title: "Live national-forest status & conditions",
  description:
    "The deep live status for a U.S. national forest: today's GO / PREPARE / HOLD verdict, NWS alerts, wildfire & air quality, forecast, sun & sky, trails and what's nearby.",
};

export default function ForestPage({ params }) {
  return <ParkStatusV2 id={params.id} kind="forest" />;
}
