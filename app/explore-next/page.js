import ExploreSplit from "./ExploreSplit";

// Not indexed while it's under review — /explore is still the real one.
export const metadata = {
  title: "Explore (new) · Park Buddy",
  description: "Find national parks, forests and state parks near anywhere, and see what's inside them.",
  robots: { index: false, follow: false },
};

export default function ExploreNextPage() {
  return <ExploreSplit />;
}
