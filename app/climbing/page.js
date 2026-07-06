import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Climbing the parks — coming soon",
  description:
    "The national parks hold some of the world's greatest rock — Yosemite's big walls, Zion's sandstone, Joshua Tree, Devils Tower. Routes, seasons and conditions, coming soon.",
  alternates: { canonical: "/climbing" },
};

export default function ClimbingPage() {
  return (
    <CategoryPage
      eyebrow="Climbing the parks"
      title="Go"
      emphasis="up."
      blurb="Some of the world's most storied rock is inside the parks — the big walls of Yosemite, the sandstone of Zion, the boulders of Joshua Tree, the crack systems of Devils Tower. We're mapping the climbing areas, seasons and access — anchored to the live park conditions you already trust here."
      photoQ="Yosemite El Capitan climbing|Joshua Tree National Park climbing|Devils Tower National Monument"
      mode="soon"
      navActive="climbing"
      features={["Yosemite big walls", "Joshua Tree bouldering", "Seasons & access"]}
    />
  );
}
