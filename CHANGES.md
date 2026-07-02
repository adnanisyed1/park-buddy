# Park Buddy — Improvements (2026-07-01)

Four sets of changes, each independently verifiable. A production build passes
(`npm run build` → 20/20 pages, no type/lint errors).

---

## 1. AI agent hardening (protects against a runaway Anthropic bill)

**Files:** `app/api/agent/limiter.js` (new), `app/api/agent/route.js`, `package.json`

- Replaced the old in-memory rate limiter — which reset on every serverless cold
  start and wasn't shared across instances, so on Netlify it barely limited
  anything and gave no cost protection.
- New durable limiter (`limiter.js`) backed by **Netlify Blobs**, with an
  automatic **in-memory fallback** for local dev (no Blobs needed to run
  `next dev`). It enforces three limits:
  1. Per-IP sliding window (default 8 requests / 60s).
  2. Global **daily request cap** across all users (default 5,000/day).
  3. Global **daily USD spend cap** (default $10/day), computed from real token
     usage on each response using Claude Haiku 4.5 pricing.
- `route.js` now calls `checkLimits(ip)` before hitting the model and
  `recordSpend(...)` after each response.
- All limits are tunable via env vars: `AGENT_RATE_LIMIT`, `AGENT_RATE_WINDOW_MS`,
  `AGENT_DAILY_REQUESTS`, `AGENT_DAILY_USD`.
- Added `@netlify/blobs` to `package.json`.

## 2. SEO

**Files:** `app/layout.js`, `app/page.js`, `app/explore/page.js`, `app/plan/page.js`,
`app/build-trip/page.js`, `app/park-status/page.js`, `app/sitemap.js` (new),
`app/robots.js` (new)

- Every route was a `"use client"` shell that shipped no real content or metadata.
  Each route is now a **server component** that exports proper per-page
  `metadata` (title, description, canonical URL, Open Graph) and still renders the
  client-side `EmbeddedSite` at runtime.
- Root `layout.js` gained `metadataBase`, a title template, site-wide Open
  Graph / Twitter tags, and **JSON-LD** structured data (WebSite/Organization).
- Added `sitemap.xml` (`app/sitemap.js`) and `robots.txt` (`app/robots.js`).
- `park-status` canonical points at the base path so the many `?park=` variants
  aren't indexed as duplicates.

**Action needed:** set `NEXT_PUBLIC_SITE_URL` on Netlify to your real domain.
Canonicals/sitemap currently fall back to `https://parkbuddy.netlify.app`.

## 3. Performance & caching

**File:** `app/components/EmbeddedSite.jsx`

- The old loader fetched **every** asset (markup, CSS, all scripts) with
  `cache: "no-store"` plus a `Date.now()` cache-buster — so nothing was ever
  cached and everything re-downloaded on each page load.
- Now only the tiny `manifest.json` is fetched fresh; the heavy `body.html`,
  `style.css`, and scripts are **browser-cacheable**, busted per-deploy by
  `NEXT_PUBLIC_ASSET_VERSION` (or a `version` field in the manifest).

**Optional:** set `NEXT_PUBLIC_ASSET_VERSION` to `$COMMIT_REF` on Netlify so a
new deploy automatically invalidates the cached embed assets.

## 4. Real React migration of `/about`

**Files:** `app/about/page.js`, `app/about/About.jsx` (new),
`app/about/about.module.css` (new)

- Fully migrated `/about` off the embed pipeline into an idiomatic React
  component. The marketing copy now **server-renders into the HTML** (good for
  SEO), while the scroll reveals, hero parallax, and count-up stats run
  client-side. Styles are scoped via CSS Modules; fonts come from the existing
  next/font variables (no external Google Fonts request).
- This is the safe, repeatable pattern for migrating the other pages later.
- `public/embed/about/*` is now unused/stale and can be deleted.

---

## Not done here (and why)

- **`/build-trip`, `/plan`, `/park-status`, `/explore` full React migration** —
  these share ~16 global scripts (`checklist.js`, `commerce.js`, `passport.js`,
  `ask-parkbuddy.js`, …). Migrating one in isolation would break the others, so
  they must be done one at a time using `/about` as the template.
- **Hardcoded Google Maps API key in `public/config.js`** — a live key is
  committed and shipped to every visitor. It should be **rotated in Google Cloud
  Console** and loaded from `NEXT_PUBLIC_GMAPS_KEY`. This needs care (a static
  `public/` file can't read `process.env` directly), so it was left as a separate
  task.
