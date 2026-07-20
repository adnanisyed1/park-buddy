import TownsIndex from "./TownsIndex";

// The basecamp directory. Indexable — unlike Explore, this is content rather
// than an app surface, and it's the kind of page people search for by name
// ("towns near Rocky Mountain").
export const metadata = {
  title: "Gateway Towns — where to base for every national park & forest",
  description:
    "The town you actually sleep, eat and gear up in. Measured from the real boundary of the park or forest it serves, and described by what's genuinely there — never ranked.",
  alternates: { canonical: "/towns" },
  openGraph: {
    title: "Gateway Towns | Park Buddy",
    description:
      "Basecamp towns for America's national parks and forests — measured from the real boundary, described by what's actually there.",
    url: "/towns",
  },
};

export default function TownsPage() {
  return <TownsIndex />;
}
