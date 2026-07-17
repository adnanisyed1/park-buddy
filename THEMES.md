# Theming — the one standard flow

A theme is **just a palette**: a block that re-values the `--pb-*` design tokens.
Everything on the platform reads those tokens, so a theme is colors and nothing else.

## Add a new theme (the whole job)

1. **Register it** in `app/lib/theme.js` → `THEMES`:
   ```js
   export const THEMES = [
     { id: "dark",  label: "Dark" },
     { id: "light", label: "Light" },
     { id: "sunset", label: "Sunset" },   // ← new
   ];
   ```
2. **Define its colors** in `app/globals.css` — copy the `TEMPLATE` comment block,
   rename the id, change the values:
   ```css
   html[data-theme="sunset"] .pb-theme {
     --pb-bg: …; --pb-ink: …; /* …all the --pb-* tokens… */
   }
   ```

That's it. The header toggle now cycles through it, the choice persists
(`localStorage.pb_theme`), the no-flash boot script applies it before first paint,
and every opted-in page follows. **No page code changes.**

- `"dark"` is the **base** palette (`globals.css :root`) — it needs no block.
- Only tokens that differ from the base need to be listed in a theme block.

## Make a page follow themes

Wrap the page root in `.pb-theme` and drop `<ThemedBody/>` inside it (keeps `<body>`
matching so overscroll never flashes the other theme). Works in client **and**
server components:

```jsx
import { ThemedBody } from "../lib/theme";
<div className="pb-theme">
  <ThemedBody />
  …page…
</div>
```

Client pages may instead call `useThemedBody(rootRef)` — same effect.

Then **use tokens, never hardcoded colors**: `var(--pb-ink)`, `var(--pb-surface)`,
`var(--pb-gold)`, etc. Anything hardcoded won't follow the theme.

### Deliberate exceptions
- **Content over a photo** (hero text) stays literal-light in every theme — it sits
  on a darkened image, not the page background.
- **Intentionally-dark cards** (e.g. the status pages' permits/fees card) keep
  literal dark values on purpose.
- **Explore** is not opted in — it stays on the dark base by design.
- `.pb-forcedark` re-asserts the dark palette for a subtree inside a light page
  (the landing's dark feature bands).

## Status of the rollout
Migrated: landing, Book Studio, /book, status pages (trail/lake/campground/todo via
StatusShell). Pending: park/forest status, scenic drives, cruises, legal/account.
Skipped: Shop (own sub-brand theme, being redesigned), Explore (dark by design).
