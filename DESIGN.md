# Park Buddy — Design System

The single source of truth for how the whole platform looks **and speaks**. When
a page feels "off-brand," it's because it isn't reading from here. Migrate it.

Aesthetic: **futuristic-royal / quiet luxury** — deep forest green + champagne
gold, editorial serif, slow deliberate motion. Extracted from the approved
landing page (`public/embed/home`).

---

## 1. Tokens (defined in `app/globals.css` `:root`, prefix `--pb-`)

**Color**
| Token | Value | Use |
|---|---|---|
| `--pb-bg` | `#0a1712` | base page background (forest) |
| `--pb-bg-2` | `#08130d` | deeper wells, footers |
| `--pb-surface` | `#0b1710` | cards |
| `--pb-surface-2` | `#0e2016` | raised / active cards |
| `--pb-line` | `rgba(217,183,121,.16)` | hairline gold borders |
| `--pb-line-strong` | `rgba(217,183,121,.30)` | emphasized borders |
| `--pb-gold` / `--pb-gold-2` | `#e8cf9a` / `#c9a35f` | champagne gold (light/deep) |
| `--pb-gold-soft` | `#d9b779` | muted gold micro-labels |
| `--pb-grad-gold` | gradient | primary CTAs, the wordmark |
| `--pb-ink` / `--pb-ink-2` / `--pb-muted` | `#f4f1ea` / `#aab0ba` / `#7f8a82` | text: primary / secondary / fine print |
| `--pb-go` / `--pb-prepare` / `--pb-hold` | `#4fd98a` / `#e8cf9a` / `#e0906a` | live verdict colors |

**Type** — `--pb-serif` (Cormorant Garamond, display + headings), `--pb-sans`
(Inter, body/UI), `--pb-mono` (Space Mono, UPPERCASE micro-labels). Loaded in
`app/layout.js`.

**Shape/depth** — `--pb-radius` (18px), `--pb-radius-lg` (24px), `--pb-shadow`,
`--pb-shadow-gold`.

**Rule:** never hard-code a hex or font-family on a migrated page. Read the token.
Change the platform by changing a token here.

---

## 2. Shared components
- **`app/components/SiteHeader.jsx`** — the ONE header for every page (glass, gold
  wordmark, Explore · Scenic Drives · Stay & Gear · Pro · Learn · Sign in · Ask
  Park Buddy). "Plan a trip" is gone — Ask Park Buddy is the planner.
- _(next)_ shared `Button`, `Card`, `Chip`, `SectionTitle`, `Hero`, and the
  index-grid + detail templates (Scenic Drives is the reference pattern).

---

## 3. Voice & Tone — consistency isn't only visual

Park Buddy is your **companion**, not a corporation. Three registers, used on purpose:

1. **Product voice = first-person companion.** Park Buddy speaks *to* the user
   like a knowledgeable friend on the trail: _"I've read today's conditions —
   here's your window."_ / _"Let's find your trail."_ Warm, direct, confident.
   Stays premium — never slangy.
2. **Community = "Buddies."** The word for belonging, not a nickname pasted on
   individuals: _"Join 14,000 Buddies on the trail," "Reports from fellow
   Buddies,"_ Pro = _"Buddy Pass."_ This is where the brand name shines.
3. **Never** the sarcastic/chummy "hey buddy." That undercuts the luxury feel.

**Honesty is the brand.** We say GO / PREPARE / HOLD plainly, show real sources,
and never fake a rating, a photo, or a live condition. If data is thin, we say so.

**Do**: "Today's a GO." · "Here's your route, timed and checklisted." · "Real
conditions, charted in real time."
**Don't**: "Awesome deals!!" · "Hey buddy, wanna hike?" · invented star ratings.
