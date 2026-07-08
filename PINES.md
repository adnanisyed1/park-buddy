# 🌲 Pines — short vertical video for Park Buddy

> **Status:** Spec / not yet built. This is the "plan the full video version" doc.
> Nothing here is live. Build order is in [Phased build](#phased-build).
>
> One clip = **a Pine**. The verb is *"pin it."* Pines = *pin* + *pine* + *reels*.

Pines is a full-screen, swipe-up vertical feed — reels, but every clip is bound to a
**real place we already model** (park / trail / lake / scenic drive / campground) and
**captured on-site with a verified GPS stamp**. That geo-anchoring is the whole point:
it turns short video from entertainment into *honest, current, place-based intel* that
plugs straight into planning.

This doc is the plan for the **real-video** version (user-captured clips, hosted &
streamed). A cheaper photo/webcam-only "Phase 0" was considered and deferred — see
[Alternatives considered](#alternatives-considered).

---

## 1. Why this isn't just a TikTok clone

The platform's whole promise is **real, location-anchored, honest** data (GO/PREPARE/HOLD
verdicts from live conditions; no fabricated content). Pines inherits all three:

1. **Geo-locked to a real place, verified on capture.** Every Pine carries the exact
   capture coordinates (lat/lng + accuracy + timestamp), re-verified server-side against
   the place it claims. Same location-lock pattern already designed for trail-milestone
   photos. Real footage of *this exact spot* — that's the moat.
2. **Surfaces where it matters, not just in one feed.** A Pine shot at a waterfall
   yesterday appears on that park's status page next to the live verdict → it becomes
   *current condition intel* ("here's what the falls look like right now"), plus on the
   map pin, the trail page, and the global feed.
3. **Every Pine leads to action.** Unlike generic reels, each carries *Add to trip ·
   Check conditions · Directions · Book*. Inspiration → itinerary. That loop is unique
   to us because we already own the parks/trails/conditions/trip graph.
4. **Plugs into what's already built.** Capture from **Trip Mode**; follows/likes tie to
   the **account system**; a Pine can auto-stamp your **Passport**; approved clips can
   flow into a **Trip Book**.

---

## 2. Provider decision — hosting & streaming the video

Real UGC video needs: resumable upload, **transcoding**, adaptive-bitrate streaming
(HLS/DASH), thumbnails/poster frames, signed playback, and a webhook when a clip is
ready. We are **not** building an encoding pipeline. Two managed options:

| | **Cloudflare Stream** ✅ recommended | **Mux Video** |
|---|---|---|
| Encoding | Included (no per-encode fee) | Per-minute encode fee |
| Pricing model | **Flat**: ~$5 / 1,000 min **stored**/mo + ~$1 / 1,000 min **delivered** | Per-min encode + per-min storage + per-min delivery |
| Creator uploads | Direct resumable (tus) upload URLs, signed | Direct uploads, signed |
| Player / ABR | Built-in player + HLS/DASH, or bring `hls.js` | Same |
| Analytics | Basic | **Best-in-class** (Mux Data) |
| Best fit | **Large libraries of short UGC, cost-predictable** | Data-heavy / engagement-analytics products |

> ⚠️ **Confirm current pricing before committing** — these numbers drift; treat the cost
> model below as an order-of-magnitude estimate, not a quote.

**Recommendation: Cloudflare Stream.** For Pines specifically — thousands of short clips,
most watched by few people, cost sensitivity high — *encoding-included + flat storage &
delivery* keeps a big UGC library affordable and predictable. Resumable direct uploads +
signed URLs fit our capture flow. Mux stays the fallback if we later want deep per-clip
engagement analytics.

**Keys (you hold them, same as Stripe/Lulu — never in chat):**
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN` (scoped to Stream only),
`CLOUDFLARE_STREAM_WEBHOOK_SECRET`. Set in Vercel env; server-only.

---

## 3. Architecture & data flow

```
Capture (Trip Mode / web)  ──▶  POST /api/pines/upload-url
   record ≤60s, get GPS            server → Cloudflare Stream: create direct-upload URL
        │                          returns { uploadURL, uid }
        ▼
   tus upload straight to Cloudflare (bytes never touch our server)
        │
        ▼
   POST /api/pines  { uid, place, caption, lat, lng, accuracy, captured_at }
        │            server verifies auth token, GPS↔place, writes row status='processing'
        ▼
   Cloudflare finishes encoding ──▶ webhook /api/pines/webhook (verify secret)
        │                            row → status='pending' (+ poster_url, duration, hls)
        ▼
   Moderation (manual queue at MVP) ──▶ status='approved'  → visible in feeds
                                        status='rejected'  → hidden, creator notified
```

Video bytes go **client → Cloudflare directly** (our server only mints signed upload URLs
and stores metadata) — cheap, scalable, no proxying.

### Data model (Supabase)

`pines`
- `id` bigint pk · `user_id` uuid · `cf_uid` text (Cloudflare Stream id)
- `place_type` text (`park|trail|lake|drive|campground`) · `place_id` text · `place_name` text
- `caption` text · `duration_s` int · `poster_url` text · `hls_url` text
- `lat` float8 · `lng` float8 · `accuracy_m` float8 · `captured_at` timestamptz
- `verified` bool (GPS confirmed on-site) · `display_lat`/`display_lng` (snapped, public)
- `status` text (`processing|pending|approved|rejected|removed`)
- `like_count` int · `view_count` int · `created_at` timestamptz

`pine_likes` (`pine_id`, `user_id`, unique) · `pine_reports` (`pine_id`, `reporter_id`,
`reason`, `created_at`, `resolved` bool). Follows reuse the account system.

### API routes (Next.js, `runtime=nodejs`, token-verified like `/api/my-orders`)
- `POST /api/pines/upload-url` → Cloudflare direct-upload URL (signed-in only)
- `POST /api/pines` → create metadata row after upload
- `POST /api/pines/webhook` → Cloudflare "ready" callback (HMAC-verify the secret)
- `GET  /api/pines?place=park:yell` / `?feed=for-you` → approved Pines, paged
- `POST /api/pines/:id/like` · `POST /api/pines/:id/report`
- Admin: `GET /api/pines/queue` · `POST /api/pines/:id/moderate` (approve/reject)

---

## 4. GPS verification — the honesty backbone

- **Capture path (max trust):** recorded in-app → `getCurrentPosition({high accuracy})`
  stamps `lat/lng/accuracy/captured_at`. Server checks the point falls within the claimed
  place (park/trail geometry; centroids + radius now, PAD-US boundaries later — already on
  the roadmap). Pass → `verified = true` → **"Verified on-site"** badge.
- **Camera-roll path (lower trust):** fall back to the file's EXIF geotag/time. If present
  and consistent → tag the place but **do not** mark verified → **"Location tagged"**
  (honest distinction, never a fake "verified"). If absent → user picks the place manually,
  clearly labeled unverified.
- **Privacy:** store precise coords privately; **public display coords are snapped to the
  place** (trailhead / park centroid) so a Pine never leaks someone's exact position or a
  sensitive site. A "hide precise location" default protects creators.
- Reject stale/mismatched captures (timestamp far from upload, coords far from place).

---

## 5. Moderation, safety & legal

User video is our biggest safety/legal surface — treat it seriously.

- **AI-assisted review from day one (DECIDED).** Every Pine is invisible (`processing`
  → `pending`) until cleared. An **AI first-pass** screens the poster + sampled frames
  (Hive / AWS Rekognition / similar) → auto-reject the obvious, auto-approve the clearly
  clean, route the uncertain to a small **manual queue**. This scales safety from launch
  and is a second provider/key to budget for.
- **Reporting + takedown.** In-feed report; reported Pines flip to review; fast removal.
- **Rules** (surfaced at capture): no minors without consent; nothing dangerous/illegal;
  no revealing sensitive/exact-home locations; respect wildlife/Leave-No-Trace; you own
  or licensed any music. **DMCA** process + counter-notice.
- **Retention & deletion.** Creator can delete (removes from Cloudflare + row); account
  deletion cascades. Clear ToS/consent copy at capture.
- **Who can post at launch (DECIDED):** signed-in + **captured-in-app only** — GPS is
  trustworthy, spam/fraud is contained, and it's the honest baseline. Widen later.

---

## ⭐ Business model — how Park Buddy *and* creators earn

Pines is a **two-sided engine**: Park Buddy earns, and it puts money in creators' pockets
— in a way that stays honest (it rewards real, on-site, useful footage, not view-farming).

### The unlock: verification *is* fraud-prevention
Every Pine is GPS-verified on-site (§4). That same honesty requirement makes creator
payouts **fraud-resistant** — you can't farm a payout with stock / AI / re-uploaded clips,
because a Pine only counts when it was genuinely captured at the place. No other UGC-video
platform can claim that. So we can pay on **verified** engagement and **real** conversions,
not gameable raw views.

### Does watch time itself earn money?
Only through a mechanism — attention doesn't convert to cash on its own. The pure
"time = money" model is **advertising** (ads in the feed; more watch time → more
impressions → revenue — this is also what funds YouTube/TikTok creator payouts). It's a
real lever, but the *weakest* one for us: it only matters at big scale, and one booking
(~$40 affiliate on an $800 stay) out-earns thousands of ad views (~$15 / 1,000 @ a high
travel CPM). Our edge is that we own the trips/conditions/booking graph, so attention here
is unusually **convertible** — generic reels are stuck with ads because they can't convert.
Plain programmatic ads also fight the premium, "we-never-sell-your-data" brand. So we
capture watch-time revenue mostly through **sponsored Pines (#4, ads done honestly) +
conversion (#1)**, keeping raw programmatic ads as an *optional later lever* only if scale
ever justifies it.

### How Park Buddy earns (in build order)
1. **Affiliate pull-through (primary, honest, already our model).** Pines are top-of-funnel:
   watch → *Add to trip* → book stays / cars / gear / tours / campsites through affiliate
   partners → we earn commission. Pines make the existing commerce stack convert better.
2. **Print & Trip Book pull-through.** "Get this shot as a print" / "turn this into a Trip
   Book" on a Pine → POD + Book revenue (existing Shop/Book rails).
3. **Pro subscriptions.** Pines drive engagement → Pro conversions; creator tools
   (analytics, monetization, scheduling) live behind Pro.
4. **Sponsored / branded Pines (largest scalable line).** Tourism boards, gateway towns,
   outfitters and gear brands pay to promote a real place/product — native, clearly labeled
   "Paid partnership", matched to relevant places. The big line once there's an audience.
5. **Marketplace take-rate.** A platform fee on creator earnings (tips, sponsored deals,
   experiences sold through Pines).

### How creators earn (layered on after there's an audience)
1. **Affiliate rev-share (best aligned).** A Pine that drives a real booking earns the
   creator a cut of that commission — rewards content that actually sends people on trips,
   not just views. Performance-based, honest, fraud-resistant.
2. **Bounties (very on-brand).** Park Buddy or partners post: "need current footage of X
   trail / after the storm" → a creator fulfills, GPS-verified → gets paid. This literally
   funds the *current-conditions intel* that makes Pines valuable.
3. **Tips ("Trail tips").** Viewers tip; platform takes a small fee.
4. **Print / Book royalties.** Creator earns when their footage/photos get printed or
   Trip-Booked.
5. **Sponsored matching / creator fund.** Connect creators to brand/tourism campaigns
   (platform cut); optionally a modest pool funded from ad revenue, split by *verified*
   engagement.

### Payout infrastructure
**Stripe Connect (Express accounts)** — same Stripe we already use for checkout. Handles
creator onboarding, KYC, **tax forms (1099)**, and payouts. Needed only when creator
earning goes live (Phase C), not before.

### Legal / trust (must-haves before payouts)
- **Content license in ToS:** creator keeps ownership, grants Park Buddy a license to
  display / print / promote; clear rev-share terms.
- **FTC disclosure** on every sponsored/paid Pine ("Paid partnership").
- **Tax reporting** thresholds (1099-K/NEC) handled via Stripe Connect.
- **Payout fraud controls:** pay on *verified engagement + real conversions* (not raw
  views); bot/duplicate-view detection; GPS-verification as the first gate.

### Monetization phasing (revenue is layered AFTER audience)
- **Phase A — Build (no money).** In-app capture, AI moderation, grow content + views.
- **Phase B — Park Buddy earns.** Affiliate attribution on Pines + Print/Book pull-through.
  No creator payouts yet — proves Pines drive revenue.
- **Phase C — Creators earn.** Stripe Connect + affiliate rev-share + tips + bounties.
- **Phase D — Scale.** Sponsored/branded-Pines marketplace + Pro creator tools + creator fund.

### Provider decision, re-framed for the business model
Creator payouts and sponsor reporting need **reliable watch-time + conversion analytics**.
We'll track our **own** playback/engagement events into Supabase regardless of host
(provider-agnostic, fraud-controllable, and exactly what payouts are computed from). For
the host itself, **Cloudflare Stream still wins on cost** for a large short-UGC library;
**Mux** only earns its premium if we'd rather buy turnkey analytics than roll our own.
**Recommendation stands: Cloudflare Stream + our own event tracking** — pending your OK.

---

## 6. Cost model (illustrative — confirm current pricing)

Assume a healthy early month: **1,000 new Pines**, avg **30 s** each.

- New storage/mo ≈ 500 min. A ~1-year library ≈ 6,000–12,000 min stored.
  - Cloudflare Stream storage ≈ **$30–$60/mo** at that library size.
- Delivery scales with **success**: 100k views × ~20 s watched ≈ 33k min ≈ **~$33/mo**.
  A viral month costs more — this is the line item to watch.
- Optional AI moderation: small per-image/þer-minute; negligible at MVP volume.

**Early real cost: tens of dollars/month, growing with views.** Mitigations: cap clip
length (≤60 s), poster-first + lazy autoplay, delete rejected clips promptly, and set
**billing alerts** so a viral spike can't surprise you.

---

## 7. Feed, surfacing & player

- **`/pines`** — global full-screen vertical feed. Ranking v1 = recency × proximity to
  user × place-verdict relevance × light engagement. Simple, honest, tunable.
- **Per-place** — "Pines from here" rail on the park/trail status pages + full-screen; a
  fresh clip sits beside the live verdict as current intel ("shot 2 days ago").
- **Map** — a small count badge on pins; tap → that place's Pines.
- **Deep link** — `/pines/:id` (shareable, SEO poster + place metadata).
- **Player** — 9:16, HLS (Stream player or `hls.js`), autoplay **muted**, tap to unmute,
  preload-next, poster first. Overlay: place name, live verdict/temp, freshness, and the
  *Add to trip / Conditions / Directions* CTAs.

---

## 8. Phased build

- **Phase 1a — Core pipeline (no social).** Schema + Cloudflare Stream integration
  (`upload-url`, `pines`, `webhook`), `/pines` feed of approved clips, HLS player, capture
  from Trip Mode, **manual** moderation queue. Ship the loop end-to-end.
- **Phase 1b — Verification + surfacing.** GPS re-verification + "Verified on-site" badge;
  Pines on park/trail pages + map pin badges; deep links.
- **Phase 2 — Social loop.** Likes, follows, **My Pines** in the account panel, reporting,
  AI moderation first-pass, **Passport auto-stamp** from a verified Pine.
- **Phase 3 — Ecosystem.** Approved clips → **Trip Book**; ranked/personalized feed;
  notifications ("a new Pine at a park you follow" — ties into the alerts system).

**Money layers on top of these** (see ⭐ Business model): revenue starts at **Phase 1b–2**
(affiliate pull-through + Print/Book — *Park Buddy* earns), creator payouts arrive with the
social loop (**Phase 2–3** via Stripe Connect), sponsored Pines + creator fund come last.
Build the audience first; monetize a real one.

---

## 9. Decisions

**Settled:**
- ✅ **Capture** — in-app record only (max GPS trust).
- ✅ **Moderation** — AI-assisted from day one (auto-screen → manual queue for the uncertain).
- ✅ **Business framing** — two-sided model: Park Buddy earns *and* creators earn (see
  ⭐ Business model). Verification doubles as payout fraud-prevention.

**Recommended, pending your OK:**
- **Provider** — Cloudflare Stream + our own engagement tracking (cost-effective; analytics
  we control drive payouts). Mux only if we want turnkey analytics over cost.
- **Public location precision** — snapped-to-place public coords (privacy); precise coords
  private.

**Still open (monetization — needed before Phase C, not before building):**
1. **First creator-earning lever** — affiliate rev-share (recommended, most aligned) vs
   bounties vs tips first?
2. **Rev-share split** — what % to creators vs platform on affiliate-driven bookings?
3. **Gating** — is creator monetization open to all verified creators, or a **Pro** perk?
4. **Sponsored Pines** — court tourism boards / brands early, or after audience is proven?

---

## Alternatives considered

- **Phase 0, photo/webcam-only feed (deferred).** A `/pines` vertical feed built from the
  real park photos + live webcam frames we *already* fetch — zero video infra, ships in
  days, validates the feed/discovery loop before paying for video. Still a strong fast
  first step if you want to de-risk before committing to the real-video build above; it
  reuses the exact same feed shell.
- **Embedding third-party videos (rejected).** Breaks the "real, ours, on-site-verified"
  ethos and most platforms forbid it.
