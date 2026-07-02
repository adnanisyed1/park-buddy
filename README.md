# ParkPulse — React / Next.js

Your existing ParkPulse site, migrated to **Next.js 14 + React 18** and ready to deploy on **Vercel**.

**Important: your site was not rewritten or redesigned.** Your real pages — the interactive
Google Maps homepage, the live weather + alerts, the per-park status page, the trip builder,
and the planner bubble — run exactly as you built them. They now live under React routing, and
your old Netlify function is now a Next.js API route. Nothing about the look or behavior changed.

## How the migration works

Each of your original pages was split into three parts that load together at runtime:
- the **markup** → `public/embed/<page>/body.html`
- the **styles** → `public/embed/<page>/style.css`
- the **scripts** (your real JS, untouched) → `public/embed/<page>/s0.js`, `s1.js`, …

A small React component (`app/components/EmbeddedSite.jsx`) mounts each page, loads its assets in
the original order, and fires the same `load` / `DOMContentLoaded` events your code listens for.

This is the safe, incremental ("strangler") migration: you get a real Next.js app today, and you
can refactor any page into idiomatic React components later, one piece at a time, without a risky
big-bang rewrite.

## Routes

| URL            | Your original file   |
|----------------|----------------------|
| `/`            | `index.html`         |
| `/park-status` | `park-status.html`   |
| `/build-trip`  | `build-trip.html`    |
| `/plan`        | `plan.html`          |
| `/shop.html`   | Gear &amp; Stays storefront (static) |
| `/pro.html`    | ParkBuddy Pro pricing (static) |
| `/api/nps`     | `netlify/functions/nps.js` |

Links and API calls were rewritten automatically (`park-status.html?park=5` → `/park-status?park=5`,
`/.netlify/functions/nps` → `/api/nps`). The `?park=` query param still works the same way.

## Project layout

```
nextjs/
  app/
    layout.js                 fonts + global reset
    globals.css               your :root theme variables
    page.js                   → /            (the map homepage)
    park-status/page.js       → /park-status
    build-trip/page.js        → /build-trip
    plan/page.js              → /plan
    components/EmbeddedSite.jsx
    api/nps/route.js          serverless NPS proxy (key stays secret)
  public/
    config.js, weather-fx.js, season-fx.js, trip-data.js
    embed/<page>/...          your extracted markup + css + scripts
  package.json
  next.config.mjs
  .env.example
```

## Run it locally

Requires **Node.js 18+** (https://nodejs.org).

```bash
cd nextjs
npm install
cp .env.example .env.local      # optional: paste your NPS key for live park data
npm run dev                     # http://localhost:3000
```

**It runs with no keys.** The whole product is usable immediately — landing, Plan, Build a Trip,
the Pack &amp; Go checklist, Gear &amp; Stays (`/shop.html`) and Pro (`/pro.html`). Two things need keys
for live data: the Google Maps view (`NEXT_PUBLIC_GMAPS_KEY`) and live NPS park info (`NPS_API_KEY`).
The AI checklist uses the in-browser `window.claude.complete` when present and falls back to a
built-in rule-based generator otherwise — so it always works. Accounts/cloud-sync activate only
once Supabase keys are set (`auth.js` no-ops until then).

## What's new on top of the migration

- **Unified teal theme** across every page.
- **Pack &amp; Go checklist** (`public/checklist.js`) — generates from your live trip, voice + AI
  input, and a schedule-aware **Start Mode** travel companion.
- **Commerce** (`public/commerce.js`) — conditions-driven gear + nearby stays + lodge sign-up,
  on the Park Status and Build a Trip pages.
- **Gear &amp; Stays** storefront (`public/shop.html`) and **Pro pricing** (`public/pro.html`).

## Deploy to Netlify

This app is already configured for Netlify (`netlify.toml` + the official `@netlify/plugin-nextjs`,
which turns `/api/nps` into a serverless function automatically).

1. Push this `nextjs/` folder to a **GitHub** repo (or connect your existing one).
2. https://app.netlify.com → **Add new site → Import an existing project** → pick the repo.
   - Base directory: `nextjs` (if the repo root isn't this folder)
   - Build command: `next build` · Publish directory: `.next` (already in `netlify.toml`)
3. **Site settings → Environment variables:**
   - `NPS_API_KEY` = your secret NPS key (https://www.nps.gov/subjects/developer)
   - `NEXT_PUBLIC_GMAPS_KEY` = your Google Maps key (optional, for the map view)
4. **Deploy.** Then add your Netlify domain to the allowed referrers for your Google Maps key in
   Google Cloud Console so the map authorizes.

> CLI alternative: `npm i -g netlify-cli`, then `netlify deploy` inside `nextjs/`.

## Notes

- The Google Maps homepage shows a grey/blank map until the deployed domain is added to your Maps
  key's allowed websites — that's a key-restriction setting, not a code issue.
- Live weather (weather.gov) and NPS boundary shading work as soon as the site is online.
- To go fully idiomatic React later, convert a page's `s*.js` logic into a component with
  `useState`/`useEffect` and replace its `EmbeddedSite` route — the rest keep working meanwhile.
