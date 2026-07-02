import EmbeddedSite from "./components/EmbeddedSite";

// Homepage = the ParkBuddy bento launcher sitting over the live verdict map.
// The bento (explore-intro.js) is the home: tiles either reveal the map in-place
// or expand into their own pages. A home button returns to the bento.
//
// Server component: it emits real page metadata (good for SEO/social) and renders
// the client-side <EmbeddedSite/> that boots the original page assets at runtime.
export const metadata = {
  title: "ParkBuddy — Discover, plan & collect the outdoors",
  description:
    "Your home for the outdoors: discover the best national parks and lakes near you, build real-road trips, and collect a digital Trip Passport.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <EmbeddedSite page="index" />;
}
