# Park Buddy — Product Scope & Build Plan

_Last updated: 2026-07-04. This is the north-star document. Every new idea gets measured against it. Research-backed sections cite the deep-research pass of 2026-07-04 (24 sources, adversarially verified)._

---

## 1. What Park Buddy is (the one sentence)

**Park Buddy is the trip-planning and on-the-ground companion for U.S. national parks — it helps you decide where to go, find your way once you're there, and get everything you need for the trip (stays, a car, gear, maps, souvenirs).**

We are the trusted _layer on top of_ real federal data. Honesty about conditions is the brand — it's why people trust us, and trust is what makes the commerce work.

---

## 2. The unifying model — how everything links (the part that was unclear)

Don't think of this as five businesses bolted together. There is **one spine: the park.** Everything hangs off _"a park → what you do there → what you need for it."_

```
                         A PARK  (the hub — 63 parks today)
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
   GUIDE (free)          BOOK (affiliate)      SHOP (owned)
   the trust engine      commission revenue    margin + commission
      │                     │                     │
  • live verdict        • forest stays (cabins) • souvenirs, posters
  • trails + nav        • rental cars           • printed park maps
  • scenic drives       • (later) tours         • branded merch/apparel
  • lakes, campgrounds  • lodge "list with us"  • gear (affiliate curation)
  • off-road / OHV        intake (lead-gen)
```

- **Guide is the top of funnel.** It's free and rock-solid-honest. It's the reason people arrive and trust us. Never compromise it for revenue.
- **Book** makes money by handing off to partners (Booking.com, Expedia, Discover Cars). We never take payment or hold inventory — same pattern as our existing Recreation.gov "Book ↗" popup.
- **Shop** is the only place we own the transaction. It stays inventory-free via print-on-demand (merch/maps) and affiliate (gear).
- **The activity verticals** (hiking today; off-road / ATV / Jeep / moto / MTB / ski next) are all the _same trails system_ with new data layers — not new products.

**One rule to keep it coherent:** if a feature doesn't relate back to a park (or a scenic drive / gateway town near one), it's out of scope.

---

## 3. Recommended stack (decision-oriented, research-backed)

| Area | Recommendation | Why | Confidence |
|---|---|---|---|
| **E-commerce cart** | **Snipcart** | Drops into our existing Next.js/Netlify app via a script tag + HTML `data-` attributes — **no replatforming**. Handles PCI compliance, never stores card data. Sells **both physical goods and digital maps** natively. Cost: **2% per transaction** + gateway fees at ≥$1,000/mo sales; **flat $20/mo** under $1,000. | ✅ Verified |
| **Merch & maps (print-on-demand)** | **Printful** (quality/US apparel) + **Gelato** (posters, large-format maps) | POD = zero inventory, print-on-order. Attaches to Snipcart via a small JS integration. Printify = cheapest base cost (best margin, 900+ products) if margin matters more than control. Printful + Printify are merging (announced Nov 2024) but stay separate brands. | ✅ Verified |
| **Gear** | **Affiliate, never inventory** — Amazon Associates to start, AvantLink/Impact (REI, Backcountry, Public Lands) once approved | Amazon = 3% on "Outdoors/Tools/Sports," instant huge catalog, easy approval. AvantLink/Impact = real outdoor brands, higher commissions, needs approval. "Recommend gear" = curated affiliate lists, not a store we stock. | ✅ Verified (rates) |
| **Lodging (FOREST STAYS — no hotels)** | **Cabins / lodges / glamping only** — Vrbo (all rentals, native Cabins) + Booking.com **constrained to chalets/lodges/cabins/tree houses** + Hipcamp & Glamping Hub (on-brand specialists) + Rec.gov cabins/fire-lookouts (free credibility). **Airbnb is out** (affiliate program closed). | On-brand: a Hampton Inn is off-brand, an A-frame in the pines is the brand. Every deep-link must land on cabin inventory near the park, never a hotel list. Full plan → **`AFFILIATE-STAYS.md`**. | ⚠️ Pivot 2026-07-10; partner IDs pending |
| **Rental cars** | **Discover Cars affiliate** | Pays **70% of rental profit + 30% of full-coverage revenue (~$20/booking)**, with a **365-day cookie** — unusually generous. | ✅ Verified |
| **Lodge self-listing** | **Intake form → featured/lead-gen listing, NOT a transactional marketplace (at first)** | The moment third parties _sell through us_, marketplace-facilitator tax law can make **us** liable to collect & remit sales tax. Keep listings as lead-gen (they pay for placement / we affiliate-link them) to avoid that until it's worth the compliance cost. | ✅ Verified (risk) |
| **Off-road / OHV routes** | **USFS Motor Vehicle Use Map (MVUM)** ArcGIS feature layers (roads + trails) | **Free, open, government** GIS — accessed programmatically, exactly like our existing NPS trails / USGS lakes pattern. BLM publishes motorized-road GIS too. **Buildable now.** | ✅ Verified (source + access) |
| **Mountain-bike routes** | **Coming soon** — Trailforks / onX / MTB Project are **proprietary/licensable**, not open | onX Backcountry now runs on MTB Project data (proprietary). Needs a license/API deal → defer. | ⚠️ Proprietary |
| **Ski / backcountry-ski routes** | **Coming soon** — mostly proprietary | No clean open dataset comparable to MVUM. Defer pending a data partner. | ⚠️ Proprietary |

> **Killed by verification (do NOT assume these):** MVUM is _public government data_ but is **not** confirmed to be released under CC BY 4.0 — treat licensing as "US government / public domain, verify per-forest," not CC BY. AvantLink's exact API-key auth mechanism could not be verified. The "200 transactions **or** $100k" marketplace-facilitator threshold is **wrong as a blanket rule** — many states are dropping the transaction count (see §5).

---

## 4. The three revenue lines, concretely

### A. BOOK (affiliate hand-off) — fastest to revenue, zero PCI
- **Forest stays (cabins/glamping, NO hotels)**: deep-link to cabin/lodge/glamping inventory near the park — Vrbo (all rentals) + cabin-filtered Booking.com + Hipcamp/Glamping Hub + Rec.gov cabins/lookouts — anchored to the park's **gateway town** (we already compute these). Full plan → **`AFFILIATE-STAYS.md`**.
- **Rental cars**: Discover Cars deep-link, anchored to the **nearest airport / park approach**.
- **Tours & experiences** (later): Viator/GetYourGuide affiliate.
- Every affiliate surface carries a **visible FTC disclosure** (see §5).

### B. SHOP (owned e-commerce) — Snipcart + POD
- **Printed park maps & posters** (Gelato/Printful) — a natural fit; we already have the map/scenic data to design them.
- **Souvenirs & branded merch/apparel** (Printful) — park-specific designs, print-on-order.
- **Digital maps / trail guides** (Snipcart digital products) — instant delivery, ~100% margin.
- **Gear** = affiliate curation ("recommended for this trail/park"), _not_ stocked.

### C. PARTNER (lodges list with us) — lead-gen intake
- An **intake form** for lodge/cabin/outfitter owners: business details, photos, location, contact, availability link.
- We **vet + feature** them near the relevant park; monetize via placement fee or affiliate link.
- **Explicitly not a transactional marketplace yet** (avoids marketplace-facilitator tax liability — §5).

---

## 5. Legal & compliance guardrails (must-haves, verified)

- **FTC affiliate disclosure**: any material connection (commission) must be disclosed **clearly and conspicuously**, in plain language, where it can't be missed. A tiny "affiliate link" label alone can be judged **insufficient**. For Amazon, the **exact** required phrase is _"As an Amazon Associate, I earn from qualifying purchases."_ → Build a reusable disclosure component from day one; put it on every booking/gear surface + a site-wide policy page.
- **No fake reviews**: the 2024 FTC Rule (16 CFR part 465, effective Oct 21 2024) **prohibits buying/selling reviews or testimonials**. Our reviews must stay genuine user content. (We already gate reviews to signed-in users — keep it that way.)
- **Sales tax / economic nexus**: economic nexus generally triggers around **$100k in sales** into a state; **transaction-count thresholds are being eliminated** (16 states dropped the 200-transaction test as of Jan 1 2026 — it's increasingly dollar-only). Practically: POD providers (Printful et al.) often act as merchant/handler for physical-goods tax — **confirm who collects** before launch; don't assume it's us or them.
- **Marketplace facilitator**: there is **no single national definition**. If third parties _sell_ through us, facilitator laws can shift **tax collection onto our platform**. → This is the single biggest reason lodge listings start as **lead-gen, not transactions.**
- **Google Maps ToS** (already known): no caching map tiles for offline use. Unchanged.

---

## 6. Phased build plan (sequenced BEHIND stabilization)

> You flagged it correctly: **bugs first.** The Guide is the trust engine; monetizing on top of a shaky base backfires. Commerce is sequenced so each phase ships revenue without blocking the next.

**Phase 0 — Stabilize (now).** Clear the existing bug backlog. Guide must be solid before money rides on it. _No commerce work starts until this is healthy._

**Phase 1 — Landing page + Affiliate booking.** Redesign `/` to the full-vision bento + hero (Stay + Cars co-equal). Wire **Stays (Travelpayouts) + Rental Cars (Discover Cars)** — lowest effort, no PCI, real commission. Ship the **FTC disclosure component**. Everything not built yet shows a **"Coming soon"** tile.

**Phase 2 — Shop v1.** Snipcart + Printful/Gelato. Launch **printed maps, posters, a few souvenirs**, and **digital maps**. Add **gear as affiliate curation** (Amazon Associates).

**Phase 3 — Off-road / OHV vertical.** Extend the trails system with **USFS MVUM** (Jeep/ATV/dirt-bike routes) — free government GIS, same infra pattern as NPS trails. Flips the "Off-road" tile from Coming Soon → live.

**Phase 4 — Partner intake + gear expansion.** Lodge **"list with us"** intake form (lead-gen). Apply to **AvantLink/Impact** for REI/Backcountry gear (better commissions than Amazon).

**Phase 5 — Coming soon (needs data partners / bigger lift).** Mountain-bike routes (license Trailforks/onX/MTB Project), ski routes, tours/experiences affiliate, and — only if the volume justifies the tax compliance — a true transactional lodge marketplace.

---

## 7. Landing-page checklist (what the redesign advertises)

Each item tagged **[LIVE]** (build/works now), **[SOON]** (Coming-soon tile), or **[LATER]**.

**Guide (exists / near-term)**
- [x] Live "should I go now" verdict (GO / PREPARE / HOLD) — **[LIVE]**
- [x] Interactive parks map + filters — **[LIVE]**
- [x] Trails w/ elevation + offline navigation — **[LIVE]**
- [x] Scenic drives (141 byways) — **[LIVE]**
- [x] Lakes, campgrounds (w/ availability) — **[LIVE]**
- [x] Webcams, things-to-do, gateway towns — **[LIVE]**
- [ ] Off-road / OHV routes (Jeep/ATV/moto) — **[SOON → Phase 3, buildable]**
- [ ] Mountain-bike routes — **[SOON → Phase 5, needs license]**
- [ ] Ski / backcountry routes — **[SOON → Phase 5, needs license]**

**Book (affiliate)**
- [ ] Stays search (gateway-town anchored) — **[Phase 1]**
- [ ] Rental cars search (airport anchored) — **[Phase 1]**
- [ ] FTC disclosure component + policy page — **[Phase 1, required]**
- [ ] Lodge "list with us" intake form — **[Phase 4, lead-gen only]**
- [ ] Tours & experiences — **[LATER]**

**Shop (owned)**
- [ ] Snipcart cart integrated — **[Phase 2]**
- [ ] Printed park maps & posters (POD) — **[Phase 2]**
- [ ] Souvenirs & branded merch (POD) — **[Phase 2]**
- [ ] Digital maps / trail guides — **[Phase 2]**
- [ ] Recommended gear (affiliate) — **[Phase 2 Amazon → Phase 4 AvantLink]**

**Cross-cutting**
- [ ] Reusable affiliate-disclosure UI — **[Phase 1]**
- [ ] Sales-tax handling confirmed w/ POD provider — **[before Phase 2 launch]**
- [ ] "Coming soon" tile pattern (email capture to gauge demand) — **[Phase 1]**

---

## 8. What is explicitly OUT of scope (so we can say no)

- On-site payment processing for third-party lodge bookings (marketplace-facilitator tax liability).
- Holding physical inventory of anything (POD + affiliate only).
- Travel outside the national-parks gravity well (general hotel/flight search unrelated to a park).
- Any feature backed by data we'd have to invent — honesty is the brand.
- Caching Google Maps tiles for offline (ToS).
