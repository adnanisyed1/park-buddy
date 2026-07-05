import { getForests } from "../lib/statusData";
import ForestsIndex from "./ForestsIndex";

// /forests — the index for the "National Forests" filter choice: a themed grid of
// the U.S. national forests, grouped by region. Part of the "index page for every
// category" rollout (Phase C), on the shared design system + UI kit.
export const metadata = {
  title: "National Forests",
  description: "The U.S. national forests — millions of acres of public land for hiking, camping, and off-road, grouped by region with real photos.",
};

export default async function ForestsPage() {
  const forests = await getForests();
  return <ForestsIndex forests={forests} />;
}
