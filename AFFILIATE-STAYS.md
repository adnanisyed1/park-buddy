# Forest Stays — affiliate cabins plan (no hotels)

> Decision (2026-07-10): Park Buddy's lodging affiliate is **forest-themed only** —
> cabins, lodges, and glamping near a park. **No generic hotels.** A Hampton Inn is
> off-brand; a fire-lookout tower or an A-frame in the pines *is* the brand. This
> supersedes the old "stays (lodges/hotels) via Travelpayouts" line in `SCOPE.md`.
> Status: **PLAN ONLY — no code changed yet** (per user). Wire once partner IDs land.

---

## 1. The principle

The Guide is the trust engine; Book monetizes by handing off to partners. For lodging,
every hand-off must land the visitor on **cabin / lodge / glamping inventory near the
chosen park** — never a hotel list. If a click can surface a hotel, the deep-link is
wrong. We hold the affiliate accounts/keys (same as every other affiliate surface), we
never take payment or hold inventory, and every surface carries the FTC disclosure
(`SCOPE.md` §5).

---

## 2. Chosen partner mix (all four approved by user)

Tiered by how fast each can go live.

### Live-able now (no new approval needed to *start* wiring)
| Partner | Why it fits | No-hotels mechanism | Affiliate route |
|---|---|---|---|
| **Vrbo** (Expedia Group) | 100% private vacation rentals — *there is no hotel to filter out*. Native **Cabins** category. Huge inventory near every park. | Inherent: Vrbo lists no hotels, ever. Add the Cabins filter for focus. | Expedia Group Partner Solutions / CJ / Partnerize (verify current network). |
| **Booking.com** (already in use) | We already deep-link it; keep the account, just constrain it. | Lock property-type filter to **Chalets / Lodges / Cabins / Tree houses / Holiday homes** so hotels never appear. | Existing Booking.com Affiliate Partner account. |

### Apply first, then wire (the on-brand specialists — the "soul")
| Partner | Why it fits | Affiliate route (verify) |
|---|---|---|
| **Hipcamp** | "Airbnb for camping": cabins, glamping, land stays — the single most on-brand partner. | Hipcamp affiliate/referral (check Impact.com). |
| **Glamping Hub** | Cabins, treehouses, yurts, domes, A-frames — exact aesthetic. | Glamping Hub affiliate program. |

### Free credibility layer (no commission, link anyway)
| Partner | Why | Route |
|---|---|---|
| **Recreation.gov** cabins + **fire-lookout towers** | Government cabins and rentable staffed-lookout towers = peak authenticity. We already use Rec.gov for camping. | Direct deep-link, no affiliate (government). |
| **ReserveAmerica** | State-park cabins. | Direct deep-link. |

**Optional later (Tier-2 extensions):** AutoCamp (Airstream/cabin glamping *adjacent* to Yosemite/Zion/Joshua Tree/Catskills), Under Canvas (safari-tent glamping outside marquee parks), Getaway House (tiny woods cabins), KOA cabins.

### ⛔ Explicitly OUT
- **Airbnb** — the dream treehouse/A-frame inventory, but the open affiliate program is
  effectively **closed** (invite-only). Do not architect around it.
- **Generic hotel aggregators / OTA hotel search** — the whole point of this pivot.

---

## 3. Deep-link strategy (the "never a hotel" rule)

Anchor every search to the chosen park (we already compute park lat/lng + gateway town).

- **Vrbo** — search near the park with the **Cabins** category applied. Because Vrbo is
  all rentals, even an unfiltered link can't return a hotel; the filter just sharpens it.
- **Booking.com** — same gateway-town/park anchor as today, **plus a locked property-type
  filter** (chalets/lodges/cabins/tree houses/holiday homes) via the `nflt=ht_id%3D…`
  query param. ⚠️ The exact `ht_id` values must be **verified against a live Booking URL**
  before shipping — don't hardcode guessed IDs.
- **Hipcamp / Glamping Hub** — location-anchored search deep-link once affiliate params
  are issued.
- **Rec.gov cabins / lookouts** — filter Rec.gov search to cabin/lookout inventory types
  near the park (same pattern as the camping hand-off).

Every deep-link should degrade honestly: if a partner isn't approved yet, the card shows
"Coming soon / Notify me" rather than a dead or hotel-filled link (matches the current
`/book` CatCard pattern).

---

## 4. Site changes (when we build — NOT yet)

On `/book` (`app/book/BookHub.jsx`) and the Book ▾ header dropdown:
1. **Rename the "Stays" category → "Cabins & Lodges"** (or "Forest stays"). Update
   `CATS`, `CAT_TABS` (slug can stay `stays`), and the `BOOK_MENU` entry in `SiteHeader`.
2. **Rewrite `partnerUrl("stays", …)`** to build the cabin-constrained deep-links above,
   picking the live partner(s). Consider showing 2–3 partner buttons (Vrbo · Hipcamp ·
   Rec.gov cabins) instead of one generic "Search stays".
3. Rewrite the card copy to the forest voice ("Cabins, lodges & glamping near {park} —
   no hotels, ever").
4. Keep the FTC disclosure line already on the page.

Env/keys needed (user obtains; we never store secrets in chat): Vrbo/Expedia partner ID,
Booking.com affiliate ID (`aid`), Hipcamp + Glamping Hub affiliate params.

---

## 5. Open actions

- [ ] USER: apply to / confirm affiliate accounts — Vrbo (Expedia Partner), Hipcamp,
      Glamping Hub; confirm the Booking.com affiliate `aid` we already hold.
- [ ] Verify Booking.com property-type `ht_id` filter values against a live URL.
- [ ] Verify each specialist's current affiliate network (Impact / CJ / Partnerize / direct).
- [ ] THEN build: rename category + rewrite deep-links + forest voice + multi-partner buttons.
