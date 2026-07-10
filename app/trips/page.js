import TripsPage from "./TripsPage";

export const metadata = {
  title: "My Trips",
  description: "Your saved national-park itineraries — save any trip by name, then search and reopen it anytime.",
  alternates: { canonical: "/trips" },
  robots: { index: false }, // personal, per-device/account content
};

export default function Page() {
  return <TripsPage />;
}
