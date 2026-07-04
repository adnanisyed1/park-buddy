"use client";

import { useEffect, useState } from "react";
import { fetchElevationProfile } from "../lib/elevationClient";
import { estimateTimeLabel } from "../lib/trailStats";

// Glassy stat-chip row shown INSIDE the hero (over the photo). Length is known
// up front (server prop); elevation gain / high point / trailhead / est. time
// are derived from the client-only elevation profile, so they fill in once the
// Google Elevation fetch resolves. Styling matches HeroBand's own chip look.
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const serif = "var(--font-spectral), 'Spectral', Georgia, serif";

function Chip({ label, value, unit }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ background: "rgba(251,246,234,.07)", border: "1px solid rgba(228,190,120,.24)", borderRadius: 14, padding: "12px 14px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#c9bf9f" }}>{label}</div>
      <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.55rem", color: "#fbf6ea", marginTop: 3, lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: ".5em", color: "#c9bf9f" }}> {unit}</span>}
      </div>
    </div>
  );
}

export default function TrailHeroStats({ trailKey, path, lengthMi }) {
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    let on = true;
    fetchElevationProfile(trailKey, path).then((p) => { if (on) setProfile(p); });
    return () => { on = false; };
  }, [trailKey, path]);

  const loading = profile === undefined;
  const gainFt = profile && profile.gainFt;
  const points = (profile && profile.points) || [];
  const hasElev = !loading && gainFt != null && points.length > 0;
  const highFt = hasElev ? Math.round(Math.max(...points.map((p) => p.ft))) : null;
  const trailheadFt = hasElev ? Math.round(points[0].ft) : null;
  const dash = loading ? "…" : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
      <Chip label="Length" value={lengthMi > 0 ? lengthMi : null} unit="mi" />
      <Chip label="Elev. gain" value={hasElev ? gainFt.toLocaleString() : dash} unit={hasElev ? "ft" : ""} />
      <Chip label="High point" value={hasElev ? highFt.toLocaleString() : dash} unit={hasElev ? "ft" : ""} />
      <Chip label="Trailhead" value={hasElev ? trailheadFt.toLocaleString() : dash} unit={hasElev ? "ft" : ""} />
      <Chip label="Est. time" value={hasElev && lengthMi > 0 ? estimateTimeLabel(lengthMi, gainFt) : dash} />
    </div>
  );
}
