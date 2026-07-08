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
- [ ] **Left to polish:** user-follow (creator) + real follower counts; moderation-queue admin
      UI; state parks + gateway towns in the compose place picker (parks + forests done).
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
