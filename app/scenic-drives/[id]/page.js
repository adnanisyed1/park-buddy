import Link from "next/link";
import { getByway, getBywayDetail, getNearby, getParks, nearestPark } from "../../lib/statusData";
import ScenicDrive from "./ScenicDrive";

export async function generateMetadata({ params }) {
  const drive = await getByway(params.id);
  if (!drive) return { title: "Scenic drive", robots: { index: false } };
  return {
    title: drive.name + " — Scenic Drive",
    description: drive.name + " (" + drive.states + "): a " + (drive.tier === "all-american" ? "top-tier All-American Road" : "National Scenic Byway") + " — road status, photos, and the parks and trails along the route.",
  };
}

function mid(path) {
  if (!Array.isArray(path) || !path.length) return null;
  return path[Math.floor(path.length / 2)];
}

export default async function ScenicDriveDetailPage({ params }) {
  const drive = await getByway(params.id);
  if (!drive) {
    return (
      <div style={{ minHeight: "60vh", background: "#11281d", color: "#f3ede0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "var(--pb-sans)", padding: 40, textAlign: "center" }}>
        <div style={{ fontFamily: "'Spectral', Georgia, serif", fontSize: "1.4rem" }}>That scenic drive isn&apos;t in our index yet.</div>
        <Link href="/scenic-drives" style={{ color: "#e4be78", fontWeight: 700, textDecoration: "none" }}>← Browse all scenic drives</Link>
      </div>
    );
  }

  // Real cross-links along the route: the nearest national park + nearby trails,
  // lakes, and campgrounds — all internal, all photo-tiled.
  const [nearby, parks, detail] = await Promise.all([
    getNearby(drive.lat, drive.lng, {}),
    getParks(),
    getBywayDetail(params.id),
  ]);
  const park = nearestPark(parks, drive.lat, drive.lng);
  const cross = [];
  // Reliable photo backstop for the location tiles (trails, lakes, camps rarely have
  // their own article) — the nearest national park's article, which always does.
  const parkFallback = park ? ((/national park/i.test(park.name) ? park.name : park.name + " National Park") + "|" + park.name) : "";
  if (park && park.dist <= 60) {
    const full = /national park/i.test(park.name) ? park.name : park.name + " National Park";
    cross.push({ name: full, type: "National Park", href: "/parks/" + park.id, q: [full, park.name].join("|"), lat: park.lat, lng: park.lng });
  }
  (nearby.trails || []).slice(0, 3).forEach((t) => {
    const m = mid(t.path);
    cross.push({ name: t.name, type: "Trail", href: "/trail-status?trail=" + t.id + "&park=" + encodeURIComponent(t.unitCode || drive.parkCode || ""), q: [t.name, t.unitName || ""].filter(Boolean).join("|"), lat: m ? m[0] : null, lng: m ? m[1] : null, fallback: parkFallback });
  });
  (nearby.lakes || []).slice(0, 2).forEach((l) => {
    cross.push({ name: l.name, type: "Lake", href: "/lake-status?" + new URLSearchParams({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind || "lake" }).toString(), q: l.name, lat: l.lat, lng: l.lng, fallback: parkFallback });
  });
  (nearby.camps || []).slice(0, 2).forEach((c) => {
    cross.push({ name: c.name, type: "Campground", href: "/campground-status?" + new URLSearchParams({ name: c.name, lat: c.lat, lng: c.lng, type: c.type || "", url: c.url || "" }).toString(), q: c.name, lat: c.lat, lng: c.lng, fallback: parkFallback });
  });

  // Hero photo backstop: a regional national park (≤120 mi — park centroids sit far
  // from a byway even when they're adjacent, e.g. Beartooth↔Yellowstone) when the
  // byway itself has no Wikipedia lead image, so the hero is never a blank panel.
  const heroFallback = park && park.dist <= 120 ? parkFallback : "";
  return <ScenicDrive drive={drive} detail={detail} cross={cross.slice(0, 8)} heroFallback={heroFallback} />;
}
