# Learli — UI Context

> **Project:** Learli — online tutoring marketplace and booking intermediary  
> **File:** `ui-context.md`  
> **Version:** 1.0 • 2026-10-11  
> **Status:** Initial V1 UI system. Product boundaries and brand direction are agreed; exact visual tokens and component specifications below are **proposed implementation defaults** until design approval.  
> **Related:** [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md), [`PRD.md`](./PRD.md), [`architecture.md`](./architecture.md), [`AGENTS.md`](./AGENTS.md), [`CODE-STANDARDS.md`](./CODE-STANDARDS.md)

## How to use this file

This is the **single visual and interaction reference for Learli V1**. Read it before designing pages or changing shared components. It describes the intended design, **not evidence that the UI has been implemented**.

- **`[AGREED]`** Learli helps families and learners find tutors, arrange **1:1** sessions, and join lessons on **Zoom / Google Meet**. It is **not an LMS**.
- **`[AGREED]`** Visual identity: lowercase **`learli`** wordmark, friendly and contemporary character, **deep-navy + teal** direction, responsive and accessible experience.
- **`[AGREED]`** UI stack: **Next.js App Router + React + TypeScript + Tailwind CSS + shadcn/ui**.
- **`[PROPOSED]`** The exact colors, font hierarchy, radii, spacings, and layout numbers below are the initial design-token specification. Review as a set rather than overriding them independently in individual screens.
- **`[GATED]`** Pricing, checkout, subscription, payout, trial guarantees, refund windows, and review publication require approved business rules before user-facing claims or live flows.

**Precedence:** Latest explicit product/design decisions → `architecture.md` and `PRD.md` (scope and safety) → `AGENTS.md` / `CODE-STANDARDS.md` (engineering) → this file (visual details). Escalate conflicts rather than silently changing the product.

---

## Theme

**Light-first, warm, trustworthy educational marketplace** — not a dark technical admin console, social network, school portal, or content-heavy LMS.

- **Personality:** Welcoming to younger learners and parents, but polished enough for college students and professional tutors.
- **Look:** Spacious white/off-white surfaces, generous whitespace, clear deep-navy typography, restrained mint/teal accents, very occasional soft lavender decoration.
- **Hierarchy:** Tutor identity, actual subjects, available sessions, clear booking actions, and trust/safety information come first. Avoid decorative dashboards that distract from booking.
- **Feel:** Rounded but not childish; calm, simple, credible, and easy to scan. Avoid excessive gradients, glassmorphism, neon, gratuitous motion, emoji-led UI, or novelty 3D illustrations.
- **Theme policy:** V1 uses one accessible **light theme**. **Dark mode is not a V1 requirement.** If added later, implement a full tokenized theme; do not invert backgrounds ad hoc or allow OS dark mode to break contrast.
- **Marketing vs. workspace:** Public pages may be expressive; authenticated screens should be quieter and task-oriented. Both share the same typography, color tokens, spacing, and controls.
- **Visual reference:** The initial learner-facing brand board and selected icon concept are **inspiration**, not pixel-perfect approved screens. Its unrelated category examples (programming, arts/music, hobbies, etc.) are **not part of Learli's agreed launch catalog**.

**Primary visual rule:** A user should understand **what Learli does, which tutors are actually available, and how to book** without unnecessary scrolling, unclear claims, or forced questionnaires.

---

## Colors

### Core palette

These are the **initial proposed tokens**, based on the previously selected navy/teal identity. Define values only in the theme layer; **feature components must reference tokens rather than embedding hex codes**.

| Role | CSS variable | Initial value | Intended use |
|---|---|---|---|
| Page background | `--bg-base` | `#F7F9FC` | App background and light marketing sections |
| Surface | `--bg-surface` | `#FFFFFF` | Cards, dialogs, form areas |
| Subtle surface | `--bg-subtle` | `#EFF3F9` | Filter rails, inset regions, skeletons |
| Primary text | `--text-primary` | `#16204D` | Headings, body, important labels |
| Muted text | `--text-muted` | `#55627A` | Secondary instructions and metadata |
| Primary brand / action | `--brand-navy` | `#1E2A78` | Main CTA, logo, navigation highlights |
| Primary action hover | `--brand-navy-hover` | `#162267` | Hover/pressed emphasis |
| Primary accent | `--accent-primary` | `#2ECCB0` | Brand dot, small accents, decorative details |
| Accent text / dark teal | `--accent-strong` | `#056D60` | Teal text links and labels on light surfaces |
| Soft teal surface | `--accent-soft` | `#E7FAF5` | Gentle status tags / accent panels |
| Secondary decorative accent | `--accent-purple` | `#A78BFA` | Rare decorative shapes/illustrations only |
| Soft lavender surface | `--accent-purple-soft` | `#F3EEFF` | Occasional illustrative background |
| Border | `--border-default` | `#DDE3EF` | Inputs, cards, separators |
| Focus ring | `--focus-ring` | `#364BD6` | Keyboard focus indicators |
| Error | `--state-error` | `#B42318` | Invalid entries and failed operations |
| Error background | `--state-error-soft` | `#FEF1F1` | Accessible alerts |
| Success | `--state-success` | `#126B4E` | Verified successful actions |
| Success background | `--state-success-soft` | `#E9F8F1` | Confirmation alerts |
| Warning | `--state-warning` | `#8A5300` | Expiring/attention states |
| Warning background | `--state-warning-soft` | `#FFF4DD` | Non-destructive warnings |

**Contrast safeguards:** White on navy, white on dark teal, and dark navy on the bright teal satisfy ordinary text contrast at the proposed values. **White text on `--accent-primary` does not meet WCAG AA for normal-sized text**; do not build teal buttons with white labels. Bright lavender on white is decorative only, not small body text. Use navy (or appropriately dark teal) for small text and important interactive elements. Test real compositions rather than assuming all variants pass.

### Starter CSS variables (Tailwind + shadcn/ui)

Place these in the project's global theme file (typically `src/app/globals.css` or `app/globals.css`, according to repository structure). **Match the installed Tailwind/shadcn version before pasting integration mappings; never introduce duplicate conflicting themes.**

```css
:root {
  color-scheme: light;

  /* Learli brand and semantic tokens */
  --bg-base: #F7F9FC;
  --bg-surface: #FFFFFF;
  --bg-subtle: #EFF3F9;
  --text-primary: #16204D;
  --text-muted: #55627A;
  --brand-navy: #1E2A78;
  --brand-navy-hover: #162267;
  --accent-primary: #2ECCB0;
  --accent-strong: #056D60;
  --accent-soft: #E7FAF5;
  --accent-purple: #A78BFA;
  --accent-purple-soft: #F3EEFF;
  --border-default: #DDE3EF;
  --focus-ring: #364BD6;
  --state-error: #B42318;
  --state-error-soft: #FEF1F1;
  --state-success: #126B4E;
  --state-success-soft: #E9F8F1;
  --state-warning: #8A5300;
  --state-warning-soft: #FFF4DD;

  /* shadcn semantic aliases: foregrounds remain readable */
  --background: var(--bg-base);
  --foreground: var(--text-primary);
  --card: var(--bg-surface);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-surface);
  --popover-foreground: var(--text-primary);
  --primary: var(--brand-navy);
  --primary-foreground: #FFFFFF;
  --secondary: var(--bg-subtle);
  --secondary-foreground: var(--text-primary);
  --muted: var(--bg-subtle);
  --muted-foreground: var(--text-muted);
  --accent: var(--accent-soft);
  --accent-foreground: var(--text-primary);
  --destructive: var(--state-error);
  --destructive-foreground: #FFFFFF;
  --border: var(--border-default);
  --input: var(--border-default);
  --ring: var(--focus-ring);
  --radius: 0.875rem;
}
```

For Tailwind CSS **v4**, wire tokens through the existing `@theme inline` mechanism, adding/merging aliases as appropriate. Example:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Custom semantic classes, if needed */
  --color-learli-navy: var(--brand-navy);
  --color-learli-teal: var(--accent-primary);
  --color-learli-teal-strong: var(--accent-strong);
  --color-learli-teal-soft: var(--accent-soft);
}
```

The default shadcn installation may add more variables (e.g., chart/sidebar tokens). **Extend rather than replace** those only when actual components require them. Never copy default dark-mode selectors blindly into the Learli light-only MVP.

### Color usage rules

- **Primary CTA:** Navy background + white text; hover with `--brand-navy-hover`. Use one visually dominant action per local section.
- **Secondary CTA:** Light surface with navy text and border; do not compete with the primary CTA.
- **Teal:** Accent dots, progress-independent visual highlights, selected control details, and pale callout surfaces. A teal-filled CTA, if necessary, uses navy text.
- **Links:** Navy or dark teal with underline on hover/focus (and visible other-than-color affordance where needed).
- **Statuses:** Use label + symbol where useful + color; never communicate `Confirmed`, `Pending`, `Cancelled`, `Unavailable`, or `Error` through color alone.
- **Error, success, warning:** Use dedicated state tokens; do not repurpose promotional teal or purple as operational states.
- **Text contrast:** WCAG 2.2 AA target — normal text at least **4.5:1**, large text and essential icons/control boundaries at least **3:1**. Evaluate text on both solid and subtle backgrounds.

---

## Typography

### Font selection

The original brand concept used **Poppins**. Retain that as the **initial proposed primary UI and heading family**; use system fallbacks during loading.

| Role | Font | Variable / usage |
|---|---|---|
| Brand wordmark | Approved `learli` artwork | Use the asset; **do not recreate the wordmark by typing it in Poppins** |
| UI text | Poppins (400/500/600) | `--font-sans` (implemented through `next/font`) |
| Headings | Poppins (600/700) | `--font-sans` |
| Code/mono, IDs if essential | System monospace | `--font-mono` |

Use `next/font/google` for Poppins or use a compliant locally hosted copy if deployment requirements make remote font fetching undesirable. Keep typography consistent across server and client renders.

### Type scale — proposed

| Element | Mobile | Desktop | Weight | Line height |
|---|---|---|---|---|
| Marketing H1 | 2.1–2.3rem | 3.0–3.5rem | 700 | 1.1–1.15 |
| Page H1 | 1.75rem | 2.25rem | 700 | 1.2 |
| H2 | 1.5rem | 1.875rem | 600–700 | 1.25 |
| H3 / card title | 1.125rem | 1.25rem | 600 | 1.3 |
| Body | 1rem | 1rem | 400 | 1.55–1.65 |
| UI label / compact | 0.875rem | 0.875rem | 500–600 | 1.4–1.5 |
| Supplemental caption | 0.75rem | 0.75rem | 400–500 | 1.4 |

- Use **real heading semantics** (`h1`–`h3`) reflecting page hierarchy, not just typography classes.
- Keep critical booking information at **14–16px or larger**, including the time, time zone, tutor name, booking status, and actions. The 12px caption is **only for non-essential hints**.
- Prefer sentence case for headings/buttons. Avoid all-caps marketing blocks and tiny low-contrast gray copy.
- Marketing headlines may use subtle negative letter spacing; do not apply it to forms or dense data.
- Keep text zoom to **200%** usable without clipped controls or horizontal scrolling.

---

## Border Radius

Use the shared Tailwind/shadcn radius scale and the `--radius` base token. Avoid one-off arbitrary values in product screens.

| Context | Preferred class | Guidance |
|---|---|---|
| Inline controls, text fields, compact tags | `rounded-md` | Consistent, readable form affordances |
| Buttons | `rounded-lg` | Comfortable without becoming cartoonish |
| Cards / tutor profiles / panels | `rounded-xl` | Friendly marketplace feel |
| Dialogs / sheets / major overlays | `rounded-2xl` | Softer than workspace panels |
| Avatar / circular status indicators | `rounded-full` | Intentionally circular |
| Hero accent blocks | `rounded-2xl` | Limited to marketing layout |

**Elevation:** Prefer borders and a very subtle shadow for cards; stronger elevation only for active menus/dialogs. Hover can lift card border/shadow slightly, but must not move layout or conceal content. Use theme tokens or Tailwind's shared shadow scale, not custom hardcoded one-off shadows across components.

---

## Component Library

**shadcn/ui over Tailwind CSS**, with accessible primitives from its supported dependencies. Keep the component base small and consistent.

### Ownership and structure

- `src/components/ui/` — generated or carefully adapted shadcn primitives. Preserve their accessibility behavior.
- `src/components/shared/` — shared Learli composition: `SiteHeader`, `PageHeading`, `EmptyState`, `StatusBadge`, `ConfirmDialog`, etc.
- `src/components/tutors/` — `TutorCard`, `TutorFilterPanel`, `TutorProfileSummary`, `AvailabilityPicker`.
- `src/components/booking/` — `BookingSummary`, `BookingStatus`, `BookingDetails`, and authorized meeting-link action.
- `src/components/account/` — focused role-specific navigation and account settings controls.

Paths follow repository structure; omit the `src/` prefix if the app was initialized without it.

### Recommended primitives — add only when needed

| Primitive | Where needed | Key rule |
|---|---|---|
| Button / Link | CTAs, booking actions | Match action priority, include loading/disabled state |
| Input / Label / Form / Select | Account, matching, profiles | Persistent label and clear validation messages |
| Card / Badge / Separator | Tutor list, booking details | No unsupported ratings/credentials |
| Dialog / AlertDialog | Destructive action confirmation | Restore focus, confirm true consequences |
| Sheet / Drawer | Mobile filter or navigation | Accessible focus trap and escape-to-close |
| Tabs | Focused dashboard subviews | No hidden essential content that users cannot discover |
| Calendar / Popover | Tutor slot selection | Keyboard operable; locale/time-zone-aware |
| Skeleton / Alert / Toast | Loading, errors, confirmation | Never imply booking success before server confirmation |

Prefer composing existing primitives over introducing a second UI library. Avoid animated UI dependencies unless a real product requirement justifies them.

### Component state contract

Every interactive shared component must define and test where relevant:

- Default, hover, `focus-visible`, disabled, loading, empty, error, and success states.
- Clickable area of approximately **44 × 44 CSS px** for primary mobile touch actions whenever practical.
- Clear `aria-label`/visible text, keyboard action, and status announcement.
- Real navigation (`<a>` / Next.js `<Link>`) versus an in-page action (`<button>`)—do not interchange.
- Idempotent or disabled submit during network mutation to limit accidental double actions; **backend remains authoritative**.

---

## Layout Patterns

### Global rules

- **Mobile-first:** Start with 320–390px wide layouts, then enhance at `sm`, `md`, and `lg` breakpoints.
- **Content container:** Aim for `max-w-7xl` for full marketing/catalog regions and `max-w-5xl` for form/step/long-form regions; use responsive gutters (`px-4 sm:px-6 lg:px-8`).
- **Spacing:** Follow the Tailwind **4px spacing rhythm** (4/8/12/16/24/32/48px and multiples). Avoid arbitrary spacing for repeated patterns.
- **Desktop grid:** Flexible content; never shrink tutor information or actions to create a decorative fixed-width column.
- **Viewport behavior:** No horizontal scrolling at narrow widths (except deliberately accessible, labeled tabular overflow if absolutely needed).
- **Footer:** Consistent links to how it works, subjects, support, policies, and contact. Publish policy copy only after review.

### Public marketing site

**Header:** `learli` logo left, short navigation (`Find a Tutor`, `Get Matched`, `Subjects`, `Become a Tutor`), Sign in, and one standout action. On mobile: logo + accessible menu button; links in a sheet/drawer. Avoid oversized menus.

**Homepage content order:**

1. **Hero:** Plain statement of tutor-finding value; primary **Find a Tutor**, secondary **Get Matched**. Do not promise AI, free trials, or guaranteed outcomes.
2. **Learning categories:** Math, Science, English, exam prep, homework help, study skills; show **Specialized Subjects** only where actual tutors offer them. College Support must remain discoverable.
3. **How it works:** Find a tutor → choose an available time → meet on Zoom/Google Meet.
4. **Tutor previews:** Only real, publicly eligible tutor records. If none exist, show a truthful empty or coming-soon state, not fabricated tutors.
5. **Trust/help:** Accurate description of the intermediary role, support and safeguarding paths; no fake “verified” badges or exaggerated reach/ratings.
6. **Footer:** Help, contact, terms/privacy where approved.

Use people-centered imagery **only with proper permission and appropriate rights**. For initial development, illustrations/static brand shapes and initials avatars are sufficient. Do not copy competitor layouts or protected screenshots.

### Tutor directory (`/tutors`)

- **Desktop:** Search + filter rail/toolbar + responsive tutor-card grid or list. Use actual subject, level, and availability filters only.
- **Mobile:** Search visible; filters open in a labeled `Sheet`/drawer with **Apply** and **Clear filters** actions. Preserve chosen filters and results context.
- **Tutor card:** Display name, truthful expertise, levels, concise introduction, supported time zone/next actual availability when available, and a clear **View profile** action. Only show pricing or reviews after the relevant data/policies exist.
- **Empty state:** “No tutors match these filters” + **Clear filters**. Loading should not appear as “0 tutors found.”
- **Search UX:** Enter/search button or responsibly debounced queries; avoid misleading result counts or flashing cards between loads.

### Tutor profile (`/tutors/[slug]`)

- Show **identity and expertise first**, not an endless résumé. Use a real photo only if properly provided/approved; otherwise initials avatar.
- Clearly list supported subjects and levels (**college topics when genuinely offered**), tutor introduction, languages if known, and practical availability.
- A booking summary/action may be sticky on wide screens; on mobile use a safe visible CTA without covering content or the OS keyboard.
- Only show a **badge/claim** such as `Verified`, `4.9`, `100+ lessons`, or `Free trial` if the backing process/data and publishing policy are approved and accurate.
- Never expose the tutor's personal phone/email or a participant-only meeting link on a public page.

### Guided matching (`/get-matched`)

- A **short, rule-based questionnaire**, not an AI chat screen: learner level → subject/learning goal → relevant availability → optional preferences actually supported.
- One clear question or small group per step; show step count, Back/Continue, preserved input, and an easy exit to **Browse tutors instead**.
- Require authentication only when necessary to proceed with a protected booking. Do not demand sensitive child information just to browse public tutors.
- Results must be genuine matching tutors; otherwise explain the lack of matches and offer a clear fallback.

### Booking and availability

- Display **tutor, subject, learner, date, time, duration, and the viewing user's IANA time zone** together before submitting. Example: `7:00 PM · Asia/Manila (UTC+08:00)`; examples are illustrative, **not real availability**.
- Pickers use actual available intervals and clearly label **Selected**, **Unavailable**, and **Expired** states with text/symbols, not just color.
- Ask the authorized guardian to select the child account when booking for a minor; do not rely on a name field alone.
- Confirmation comes **only after server-side slot revalidation and approved booking/payment conditions**; a selected slot in the UI is never guaranteed.
- If the slot disappears, show: **“That time is no longer available. Please choose another.”** Preserve non-sensitive inputs and take user back to current slots.
- Pending/confirmed/cancelled/rescheduled labels follow the **approved lifecycle**; do not invent payment windows, trial entitlements, rescheduling cutoffs, or cancellation fees.
- Zoom/Google Meet button/link is shown **only to authorized participants on a valid booking**, never in public HTML, card metadata, analytics, or notifications to unrelated parties.
- Tutors provide valid external meeting URLs in a private workflow. Learli must not show a built-in classroom or pretend it can detect meeting attendance without a verified integration.

### Account and role workspaces

| Role | Desktop layout | Mobile layout | First things visible |
|---|---|---|---|
| Student / eligible independent learner | Compact navigation + main content | Stacked sections/menu | Upcoming bookings, tutor and join action (when eligible), history |
| Parent / guardian | Clear learner switcher + main content | Sticky/visible learner context + list | Child selected, upcoming sessions, booking status, actions |
| Tutor | Compact navigation + schedule area | Vertical booking and availability views | Next booked session, availability, profile completion, history |
| Admin / support | Restrained worktable + filters | Responsive lists and detail views | Tutor eligibility, account issues, booking lookup, safety/support cases |

- Desktop dashboard nav can use a left sidebar at `lg+` and a compact top/menu pattern below it. Avoid giant charts and KPI cards for a marketplace coordination product.
- Parent child-switching must show **which learner's data is on screen**, while backend ownership checks remain mandatory.
- Admin views should reveal **only the private fields needed for the current support task**, not unrestricted child profiles.
- Avoid LMS-like navigation such as Courses, Submit Homework, Grades, Assignments, Content Library, AI Tutor, or Progress Analytics.
- If no sessions exist, show a purposeful empty state with **Find a tutor** or **Set availability**, not a blank chart.

### Navigation and surface conventions

- **Navbar:** Clean white or subtle neutral background; optional 1px token border; no mandatory fixed nav if it obscures the viewport.
- **Sidebar:** Neutral surface, consistent active state that uses text plus clear fill/indicator; collapsible on mobile.
- **Dialogs:** Moderate width; only for short confirmations and non-complex forms. Move lengthy booking/matching processes to actual pages.
- **Toasts:** Brief acknowledgment of an already completed action, not the only place for critical errors or policy details.
- **Forms:** Labels above controls; helper text nearby; validation next to the field; always provide a recoverable path.

---

## Icons

Use **Lucide React** as the proposed shared stroke-icon library, matching shadcn/ui patterns.

- Standard inline: `h-4 w-4` (16px), buttons/menus: `h-5 w-5` (20px), empty states: `h-8 w-8` to `h-10 w-10` sparingly.
- Keep stroke weight consistent (typically 1.75–2), with `aria-hidden="true"` when text already names the action.
- Useful metaphors: `Search`, `SlidersHorizontal`, `BookOpen`, `GraduationCap`, `CalendarDays`, `Clock3`, `Video`, `UserRound`, `Users`, `ShieldCheck` **only when warranted**, `CircleHelp`, `ArrowRight`, `CheckCircle2`, `AlertCircle`.
- Never use a decorative shield/checkmark to claim a tutor was verified unless the platform actually performed and recorded the required check.
- Icons **supplement labels**, not replace them for core actions such as Book, Cancel, Join meeting, Report, and Sign out.
- The Learli app-icon concept is separate brand artwork: **rounded navy square + white lowercase-`l` gesture + teal dot + smaller white dot**. Use an approved asset for logos/favicons; **do not attempt to recreate it by combining Lucide icons**.

---

## Responsive and Accessibility Requirements

**Quality target: WCAG 2.2 AA for core public, sign-in, matching, booking, and dashboard journeys.**

| Viewport / condition | Minimum checks |
|---|---|
| 320px | No horizontal clipping; usable search, forms, tutor cards, and booking summary |
| 390px | Mobile navigation, drawer filters, readable session times, 44px touch actions |
| 768px | Tablet catalog grid/booking form without overlapping controls |
| 1024px | Dashboard navigation and cards remain readable without oversized sidebars |
| 1440px | Balanced typography, max-width content, no excessive line length |
| 200% zoom | Controls and text still visible and operable |
| Keyboard only | Tab order, visible focus, Escape for overlays, no keyboard traps |
| Screen reader smoke test | Input labels, tutor-card actions, dates/times/statuses, error messages |
| Reduced motion | Respect `prefers-reduced-motion` for scrolling, fades, and transitions |

- **Visible focus:** Maintain a clearly contrasting focus ring on inputs, links, date pickers, tabs, drawers, and dialogs.
- **Modal management:** Move focus into overlays, trap it only while modal is open, and restore it on close.
- **Status messaging:** Use `aria-live` or equivalent appropriately for refreshed results and form success/errors, without noisy announcements on every keystroke.
- **Forms:** Validation errors describe *what* to change. Do not show vague “Something went wrong” when a specific safe explanation is possible.
- **Time:** Never render an ambiguous bare `10:00 AM`. Show date and a user-understandable time-zone context; support DST changes safely.
- **Color-only exclusions:** No reliance on color, icons, opacity, or hover alone for meaning.
- **Loading:** Reserve layout space to avoid large content shifts and disable only the controls that truly cannot be used.

---

## Product Copy, Content, and Trust

- Tone: **clear, respectful, encouraging, plain English**, suitable for parents, younger learners, and independent college learners. Avoid patronizing or overly childish copy.
- User-facing name in prose: **Learli**. Logo/brand mark: **`learli`** in lowercase. Initial tagline direction: **“Learning made personal.”** (proposed, not a legal/service guarantee).
- Emphasize **find a tutor, get matched, book, join on Zoom/Google Meet**. Clearly distinguish Learli's intermediary role from the tutor's teaching responsibility.
- Avoid claiming “AI-powered matching,” “guaranteed grades,” “certified tutors,” “all tutors verified,” “24/7 support,” “free trial,” “best tutors worldwide,” or numerical social proof without an implemented factual basis.
- Do not make the website appear to provide assignment submission, homework grading, built-in video, lesson recordings, school classes, or academic-content dashboards.
- Show genuine availability; do not seed production tutors, rates, photos, reviews, or times merely to make pages look full.
- For minors, show clear **parent/guardian context and safeguarding/reporting paths**. Collect only the data the approved registration flow needs and do not expose a child's personal details publicly.
- **Never** add pricing/checkout screens that claim to accept real payments before the commercial model, payment provider, disclosures, cancellation/refund rules, and operational safeguards have been approved.
- When copy or legal promises are undecided, show a neutral navigational structure or mark the section as blocked in development—not fictional public policies.

---

## Assets and Imagery

- Keep approved brand artwork and safe static assets under `public/brand/` (or equivalent). Use Next.js image optimization for eligible assets.
- Store no student assignments, tutor lesson plans, PDFs, course media, or user-uploaded learning content in V1.
- Tutor portrait uploads and intro video are **not required** for initial V1. Prefer initials avatars until a file storage/privacy solution is separately approved.
- For illustrations/hero photography, obtain rights and consent (especially if depicting identifiable children); never reuse competitor website screenshots or stock photos without licensing.
- Initial **raster** logo/mockup files are visual references, not proof of vector-ready production assets. Before large-scale usage, verify sharp exports, responsive legibility, brand spacing, and favicon visibility.
- Decorative SVG illustrations are acceptable when owned/licensed and do not imply unavailable features.

---

## UI Build and QA Checklist

Use this list before calling a Learli UI feature complete:

- [ ] Fits Learli's marketplace-only scope; no LMS or unapproved commerce added.
- [ ] Uses design tokens and shared shadcn components; no hardcoded feature-level palette.
- [ ] Uses the lowercase `learli` artwork consistently; brand copy is accurate.
- [ ] Correct heading order, accessible labels, keyboard navigation, and visible focus.
- [ ] Tested on 320/390/768/1024/1440px and at 200% zoom where relevant.
- [ ] Loading, empty, validation error, permission denied, expired slot, and success states are intentional.
- [ ] Tutor names, credentials, subjects, time slots, and reviews come from real authorized data, not placeholders.
- [ ] User/guardian ownership is enforced **server-side**; UI visibility is not used as an authorization boundary.
- [ ] Dates/times show viewer-local context; stale slot submissions fail gracefully.
- [ ] Zoom/Google Meet details are accessible only to the proper booking participants.
- [ ] Payment/trial/cancellation messaging does not imply unapproved rules or real money movements.
- [ ] Relevant automated tests, accessibility checks, and mobile/desktop manual QA pass.
- [ ] Update `PROGRESS-TRACKER.md` only with actually verified development progress.

## Change management

Treat changes to the palette, visual hierarchy, typography, interaction rules, and shared navigation as **design-system changes**, not silent per-page styling tweaks. Record the decision and update the tokens, component library, screenshots/tests, and any affected documentation together. This avoids a visually inconsistent marketplace as different agents implement different screens.

**Guiding rule:** *Learli should make finding, booking, and joining a tutor session feel effortless—while staying honest about what the platform does and does not provide.*
