# Scenic Drive Enrichment Pipeline

How we turned a bare scenic-drive page into the fully-built **Beartooth Highway**
model — and the exact steps to replay it for any other drive.

## What a fully-built drive has

- **Named "Scenic Itinerary"** (titled after the drive) with a *system-generated · America's Byways* badge
- **"The road you follow"** identifier bar — the underlying signed route (e.g. US-212), where it runs (start → end), and length
- **Real OSM road line** on the map — a thin, bright, cased line that traces the actual road
- **Numbered stop pins that sit ON the road**, at the true termini, each with its name
- **"Scenic stops & attractions"** — every roadside OSM point (overlooks, passes, campgrounds, waterfalls, lakes, peaks, trailheads), ordered by mile, with a filterable list + on-map name labels + a legend
- **Photo gallery** from the byway's Wikimedia Commons category — click to open a lightbox with the photo's description + credit
- **Live road status** — NWS hazards everywhere + NPS (park roads) + seasonal + a state-DOT hook
- **History + Sources** block with full attribution (Wikipedia CC BY-SA, OSM ODbL, Commons, NPS/FHWA/NWS)

## The pipeline — two build-time scripts

Prereqs: `cheerio` (dev dependency, already installed). Optional seed:
`scripts/byway-wiki-map.json` maps a drive `id` → its Wikipedia **road** article
(pin this when the auto-resolver would pick the wrong article).

### Step 1 — Wikipedia base ingest
```
PB_ONLY=<drive-id> PB_FORCE=1 node scripts/build-byway-details.mjs
```
Writes `public/byways/detail/<id>.json`: the **itinerary** (stops + cumulative
miles + friendly notes), **endpoints**, **history**, **references**, **attribution**,
**sources**. Geocodes each stop (Wikipedia coords → USGS GNIS → **OpenStreetMap**
fallback) and applies the **milepost snap** (parks geocode to a centroid — snap to
the road). Gap-fills `endpoints` into `public/byways-data.js` (never clobbering
curated ones).

### Step 2 — OSM route line + POIs + photos
```
PB_ONLY=<drive-id> node scripts/enrich-byway-pois.mjs
```
Adds to the detail JSON: **`routeLine`** (the real road geometry, stitched from the
OSM **route relation** with small gaps bridged), **`pois`** (corridor attractions
filtered to within ~1 mi of the road, ordered by mile, categorized + capped), and
**`gallery`** (Commons category photos with caption, description, credit). Snaps
every itinerary pin **onto the road line** and the two termini to the road's ends.

### Step 3 — bump the cache
In `app/lib/statusData.js`, bump `?v=N` on the `getBywayDetail` fetch so Next's Data
Cache serves the freshly-generated JSON on deploy.

### Step 4 — verify
- Inspect the JSON: every stop geocoded and **on** the line; `pois` present and
  mile-ordered; `gallery` non-empty.
- `npm run dev` → open `/scenic-drives/<id>`: route line traces the road, numbered
  pins + labels sit on it, attractions list/map/legend render, photos open in the
  lightbox, the road-status line shows a live read.

### Step 5 — commit + push
Commit the (regenerated) detail JSON + any script changes + the `statusData.js`
cache bump. Push → Vercel deploys.

## The render is already global

`ScenicDrive.jsx` + `RouteItinerary.jsx` + `RouteAttractions.jsx` + `RoutePhotos.jsx`
render **all** of the above automatically whenever a drive's detail JSON carries the
fields. There is **no per-drive UI work** — running the two scripts is the whole job.

## Data sources & licensing

| Data | Source | License |
|---|---|---|
| Itinerary, junctions, history, references | Wikipedia (MediaWiki `action=parse`) | CC BY-SA 4.0 — attributed per page |
| Road geometry + roadside POIs | OpenStreetMap (Overpass) | ODbL — attributed |
| Photos | Wikimedia Commons (category + file search) | per-file CC / public domain — credited |
| Designation + park road status | FHWA / NPS | public domain |
| Weather hazard alerts | NWS / weather.gov | public domain |
| Official closures (per state) | State DOT 511 (key-gated hook) | per DOT terms — *keys pending* |

## Fixes baked in (learned building Beartooth)

- **OSM geocode fallback** for named features Wikipedia/GNIS lack (got *Beartooth Pass*, 10,947 ft, which had no Wikipedia coordinate).
- **Milepost snap** for park-centroid termini (*Yellowstone National Park* → the NE-entrance road point, not the park's middle 40 mi away).
- **Road geometry from the OSM route RELATION**, not name-only ways — catches segments renamed inside towns (US-212 becomes *Broadway Ave* in Red Lodge), which had left the line 9 mi short of the last stop. Small junction gaps are bridged.
- **Pins snapped onto the road line**, termini pinned to the ends — fixes the "start" pin hiding under the first town's pin.
- **`controlCities`** filters note-fragments/numbers ("Winter closure gate", "9.012"); **`looksTown`** requires a real letter (zero-width-space cells were dropping the crossing they described).
- **Thin bright route line** so it doesn't cover the dots; **attraction names labelled on the map**.
- **Commons *category* gallery** — name-based photo lookup silently fails for remote lakes/passes, so we pull the byway's own photo category and store URLs at build time.

## Rolling out to all drives

Loop steps 1–2 over the enriched set. The scripts already throttle Overpass (global
gate) and Wikipedia (serialized gate) and cache geocodes, and support incremental
resume (skip drives already done unless `PB_FORCE=1`). Bump the cache once, review
the `⚠` flag report, commit. NWS road status is already universal; state-DOT feeds
light up per key (`MDT_API_KEY`, `WI_511_KEY`, …) with no code changes.
