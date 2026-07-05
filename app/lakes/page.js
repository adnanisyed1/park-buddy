import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Lakes & water",
  description: "Alpine tarns to big reservoirs — water temp, boat ramps, and swim spots. Browse lakes live on the map; a curated lakes index is on the way.",
};

export default function LakesPage() {
  return (
    <CategoryPage
      eyebrow="Lakes & water"
      title="Every lake,"
      emphasis="mapped."
      blurb="Alpine tarns to big reservoirs — water temperature, boat ramps, beaches and swim spots, each with an honest read on what's actually there. Browse them live on the map today; a curated lakes index is coming."
      photoQ="Jenny Lake|Maroon Lake|Crater Lake"
      mode="map"
      features={["Water temp", "Boat ramps & beaches", "Swim & paddle"]}
    />
  );
}
