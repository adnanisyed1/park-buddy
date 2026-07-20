# Gateway Towns — design brief

For Figma / Claude Design. Everything below is grounded in data that **exists today**;
the "Do not design" list at the end is as important as the rest.

---

## 1. What this is

A **basecamp** is the town you actually sleep, eat and gear up in — Vail for White River
National Forest, Estes Park for Rocky Mountain, Telluride for the San Juans. Today the app has
8,508 towns ranked by distance from a park's centroid, which is why Gypsum outranks Vail. That
data is being replaced; this brief is for the surface that shows the result.

**The job of the page:** make someone want to go, and give them the facts to decide. It should
feel like a good guidebook spread, not a directory listing or a hotel search result.

**Two pages:**
- `/towns` — the index. Browsable, visual, the showcase.
- `/towns/[slug]` — one town. The full case for basing there.

---

## 2. The one rule that shapes everything

**We show facts and let the reader choose. We never rank towns by quality.**

Park Buddy's whole promise is that it doesn't invent things — it says "we don't have a live
read" rather than guessing. A page that declares Vail the "#1 basecamp" breaks that, and any
automated ranking we could build would smuggle in either crowd bias (recommending whatever is
busiest, to people trying to escape crowds) or commercial bias (we're joining Expedia and
Viator affiliate programmes).

So: **every town gets its own page and its attributes. Sorting is the reader's.**
Default sort is distance to the boundary — objective, and nobody can argue with it.

Design consequence: **no badges like "Best", "Top pick", "Editor's choice", no star ratings, no
1–5 scores.** Numbers are counts of real things.

---

## 3. The data that actually exists

Per town, from `app/lib/town-attributes.json` + `gateway-ranked.json`:

| field | example | notes |
|---|---|---|
| `name` | "Telluride" | |
| `place` | town / city / village / hamlet | OSM settlement type |
| `population` | 2,600 | **often null** — design must not depend on it |
| `counts.lodging` | 19 | places to sleep within 3km |
| `counts.food` | 20 | restaurants, cafés, bars |
| `counts.outfitter` | 5 | gear shops, rentals |
| `counts.culture` | 12 | museums, galleries, historic sites |
| `counts.groceries` | 3 | supermarkets |
| `tags` | ski · hot springs · brewery · historic | present/absent only, never scored |
| `serves` | White River NF, San Juan NF | the places it's a basecamp for |
| `edgeMi` / `inside` | −4.9 (inside) or 4.4 (outside) | distance to that place's boundary |

Real examples to design against — use these, they're accurate:

```
Vail            town     58 sleep · 82 eat · 48 gear   ski, brewery      INSIDE White River NF by 13mi
Breckenridge    town     37 sleep · 98 eat · 47 gear   ski, brewery      INSIDE White River NF by 5mi
Estes Park      town     46 sleep · 59 eat ·  3 gear   ski, brewery      0.8mi from Rocky Mountain NP
Ouray           village  27 sleep · 22 eat ·  1 gear   hot springs, ski  8.4mi from San Juan NF
Telluride       town     19 sleep · 20 eat            ski, hot springs   4.4mi from San Juan NF
Silverton       village  11 sleep ·  5 eat            ski               1.2mi from San Juan NF
Grand Lake      village   6 sleep · 16 eat                              0.2mi from Rocky Mountain NP
```

Note the range: Vail has 58 places to sleep, Grand Lake has 6. **The design must make a
6-lodging village look appealing, not broken.** Small is a feature — that's Ouray and Silverton.

Also from `place-geo.json`: acreage and neighbours of every place a town serves, e.g. Rocky
Mountain NP 267k acres, Arapaho & Roosevelt NF 2.5M acres, "shares a boundary".

**Photos:** `/api/photo?name=Telluride, Colorado` returns a Wikipedia image. Verified working
for Telluride, Vail, Estes Park, Silverthorne, Basalt and Rifle. **But a photo existing is not a
photo being good** — a small town's Wikipedia lead image can be a road sign or a courthouse. The
layout has to survive a mediocre or oddly-cropped hero, and needs a designed no-photo state.

---

## 4. `/towns` — the index

The showcase. Should feel like opening a magazine, not a spreadsheet.

**Hero.** One line about what a basecamp is and why it matters — that the town is where the trip
actually happens. Real count: "N towns, across N national parks and forests."

**The grid.** Photo-led cards. Each card carries:
- photo, name, state
- what it's a basecamp for — *"Rocky Mountain NP · 0.8 mi"* or *"White River NF · inside"*
- 2–3 character tags (ski, hot springs, historic, brewery)
- a compact fact line: `46 sleep · 59 eat`

**Filters, not rankings.** By state, by character tag, by what it serves (park / forest / both),
by size. Sort control offered to the reader: nearest to boundary (default), most places to
stay, smallest. *No "best" sort.*

**Groups worth designing as editorial rows** — these are honest, data-derived groupings, not
opinions:
- *Towns inside the forest* — Vail, Breckenridge, Frisco genuinely sit within the boundary
- *Ski towns* · *Hot spring towns* · *Historic mining towns* — from tags
- *Small basecamps* — under 10 lodgings, for people who don't want Vail
- *One base, several parks* — towns serving 3+ places (this is a genuinely useful trip-planning idea)

---

## 5. `/towns/[slug]` — one town

**Hero.** Photo, name, state, and the single most important line: what this town is the gateway
to, with the distance. Design for **multiple** places — Medford serves 9.

**"Why base here"** — the counts, as designed objects rather than a table. Sleep / eat / gear /
culture / groceries. These are the page's most repeated element; they need to look considered,
and they need to look fine at 58 *and* at 6. Consider a small-multiple or unit-based treatment
rather than big numerals, so a 6 doesn't read as failure.

**Character strip.** ski · hot springs · brewery · historic. Small, editorial, not gamified.

**What you can reach from here.** Each place with its type, its distance, and its size, e.g.
`Rocky Mountain NP · 267k acres · 0.8 mi` / `Arapaho & Roosevelt NF · 2.5M acres · borders it`.
**This is the page's best idea:** most visitors don't know the forest is there, it's usually
many times larger than the park, and it typically has no timed entry, no fee and dispersed
camping. Design that contrast — it's the thing a local would tell you.

**Map.** The town, and the public land around it, so the relationship is visible rather than
described.

**Then:** where to stay (affiliate later — leave a slot, and see the disclosure note below),
things to do, and the trails/campgrounds reachable from here.

---

## 6. States that must be designed

Not optional — these will occur constantly.

- **No photo** for this town.
- **Sparse town** — 6 lodging, 0 outfitters. Must look intentional, not broken. A zero is
  "none listed", never a 0/10 score.
- **No blurb.** We have hand-written blurbs for **22 places only** (Springdale, Estes Park,
  Jackson…), all national parks, **none for forests**. So Vail and Telluride have no prose.
  The page must be complete and attractive with *no descriptive text at all*, and blurbs should
  be an enhancement where they exist — never a hole where they don't.
- **Serves one place** vs **serves nine**.
- **Loading** — counts and photos arrive at different times.

---

## 7. Visual system

- Use the existing `--pb-*` tokens. **Both light and dark themes** — the site has a working
  toggle and recent bugs came from hardcoded colours. Never hardcode hex except over photography.
- Fonts already in use: `--pb-serif` display, `--pb-sans` body, `--pb-mono` for small-caps labels
  and figures. Use tabular numerals wherever counts align.
- Reference for tone: the park page hero and the "PUBLIC LAND HERE" strip in the Explore panel.
- Mobile is not an afterthought — the phone layout is the common case for someone planning in bed.

---

## 8. Do NOT design

Things we don't have. Designing them creates pressure to invent them.

- ⛔ **Star ratings, review scores, "best of" badges, rankings** — see §2.
- ⛔ **Prices, availability, "from $189/night"** — no inventory data.
- ⛔ **Written descriptions for every town** — 22 exist, all parks.
- ⛔ **Population for every town** — frequently null.
- ⛔ **Weather on the town** — we have it per park, not per town.
- ⛔ **Drive times** — everything is straight-line today.
- ⛔ **Photo galleries** — one Wikipedia image per town, not a set.
- ⛔ **User reviews / photos of towns** — doesn't exist.

## 9. Commercial disclosure

Expedia and Viator affiliates are coming. The rule agreed: **affiliate data never influences
which towns we show or their order.** Booking is a separate module from the recommendation, and
where commission exists it is disclosed on the page. Please design an unobtrusive but real place
for that disclosure — it should not look like an afterthought.
