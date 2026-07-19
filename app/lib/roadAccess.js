// Which parks you cannot simply drive to.
//
// A distinct fact from "sparse map data", and important enough to surface before
// someone plans a drive: eight national parks have no road connection at all, and
// one is mostly roadless. Curated from well-established NPS access info — NOT
// inferred from live data, which isn't reliable for this.
//
// Lives here rather than inside a page because two Explore surfaces show it and a
// curated list copied into two files is a list that drifts.

const NO_ROAD_ACCESS = {
  "Gates of the Arctic": "No roads reach this park — access is by small plane, boat, or on foot only.",
  "Kobuk Valley": "No roads reach this park — access is by small plane, boat, or on foot only.",
  "Lake Clark": "No roads reach this park — access is by small plane or boat only.",
  Katmai: "No roads connect to this park — most visitors arrive by small plane or boat (e.g. to Brooks Camp).",
  "Isle Royale": "No roads or bridges reach this island park — access is by ferry or seaplane only; no cars are allowed on the island.",
  "Dry Tortugas": "No roads reach this park — it's 70 miles from Key West, accessible only by boat or seaplane.",
  "Virgin Islands": "No roads connect from the mainland U.S. — access is by ferry or flight to St. Thomas/St. John.",
  "Nat. Park of American Samoa": "No roads connect from the mainland U.S. — access is by flight to Pago Pago, American Samoa.",
};

// Has some limited/seasonal road access, but most of the park is roadless.
const LIMITED_ROAD_ACCESS = {
  "Wrangell–St. Elias": "Only a small part of this park is road-accessible (the unpaved McCarthy Road) — the rest is roadless wilderness reached by plane or on foot.",
};

export function roadAccessNote(name) {
  if (NO_ROAD_ACCESS[name]) return { level: "none", text: NO_ROAD_ACCESS[name] };
  if (LIMITED_ROAD_ACCESS[name]) return { level: "limited", text: LIMITED_ROAD_ACCESS[name] };
  return null;
}

// Short form for a badge. The long `text` is the tooltip / detail copy.
export function roadAccessLabel(note) {
  if (!note) return "";
  return note.level === "none" ? "No road access" : "Limited road access";
}
