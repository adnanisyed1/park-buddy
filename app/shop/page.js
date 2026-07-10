import { Suspense } from "react";
import ShopStore from "./ShopStore";

export const metadata = {
  title: "The Park Buddy Shop",
  description:
    "The Park Buddy Store — posters, prints and merch — plus gear, camping equipment, navigation & safety, maps and guides, optics, and the America the Beautiful park pass. Opening in stages; Trip Book is live now.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  // ShopStore reads ?cat= via useSearchParams → needs a Suspense boundary.
  return (
    <Suspense>
      <ShopStore />
    </Suspense>
  );
}
