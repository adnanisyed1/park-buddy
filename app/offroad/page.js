import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Off-road & OHV",
  description: "Jeep, ATV and dirt-bike routes from the USFS Motor Vehicle Use Maps — difficulty, access, and dispersed camping. Coming soon.",
};

export default function OffroadPage() {
  return (
    <CategoryPage
      eyebrow="Off-road / OHV"
      title="Air down."
      emphasis="Past the pavement."
      blurb="Jeep, ATV and dirt-bike routes from the U.S. Forest Service Motor Vehicle Use Maps — difficulty ratings, seasonal access, and the dispersed camping along the way. Real federal data; we're charting it now."
      photoQ="Alpine Loop Colorado|Off-roading|Black Bear Pass"
      mode="soon"
      features={["USFS MVUM routes", "Difficulty & access", "Dispersed camping"]}
    />
  );
}
