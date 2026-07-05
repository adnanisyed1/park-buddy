import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Cruises — arrive by sea",
  description:
    "Some of the wildest national parks are best reached from the water — Glacier Bay, Kenai Fjords, the Inside Passage, Channel Islands and Dry Tortugas. Sailings and shore excursions, coming soon.",
  alternates: { canonical: "/cruises" },
};

export default function CruisesPage() {
  return (
    <CategoryPage
      eyebrow="Cruises"
      title="Arrive"
      emphasis="by sea."
      blurb="Some of the wildest parks reveal themselves best from the water — Glacier Bay and Kenai Fjords by the Alaska Inside Passage, the Channel Islands off California, Dry Tortugas beyond Key West. We're lining up the sailings, gateway ports and shore excursions so you can wake up already there."
      photoQ="Glacier Bay National Park|Cruise ship Alaska Inside Passage|Kenai Fjords National Park"
      mode="soon"
      navActive="cruises"
      features={["Alaska Inside Passage", "Glacier Bay & Kenai Fjords", "Shore excursions"]}
    />
  );
}
