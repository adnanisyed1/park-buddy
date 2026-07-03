import EmbeddedSite from "./components/EmbeddedSite";

// Homepage = the marketing/hero landing page (public/embed/landing) — the
// original "what we do" page with the bento feature grid. The interactive map
// lives at /explore now (see app/explore/page.js), not here — restored
// 2026-07-03 after /page.js briefly rendered the map directly (commit
// 560a520). Every nav link across the app already targets /explore for
// "Map"/"Live Status" and / for the logo/brand, so this swap needed no other
// link changes.
export const metadata = {
  title: "ParkBuddy — Discover, plan & collect the outdoors",
  description:
    "Your home for the outdoors: discover the best national parks and lakes near you, build real-road trips, and collect a digital Trip Passport.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <EmbeddedSite page="landing" />;
}
