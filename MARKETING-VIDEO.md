# Park Buddy — AI Video Playbook (marketing only)

Ready-to-paste prompts + a workflow for making short promo/teaser clips with AI
video tools. **These are for marketing — teasers, ads, the landing demo. Never
for the real Pines feed.**

## The one rule: two lanes

- **Product (the real Pines feed):** only real, on-site, GPS-verified footage
  shot by real people. Pines' whole promise is *"real, on-site, no stock, no
  fakes."* AI clips masquerading as real trail conditions would break that and
  mislead people about safety. Off-limits.
- **Marketing (promo/ads/teasers):** AI video is fine here, as long as it's
  clearly promotional (brand teaser, feature explainer) and never implies it's a
  live condition read for a specific place/date. When in doubt, add a small
  "illustration" label.

## Which tool

| Tool | Use it for | How you'd use it |
|---|---|---|
| **Runway (Gen-4)** | Turn a real Park Buddy photo into motion | image→video: upload our own scenic photo as the first frame, add a motion prompt |
| **Kling 2.x** | Same, cheaper, strong motion | image→video |
| **Google Veo 3** | Best quality + real audio (wind, water) | text→video or image→video via Gemini / AI Studio / Flow |
| **OpenAI Sora 2** | Quick text→video | ChatGPT / Sora app |
| **Adobe Firefly Video** | Commercially-safe licensing, Premiere edit | text/image→video |

**Recommended default:** seed with **our own real photos** in **Runway or
Kling** (image→video). Starting from a real Park Buddy photo keeps the look
authentic and sidesteps "this scene never existed" problems. Use **Veo 3** when
you want ambient sound baked in.

## Specs to ask for

- **Vertical 9:16** for Pines/Reels/TikTok/IG; **16:9** for YouTube/site hero.
- **5–8 seconds** per generation (stitch several for a longer teaser).
- No on-screen text from the AI — it renders garbled. **Add text/logo/captions
  afterward** in CapCut / Premiere / Canva.
- Style keywords that match our brand: *cinematic, golden hour, warm gold light,
  deep forest greens, slow drift, shallow depth of field, no people or distant
  silhouettes, film grain.*

---

## Prompts — brand teasers

### 1. Hero brand teaser (text→video, Veo 3 / Sora)
> Cinematic aerial drift over a vast national-park landscape at golden hour —
> layered pine-forest ridgelines fading into blue haze, a still alpine lake
> catching warm light, slow gentle push-in. Deep forest greens and warm gold
> tones, shallow depth of field, subtle film grain, ambient wind and birdsong.
> No text, no people. 9:16 vertical, 6 seconds.

### 2. "Today's the day?" verdict teaser (image→video, Runway/Kling)
Seed image: a real Park Buddy trail/vista photo.
> Slow cinematic push-in on this landscape at dawn, soft mist lifting off the
> valley, warm gold light spreading across the ridge. Calm, hopeful mood, gentle
> parallax, film grain. Hold steady framing. 9:16, 5 seconds.

*Post: overlay the GO / PREPARE / HOLD chip + "Is today the day? Park Buddy
knows." in Cormorant Garamond over the last second.*

### 3. Pines reel teaser (image→video)
Seed image: a real on-site park photo.
> Handheld POV feel walking up to a scenic overlook, slight natural camera sway,
> warm morning light, leaves and water moving gently in the breeze. Authentic,
> unpolished, like a phone clip. 9:16, 6 seconds.

*Post: frame it inside a phone mockup + "Pines — real clips from the trail."*

### 4. Scenic drive teaser (text→video, Veo 3 for engine/wind audio)
> Cinematic low shot following an empty mountain road curving through autumn
> forest, dappled sunlight, warm gold and amber foliage, smooth forward tracking
> motion, gentle lens flare. Ambient wind. No cars, no text. 16:9, 7 seconds.

### 5. Campfire / community teaser (text→video)
> Cozy dusk scene: a warm campfire glowing in a forest clearing, embers drifting
> up, soft bokeh of pine trees behind, deep blue twilight sky. Intimate, inviting
> mood, slow gentle motion, film grain. Ambient crackle. 9:16, 6 seconds.

*Post: overlay "Every park has a Campfire. Find your people."*

---

## Fast workflow

1. Pick a **real Park Buddy photo** as the seed (keeps it authentic).
2. Generate 3–4 variations in Runway/Kling (image→video), 5–6s each.
3. Pick the best, upscale if the tool offers it.
4. In CapCut/Premiere: stitch, add our gold-on-dark text (Cormorant Garamond
   headline, Space Mono eyebrow), the pine emblem, and a CTA card
   (`theparkbuddy.com`).
5. Export 9:16 for social, 16:9 for the site hero.
6. Keep AI clips tagged in your asset folder as `ai-promo/` so they never get
   mistaken for real feed content.

---

## ⭐ "Ben opens Pines" — promo storyboard (detailed)

Goal: it feels like **Ben is a Park Buddy user who opens Pines**, ending on the
**Park Buddy emblem + a buddy-line motto**. Runway makes the cinematic outdoor
shots; the app parts are **screen recordings of the real app** (accurate UI);
the outro is the built end card (`public/media/endcard.html`).

Target ~30–35s, vertical 9:16 for social (or 16:9 for the site hero — you have a
16:9 Runway clip already, great for the site version).

| # | ~time | Source | What's on screen | Caption (gold, lower third) |
|---|---|---|---|---|
| 1 | 0–4s | **Runway (have it)** | Ben hiking the gravel trail toward the alpine lake, golden hour | *"Meet Ben."* |
| 2 | 4–7s | Runway (Shot 2) | Ben reaches the lakeshore, raises his phone | *"He found something worth sharing."* |
| 3 | 7–14s | **Screen recording** | Cut to the phone: he opens **Pines**, the feed reel plays, he posts his Bear Lake clip | *"So he opened Pines."* → *"Filmed on-site. GPS-verified."* |
| 4 | 14–20s | **Screen recording** | **Campfire** — Ben warns about the bear; replies come in | *"His Campfire had his back."* |
| 5 | 20–26s | Runway (Shot 4/5) | Ben at the overlook at dusk, smiling at his phone | *"Real people. Real trails."* |
| 6 | 26–33s | **End card** (`endcard.html`) | Emblem → Park Buddy → motto → theparkbuddy.com | — |

**Production notes**
- Record the app parts at 9:16 (phone) or use the animated phone demo on the
  landing as a stand-in while the real app screens are being built.
- Keep music soft; let the end card's motto land in silence or on a final chord.
- The end card is 16:9; for a 9:16 cut, open it in a portrait browser window —
  the stage recenters. Or tell me and I'll add a `?ratio=9x16` variant.

### Buddy-line mottos (pick one — swap the single `.motto` line in endcard.html)
1. **Your buddy in every park.** ← current default
2. Never hit the trail alone.
3. Every park. One buddy.
4. Adventure's better with a buddy.
5. Find your park. Bring a buddy.

---

## ⭐ v2 — Cinematic recut (NO screen recordings) + music

Feedback on the first cut: the app screen recordings feel clunky inside a filmic
piece. v2 drops them entirely. The "captures a Pine → posts to Campfire" beat
becomes a **designed brand moment** (a gold-on-dark motion card), not a literal
UI capture. Carried by music, mostly wordless.

**Edit order (~45s):**
1. **Arrival** (0–7s) — Ben hikes toward the ridge, golden hour. Music: solo guitar/piano, sparse.
2. **The moment** (7–15s) — he stops; cut to what he sees (bear across the meadow / vista). Let natural sound breathe, music begins to swell.
3. **The capture** (15–22s) — low / over-the-shoulder of Ben **raising his phone to film the real scene** (show the gesture, never the screen). Text: *"Capture the moment."*
4. **He posts it** (22–31s) — cut to the **designed upload beat** → `public/media/pines-upload-card.html` (screen-record ~8s): his clip tagged 📍 Bear Lake · ◉ Verified on-site + caption, then **Post Pine ↑ → Uploading… → ✓ Posted → 🔥 Live in Rocky Mountain Campfire.** This is the actual "Ben uploads the Pine" moment — replaces the screen recording. *(A shorter alt that skips the upload progress lives in `pines-post-card.html`.)*
5. **The community** (30–40s) — the Campfire *feeling*. If you can shoot real people (hikers at a trailhead, faces in golden light), use that. Otherwise use the **designed community beat** → `public/media/pines-community-card.html` (screen-record ~7s): a warm fire glow, messages gathering, resolving on "Find your people." Music peaks here.
6. **Resolve** (40–48s) — the hero ridge shot → the **end card** (`endcard.html`). Music lands warm.

**The designed "share" beat:** open `http://localhost:3001/media/pines-post-card.html`
fullscreen, screen-record ~7s (space/click replays for a clean take), and cut it in
at beat 4. It's built in the brand aesthetic — a premium title-card moment, not app chrome.

### Music
- **Feel:** warm, cinematic, hopeful — acoustic guitar or felt-piano + a soft ambient pad, building to one uplifting swell at the community beat, resolving on the end card. ~85–105 BPM. Emotional, NOT epic-trailer/drums.
- **Where to get it (licensed):** Epidemic Sound, Artlist, or Musicbed (subscription, ad/YouTube-safe) · **Uppbeat** or **YouTube Audio Library** or **Pixabay Music** (free) · AI: **Suno / Udio** (verify commercial license before a public ad).
- **Sync:** natural sound (wind, a distant bear) for beats 1–3, then let music take over from the capture; put the peak on the community beat, the resolve on the end card. Keep it under any VO.
- Search terms that land this: "cinematic acoustic uplifting," "warm folk build," "hopeful ambient guitar."

---

## 📱 Showing the app on the phone in Ben's hand

The premium way to show "Ben posts a Pine" is to have the app appear **on his phone
screen, in-shot** — not a full-screen cut. Runway/your footage supplies the hand +
phone; the app screen is composited **in your editor** (Runway can't render our UI).

**The asset:** `public/media/pines-phone-screen.html` — a portrait **9:16, full-bleed
phone screen** (no bezel, no helper text) that plays a real clip → tags it → **Post
Pine ↑ → Uploading… → ✓ Posted → Live in Rocky Mountain Campfire**, looping every ~9s.
Open it fullscreen and screen-record one loop.

**Two ways to put it on his phone:**
- **A) Screen replacement (best):** in After Effects (Mocha), DaVinci Resolve *(free,
  Fusion planar tracker)*, or CapCut, place the screen recording over the footage and
  **corner-pin/track it to the 4 corners of his phone screen** so it follows his hand.
  Tip when filming/generating: a plain bright or single-color phone screen tracks best.
- **B) Insert cut (simplest, no tracking):** cut from "Ben raises his phone" to the
  phone-screen beat full-frame (as if we see what he sees), then back.

**"Add the Pine" note:** the in-phone clip is a real raw scenic clip
(`public/media/pines-clip.mp4`). Swap it for **Ben's actual footage** in your editor,
or drop his file in at that path. The designed full-screen beats
(`pines-upload-card.html`, `pines-post-card.html`) now play that same real clip too.

**Heads-up:** the current landing intro video (`pines-intro.mp4`) is your **v1 edit
(with the screen recordings)** — swap it for the v2 cut when it's done and I'll re-point it.

## Legal / honesty checklist

- [ ] Clip is promotional, not presented as a live/real condition read.
- [ ] No real person's likeness generated to look like an endorsement.
- [ ] Prefer our own photos as seeds over pure text-to-video invention.
- [ ] If a viewer could mistake it for real footage of a specific place today,
      add an "illustration" label.
- [ ] Check each tool's commercial-use terms (Firefly is the safest bet).
