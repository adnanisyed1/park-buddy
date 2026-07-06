import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Book your trip",
  description:
    "Everything you reserve for a park trip in one place — lodges, cabins and vacation rentals, campgrounds & RV sites, rental cars, cruises, guided tours and the permits many parks now require.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return (
    <CategoryPage
      eyebrow="Book"
      title="Book"
      emphasis="the whole trip."
      blurb="One place for everything you reserve around a park — in-park lodges, cabins and vacation rentals, campgrounds and RV sites, rental cars for the scenic drives, cruises to the coastal parks, guided tours and experiences, and the timed-entry and wilderness permits many parks now require. Real availability from real partners — never invented."
      photoQ="National park lodge cabin|Campground tent national park|Yosemite valley lodge"
      mode="soon"
      navActive="book"
      features={["Lodges · cabins · rentals", "Campgrounds & RV", "Cars · cruises · tours · permits"]}
    />
  );
}
