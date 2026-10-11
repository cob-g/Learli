# Learli — UI Context

> **Project:** Learli, an online tutoring marketplace and booking intermediary  
> **File:** `context/ui-context.md`  
> **Version:** 1.1 • 2026-10-11  
> **Status:** V1 UI system. Product boundaries and brand direction are agreed. Token values and component specifications below are proposed defaults until design approval.  
> **Related:** [`project-overview.md`](./project-overview.md), [`prd.md`](./prd.md), [`architecture.md`](./architecture.md), [`code-standards.md`](./code-standards.md), [`ai-workflow-rules.md`](./ai-workflow-rules.md), [`build-plan.md`](./build-plan.md), [`progress-tracker.md`](./progress-tracker.md), [`AGENTS.md`](../AGENTS.md)

## How to use this file

This is the single visual and interaction reference for Learli V1. Read it before designing a page or changing a shared component. It describes intended design. It is not evidence that any UI has been built.

- `[AGREED]` Learli helps families and learners find tutors, book 1:1 lessons, and join them on Zoom or Google Meet. It is not an LMS.
- `[AGREED]` Visual identity: lowercase `learli` wordmark, deep navy plus teal, rounded forms, a friendly and contemporary character, responsive and accessible. Light-first: one light theme in V1, with a light ground on every page.
- `[AGREED]` UI stack: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui.
- `[PROPOSED]` Everything else below: every token value, type size, radius, duration, layout number, component anatomy, and label, and Poppins as the brand font. Review them as a set. Do not override them one screen at a time.
- `[GATED]` Pricing, checkout, subscriptions, payouts, trial offers, refund windows, review publication, and onboarding of real minor learners. No user-facing claim or live flow until the business and safeguarding rules are approved.

**Precedence:** latest explicit product or design decision and any safety or security requirement, then `project-overview.md`, `prd.md`, and `architecture.md` (direction, behavior, and invariants), then this file for the design system alongside `code-standards.md`, `ai-workflow-rules.md`, and `build-plan.md` for their own subjects, then `AGENTS.md`. This is the order in `AGENTS.md` §1. Escalate a conflict. Do not settle it by quietly changing the product.

**How the rules are written.**

- Every statement about the UI is a requirement, whether or not it says "must". "Never" means no per-screen exception. "May" marks the only optional items. None of these words means approved: the approved invariants are the `[AGREED]` bullets above and the rows of the table below. Everything else is `[PROPOSED]` and changes only through [Change management](#change-management).
- Each rule is meant to be checked from a screenshot, a diff, or a grep. Where this file gives a value, use that value.
- Bold marks a list label or a named rule. A named rule is stated once and cited by name elsewhere.
- Where this file is silent, do not fall back on a familiar template. Read [Anti-slop guardrails](#anti-slop-guardrails), then ask.
- The brand choices are executed precisely, not avoided. A scan or review finding against the `learli` artwork, navy, teal, Poppins, or rounded corners is escalated to the founders. It is never resolved by changing the font or the palette.

### Facts owned by other documents

The UI must not contradict these. Their rules are not restated in this file. Only the on-screen consequence is.

| Fact | Owner | On-screen consequence |
|---|---|---|
| The server decides availability, ownership, booking status, and who may see a meeting link | `architecture.md`, `code-standards.md` | A status is shown only from a server response. The meeting action is rendered only when the server returns the link. Hiding a control is never authorization |
| Marketplace scope: no LMS, uploads, in-app messaging, or built-in video | `prd.md`, `AGENTS.md` | Navigation never contains Courses, Assignments, Grades, Submit homework, Content library, AI tutor, or Progress analytics |
| Payments, trials, refunds, holds, and cancellation terms are `[GATED]` | `prd.md` | No price, checkout, trial, timer, or policy text is rendered until approved |
| Learners may be minors | `prd.md`, `architecture.md` | Nothing read from a learner profile (display name, level, or any other field) appears on a public route, in a URL, in a `<title>` element, or in page metadata. A level or subject that a visitor picks as a search or matching filter is a filter value, not learner data, and may be in the query string |
| Guardian consent, minor eligibility, and learner profile fields are `[OPEN]` | `prd.md` FAM-01, BR-16 | "Add a learner" and the learner form run only in development and test, with synthetic data, until the policy is approved. This file designs no consent checkbox, age question, or guardian-proof step, and no builder writes consent wording |
| A tutor sees only the minimum learner information for a booked lesson | `prd.md` TUT-06, BKG-04 | The tutor workspace renders the learner exactly as the server returns it for the assigned tutor and adds no field of its own. It never shows a guardian's contact details or time zone |
| Admin access is scoped to a task | `prd.md` ADM-03, `architecture.md` | Every admin view, list or detail, shows only the fields the current support or safety case needs. Bookings and accounts are lookups: a search form and its results, never a default list of every record |

---

## Theme

### Design thesis

`[PROPOSED]` Learli's interface is built around one object: a real approved tutor's real open time, written in the viewer's own time zone.

Learli does not make learning content. It helps someone choose a person and a time, often for a child and often across time zones (`prd.md` §3.1 and §8.3). This file is designed without tutor photos: no upload or storage is approved, and whether photos are needed at launch is open (`prd.md` §18). Ratings, reviews, prices, and volume statistics are not shown until they are backed and approved. Every screen must therefore be complete without them, and hierarchy comes from type in this order:

1. **The tutor:** display name, subjects, levels.
2. **The time:** date, time, and zone in the viewer's own time zone, set in [the time column](#the-signature-the-time-column).
3. **The next action:** one primary action per screen.

Color, illustration, and explanation support those three or are removed. A screen that looks like a tutoring-marketplace landing page (illustrated hero, statistics strip, row of icon cards, star-rated tutor carousel, testimonial band) or a tile-and-chart dashboard is wrong even when every token on it is correct: Learli has none of the content those arrangements exist to hold.

### Surface modes

One family, one token set, and one set of controls serve three kinds of surface. Decide which one a page is before laying it out.

| Mode | Surfaces | The visitor is here to | What that changes |
|---|---|---|---|
| Persuade | `/`, `/how-it-works`, `/become-a-tutor`, `/subjects` | understand the offer and act on it | May use the `display`, `headline`, and `lead` type roles. The home page has one navy field above the footer. A section's layout follows its content: two adjacent sections share a layout only when they hold the same kind of content |
| Operate | `/tutors`, `/tutors/[slug]`, `/get-matched`, sign-in and account creation, booking, support and report forms, every role workspace | finish a task | `page-title` and below, at fixed sizes. Standard controls, rows, and labelled values. No navy field in the page body, no illustration, no decoration |
| Read | `/privacy`, `/terms`, `/cancellations`, help content | understand something | One column at 34rem in the `prose` role, real heading levels, in-page contents when a document has four or more `h2` headings |

### Character

- **Friendly through form, not decoration.** Friendliness comes from four things: Poppins' round letterforms, rounded controls, plain sentence-case words, and 44px tap targets. It never comes from mascots, cartoon illustration, emoji, confetti, or a separate style for younger learners. A parent, a college learner, a tutor, and an admin get the same components and the same adult language.
- **Cool neutrals.** Every neutral is tinted toward navy. There is no cream, ivory, beige, sand, or warm-gray surface. `--state-warning-soft` is the only warm fill and appears only as the warning tone.
- **Flat.** Every fill is one flat token. Depth is a 1px line, and a shadow means "this floats" (see [Elevation](#elevation)).
- **Quiet workspaces.** Signed-in screens are rows and labelled values. Color appears there only for action, selection, and status.

### Theme policy

V1 ships one light theme. Dark mode is not a V1 requirement. If it is added later it is a full tokenized theme.

- `:root { color-scheme: light; }` stays in the theme file, and the root layout declares a light color scheme.
- Delete the `.dark { ... }` token block that `shadcn init` writes. Do not install `next-themes` or a theme switcher, and never add the `dark` class to an element.
- Keep a class-based dark variant declared in the global stylesheet (for example `@custom-variant dark (&:is(.dark *));`). Without it, `dark:` utilities inside generated primitives follow the OS setting.
- The toast primitive is `sonner`. Its generated wrapper imports `next-themes` and passes `theme="system"`, which follows the OS. Delete that import and pass `theme="light"` (see [Primitive overrides](#primitive-overrides)).
- Check: with the OS set to dark, `/`, `/tutors`, a workspace, and one toast with a description render exactly as they do with the OS set to light.

### Visual reference

The early learner-facing brand board and the selected icon concept are inspiration, not approved screens. The board's unrelated category examples (programming, arts and music, hobbies) are not part of Learli's launch catalog. Its lavender accent is not carried into the token set (see [Colors](#colors)).

### First-viewport contract

`[PROPOSED]` Checked at 390×844 and 1440×900 without scrolling. With the logo covered, each viewport must still show a tutor name with subjects and a dated time with its zone, or the control that leads to them, or the empty state. A viewport that shows only a headline, a graphic, and a button fails.

| Route | Must be visible | Filled primary action |
|---|---|---|
| `/` | `h1`, the subject and level search with its submit button. At 1440×900 also the top of the first tutor row. With zero inventory: the `h1`, the `lead`, and the empty state | Find a tutor (none with zero inventory) |
| `/tutors` | Search field, filters (rail from `lg`, button below), result line once loaded, and the first tutor row or the filtered-out state. With zero inventory: the `h1` and the empty state only | none |
| `/tutors/[slug]` | Tutor name, subjects and levels, the picker's heading and zone line | Review booking |
| Booking review | Who, what, and when | Book lesson |
| `/student`, `/parent`, `/tutor` | Whose bookings these are, then the next lesson or the empty state | The meeting action when the server returns the link. Otherwise the empty state's action |

**The One Primary Rule.** A screen has at most one filled primary button. Actions on repeated items (tutor rows, booking rows, time options) are links, options, or outline buttons. The site header never contains a filled button. Test: count filled buttons in a full-page screenshot. The count is 0 or 1. A primary inside an open dialog or sheet is counted separately.

---

## Anti-slop guardrails

"AI slop" here means the look and wording that generated interfaces converge on, whatever the product. An agent told "friendly, modern, rounded, navy and teal" builds the page it builds for every tutoring, coaching, and SaaS product. Each row names one of those defaults. If a screen contains one, fix the screen. The specification for what to build instead lives in the section named in the last column.

### Structure

| Refused pattern | Build this instead | See |
|---|---|---|
| Template hero: headline, subcopy, and buttons that only link elsewhere, over an illustration, gradient, or product mockup. A full-height or centered hero | The first viewport of `/` holds the `h1` and the working tutor search, left-aligned, in a field as tall as its content | [Public marketing site](#public-marketing-site) |
| Row of same-size cards, each an icon, a heading, and two lines of text | Subjects are a link index. "How booking works" is one ordered list. The intermediary explanation is two text columns | [Public marketing site](#public-marketing-site) |
| Eyebrow, kicker, chip, or tagline above a heading | Every section opens with its heading | [Type rules](#type-rules) |
| Decorative section numbers (01, 02, 03) or oversized step numerals | Numbers appear only where order is information: the ordered list of booking steps, "Question 2 of 3" | [Guided matching](#guided-matching-get-matched) |
| Statistics strip, hero metric, rating stars, "trusted by" logos, testimonial carousel. Learli has no approved numbers, reviews, or partners | Real tutor rows, or the zero-inventory state | [The Backed Claim Rule](#product-copy-content-and-trust) |
| Grid of tutor tiles. Without photos a grid is a wall of unequal text boxes, and families compare by reading | One list, one tutor per row, with name, subjects, and next open time in fixed positions | [Tutor card](#tutor-card) |
| Card inside a card, or a card around every section | One container level. Group with headings, spacing, and 1px rules | [Elevation](#elevation) |
| KPI tiles, charts, sparklines, progress rings, progress bars, greeting banners, activity feeds | Workspaces open on the next lesson, then an agenda. Profile completeness is a list of missing items | [Account and role workspaces](#account-and-role-workspaces) |
| A dialog for a task that is not a confirmation | Booking, matching, and every form are pages | [Navigation and surface conventions](#navigation-and-surface-conventions) |
| Month-grid date picker in a popover for choosing a lesson time | Open times listed inline by day | [Availability picker](#availability-picker) |

### Surface

| Refused pattern | Build this instead | See |
|---|---|---|
| Gradients of any kind: gradient text, gradient buttons, gradient or mesh backgrounds | Flat token fills. Emphasis from weight and size | [Colors](#colors) |
| Glass: backdrop blur, translucent panels, a frosted header or overlay | An opaque `--bg-surface` header with a 1px bottom line. A flat scrim | [Public marketing site](#public-marketing-site) |
| A shadow on a resting card, hover lift, hover scale, glow | Resting content is flat. Only floating layers take a shadow. Hover changes color only | [Elevation](#elevation) |
| Side tab: a colored left or right border thicker than 1px on a row, card, nav item, or alert | A full 1px border, an icon, and a text label | [Statuses](#statuses) |
| Decorative shapes: blobs, dot grids, squiggles, sparkles, accent dots, tinted rounded blocks behind content | Leave the space empty, or show real tutor and time data | [Assets and Imagery](#assets-and-imagery) |
| Icon tile: an icon inside a tinted circle or rounded square, or an icon above a heading | An icon sits inline, inside a control or a status | [Icons](#icons) |
| Emoji or Unicode symbols as icons, bullets, or decoration | Lucide icons, or nothing | [UI copy rules](#ui-copy-rules) |
| Badge soup: several pills on one record, or subjects and levels as a wall of chips | One status badge per booking. Subjects and levels are plain text separated by ` · ` | [Statuses](#statuses) |
| A different color for each avatar, or a hue outside the token table (purple, lavender, warm beige) | Every avatar uses the same two tokens. Every color has a named job | [Colors](#colors) |
| Pill-shaped buttons, inputs, and badges | The radius ladder. Full rounding only on circles | [Border Radius](#border-radius) |

### Type, color, motion, and copy

| Refused pattern | Build this instead | See |
|---|---|---|
| A second typeface: a serif or italic display accent, or monospace for a "technical" feel | Poppins only | [Typography](#typography) |
| All-caps or letter-spaced labels | Sentence case at normal tracking | [Type rules](#type-rules) |
| The same size, weight, and spacing at every level | Type roles and spacing roles | [Spacing roles](#spacing-roles) |
| Gray text on a tinted or navy surface, or text and states dimmed with opacity | The pairs in the [contrast contract](#contrast-contract). States use tokens | [Interaction states](#interaction-states) |
| Teal as text, icon, border, or indicator on a light surface, or a white label on teal. Both are 2.02:1 | Teal's two jobs | [Strategy](#strategy) |
| Any motion on the Never list: scroll reveals, staggered entrances, parallax, bounce, pulsing dots, typing indicators, count-up numbers, confetti | The motion table | [Motion](#motion) |
| Vague or hyped headlines, generic buttons ("Get started", "Learn more", "Submit"), exclamation marks, cheerleading | A headline states the offer. A button names its action and object | [UI copy rules](#ui-copy-rules) |
| Placeholder content: lorem ipsum, invented tutors, stock or generated portraits, sample ratings, "Coming soon" | Real data or a written empty state | [Empty states](#empty-states) |
| A large gray icon over "Nothing here yet" | The fact, what will appear, and one action, where the content would be | [Empty states](#empty-states) |
| A time without its date and zone, a numeric-only date, or a raw IANA identifier | The three `LessonTime` forms | [Dates and times](#dates-and-times) |
| Forms that ask for everything up front | Ask only what the current step needs (`prd.md` §14.2) | [Navigation and surface conventions](#navigation-and-surface-conventions) |
| Unedited shadcn defaults: 32 to 36px controls, 14px button labels, a translucent focus ring, `opacity-50` disabled states, hairline input borders | The override table | [Primitive overrides](#primitive-overrides) |

### How to check

1. **Cover the logo.** The first viewport still passes the [first-viewport contract](#first-viewport-contract).
2. **Squint.** With detail blurred, one element leads, a second supports, and groups are separated by space or a rule, not by boxes.
3. **Grayscale.** Every status, selection, and link is still identifiable (The Three Signals Rule).
4. **Find the time column.** On `/tutors`, a tutor profile, and a workspace, a zone line and a column of times are on screen, and a vertical line at the left edge of the first time touches every time in that list.
5. **Grep.** Expected output is empty. The commands were tested with BSD grep. Extend them when a new default slips through.

   ```bash
   # refused effects and transforms in feature code
   grep -rnE "bg-gradient|bg-linear|bg-radial|bg-conic|bg-clip-text|backdrop-blur|animate-(bounce|ping)|hover:(-?translate|scale|shadow)|transition-all|border-[lrsex]-([2-8]|\[)|rounded-\[|uppercase|font-mono" src --include="*.ts" --include="*.tsx" --exclude-dir=ui | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|/\*|\*)"
   # colors outside the token set
   grep -rnE "(bg|text|border|ring|outline|fill|stroke|decoration|divide|placeholder|shadow|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]" src
   grep -rnE "(bg|text|border|ring|outline|fill|stroke|from|via|to)-(white|black)|\[#[0-9a-fA-F]{3,8}\]|#[0-9a-fA-F]{6}" src --include="*.ts" --include="*.tsx" --exclude-dir=ui
   # utilities that compile but resolve to the wrong token (see the token-to-utility table)
   grep -rnE "(text-muted|text-inverse|text-accent|bg-accent|bg-muted|bg-card|bg-secondary|border-input)([^-a-z]|$)" src --exclude-dir=ui
   ```

6. **Run the detector** on changed UI files: `.claude/skills/impeccable/scripts/impeccable detect <files or directories>` where the Impeccable skill is installed, or `npx impeccable detect <files or directories>` elsewhere. Fix what it reports, or record a narrow exception with a reason. A clean scan does not replace checks 1 to 5.

---

## Colors

### Strategy

`[PROPOSED]` Navy against cool near-white, with teal reserved for two jobs. A color with no job on a screen does not appear on that screen.

- **Navy is the ink, the action, and the selection.** Text, links, the primary button, and every selected or current state are navy.
- **Navy is also a ground, in two places only:** the first-viewport field of `/` and the site footer. They are full-bleed, flat `--brand-navy` fields with white text. This is the app icon's own composition (navy ground, white mark, one teal dot) carried to page scale. No other background larger than a button is navy.
- **Teal has two jobs and no others:**
  1. **On a navy field:** `--accent-primary` is the fill of the one primary action inside the field, with a `--text-primary` label (7.70:1; the fill against the field is 6.26:1). It also appears in the approved `learli` artwork. A navy field shows at most one teal element.
  2. **On a light surface:** `--accent-strong` on `--accent-soft` is the confirmed and success tone (5.77:1). On a light surface teal means "confirmed" and nothing else. Success aliases the teal pair, because a separate green was indistinguishable from it (1.04:1 apart).
- **Teal is never** a decorative dot or shape, a headline highlight, an underline, an icon tile, a callout that reports no status, a hover or selection fill on a light surface, a link color, a gradient stop, or a button fill on a light surface.
- **Red is for failures and destructive actions.** A cancelled or expired booking is history, not a failure, and uses the inactive tone.

### Core palette

The `:root` block in [Starter CSS variables](#starter-css-variables-tailwind--shadcnui) is the one place values are written. Feature components reference tokens and never embed a hex code.

| Role | CSS variable | Job |
|---|---|---|
| Page ground | `--bg-base` | The ground of every Operate and Read page and every light section |
| Content surface | `--bg-surface` | Site header, the tutor list, booking panels, forms, tables, form controls, overlays |
| Shell surface | `--bg-subtle` | Admin rail, table header row, read-only inset regions, neutral notices, hover fill |
| Hairline | `--border-default` | Separators, panel edges, table row rules, skeleton fill. Never the only edge of an enabled control |
| Control boundary | `--border-control` | The 1px edge of every input, select, textarea, checkbox, radio, outline button, and time option |
| Primary text | `--text-primary` | Headings, body, labels |
| Muted text | `--text-muted` | Secondary text, metadata, placeholders, disabled labels |
| Navy | `--brand-navy` | Primary button, links, selected and current states, navy fields |
| Navy hover, navy pressed | `--brand-navy-hover`, `--brand-navy-active` | Hover and pressed fills of navy controls |
| Focus ring | `--focus-ring` | Focus indicator on light surfaces |
| Bright teal | `--accent-primary` | The one primary action inside a navy field. Approved artwork. Never on a light surface |
| Teal text, teal fill | `--accent-strong`, `--accent-soft` | The confirmed and success tone. `--accent-soft` is also the hover fill of the action inside a navy field |
| Navy field | `--bg-inverse` | The home first-viewport field and the footer |
| Text on navy | `--text-inverse`, `--text-inverse-muted` | Primary and secondary text inside a navy field |
| Focus ring on navy | `--focus-ring-inverse` | Focus indicator inside a navy field |
| Scrim | `--scrim` | The layer behind a dialog or sheet |
| Success | `--state-success`, `--state-success-soft` | Aliases of the teal pair, named for components |
| Warning | `--state-warning`, `--state-warning-soft` | A state with a deadline or a required user action |
| Error | `--state-error`, `--state-error-soft` | Failed operations, invalid input, destructive actions |

- Adjacent surfaces are always separated by a 1px `--border-default` line. The three neutral fills differ by only 1.05:1 to 1.11:1, so a fill alone is not a boundary.
- Neutrals come only from these tokens. No Tailwind `gray-*`, `slate-*`, `zinc-*`, `neutral-*`, or `stone-*` class, no pure black, and no third hue: no lavender, violet, or purple as a token, an arbitrary value, or a shape drawn in code.

### Contrast contract

Target: WCAG 2.2 AA. Text needs 4.5:1. Large text (24px regular, or 18.66px bold, and up) needs 3:1. The boundary of a control, an icon that carries meaning, and the focus indicator need 3:1.

These are the only foreground and ground pairs a component may use. Ratios are computed for the exact values in `:root`. A pair that is not listed is not allowed until it is measured and added here. When a token value changes, recompute every number in this file in the same change.

| Foreground | Allowed grounds | Lowest ratio |
|---|---|---|
| `--text-primary` | `--bg-surface`, `--bg-base`, `--bg-subtle`, every soft fill | 13.99:1 |
| `--text-muted` | `--bg-surface`, `--bg-base`, `--bg-subtle` | 5.52:1 |
| `--brand-navy` (links, icons, outline labels) | `--bg-surface`, `--bg-base`, `--bg-subtle` | 11.38:1 |
| `--text-inverse` | `--brand-navy`, `--brand-navy-hover`, `--brand-navy-active`, `--state-error` | 6.57:1 |
| `--text-inverse-muted` | `--brand-navy` | 9.84:1 |
| `--text-primary` | `--accent-primary` (the action label inside a navy field) | 7.70:1 |
| `--accent-strong` | `--accent-soft`, `--bg-surface`, `--bg-base` | 5.77:1 |
| `--state-warning` | `--state-warning-soft`, `--bg-surface`, `--bg-base` | 5.80:1 |
| `--state-error` | `--state-error-soft`, `--bg-surface`, `--bg-base` | 5.97:1 |
| `--border-control` (non-text) | every light ground and soft fill | 3.23:1 |
| `--focus-ring` (non-text) | every light ground | 6.02:1 |
| `--focus-ring-inverse` (non-text) | `--brand-navy` | 12.67:1 |

Never, at any size:

- white on `--accent-primary` (2.02:1);
- `--accent-primary` on a light ground as text, icon, border, or indicator (2.02:1 on `--bg-surface`, 1.92:1 on `--bg-base`);
- `--text-muted` on navy (2.06:1), or any state color or `--focus-ring` on navy (`--focus-ring` is 1.89:1 there);
- `--border-default` as the only edge of an enabled control (1.29:1 on `--bg-surface`, 1.22:1 on `--bg-base`, 1.16:1 on `--bg-subtle`);
- opacity or an alpha modifier on text, a fill, or a border to express a state. Alpha is allowed only in `--scrim` and inside the shadow tokens.

### Starter CSS variables (Tailwind + shadcn/ui)

Place these in `src/app/globals.css`. The Learli tokens are the specification. The alias and `@theme` blocks show the wiring: regenerate them from the installed shadcn and Tailwind versions, keep every mapping the install generates (including chart and sidebar tokens if a component needs them), and point each alias at a Learli token. Never keep two competing themes.

```css
:root {
  color-scheme: light;

  /* Neutrals: cool, tinted toward navy */
  --bg-base: #F7F9FC;
  --bg-surface: #FFFFFF;
  --bg-subtle: #EFF3F9;
  --border-default: #DDE3EF;
  --border-control: #7C87A0;
  --text-primary: #16204D;
  --text-muted: #55627A;

  /* Navy: ink, action, selection */
  --brand-navy: #1E2A78;
  --brand-navy-hover: #162267;
  --brand-navy-active: var(--text-primary);
  --focus-ring: #364BD6;

  /* Teal: confirmed on light surfaces, the one action inside a navy field */
  --accent-primary: #2ECCB0;
  --accent-strong: #056D60;
  --accent-soft: #E7FAF5;

  /* Navy fields: the home first-viewport field and the footer */
  --bg-inverse: var(--brand-navy);
  --text-inverse: #FFFFFF;
  --text-inverse-muted: #DDE3EF;
  --focus-ring-inverse: #FFFFFF;
  --scrim: rgb(22 32 77 / 0.5);

  /* State tones */
  --state-success: var(--accent-strong);
  --state-success-soft: var(--accent-soft);
  --state-warning: #8A5300;
  --state-warning-soft: #FFF4DD;
  --state-error: #B42318;
  --state-error-soft: #FEF1F1;

  /* shadcn semantic aliases */
  --background: var(--bg-base);
  --foreground: var(--text-primary);
  --card: var(--bg-surface);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-surface);
  --popover-foreground: var(--text-primary);
  --primary: var(--brand-navy);
  --primary-foreground: var(--text-inverse);
  --secondary: var(--bg-subtle);
  --secondary-foreground: var(--text-primary);
  --muted: var(--bg-subtle);
  --muted-foreground: var(--text-muted);
  --accent: var(--bg-subtle);              /* neutral hover and keyboard highlight, never teal */
  --accent-foreground: var(--text-primary);
  --destructive: var(--state-error);
  --border: var(--border-default);
  --input: var(--border-control);
  --ring: var(--focus-ring);
  --radius: 0.875rem;
}

/* A navy field re-scopes text and focus tokens for everything inside it */
[data-surface="inverse"] {
  background: var(--bg-inverse);
  color: var(--text-inverse);
  --focus-ring: var(--focus-ring-inverse);
  --ring: var(--focus-ring-inverse);
}

/* Element defaults sit in the base layer so a utility can still adjust them */
@layer base {
  ::selection { background: var(--brand-navy); color: var(--text-inverse); }
  [data-surface="inverse"] ::selection { background: var(--text-inverse); color: var(--brand-navy); }
  :root { caret-color: var(--brand-navy); accent-color: var(--brand-navy); }
  ::placeholder { color: var(--text-muted); opacity: 1; }
  a { text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
  a:focus-visible { text-decoration-thickness: 2px; }
  @media (hover: hover) { a:hover { text-decoration-thickness: 2px; } }
  b, strong { font-weight: 600; }
  html { font-synthesis: none; }
}

/* Unlayered on purpose: it outranks every utility, so outline-none in a generated
   primitive cannot remove it. Do not move this rule into a layer. */
:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
```

For Tailwind CSS v4, expose the tokens through the theme.

```css
@theme inline {
  /* shadcn slots: one --color-<slot>: var(--<slot>) line for every alias declared in :root.
     A reviewer diffs the two lists. A missing line is a defect. */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ...card, popover, secondary, muted, accent, destructive, border, input, ring */

  /* Learli roles */
  --color-surface: var(--bg-surface);
  --color-subtle: var(--bg-subtle);
  --color-control: var(--border-control);
  --color-primary-hover: var(--brand-navy-hover);
  --color-primary-active: var(--brand-navy-active);
  --color-success: var(--state-success);
  --color-success-soft: var(--state-success-soft);
  --color-warning: var(--state-warning);
  --color-warning-soft: var(--state-warning-soft);
  --color-error: var(--state-error);
  --color-error-soft: var(--state-error-soft);
  --color-inverse: var(--bg-inverse);
  --color-on-inverse: var(--text-inverse);
  --color-on-inverse-muted: var(--text-inverse-muted);
  --color-inverse-action: var(--accent-primary);
  --color-inverse-action-hover: var(--accent-soft);
  --color-scrim: var(--scrim);

  --font-sans: var(--font-poppins), ui-sans-serif, system-ui, sans-serif;
}

@theme {
  /* Radius by nesting level (see Border Radius) */
  --radius-check: 0.25rem;    /* 4px */
  --radius-tag: 0.375rem;     /* 6px */
  --radius-control: 0.625rem; /* 10px */
  --radius-surface: 0.875rem; /* 14px */
  --radius-overlay: 1.125rem; /* 18px */

  /* Depth: floating layers only (see Elevation) */
  --shadow-float: 0 4px 12px -2px rgb(22 32 77 / 0.12);
  --shadow-modal: 0 16px 40px -8px rgb(22 32 77 / 0.2);

  /* Motion (see Motion) */
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);

  /* Type roles (see Typography): size, line height, weight, and tracking travel together.
     Define all fourteen from the type scale table. Two are shown as the pattern. */
  --text-display: clamp(2.25rem, 1.833rem + 2.083vw, 3.5rem);
  --text-display--line-height: 1.1;
  --text-display--letter-spacing: -0.02em;
  --text-display--font-weight: 700;
  --text-page-title: 1.75rem;
  --text-page-title--line-height: 2.25rem;
  --text-page-title--font-weight: 600;
  /* headline: clamp(1.75rem, 1.583rem + 0.833vw, 2.25rem), 1.2, -0.01em, 700 */
}
```

The blocks above were compiled with Tailwind CSS 4.3 and generate every utility this file names. Confirm against the installed version.

**Write the utility in the middle column.** This file specifies colors by Learli token, but several utilities with matching names resolve to a different token through the shadcn aliases. The names on the right compile and are wrong.

| Token in this file | Utility to write | Never in feature code |
|---|---|---|
| `--text-primary` | `text-foreground` | `text-primary` (that is navy) |
| `--text-muted` | `text-muted-foreground` | `text-muted` (that is the fill `--bg-subtle`, 1.11:1 on white) |
| `--brand-navy` | `bg-primary`, `text-primary`, `border-primary` | |
| `--bg-base`, `--bg-surface`, `--bg-subtle` | `bg-background`, `bg-surface`, `bg-subtle` | `bg-muted`, `bg-accent`, `bg-card`, `bg-secondary` |
| `--border-default`, `--border-control` | `border-border`, `border-control` | `border-input` |
| `--text-inverse`, `--text-inverse-muted` | `text-on-inverse`, `text-on-inverse-muted` | `text-inverse` (that is navy on navy), `text-muted-foreground` inside a navy field |
| `--accent-primary` | `bg-inverse-action`, `hover:bg-inverse-action-hover` | any `accent` utility (neutral, not teal) |
| The state tokens | `text-success`, `text-warning`, `text-error`, `bg-success-soft`, `bg-warning-soft`, `bg-error-soft`, `bg-destructive` for the destructive button | |

**Register the custom names with the class merger.** Generated primitives pass every class list through `cn()`, which runs `tailwind-merge`. Unconfigured, it reads an unknown `text-*` class as a text color: `cn("text-page-title", "text-foreground")` returns `text-foreground`, and the role is dropped with no warning. It also does not treat `rounded-control`, `shadow-float`, or `ease-enter` as replacing the stock classes. Configure one merger in `src/lib/utils.ts` and import `cn` from there in every file. Verify the option names against the installed `tailwind-merge` version.

```ts
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "headline", "lead", "page-title", "section-title", "item-title", "body", "prose",
             "action", "time", "label", "label-strong", "small", "caption"],
      radius: ["check", "tag", "control", "surface", "overlay"],
      shadow: ["float", "modal"],
      ease: ["enter", "exit"],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

A unit test, required before the first feature component, asserts that `cn("text-page-title", "text-foreground")` keeps both classes and that `cn("rounded-md", "rounded-control")` returns `rounded-control`. Adding a type role, radius, shadow, or easing token means adding its name to this list in the same change.

### Color usage rules

- **Primary action:** navy fill, white label. One per screen (The One Primary Rule).
- **Secondary action:** the outline button: `--bg-surface` fill, 1px `--border-control` edge, `--brand-navy` label, `--bg-subtle` on hover. The borderless `secondary` variant is not used.
- **Destructive action:** `--state-error` fill with a white label (6.57:1), only on the confirming step. It keeps its rest fill on hover.
- **Links:** one color, `--brand-navy`, underlined at rest (1px, offset 0.2em), with the underline thickening to 2px on hover and focus. Navy against body text is only 1.23:1, so the underline is the affordance. It is removed at rest in three places only, where position marks the links as navigation: the site header, the workspace navigation, and the footer link list. Every other link is underlined at rest, including "Change time zone", "Browse all tutors", "Get matched", the subject index, and empty-state links.
- **Inside a navy field** (its root element carries `data-surface="inverse"`): headings and body are `--text-inverse`, secondary text is `--text-inverse-muted`, links are white, the one primary action is `--accent-primary` with a `--text-primary` label and an `--accent-soft` hover, and a secondary action is a 1px white outline with a white label. Form controls keep their light-surface fill and text. No state text and no status badge sits directly on navy.
- **Avatars:** every initials avatar is `--bg-subtle` with `--text-primary` initials in the `label-strong` role. No color derived from the name and no gradient.

#### Statuses

**The Three Signals Rule.** Every status, selection, and validation state is carried by text, plus an icon, plus color, in that order of authority. The text alone must be sufficient. Color alone or icon alone is a defect. Navigation is the one exemption from the icon: the current item carries the border or fill given in [Interaction states](#interaction-states). Test: the screen is unambiguous in a grayscale screenshot.

Five tones exist. A label from the approved booking lifecycle picks one of them and never gets a new color.

| Tone | Fill | Text and icon | Ratio | Proposed labels and icons |
|---|---|---|---|---|
| Success | `--state-success-soft` | `--state-success` | 5.77:1 | Confirmed (`CircleCheck`) |
| Info | `--bg-subtle` | `--text-primary`, icon `--brand-navy` | 13.99:1, 11.38:1 | Pending (`Hourglass`). A neutral notice (`Info`) |
| Warning | `--state-warning-soft` | `--state-warning` | 5.80:1 | Any state to which the approved lifecycle attaches a deadline or a required user action (`TriangleAlert`) |
| Inactive | `--bg-subtle` | `--text-muted` | 5.52:1 | Completed (`Check`), Cancelled (`Ban`), Expired (`TimerOff`) |
| Error | `--state-error-soft` | `--state-error` | 5.97:1 | A failed operation (`CircleAlert`) |

- `StatusBadge` is the only component that renders a booking status, and a record shows one badge. It is 28px tall with 8px inline padding, a 16px icon, a 4px gap, the `label` role, `--radius-tag`, and a 1px border in the tone's text token, so it stays visible on a hovered row.
- An alert is the tone's fill, a full 1px border in the tone's text token, a 20px icon in that token, and title and body in `--text-primary`. No thicker edge on one side. An alert is not a container and may sit inside a panel.
- Labels follow `prd.md` §8.1, which marks the state names illustrative. `Awaiting payment`, `Failed`, and `No-show` are `[GATED]` and are not rendered until their policies are approved. See [Status labels](#status-labels).

#### Interaction states

Each state uses the tokens below. Opacity is not used for state.

| State | Primary button | Outline button | Option (a time, a learner) | Nav item or row |
|---|---|---|---|---|
| Rest | `--brand-navy` fill, white label (12.67:1) | `--bg-surface` fill, 1px `--border-control`, `--brand-navy` label | `--bg-surface` fill, 1px `--border-control`, `--text-primary` label | No fill, `--text-primary` label |
| Hover, on devices that hover | `--brand-navy-hover` (14.40:1) | `--bg-subtle` fill | `--bg-subtle` fill | `--bg-subtle` fill (`--bg-surface` inside the admin rail) |
| Pressed | `--brand-navy-active` (15.58:1) | `--bg-subtle` fill, 1px `--brand-navy` edge | The same | `--bg-subtle` fill |
| Selected or current | not applicable | not applicable | `--brand-navy` fill, white label, and a `Check` icon, with `aria-checked` | `--brand-navy` text in the `label-strong` role with `aria-current`, plus a 2px `--brand-navy` bottom border on a top-bar item, or a `--bg-surface` fill with a 1px `--border-control` border on an admin-rail item |
| Disabled | `--bg-subtle` fill, `--text-muted` label (5.52:1) | The same, with a 1px `--border-default` edge | The same | `--text-muted` label |
| Loading | Rest colors, a 16px spinner before an in-progress label, `aria-busy` | The same | not applicable | not applicable |
| Focus-visible | The global 2px outline with a 2px offset, on top of any other state | The same | The same | The same |

- Selection is navy everywhere: the chosen time, the chosen learner, the current nav item. Selection never uses the success tone, because a chosen time is not a confirmed booking.
- Hover never reveals an action or content. Touch has no hover.
- A disabled control has text beside it that says what enables it. A submit button is not disabled to signal an incomplete form: it stays enabled and validation says what is missing.

---

## Typography

### Font

`[PROPOSED]` Poppins is the brand concept's typeface and the only font in the product. It carries headings, body, labels, and data. No second family and no monospace.

| Use | Font | Applied through |
|---|---|---|
| Brand wordmark | Approved `learli` artwork | The asset. Never recreate the wordmark by typing it in Poppins |
| All text | Poppins 400, 500, 600, 700, upright only | `--font-sans`, inherited from `html` |

Load it in `src/app/layout.tsx` with `next/font/google`: `subsets: ['latin']`, `weight: ['400', '500', '600', '700']`, `style: ['normal']`, `display: 'swap'`, `variable: '--font-poppins'`, and put `poppins.variable` on `<html>`.

- Poppins ships as static weights, so each weight is a separate file and the list must be explicit.
- `next/font/google` downloads the files at build time and serves them from the app's own origin. Do not add a `<link>` or `@import` to a font CDN. Leave `adjustFontFallback` at its default so the fallback face is metric-adjusted.
- Delete the scaffold's default font imports and any hard-coded `body { font-family: ... }` rule.

| Weight | Job | Roles |
|---|---|---|
| 400 | Text that is read | `lead`, `body`, `prose`, `small` |
| 500 | Text that names a field, a place, or a state | `label`, `caption` |
| 600 | Text that titles a region, triggers an action, states a date or time, or marks the current place | `page-title`, `section-title`, `item-title`, `action`, `time`, `label-strong` |
| 700 | Headings on Persuade pages only | `display`, `headline` |

No italic file is loaded and UI strings do not use `em`. Adding a weight or the italic is a design-system change.

### Type scale

`[PROPOSED]` One value per cell. Sizes are rem, so browser zoom and user font settings work. Only `display` and `headline` change with the viewport. The theme block under Colors shows two role tokens as the pattern. Define all fourteen from this table.

| Role | Job on Learli surfaces | Size | Weight | Line height |
|---|---|---|---|---|
| `display` | The single `h1` on a Persuade page | 2.25rem at 320px, fluid to 3.5rem at 1280px | 700 | 1.1 |
| `headline` | Section headings on a Persuade page | 1.75rem at 320px, fluid to 2.25rem at 1280px | 700 | 1.2 |
| `lead` | The one paragraph directly under a `display` heading | 1.125rem | 400 | 1.75rem |
| `page-title` | The `h1` on every Operate and Read page | 1.75rem | 600 | 2.25rem |
| `section-title` | Section headings inside those pages. The question on a matching step. The date and time lines of `NextLesson` and booking details | 1.5rem | 600 | 2rem |
| `item-title` | Tutor name on a tutor row, panel headings, dialog and sheet titles, empty-state heading, sub-headings on a Persuade page | 1.125rem | 600 | 1.5rem |
| `body` | Default text: row copy, input values, alerts | 1rem | 400 | 1.5rem |
| `prose` | Long-form text: the tutor introduction on the profile, how-it-works copy, policy pages. Everything else is `body` | 1rem | 400 | 1.625rem |
| `action` | Button labels, at every button size | 1rem | 600 | 1.5rem |
| `time` | Every date and time value in a time column | 1rem | 600 | 1.5rem |
| `label` | Form labels, nav items, status badge text, table headers | 0.875rem | 500 | 1.25rem |
| `label-strong` | The current nav item, avatar initials | 0.875rem | 600 | 1.25rem |
| `small` | Helper text, the zone line, admin table cells, the secondary line of a row | 0.875rem | 400 | 1.25rem |
| `caption` | Allowlist only (The Caption Rule) | 0.75rem | 500 | 1rem |

Tracking is -0.02em on `display`, -0.01em on `headline`, and 0 on every other role. Tracking lives only in the role tokens.

### Type rules

- **The Role Rule.** Every text element takes exactly one role utility (`text-page-title`, `text-label`, and so on). Feature components do not use raw size, weight, leading, or tracking utilities. A heading's role is chosen by its job, not its HTML level. The level follows the document outline: one `h1` per page and no skipped levels.
- **Two registers.** Operate and Read pages use `page-title` and below: fixed rem sizes at every breakpoint, nothing above 1.75rem, nothing above weight 600. Structure changes between breakpoints. Type does not.
- **The Booking Floor.** On the tutor row, availability picker, booking panels, booking lists, and learner context: tutor name, learner name, date, and time are never below 1rem. Zone, duration, and status text are never below 0.875rem. Input, select, and textarea text is 1rem at every breakpoint, which also stops iOS from zooming the page on focus. Admin tables are exempt: every cell is `small`.
- **The Caption Rule.** `caption` is an allowlist: character counters, the `(optional)` marker beside a form label, the footer copyright line, and the timestamp on a history or audit row. It is never used for anything in The Booking Floor, a validation error, a badge, a table cell, or a placeholder.
- **The Measure Rule.** A `prose` paragraph has `max-inline-size: 34rem`, about 68 characters of Poppins at 1rem. `lead` has `max-inline-size: 35rem`. Every other multi-line text block is at most 34rem. The limit is set on the text element, never inherited from the page container. Measure is not set in `ch`: in Poppins `1ch` is the width of "0" (0.63em), so `65ch` sets lines of about 81 characters.
- **The Case Rule.** Every heading, button, link, nav item, badge, and toast is sentence case: capitalize the first word and proper names only (Learli, Zoom, Google Meet, SAT, ACT, and subject and level names exactly as stored in the catalog, such as College Support). No Title Case, no all caps, no trailing period on a label or heading. The `uppercase`, `capitalize`, and `lowercase` utilities are not applied to text.
- **Overflow.** Headings use `text-wrap: balance` and `lead` and `prose` use `text-wrap: pretty`, as progressive enhancement. `display` occupies at most 2 lines at 1280px and 4 lines at 320px. If the copy does not fit, shorten the copy, not the role. Never truncated with an ellipsis: tutor name, learner name, subject and level names, date, time, zone, booking status, error text. These wrap, and the row grows. Two texts are clamped: the introduction on a tutor row, and the introduction on the tutor profile below `lg`. Flex and grid children that hold text set `min-width: 0`.
- **Numerals.** Poppins has no tabular figures: its files carry no `tnum` feature, and at 16px `11:11` is about 24px wide where `00:00` is about 44px. `font-variant-numeric: tabular-nums` does nothing and is not written. Times align by layout: every time is left-aligned in a fixed-width column, time options in one picker share one width, and lists put date and time in separate columns. Digits are never switched to a second typeface.
- Poppins is a wide geometric face. If an admin table does not fit at 1024px, remove or stack a column instead of shrinking the type. Names in scripts Poppins does not cover fall back to the system face mid-string, and role line heights are fixed in rem so the row height holds.

---

## Border Radius

Radius is assigned by nesting level (what contains what), not by component type. `--radius` stays at 0.875rem and equals `--radius-surface`.

| Token | Value | Applies to |
|---|---|---|
| `--radius-check` | 4px | The checkbox box |
| `--radius-tag` | 6px | `StatusBadge` |
| `--radius-control` | 10px | Button, input, select, textarea, time option, menu item highlight |
| `--radius-surface` | 14px | Panels (the tutor list, `BookingSummary`, an alert), dropdown menu, select list, toast |
| `--radius-overlay` | 18px | Dialog. The top two corners of a bottom sheet |
| circle | 50% | Initials avatar |

1. **Same level, same radius.** An input and the button beside it (the home tutor search, the directory search, account forms) share `--radius-control` and one height.
2. **Concentric nesting.** A rounded element sitting 4px inside a rounded container uses the next token down. No element has a larger radius than the container it sits in.
3. **No pills.** Full rounding appears only on an element whose width equals its height. Buttons with text, inputs, search fields, and badges never use it.
4. **Regions are square.** Header, footer, navy fields, sticky bars, list rows, and table rows have radius 0. Radius belongs to components, not to page regions. A side that touches the viewport edge or its container's edge has no radius on that side.
5. **No arbitrary radius.** `rounded-[...]` and inline `border-radius` do not appear in `src/` outside the theme file. Generated primitives take the token for their nesting level, because the scale shadcn derives from `--radius` differs between versions.

### Elevation

**The Flat Surface Rule.** Anything in the page flow is flat. A shadow means "this floats above the page" and nothing else.

| Level | Surfaces | Treatment |
|---|---|---|
| Ground | Page, rows inside a list, table rows, the filter rail | No box. Siblings are separated by spacing or a 1px `--border-default` rule |
| Panel | The tutor list, `BookingDraft`, `BookingSummary`, `NextLesson`, a form that must read as one object | `--bg-surface` and a 1px `--border-default` border. No shadow |
| Floating | Dropdown menu, select list, toast | Panel treatment plus `--shadow-float` |
| Modal | Dialog, sheet | Panel treatment plus `--shadow-modal`, over `--scrim` |

- Only the two shadow tokens exist. Tailwind's `shadow-xs` through `shadow-2xl` do not appear anywhere. Both tokens have a vertical offset and a soft blur and are tinted from `--text-primary`. No glow, no colored shadow, no decorative ring.
- Hover never changes elevation or position. A row that is a link target shows hover with a `--bg-subtle` fill.
- **One container level.** A panel never contains another panel. Inside a panel, group with headings, spacing, and 1px rules. Dialog and sheet content is not wrapped in a card. Form controls, time options, badges, and alerts are not containers.
- Panels are one shared `Panel` component. The shadcn `Card` is not installed in V1. Public page sections sit directly on the page ground.
- A sticky bar on a light ground is flat with a 1px border on its content-facing edge.

---

## Motion

`[PROPOSED]` Motion acknowledges an action or shows a state change. Nothing moves because a page loaded or a section scrolled into view. The rule is the same on public pages and in workspaces. V1 has no authored entrance or brand animation, and adding one is a design-system change.

| Surface | Trigger | Animated properties | In | Out | With reduced motion |
|---|---|---|---|---|---|
| Button, link, input, option, nav item, row | hover, press release, focus, select | `color`, `background-color`, `border-color`, `text-decoration-color` | 150ms | 150ms | same |
| `BookingDraft` time line | a different time is chosen | text swap, `opacity` 0 to 1 | 150ms | none | same |
| Status badge, inline validation message, alert | appears or changes after a server response | `opacity`, `background-color`, `color` | 200ms | none | same |
| Disclosure | expand, collapse | `grid-template-rows`, content `opacity` | 200ms | 150ms | no height transition |
| Select list, dropdown menu | open, close | `opacity`, 4px `translate` from the trigger side | 150ms | 100ms | `opacity` only |
| Dialog | open, close | scrim and panel `opacity`, no zoom | 200ms | 150ms | same |
| Sheet: filters from the bottom edge, mobile navigation from the inline-end edge | open, close | `translate` from its edge, scrim `opacity` | 250ms | 200ms | `opacity` only, 150ms |
| Toast | appear, dismiss | `opacity`, 8px `translate` from its edge | 200ms | 150ms | `opacity` only |
| Skeleton | while its region loads | `opacity` pulse | loop | none | static block |
| Spinner inside a submitting button, 16px | while its request is pending | rotation | loop | none | hidden. The in-progress label carries the state |

- Color changes use the browser's `ease-out`. Overlays enter with `--ease-enter` and leave with `--ease-exit`. Route changes have no transition. 250ms is the longest transition in the product.
- **Never:** an entrance animation on load or route change; scroll-triggered animation or parallax; `transform` or shadow change on hover or press; overshoot, bounce, spring, or elastic easing; decorative loops (`animate-ping`, pulsing or glowing buttons, floating shapes, marquees, auto-advancing carousels, typewriter headlines); three-dot typing or "thinking" indicators, which would claim an AI feature Learli does not have; count-up numbers; confetti or any celebration on a booking result; `transition-all`; transitions on `width`, `height`, `top`, `left`, `margin`, or `padding`; a transition or animation delay; autoplaying video or audio; a motion library.
- **Two loops exist:** the skeleton pulse and the submitting-button spinner. A skeleton always resolves to content, an empty state, or an error with a "Try again" action.
- **Reduced motion** (`prefers-reduced-motion: reduce`) removes movement and keeps feedback. The last column above is the specification. Write movement behind `motion-safe:` so the reduced path is the base style. Do not add a global reset that forces every duration to near zero: it removes the color and opacity changes that report hover, selection, and status.

---

## Component Library

shadcn/ui on Tailwind CSS.

### Ownership and structure

- `src/components/ui/`: generated shadcn primitives, adjusted once per [Primitive overrides](#primitive-overrides). Preserve their accessibility behavior.
- `src/components/shared/`: cross-feature Learli compositions, such as `SiteHeader`, `SiteFooter`, `Panel`, `EmptyState`, `StatusBadge`, `LessonTime`, `ConfirmDialog`.
- `src/features/<feature>/`: feature-owned components, following `architecture.md` and `code-standards.md`. For example `TutorCard`, `TutorFinder`, `TutorFilterPanel` (which renders both the filter rail and the filter sheet), and `AvailabilityPicker` under `features/tutors/`; `BookingDraft`, `BookingSummary`, `BookingDetails`, and `NextLesson` under `features/bookings/`; `LearnerContext` under `features/learners/`.

Move a component to `shared/` only when a second feature uses it.

### Primitives: add only when needed

| Primitive | Where | Rule |
|---|---|---|
| Button, Link | Actions and navigation | Navigation uses `<a>` or Next.js `<Link>`. An in-page action uses `<button>`. Never swap them |
| Input, Label, Form, Textarea, RadioGroup, Checkbox | Account, matching, profiles, the availability picker | Persistent label above the control. Error text below the field |
| NativeSelect | Every select: `TutorFinder`, filters, `LearnerContext` with five or more learners, availability time ranges, the time zone select | A real `<select>` that works without JavaScript and opens the OS picker on a phone. The popup `Select` is used only where a native one cannot do the job |
| Badge, Separator, Alert | `StatusBadge`, rules between rows, status and error messages | One badge per record. No badge the data does not support |
| Table | Admin queues and lookups | Sortable headers. Below `lg` each row stacks and links to a detail page. No horizontal scroll |
| AlertDialog | Confirming an action that notifies another person or cannot be undone | Names the object and its consequence. Restores focus on close |
| DropdownMenu | The account menu | Holds account links, then "Contact support", "Report a concern", and "Sign out" |
| Sheet | Mobile filters and the public mobile navigation only | Focus trap, Escape to close, labelled |
| Skeleton, Sonner (toast) | Loading, acknowledgement | See [Loading](#loading) and [Navigation and surface conventions](#navigation-and-surface-conventions) |

`Calendar`, `Popover`, `Card`, and `Tabs` are not installed in V1. Compose existing primitives before adding a library. Do not add a second UI kit or an animation dependency.

### Primitive overrides

`[PROPOSED]` Generated primitives arrive with their own sizes, type, radius, focus, color, and motion, and several contradict this file. When a primitive is added to `src/components/ui/`, change it once, in the same commit, and never per screen.

This is a proposed scope for editing generated primitives. It is not the approval that `ai-workflow-rules.md` requires for protected files: a founder approves it (open design decision 14) before any file under `src/components/ui/` is edited.

Stock values depend on the shadcn base and preset, which is an open decision. Record the choice here when `components.json` is created. The stock column lists values seen in the `new-york-v4` style on 2026-10-11, with `nova` differences noted, as examples of what to look for. The Learli column does not change with the preset.

**M1 tooling note — 2026-10-11:** `components.json` now uses `new-york` as a provisional CLI setting for the local foundation. No generated primitives have been installed or edited; the shell uses native controls. This records configuration, not founder approval of decision 14 or the final design system.

| Primitive | Learli value | Stock values to replace |
|---|---|---|
| Button | `min-h-11` (44px), the `action` role, label may wrap, `transition-colors` at 150ms, `--brand-navy-hover` and `--brand-navy-active`, the disabled tokens, no transform | `h-9` (`h-8` in nova), `text-sm font-medium`, `whitespace-nowrap`, `transition-all`, `hover:bg-primary/90`, `disabled:opacity-50`, `active:translate-y-px` in nova |
| Button, outline variant | `border-control`, `bg-surface`, navy label, no shadow | `border` (resolves to `--border-default`, 1.22:1), `bg-background`, `shadow-xs` |
| Button, destructive variant | No alpha on hover | `hover:bg-destructive/90` |
| Input, Textarea, NativeSelect, Select trigger | `min-h-11`, the `body` role at every width, `bg-surface text-foreground`, `border-control`, no shadow. This is what keeps a control light inside a navy field | `h-9`, `text-base md:text-sm` or `text-sm`, `bg-transparent`, `shadow-xs`, its own `selection:` colors |
| Every focusable primitive | The global 2px `outline` with a 2px offset at full opacity. An invalid control takes `border-destructive` and its error text, no ring | `outline-none` with a 3px ring at 50% alpha (2.34:1 on white), `aria-invalid:ring-destructive/20` |
| Checkbox | `--radius-check`, `border-control`, no shadow | `rounded-[4px]`, `shadow-xs` |
| Badge | The `label` role, `--radius-tag`, a 1px border | `text-xs`, pill rounding |
| Label, table head | The `label` role | `leading-none`, `font-medium` |
| Dialog and sheet titles | The `item-title` role | `leading-none font-semibold`, `text-lg` |
| Dialog, AlertDialog | `bg-surface`, `shadow-modal`, `--radius-overlay`, fade only, 200ms in and 150ms out, over `bg-scrim` | `bg-background`, `shadow-lg`, `zoom-in-95`, `bg-black/50`. Nova: `bg-black/10` with `backdrop-blur-xs` |
| Sheet | The same, 250ms in with `--ease-enter` and 200ms out with `--ease-exit` | 500ms open, 300ms close |
| Dialog and sheet close control | A 44×44px hit area, `text-muted-foreground`, no opacity | A 16px icon with no padding, `opacity-70` |
| Select list, dropdown menu | Fade with a 4px slide, no zoom, `shadow-float`, `--radius-surface` | `zoom-in-95`, an 8px slide, `shadow-md` |
| Skeleton | `bg-border`, `motion-safe:animate-pulse` | `bg-accent animate-pulse`. Nova: `bg-muted` |
| Sonner | `theme="light"`, no `next-themes` import, `duration={6000}`, `visibleToasts={1}` | `useTheme()` from `next-themes`, `theme="system"`, 4000ms, three visible |
| All | The radius token for its nesting level. `dark:` utilities are left in place and never activated | Radius classes from the derived scale |

Checks. This command returns nothing, and computed `font-family` on `body`, a button, an input, and a dialog title starts with the generated Poppins family.

```bash
grep -rnE "leading-none|tracking-tight|text-(xs|sm)([^a-z]|$)|whitespace-nowrap|transition-all|opacity-(50|70)|[a-z]/[0-9][0-9]([^0-9]|$)|outline-(none|hidden)|ring-\[3px\]|(^|[^-a-z])h-(8|9|10)([^0-9]|$)|rounded-(xs|sm|md|lg|xl)([^a-z]|$)|shadow-(xs|sm|md|lg)([^a-z]|$)|bg-(transparent|black|background)|zoom-(in|out)-|duration-(300|500)|next-themes" src/components/ui
```

### Signature components

These carry the thesis. Build each once and reuse it everywhere. One of them is Learli's signature, and a screenshot must show it.

#### The signature: the time column

`[PROPOSED]` Every lesson time sits in a time column: a fixed-width, left-aligned column of times in the `time` role, headed once by the zone line. It is the only element in the product with its own type role, its own column, and its own header line.

| Surface | Time column |
|---|---|
| Tutor list on `/`, `/tutors`, and match results | The right-hand column from a 48rem container, 13rem wide: the label "Next open time", then the compact `LessonTime`. One zone line above the list |
| Availability picker | Each day is one column or group: the day heading, then that day's start times at one shared width. One zone line above the picker |
| Agenda | The leading column, 11rem from `md`: the time range. One zone line above the agenda |
| `NextLesson`, booking review, booking details | The full `LessonTime`. In `NextLesson` and booking details its date and time lines take `section-title` |

In a row, the time is the only weight-600 text besides the row's title and its action label.

#### Dates and times

**The Whole Time Rule.** A lesson time is never rendered without its date and its zone, and it is always produced by one shared component, `LessonTime`. No page formats or styles a date on its own. A numeric-only date and a raw IANA identifier are defects on every surface, including badges, list rows, and email.

`LessonTime` has three forms. No other rendering of a lesson time exists. The values are format examples, not real availability.

| Form | Renders | Used in |
|---|---|---|
| `full` | Three lines: `Saturday, October 17, 2026`, then `7:00 – 8:00 PM`, then `Philippine Standard Time (GMT+8)` | Booking review, booking details, `NextLesson`, the cancel dialog, email |
| `compact` | `Sat, Oct 17 · 7:00 PM` | Tutor row, the chosen-time line in `BookingDraft`, history lines |
| `time-only` | `7:00 PM` or `7:00 – 8:00 PM` | A time option under its day heading. An agenda row under its date heading |

`compact` and `time-only` are valid only where the zone is stated once for the list: the zone line `Times shown in Philippine Standard Time (GMT+8)`, followed by a "Change time zone" link, directly above the list or picker. `time-only` is valid only directly under a heading that states the weekday and date. Anywhere else a time without its date and zone is a defect.

1. UTC instants and IANA identifiers stay the stored values. An identifier such as `Asia/Manila` is never user-facing text.
2. Format with `Intl.DateTimeFormat`: the zone name from `timeZoneName: 'longGeneric'` and the offset from `timeZoneName: 'shortOffset'`, each read with `formatToParts`. Compute both for the lesson's start instant, not for today, so the offset is right across a daylight-saving change: `America/Los_Angeles` gives `Pacific Time (GMT-7)` on October 31, 2026 and `Pacific Time (GMT-8)` on November 2, 2026. Never compute or hard-code an offset.
3. Start and end come from the server: the open time before booking, the booking record after. Never derive the end from an assumed duration. Lesson duration is not yet approved. When both instants fall on one calendar date in the viewer's zone, the time line is `formatRange` with hour and minute. When the lesson crosses midnight in the viewer's zone, call `formatRange` once with weekday, month, day, year, hour, and minute, and let that string replace the date line and the time line. A time-only `formatRange` across midnight returns numeric dates and is a defect. Test both cases, plus a lesson inside the repeated hour at the end of daylight saving.
4. Weekday and month are always words. `compact` adds the year when it is not the current year, and puts "Today" or "Tomorrow" before the date when true while keeping the date.
5. One explicit display locale in V1, `en-US`. Each `LessonTime` string is formatted in exactly one runtime: on the server when the zone is known there, in the browser after mount otherwise. No component calls `Intl` during a render that runs on both sides of hydration, because Node and browsers carry different locale data and the same options can return different text. `LessonTime` replaces U+202F and U+2009 in the output with a normal space.
6. Zone source, in this order. Signed in: the time zone saved for that user. Signed in with none saved, or signed out: the browser's zone, detected on the client, unless the visitor has chosen one. Email and any other server-rendered message: the recipient's saved zone, else the zone the booking was displayed in when it was made (`architecture.md` §9). A parent or guardian sees their own zone, never the zone stored on a learner profile.
7. Until the zone is known, render a skeleton where times go. Never render server-zone or UTC times as if they were local. If the viewer's zone cannot be determined at all, show times in the tutor's zone and say so in the zone line.
8. "Change time zone" reveals the time zone select in place under the zone line, never in a dialog. The select is a native `<select>` ordered by offset, each option labelled by city and current offset (`Manila (GMT+8)`). The identifier is the option value only. Signed in, the choice is saved to the account. Signed out, it is kept for the visit and applied on every page that shows a time. Where it is stored is an architecture decision to record before build.
9. On the tutor profile and booking review, the tutor's local time is added as a fourth line in `--text-muted`, labelled "Tutor's time", when the tutor's zone differs from the viewer's. A learner's or guardian's zone is never shown to a tutor or on a public page.
10. Markup: each instant is a `<time datetime="...">` with the UTC ISO value. Date and time each sit in their own `white-space: nowrap` span. The zone name wraps between words, and only its offset, `(GMT+8)`, is a `nowrap` span. Nothing is truncated.
11. Type: date and time use the `time` role, or `section-title` in the two places named in the signature. The zone line is `small` in every form.

#### Availability picker

`AvailabilityPicker` shows a tutor's real open times inline on the tutor profile and on the reschedule page. It is never inside a popover, dialog, or sheet. Its heading is "Choose a time".

- **Structure:** the zone line, then one page of days starting at the first day that has an open time, with "Show earlier days" and "Show later days" buttons. When the picker's own container is at least 56rem wide, a page is seven days in seven equal columns, each headed by weekday and date, and a day with no open time shows "No times". Below that width a page is the next three days that have open times, as a vertical list of day headings, each followed by its times in a wrapping row. Use a container query, not a viewport breakpoint.
- **A time is a native radio input styled as an option.** All options share one `name`, so exactly one time is chosen across days and the browser's standard radio keyboard behavior applies. Each day is a `<fieldset>` whose `<legend>` is the weekday and date. Each option is at least 44×44px, 8px apart, and labelled with the start time, which is also its accessible name. The day comes from the legend and the zone from the zone line, which the picker references with `aria-describedby`.
- **States:** an available time is the option treatment from [Interaction states](#interaction-states). The chosen time is the selected treatment. A time that is taken while the user is viewing is replaced in place by the text "No longer available", and the rest of the list stays. Focus moves to the inline alert only when the change is the response to the user's own submit. When it arrives from a background refresh, focus does not move: the change is announced through the picker's `role="status"` line, and if the taken time was the chosen one the choice is cleared and the line says so. Times that were never bookable are not rendered.
- **Holds are `[GATED]`.** Whether a held time exists, and for how long, depends on the approved lifecycle (`prd.md` BKG-03). Until it is approved the picker draws no hold, no expiry state, and no timer.
- A tutor with no open times shows the matching [empty state](#empty-states), never an empty grid. When the server returns no availability data at all, the picker is replaced by the load-failure message.
- Only server-supplied availability is drawn. A chosen time is not a booking until the server confirms it.

#### Tutor card

`TutorCard` is one tutor as a row. One anatomy serves `/`, `/tutors`, and match results. The list is a `<ul>` inside one panel, one tutor per `<li>` at every width, rows divided by 1px rules. The panel keeps its inline padding and has no block padding: each row carries 16px block padding, and the 1px rules between rows span the content width. It is never a grid of separate cards.

1. Initials avatar (40px circle) and the display name as a heading in the `item-title` role.
2. Subjects in `body` and levels in `small` on the next line, as plain text separated by ` · `. Up to three subjects, then `+N more`. Not badges.
3. The introduction in `--text-muted`, clamped to two lines. The profile shows it in full.
4. The time column: the label "Next open time" in the `label` role above the compact `LessonTime`. "No open times right now" appears only when the server reports that the tutor has none. When the response carries no availability for a tutor (the availability service is not built yet, `build-plan.md` M3 before M4, or the lookup failed), this part is omitted. The tutor's own zone is not shown on the row.
5. "View profile" as an outline button whose accessible name includes the tutor's name. It is the row's only interactive element, so each row is one tab stop, and its hit area covers the whole row, so tapping the name opens the profile.

From a container width of 48rem the row is one line: identity and expertise on the left, the time column and action on the right. Below that the parts stack in the same order with the action last and full width. Use a container query, because the row appears beside the filter rail, in match results, and on the home page. A result set of one or two tutors renders one or two rows and nothing else. Ratings, review counts, prices, badges, lesson counts, response times, and online dots join the anatomy only under The Backed Claim Rule.

#### Booking surfaces

`[PROPOSED]` Booking happens on three surfaces. Use these names everywhere. Route names follow `prd.md` §6 and may be refined.

1. **Tutor profile** (`/tutors/[slug]`, public): the `AvailabilityPicker`, then a Subject radio group when the tutor offers more than one subject (preselected only from a `subject` filter or matching answer), then "Review booking". `BookingDraft` restates the choice: tutor name, chosen subject, the chosen time in the compact form, and "Review booking". From `lg` it is a sticky panel beside the picker. Below `lg` the action is one element and is never duplicated: before a choice it sits in flow directly after the picker, and once a time is chosen the same element becomes sticky at the bottom with the chosen-time line (see [Sticky elements](#sticky-elements)). "Review booking" stays enabled, and pressing it with no time chosen shows "Choose a time to continue" and moves focus to the picker. `BookingDraft` never renders `LearnerContext` or any learner data.
2. **Booking review** (signed-in page): `BookingSummary` with `LearnerContext`, and "Book lesson". A signed-out visitor signs in between surfaces 1 and 2. The sign-in and account-creation pages show the pending choice as read-only text above the form: the tutor's display name and the compact `LessonTime` with its zone. The return path carries the tutor, the start instant, and the subject, never learner data. On return the time is revalidated.
3. **Booking details** (signed-in page for one saved booking): an `h1` in `page-title` that states the status the server returned, with its status icon; one panel holding the full `LessonTime` and the Who and What groups; the meeting action; the status sentence; and history lines. The screen shown after "Book lesson" is this page, and focus moves to its `h1`. There is no separate confirmation screen. When the saved status is Confirmed the panel takes the success tone (`--state-success-soft` fill, 1px `--state-success` border): the one place a whole panel is teal. Any other status uses the neutral panel.

`BookingSummary` is one panel containing a definition list in labelled groups, so nothing has to be remembered from an earlier screen:

- **Who:** the learner (through `LearnerContext`) and the tutor.
- **What:** subject and duration. Duration comes from the server and is never assumed.
- **When:** the full `LessonTime`.
- **Terms (`[GATED]`):** once the cancellation and rescheduling policy is approved, its summary and a link to `/cancellations` sit directly above "Book lesson" (`architecture.md` §6.7). Until then the group is absent, with no placeholder.

`LearnerContext` says whose lesson this is.

- A guardian with one linked learner sees read-only text: "Booking for {learner display name} · {level}". No control.
- A guardian with two to four linked learners gets a radio group of display name and level. In the booking review nothing is preselected. Submitting without a choice shows "Choose who this lesson is for" and moves focus to the group. With five or more, a native select with the same labels and the same no-default rule.
- A learner whose level the tutor does not teach stays in the list as an unavailable option followed by "{Tutor display name} does not teach {level} {subject}."
- A guardian with no linked learner sees the heading "Add a learner to book this lesson" and the learner form in place of the Who group, with the tutor and the chosen time still visible above it. The learner form is `[GATED]` (see [Facts owned by other documents](#facts-owned-by-other-documents)).
- An independent college learner sees "Booking for you". No learner control and no guardian wording.
- After a choice, the learner's name is repeated in the confirm button ("Book lesson for {name}") and in booking details.
- It shows display name and level only. No age, school, date of birth, or photo.

**The Named Learner Rule.** Every parent screen that shows learner-scoped data names the learner in text: in the `h1` when one learner is selected, and on every booking row always. Selection is never carried only by color, an avatar, or position.

#### Empty states

`EmptyState` is rendered in place of the content it replaces: same column, same left edge, under the same section heading. It has a heading in the `item-title` role that states the fact, at most two sentences of body, at most one action button, and at most two secondary links. The button is the filled primary only when the screen has no other filled primary (the workspace first-use states). On every other screen it is an outline button. No illustration, no dashed box, no centered column, and no icon larger than 20px. A failed request is never shown as an empty state, and a pending request is never shown as a count of zero.

The wording below is proposed copy, not approved copy. The first entry under Actions is the button and the rest are links.

| Case | Surface | Heading | Body | Actions |
|---|---|---|---|---|
| Zero inventory: no approved tutor exists | `/`, `/tutors`, `/get-matched` before question 1 | No tutors are listed right now | Learli lists a tutor after reviewing their application. | Become a tutor, Contact support |
| Subject with no tutor | A subject link or filter | No tutors teach {subject} on Learli right now | none | Browse all tutors |
| Filtered out | `/tutors` | No tutors match these filters | The active filters, each removable | Clear filters |
| No matches | `/get-matched` results | No tutors match your answers | The level, subject, and times the visitor gave | Change answers, Browse all tutors, Contact support |
| Tutor has no open time | `/tutors/[slug]` | No open times right now | none | Browse all tutors |
| First use: no bookings | `/student`, `/parent` | No bookings yet | When you book a lesson, it appears here with its date, time, and status. | Find a tutor |
| First use: no learner | `/parent` | Add a learner to book a lesson | none | Add a learner |
| Tutor profile not public | `/tutor`, above everything else, as a neutral notice | Worded from the stored review state. Before submitting: "Your profile is not public yet." After submitting: "Learli is reviewing your application." | Your profile cannot be booked until it is public. | Edit profile, Contact support |
| First use: no availability | `/tutor` | Set your available times | Learners can book you only at times you add. | Set availability |
| Tutor has availability and no bookings | `/tutor` | No bookings yet | When a learner books one of your open times, the lesson appears here. | Change availability |
| Meeting link not added (wording depends on the open per-booking or reusable link decision) | Booking details | No meeting link yet | Learner or guardian view: Your tutor has not added a meeting link. | Learner or guardian: Contact support. Tutor: Add meeting link |
| No access or not found | Any booking, learner, or support case | We can't find that booking on this account | none. Identical for not found and not authorized | Go to your bookings, Contact support |

With zero inventory, or before the catalog exists (`build-plan.md` M1): `/tutors` hides its search field and filters; `/` does not render `TutorFinder`, its tutor list, or its subject index, and its navy field holds the `h1`, the `lead`, and this state with no filled action. No empty state states how long approval takes, and none uses "Coming soon", a launch date, a countdown, or an email capture field.

### Loading

- **First load of a region:** skeleton blocks with the outer dimensions of the real content, so nothing shifts when data arrives. No centered spinner, no full-page overlay. A skeleton never shows a numeral, and the tutor list always loads as three rows.
- **Refetch after a filter or learner change:** the previous results stay on screen with `aria-busy="true"`, the result line reads "Updating tutors" (or "Updating bookings") until the response arrives, and then the list is swapped. The list is not dimmed.
- **Mutations are pessimistic.** The button that started the request shows the spinner and changes its label to the same verb in progress ("Book lesson" becomes "Booking lesson…"). It reserves the width of its in-progress label from the start, so it does not resize. Nothing on screen shows the outcome until the server responds. No optimistic "Confirmed" and no success toast on click.
- Only the control that started the request is unavailable. It takes `aria-disabled="true"` and ignores further activation, without the `disabled` attribute, so it keeps focus until focus moves to the result. A retry after a failure or timeout resends the same idempotency key (`prd.md` BKG-01). The rest of the page stays usable.
- Never: a progress bar or percentage that real progress does not drive, rotating filler lines, or an artificial delay before matching results.

### Component state contract

Every interactive shared component implements default, hover, focus-visible, pressed, selected or current, disabled, loading, error, success, and empty, using only the values in [Interaction states](#interaction-states) and [Statuses](#statuses). A state that cannot occur for a component is recorded as not applicable in its test or story, not skipped. A state is not done until its words are written (see [State messages](#state-messages)).

---

## Layout Patterns

### Global rules

- **Build at 390px first.** 320px must render without clipping or horizontal scroll. Then enhance at `sm`, `md`, and `lg`.
- **One page shell:** `max-w-7xl` with gutters `px-4 sm:px-6 lg:px-8`. Inside it, width is set by content type:

| Content | Max width | Where |
|---|---|---|
| Running text | 34rem | How it works, policies, tutor introduction, help text |
| Single-column form | `max-w-md` for sign-in, account creation, and reset. `max-w-xl` for learner profile, tutor profile editing, matching questions, booking review | No input wider than 36rem |
| Agenda or list | `max-w-5xl` | Student, parent, and tutor workspaces |
| Table | The full shell | Admin queues and lookups |
| Two zones, from `lg`, 32px apart | `/tutors`: filter rail 16rem plus results. `/tutors/[slug]`: content plus `BookingDraft` at 22.5rem | One column below `lg` |

- Sign-in pages and matching questions are single centered columns. Everywhere else, content aligns to the shell's left edge.
- **No horizontal scroll** at 320px, on any page.
- **Structure adapts, type does not.** At narrow widths columns stack, the filter rail becomes a sheet, and the admin rail becomes a menu.
- **Skip link.** The first focusable element on every page is "Skip to main content".
- **Forms work without JavaScript** as plain GET or POST: `TutorFinder`, the directory filters, the learner control. Client-side enhancement may update results without a full page load.
- **Page titles** are "{Page} | Learli". A `<title>` never contains a learner's name and never repeats a learner-specific `h1`.

### Spacing roles

The scale is 4, 8, 12, 16, 24, 32, 48, 64, 96px (Tailwind `1, 2, 3, 4, 6, 8, 12, 16, 24`). No other values and no arbitrary spacing in `src/`. Use the role, not a favorite number.

| Role | Value | Learli example |
|---|---|---|
| Inside a unit | 4px icon to label. 8px label to control, name to subject line | A form field, the identity part of a tutor row |
| Heading to its content | 16px, or 8px under an `item-title` | A section heading and its list |
| Between sibling units | 16px | Between form fields. Vertical padding of a tutor row or booking row |
| Between groups | 32px | One date group of an agenda to the next. The picker to the booking action |
| Between workspace sections | 48px | "Upcoming" to "Past" |
| Between sections of a Persuade page | 64px below `md`, 96px from `md` | The jobs of the home page |
| Page top and bottom padding | 32px below `md`, 48px from `md` | Every page shell |
| Panel padding | 16px below `md`, 24px from `md`, the same on all four sides. A list panel keeps the inline padding only, and its rows carry 16px block padding | `BookingSummary` |

- **Headings bind downward.** The space above a heading is at least twice the space below it.
- Group by proximity first. Add a rule or a panel only when the group is an object a person acts on.
- Check: in any full-page screenshot three distinct intervals are identifiable (8px or less, 16px, 32px or more). A page whose vertical stack uses one value at every level fails. Read computed values in dev tools, not class names.

### Sticky elements

- At most one sticky element on the top edge and one on the bottom edge of any page. The site header and the workspace bar are not sticky.
- **Tutor profile:** from `lg`, `BookingDraft` is `position: sticky; top: 24px`, unless it is taller than the viewport. Below `lg`, once a time is chosen, the action element is `position: sticky; bottom: 0` directly after the picker, never `position: fixed`, with the chosen-time line and one action at least 44px tall.
- **Safe areas:** a bottom bar's padding is `max(12px, env(safe-area-inset-bottom))`. Full-height overlays use `100dvh` and pad their footer actions the same way.
- **No sticky bar on a screen that contains a text field.** The submit button sits in normal flow after the last field, so the on-screen keyboard cannot cover it.
- Set `scroll-padding-top` and `scroll-padding-bottom` to the height of whatever is sticky, so a focused control is never hidden under it (WCAG 2.2 SC 2.4.11).
- Sticky elements become static when the viewport is shorter than 480px, which covers landscape phones and 200% zoom.

### Public marketing site

**Header.** `learli` artwork on the left as the home link. Four text links: "Find a tutor", "Get matched", "Subjects", "Become a tutor". "Sign in" as a text link on the right. No filled button. When signed in, "Sign in" becomes a link to the user's workspace, and an account with more than one role (`prd.md` AUTH-03) gets a menu there with one link per workspace the server returns. Below `lg`: the artwork, "Sign in", and an outline button with a `Menu` icon and the visible label "Menu" that opens the links in a sheet. `--bg-surface`, 64px tall from `lg` and 56px below, a 1px `--border-default` bottom edge, not sticky.

**Home (`/`).** `[PROPOSED]` The home page has four jobs in this order.

1. **Start finding a tutor (the navy field).** In DOM order, and nothing else:
   - One `h1` in the `display` role, left-aligned, with nothing above it. See the [headline contract](#headline-contract).
   - One `lead` paragraph of at most two sentences.
   - `TutorFinder`: a `<form role="search" action="/tutors" method="get">` with a labelled Subject select (active catalog subjects under the catalog's category labels as `<optgroup>`, with "Any subject" first), a labelled Level select (the four launch levels, with "Any level" first), and the submit "Find a tutor", the page's one primary action and the field's one teal element. An empty submit opens the unfiltered `/tutors`. The three controls share one height and `--radius-control`. From `md` they sit on one line. Below `md` they stack full width.
   - One sentence with a link: "Not sure where to start? Get matched by answering three questions." Both entry points are required by `prd.md` PUB-01.
   - The field is full-bleed and as tall as its content, with 64px block padding below `md` and 96px from `md`. It has no minimum height, its bottom edge is square, and at 1440×900 the top of the first tutor row is visible under it.
   - Not in the field: an illustration, photo, device mockup, decorative shape, badge row, logo strip, statistic, rating, testimonial, second button, or a highlighted word in the `h1`. Not centered, and not a split layout with copy on one side and a picture on the other.
2. **Show the real thing.** Under the heading "Tutors on Learli" and the zone line, up to three `TutorCard` rows from the same query, eligibility rules, and default order as `/tutors`, then a "Browse all tutors" link only when more exist. Never placeholder rows. Never "Featured", "Top", "Popular", or "Recommended" unless a documented selection rule backs the word.
3. **Show what is covered.** A subject and level index under one heading. The catalog's categories, exactly as stored, are sub-headings in `item-title`. Under each, one row per subject, at least 44px tall: the subject name as a link to `/tutors?subject=...`, then the levels that subject is covered at as links. A level link appears only when at least one approved tutor covers it. This hides a link in the index and nothing else: College Support stays in the Level select, the matching level question, and the `lead` whether or not a tutor covers it today. A specialized subject with no tutor is not listed. No icon, box, or description sentence per subject.
4. **Explain the handoff.** "How booking works" as one `<ol>` of three sentences: find a tutor and choose one of their open times; a parent or guardian books for a learner, or a college learner books for themselves; the lesson happens on the tutor's Zoom or Google Meet link. Then two text columns from `md` (stacked below): what Learli handles (finding a tutor, booking, support, safety reports) and what the tutor handles (teaching, materials, hosting the lesson on Zoom or Google Meet). No shield or check icons, no badges, no numbers. Final sentences are founder-reviewed.

When a catalog or tutor query fails, job 2 shows the load-failure message with "Try again", job 3 is omitted, and no sample subject or tutor is rendered. With zero inventory, see [Empty states](#empty-states).

**Footer.** The second navy field, on every public page. One link list: how it works, subjects, "Contact support", "Report a concern", and approved policies. Publish policy copy only after review.

Checks for `/`, beyond the first-viewport contract: no section is three or more same-size boxes, and keyboard order equals visual order.

If the founders do not approve navy as a ground, these change together and nothing else does: (1) the first viewport of `/` sits on `--bg-base` with `--text-primary` text and the navy primary button; (2) the footer takes the header treatment, with a 1px top edge and `--brand-navy` links; (3) the `[data-surface="inverse"]` rules, the navy-field tokens, and teal's first job are removed, so `--accent-primary` appears only inside the approved artwork.

### Tutor directory (`/tutors`)

- The `h1` is "Find a tutor". **From `lg`:** the search field above, a filter rail 16rem wide, and the tutor list in the remaining width. The rail sits on `--bg-base` with no fill and no border. **Below `lg`:** the search field and a "Filters" button that opens the same form in a bottom sheet.
- **Filters** are one GET form with "Apply filters" and "Clear filters" at every width: a Subject select and a Level select (the same controls and query parameters as `TutorFinder`) and a Days checkbox group of the seven weekdays. A further filter appears only when its data exists. In the sheet, "Apply filters" closes the sheet and moves focus to the result line. Search and filter forms are exempt from the `(optional)` marker: an empty control means any.
- **Search** applies on Enter or the search button, not on each keystroke. Label the field for what the search actually matches.
- **Result line:** applied filters are listed above the list as removable items beside the count from the server response ("1 tutor", "12 tutors"). The count renders only after the query resolves. Never "0 tutors", and never a rounded or padded count. The line has `role="status"` and updates once per completed request.
- **Default order** `[PROPOSED]`: soonest next open time first, then display name A to Z. Tutors with no open time come last.
- **Results** are the [tutor card](#tutor-card) list under the zone line. Empty cases follow [Empty states](#empty-states).

### Tutor profile (`/tutors/[slug]`)

- The tutor's name is the `h1`, with a 64px initials avatar, subjects, levels (college topics only when genuinely offered), and languages when the tutor profile stores them.
- The picker's heading and zone line are in the first viewport at 390px and 1440px. From `lg` the picker sits above the introduction in the content column. Below `lg` the introduction comes first, clamped to four lines with a "Read full introduction" disclosure button, then the picker.
- A badge or claim appears only under The Backed Claim Rule.
- Never show a tutor's phone, email, or a participant-only meeting link on a public page.

### Guided matching (`/get-matched`)

- The `h1` is "Get matched". A short rule-based questionnaire, not a chat. Three questions on one route, each with a named control:
  1. **Level:** one radio group of the four levels.
  2. **Subject:** one radio group under the catalog's category labels, exactly as stored. A specialized subject appears only when an approved tutor offers it at the chosen level.
  3. **When:** a checkbox group of the seven weekdays and a radio group of time-of-day ranges in the viewer's zone, under the zone line, using only ranges the matching rules consume. "Any time" is one explicit option, not the result of leaving everything blank.
- Progress is text: "Question 2 of 3". No percentage and no animated bar. "Continue" on questions 1 and 2, "Show matching tutors" on question 3, "Back" on questions 2 and 3, and a "Browse all tutors" link on every question.
- Answers live in the URL query string, so Back, refresh, and returning after an interruption restore them. No value read from a learner profile goes in the URL.
- No fourth "preferences" question until a preference exists that the matching rules use. No question asks for a learner's name, age, school, or contact details. Ask for sign-in only when a protected booking step needs it.
- **Results state the rule that produced them.** Above the list: "{n} tutors teach {subject} at {level}". The sentence names only the criteria the matching service applied as filters. A criterion used only to order results, such as time fit, goes in each row's reason line in `--text-muted`. No match percentage, no "Best match" ribbon, no rank number. Show one or two results when only one or two fit (`prd.md` MATCH-01).

### Booking and availability

- The three [booking surfaces](#booking-surfaces) are the whole flow. Before submitting, the booking review shows who, what, and when together.
- A typed name is never a learner selection. "Booking confirmed" appears only when the saved status is Confirmed, and a chosen time is never shown as booked.
- If the time is gone, show the message in [State messages](#state-messages), keep the tutor, subject, and learner, reload current times, and move focus to the picker.
- Labels follow the approved lifecycle. Do not invent payment windows, trial entitlements, rescheduling cut-offs, or cancellation fees. While the reschedule and cancellation policies are undecided, booking details show no self-serve button. They show one sentence with a link: "To change or cancel this lesson, contact support."
- The meeting action names the provider from the validated link host: "Join on Zoom" or "Join on Google Meet", with the `Video` icon. It opens in a new tab and its accessible name says so. The link never appears in public HTML, metadata, analytics, or a notification to anyone else.
- Booking details reserve one region directly under the meeting action for the approved meeting-safety guidance (`prd.md` MEET-03), and show "Report a concern" under the booking it concerns. The guidance region is absent until that text is approved, and no builder writes it.
- Learli shows no built-in classroom and does not claim to know who attended.

### Account and role workspaces

Each workspace opens on the next lesson, then an agenda of bookings. Destination labels are proposed and derive from `prd.md` §6.

| Role | Navigation | First thing on the page | Below it |
|---|---|---|---|
| Student or independent learner | Top bar: "Bookings", "Find a tutor", account menu | `h1` "Your bookings", then `NextLesson` | Upcoming agenda, link to past bookings |
| Parent or guardian | Top bar: "Bookings", "Learners", "Find a tutor", account menu | `h1` "Bookings", then the learner control, then `NextLesson` | Upcoming agenda, link to past bookings, "Add a learner" |
| Tutor | Top bar: "Bookings", "Availability", "Profile", account menu | `h1` "Your bookings", then `NextLesson` | Upcoming agenda, missing required profile items as a list of links |
| Admin or support | Left rail 15rem on `--bg-subtle` from `lg`, one entry per work area: tutor review queue, support and safety queue, subjects, booking lookup, account lookup. A top bar with a "Menu" button below `lg` | The selected queue as a table with its filters directly above it, or the lookup's search form | A row opens a detail page |

- No sidebar for student, parent, or tutor. The workspace bar uses the public header treatment, and its destinations stay visible at every width: only the account menu collapses. The current destination is marked as in [Interaction states](#interaction-states).
- **Every workspace page, admin included, ends with one footer line** on `--bg-base`: "Contact support", then "Report a concern", as links in the `small` role. The same two links are the last items of the account menu.
- **Parent workspace with two or more linked learners:** `LearnerContext` is a radio group whose first option, "All learners", is selected on arrival. `NextLesson` is then the soonest lesson across them, and the agenda lists every linked learner's bookings. Choosing one learner narrows the page and changes the `h1` to "Bookings for {learner display name}". With one linked learner the `h1` is "Bookings for {learner display name}" and there is no control. With none, the first-use state follows the `h1`.
- **`NextLesson`** is one panel at the top of the student, parent, and tutor workspaces: the full `LessonTime` with its date and time lines in `section-title`, one line naming the subject and the other party, the duration, a `StatusBadge`, and the meeting action. A parent's block names the learner. Its states:
  - No upcoming booking: the first-use empty state.
  - A non-final status: the status sentence follows the badge (see [Status labels](#status-labels)).
  - Booked, link not yet available under the approved access rule: the block says so in a sentence. No disabled button without an explanation beside it.
  - Link available: "Join on Zoom" or "Join on Google Meet", the page's primary action.
  - Tutor view with no meeting link on an upcoming booking: the action is "Add meeting link", with a warning-tone message.
- **Agenda:** the bookings after the one in `NextLesson`, as rows grouped under date headings, not one card per booking. One zone line above the agenda. Every row starts with a fixed-width time column (11rem from `md`) holding the time range only, so times align down the page across every date group. Then the other party and subject, and on a parent's row "for {learner display name}". Then the `StatusBadge` and the row action, the link "View booking", right-aligned from `md` and wrapped under the text below `md`. Row minimum height 64px, 16px vertical padding, a 1px rule between rows. Every action is visible at rest.
- **Tutor weekly availability** is seven day rows, each listing its time ranges in the tutor's local time, under a line stating which zone is being edited. A time range is two native selects labelled "Start time" and "End time", with "Add time range" under each day and a remove control on each range, and one "Save availability" button after the last row. It works by click, tap, and keyboard. Dragging to paint a range is never the only way (WCAG 2.2 SC 2.5.7). Removing or shortening a window that contains a booked lesson never cancels or moves that lesson (`prd.md` TUT-04): the editor says so in one sentence beside the control, lists the affected lessons, and links to support. Time off (`prd.md` TUT-05) is not designed in this file. Do not improvise it inside the weekly editor.
- **Admin table:** 44px rows in the `small` role, sortable column headers. Controls inside the table may be 36px tall from `lg`. A learner's name and level are not table columns.
- A count appears only as plain text inside a heading. Tutor profile completeness is the list of missing required items as links, and it disappears when nothing is missing.

### Navigation and surface conventions

- **Dialogs:** `AlertDialog` only where the task needs interruption or protected focus: cancelling a lesson, an admin action that changes a tutor's or an account's standing, and any other destructive confirmation. Width `max-w-md`. The object restated, then one sentence stating the true consequence, one confirming button, one dismissing button. No scrolling body, no form with more than one field, no dialog opened from a dialog. Everything else is a page or an inline region. A recoverable action (removing an availability window that has no bookings in it, clearing filters) needs no confirmation.
- **Toasts:** only for a completed, low-stakes action. `role="status"`, visible at least 6 seconds, paused on hover and focus, dismissible by keyboard, one at a time. Never used for the result of a booking, a cancellation, or a reschedule, for an error, for policy text, or for anything containing a meeting link.
- **Support and reports:** "Contact support" and "Report a concern" each open a page with a form, in Operate mode, reachable signed out (`prd.md` §6 and OPS-05). Neither is a dialog, a chat widget, or a bare email link. Neither states a response time until an operating plan sets one.
- **Forms:** label above the control as a noun in sentence case. A placeholder shows an example value only and is never the label. Mark optional fields with `(optional)` after the label and state once at the top: "All fields are required unless marked optional." Ask only what the current step needs. A field the approved flow does not need is removed, not shown as optional. Keep what the user entered after any error.

---

## Icons

Lucide React is the proposed icon set, matching shadcn/ui.

- **An icon needs a job.** An icon appears only inside a control, beside its visible label or alone with an `aria-label`, or inside a status badge or alert beside the status text. No icon stands above a heading, marks a subject or a booking step, sits beside a date or time, or sits inside a tinted square or circle.
- **Icon-only controls** are limited to three: closing a dialog or sheet, removing an applied filter, and removing a time range in the availability editor. Each has an `aria-label` that names its object ("Remove filter: Math"). Book, cancel, join, report, sign in, and sign out always carry visible text.
- **Sizes:** 16px (`size-4`) inline and in badges. 20px (`size-5`) in buttons, navigation, alerts, and icon-only buttons inside a 44×44 hit area. No icon larger than 20px anywhere.
- **Stroke:** one stroke width everywhere, the library default. No per-icon `strokeWidth`.
- **Allowlist** `[PROPOSED]`, names to be verified against the installed `lucide-react`. Controls: `Search` (search submit), `SlidersHorizontal` ("Filters"), `Menu` (the menu button), `X` (close, remove a filter, remove a time range), `Plus` ("Add time range"), `ArrowUp` and `ArrowDown` (the sorted column), `Video` (the meeting action), `Check` (a selected option), `LoaderCircle` (the button spinner). Statuses: the icons in the [Statuses](#statuses) table. Icons that ship inside generated primitives keep their glyph. Adding any other icon means adding it here with its control or status.
- **Not used in V1:** `BookOpen`, `GraduationCap`, `Users`, or `UserRound` as subject, level, section, or feature decoration; `ShieldCheck` anywhere until a recorded verification process exists; `ArrowRight` appended to a button or link label.
- `aria-hidden="true"` when adjacent text names the action.
- The Learli app icon (rounded navy square, white lowercase-`l` gesture, teal dot, smaller white dot) is brand artwork. Use the approved asset. Do not rebuild it from Lucide icons.

---

## Responsive and Accessibility Requirements

Target: WCAG 2.2 AA for the public, sign-in, matching, booking, and workspace journeys.

| Viewport or condition | Check |
|---|---|
| 320px | No horizontal scroll or clipping. Search, forms, tutor rows, and the booking review work, including with the account zone set to `Australia/Brisbane` |
| 390px | Mobile navigation, filter sheet, readable lesson times, target sizes |
| 768px | Directory and booking review without overlap |
| 1024px | Admin rail and table. The picker on a tutor profile is the vertical list, and no option clips with `10:30 AM` chosen |
| 1440px | The longest line of any paragraph on the tutor profile, how it works, and a policy page is at most 75 characters |
| 200% zoom | A 1280×800 window at 200% on `/tutors`, a tutor profile, and the booking review: no horizontal scroll, no clipped label, every action reachable |
| Keyboard only | Skip link, logical tab order, visible focus, Escape closes overlays, no trap |
| Screen reader | Labels, tutor rows as list items with headings, dates and times with zones, statuses, errors |
| Reduced motion | The filter sheet fades without sliding. Choosing a time still changes its style. Skeletons do not pulse |
| Forced colors | `/tutors`, the picker with a time chosen, a booking review, and a form with two errors: every control boundary, the chosen time, the focus ring, and each status are identifiable |

- **Target size.** No pointer target is smaller than 24×24 CSS px anywhere (WCAG 2.2 SC 2.5.8). In public, learner, guardian, and tutor journeys every button, input, select, time option, menu item, sheet close control, and checkbox or radio hit area is at least 44px tall and 44px wide at every breakpoint. Use `min-height`, not a fixed height, so a wrapped or zoomed label grows the control. Adjacent targets are at least 8px apart. A link inside a sentence is exempt. Never fix iOS focus zoom with `maximum-scale=1` or `user-scalable=no`.
- **Visible focus.** One global rule draws the focus indicator as an `outline` (see the theme block), never a box-shadow ring, so it survives forced colors. The 2px offset keeps the ring off navy and red fills. A scroll container or clipped parent with focusable children has at least 4px of padding so the ring is never cut off.
- **Forced colors.** Every filled control keeps a border (a primary button carries a 1px transparent border). Chosen, unavailable, and error states are identified by an icon and a word, never by fill alone. Icons use `currentColor`.
- **Overlays.** Focus moves into an open dialog or sheet, stays inside while it is open, and returns to the trigger on close. An overlay is operable from its first frame.
- **Status messaging.** One visible result line with `role="status"`, updated once per completed request. On submit, focus moves to the first invalid field, each message is linked with `aria-describedby`, and a form with three or more errors also renders a summary with `role="alert"`. An operation error is an inline alert with `role="alert"` directly above the control the user must use next.
- **Long content.** Build and review every shared component with synthetic data that is never shown in production: a 60-character tutor name, `Zoë Müller-Castañeda`, a one-character name, a tutor with twelve subjects, a 600-character introduction, the zones `America/Argentina/Buenos_Aires` and `Australia/Brisbane`, a lesson from 11:30 AM to 12:30 PM, a lesson that crosses midnight, button labels 40% longer than the English string, and two learners whose names share their first twelve characters. No fixed width or height on a text container. Layout uses logical properties (`ps-*`, `pe-*`, `text-start`).
- **Consistent help** (SC 3.2.6). "Contact support" and "Report a concern" appear in the same position and order on every page: the site footer on public pages and the workspace footer line on signed-in pages.
- **Redundant entry** (SC 3.3.7). A level or subject already chosen in matching or the directory filters is carried into the booking flow, and signing in mid-booking returns to the same tutor and time.
- **Accessible authentication** (SC 3.3.8). Sign-in, account creation, and reset fields accept paste and password managers.
- **Scrollbars** stay native. `color-scheme: light` already keeps them light.

---

## Product Copy, Content, and Trust

**The Backed Claim Rule.** A screen renders a claim only when a stored record backs it and the publishing policy for that kind of claim is approved. This covers ratings, review counts, lesson counts, prices, `Verified` or any credential badge, trial offers, availability or response-time promises, and any number describing Learli's size. Without a backing record the element is absent: not zero-filled, not grayed out, not replaced by a sample. One exception, from `prd.md` §10 and only after review publication is approved: a tutor with no published review shows the words "No reviews yet" where reviews would be. Test: for every badge, numeral, star, and price in a screenshot, name the stored field it came from. If there is none, remove the element.

- Never claim "AI-powered matching", "guaranteed grades", "certified tutors", "all tutors verified", "24/7 support", "free trial", or "best tutors worldwide".
- Where copy or a legal promise is undecided, ship the navigation structure or mark the section blocked in development. Never publish invented policy text.
- **`/become-a-tutor`** states only what a tutor can do in the shipped product: create a profile, list subjects and levels, set weekly available times in their own time zone, receive bookings, and teach on their own Zoom or Google Meet account. It says applications are reviewed before a profile becomes public. Not allowed until the commercial model is approved: earnings, rates, payouts, commission, tutor or learner counts, or how long approval takes. Its primary action is "Start tutor application".

**Tagline.** "Learning made personal." is an initial direction, not approved marketing copy. It is not rendered anywhere in the product until the founders approve it. Once approved it may appear in one place per page, the footer, as one line of body text beside the wordmark. It is never an `h1` or `h2`, a line above a heading, a button or link label, a page title, a meta description, or an email subject.

### Headline contract

- The home `h1` is one sentence, sentence case, twelve words or fewer. It contains the word "tutor" and a verb the visitor can do on Learli today ("find", "book").
- The `lead` states the launch levels and that lessons happen on Zoom or Google Meet.
- No rotating or typewriter words, no question ("Ready to get started?"), and no number that is not read from the database.
- Swap test: read the `h1` and `lead` with "Learli" replaced by a language app or an LMS. If they still read as true, rewrite them.
- Proposed copy, pending founder approval. `h1`: "Find a tutor and book a 1:1 online lesson". `lead`: "For Elementary, Middle School, High School, and College Support learners. Lessons happen on Zoom or Google Meet with your tutor."
- Section headings name their content in six words or fewer ("Tutors on Learli", "Subjects", "How booking works"). No slogan as a section heading and no closing call-to-action band.

### UI copy rules

Plain, specific, second person. The same voice for a parent, a college learner, and a tutor. State the next step. Do not praise. These rules apply to every string Learli writes: pages, components, page titles and metadata, and transactional email. Text a tutor writes (display name, introduction) is rendered as written, escaped, and never edited to fit them. Approved legal text follows its reviewer.

1. No exclamation marks, no emoji, and no em dashes.
2. No list of three adjectives or three abstract nouns ("Simple, flexible, personal"). A list of real steps or catalog items is fine.
3. Not used: seamless, effortless, unlock, elevate, empower, supercharge, transform, revolutionize, journey, world-class, amazing, magic, perfect tutor, perfect match, expert tutors, top tutors.
4. No praise or cheerleading aimed at the user ("Great choice", "You're all set", "Happy learning") and no filler openers ("Oops", "Uh oh").
5. "We" means Learli only. Tutors are "tutors on Learli", never "our tutors": tutors teach independently and Learli is the intermediary.
6. Body strings in product UI are two sentences or fewer. Say each fact once. If the heading states it, the body adds something new or is removed.
7. Do not lift this file's own descriptive words into UI strings. They describe intent. They are not copy.

| Not this | This (proposed, not approved marketing copy) |
|---|---|
| Our expert tutors are here for you 24/7 | Tutors on Learli set their own available times. |
| Smart matching finds your perfect tutor | Tell us the level, subject, and times you need. We'll show any tutors who match. |
| You're all set! Get ready for an amazing session. | Booking confirmed, then the saved date, time, and zone |

### Terms

One word per concept in every string Learli writes. Internal names (`slot`, enum values, IANA identifiers) never reach the screen. The terms follow `prd.md` usage.

| Concept | UI term | Used like this | Never in UI strings |
|---|---|---|---|
| The 1:1 meeting between a learner and a tutor | lesson | Book lesson, Next lesson, Cancel lesson | session, class, appointment, call |
| The saved record of a lesson, with a status | booking | Bookings, Booking details, Booking confirmed | reservation, order |
| The person who takes the lesson, any age | learner, then the learner's display name once known | Add a learner, Bookings for {name} | student, child, kid, pupil |
| The adult who books for a minor learner | parent or guardian. "You" once signed in | Account-type label "Parent or guardian" | parent/guardian with a slash |
| The person who teaches | tutor | Tutors on Learli, View profile | teacher, instructor, coach, mentor |
| A bookable start time | time | Choose a time, Open times | slot, opening |
| A tutor's own weekly hours, tutor workspace only | availability | Set availability, Save availability | open slots |
| The Zoom or Google Meet URL | meeting link | Join on Zoom, Join on Google Meet, Add meeting link | classroom, room, bare "Join" |
| Guided matching and its results | Get matched. Tutors who match your answers | 3 tutors match your answers | recommended, AI, smart, perfect match, top picks |
| Catalog names | subject and level, exactly as stored | Math, College Support | grade, K-12, course, program |
| Account actions | Sign in, Create account, Sign out | | Log in, Register, Sign up, Join |
| Help | Contact support, Report a concern | | Help center, live chat, bare "Report" |
| Spelling | Cancelled, time zone | | Canceled, timezone |

"Student" may appear once, as the account-type label for a learner who manages their own account (the PRD role `student`). "Child" may appear only inside approved consent or safeguarding text addressed to a parent or guardian. Other project documents write "Find a Tutor" and "Get Matched" as feature names. The rendered string is always the sentence-case form.

### Labels

A button names its action and its object, verb first. A bare verb is allowed only where the object is the whole screen: "Sign in", "Sign out", "Try again", and "Back" and "Continue" inside the matching questions. "Filters" and "Menu" are allowed as the names of the sheets they open.

| Surface | Label | Not |
|---|---|---|
| Tutor row | View profile | Learn more, Details |
| Tutor profile, after the "Choose a time" picker | Review booking | Book, Book now, Continue |
| Booking review | Book lesson. A guardian sees "Book lesson for {name}" | Submit, Confirm, Continue |
| Booking details | Join on Zoom, Join on Google Meet | Join, Join meeting, Launch |
| Booking details, once the policies are approved | Reschedule lesson, Cancel lesson | Reschedule, Cancel |
| Agenda row | View booking | Details, Open |
| Filters | Apply filters, Clear filters | Apply, Reset, OK |
| Matching, last question | Show matching tutors | Submit, Finish, Find my tutor |
| Parent workspace | Add a learner | Add, + New |
| Tutor workspace | Set availability, Save availability, Add time range, Add meeting link | Save, Update |
| Support | Contact support, Report a concern | Help, Report |

Links to `/tutors` use two labels: "Find a tutor" in navigation and first-use states, and "Browse all tutors" in every empty state, error, and matching step. Never used as a label anywhere: Get started, Learn more, Explore, Start now, Join now, Book now, Submit, OK, Yes, No, Confirm.

**Destructive confirmations.** The dialog title names the object: "Cancel this lesson?". The body restates tutor, learner, and the full `LessonTime`, then states only the consequences an approved policy defines. No mention of refunds, fees, credits, or cut-offs until those rules are approved. The buttons repeat the action: "Cancel lesson" in the destructive style and "Keep lesson". Never a dismiss button labelled "Cancel" inside a cancel-lesson dialog.

### State messages

- **Loading:** a visually hidden status names the content ("Loading tutors", "Loading your bookings", "Loading open times"). Never the bare word "Loading".
- **Success:** routine success is a toast of object plus past participle, four words or fewer: "Availability saved", "Meeting link added", "Profile saved". Never "Success" or "successfully". The result of a booking, a cancellation, or a reschedule is never a toast: it is the `h1` of booking details, for example "Lesson cancelled". Do not say an email was sent unless the send result is known.
- **Errors** have three parts in this order: what failed, in the user's words; why, only when the server knows the cause and it is safe to say; and the way forward, as a button or link beside the message. If the cause is unknown, leave the second part out.
- Field validation is an instruction with an object: "Enter your email address", "Choose a level", "Enter a Zoom or Google Meet link that starts with https://". Not "Invalid input" and not "This field is required".
- Never rendered: "Something went wrong" on its own, "Error", an HTTP status, an error code, an internal error name, or a stack trace.
- **Privacy overrides "say why".** Not found and not authorized use one identical message. Sign-in: "That email and password don't match." Password reset: "If an account uses that email, we sent a reset link." A suspended or ineligible account: name the blocked action and link to support, without stating the reason.

| Outcome | Message | Way forward |
|---|---|---|
| The chosen time was taken | That time is no longer available. Please choose another. | Reload current times and move focus to the picker |
| The tutor is not eligible | This tutor isn't taking bookings right now. | Browse all tutors |
| Not authorized, or not found | We can't find that booking on this account. | Go to your bookings |
| Device offline | You're offline. Reconnect, then try again. | Try again |
| A read failed or timed out | We couldn't load tutors. Try again, or contact support if this keeps happening. | Try again, Contact support |
| Booking failed and the server confirms nothing was saved | Your lesson wasn't booked. Try again, or contact support if this keeps happening. | Try again, Contact support |
| Booking request timed out and the outcome is unknown | We couldn't confirm your booking. Check your bookings before you try again. | Go to your bookings |

### Status labels

- One label per lifecycle state, sentence case, never the enum name and never a synonym. Until the lifecycle is approved, use Pending, Confirmed, Completed, Cancelled, and Expired.
- "Completed" is an administrative status. Never word it as attendance ("Attended", "Lesson took place"). Learli does not detect attendance.
- A non-final status never appears alone in `NextLesson`, the booking review, or booking details. It is followed by one status sentence that says what happens next and who acts. Do not ship a non-final status to production without its sentence, and do not write one that states a payment window, hold duration, or cut-off that has not been approved.
- "Rescheduled" is not a state in `prd.md` §8.1. Show a moved booking with its current status plus one history line in the compact form: "Moved from Sat, Oct 17 · 7:00 PM". If the approved lifecycle adds a rescheduled state, replace this rule.

---

## Assets and Imagery

A page may contain four kinds of graphic and no others: approved brand artwork, a Lucide icon in its control or status, an initials avatar, and an approved rights-cleared image.

- Approved brand artwork and static assets live under `public/brand/`. Use Next.js image optimization for raster assets.
- No approved `learli` wordmark or app-icon file is in the repository yet, and the current raster logo and mockup files are references, not production vectors. This blocks the header, the footer, and the favicon. Ask for the files. Do not type, recolor, or redraw the wordmark. Until the files exist, development builds render the home link as the plain word "Learli" in the `item-title` role, marked in code as a placeholder, and nothing ships to the public with it. The navy footer also needs a reversed (white) wordmark.
- V1 needs no photograph and no illustration. Until rights-cleared imagery exists, the home page ships without any: the working search, real tutor rows, and the subject index are the content. Do not fill the gap with stock illustration, abstract shapes, generated images of people, or a competitor's layout or screenshot.
- If imagery is added later, obtain rights and consent first, especially for identifiable children, and record the design decision. It does not replace the tutor finder or the tutor list.
- Tutor portrait uploads and intro videos are not part of V1.

---

## UI Build and QA Checklist

Before calling a Learli UI feature complete:

- [ ] Stays inside the marketplace scope. No LMS feature and no unapproved commerce.
- [ ] Passes the six checks in [How to check](#how-to-check) and contains none of the refused patterns.
- [ ] Meets the [first-viewport contract](#first-viewport-contract) and The One Primary Rule at 390×844 and 1440×900.
- [ ] Uses tokens, type roles, spacing roles, and the radius ladder. No hex code, raw text-size utility, arbitrary value, or new hue in feature code.
- [ ] Generated primitives it adds are adjusted per [Primitive overrides](#primitive-overrides), and the `cn()` unit test passes.
- [ ] Strings follow [Terms](#terms), [Labels](#labels), and the [UI copy rules](#ui-copy-rules): no exclamation mark, emoji, em dash, raw IANA identifier, enum name, or error code in any string Learli writes.
- [ ] One `h1`, heading levels in order, a skip link, labels on every control, keyboard operable, focus visible and never obscured.
- [ ] Checked against every row of the viewport and condition table that applies, and built with the long-content data.
- [ ] Each list and detail surface has a screenshot of every state that applies: loading, zero inventory or first use, filtered out, failed to load, no access, populated.
- [ ] Every claim on screen passes The Backed Claim Rule. Every status passes The Three Signals Rule. Every time passes The Whole Time Rule. Every parent screen passes The Named Learner Rule.
- [ ] Payment, trial, and cancellation wording implies no unapproved rule and no movement of money.
- [ ] The engineering gates in `code-standards.md` pass for this change, including server-side ownership checks and meeting-link privacy.
- [ ] Relevant automated tests, accessibility checks, and manual phone and desktop QA pass.
- [ ] `progress-tracker.md` is updated with verified progress only.

## Change management

A change to the palette, type roles, spacing roles, radius ladder, motion table, shared navigation, or a signature component is a design-system change, not a per-page tweak. Record the decision, then update the tokens, the components, the tests, and every document that quotes the changed value.

Version 1.1 leaves these lines in other documents out of date. Edit each in the change that approves the matching decision:

- `build-plan.md` Visual guidance: "Use navy/white for primary CTA" does not cover the teal action inside the navy field (decisions 1 and 18).
- `build-plan.md` M1.3: names card and dialog/drawer as starter primitives. This file installs no `Card` and uses `Sheet`, not `Drawer`.
- `code-standards.md` UI system: the component state list lacks pressed and selected or current.
- `project-overview.md`: lists "rescheduled" as a booking status (decision 22).

### Open design decisions

These are raised by this revision. Each stays `[PROPOSED]` until a founder decides, and none may be presented as approved.

1. **Navy as a ground.** A full-bleed navy first viewport on `/` and a navy footer, inside "light-first". The fallback is written at the end of [Public marketing site](#public-marketing-site).
2. **Teal means confirmed.** Success aliases the teal pair, and the separate success green is removed.
3. **Lavender is removed** from the token set. It was on the brand board but is not part of the agreed navy and teal direction.
4. **Sentence-case labels.** `prd.md` PUB-01 writes "Find a Tutor" in Title Case, while `prd.md` §14.1 writes "Find a tutor".
5. **Poppins.** Confirm the four weights and that Bold is absent from workspaces. Poppins has no tabular figures, so times align by layout.
6. **Brand artwork.** No wordmark or app-icon file exists in the repository, and the navy footer needs a reversed version.
7. **Tagline and headline.** Whether "Learning made personal." is approved, and the proposed `h1` and `lead`.
8. **Zero inventory.** Whether the production site is ever public with no approved tutor, and the proposed behavior of `/` in that state. No waitlist or notify feature exists in the PRD.
9. **Signed-out time zone.** Detected in the browser with a skeleton until known, and where a signed-out choice is stored.
10. **Terms.** "Learner" in the parent workspace (not "child" or "student"), "lesson" on action buttons, and "Create account" as the registration label.
11. **Display locale.** `en-US` with a 12-hour clock, pending the choice of launch markets.
12. **Header.** Text links and "Sign in" only, with no filled button and no account-creation button.
13. **Directory default order,** which also selects the tutors shown on the home page. `prd.md` defines none.
14. **Editing generated primitives,** and the shadcn base and preset to install. See [Primitive overrides](#primitive-overrides).
15. **Admin density.** 36px controls inside admin tables from `lg`.
16. **No tutor photos, so a list.** If photos are approved (`prd.md` §18), revisit the tutor row and the refused grid.
17. **No illustration or photograph in V1.** Version 1.0 allowed owned illustrations and brand shapes on public pages.
18. **Teal-filled action on navy.** `build-plan.md` says "Use navy/white for primary CTA".
19. **Workspace navigation.** A top bar and no sidebar for student, parent, and tutor. Version 1.0 allowed a left sidebar from `lg`.
20. **Parent workspace default.** "All learners" selected on arrival.
21. **Meeting link model.** "Add meeting link" on a booking assumes one link per booking. `prd.md` MEET-01 leaves per-booking or reusable open.
22. **Rescheduled as history, not a status.**
23. **File size.** This file is about three times the size of 1.0 because it now decides what 1.0 left open. If a shorter core file is wanted, the copy rules, the primitive overrides, and the CSS wiring can move to companion files, which requires adding them to the reading list in `AGENTS.md`.

### Revision history

- **1.1 (2026-10-11):** Reviewed with the Impeccable design skill to remove generic "AI slop" defaults. Added the design thesis, first-viewport contract, anti-slop guardrails, contrast contract, interaction states, type roles, radius ladder, motion table, primitive overrides, the time column and the other signature components, spacing roles, and UI copy rules. Replaced ranges and hedges with single values. Removed the lavender accent and the separate success green. Added `--border-control` (inputs previously used a 1.29:1 border), navy-field tokens, and a focus ring that holds on navy. Changed elevation to flat. Rebuilt the home page around a working tutor search. Corrected document links and component paths. All values remain `[PROPOSED]`.
- **1.0 (2026-10-11):** Initial V1 UI system.
