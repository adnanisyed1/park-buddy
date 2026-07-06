import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "The Park Buddy Shop",
  description:
    "Park Buddy Originals — posters, prints and merch — plus gear, camping equipment, navigation & safety, maps and guides, optics, and the America the Beautiful park pass.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return (
    <CategoryPage
      eyebrow="Shop"
      title="Gear"
      emphasis="up."
      blurb="The Park Buddy Shop — our own originals (WPA-style park posters, prints and merch) alongside the gear that gets you out there: packs and layers, tents and stoves, navigation and safety, topo maps and guides, optics, and the America the Beautiful annual pass. Curated, honestly linked — no invented reviews."
      photoQ="Vintage national park poster|Camping gear backpack mountains|Topographic map compass"
      mode="soon"
      navActive="shop"
      features={["Park Buddy Originals & passes", "Gear · camp · cook", "Maps · optics · safety"]}
    />
  );
}
