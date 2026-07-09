# 🚀 Park Buddy — Production Readiness Plan

> Consolidated from a 5-track audit (QA · Security · Legal/Consent · E-commerce · Design-voice/Accounts/Ask-Buddy), 2026-07-08.
> Priorities: **P0 = blocks a responsible launch · P1 = fast-follow (soon after) · P2 = polish.**
> Good news up top: the **backend security posture and data-honesty ethos are genuinely strong** — no committed
> secrets, service key server-only, every owned-data endpoint verifies the auth token, no fabricated reviews/counts.
> The gaps are the *formal* layers (legal, abuse-hardening, commerce correctness) and finishing partially-built UX.

---

## ✅ Cleared autonomously (2026-07-08, shipped to main)

- **Checkout money bug** — price is now server-authoritative (derived from book size); client price ignored.
- **Legal** — `/privacy`, `/terms`, `/attributions` pages live (honest baseline: safety disclaimer, UGC license, DMCA/report, affiliate disclosure, data-source credits); AuthModal now links to real Terms/Privacy (valid clickwrap); legal links added to the landing footer. *(Recommend a lawyer eyeballs the wording before scale — it's a solid starting template.)*
- **SEO** — per-park + per-forest `generateMetadata` (63 parks + forests now distinct, indexable pages).
- **Fake forms** — CategoryPage "Notify me" now really stores emails (`/api/pines-waitlist`).
- **trip-mode hydration** — the persistent "1 error" fixed (counts gated on mount).
- **Security headers** — nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, HSTS added.
- **Fail-closed secrets** — ingest/seed/cron endpoints now require their secret (were open if unset).
- **Honest stats** — Pines "You" page drops fake `0` Followers/Following (shows real Pines/Live/In-review).
- **Polish** — parks/forests index "-1 Regions" clamp; park-alert 500→503; brand unified to "Park Buddy".

**Still needs code (not yet done):** rate limiting/CAPTCHA on public POSTs (needs an hCaptcha acct), UGC Report button + `pine_reports` table, Ask-Park-Buddy in-context reachability + platform tools, the `profiles`/Bio system, moderation-queue admin UI, `usePhoto`/ParkStatusV2 hydration, EmbeddedSite try/catch fallback, `/book`+`/pines` dead tiles. **Owner-only:** RLS verify, env vars, Stripe/Lulu/affiliate accounts, domain — see checklist below.

## 🔴 LAUNCH BLOCKERS (P0) — the short list to clear before going live

1. **No Terms of Service / Privacy Policy pages** — auth already says "you agree to our Terms & Privacy" but the links don't exist. *(flagged by 3 of 5 audits — #1 priority)*
2. **Checkout trusts a client-supplied price** — `app/api/checkout/route.js:29` sets Stripe `unit_amount` from `body.price`; a user can POST `price:0.50` and buy a hardcover for pennies, and fulfillment still fires. Also the flat price isn't floored to Lulu's real (page-count + ship-to) cost. **Must fix before any live Stripe key.**
3. **Lulu print jobs are created UNPAID with no pay step** — `app/lib/lulu.js` only *creates* the job; verify a card-on-file auto-charges it, or add a pay call — else you charge the customer and never print.
4. **Fake capture forms** — CategoryPage "Notify me" (`CategoryPage.jsx:56`) says "You're on the list" but sends nowhere; landing newsletter/notify forms likewise. Dishonest + contradicts the brand.
5. **UGC has no user "Report" button + no DMCA takedown path** — required to host public user photos (Pines) and keep DMCA safe harbor.
6. **Ask Park Buddy is unreachable in-context on most pages** — `SiteHeader.jsx:99` falls back to a full reload to `/#ask` on every React page; the flagship AI feature only truly works on the embedded home.
7. **Abuse hardening: no rate limiting / CAPTCHA** on public POSTs (`park-alert`, `pines-waitlist`, `book-order`, `checkout`) and no per-user throttle on Pines writes.
8. **Verify Supabase RLS** on every anon-reachable table (esp. `user_data` → policy `auth.uid() = id`; `destinations`, `pines*`). The browser upserts `user_data` directly, so RLS is the only guard.
9. **Env-config landmines to confirm in prod** — Google Maps key (blank maps everywhere without it), `pb_kv` table (or the $10/day Anthropic cap silently doesn't bind), `INGEST_SECRET`/`CRON_SECRET` set (else open write endpoints), Supabase URL var-name mismatch (`NEXT_PUBLIC_SUPABASE_URL` vs `.env.example`).

Everything below is the full detail, by track.

---

## A. Legal, Consent & Data Integrity

- **[P0] Privacy Policy page** (`/legal/privacy` or `/privacy`) — you collect emails, account data, UGC + geolocation. Cover: what's collected, why, sub-processors (Supabase, Stripe, Lulu, OpenAI, Cloudflare, email sender), retention, contact.
- **[P0] Terms of Service page** — UGC **content-license grant**, safety-data disclaimer ("verdicts are informational, verify with NPS/NWS"), liability limit, acceptable use, **DMCA notice-and-takedown + agent email**, **13+ age term** (COPPA).
- **[P0] Wire the AuthModal "Terms & Privacy" text to the real pages** (`AuthModal.jsx:145`, `body.html:415`) → turns existing copy into valid clickwrap. Add a **site-wide React footer** with legal links (React app has none today).
- **[P0] UGC "Report" button on every Pine** → moderation/removal queue; + DMCA agent + procedure in ToS.
- **[P0] Visible CC BY-SA credit on displayed Wikimedia photos** — `/api/photo` returns `credit`; verify it's actually rendered on every photo surface, not just returned. Add an Attributions page (Wikipedia, NPS, NWS, USGS, AirNow, Recreation.gov).
- **[P1] Refund / return / shipping policy** for Trip Book prints (shown at checkout).
- **[P1] Marketing-email consent + one-click unsubscribe** — distinguish transactional alerts from marketing; add unsubscribe route before the sender job ships (CAN-SPAM).
- **[P1] Data-subject rights** — "Delete my account & data" (must cascade `pines`, `pine_*`, `book_orders`, `park_alerts`, `pines_waitlist`, reviews, `user_data`) + data export/access (even a documented manual path initially).
- **[P2] Cookie/tracking consent banner** — build it *with* the Meta Pixel/analytics, not after (EU/UK/some-US law).
- **[P2] Sales-tax merchant-of-record** decision recorded; exact "As an Amazon Associate…" phrase when Amazon links go live.

## B. Security & Data Integrity

- **[P1] Verify RLS in Supabase** — `user_data` (`auth.uid() = id`), `destinations` (read-only), `pines`/`pine_likes`/`pine_comments`. Blocking, DB-side (can't confirm from code).
- **[P1] Rate limiting + CAPTCHA (hCaptcha/Turnstile)** on `park-alert`, `pines-waitlist`, `book-order`, `checkout` + per-user throttle on `pines`, `pines/photo`, `pines/comments`, `pines/like`. Reuse `app/api/agent/limiter.js` / `pb_kv`.
- **[P2] Make `INGEST_SECRET` / `CRON_SECRET` required (fail-closed)** and restrict mutations to POST — `ingest`, `destinations-ingest`, `destinations-seed`, `cron/ingest` are open if the secret is unset (and mutate via GET).
- **[P2] Security headers** in `next.config.js` — `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors`/`X-Frame-Options`, HSTS, and a CSP once embed assets are enumerated.
- **[P2] `interior-pdf` is unauth + uncapped** (CPU-burn DoS; raw 500 on error) — add auth/rate-limit + try/catch.
- **[P2] Verify email ownership before inserting `book_orders`**; stop leaking upstream (Stripe/Supabase) error strings to clients.
- **[P2] Admin `x-admin-secret`** → constant-time compare + rate limit, or a real admin role; video Pines currently get **no content scan** before an admin approves them (and they auto-post to Facebook).
- ✅ Confirmed clean: no committed secrets, service key server-only, owned-data endpoints token-verified, webhooks signature-verified, Stripe live-key guard, photo upload capped/namespaced, no real SSRF.

## C. Commerce Correctness (before enabling live payments)

- **[P0] Server-side price validation + cost floor** (see blocker #2/#3) — compute Lulu cost for the buyer's address+page count, charge ≥ that; never trust client price.
- **[P0] Confirm the create→pay→print flow actually pays** the Lulu job (card on file or add a pay step).
- **[P0] Go-live env:** Stripe **live** key + `STRIPE_LIVE_OK=1` + **live** `STRIPE_WEBHOOK_SECRET` (new live webhook → prod domain); Lulu **production** creds + `LULU_ENV=production` + **payment method on Lulu**; public `book-pdfs` bucket in prod.
- **[P1] Sales tax** (Stripe Tax) + **order/shipping confirmation emails** (Lulu returns tracking) + a **refund/cancel** path.
- **[P1] Affiliate IDs** — `/book` (`BookHub.jsx:25`) and `/shop` (`ShopStore.jsx:24`) link to bare partner URLs with **no tracking ID** → $0 revenue. Join Booking/Expedia, Viator, Rentalcars, REI, B&H, Garmin, Nat Geo programs and inject IDs. (Recreation.gov has no program.)
- **[P2] Print quality** — captured photos ~1000px are below 300dpi full-page (Lulu low-res warning); store higher-res originals for a premium keepsake. Confirm embedded imagery is licensed for commercial resale.

## D. Functionality / QA (bugs & unfinished UX)

- **[P0] SEO — every park & forest page shares ONE static title/description** — `app/parks/[id]/page.js` + `app/forests/[id]/page.js` export a generic static `metadata` ("Live park status & conditions") for all 63 parks + all forests; the real title is only set client-side (`ParkStatusV2.jsx:123`), which crawlers/OG ignore. These are your most valuable indexable pages and they're SEO-invisible as distinct pages. Fix: `generateMetadata({params})` resolving the unit name (scenic-drives/trail-status already do this). **M**
- **[P0] Pines moderation queue has no admin UI** — only the `/api/pines/moderate` API exists. *(Note: `OPENAI_API_KEY` is now set in prod, so clean photos auto-approve; but flagged photos + any video still need a human queue.)* Build a small admin screen.
- **[P1] `/trip-mode` hydration mismatch** — `TripMode.jsx:125` reads localStorage counts during initial render (SSR 0 ≠ client) → the persistent "1 error". Render those counts client-only after mount.
- **[P1] AccountPanel stubs** — "My Itineraries", "Passport", "Your Plan" are "Building this" dead ends for signed-in users. Finish or hide until ready. (Itineraries needs multi-trip save first.)
- **[P1] `/api/park-alert` returns 500 (should be 503)** when Supabase env unset — and the whole alert loop is a **silent no-op until the email sender job exists**.
- **[P1] Supabase URL var mismatch** — `auth.js` reads `NEXT_PUBLIC_SUPABASE_URL`; `.env.example` documents `SUPABASE_URL`. Works today only via a hardcoded fallback; align env docs to avoid a two-project split.
- **[P2] Brand-name inconsistency** — layout says "ParkBuddy — Discover, plan & collect the outdoors"; landing says "Park Buddy — See every park like never before". Pick one name + tagline. *(ties into the "emblem"/brand item — see Open Questions.)*
- **[P1] Hydration reads across many pages** — `PhotoThumb.jsx:61` (`usePhoto` reads localStorage in the `useState` initializer → photo-tile mismatch on repeat visits across Parks/Forests/Scenic indexes, ParkStatusV2, CategoryPage, Book, Shop) and `ParkStatusV2.jsx:409` (`new Date()` in render). Same fix pattern as trip-mode: init empty, hydrate in `useEffect`.
- **[P1] Index pages show "-1 Regions" / no error state** — `ParksIndex.jsx:67`, `ForestsIndex.jsx:73` — `statusData` returns `[]` on failure (never throws) so an empty load renders `{regions.length - 1}` = -1 with no message. Add an empty/error state (ScenicIndex does this right).
- **[P1] `/book` and `/pines` dead tiles** — Book "Shuttles & transport" + "Travel protection" are non-functional (fake toast / no link); Pines Places "search" is a static div (not an input) and the hub "Talk" composer bar isn't clickable. Wire or hide.
- **[P1] `/scenic-drives/[id]` map is a blank framed box** without a Maps key (no "map unavailable" message; build-trip/explore handle this well — copy their pattern).
- **[P0] `EmbeddedSite` boot has no `.catch`/fallback** — `EmbeddedSite.jsx:62`; `/`, `/plan`, `/park-status` render only an empty `#embed-root` filled by client fetch. A manifest/asset failure = **permanently blank homepage**. Wrap in try/catch with a visible fallback. *(bumped to P0 — it's the highest-traffic page.)*
- **[P2] `/trip-book-styles` is a dead-end mockup route** (noindex, hardcoded fake trip, no nav out) — consider removing.
- **[P2] Explore has no empty state for map-load failure** (TripModal degrades to an SVG sketch; Explore goes blank).

## E. Trust / Honesty gaps (small but brand-critical)

- **[P0] Kill the fake forms** (blocker #4) — make "Notify me" + landing forms POST to a real waitlist (`/api/pines-waitlist` pattern) or remove them.
- **[P1] Pines "You" page shows hardcoded Followers/Following 0 + $0 earnings** — either build the real follow-graph or hide until real, so the profile doesn't read as broken/dishonest.
- **[P1] Landing sells features that don't exist** — "Offline maps/trail downloads", "agent books stays & cars". Soften to "coming to Pro" / align with real capability, or the honesty pitch backfires.

## F. Design Voice — "talk like a Buddy"

- **[P0] Landing hero + eyebrows are brochure voice** — `body.html:79` feature-inventory subhead → *"Every national park, forest and wild place in one living map — with a straight answer on whether today's the day to go."* "Your trailhead concierge" → *"Just ask. I've got you."*
- **[P0] Auth value-prop generic** — "synced across every device" → *"Save your trips, packing lists and park alerts — they'll follow you to every screen."*
- **[P1] Warm up errors + account tiles** — errors get a buddy shrug + next step; tiles become invitations ("Tell me what you love — I'll tailor your parks").
- **[P2] Pick one voice** — standardize on first-person "I / we've got you"; reserve third-person "Park Buddy" for legal/affiliate lines. (Design tokens are already good — this is words, not colors.)

## G. Accounts & Profile (the "proper Bio" ask)

- **[P0] There is no profile system** — identity is the raw Supabase user + a prefs blob; no metadata-write path. Create a `profiles` table (`display_name`, `handle` unique, `bio`, `avatar_url`, `home_park_id`, `favorite_parks[]`, `links jsonb`) + `updateProfile()` in `auth.js` + an edit view in AccountPanel.
- **[P0] Pines authorship is anonymous** — `pines` stores only `user_id`; feed never shows who posted. Join to `profiles` for name/avatar/handle.
- **[P1] Avatar upload** (email/password users have none) — reuse the Pines photo-upload pattern into an `avatars` bucket. **[P1]** real home-park picker + favorites/passport surface.
- **[P2] Profile links** (website/social).

## H. Landing Page

- **[P0] Pines & Campfire are never explained** — flagship social features get zero landing real estate. Add a "Community / Pines" section.
- **[P0] No FAQ, no legal footer links** (see track A).
- **[P1] No social proof** (testimonials, counts, a live "recent Adventures" strip). **[P1]** align AI-agent claims with real capability.
- **[P2] Decorative footer forms + placeholder social icons** — wire or remove.

## I. Ask Park Buddy → true platform guide

- **[P0] Add navigation/deep-linking** — a `navigate`/`open_link` tool + render markdown links as clickable anchors (`ask-parkbuddy.js:52`); today it can only hard-link to `/build-trip`.
- **[P0] Add tools for the missing half of the platform** — Scenic Drives (`/api/byways`), Forests (`/api/forest`), Pines/Campfire (`/api/pines`), Book/Shop hand-off. Plus make it reachable in-context (blocker #6).
- **[P1] Pass current page/route context** so it knows what you're looking at; **[P1]** account-awareness (saved trips, followed parks) once profiles land; **[P1]** fix the "not live weather" disclaimer (it *does* pull live NWS).
- **[P2] Broader suggested prompts; consider Sonnet** for the planning path.

---

## 📋 Owner action checklist (dashboard / accounts / env — I can't do these)

- **Supabase:** verify **RLS** on all tables; confirm `pb_kv` table exists (agent cost cap); confirm public `book-pdfs` bucket in prod.
- **Env (Vercel):** Google Maps key (+ referrer restriction); `INGEST_SECRET` + `CRON_SECRET` (required); align `NEXT_PUBLIC_SUPABASE_URL`; `NEXT_PUBLIC_SITE_URL=https://theparkbuddy.com`.
- **Commerce (only when going live):** Stripe activated + live keys + `STRIPE_LIVE_OK=1` + live webhook; Lulu production creds + `LULU_ENV=production` + **payment method on Lulu**.
- **Affiliate programs:** join Booking/Expedia, Viator, Rentalcars, REI, B&H, Garmin, Nat Geo → give me the IDs to inject.
- **Domain:** attach `theparkbuddy.com` in Vercel.
- **Abuse:** create an hCaptcha/Turnstile account (site + secret keys) for the public forms.

## J. Brand & IP (logo / trademark)  — *general info, not legal advice*

- **The tree logo is safe to use.** It's an original, hand-drawn inline SVG (simple pine + trunk), not copied from an icon library or another brand — confirmed in code. Simple tree motifs aren't anyone's exclusive property, and an original mark is yours.
- **[P1] Clear the NAME before scaling.** The real risk is trademark confusion on **"Park Buddy"**, not the tree. Run a free **USPTO search** ([tmsearch.uspto.gov]) for "Park Buddy" + close variants in the relevant classes: **9 (apps/software), 39 (travel/trip services), 42 (SaaS)**. Do this *before* paying to file.
- **⚠️ [P1] FINDING (preliminary web scan, 2026-07): the name is CROWDED.** Multiple existing "Park Buddy"/"ParkBuddy" apps/companies already exist — all in the **car-parking** space (parkbuddy.app, parkbuddy.io, parkbuddy.space, "My Park Buddy: Parking Locator", a "Park Buddy" company since ~2015). **None are in national-parks/outdoors** (that lane is open), and the different market may let them coexist — BUT they likely overlap in **class 9 (mobile apps)**, so the name isn't clean to own. Domains `.app/.io/.space` are taken (we have theparkbuddy.com). **Decision:** keep "Park Buddy" and accept a crowded name (lean on "The Park Buddy" + the tree mark to differentiate), or pick a more distinctive/coined name that's far cheaper to protect and truly "just for us." Confirm via the official USPTO TESS search before deciding.
- **[P1] Avoid official insignia.** Don't use or evoke the **NPS arrowhead** or other government/park-agency marks; keep the "not affiliated with NPS" disclaimer (now in /terms + /attributions).
- **[P2] Register when there's traction.** Registration is what makes it *"the emblem just for us"* (lets you stop others). Cost ballpark (US, verify current fees): **DIY ~$250–$350 gov fee/class**, **filing service ~$400–$800/class**, **attorney ~$1,000–$2,000+/class** (worth it for office actions). ~8–12 months to the ® ; you may use ™ now for free.
- **[P2] Lock ONE name.** The app still mixes "Park Buddy" and "ParkBuddy" in a few places — pick one (I unified the metadata to "Park Buddy") and use it consistently across brand, domain, and any filing.

## ✅ Decided

- **Name & brand: "Park Buddy" at theparkbuddy.com** — keeping the name + the tree mark despite the crowded "Park Buddy" (parking-app) field; differentiated by the different market, the `.com`, and the parks focus. Canonical spelling is **"Park Buddy"** (two words) everywhere. Free next step (owner): USPTO TESS search to confirm class-9 registrations, then register when ready; ™ usable now.

## ❓ Open questions for you

1. **"The emblem just for us"** — with the name locked, did you mean a proper **logo / brand mark (+ trademark registration)**, an **official/verified badge** for the product, or a **favicon/app icon**?
2. **Launch with commerce ON or as a fast-follow?** If Trip Book/affiliate stay OFF at v1 (keep `STRIPE_LIVE_OK` off, links as-is), several P0/P1 commerce items drop to fast-follow and the launch is much simpler. Recommended: **launch the free product first (map, Pines, conditions), turn on money right after.**
3. **How much do you want me to build autonomously vs. review-first?** The legal pages, footer, fake-form fixes, voice pass, and Ask-Buddy navigation are things I can knock out now; the profile system + admin moderation UI are bigger and worth a quick design check.

---

*Nothing in this audit changed any code — it's assessment only. Say the word and I'll start clearing P0s in order.*
