# Park Buddy — To-Do

Our shared, version-controlled backlog. Newest priorities on top. When something
ships, move it to **Done** (or delete it). See `SCOPE.md` for the north-star product
plan and `DESIGN.md` for the design system.

---

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
- [ ] **Hero photo** wasn't rendering on `/parks/zion` in local test (verdict,
      webcams, forecast all did). Check the hero `usePhoto` query.
- [ ] **USGS river-flow + flash-flood gauge** card (Conditions) — real nearest
      streamgage via USGS water services. Currently an honest placeholder.
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
- [ ] **`/build-trip` redesign** — still cream/legacy (reverted working original),
      pending a Claude-Design pass. Also: have "Build this trip →" pre-fill from
      `localStorage.pb_trip` so the Explore cart carries over.
- [ ] **Responsive header** — the shared nav crowds on narrow (~≤900px) widths; add a
      collapse/hamburger for mobile.
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
