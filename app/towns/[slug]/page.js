import { notFound } from "next/navigation";
import TownPage from "./TownPage";
import { townBySlug, allTowns } from "../../lib/towns";

// Pre-rendered from the generated data, so every town is a real indexable page
// rather than a client-side lookup. The whole point of this surface is that
// someone searching "where to stay near Rocky Mountain" can land on it.
export function generateStaticParams() {
  return allTowns().map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }) {
  const t = townBySlug(params.slug);
  if (!t) return { title: "Town not found · Park Buddy" };
  const s = t.serves[0];
  const near = s
    ? (s.inside ? "inside " + s.name : Math.round(s.distanceMi) + " miles from " + s.name)
    : "";
  return {
    title: `${t.name}, ${t.stateShort} — basecamp for ${s ? s.name : "the outdoors"}`,
    description:
      `${t.name} as a basecamp: ${near}. What's actually in town — places to sleep, eat and gear up — ` +
      `and the public land you can reach from it. Measured from the real boundary, never ranked.`,
    alternates: { canonical: "/towns/" + t.slug },
    openGraph: {
      title: `${t.name}, ${t.stateShort} | Park Buddy`,
      description: near ? `Basecamp ${near}.` : `Basecamp town.`,
      url: "/towns/" + t.slug,
    },
  };
}

export default function Page({ params }) {
  const town = townBySlug(params.slug);
  if (!town) notFound();
  return <TownPage town={town} />;
}
