import { getParks } from "../lib/statusData";
import ParksIndex from "./ParksIndex";

// /parks — the index for the "National Parks" filter choice: a themed grid of all
// 63 U.S. national parks on the design system, each tile linking to its live
// status. Part of the "an index page for every category" rollout (Phase C).
export const metadata = {
  title: "National Parks — all 63",
  description: "Every U.S. national park in one place — real photos, region filters, and a live status page for each. From Acadia to Zion.",
};

export default async function ParksPage() {
  const parks = await getParks();
  return <ParksIndex parks={parks} />;
}
