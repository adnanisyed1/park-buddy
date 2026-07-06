import ShopStore from "./ShopStore";

export const metadata = {
  title: "The Park Buddy Shop",
  description:
    "Park Buddy Originals — posters, prints and merch — plus gear, camping equipment, navigation & safety, maps and guides, optics, and the America the Beautiful park pass. Affiliate, partner-fulfilled, honest.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <ShopStore />;
}
