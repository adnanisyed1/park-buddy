import Storefront from "./Storefront";

export const metadata = {
  title: "Park Buddy Outfitters — Premium Outdoor Apparel",
  description:
    "Premium outdoor apparel for every backcountry crew — national park fans, jeepers, overlanders, hikers, mountain bikers, ATV/UTV riders and surfers. Heavyweight blanks, original in-house trail-crest art.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <Storefront />;
}
