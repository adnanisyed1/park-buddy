import ParkStatusV2 from "../../parks/[id]/ParkStatusV2";

// Per-forest deep status page — /forests/:slug. Reuses the park-status component in
// its forest mode (kind="forest"): it resolves the forest from the curated centroid
// dataset (public/national-forests.json) and wires the same lat/lng-based live data
// — verdict, NWS alerts, wildfire, air, forecast, sun & sky, river flow, trails,
// nearby — while skipping the NPS-only pieces that don't apply to a forest.
// Per-forest SEO metadata, derived from the slug so each forest is a distinct page.
export async function generateMetadata({ params }) {
  let name = String(params.id || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  if (name && !/forest/i.test(name)) name += " National Forest";
  const readable = name || "National Forest";
  return {
    title: readable + " — live conditions & trip planner",
    description: "Today's GO / PREPARE / HOLD verdict for " + readable + ": live weather, NWS alerts, wildfire & air quality, forecast, trails and what's nearby — from real sources.",
    alternates: { canonical: "/forests/" + params.id },
    openGraph: { title: readable + " — live conditions | Park Buddy", description: "Live verdict + conditions for " + readable + ".", url: "/forests/" + params.id },
  };
}

export default function ForestPage({ params }) {
  return <ParkStatusV2 id={params.id} kind="forest" />;
}
