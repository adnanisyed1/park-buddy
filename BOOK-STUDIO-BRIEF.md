# Design brief — Park Buddy "Book Studio" (for Figma Design / Claude Design)

Hand this to the design tool as the spec. It defines **what to design, in Park Buddy's
own visual system** (so it does NOT come back as generic shadcn), with **desktop AND
mobile**. When the design is ready, the dev team ports it 1:1 onto the real data +
the existing Stripe/Lulu pipeline — no backend changes needed.

---

## 1. What to design

A premium **Book Studio** — the screen where a traveler turns a finished trip into a
printed hardcover keepsake. It is a real **workspace/editor**, not a marketing page:
interactive, multi-step, live-updating.

**Product context:** Park Buddy is an honest U.S. national-parks companion. After a trip,
the user has a set of **stops** (parks / forests / towns), each with **their own photos**
and a short **story**. The Book Studio composes these into a magazine-style hardcover,
printed on demand (Lulu) and sold via Stripe. Voice: quiet-luxury, heritage, "earned" —
like a fine-press imprint crossed with a national-park heritage badge. Never salesy.

---

## 2. Brand & visual system  (do NOT use generic/shadcn defaults)

Design **both a dark and a light theme** (the platform is user-theme-selectable).

**Dark theme**
- Base bg `#0A1712` · card `#0B1710` · raised card `#0E2016`
- Hairline gold border `rgba(217,183,121,0.16)` (stronger `0.30`)
- Text: primary `#F4F1EA` · secondary `#AAB0BA` · muted `#7F8A82`

**Light theme**
- Base bg `#FAF8F4` · card `#FFFFFF` · raised `#F0F5F2`
- Warm hairline border `#E8E4DF`
- Text: forest ink `#1A3A2A` · secondary `#5A6168` · muted `#7E858B`

**Accents (both themes)**
- Champagne gold gradient `#E8CF9A → #C9A35F` (dark) / deep gold `#A37C3F` (light) —
  used sparingly: the primary action, fine rules, active step. Gold is the ONLY accent.
- Verdict chips (used on stop cards): GO `#4FD98A` · PREPARE `#E8CF9A` · HOLD `#E0906A`
  (dark) / GO `#1E8E4D` etc. on light.

**Typography**
- Display serif **Cormorant Garamond** — book titles, chapter titles, the printed pages.
- Body **Inter** — UI, controls, descriptions.
- **Space Mono** — micro-labels/eyebrows: uppercase, ~0.6rem, wide letter-spacing
  (e.g. "YOUR STOPS", "STOP TOOLS", "ORDER DETAILS", GPS coordinates).

**Feel:** generous negative space, hairline gold dividers, ~18px rounded cards, soft deep
shadows, photography-forward. Restraint over decoration.

---

## 3. Desktop layout — a 3-step workspace

**Top bar:** wordmark **"Book Studio · The Park Buddy"** · a horizontal **step rail
(Diary → Theme → Preview)** with the active step in gold · a right-aligned
**Author / Reader** toggle (Author = editing chrome shown; Reader = clean, distraction-free
read-through of the book).

Three-column workspace: **left** = context list · **center** = the live book · **right**
= tools / summary.

### Step 1 — Diary
- **Left rail — "Your Stops":** each stop card = number, name, park, and a state chip
  ("✓ Photo" or "＋ Add photo").
- **Center — open-book spread:** left page a full-bleed photo (small caption, GPS badge);
  right page "CHAPTER n · Park Name" + the story set in serif. A spread **pager** (‹ name ›).
- **Right rail — "Stop Tools":** the stop's GPS coordinates, its date, a live
  "**~0.3 mi away**" distance chip (from the user's current location), and controls to edit
  the story / swap the photo.

### Step 2 — Theme
- **Left:** **Cover Layout** (Centered / Split Photo / Minimal / Editorial / Manuscript)
  + **Color Theme** swatches (a Dark row + a Light row).
- **Center:** live **cover preview** (open hardcover) that updates instantly.
- **Right:** cover summary + a gold-accent indicator + "Preview Book →".

### Step 3 — Preview
- **Left — "Book Contents":** the TOC (Cover, Introduction, each stop, Final Page).
- **Center:** full book preview with a page-dot pager.
- **Right — "Order Details":** Format (8.5″ hardcover), page count, theme, cover,
  # of stops, **Total**, primary **"Order / Reserve Book"** button, and a small line:
  *"Stripe · Lulu Print-on-Demand."*

---

## 4. Signature interactions (this is the "idea")

- **Author / Reader toggle** — the standout. Reader hides ALL editing UI for a clean
  flip-through of the finished book.
- **Open-book spread with a real page-turn** feel (aim for a tactile hardcover, not a slider).
- **Stop Tools with live GPS + distance** — makes the book feel tied to the real trip.
- **Everything updates live** as the user edits the title, theme, cover, or stories.

---

## 5. MOBILE (design these too — full phone frames)

Phone reworks the 3-column workspace into a single column with a bottom tab bar.

- **Bottom tab bar (primary nav):** **Diary · Theme · Preview · Order** (Order becomes its
  own tab on phone), gold active state, safe-area padding.
- **Top:** compact wordmark + the **Author / Reader** toggle (keep it reachable).
- **Diary (phone):**
  - The two-page spread can't fit — show **one page at a time** with a **Photo ⇄ Story**
    segmented toggle to flip between the photo page and the story page of the current stop.
  - **GPS + date badge overlaid** on the photo; story set in serif below/over a scrim.
  - **"Stops"** = a horizontal, swipeable thumbnail strip (tap to jump).
  - **"Tools"** (Stop Tools) = a collapsible section / pull-up sheet (chevron to expand),
    so GPS/distance/edit don't crowd the page.
- **Theme (phone):** cover preview on top; layout + color-theme options stack below as
  tappable rows/swatches.
- **Preview (phone):** the book preview with a page-dot pager; Book Contents + Order Details
  as stacked sections (or the Order tab).
- **Order (phone):** a **bottom-sheet confirmation** — "Almost There! / Your hardcover
  keepsake is ready to order," an order-summary card (title · Hardcover · shipping · total),
  the sandbox/"test mode" note where applicable, and **Cancel / Checkout** buttons.

Keep taps big, the spread swipeable, and the primary action always reachable (sticky).

---

## 6. Honesty & content rules (core to Park Buddy)

- Show near the order: **"Only your own photos are printed. Stops without a photo get a
  beautiful typographic page."**
- No fabricated counts, reviews, or pricing — the total reflects the real page count.
- Real park/stop names and the user's real photos only. Empty states are honest and warm.

---

## 7. Deliverables — STATIC visual handoff (no prototype/interactions needed)

This is a **front-end / visual handoff only** — no clickable prototype, no wiring. All
interactions (Author/Reader toggle, spread page-turns, live title/theme/cover updates,
GPS Stop Tools, checkout) are built in code during the port. So please **draw every state
as its own flat frame** — don't rely on interactions to imply a state. Provide:

- **Desktop, dark + light:** Diary · Theme · Preview (6 frames).
- **Phone, dark + light:** Diary · Theme · Preview · Order (8 frames).
- **State frames** (desktop dark is fine for these, unless noted):
  - **Author** vs **Reader** view of the Diary spread (2 frames — show what Reader hides).
  - A stop **with a photo** vs an **empty stop** ("＋ Add photo" / typographic page) (2).
  - Diary spread showing a **different stop** selected (so the selected-state styling is clear).
  - The **order/checkout confirmation** (desktop panel + phone bottom-sheet).
- Ship the **type styles, color tokens, and spacing** as styles/variables if possible, so
  the port matches exactly.

Frame naming: `book-studio / <step> / <theme> / <state>` (e.g. `book-studio/diary/dark/reader`).

**References in the same Figma file:** frame `29:4` ("book-studio-unified") for the
open-book spread + cover + order-bar polish, and the "Book Builder Studio interactive pages"
Make prototype for the interaction model (Diary/Theme/Preview + Author/Reader + Stop Tools).
Keep the *ideas* from those; replace their visuals with the Park Buddy system above.
