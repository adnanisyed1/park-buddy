# Pines — Claude Design brief

> Paste this into Claude Design to get a distinctive visual direction for **Pines**, the
> short-video/photo feature of Park Buddy. It's self-contained: product, audience, the
> screens to design, the design system to honor, and what "great" looks like here.

## What Pines is
**Reels, but for the wild.** Short, real, place-anchored clips and photos from U.S. national
parks — every one captured **on-site** and pinned to the exact place, shown right next to
that park's **live conditions** (a GO / PREPARE / HOLD verdict). One post = **"a Pine"**;
each is framed as an **"Adventure."** No stock, no fakes — the honesty is the brand.

It's also a **two-sided business**: it drives real trip bookings (affiliate), and creators
earn from bookings their Pines drive, bounties for current footage, tips, and print sales.

## Who it's for
People planning or dreaming about a national-parks trip, and outdoor creators who want their
footage to actually *do something* (send people on trips, earn money) instead of just rack
up views.

## The design system to honor (this is a MUST — match the rest of Park Buddy)
"Dark futuristic-royal." Do not drift to pure black or a generic look.
- **Color:** base forest `#0a1712`; deeper `#08130d`; card `#0b1710` / raised `#0e2016`;
  champagne gold `#e8cf9a → #c9a35f` (gradient `linear-gradient(120deg,#e8cf9a,#c9a35f)`);
  gold-soft `#d9b779`; hairline borders `rgba(217,183,121,.16)` / strong `.30`.
- **Text:** ink `#f4f1ea`, secondary `#aab0ba`, muted `#7f8a82`.
- **Verdict semantics (separate from the gold accent):** GO `#4fd98a`, PREPARE `#e8cf9a`,
  HOLD `#e08a6a`.
- **Type:** display serif **Cormorant Garamond** (500/600), body **Inter** (300–700),
  micro-labels **Space Mono** uppercase with wide letter-spacing (~.16em).
- **Shape/feel:** generous radii (12–16 cards, 999 pills), glassy blurred bars, soft gold
  glows, restraint. The logo mark is a champagne-gold **pine/tree** glyph.

## Screens to design (mobile-first, it's a phone feature)
1. **Feed** — full-screen vertical, swipe/scroll-snap. Photo or video fills the frame; a
   bottom gradient overlay carries: 📍 place name (links to conditions), the "Adventure"
   caption, an "✓ On-site" verified badge, and action pills (**Add to trip**, **Conditions**).
   Right-rail actions (like / comment / share / save) welcome.
2. **Top of the week** — the 10 most-loved Adventures of the last 7 days. A ranked,
   editorial layout (big numerals, place, creator, like count). Make it feel like a coveted
   chart, not a plain list.
3. **Post a Pine (compose)** — pick/take a photo → we auto-detect location from the photo's
   GPS → tag a place + write a caption (defaults to "Adventure"). Needs a clean, trustworthy
   capture flow (the "reviewed before it goes live / real on-site shots only" reassurance).
4. **Mine** — the creator's own Pines with review status (Live / In review / Not approved),
   and later their **earnings** (this is where the business shows up for creators).
5. **Bottom tab menu** — Instagram/TikTok style: **Feed · Top · ＋(post) · Mine**. The ＋ is
   a gold accent. Design the resting + active states.
6. **The "Pines" entry in the site's top nav** — the user wants it to STAND OUT as a **gold
   pill button** with the **pine mark + "Pines"** (not a plain text link like Book/Shop).
   A first pass is already in the code; refine it so it reads as *the* signature destination.

## What "great" looks like here (take a real point of view)
- Make the **place + live verdict** a hero of the feed overlay — that fusion of "beautiful
  clip" + "here's what it's like right now" is what no other reels app has. Lean into it.
- Design the **On-site / Verified** badge as something people *want* to earn — it's the trust
  and anti-fraud signal, and the thing that separates Pines from stock-video slop.
- Give **Top of the week** and **creator earnings** real editorial weight — this is where
  aspiration (get featured) and money (get paid) live.
- Motion with restraint: a considered load-in, a satisfying "pinned" confirmation, tasteful
  like/tap micro-interactions. Don't over-animate.

## Guardrails
- Honesty first: never imply a Pine is verified/on-site when it isn't; empty states tell the
  truth ("Pines are coming — be the first to pin one").
- Mobile-first, but it must look right on desktop too (feed centered ~520px column).
- Real content only in mockups (real park names: Yosemite, Zion, Rocky Mountain, Glacier…).

## Current state (so the design has a real baseline)
Built and live behind two setup switches: `/pines` with the bottom tab menu, photo posting
with EXIF location, Top-of-week, Mine, on the design system. Full technical spec + business
model in `PINES.md`. This brief is about **elevating the visual/experience design** on top of
that working foundation.
