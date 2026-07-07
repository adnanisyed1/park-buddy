# Park Buddy — To-Do

Our shared, version-controlled backlog. Newest priorities on top. When something
ships, move it to **Done** (or delete it). See `SCOPE.md` for the north-star product
plan and `DESIGN.md` for the design system.

---

## 🧳 Trip platform (planner → Trip Mode → Trip Book)
Shipped this session:
- [x] ~~Add any **physical address / place** as a stop~~ — /api/geocode (OSM Nominatim);
      trip store now carries lat/lng/state/custom so geocoded stops round-trip. ✅
- [x] ~~Full **trip-setup questionnaire**~~ — start/end date, adults + infants, drive vs
      fly, trip scope, rental car, flights budget, "use defaults". Saved to trip meta. ✅
- [x] ~~**Print-ready itinerary**~~ — /trip-print: cover, SVG route map, day-by-day,
      budget, packing checklist; print/PDF via the browser. ✅
- [x] ~~**Trip Mode**~~ — /trip-mode: live location + breadcrumb, arrival photo prompts,
      per-stop conditions/alerts, packing checklist. Client-side. ✅
- [x] ~~**Trip Book** (preview)~~ — /trip-book: cream keepsake pages, cover + a page per
      stop with photos (from Trip Mode) + editable story. No ordering yet. ✅

Open follow-ups for this platform:
- [ ] **Background reminders when the app is closed** — needs a Service Worker + Web
      Push (or native) + a backend to schedule. Today reminders only fire while the tab
      is open. Pairs with accounts.
- [ ] **Sync trip data to the account** (Supabase) instead of localStorage — so a trip,
      its photos, checklist and story survive across devices. Photos need object storage
      (Supabase Storage / S3) + server-side thumbnailing; localStorage caps at ~5 MB.
- [ ] **Trip Book → real product** — pick a photo-book print-on-demand partner (e.g.
      Blurb/Lulu API, Mixbook, Peecho), generate the interior PDF server-side from the
      trip + photos + story, wire checkout + shipping + sales tax. Capture "I'd print
      this" interest is already stored (`pb_book_interest`). Confirm licensing of any
      map/photo assets embedded in a sold book.
- [ ] **Auto-story drafting** — offer an AI first draft of each stop's story from the
      trip data + photo timestamps/locations, which the traveller edits (keep it theirs).
- [ ] Address field could use Places Autocomplete (nicer UX) once the Google key has the
      Places API enabled; Nominatim is the keyless fallback.

## 🔺 Now — infrastructure
- [ ] **`theparkbuddy.com` is broken** (needs YOUR action in Vercel/DNS, I can't do
      it). It resolves to non-Vercel IPs; HTTPS fails (no valid cert) and HTTP
      returns a Vercel **404** — so the custom domain isn't bound to the park-buddy
      production deployment. The working URL is **park-buddy-gamma.vercel.app**.
      Fix: in Vercel → Project → Settings → Domains, (re)add `theparkbuddy.com`,
      then set the DNS records Vercel shows (A `76.76.21.21` or CNAME
      `cname.vercel-dns.com`) at your registrar; wait for the cert to provision.
- [x] ~~Photos vanishing under load~~ — /api/photo returned 200 `found:false` when
      Wikipedia rate-limited Vercel; client cached it as permanent no-photo. Now
      returns 503 on transient failures + cache key bumped v3→v4. ✅ shipped (222ba4f)

## 🔺 Now — park-status v2 (`/parks/:id`) follow-ups
- [ ] **Verify the alert subscribe writes in production.** `/api/park-alert` needs
      `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (present in Vercel, absent in local
      preview → "not configured" locally). Test on the live site: subscribe on a
      park's Conditions tab → confirm a row lands in the `park_alerts` table.
- [ ] **Email SENDER for alerts** (the big one). A scheduled job (Vercel cron or a
      Supabase edge function) that checks each subscribed park's conditions and
      emails when the verdict flips / permit drops / road opens / flash-flood watch
      / first snow — via Resend or SendGrid. Right now we only STORE the
      subscription; the card honestly says "email delivery is rolling out."
- [x] ~~**Hero photo** wasn't rendering on `/parks/zion`~~ — fixed the usePhoto
      null→valid re-sync (keyRef effect); hero now renders crisp (full original). ✅
- [x] ~~**Blurry / broken photos**~~ — Wikimedia 400s any non-pre-generated thumbnail
      width, so the earlier width-rewrite (upsize) both fixed blur AND silently broke
      images (Bryce panorama, Zion tiles). Now serves the summary's own original
      (heroes) / ~330px thumb (tiles); cache bumped v5→v6. ✅ shipped (a4a1881)
- [x] ~~USGS river-flow + flash-flood card~~ — `/api/riverflow` shows the nearest
      active streamgage's live cfs + gauge height; sun/forecast times fixed to the
      park's timezone. ✅ shipped (470afff)
- [ ] Enrich the honest-omitted editorial where real data exists: seasonal "when to
      go", real park trip reports, crowds/parking (needs a data source).
- [x] ~~Elaborate NWS alerts~~ — every active alert now renders in full (severity,
      area, timing, description, what-to-do). ✅ shipped
- [x] ~~Campground availability~~ — Plan tab renders the live 6-month CampAvailability
      strip per Recreation.gov campground (populates in prod w/ RIDB key). ✅ shipped

## 🔷 Commerce (Book / Shop)
- [ ] **Affiliate program setup** — real affiliate IDs for Booking / Rentalcars /
      Viator / REI / Garmin / B&H so partner hand-offs actually earn commission
      (currently honest deep-links, no commission). Add the FTC disclosure component
      (Amazon needs the exact "As an Amazon Associate…" phrase).
- [ ] **Shop "Park Buddy Originals" store** — stand up print-on-demand (Printful /
      Gelato) so the WPA posters / merch become real products (currently "Coming
      soon"). Confirm sales-tax handling with the POD provider before launch.
- [ ] Cruises / Diving / Climbing pages graduate from "Coming soon" when real data
      or partners exist (keep park-anchored).

## 🔶 Platform polish
- [ ] **Landing page redesign** — `/` is still the legacy embed (`public/embed/home`);
      its nav labels were updated to Book/Shop but the full page should be rebuilt on
      the design system (Claude-Design → port workflow).
- [ ] **`/about`** legacy embed still has an old "Plan a Trip" header — update to the
      shared banner or fold into the landing redesign.
- [x] ~~**`/build-trip` redesign**~~ — rebuilt on the dark design system (shared
      SiteHeader, dusk-dark scene, dark panels + dark Google map, gold accents, mobile
      stacking). Edits now persist across a refresh (write back to the shared store,
      preserving non-park stops). ✅ shipped
- [x] ~~**Unified trip + add-to-trip modal**~~ — one store (`app/lib/trip.js`) backs
      Explore, park/forest pages and Build My Trip; every add pops an inline-planner
      `TripModal` (reorder, nights, dates) and Build My Trip seeds from it. ✅ shipped
- [x] ~~**National forest dark status page**~~ — forests now open the deep dark
      `/forests/:slug` page (ParkStatusV2 in `kind="forest"` mode) instead of the
      legacy cream embed. ✅ shipped
- [x] ~~**Responsive header**~~ — the shared nav now collapses to a hamburger ≤860px;
      the panel carries Explore items + Book/Shop/Pro/Learn + My Trip + Sign in +
      Ask Park Buddy. ✅ shipped
- [ ] **Campground/lake map popups** on `/explore` are still light-styled (Google
      InfoWindow — white bubble, hard to theme). Low priority.

## 🔵 Data expansion (grow past the 63 national parks)
- [ ] Integrate **USGS PAD-US** (the unified DB of all US protected areas) + the
      **NPS API** (all 433 units) + **RIDB / Recreation.gov** so the map/search cover
      national forests, state parks, monuments, refuges and BLM lands as first-class
      data — not just the national parks. (Copy already reframed to the broader scope.)

---

## ✅ Recently shipped
- `/explore` rebuilt dark (map, filters, detail, trip); state filter; type-divided
  search; live-location dot; Dark↔terrain map toggle; simpler round pins.
- My Trip persists across reloads (`localStorage.pb_trip`).
- Explore ▾ dropdown; nav = Explore ▾ · Book · Shop · Pro · Learn (identical banner
  on every page, Sign-in included).
- `/book` + `/shop` ported 1:1 (partner-powered, honest coming-soon).
- `/parks/:id` deep park-status page + `park_alerts` Supabase table + `/api/park-alert`.
- "63 parks" copy reframed to include forests + state parks.
