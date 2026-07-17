# Park Buddy — To-Do

Our shared, version-controlled backlog. Newest priorities on top. When something
ships, move it to **Done** (or delete it). See `SCOPE.md` for the north-star product
plan and `DESIGN.md` for the design system.

---

## 📕 Book Studio — print pipeline (IN PROGRESS)

Shipped:
- [x] ~~**Book photos go to private storage at print resolution**~~ — new `book-photos`
      bucket + `/api/book-photo`; uploads are 3400px (every slot in the catalogue clears
      300 DPI) instead of Trip Mode's 1280px (~151 DPI on a full 8.5" page — half of
      Lulu's requirement, and the original was discarded). The browser keeps a 480px
      thumbnail + a path, so quota can't eat photo #5. Per-photo print-DPI verdict and a
      photo strip in Stop Tools. ✅

**USER ACTION — before photos work in any environment:**
Supabase → Storage → New bucket → name `book-photos`, **Public = OFF**. Nothing
client-side reads it; the PDF builder pulls bytes with the service key.

Next, in order:
- [ ] **PDF builder learns the new compositions** — `lib/interiorPdf.js` still renders
      the old one-photo-per-stop layout, so "Story on both pages" / grids / per-side
      counts print as something else. Must land before any proof is shown to a customer.
- [ ] **PDF builder reads `book-photos`** — checkout currently ships base64 thumbnails in
      the POST body; it should send paths and let the server fetch the full-res originals.
- [ ] **Restore the Step 3 "Print-ready PDF" proof button** — `/api/interior-pdf` still
      exists but nothing calls it; the button was dropped in the c17afed Figma rebuild.
      Blocked on the two above, or the proof lies.
- [ ] **Legacy photos**: anything already in a user's localStorage is 1280px with no
      `path`. The strip says so ("Added before print storage"). Pre-launch this is fine;
      it's a one-way door once there are real customers.

## 🔒 Storage / privacy (audit findings — see also Pines)
- [ ] **`book-pdfs` is a PUBLIC bucket with guessable paths** (`orders/<base36-ts>-<price>`)
      — anyone guessing a stamp reads a stranger's book. No signed URLs, no expiry. Also
      uploaded BEFORE payment, so abandoned carts leave permanent public artifacts.
      Lulu is the only reader; signed URLs serve it identically.
- [ ] **Account deletion doesn't clear `book-pdfs`** — contradicts privacy/page.js:31
      ("Deleting your account removes your … orders"). Paths aren't user-keyed, so a
      user-scoped delete isn't even expressible against the current layout.
- [ ] **Photo-rights attestation is decorative** — `agree` never enters the POST body;
      the server never sees it and no consent record is kept. A direct POST bypasses it.
- [ ] **Pines: reject/report hides the row but never deletes the object** — the image
      stays public at its URL forever. The content moderation exists to remove is exactly
      what survives. Small fix, highest severity on the board.
- [ ] No retention policy anywhere; "13 and older" (privacy/page.js:37) is prose only.

---

## 🛣️ Scenic drives (OSM route + POIs + galleries)
Shipped:
- [x] ~~**National Scenic Byways tier (103 drives)**~~ — OSM route + POIs + galleries rolled
      out; recovered 7 article-less drives via underlying-road seed-mapping, stubbed 8
      diffuse ones, coord-fixed ~26 with placeholder anchors. **89/103 routed** (from 0). ✅
- [x] ~~**All-American tier (37)**~~ — **29/37 routed**. ✅

Still gallery-only (revisit only with a multi-segment/tiled route model) —
14 National Scenic Byways: brandywine-valley, cascade-loop, connecticut-river-byway,
country-music-highway (US-23, no named OSM relation), crowley-s-ridge-parkway,
dinosaur-diamond, door-county-coastal-byway, lincoln-highway, loess-hills, pine-barrens
(no gallery either), seaway-trail, trail-of-the-ancients, washington-heritage-trail,
wetlands-and-wildlife. Plus 8 All-American Roads:
- [ ] **Blue Ridge Parkway** — 469mi OSM relation times out Overpass `out geom`; needs a
      tiled-bbox geometry fetch (fetch the relation's ways per lat/lng tile, then stitch).
- [ ] **Chesapeake Country** — no clean OSM relation; ways-fallback grabbed the wrong
      Dorchester/Blackwater roads. Needs the real MD-213 relation (Chestertown→Chesapeake
      City) pinned, or a hand-built route.
- [ ] Genuinely diffuse/oversized — likely stay gallery-only, revisit only if we build a
      multi-segment route model: **Route 66**, **Great River Road**, **Historic National
      Road** (transcontinental US-40), **Lakes to Locks Passage**, **Harriet Tubman
      Underground Railroad Byway**, **International Selkirk Loop** (tri-state loop).

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

- [x] ~~**Trip Book → downloadable PDF**~~ — "Download book (PDF)" paginates the keepsake
      via browser print-to-PDF (cover + a page per stop + closing); chrome hidden. ✅
- [x] ~~**Sync trip PLANNING data to the account**~~ — pb_trip/meta/checklist/story now
      ride auth.js's existing `user_data` TRACK sync (auto push on change, pull on
      sign-in, UI refreshes via pb:trip events). No new table. ✅
- [x] ~~**Trip Book Studio** (rebuild)~~ — /trip-book is now the 3-step living-diary
      keepsake, ported 1:1 from Claude Design (studioSource.js engine + TripBook.jsx
      wrapper + studio.css): Step 1 diary w/ real photo capture (localStorage
      `pb_book_diary`), Step 2 full-width theme+settings w/ live openable preview + 9
      themes, Step 3 openable 3D hardcover w/ real page-turns. Photos via server-cached
      /api/photo. Responsive pass added (desktop-only inline CSS was breaking mobile).
      `/trip-book-styles` = internal noindex warm-vs-bold direction picker. ✅

Open follow-ups for this platform:
- [x] ~~**Trip Book Studio → wire to the REAL trip**~~ — diary + book now compose from
      the user's actual stops (trip.js) + Trip Mode captures/stories (tripmode.js); real
      title/dates/region/route; prompts nudge un-photographed stops; falls back to the
      Colorado Plateau demo when there's no trip. ✅
- [x] ~~**Trip Book Studio → live GPS/geofence prompts**~~ — Step 1 "Use my location"
      pill starts watchPosition; within 2 mi of a stop the prompt becomes "You've
      reached <stop>" (+ status line + capture stamp + one Notification), reusing
      /trip-mode's coord resolution. Static nudges remain the fallback. ✅
- [x] ~~**Trip Book Studio → reserve-your-copy flow**~~ — the CTA opens a real reservation
      modal (edition summary + name/email/copies/ship/note) → /api/book-order → Supabase
      `book_orders` (honest 503 fallback when unconfigured). No charge; captures buyers. ✅
- [x] ~~**Create the `book_orders` Supabase table**~~ — created; verified in prod (POST to
      /api/book-order → 200, row persisted). Reservations now save live. (Delete the
      `verify-test@theparkbuddy.com` test row.) ✅
- [x] ~~**Trip Book paid checkout + Lulu fulfillment (sandbox-verified end-to-end)**~~ —
      Stripe Checkout (`/api/checkout`) generates + hosts the interior + cover PDFs
      (Supabase `book-pdfs` bucket) and passes their URLs in session metadata;
      `/api/stripe-webhook` creates a Lulu print job on payment. VERIFIED in sandbox:
      job #311761 → **UNPAID / line item ACCEPTED** ("successfully validated"). Fonts are
      embedded static OFL (EB Garamond + Inter) — Lulu rejects non-embedded base-14.
      Env-aware SKU: sandbox `0750X0750...` (7.5×7.5, the only square hardcover the
      sandbox catalog carries), production `0850.FC.PRE.CW.080CW444.MXX` (8.5×8.5);
      interior PDF sizes to the trim. Sandbox shipping = MAIL (GROUND unavailable), prod
      = GROUND. Diagnostic probes (`/api/lulu-cost?probe=…`) are sandbox-only. ✅
- [x] ~~**Book Studio → rebuild on the delivered Figma workspace design**~~ — DONE
      (Figma file 1IuuEX2vq8RVRnyGaEUlMl; commit c17afed). `/trip-book` rebuilt as a clean
      React 3-step workspace (Diary → Theme → Preview) on the --pb-* system: Author/Reader
      toggle, open-book spread + pager, Stop Tools (GPS + live distance, edit story, swap
      photo), cover silhouettes + dark/light palettes + live cover, Order Details wired to
      the existing reservation + Stripe/Lulu checkout. Mobile: bottom bar
      (Diary·Theme·Preview·Order) + Photo⇄Story toggle + collapsible tools (new SiteHeader
      `hideTabBar` prop). Composes from the real trip; Yosemite sample when empty. The old
      imperative `studioSource.js` is now unused (safe to delete on a later pass).
      (Superseded the earlier `29:4` single-page concept — we went with the workspace design.)
- [ ] **Book Studio follow-ups** — delete the now-unused `studioSource.js` + `studio.css`
      leftovers (keep only the `.tbres-*` reservation-modal styles the new page still uses);
      wire the real trip **title/dates/author** into the cover + a proper Introduction/Final
      page; consider real cover-layout differences (Centered/Minimal/Editorial/Manuscript
      currently share one preview). The empty-state (no trip) shows the Yosemite sample —
      could add a subtle "sample — build a trip to make it yours" banner.
- [ ] **Trip Book → GO LIVE** — DEFERRED until the `theparkbuddy.com` domain move (launch
      on the real brand, not park-buddy-gamma.vercel.app). All env flips in Vercel, no code:
      • Lulu **production** creds + `LULU_ENV=production` (SKU auto-switches to 8.5×8.5) +
        add a payment method on the Lulu account (jobs are created UNPAID);
      • Stripe → `sk_live_`/`pk_live_` + `STRIPE_LIVE_OK=1`;
      • re-create the Stripe webhook in LIVE mode pointing at
        `https://theparkbuddy.com/api/stripe-webhook` → update `STRIPE_WEBHOOK_SECRET`;
      • set `NEXT_PUBLIC_SITE_URL=https://theparkbuddy.com`.
      Domain-move safe by design: checkout success/cancel + Lulu PDF URLs derive from the
      request origin (auto-adapt); hosted PDFs live on Supabase (absolute URLs, unaffected).
      Then place one real order as the final proof.
- [ ] **Trip Book polish** — higher-res photos (captures are ~1000px, below 300dpi at
      full page → Lulu low-res *warning*; pairs with photos→object storage), refine cover
      panel geometry against Lulu's downloadable template, richer fonts/theming in the PDF.
- [ ] **Background reminders when the app is closed** — needs a Service Worker + Web
      Push (or native) + a backend to schedule. Today reminders only fire while the tab
      is open. Pairs with accounts.
- [ ] **Sync trip PHOTOS across devices** — the planning data syncs now, but photos
      (`pb_trip_photos`, base64) + breadcrumb stay device-local. Move photos to object
      storage (Supabase Storage / S3) with server-side thumbnails; store URLs, not base64.
      localStorage caps at ~5 MB so the current photo store is demo-scale.
- [ ] **Trip Book → real bound product** — pick a photo-book print-on-demand partner
      (Blurb/Lulu API, Mixbook, Peecho), generate a proper interior PDF server-side from
      the trip + photos + story, wire checkout + shipping + sales tax. Interest is
      captured now (`pb_book_interest`); download-as-PDF works via the browser meanwhile.
      Confirm licensing of any map/photo assets embedded in a sold book.
- [ ] **Auto-story drafting** — offer an AI first draft of each stop's story from the
      trip data + photo timestamps/locations, which the traveller edits (keep it theirs).
- [ ] Address field could use Places Autocomplete (nicer UX) once the Google key has the
      Places API enabled; Nominatim is the keyless fallback.

## 👤 Accounts & settings
- [x] ~~**React auth + account modal**~~ — app/lib/auth.js store + AuthModal on the design
      system (supersedes vanilla auth.js on React pages). Sign-in: Google, Apple,
      email+password, magic link. Signed-in account panel: Preferences (distance/temp/
      home region), Notifications toggles, My-stuff hub. SiteHeader wired. Verified UI. ✅
- [x] ~~**Account panel = Explore-style slide-in + bento grid**~~ — signed-in AccountPanel is a
      roomy right-side slide-in; home = bento grid of category tiles (Preferences / Itineraries /
      Books & Orders / Alerts / Passport / Plan); tap a tile → that section opens in place. ✅
- [x] ~~**Sign-in unified as one drawer**~~ — AuthModal rebuilt as a right-side slide-in drawer
      matching the landing (public/embed/home) + the account panel, so sign-in looks identical
      on every page (was a centered modal on React pages). Verified on /book. ✅
- [x] ~~**Books & Orders section**~~ — /api/my-orders (token-verified; user sees only their own
      book_orders) + order-card list in the panel. Prod auth guard = 401 with no/bad token. ✅
- [x] ~~**Alerts & Subscriptions section**~~ — /api/my-alerts (GET list active park_alerts by
      verified email; DELETE ?park_id soft-unfollows) + list UI with alert-type chips + Unfollow.
      Whole-itinerary alerts deferred to saved-trips work below. ✅
- [ ] **My Itineraries section** — needs **multi-trip save first** (app holds one trip today);
      then list saved named trips + subscribe-a-whole-itinerary → alerts for every stop.
- [ ] **Trip Passport section** — a visited-places record that auto-stamps from Trip Mode's live
      location (no manual check-ins); surface stamps in the panel.
- [ ] **Your Plan section** — Stripe subscriptions/billing (later).
- [ ] **Supabase auth config — NOW** (USER action, dashboard): enable the **Email** provider
      (unlocks password + magic link) + add site URL & redirect URLs to the allow-list
      (`https://park-buddy-gamma.vercel.app/**`, `http://localhost:3001/**`). Google already
      works. ~2 min, no external accounts. Then Claude tests the magic-link flow.
- [ ] **Supabase auth config — LATER (deferred by user):**
      • **Apple** sign-in — needs an Apple Developer account ($99/yr) + a Service ID/Key set
        up on Apple's side, then filled into Supabase → Providers → Apple.
      • **Custom SMTP** (Resend/SendGrid) under Project Settings → Auth → SMTP — Supabase's
        built-in email is rate-limited to a few/hour; needed before real magic-link volume.
- [ ] **/trip-mode hydration fix** — pre-existing: it renders `photoCount()` / breadcrumb
      counts server-side where they differ from client → hydration mismatch ("1 error").
      Render those counts client-only (after mount). Unrelated to auth; small.
- [ ] **Richer account panel** — real favorites / Trip Passport / book-order counts in the
      My-stuff hub (currently links + trip-stop count only).

## 🌲 Pines — the social layer (BUILT; needs backend switches to go live)
Specs: `PINES.md` + `CAMPFIRE.md` (+ `PINES-DESIGN-BRIEF.md`). Ported Claude Design's
reprocessed spec 1:1 into `/pines`: responsive **phone (bottom tab bar) + web (standard
SiteHeader + floating glass tab bar)**, six screens (Feed · Top of week · Place hub/Campfire
w/ Talk-first · Compose · Places · You/Mine). Wired to real data, honesty-first (verdict from
/api/conditions = Explore's NWS source; no fabricated likes/earnings/counts; honest empty
states). Photo Pines via Supabase Storage + EXIF; video path gated on Cloudflare. Marketing:
teaser + **waitlist** (`/api/pines-waitlist`) + generated **OG share card** (`opengraph-image`).
- [x] ~~**LIVE:** SQL run (db/pines.sql), public `pines` Storage bucket created, `OPENAI_API_KEY`
      set (auto-moderation). Backend confirmed configured on prod. Photos now post →
      auto-approve (clean) → Feed, end-to-end.~~ ✅
- [x] ~~**Interactivity: likes + comments + follow**~~ — `/api/pines/like` (toggle, trigger keeps
      like_count), `/api/pines/comments` (GET/POST, trigger keeps comment_count); feed heart +
      comments sheet + hub Follow (→ /api/park-alert) wired. Real, honest, auth-gated. ✅
- [x] ~~**AI moderation first-pass**~~ — `app/lib/moderation.js` (env-gated: MODERATION_WEBHOOK_URL
      or OPENAI_API_KEY; else manual/pending) wired into `/api/pines/photo`: clean→approved,
      flagged→rejected, none→pending queue. ✅
- [ ] **Moderation queue UI:** `/api/pines/moderate` (approve/reject, `PINES_ADMIN_SECRET`) works;
      needs a small admin screen to clear pending when AI isn't configured.
- [ ] **Video Pines:** set Cloudflare Stream env (see PINES.md) → in-app video capture.
- [x] ~~**Live temp in the verdict chip**~~ — /api/conditions now returns real NWS current temp;
      feed hero reads e.g. "GO · 58°". ✅
- [x] ~~**Per-place Pines on park pages**~~ — "Pines from here" rail on /parks/[id] Overview
      (matches by place_name via /api/pines?place_name=; honest empty invite). ✅
- [x] ~~**Pines on the Explore map**~~ — a "Pines from here" line in the pin's detail panel
      (not a pin-badge — decided against clutter). Matches by place name → /pines. ✅
- [x] ~~**SQL in the repo**~~ — full Pines schema at `db/pines.sql` (+ still in route headers).
      Backend verified live on prod (configured:true; waitlist write ok). ✅
- [x] ~~**Location is now SELECT-only (real places)**~~ — compose no longer free-types location.
      EXIF GPS suggests the nearest real place (from 63 parks + 103 forests); user confirms or
      taps Change → picks from a searchable list. Sets place_type + place_id (exact linkage, not
      name-based). Honest: only places we actually model can be tagged. ✅
- [x] ~~**Compose picker: parks + forests + gateway towns + state parks**~~ — 63 parks + 103
      forests + ~40 curated gateway towns (window.PB_GATEWAY) + state parks (from the
      `destinations` table). State parks only appear once that table is populated (PAD-US/RIDB
      ingest still pending — currently returns empty, handled gracefully). ✅
- [ ] **Left to polish:** user-follow (creator) + real follower counts; moderation-queue admin
      UI; populate the `destinations` table so state parks show in the picker + across the app.
- [ ] **Facebook auto-post (PARKED):** `app/lib/facebook.js` + moderate hook built & inert;
      user will set `FACEBOOK_PAGE_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` later. Also discussed:
      FB login, Meta Pixel, share buttons — not built yet.

## 🔥 Campfire — place communities (PLANNED, spec written)
- [ ] **Full spec in `CAMPFIRE.md`.** One community per park/forest/state-park/gateway-town,
      **virtual + keyed by the place we already model** (full coverage ~free; only posts need
      storage). **Living dashboard first** (verdict/alerts/Pines/webcams/status pinned so it's
      useful before anyone posts) → discussion second. Locked: name **Campfire**, coverage
      **all places now**. Phase 1 = dashboard (no posts, no moderation risk); Phase 2 =
      discussion + AI moderation + follow notifications (reuse alerts); Phase 3 = reputation +
      gateway-town local commerce; Phase 4 = community conditions feed the verdict. Not started.

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
- [ ] **Forest stays — cabins only, NO hotels** (decided 2026-07-10) — reframe the Book
      "Stays" category to **Cabins & Lodges** and re-point deep-links to cabin/glamping
      inventory near the park: **Vrbo** (all rentals) + **Booking.com constrained to
      chalets/lodges/cabins** + **Hipcamp / Glamping Hub** + **Rec.gov cabins & fire
      lookouts**. Airbnb is OUT (affiliate closed). Plan-only for now — build after
      partner IDs land. Full plan → **`AFFILIATE-STAYS.md`**.
- [ ] **Affiliate program setup** — real affiliate IDs for Booking / Rentalcars /
      Viator / REI / Garmin / B&H (+ Vrbo/Hipcamp/Glamping Hub, see above) so partner
      hand-offs actually earn commission (currently honest deep-links, no commission).
      Add the FTC disclosure component (Amazon needs the exact "As an Amazon Associate…" phrase).
- [ ] **Shop "Park Buddy Originals" store** — stand up print-on-demand (Printful /
      Gelato) so the WPA posters / merch become real products (currently "Coming
      soon"). Confirm sales-tax handling with the POD provider before launch.
- [ ] Cruises / Diving / Climbing pages graduate from "Coming soon" when real data
      or partners exist (keep park-anchored).

## 🔶 Platform polish
- [ ] **Compress the landing motion loops** — the 5 Runway `.mp4`s in
      `public/media/landing` (hero, map-band, reel-glacier/sequoia/teton) are
      uncompressed (~4–15 MB each, ~43 MB total) because there's no local
      transcoder. Install `ffmpeg` → re-encode to H.264 (CRF ~26, faststart) + add
      VP9 `.webm`, target ~1–2 MB each; then re-add the `.webm` `<source>` in
      MotionTile (LandingPage.jsx). Big mobile-data + LCP win. `MotionTile` already
      lazy-loads/pauses off-screen so it's not urgent, but do before real traffic.
- [x] ~~**Landing page redesign**~~ — DONE: `/` is now React (`app/LandingPage.jsx`),
      user-selectable light/dark theme, Figma-1:1 imagery + Runway motion loops.
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
