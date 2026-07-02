# Park Buddy — Data Roadmap

The data is the moat. This is the plan for building toward great, authoritative data —
alerts, news, fire, air quality, and far more places (forests, lakes, trails, towns, ski/OHV).

## Architectural principle
Build ONE normalized "Places & Conditions" layer. Every source feeds a single internal
format: { name, type, location, conditions, alerts, thingsToDo, source }. The agent, map,
and park pages all read from that one layer — so adding a new source later is a data task,
not a redesign. (Same pattern as products.json.)

✅ STARTED: /api/explore aggregates places + water + trails + conditions into ONE
de-duplicated, source-stamped payload (dedupe by name + 250m proximity; each record carries
{source, fetchedAt}). Next: run the same reconciliation on a SCHEDULE into a database for
full offline coverage + add state-park / USFS camping + user "report a spot" corrections.

✅ STORE: /api/ingest reconciles via /api/explore and UPSERTs into Supabase table pb_places
(run supabase-schema.sql once). /api/explore now reads pb_places first (instant/complete),
falling back to live. Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (ingest), SUPABASE_ANON_KEY (read).
Trigger: POST /api/ingest?all=1 (seed parks) or ?lat=&lng=. Schedule it daily (cron/Netlify
scheduled function). Next: add state-park/USFS camping sources + user "report a spot".

✅ AUTOMATED: netlify/functions/scheduled-ingest.mjs runs daily (09:00 UTC cron) and pages
through /api/ingest automatically — the cache refreshes itself, no manual clicking.

---

## Phase 1 — Go deep on what we already touch (free, biggest value-per-effort)
- **NPS API** (key in hand): turn on the FULL payload — alerts, news releases, events,
  things-to-do, campgrounds, visitor centers, fees, amenities. We currently use a fraction.
- **NWS / weather.gov active alerts**: flood, fire-weather, winter, heat warnings by coords.
  Free, no key. Powers the precautionary-kit / go-no-go safety flow.
- **Wildfire — NIFC open data + InciWeb**: active fire perimeters & incidents = the fire layer.
- **AirNow API (EPA)**: air quality / smoke index by location. Pairs with fire + "smoke → N95".

➡️ START HERE: wire NWS active alerts + NIFC wildfire + AirNow into the park status page and
the agent. Free, and makes the verdict genuinely authoritative.

## Phase 2 — Expand the map of places (federal, one new key)
- **Recreation.gov / RIDB API** (one free key): facilities, permits, campgrounds, trailheads,
  boat launches, OHV areas, ski/snow areas across NPS, USFS, BLM, USACE.
- **USFS National Forest data**: national forests + recreation sites. Roughly triples coverage.
- **USGS**: lakes & water bodies (NHD), real-time streamflow/levels (paddling, fishing, flood).

## Phase 3 — Rich activity layer (mix free + paid)
- **OpenStreetMap (Overpass API)**: hiking trails, off-road/4x4 tracks, ski pistes, MTB trails.
  Free, global, variable quality.
- **Adventure / gateway towns**: no single API. Seed a curated list for top destinations
  (Springdale→Zion, Estes Park→Rocky), enrich with OSM amenities + our lodging layer.
- **Ski resorts**: OSM piste data + resort status feeds; full snow reports are paid.
- **Paid partnerships to evaluate for depth**: onX, Trailforks, AllTrails.

---

## Source quick-reference (all government APIs use the request-a-key model like NPS)
| Layer | Source | Key? | Cost |
|---|---|---|---|
| Park alerts/news/things-to-do | NPS API | yes (have it) | free |
| Weather alerts | NWS / weather.gov | no | free |
| Wildfire | NIFC open data / InciWeb | no/feed | free |
| Air quality / smoke | AirNow (EPA) | yes | free |
| Forests, OHV, ski, camps, permits | Recreation.gov / RIDB | yes | free |
| Lakes & water levels | USGS | mostly no | free |
| Trails / OHV / ski runs | OpenStreetMap (Overpass) | no | free |
| Adventure towns | curated + OSM | n/a | free |
| Rich trail depth | onX / Trailforks / AllTrails | yes | paid |
