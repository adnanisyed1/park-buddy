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

- **Pre-publish review.** Pines are invisible (`pending`) until approved. MVP = a small
  manual admin queue; add an **AI first-pass** (poster + sampled frames through a
  moderation API — Hive / AWS Rekognition / similar) when volume warrants.
- **Reporting + takedown.** In-feed report; reported Pines flip to review; fast removal.
- **Rules** (surfaced at capture): no minors without consent; nothing dangerous/illegal;
  no revealing sensitive/exact-home locations; respect wildlife/Leave-No-Trace; you own
  or licensed any music. **DMCA** process + counter-notice.
- **Retention & deletion.** Creator can delete (removes from Cloudflare + row); account
  deletion cascades. Clear ToS/consent copy at capture.
- **Who can post at launch:** signed-in + **captured-in-app only** first (spam control),
  widen later.

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

---

## 9. Open decisions (need your call before Phase 1a)

1. **Provider** — Cloudflare Stream (recommended) vs Mux? *(Affects keys + cost.)*
2. **Capture** — in-app record only (max GPS trust) vs also allow camera-roll upload
   (more content, "tagged" not "verified")? *Recommend: allow both, badge honestly.*
3. **Public location precision** — snapped-to-place public coords (privacy, recommended)
   vs exact?
4. **Launch moderation** — manual-only (recommended for MVP) vs AI-assisted from day one?
5. **Who can post at launch** — signed-in + captured-in-app only (recommended) vs anyone?

---

## Alternatives considered

- **Phase 0, photo/webcam-only feed (deferred).** A `/pines` vertical feed built from the
  real park photos + live webcam frames we *already* fetch — zero video infra, ships in
  days, validates the feed/discovery loop before paying for video. Still a strong fast
  first step if you want to de-risk before committing to the real-video build above; it
  reuses the exact same feed shell.
- **Embedding third-party videos (rejected).** Breaks the "real, ours, on-site-verified"
  ethos and most platforms forbid it.
