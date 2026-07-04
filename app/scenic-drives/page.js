import { getByways } from "../lib/statusData";
import ScenicIndex from "./ScenicIndex";

export const metadata = {
  title: "Scenic drives — America's Byways",
  description: "The most beautiful drives in America — federally designated National Scenic Byways and All-American Roads, with real photos, road status, and the parks and trails along each route.",
};

export default async function ScenicDrivesPage() {
  const drives = await getByways();
  return <ScenicIndex drives={drives} />;
}
