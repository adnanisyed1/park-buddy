# 🔥 Campfire — Park Buddy communities

> **Status:** Spec / not yet built. Companion to `PINES.md`. Decisions below are locked
> from the product owner; build order in [Phasing](#phasing).
>
> One community = **a Campfire**. "Yosemite Campfire." Gather round, swap what's happening.

A Campfire is the place-anchored community for every **National Park, National Forest, State
Park, and gateway town** — where visitors and locals talk about what's going on *right now*.

## ⭐ Unified: Pines & Campfire are ONE social space
To avoid confusing users with competing brands, the social layer is a single destination:
- **Pines** = the whole social space (the gold nav button, feed-first home). The one entry.
- **Campfire** = what a *place's community* is called *inside* Pines (like "Groups"). You open
  "Yosemite's Campfire" from within Pines; there is no separate Campfire nav item.
- **One ＋ composer** posts either a **Pine** (photo/video) or a **Post** (report / question /
  wildlife / trip / heads-up).
- **One social graph:** `pines` (media) + `campfire_posts` (discussion), both keyed by place;
  the Feed blends them. Shared follows, notifications, moderation, profile, earnings.

Mental model: **Park Buddy → Pines (social space) → Feed + Places → each place has its Campfire
(live dashboard + community).** Bottom nav: **Feed · Places · ＋ · You.** The **place hub** is
where they merge — live verdict/alerts on top, then tabs **Pines · Talk · Live**.

## Locked decisions
- **Shape:** *living dashboard first, discussion second.* Each Campfire opens already full of
  real signal (verdict, alerts, Pines, webcams, status) so it's useful before anyone posts.
- **Name:** **Campfire.**
- **Coverage:** **all** parks + forests + state parks + gateway towns, from day one.

## The idea that makes it work (avoids the empty-forum death)
Auto-creating thousands of groups normally means thousands of *dead* groups. We dodge that two ways:

1. **Campfires are virtual, keyed by a place we already model.** No seeding thousands of DB
   rows — `/campfire/park/yell`, `/campfire/forest/<id>`, `/campfire/town/<slug>` resolve
   from existing datasets (63 parks, 100+ forests, state parks, gateway-town API). Full
   coverage is essentially free.
2. **Every Campfire is a live place dashboard before any human posts** — assembled from data
   we already serve, so it's never empty:
   - live **GO / PREPARE / HOLD verdict** + weather, pinned
   - current **NWS alerts / NPS closures** as auto "heads-up" cards
   - recent **Pines** from that place
   - **webcams**, trail / road / campground / lake status links
   - a "**conditions now**" thread people actually want

Discussion grows *on top of* a page that's already alive. No other parks community can do this.

## Structure
- One Campfire per place. **Gateway towns** attach to their nearby park(s) — the bridge
  between **visitors** (need current intel) and **locals** (have it). Locals are the most
  valuable contributors.
- **Channels** per Campfire (not one firehose): **Conditions now · Trip planning · Trip
  reports · Wildlife · Marketplace (permit swaps, ride-shares) · General.**

## Post types (park-native, and some feed the rest of the system)
- **Conditions report** ("Angels Landing icy up top") → can feed *crowd-sourced ground truth*
  alongside NWS/NPS, always labeled "community-reported" (never blurred with official data).
- **Heads-up / alert** → can flow into the existing **alerts** system.
- **Trip-buddy / group-up** ("Rim-to-Rim May 12, need 2") → ties into trips + accounts.
- **Wildlife sighting · Question · Lost & found.**
- A **Pine** posts straight into its place's Campfire.

## Plugs into what's built
- **Alerts:** follow a Campfire → notified of important posts + condition flips (reuses the
  park_alerts follow model / `/api/my-alerts`).
- **Trips:** add the park to your trip or find buddies from the Campfire.
- **Passport → reputation:** places you've actually visited (auto-stamped) grant credibility;
  trusted locals earn a **"Ranger" / verified-local** badge + light mod tools.
- **Pines & conditions** surface directly in the dashboard.

## Business angle
- **Gateway-town Campfires = local commerce.** Verified outfitters / lodges / guides get a
  presence; "ask a local guide," clearly-labeled sponsored local posts, booking links
  (affiliate). A real revenue line most park apps never reach.
- **Pro perk:** trip-buddy matching + richer community tools.
- Locals / guides can **earn** (leads, tips) on the same Stripe Connect rails as Pines.

## Honest hard parts
- **Moderation at scale** is the biggest ongoing cost/risk — reuse the Pines AI-moderation +
  report/queue pattern; volunteer local mods; per-place rules. UGC + legal surface.
- **Trust:** community-reported conditions must be *visibly separate* from official data.
- **Quality at full coverage:** low-traffic Campfires lean on the live dashboard (always
  useful) so they never read as abandoned even with no posts.

## Data model (Supabase) — only posts need storage; Campfires are virtual
`campfire_posts`
- `id` · `place_type` (park|forest|state_park|town) · `place_id` · `place_name`
- `user_id` · `channel` (conditions|trip|report|wildlife|marketplace|heads_up|general)
- `title` · `body` · `image_url` (optional) · `pine_id` (optional) · `lat` · `lng`
- `status` (pending|approved|rejected|removed) · `like_count` · `comment_count` · `created_at`

`campfire_comments` (`id`, `post_id`, `user_id`, `body`, `status`, `created_at`)
`campfire_likes` (`post_id`, `user_id`, unique)
`campfire_reports` (`post_id`/`comment_id`, `reporter_id`, `reason`, `created_at`, `resolved`)
Follows reuse `park_alerts` (place + email/user). Reputation derives from posts + Passport.

## API routes (Next.js, token-verified where noted, honest degradation)
- `GET /api/campfire/[place]` → the **living dashboard** payload: composes verdict/conditions,
  alerts, recent Pines, webcams, status links (reuses existing statusData/APIs) + recent
  approved posts. Works with zero posts.
- `POST /api/campfire/post` (signed-in) → create a post (status `pending` → moderation).
- `GET /api/campfire/posts?place=park:yell&channel=…` · `POST …/like` · `…/comment` · `…/report`.

## Pages
- `/community` — browse/search all places; "Your Campfires" (followed); trending now.
- `/campfire/[type]/[id]` — the living dashboard + channel tabs + discussion + compose.
- Surface a "Campfire" entry on each park/forest status page and in the top nav.

## Phasing
- **1 — Dashboard (no posts).** `/campfire/[type]/[id]` renders the live place dashboard from
  existing data for every place. Instantly useful, full coverage, zero moderation risk.
- **2 — Discussion.** Posts + channels + comments + likes; AI moderation + report/queue;
  follow-a-Campfire notifications (reuse alerts). `/community` index.
- **3 — Reputation & local commerce.** Ranger/verified-local badges + mod tools; gateway-town
  business presence + affiliate/sponsored; Pro trip-buddy matching.
- **4 — Ground-truth loop.** Community conditions reports (labeled) feed the verdict signals.

## Setup (your dashboard actions — keys never in chat)
- **Supabase:** run the `campfire_posts` / `campfire_comments` / `campfire_likes` /
  `campfire_reports` SQL (will live in the route header comments).
- Reuses `SUPABASE_SERVICE_KEY`, the `pines` Storage bucket (for post images), and the
  Pines AI-moderation provider once chosen. No new third party for Phase 1 (dashboard).
