import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Ski & snow",
  description: "Backcountry and resort access, snow reports, and avalanche awareness. Season prep is underway — get notified when it opens.",
};

export default function SkiPage() {
  return (
    <CategoryPage
      eyebrow="Ski & snow"
      title="Chase the storm."
      emphasis="Earn the turns."
      blurb="Backcountry lines and resort access, snow reports, and avalanche awareness — plus the road status that decides whether you get to the trailhead at all. Season prep is underway; get notified when it opens."
      photoQ="Backcountry skiing|Ski touring|Berthoud Pass"
      mode="soon"
      features={["Snow report", "Avalanche awareness", "Access road status"]}
    />
  );
}
