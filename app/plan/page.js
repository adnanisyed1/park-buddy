import EmbeddedSite from "../components/EmbeddedSite";

// Trip planner.
export const metadata = {
  title: "Plan a national parks trip",
  description:
    "Plan a national parks road trip that follows real roads — with drive times, dates, a transparent cost estimate and an AI packing checklist.",
  alternates: { canonical: "/plan" },
  openGraph: {
    title: "Plan a national parks trip · ParkBuddy",
    description:
      "Plan a road trip on real roads with drive times, dates and a transparent cost estimate.",
    url: "/plan",
  },
};

export default function PlanPage() {
  return <EmbeddedSite page="plan" />;
}
