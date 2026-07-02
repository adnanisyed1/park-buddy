import BuildTripApp from "./BuildTripApp";

// Build a Trip — fully migrated off the embed pipeline into a native React
// component (BuildTripApp.jsx), ported 1:1 from the Claude-design spec with the
// real 63-park dataset, live per-stop verdicts, functional itinerary reorder,
// budget math, and the Maps key injected from NEXT_PUBLIC_GMAPS_KEY.
export const metadata = {
  title: "Build a trip",
  description:
    "Build a multi-park road trip on a live Google Map: add stops, set dates and travelers, get conditions-driven gear suggestions, and save a Trip Passport.",
  alternates: { canonical: "/build-trip" },
  openGraph: {
    title: "Build a trip · ParkBuddy",
    description:
      "Build a multi-park road trip on a live map — add stops, set dates, and save a Trip Passport.",
    url: "/build-trip",
  },
};

export default function BuildTripPage() {
  return <BuildTripApp />;
}
