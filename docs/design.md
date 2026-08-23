# OPlanner Design System

Single source of truth for how OPlanner looks and behaves. Every new screen
(Study Plan included) is built from the tokens, recipes and rules below.

Style in one line: **Spotify-dark chrome, bright work surface, one green accent.**

- Chrome (left sidebar, right sidebar, loading screen, landing page): near-black
  `#0e0f12`, white text, hairline white borders.
- Work surface (main content, cards, tables, modals): white, `#1a1a1a` text,
  `#e3e3e6` borders.
- Accent: OPlanner green `#1db954`. Used for primary actions, progress and the
  "good" state. Nothing else competes with it.

---

## 1. Tokens

Declared in [`src/css/index.css`](../src/css/index.css) on `:root`. Use the
token, not the literal, in new code.

### Layout

| Token | Value | Use |
| --- | --- | --- |
| `--sidebar-w` | `clamp(220px, 17vw, 260px)` | Left sidebar width |
| `--sidebar-w-collapsed` | `76px` | Icon-rail width |
| `--rsidebar-w` | `clamp(260px, 22vw, 340px)` | Right sidebar width |
| `--topbar-h` | `56px` | Mobile top app bar |

### Spacing (4px base)

`--space-1 .25rem` `--space-2 .5rem` `--space-3 .75rem` `--space-4 1rem`
`--space-5 1.25rem` `--space-6 1.5rem` `--space-8 2rem` `--space-10 2.5rem`

Component gaps in practice: `0.3rem` inside stat grids, `0.5-0.6rem` between
controls, `0.85-1.1rem` between sections.

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-accent` | `#1db954` | Primary buttons, progress fill, active state |
| `--color-accent-hover` | `#1ed760` | Hover |
| `--color-accent-active` | `#19a449` | Active state, primary button border |

### Radii

`--radius-sm 6px` `--radius-md 10px` `--radius-lg 16px` `--radius-full 999px`

Real-world frequency: `6px` (small controls, menu items), `8px` (buttons,
cards, tables), `10-12px` (modals), `999px` (pills, progress bars, avatars).

### Z-index scale

`--z-base 1` -> `--z-dropdown 100` -> `--z-sticky 200` ->
`--z-mobile-topbar 900` -> `--z-mobile-backdrop 950` -> `--z-mobile-nav 1000` ->
`--z-modal-overlay 2000` -> `--z-modal 2100` -> `--z-popover 3000` ->
`--z-toast 4000`.

Never write a raw z-index. Popovers sit above modals, toasts above everything.

### Breakpoints

| Name | Range | Layout |
| --- | --- | --- |
| phone | `<= 480px` | Single column, drawers, bottom sheets |
| small tablet | `481-767` | Single column, drawers |
| tablet | `768-1023` | Sidebar visible, right sidebar hidden |
| laptop | `1024-1279` | Three columns, right sidebar compact |
| desktop | `>= 1280` | Three columns, right sidebar full |

---

## 2. Palettes

### Dark chrome (`Sidebar.css` `:root`, `RightSidebar.css` `.rs`)

| Role | Sidebar var | Right sidebar var | Value |
| --- | --- | --- | --- |
| Base | `--bg` | `--rs-bg` | `#0e0f12` |
| Elevated | `--bg-elevated` | `--rs-elev` | `#16181c` |
| Row | `--bg-row` | `--rs-row` | `#1a1c20` |
| Hover | `--bg-hover` | `--rs-hover` | `#1d2026` |
| Text | `--text` | `--rs-text` | `#ffffff` |
| Soft text | - | `--rs-text-soft` | `#d4d4d4` |
| Muted text | `--text-muted` | `--rs-text-muted` | `#a7a7a7` |
| Border | `--border` | `--rs-border` | `rgba(255,255,255,.06)` |
| Danger | - | `--rs-danger` | `#ff6b6b` |
| Warn | - | `--rs-warn` | `#f3c768` |
| OK | - | `--rs-ok` | `#4cd980` |

The accent button on dark chrome uses `#000` label text and radius `999px`.

### Light work surface

| Role | Value | Where |
| --- | --- | --- |
| Page / card background | `#ffffff` | Cards, modals, tables |
| Subtle fill | `#f6f6f7`, `#fafafb` | Table head, row hover |
| Border | `#e3e3e6` | Card and table outer border |
| Hairline | `#eef0f2`, `#ececef` | Row dividers, modal header rule |
| Control border | `#d6d6da` (hover `#b8bbc0`) | Secondary buttons, inputs |
| Text | `#1a1a1a` | Headings and body |
| Secondary text | `#555` | Table head labels |
| Muted text | `#888`, `#999` | Stat labels, hints, empty state |

### Semantic color

| State | Foreground | Background |
| --- | --- | --- |
| Good / completed | `#117a35` | `rgba(29,185,84,.12)` |
| Pending / warning | `#946100` | `rgba(224,150,0,.15)` |
| Bad / overdue | `#d23030` (`#c53030` pressed) | `rgba(229,62,62,.12)` |

Progress bars shift with level: low `#f87171 -> #ef4444`, mid
`#fbbf24 -> #f59e0b`, high `#34d399 -> #1db954`.

### Course colors

Deterministic per course name via [`courseColor()`](../src/utility/courseColor.ts),
overridable per course, semester and year. Anything that renders a course
(calendar chip, table row dot, plan row) uses it, never a fresh palette.

---

## 3. Typography

- Family: `Inter, system-ui, Avenir, Helvetica, Arial, sans-serif` (system
  fallback; no webfont is shipped, so Inter renders only where installed).
  Monospace when needed: `ui-monospace, SFMono-Regular, Menlo, monospace`.
- Weights in use: `400` body, `500` secondary labels, `600` UI labels and
  buttons (most common), `700` headings and numbers, `800` hero numerals.
- `line-height: 1.5` global, `1.1` on big numerals.

Scale actually used across the app:

| Role | Size |
| --- | --- |
| Page title (`h1`) | `1.7rem` / 700 |
| Section title (`h2`) | `1.15-1.4rem` / 700 |
| Card title (`h3`) | `0.95rem` / 700 |
| Body / control | `0.9-0.95rem` |
| Table cell | `0.9rem` |
| Table head | `0.85rem` / 600 |
| Stat label | `0.75rem` / 600, `letter-spacing: .05em` |
| Hint, caption | `0.72-0.78rem`, muted |
| Big stat value | `1.7rem` / 700 |

Numbers that line up in columns (credits, grades, money) get
`font-variant-numeric: tabular-nums`.

---

## 4. Elevation and motion

Shadows

| Use | Value |
| --- | --- |
| Sidebar edge | `2px 0 16px rgba(0,0,0,.6)` |
| Popover / menu (dark) | `0 8px 24px rgba(0,0,0,.6)` |
| Modal | `0 12px 32px rgba(0,0,0,.18)` |
| Card lift on hover | `0 8px 24px rgba(0,0,0,.14)` |
| Accent glow (landing CTA) | `0 8px 26px rgba(29,185,84,.35)` |
| Inset track | `inset 0 1px 2px rgba(0,0,0,.06)` |

Motion

- Color and background: `0.15s ease` (`0.12s` on dense rows).
- Press feedback: `transform: scale(.97)` over `0.08s ease`.
- Panel and drawer: `0.22s ease`.
- Modal: fade `0.15s`, scale-in `0.2s`; the mobile sheet slides up from 100%.
- Progress sweeps are eased and animate from the current value, never from 0
  on every change (see [`ProgressChart`](../src/components/ProgressChart.tsx)).
- Every animation is skipped under
  `matchMedia("(prefers-reduced-motion: reduce)")`.

---

## 5. Component recipes

### Primary button

```css
background: var(--color-accent);
color: #fff;
border: 1px solid #19a449;      /* --color-accent-active */
border-radius: 8px;
padding: 0.5rem 1rem;
font-size: 0.95rem;
font-weight: 600;
/* hover: --color-accent-hover; active: scale(.97) */
```

### Secondary button

```css
background: #fff;
color: #1a1a1a;
border: 1px solid #d6d6da;
/* hover: background #f7f7f9, border #b8bbc0 */
```

Both carry a lucide icon at `size={16}` plus a `<span>` label, gap `0.4rem`.
Icon-only buttons use `size={18}` in the sidebar, `size={22}` in the mobile
topbar.

### Card / panel

```css
background: #fff;
border: 1px solid #e3e3e6;
border-radius: 8px;
padding: 0.85rem 1rem;
```

Section head: `h3` at `0.95rem/700` on the left, muted hint or action on the
right, `align-items: baseline`.

### Stat card

Label (`0.75rem`, muted, `600`) over value (`1.7rem`, `700`). The wide variant
spans two grid columns and carries a progress bar underneath:

```css
.stat-bar      { height: 9px; background: #e7e8eb; border-radius: 999px; }
.stat-bar-fill { border-radius: 999px; min-width: 9px; transition: width .25s ease; }
```

Fill color comes from `data-level="low|mid|high"`, not from an inline color.

### Table

- Head: `#f6f6f7` background, `#555` text, `0.85rem/600`, bottom border
  `#e3e3e6`.
- Cell: `0.7rem 1rem` padding, divider `#eef0f2`, last row no divider.
- Row hover: `#fafafb`, `0.15s ease`.
- Long lists cap their height and scroll internally rather than pushing the
  page (see `--cip-max-rows` in [`CourseInfoPanel.css`](../src/css/CourseInfoPanel.css)).
- Loading shows a skeleton with the same column layout, never a spinner swap.

### Status pill

```css
display: inline-block;
padding: 0.2rem 0.6rem;
border-radius: 999px;
font-size: 0.78rem;
font-weight: 600;
```

Completed uses the good pair, pending the warning pair, overdue the bad pair.

### Modal

Use [`Modal.tsx`](../src/components/Modal.tsx). Overlay `rgba(0,0,0,.7)` plus
`backdrop-filter: blur(4px)`; panel `min(90%, 420px)`, white,
`1px solid #e3e3e6`, `--radius-md`, padding `--space-5`. Footer holds
`.app-modal-btn-cancel` then `.app-modal-btn-primary`.

On phones the modal becomes a bottom sheet: full width, `max-height: 92dvh`,
`border-radius: 18px 18px 0 0`, sticky header and a sticky 50/50 action bar
padded with `env(safe-area-inset-bottom)`.

### Empty state

Icon in a soft circle, `h2` title in the user's own words ("Let's build
Semester A"), one explanatory sentence, primary plus secondary action, then a
three-item hint list with `size={16}` icons. Copy is encouraging, never
scolding.

### Charts

`chart.js` with `react-chartjs-2`. Doughnut for completion, bars for
distribution. Series colors come from the accent and semantic ramps; course
series use `courseColor()`. Charts always ship a text equivalent nearby (a
percentage, a count) so the meaning survives without color.

---

## 6. Layout shell

```
.app-container (flex row, 100dvh, overflow hidden)
├─ Sidebar        dark, fixed token width, collapsible to icon rail
├─ MainContent    flex: 1 1 0; min-width: 0  (critical: lets wide tables scroll)
└─ RightSidebar   dark, fixed token width, hidden below 1024px
```

Mobile (`<= 767px`): sidebars become drawers over a backdrop, a sticky topbar
appears with hamburger, logo and right-panel toggle, main content scrolls with
`padding-bottom: calc(2rem + env(safe-area-inset-bottom))`. In the installed
PWA, edge swipes open and close the drawers.

A full-page feature (Focus timer today, Study Plan next) replaces the
`MainContent` column and marks its sidebar nav item active.

---

## 7. Accessibility and input

- Keyboard focus ring: `2px solid var(--color-accent)`, offset `2px`, through
  `:focus-visible` only. Mouse clicks never show it.
- Form fields deliberately show no focus ring anywhere (product decision);
  focus reads from the caret and the existing border.
- Every icon-only control needs `aria-label`; progress bars need
  `role="progressbar"` with `aria-valuenow/min/max`.
- Hit targets on mobile are at least 44px tall; modal action buttons go
  full-width 50/50.
- Color is never the only signal: pair it with a label, an icon or a number.
- Scrollbars are slim (6px) with a transparent track app-wide.

---

## 8. Content voice

- Short, direct, second person. "Import calendar", "Add your first course".
- Buttons name the outcome; toasts confirm it in the past tense
  ("Course added", "Final exam date saved").
- Errors say what broke and what to do next.
- User-supplied names appear in curly quotes: "Linear Algebra".
- No exclamation marks in system messages, no apologies.

---

## 9. CSS conventions

- One stylesheet per component in `src/css/`, imported by that component.
  No CSS-in-JS, no utility framework.
- Class names are flat and prefixed by feature (`overview-`, `cip-`, `rs-`,
  `hw-`, `sidebar-`). No BEM, no nesting deeper than two levels.
- Prefer tokens over literals in new code. Legacy files hardcode hexes;
  migrate opportunistically when touching a rule, not in bulk.
- Layout with flex/grid `gap`, not sibling margins.
- Any wide element gets its own `overflow-x: auto` container so the page body
  never scrolls sideways.
- Icons are lucide-react only (the CSP forbids remote images, favicons
  included): `16` inline, `18` nav, `22` mobile topbar, `28-32` empty states.
