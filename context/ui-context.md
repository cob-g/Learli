# Learli — UI Context

Version2.0 — Brand kit adoption, 2026-10-13

## Authority and scope

The user approved applying `learli-brand-kit.zip` version2.0 across Learli's
existing UI/UX. This replaces the previous proposed Poppins system, cool-neutral
palette and placeholder wordmark. See
[the decision](../docs/decisions/2026-10-13-brand-kit-ui.md) and
[the blueprint](../prompts/features/m1-10-brand-kit-ui.md).

The PRD owns product behavior; architecture owns security/data boundaries. The
brand kit owns visual identity, not functionality in its example boards. Never
add practice sets, academic progress, messages, invented reviews, prices,
photographs or learning-style matching claims from those examples. Keep College
Support, truthful inventory, native interactions and all actual policy gates.

This file defines the active application adaptation. `DESIGN.md` and Impeccable
metadata describe the implemented system; they are not new product authority.
Historical implementation notes below record earlier behavior/evidence and do
not override this version's visual rules.

## Theme

One light-first theme: paper page ground, white working surfaces, navy hierarchy,
deep-teal links and focus, restrained mint highlights and teal active accents.
No OS-driven dark mode. The supplied reverse wordmark is used on a navy footer.
No gradients, glass, decorative illustration, card shadows or invented imagery.
Native dialogs retain a dimmed backdrop and a clear border; no resting elevation.

Persuade pages explain and lead into real discovery. Operate pages lead with the
current task, lesson or state. Read pages provide concise explanation. Every
screen must expose an actionable next step or a truthful empty/blocked state.

## Colors

Exact values live in `src/app/globals.css`. Feature components use semantic
utilities, never raw hex values or a second competing theme.

| Kit color | Value | Application role |
| --- | --- | --- |
| Navy | #1E2A78 | Wordmark, headings, primary actions, selected controls |
| Teal | #2ECCB0 | Original artwork and an active/next accent; never text on light |
| Mint | #A7DCCB | One highlight behind navy words, selected context where useful |
| Deep teal | #0A7566 | Links, success text, focus on light |
| Ink | #131A3D | Body text |
| Slate | #55605D | Secondary text, placeholders, enabled input borders |
| Stone | #C9D3CE | Panel edges and disabled control boundaries |
| Mist | #E6ECE8 | Neutral insets, separators, hover and success backgrounds |
| Paper | #F5F8F6 | Page ground |
| White | #FFFFFF | Panels, inputs, labels on navy |
| Alert | #B42318 | Failed operations, invalid input, destructive confirmation |

Existing warning #8A5300 on #FFF4DD and error background #FEF1F1 remain accessible
semantic adaptations; the kit does not define a separate warning treatment.
Navy hover uses #192260, active uses ink. These are shared tokens only.

### Contrast contract

WCAG2.2AA targets: ordinary text4.5:1, large text3:1, meaningful control boundaries
and focus3:1. Slate defines enabled control boundaries; stone is too faint to be
the sole enabled-control affordance. Bright teal and mint are accents or fills,
never ordinary text on a light ground. White must not appear on bright teal.
Links are underlined except navigation and explicit button-shaped actions.
Navy fields have white text and a white focus ring; light input controls within
a navy field restore their own light-ground foreground/focus tokens. Do not use
opacity to express text states. Measure actual foreground/background pairs in
rendered verification and preserve native forced-color affordances.

### Semantic mapping

`text-foreground` is ink; `text-muted-foreground` is slate. `text-primary` is navy.
`bg-background`, `bg-surface`, `bg-subtle` are paper, white, mist. `border-border`
is stone; `border-control` is slate. `text-deep-teal` and normal links use deep
teal. `bg-mint`/`brand-highlight` carry the kit highlight. `bg-brand-teal` is for
active accents. Existing success/error/warning aliases preserve their meaning.
Selection carries a label and native state (`aria-current`, checked/selected),
not color alone. A teal dot may accompany selected navy/white controls.

## Typography

Load Lexend400/500/600 and Literata400/500 through `next/font/google`, served by
the app after build. No browser font-CDN stylesheet. Lexend is the interface face:
headings, names, times, labels, controls and body. Literata is explicit
`font-reading`, used for longer explanations/biographies, never booking data or
form controls. Literata normal/italic are available; no arbitrary third family.

| Role | Size/line | Weight |
| --- | --- | --- |
| display | fluid36–56px /1.07143 |600 |
| headline | fluid28–36px /1.2 |600 |
| page-title |28px /36px |600 |
| section-title |24px /32px |600 |
| item-title |18px /24px |600 |
| lead |18px /28px |400 |
| reading |18px /30px |400 |
| body |16px /26px |400 |
| prose |16px /26px |400 |
| action/time |16px /24px |600 |
| label |14px /20px |500 |
| label-strong |14px /20px |600 |
| small |14px /20px |400 |
| caption |13px /18px |500 |

Type sizes use rem and existing semantic role utilities. Display tracking
-0.025em; headline-0.01em. Keep sentence case, left-aligned readable paragraphs,
balanced headings and meaningful hierarchy. Ordinary text measure is constrained
by content containers; long reading targets45–75characters. Do not shrink forms
below16px or important booking names/date/time below16px to make a layout fit.
Wrap long names, errors, subject/level labels and timezone context. Do not hide
these with ellipsis. Preserve the server's date/time/zone formatting.

## Spacing, border radius and motion

Kit spacing:4,8,12,16,24,32,48,64px. Align related controls, use generous space
between sections and smaller space within related groups. Standard controls48px
high;44px minimum target. Controls10px, panels16px, photo frames12px (unused),
existing checkbox4px, small status tags6px and dialogs18px. Pills are permitted
for real selection chips only; ordinary forms/buttons stay10px. Avatars circle.
No nesting panels merely for decoration. Use rows, headings and separators for
dense content. Motion is limited to short functional color/state transitions;
content is visible immediately and reduced-motion preferences are respected.

## Components and states

`action`/`field` are the shared48px controls. Primary is navy/white; outline
secondary white/navy; quiet actions and text links deep teal. Inputs use visible
labels, slate borders and clear focus. Destructive confirmation remains red.
Preserve semantic native controls, field names, autocomplete, validation,
described-by relations, error summaries/focus, pending feedback, credential
clearing and disabled-state explanations. No controls that only pretend to work.

Render loading, empty, unavailable, validation, authorization-denied and success
states honestly. Every booking status remains a factual server state; selection
is not confirmation. Keep original warning and synthetic-mode notices. A style
change must not remove hidden proofs, reset handlers, query parameters or return
URLs. Use real disabled attributes and accessible names, not styling alone.

## Layout patterns

### Public marketing site

Paper first viewport with a large navy heading and one mint phrase highlight.
Desktop balances factual introduction with the real finder or honest inventory
state; mobile stacks them. Keep the finder/next action easy to reach. Actual
tutors/subjects may appear only from current eligible catalog data. Explain the
external Zoom/Meet lesson path with readable prose and a short ordered sequence.
No decorative photos, stats, testimonials, fake cards or large dead-end hero.

### Tutor directory and profiles

Clearly label filters and viewer timezone. Use native GET/no-JS behavior where
already supported; keep filter preservation and pending restoration. Compare
real tutors in readable rows, separating identity/offerings from dated times and
profile action. No fabricated availability, ratings or verification claims.
Profiles combine actual introduction/offerings with existing availability controls,
and preserve local-preview versus published eligibility behavior.

### Account and role workspaces

Forms are calm white surfaces on paper, with one primary task and secondary
recovery/navigation. Family/tutor workspaces lead with the next lesson, learner
context and viewer timezone, then grouped history. Account/security controls keep
their warnings and recovery semantics. Admin retains scoped work-area navigation,
readable tables/rows and all existing admission/assurance gates. Mobile reflows;
it never compresses private content into unreadable type. Long tables may scroll
inside a clearly bounded labelled region, not overflow the document.

### Booking and availability

Who, what and when stay visible together: tutor, authorized learner, subject,
actual date/time/zone, duration and status. Keep LessonTime and existing chronology,
filter scopes, pagination, lifecycle history, private links and real actions.
Availability controls retain keyboard/native operation and correct pending/error
behavior. No calendar invention or business-policy change from branding.

## Navigation, icons, assets and imagery

Use original SVGs under `public/brand/`, byte-identical to kit exports. Primary on
white/paper, reverse on navy; no typed placeholder, distortion or recoloring.
Use the kit icon for browser metadata, never beside the wordmark. Respect clear
space and minimum size. Home links have a clear accessible name. Desktop and
mobile navigation keep all current real destinations, visible focus and Escape
support for the mobile dialog. Use the existing Lucide library for functional
icons only. No emoji icons or decorative icon tiles.

Photography remains absent until rights/consent and actual assets exist. The
kit's [PHOTO] frames are not production media. No uploaded tutor-photo feature or
storage service is introduced.

## Responsive, privacy and accessibility verification

Check 320/390/768/1024/1440px widths, 200% text enlargement, keyboard, focus, forced
colors and reduced motion. One h1, ordered headings, main skip link, labelled
fields, semantic errors, no horizontal page overflow. Inspect desktop/mobile
public, account, directory, booking, family, tutor and admin examples with actual
synthetic data. Axe checks supplement actual keyboard/layout observations.
Chromium evidence does not imply Firefox/WebKit; report engines explicitly.

Allow the header to wrap when enlarged text needs another row. Fieldsets and
native controls have explicit width bounds; choice labels, status badges and
complete lesson-time text can shrink and wrap within their containers. Never
reduce enlarged type or hide overflow to make a viewport check pass. Closing the
native mobile dialog explicitly restores focus to its menu trigger.

PrivateDocumentBoundary and all server authorization remain intact. Do not expose
private synthetic credentials/meeting links in shareable screenshots; local QA
artifacts remain ignored. Public indexing and real-use gates do not change.

## Change management

Record durable system changes here and in the corresponding decision/blueprint,
update shared tokens and any exact visual assertions, and verify the composed UI.
Implementation outcomes belong in `context/progress-tracker.md`. Do not claim
whole-product completion or launch readiness from a visual refresh.

## Historical implementation notes

The entries below preserve earlier functional changes and evidence. Their visual
references are superseded by version2.0 above.

### Local tutor-profile actual-date preview — 2026-10-11

M4.11 adds a native GET subject/level/time-zone picker below the public tutor
identity and offering summary. Candidate radios group by actual viewer-local
date, display elapsed60min ranges and explicit zone, and reveal remaining dates
through native details. Checked radios retain native semantics plus visible text
and approved navy/white treatment; no fake availability, ratings or prices.
Loading, unavailable, empty and error text remain distinct. Preview and review
are visibly local simulation and never imply a confirmed lesson.

An explicit visit-zone choice is stored in sessionStorage only; otherwise a saved
signed-in account zone is used, then browser IANA detection. The server/no-JS
fallback is explicitly labeled as the tutor teaching zone (UTC only if unavailable).
Public preview never changes account settings or uses a learner zone. Public-only
pending-choice summaries appear on sign-in/sign-up/verification; the private demo
chooses an authorized learner and rechecks candidates before explicit creation.

The actual-date picker is fully awaited server HTML to preserve visible native
controls with JavaScript disabled and denied-tutor404 responses. Optional client
feedback reports pending native filter navigation without intercepting submission
or changing its public fields; no route/picker streaming boundary is required.

### Local family dashboard implementation — 2026-10-11

M5.3/M5.4 follows the workspace top-bar, named-learner and time-column patterns
with explicit local simulation wording. Multiple currently authorized guardian
learners default to All learners; one has a named heading without a selector.
The native radio GET form works without JavaScript. Agenda and history use date
headings, explicit date-specific zone lines and aligned time ranges. Rows on a
single local DST-transition date are grouped separately by their actual formatted
zone/offset, with stable unique date-and-zone keys, so the shared label remains
accurate for every row. The shared
LessonTime component now accepts additive full (unchanged default), prominent
(section-title date/time) and time-only variants; time-only callers supply an
adjacent date heading and zone context. Parent time display uses the account
zone. Change time zone links to existing account settings. Loading/error/empty
states remain distinct; no gated join/payment/cancellation action is rendered.
Core HTML is fully awaited rather than hidden behind automatic streaming loading
boundaries. Native GET works without JavaScript; hydrated filter transitions show
pending text while retaining current content, and Back restores learner selection.
These are local synthetic coordination capabilities, not real launch approval.

### Local private test meeting-link section — 2026-10-11

The delegated M5.1/M5.2/M5.11 slice resolves decision21 only for synthetic local
reservations: one explicit private URL per reservation. Booking details reserve
one section before saved history, using existing fields/actions/tokens. Missing,
expired, denied, loading, error and stale-conflict text remain distinct. The
assigned eligible tutor edits with explicit revision/reload; the native action
says Open test link on the validated provider, names its new tab and rechecks
current permission/DB-time expiry before redirecting. No provider preview occurs.
JavaScript-disabled reads and native opening remain available; editing controls
are disabled with explicit enable-JavaScript guidance. Real meeting settings,
guardian oversight and confirmed-lesson UX remain subject to launch policies.


## Combined local booking and account controls —2026-10-11

The authorized booking detail places the existing local meeting section with a report action in its private navigation. Account settings includes the source password form; admin navigation includes exact-target local restrictions. Plain server text remains available without JavaScript; stateful mutations require hydration and retain accessible feedback. Combined checks include320px, phone and desktop. No new visual tokens or policy wording are introduced.

The private booking report action performs native document navigation so prior authorized booking RSC data is cleared before the support page renders. Stateful controls retain the existing hydration behavior.

Successful sign-out uses a full document replacement to the sign-in page, clearing private bootstrap data before a different actor can sign in. Failure retains the existing accessible error/pending behavior.

Successful sign-in also replaces the full document using the existing validated return path, so a revoked/expired session cannot carry prior private bootstrap data into a different actor’s account. Other auth-mode navigation remains unchanged.

### Four-feature final password-summary recovery — 2026-10-12

The signed-in password form renders a visible focusable alert summary when three
fields fail, with specific error links focusing their named inputs. First-invalid
focus and each inline aria association remain. Summary/errors clear on validated
resubmission; credential values are absent from summary/status/diagnostics and
cleared before actual requests and safe captures. Public auth entry from a prior
private document displays brief loading status until a fresh document replaces
it, preserving return intent and existing no-JS server navigation.


### Directory lesson-time controls (M3.5, 2026-10-12)

The existing directory GET form has a native optional Lesson time disclosure,
viewer-zone select, weekday checkboxes and one existing time-band select.
Explicit Browse without a time filter is the default; Any available time also
requires a viewer zone. Phone controls stay above the list, desktop controls
in the existing sidebar. Invalid opt-in inputs retain safe values, associate
inline errors and focus the first correction. Pending navigation announces
Loading tutors. Filtered rows use the existing full LessonTime date/time/zone
and visible local-simulation wording; plain rows remain unchanged. URL state
restores paging/Back and works without scripts. No new tokens or dependencies.

### 2026-10-12 — Local account email confirmation

Dedicated private `/account/email` uses existing page/field/action tokens and
one primary submit per step. Distinguish saved current email from proposed
pending email; transient masked numeric codes never enter URLs or browser
storage. Focus safe status/errors, disable mutation before hydration and during
requests, and stop retries after uncertain completion with native account/session
recovery. Successful completion replaces the full document. No new design tokens.
The email submit changes enabled/disabled colors immediately: interpolating both
foreground/background produced an insufficient intermediate contrast ratio.


### Local native select sizing compatibility — 2026-10-12

Root msg_33183702628d allocates the existing .field native-select repair after
actual Firefox/WebKit acceptance found public selects44px versus30px. Select
fields relinquish OS closed-control painting with appearance:none so existing
field minimum/type/border/color/radius tokens control their box. They remain
actual labelled HTML selects with native keyboard/popup/no-JS behavior and the
existing global focus outline. No fixed height, new tokens, JavaScript widget,
asset/dependency or role/permission change. Execution evidence is recorded
separately in progress-tracker and the Worker5 report; this note is not a claim
that repair verification or full M8/launch acceptance already passed.


Root followup msg_21e135a68e2e requires a visible dropdown affordance. The final
CSS uses two hard-stop transparent/currentColor triangles as a flat functional
marker, with existing spacing values8/12/20/32 and reserved inline text space.
This narrowly allocated control indicator is the only use of gradient syntax
allowed here; decorative gradients remain prohibited. CurrentColor follows the
existing foreground or disabled muted token; no new hue, asset or widget.
Only single-value dropdowns (no size or size0/1, not multiple) receive it.
Multi-selects/listboxes receive no marker. Disabled select fields use existing
subtle/muted/border tokens. Forced-colors mode restores native painting/marker
and clears background images; global focus and native HTML behavior remain.
The earlier marker-less draft was not accepted/frozen and is superseded.

### Local completion demonstration surfaces — 2026-10-12

The authorized local-completion wave adds a bounded exception to the pending
commercial booking controls above: synthetic participants may reschedule or
cancel a local simulation, with labels explicitly saying simulation and without
payment, attendance or real-lesson claims. Rescheduling keeps the original
expiry and shows preserved history; inactive meeting sections say unavailable.
The first three days of candidate times appear initially; a native disclosure
exposes the remaining dated choices. Existing tokens, time columns and semantic
status treatments remain unchanged.

Learner creation is minimal and fictional. Empty learner/booking/dashboard states
link to creation; a valid public selected time survives this detour and a native
success link returns to it. Core private learner and support reads are awaited
server HTML. Mutation forms remain disabled before hydration with POST/no-script
guidance, while native navigation clears the previous private document.

Exact-case support dispatch has a separate minimal queue and native reviewer/
action controls; it never exposes report body or private learner/meeting data.
The footer links Privacy draft, Terms draft and Cancellations draft, with visibly
unfinished preparation content and no consent or acceptance controls. These
local additions do not establish customer policy or production readiness.


### W1 authenticator security surfaces — 2026-10-12

`/account/security` is reachable using verified active admin identity for setup,
but shows no administrative domain records without current assurance. Native
Learli tokens/labelled password and one-time-code controls provide manual
transient authenticator-key entry and once-visible recovery codes. No external
QR service, persisted browser storage, URL/SSR bootstrap credential, screenshot
or trace with secrets. Secret regions are removed on departure; restored documents
reload. `/two-factor` handles pending password sign-in with authenticator or
provider recovery code and full document replacement after verification. No-script
states explain the security requirement and have inert mutation controls. Current
password plus fresh factor proof protects code rotation/disable; safe errors offer
sign-in/verification recovery without promising rollback after provider uncertainty.


### Policy preparation surfaces in the eight-area candidate — 2026-10-13

Admission, tutor evidence, assigned safeguarding and policy booking controls reuse
native labelled inputs, existing Learli tokens, semantic status text and private
document replacement. Pending admission is explicitly unauthorized. Missing policy
prevents intake, rather than collecting information behind an inactive submit.
Administrative completion/no-show and synthetic prerequisites are labelled as
software states, without attendance, payment or verified-person claims.

A validated public tutor/subject/level/interval survives authentication and learner
admission using canonical return links. Current server candidates decide whether
the exact saved interval is preselected; stale choices stay unselected with an
explanation and never reserve automatically. Private learner IDs do not travel in
public authentication return parameters. Native no-script navigation remains
readable; mutations stay inert before hydration and independently guarded on POST.

The publication software projection is a separately labelled synthetic readiness
surface, not social proof for the public marketplace. Only approved eligible new
records may contribute Customer/rating/plain-text/date and the matching aggregate;
private authors and booking details are absent. An unavailable query cannot be
styled as zero reviews. Actual public publication remains gated by policy.
