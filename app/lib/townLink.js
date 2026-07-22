// Client-safe town linking — every gateway town on the platform should be one
// tap from its page (owner call 2026-07-22: towns were dead text on park
// pages and unsearchable). This module deliberately does NOT import towns.js:
// that file pulls the megabyte-scale gateway JSONs, which belong on the
// server, not in every client bundle. The slug recipe here MUST stay in
// lockstep with townSlug() in app/lib/towns.js.
const ST_ABBR = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY" };

export function stateShort(s) {
  const v = String(s || "").trim();
  if (v.length === 2) return v.toUpperCase();
  return ST_ABBR[v] || "";
}

// Same recipe as towns.js townSlug(name, st): name + "-" + 2-letter state,
// lowercased, non-alphanumerics collapsed to hyphens. Callers pass names in
// every shape we have ("Estes Park", "Estes Park, CO", "Estes Park, Colorado")
// — a comma'd suffix IS the state, so split it off rather than double-slug it
// ("estes-park-co-co" was the bug that motivated this).
export function townHref(name, state) {
  const raw = String(name || "");
  const comma = raw.indexOf(",");
  const bare = (comma > -1 ? raw.slice(0, comma) : raw).trim();
  const embedded = comma > -1 ? raw.slice(comma + 1).trim() : "";
  const st = stateShort(embedded) || stateShort(state);
  const slug = (bare + (st ? "-" + st : ""))
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? "/towns/" + slug : null;
}
