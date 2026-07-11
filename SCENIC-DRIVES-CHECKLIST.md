# Scenic Drive Enrichment — Checklist

Follow this per byway. Full context in [SCENIC-DRIVES-PIPELINE.md](SCENIC-DRIVES-PIPELINE.md).
`<id>` = the drive's id in `public/byways-data.js`.

## A. Before you run

- [ ] Drive has a Wikipedia **road** article. If the auto-resolver would grab the wrong page or a "List of…" index, pin it: add `"<id>": { "road": "<Wikipedia article>" }` to `scripts/byway-wiki-map.json`.
- [ ] Drive is **not** `approxLoc: true` (state-centroid only) — those have no real route; skip enrichment.
- [ ] Know the drive's real length (from `byways-data.js` or the Wikipedia infobox) to sanity-check the route line later.

## B. Generate (the two scripts)

- [ ] **Step 1 — Wikipedia base:** `PB_ONLY=<id> PB_FORCE=1 node scripts/build-byway-details.mjs`
- [ ] **Step 2 — OSM route + POIs + photos:** `PB_ONLY=<id> node scripts/enrich-byway-pois.mjs`
- [ ] Read the `✓ / ⚠` output — note any flags (handled in §D).

## C. Verify — the quality gates ("is it right?")

Inspect `public/byways/detail/<id>.json`:

- [ ] **Itinerary** has ≥ 2 stops, in order, with **monotonic** cumulative miles.
- [ ] **Every stop is geocoded** and within ~1 mi of `routeLine`; the **first & last stop sit at the line's ends** (termini on the road, not overlapping).
- [ ] **Route line length ≈ the real drive length** (not short — this catches the "stop 4→5 gap"). If short, see §D.
- [ ] **No junk** in stop `note` / `control` (no "closure gate", stray numbers, route shields).
- [ ] **POIs** present, roadside (near the line), mile-ordered, sensible categories (overlooks/passes/camps/falls/lakes/peaks).
- [ ] **Gallery** ≥ 3 real photos (not maps/diagrams/HAER docs); captions + credits look clean.
- [ ] **History** has paragraphs (or is correctly flagged prose-/table-less).

Then open the page (`npm run dev` → `/scenic-drives/<id>`):

- [ ] Route line traces the actual road; numbered pins + name labels sit **on** it.
- [ ] "The road you follow" shows the correct underlying route + run + length.
- [ ] "Scenic stops & attractions" list + map legend + filter chips work.
- [ ] Photos open in the **lightbox** with description + credit.
- [ ] Road-status line shows a live read (NWS everywhere; NPS if a park drive).

## D. Handle the flags

- [ ] `NO ARTICLE` → add the right article to `byway-wiki-map.json`, or accept the baseline page (no article exists).
- [ ] `NO JUNCTION TABLE` → parkways/prose byways get **history-only** (no itinerary) — that's expected, not a bug.
- [ ] **Route line short / a stop off the line** → the drive may lack an OSM route *relation*; confirm the fallback (named + ref ways) spans it, or pin the relation/ref. Re-run Step 2.
- [ ] `GEOCODE snapped` / `ungeocoded` → expected for park termini and article-less features; only chase it if a *marquee* stop is missing a pin.
- [ ] Photos empty → the byway's Commons **category** may differ from the article title; the file-search fallback usually covers it, else note it.

## E. Ship

- [ ] Bump `?v=N` on `getBywayDetail` in `app/lib/statusData.js` (once per batch is fine).
- [ ] Commit the regenerated `detail/<id>.json` (+ any script/seed changes + cache bump).
- [ ] Push → Vercel deploys. Spot-check the live page.

## F. Batch rollout (many at once)

- [ ] Run **tier by tier**: `PB_TIER=all-american …` then `PB_TIER=national-scenic-byway …` for Step 1; loop Step 2 over the enriched ids.
- [ ] Do **two passes** — Wikipedia/Overpass throttle under load; the scripts resume (skip done drives unless `PB_FORCE=1`).
- [ ] Review the aggregate `⚠` flag report; fix the high-value misses (seed-map the article-less ones).
- [ ] **Attribution check:** every enriched page shows Wikipedia (CC BY-SA), OSM (ODbL), and Commons credits — required before shipping.
- [ ] Bump the cache once, commit in sensible batches, push.

## Reference — a "good" result (Beartooth)

68 mi OSM line, all 5 stops on it, 24 mile-ordered attractions, 18 Commons photos,
live NWS status. Use it as the bar when checking §C.
