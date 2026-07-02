import ExploreApp from "./ExploreApp";

// Explore = the interactive Google Map + live weather + "My Trip" cart.
// Fully migrated off the embed pipeline into a native React component
// (ExploreApp.jsx), ported 1:1 from the Claude-design spec with real data:
// 63 parks from trip-data.js, live verdicts via pb-verdict.js, gateway towns,
// and the Maps key injected from NEXT_PUBLIC_GMAPS_KEY.
export const metadata = {
  title: "Explore parks near you",
  description:
    "An interactive map of national parks and lakes with live weather, alerts and official conditions. Find the best outdoors near any city and start a trip.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Explore parks near you · ParkBuddy",
    description:
      "Interactive map of national parks and lakes with live weather, alerts and conditions.",
    url: "/explore",
  },
};

export default function ExplorePage() {
  return <ExploreApp />;
}
