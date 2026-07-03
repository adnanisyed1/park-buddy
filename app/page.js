import EmbeddedSite from "./components/EmbeddedSite";

// Homepage = the ParkBuddy bento launcher sitting over the live verdict map
// (public/embed/index — confirmed against the user's own explore-preview.html,
// which points at this exact embed + script list). The bento (explore-intro.js)
// is the home: tiles either reveal the map in-place or expand into their own
// pages. This is richer than public/embed/landing (a simpler hero-only page,
// wrongly used here initially) — index is the one actually being asked for.
// The full interactive map ALSO lives at /explore (see app/explore/page.js)
// for direct/bookmarked access; every nav link across the app already
// targets /explore for "Map"/"Live Status" and / for the logo/brand.
export const metadata = {
  title: "ParkBuddy — Discover, plan & collect the outdoors",
  description:
    "Your home for the outdoors: discover the best national parks and lakes near you, build real-road trips, and collect a digital Trip Passport.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <EmbeddedSite page="index" />;
}
