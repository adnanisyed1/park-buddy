import PinesFeed from "./PinesFeed";

// Pines — short vertical video for parks. Full spec in PINES.md. Full-screen feed of
// real, on-site, place-anchored clips. Phase 1a: feed + data model + pipeline scaffolding
// (capture/upload lands with the Cloudflare account).
export const metadata = {
  title: "Pines — real clips from the wild",
  description:
    "Short, real videos from the national parks — every clip captured on-site and pinned to the exact place, right next to today's live conditions.",
  alternates: { canonical: "/pines" },
};

export default function PinesPage() {
  return <PinesFeed />;
}
