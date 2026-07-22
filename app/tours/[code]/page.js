// /tours/[code] — a Viator tour's full listing, ON Park Buddy (internal-first
// navigation: town cards link here; the only exit is the affiliate-tagged
// "Book on Viator" CTA, per Basic-access terms which keep checkout on
// viator.com). Server component fetches; TourListing renders.
import TourListing from "./TourListing";

export const revalidate = 21600; // 6h — matches the API route's cache

export async function generateMetadata({ params }) {
  return { title: "Tour · Park Buddy", robots: { index: false } }; // real title set client-side after fetch
}

export default async function TourPage({ params }) {
  const { code } = await params;
  return <TourListing code={code} />;
}
