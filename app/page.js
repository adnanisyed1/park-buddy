import LandingPage from "./LandingPage";

// Homepage = the React LANDING page (app/LandingPage.jsx), built from the Figma
// handoff and mounted on the shared platform shell (SiteHeader + PbTabBar) — the
// last legacy embed is retired, so the whole platform is now one React base.
export const metadata = {
  title: "Park Buddy — Know if today's the day",
  description:
    "The honest national park companion: one live go/no-go call for every U.S. national park — real weather, alerts, air and fire — plus everything to plan, book and live the trip.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <LandingPage />;
}
