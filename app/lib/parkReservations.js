// Parks that commonly run a timed-entry / vehicle / permit reservation system in peak
// season. There is no machine-readable NPS feed for this, so this is a curated list of
// well-established, recurring programs keyed by NPS unit code. Requirements and dates
// change year to year, so the copy is a heads-up to verify — never a guarantee. Keep the
// wording honest ("often", "check nps.gov") and update as programs change.
const RESERVATIONS = {
  arch: "Timed-entry ticket often required Apr–Oct.",
  zion: "Angels Landing needs a permit lottery; canyon shuttle required in season.",
  romo: "Timed-entry permit often required late May–mid Oct.",
  glac: "Going-to-the-Sun Road vehicle reservation often required in summer.",
  yose: "Peak-season day-use reservation may be required.",
  acad: "Cadillac Summit Road vehicle reservation required in season.",
  hale: "Sunrise viewing at the summit requires a reservation.",
  shen: "Old Rag day-use ticket required Mar–Nov.",
  mora: "Timed-entry reservation for the Paradise & Sunrise corridors in summer.",
  care: "Cathedral Valley / some backcountry may need a permit — check current rules.",
};

// A short reservation heads-up for a park by NPS unit code, or null if none is known.
export function reservationNote(parkCode) {
  if (!parkCode) return null;
  return RESERVATIONS[String(parkCode).toLowerCase()] || null;
}
