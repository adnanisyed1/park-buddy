import ExploreSplitClient from "./ExploreSplitClient";

// Still noindex while /explore is the real one — two pages competing for the
// same query is worse than one. The rest of the block is the metadata this page
// will need the moment it takes over, kept in place and correct rather than
// written from scratch under time pressure on swap day. The canonical stays
// pointed at /explore until then, so nothing here competes with it.
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
  robots: { index: false, follow: false },
};

export default function ExploreNextPage() {
  return <ExploreSplitClient />;
}
