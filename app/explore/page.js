import ExploreClient from "./ExploreClient";

// The interactive map — live verdict pins, filters panel, boundary/trail/
// campground layers, My Trip cart. Was briefly rendered at "/" directly
// (commit 560a520); moved back here 2026-07-03 so "/" can be the marketing
// landing page again. Every "Map"/"Live Status" nav link across the app
// already targets /explore, so nothing else needed to change.
export const metadata = {
  title: "ParkBuddy — Discover, plan & collect the outdoors",
  description:
    "An interactive map of national parks and lakes with live weather, alerts and official conditions. Find the best outdoors near any city and start a trip.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "ParkBuddy — Discover, plan & collect the outdoors",
    description:
      "Interactive map of national parks and lakes with live weather, alerts and conditions.",
    url: "/explore",
  },
};

export default function ExplorePage() {
  return <ExploreClient />;
}
