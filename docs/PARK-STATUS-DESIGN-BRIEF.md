# Park Status page — design brief

`/parks/[id]` · also serves `/forests/[slug]` and `/state-parks/[id]` from the same component.
For Figma / Claude Design. Everything below is what the page **actually renders today** from
**live** sources. The "Do not design" list at the end matters as much as the spec.

---

## 1. What this page is

The single most important page in the product. Someone is deciding **whether to go to this place,
today or this weekend** — and the promise is that we answer honestly from official feeds rather
than guessing.

It is not a brochure and not a booking funnel. It's a status board with a guidebook's manners.

**The whole page hangs off one question:** *can I go, and what will it be like?*

---

## 2. The non-negotiable: this page is about perishable truth

Everything here is live and can be wrong tomorrow. That shapes the design more than anything else:

- **Every fact needs a visible source and recency.** The footer already credits NPS / NWS / USGS /
  AirNow. Design where "as of 14:20" lives.
- **Absence must look different from silence.** "No alerts" and "we couldn't reach the alert feed"
  are completely different statements and must never render the same. This has bitten us before.
- **An estimate must be labelled.** Drive times, hike times and difficulty are computed, not
  published. They say "est." today and must keep saying it.
- **The verdict is a judgement we own.** It comes from a scoring engine over real weather and
  alerts. It must never look like a rating of the place — it's a read on *today*.

---

## 3. Page structure as built

### Hero — full-bleed photograph
- Eyebrow: `NATIONAL PARK · COLORADO` (or National Forest / State Park)
- Name, large serif
- Actions: **+ Add to trip** · **Save** (heart) · **Ask Park Buddy** · **🔔 Alerts**
- **Verdict card**, floated over the photo, right side

**Critical:** the hero sits on a dark photo in *both* themes. Every colour inside it is literal,
not tokenised — we shipped a bug where the park's own name rendered dark-green-on-dark-photo in
light mode. The verdict card is the exception: it's a themed surface *on* the photo.

### Verdict card — the most important object on the site
```
● TODAY'S CALL
Good to go                     ← from the engine, five tiers
Solid conditions for a visit — a little prep and you're set.
────────────────────────────
76°F   Sunny · 20 mph wind
[Extreme heat 97°] [Clear skies]   ← reason chips, only when they add something
```
Five tiers: *Great day to go · Good to go · Go prepared · Maybe hold off · Better another day.*
Colour comes from `--pb-go` / `--pb-prepare` / `--pb-hold`, which **flip between themes** — the
bright dark-mode green is illegible on white.

### Sticky tab bar
`Overview · Conditions · Trails & permits · Plan · Nearby`

Sticks under the floating nav pill. Recently reworked: weight carries the active state as well as
colour, and the rule sits on the bar's own bottom border so the active tab reads as continuous
with the panel below. Inactive tabs must clear **4.5:1** — we had them at 3.74:1.

### Overview
Pines rail (place-locked short video, honest count or an invitation) · park description from NPS ·
activity chips · things to do with durations · official site link.

### Conditions — the deepest tab
- **Live conditions** — temperature, sky, wind
- **Next 12 hours · NWS forecast** — hourly strip of animated weather tiles
- **7-day** strip
- **Weather alerts · NWS** — full alert text, headline and instructions
- **Air quality · AirNow** — AQI, category, reporting area
- **Wildfires · within 80 mi** — name, acres, distance
- **River flow · USGS**
- **Roads & access** — NPS or USFS road status
- **Live webcams** — NPS & partner cams
- Sun/moon times
- **Alert subscription card** — email me when: *verdict flips · permit drops · road & pass opens ·
  flash-flood watch · first snow*

This tab is long by nature. **The design problem is hierarchy, not content** — what does someone
scanning at 6am actually need first? Quiet states should collapse: an alert deserves a bordered
block; the *absence* of one deserves a line. We just did this in Explore and it removed ~20% of
the panel height.

### Trails & permits
Trail rows with computed length, elevation gain, est. time and est. difficulty; seasonal flags;
permit/closure disclosure.

### Plan
Getting there · directions · what to do · campgrounds & availability (Recreation.gov) ·
safety & regulations · official site.

### Nearby
Radius control, then a distance-sorted mix of nearby parks, forests, towns, campgrounds and lakes
with drive-time estimates.

---

## 4. Three modes, one component

The same page renders a **national park**, a **national forest** and a **state park**. The design
must work when large parts are missing:

- Only NPS units have descriptions, activities, things-to-do and official cams. A forest shows
  none of that.
- A state park often has neither. It must still look finished, not gutted.
- Copy has to adapt: "National Park Service" vs "USDA Forest Service" vs "State park agencies".

**Design the forest and state-park versions explicitly.** They're the majority of places, and
they're where a park-shaped layout falls apart.

---

## 5. New module to design: PUBLIC LAND HERE

Built and live in Explore; belongs on this page too.

```
PUBLIC LAND HERE
Rocky Mountain                267k acres    you're looking at this
Medicine Bow-Routt NF         4.6M acres    shares a boundary
Arapaho and Roosevelt NFs     2.5M acres    shares a boundary
```

**41 of 63 national parks border or sit inside a national forest, and almost no visitor knows.**
The size contrast is the payload — the famous bit is the small one, and the land wrapped around it
usually has no timed entry, no fee and allows dispersed camping. This is the page's most useful
non-obvious fact.

Deliberately **no "9× bigger" multiple** — NPS acreage is federal fee land and USFS is the
administrative boundary, so dividing them compares two different measurements.

---

## 6. States that must be designed

- **Loading, in stages.** Photo, verdict, conditions and trails all arrive separately. The page is
  never blank-then-complete.
- **A feed is down.** Each section fails independently and says which one.
- **Genuinely empty.** Acadia has **zero** trails in the NPS dataset — real upstream gap, not a
  bug. "No mapped trails here yet" must look deliberate.
- **Alert active** vs **no alerts** vs **couldn't check.** Three states, never two.
- **Forest / state park** with no description, no cams, no things-to-do.

---

## 7. Visual system

- `--pb-*` tokens only, **both themes**. Every colour bug reported this week was a hardcoded
  dark-theme value surviving into light mode.
- `--pb-serif` Cormorant Garamond display · `--pb-sans` Inter · `--pb-mono` Space Mono for
  small-caps labels and figures. Tabular numerals for anything that aligns.
- **Over the hero photograph, colours stay literal** — `#f4f1ea` ink, `#e8cf9a` gold — because a
  photo is dark in both themes.
- Mobile first for this page especially: it's read at a trailhead on a phone, often on bad signal.

---

## 8. Do NOT design

- ⛔ **Star ratings or scores for the place.** The verdict rates *today*, never the park.
- ⛔ **Prices or booking inventory.** Campground availability links out; we hold no prices.
- ⛔ **Crowd levels / "best time to visit"** — we don't have visitation data wired.
- ⛔ **Photo galleries** — one hero image per place.
- ⛔ **User reviews of the park.** Trail reviews exist; park reviews don't.
- ⛔ **A description for every place** — NPS units only.
- ⛔ **Anything that hides the source.** Attribution is a feature here, not a legal footnote.
