import ParkStatusV2 from "../../parks/[id]/ParkStatusV2";

// Per-state-park deep status page — /state-parks/:id (id = the namespaced destinations
// row id, e.g. state:me-baxter-state-park). Reuses the park-status component in its
// state-park mode (kind="state_park"): it resolves the park from the Supabase
// destinations table and wires the same lat/lng-based live data — verdict, NWS alerts,
// wildfire, air, forecast, trails, nearby — while skipping the NPS-only pieces.
// This replaces the old legacy light-themed /park-status?dest= embed for state parks.

// The id carries a ":" namespace separator which links encode as %3A — decode it so
// both the DB lookup and the readable name always see the real "state:xx-slug" id.
function decodeId(raw) {
  try { return decodeURIComponent(String(raw || "")); } catch { return String(raw || ""); }
}

export async function generateMetadata({ params }) {
  const id = decodeId(params.id);
  // Readable name from the id slug (strip "state:" + the 2-letter state prefix).
  let name = id
    .replace(/^state:/, "")
    .replace(/^[a-z]{2}-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  if (name && !/state park/i.test(name)) name += " State Park";
  const readable = name || "State Park";
  return {
    title: readable + " — live conditions & trip planner",
    description: "Today's GO / PREPARE / HOLD verdict for " + readable + ": live weather, NWS alerts, wildfire & air quality, forecast, trails and what's nearby — from real sources.",
    alternates: { canonical: "/state-parks/" + params.id },
    openGraph: { title: readable + " — live conditions | Park Buddy", description: "Live verdict + conditions for " + readable + ".", url: "/state-parks/" + params.id },
  };
}

export default function StateParkPage({ params }) {
  return <ParkStatusV2 id={decodeId(params.id)} kind="state_park" />;
}
