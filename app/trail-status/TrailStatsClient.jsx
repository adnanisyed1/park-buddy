"use client";

import { useEffect, useState } from "react";
import { fetchElevationProfile } from "../lib/elevationClient";
import { estimateTimeLabel, estimateDifficulty } from "../lib/trailStats";
import { BigStat } from "../components/StatusShell";

// Renders as siblings inside the SAME <StatGrid> as the server-rendered
// Distance stat — React fragments participate directly in the parent's CSS
// grid, so these just slot in next to it once the client fetch resolves.
export default function TrailStatsClient({ trailKey, path, lengthMi }) {
  const [profile, setProfile] = useState(undefined); // undefined = loading

  useEffect(() => {
    let on = true;
    fetchElevationProfile(trailKey, path).then((p) => { if (on) setProfile(p); });
    return () => { on = false; };
  }, [trailKey, path]);

  if (profile === undefined) {
    return (
      <>
        <BigStat label="Elevation gain" value="…" />
        <BigStat label="High point" value="…" />
        <BigStat label="Trailhead" value="…" />
      </>
    );
  }

  const { gainFt, points } = profile;
  if (gainFt == null || !points.length) return null; // unavailable — omit rather than show fake data

  const highFt = Math.round(Math.max(...points.map((p) => p.ft)));
  const trailheadFt = Math.round(points[0].ft);
  const canEstimate = lengthMi > 0;

  return (
    <>
      <BigStat label="Elevation gain" value={gainFt.toLocaleString()} unit="ft" />
      <BigStat label="High point" value={highFt.toLocaleString()} unit="ft" />
      <BigStat label="Trailhead" value={trailheadFt.toLocaleString()} unit="ft" />
      {canEstimate && <BigStat label="Est. time" value={estimateTimeLabel(lengthMi, gainFt)} />}
      {canEstimate && <BigStat label="Est. difficulty" value={estimateDifficulty(lengthMi, gainFt)} />}
    </>
  );
}
