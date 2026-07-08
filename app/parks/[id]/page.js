import ParkStatusV2 from "./ParkStatusV2";
import { getParks } from "../../lib/statusData";

// Per-park deep status page — /parks/:id. Per-park SEO metadata so each of the 63
// parks is a distinct, indexable page (was one shared static title for all).
export async function generateMetadata({ params }) {
  try {
    const parks = await getParks();
    const p = parks.find((x) => String(x.id) === String(params.id));
    if (p) {
      const name = p.name + " National Park";
      return {
        title: name + " — live conditions, trails & trip planner",
        description: "Today's GO / PREPARE / HOLD verdict for " + name + ": live weather, NWS alerts, wildfire & air quality, forecast, trails, campgrounds, scenic drives and what's nearby — from real sources.",
        alternates: { canonical: "/parks/" + params.id },
        openGraph: { title: name + " — live conditions | Park Buddy", description: "Is today the day? Live verdict + conditions for " + name + ".", url: "/parks/" + params.id },
      };
    }
  } catch {}
  return {
    title: "Live park status & conditions",
    description: "The deep live status for a national park: today's GO / PREPARE / HOLD verdict, NWS alerts, wildfire & air quality, trails, campgrounds and what's nearby.",
  };
}

export default function ParkPage({ params }) {
  return <ParkStatusV2 id={params.id} />;
}
