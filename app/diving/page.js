import CategoryPage from "../components/CategoryPage";

export const metadata = {
  title: "Diving the parks — coming soon",
  description:
    "Some national parks are best seen underwater — Dry Tortugas, Channel Islands, Biscayne, Virgin Islands. Dive sites, conditions and charters, coming soon.",
  alternates: { canonical: "/diving" },
};

export default function DivingPage() {
  return (
    <CategoryPage
      eyebrow="Diving the parks"
      title="Go"
      emphasis="under."
      blurb="A handful of national parks hide their best scenery underwater — the coral and shipwrecks of Dry Tortugas, the kelp forests of Channel Islands, the reefs of Biscayne and Virgin Islands. We're charting the dive sites, seasonal conditions and the charters that get you there."
      photoQ="Dry Tortugas National Park underwater|Channel Islands National Park kelp forest|Scuba diving coral reef"
      mode="soon"
      navActive="diving"
      features={["Dry Tortugas & Biscayne", "Channel Islands kelp", "Charters & conditions"]}
    />
  );
}
