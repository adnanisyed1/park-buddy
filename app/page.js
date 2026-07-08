import EmbeddedSite from "./components/EmbeddedSite";
import EmbedAuthBridge from "./components/EmbedAuthBridge";

// Homepage = the futuristic-royal LANDING page (public/embed/home), ported 1:1
// from the user's Claude-design spec (~/Downloads/parkbuddy-landing-preview.html).
// Forest-green + champagne-gold, animated topographic hero canvas, live-conditions
// ticker, persona spotlight, AI-agent + plan/pack, alerts, Stay/Cars/Gear booking,
// scrollytelling "Learn", Pro tiers, "List with us" intake, and a pre-flight filter
// modal that writes pb_map_filters → /explore. Photos come from our /api/photo.
// The full interactive map lives at /explore; the older bento launcher is retained
// at public/embed/index (unrouted) as a fallback reference.
export const metadata = {
  title: "Park Buddy — See every park like never before",
  description:
    "One living map for every U.S. national park — plus the national forests, state parks, trails, scenic drives, lakes and campgrounds around them. Real conditions, charted in real time.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <EmbeddedSite page="home" />
      <EmbedAuthBridge />
    </>
  );
}
