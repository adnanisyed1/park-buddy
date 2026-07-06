import BookHub from "./BookHub";

export const metadata = {
  title: "Book your trip",
  description:
    "Everything you reserve for a park trip in one place — lodges, cabins and vacation rentals, campgrounds & RV sites, rental cars, cruises, guided tours and the permits many parks now require. Partner-powered, honest availability.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return <BookHub />;
}
