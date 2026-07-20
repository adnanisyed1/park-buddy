// Lodging hand-offs for a gateway town.
//
// Links are DATA, not code. Everything Expedia issued us lives in PARTNER below;
// when they tell us to change a parameter, or hand us per-town minted links, you
// edit values here and no component changes.
//
// WHAT WAS VERIFIED (2026-07-19), so nobody has to re-derive it:
//   • Minted /affiliates/ links are REDIRECTS: each pass-through mints a fresh
//     per-click id (clickref) before landing on a normal search URL. Three
//     different links produced three different clickrefs.
//   • The builder can mint a DATELESS search ("hotel-search-estes-park-dateless"
//     → /Hotel-Search, 143 properties, no d1/d2), so minted links don't have to
//     go stale. The first Vrbo link only baked dates in because it was built as
//     a dated search.
//   • The landing URL's parameter set (affcid / clickref / ref_id / my_ad /
//     afflid) also survives on a search URL we construct ourselves — 130 real
//     properties for Estes Park with the params intact.
//
// Why minted still wins over constructed: a constructed URL pins ONE stale
// clickref forever, so per-click tracking (and possibly attribution — never
// confirmed in the dashboard) is degraded. Mint per town via the creator
// builder or Creator Toolbox; construction is the fallback for towns nobody
// has minted yet.
export const PARTNER = {
  // Constant across every link Expedia has issued us — this is the account.
  campaignId: "1011l435015",

  // Per-click reference. Minted links each carry their own; reusing one static
  // value is valid tracking but collapses per-town reporting into a single row.
  // Swap to a per-town value if Expedia ever gives us one.
  clickref: "1011lDn2s8m8",

  expediaAffcid: "US.DIRECT.PHG.1011l435015.0",
  vrboAffcid: "VRBO-US.DIRECT.PHG.1011l435015",
  utmCampaign: "theparkbuddy-0hcs_1101l252",
};

// Links minted by hand in the creator builder, keyed by town slug. These take
// precedence over anything we construct, because a link the partner generated is
// unambiguously theirs. Dates baked into a minted link eventually go stale — see
// STALE_AFTER — at which point we quietly fall back to construction rather than
// sending someone to a search for a fortnight that has already passed.
export const MINTED = {
  vrbo: {
    // slug: { url, expires }  — expires = last date the baked-in range is useful.
    // Omit expires entirely for a dateless link; it never goes stale.
    "estes-park-co": {
      url: "https://vrbo.com/affiliates/the_park_buddy/estespark",
      expires: "2026-08-08",
    },
  },
  expedia: {
    // Proof (2026-07-19) that the builder CAN mint a dateless search: this one
    // resolved to /Hotel-Search for Estes Park with 143 properties, no d1/d2,
    // and a FRESH clickref (1101lDC7zzvz — different from every prior link).
    // That last part is why minted beats constructed: the /affiliates/ redirect
    // mints a new click id per visitor, ours pins one stale id. Mint per town.
    "estes-park-co": {
      url: "https://expedia.com/affiliates/hotel-search-estes-park-dateless.OO7kPeS",
    },
  },
};

// Individual properties we vouch for, keyed by town slug — the "Park Buddy
// picks". Every entry is a link to ONE property's detail page, minted in the
// Creator Toolbox (browse to the property, Get link), because detail pages are
// the highest-converting page type Expedia offers and the mint guarantees the
// click tracks. `note` is OUR copy — why this one, in the site's voice; the
// partner's own blurb never appears here. Optional lat/lng lets the card say
// how far the property is from the boundary once we have it.
//
//   "estes-park-co": [
//     { partner: "Vrbo", name: "The A-Frame on Fall River",
//       url: "https://vrbo.com/affiliates/…", note: "…", lat: …, lng: … },
//   ],
export const PICKS = {
  "estes-park-co": [
    {
      partner: "Expedia",
      name: "Alpine Trail Ridge Inn",
      url: "https://expedia.com/affiliates/estes-park-hotels-alpine-trail-ridge-inn.46UfPUI",
      // Every claim checked against the property's own page on 2026-07-19:
      // 927 Moraine Ave; Expedia lists Beaver Meadows Visitor Center and the
      // park itself at a 1-minute drive; 8.8/10 from 1,016 reviews.
      note: "On Moraine Avenue a minute from the Beaver Meadows entrance — you're in the park before your coffee cools. 8.8/10 across a thousand-plus reviews.",
    },
  ],
};

export function townPicks(town) {
  return (town && PICKS[town.slug]) || [];
}

function trackingParams(kind) {
  const p = new URLSearchParams();
  p.set("clickref", PARTNER.clickref);
  p.set("affcid", kind === "vrbo" ? PARTNER.vrboAffcid : PARTNER.expediaAffcid);
  p.set("utm_campaign", PARTNER.utmCampaign);
  if (kind === "expedia") {
    // The minted homepage link carried these four alongside affcid; mirroring the
    // full set rather than a guessed subset, since we can't see what tracks.
    p.set("ref_id", PARTNER.clickref);
    p.set("afflid", PARTNER.clickref);
    p.set("my_ad", "AFF." + PARTNER.expediaAffcid);
    p.set("siteid", "1");
    p.set("langid", "1033");
  }
  return p;
}

// A minted link is only worth using while its baked-in dates still lie ahead.
function usableMinted(kind, slug, today) {
  const m = MINTED[kind] && MINTED[kind][slug];
  if (!m) return null;
  if (m.expires && today && m.expires < today) return null;
  return m.url;
}

// "Estes Park" + "Colorado" is what the partner's own destination search expects;
// latLong is what makes it land in the right place when the name is ambiguous
// (there are four Glendales in the towns data alone).
function destinationString(town) {
  return town.state ? `${town.name}, ${town.state}` : town.name;
}

export function vrboUrl(town, today) {
  const minted = usableMinted("vrbo", town.slug, today);
  if (minted) return minted;
  const p = trackingParams("vrbo");
  p.set("destination", destinationString(town));
  p.set("latLong", `${town.lat},${town.lng}`);
  p.set("adults", "2");
  return "https://www.vrbo.com/search?" + p.toString();
}

export function expediaUrl(town, today) {
  const minted = usableMinted("expedia", town.slug, today);
  if (minted) return minted;
  const p = trackingParams("expedia");
  p.set("destination", destinationString(town));
  p.set("latLong", `${town.lat},${town.lng}`);
  p.set("adults", "2");
  return "https://www.expedia.com/Hotel-Search?" + p.toString();
}

// The offers a town actually shows. Deliberately a small, ordered list rather
// than every partner in the plan doc: a card only exists here once its links are
// real. Hipcamp and Glamping Hub are in AFFILIATE-STAYS.md and stay out of this
// array until those accounts are approved — an absent card is honest, a
// "coming soon" card pretending to be inventory is not.
export function lodgingOffers(town, today) {
  if (!town || !isFinite(town.lat) || !isFinite(town.lng)) return [];
  const inside = town.serves && town.serves[0] && town.serves[0].inside;
  const land = town.serves && town.serves[0] ? town.serves[0].name : null;

  return [
    {
      key: "vrbo",
      partner: "Vrbo",
      title: "Cabins & whole-home rentals",
      // True by construction, not marketing: Vrbo lists no hotels at all.
      blurb: "Vrbo carries no hotels, so everything here is a cabin, lodge or whole home.",
      url: vrboUrl(town, today),
      cta: `Cabins in ${town.name}`,
    },
    {
      key: "expedia",
      partner: "Expedia",
      title: "Lodges, inns & hotels",
      blurb: inside && land
        ? `Rooms in ${town.name} — the closest beds to ${land}, which the town sits inside.`
        : `Rooms in ${town.name}, for the nights you want a front desk and a hot breakfast.`,
      url: expediaUrl(town, today),
      cta: `Stays in ${town.name}`,
    },
  ];
}
