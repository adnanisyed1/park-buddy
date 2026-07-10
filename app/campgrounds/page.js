import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Campgrounds",
  description: "Federal and state campgrounds with live availability and booking. Browse them around any park on the map; a full campgrounds index is coming.",
};

export default function CampgroundsPage() {
  return (
    <CategoryPage
      eyebrow="Camping"
      title="Sleep under"
      emphasis="the stars."
      blurb="Federal and state campgrounds with live availability, amenities, and a real booking hand-off to Recreation.gov. Browse them around any park on the map today; a full campgrounds index is on the way."
      photoQ="Camping|Campsite|Yosemite National Park"
      mode="map"
      features={["Live availability", "Amenities & hookups", "Book on Recreation.gov"]}
    />
  );
}
