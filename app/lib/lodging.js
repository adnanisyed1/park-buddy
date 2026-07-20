// Lodging hand-offs for a gateway town.
//
// Links are DATA, not code. Everything Expedia issued us lives in PARTNER below;
// when they tell us to change a parameter, or hand us per-town minted links, you
// edit values here and no component changes.
//
// WHAT WAS VERIFIED (2026-07-19), so nobody has to re-derive it:
//   • The creator builder mints one link at a time and bakes fixed dates into it
//     ("estespark" came out pinned to 25 Jul – 8 Aug 2026, which goes stale).
//   • The minted Expedia homepage link resolves to expedia.com carrying a standard
//     Partnerize/PHG parameter set (affcid / clickref / ref_id / my_ad / afflid).
//   • Those parameters ALSO survive on a search URL we build ourselves:
//     /Hotel-Search?destination=…&latLong=… returned 130 real properties for
//     Estes Park with affcid and clickref intact, and no dates required.
//
// WHAT IS NOT VERIFIED: that a constructed link is *attributed* a commission.
// Parameters surviving in the URL bar is not proof the sale tracks — only the
// partner dashboard can confirm that. So the module is built to run either way:
// a minted link wins when we have one, and construction is the fallback.
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
    // slug: { url, expires }  — expires = last date the baked-in range is useful
    "estes-park-co": {
      url: "https://vrbo.com/affiliates/the_park_buddy/estespark",
      expires: "2026-08-08",
    },
  },
  expedia: {},
};

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
