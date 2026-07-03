import ExploreClient from "./explore/ExploreClient";

// Homepage = the new map experience (the design-spec Explore app: live verdict
// pins, filters panel, boundary/trail/campground layers, My Trip cart).
// The legacy bento+map homepage (public/embed/index) is retired from routing but
// kept on disk as the reference implementation. /explore redirects here.
export const metadata = {
  title: "ParkBuddy — Discover, plan & collect the outdoors",
  description:
    "An interactive map of national parks and lakes with live weather, alerts and official conditions. Find the best outdoors near any city and start a trip.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ParkBuddy — Discover, plan & collect the outdoors",
    description:
      "Interactive map of national parks and lakes with live weather, alerts and conditions.",
    url: "/",
  },
};

export default function HomePage() {
  return <ExploreClient />;
}
