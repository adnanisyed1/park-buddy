import ExploreSplitClient from "../explore-next/ExploreSplitClient";

// The interactive map — search from anywhere, then look inside one place.
//
// Swapped 2026-07-19 from the old single-column ExploreApp to the split panel +
// map rebuild. The old ExploreApp.jsx and ExploreClient.jsx are deliberately
// LEFT IN PLACE and unreferenced: rolling back is changing the one import above,
// which is worth keeping cheap until this has had real traffic.
//
// The components still live under app/explore-next/ so the diff of this swap
// stays small and reversible; they move here once rollback stops being likely.
export const metadata = {
  title: "ParkBuddy — Discover, plan & collect the outdoors",
  description:
    "An interactive map of national parks, forests and state parks with live weather, alerts and official conditions. Find the best outdoors near any city and start a trip.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "ParkBuddy — Discover, plan & collect the outdoors",
    description:
      "Interactive map of national parks, forests and state parks with live weather, alerts and conditions.",
    url: "/explore",
  },
};

export default function ExplorePage() {
  return <ExploreSplitClient />;
}
