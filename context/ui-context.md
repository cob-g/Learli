# Learli — UI Context

Version2.17 — Brand kit adoption, plus public home motion, illustration, layered hero photographs, liquid glass, a sample review carousel, search metadata and a page-loading bar, 2026-10-14

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
No gradients, glass, card shadows or invented imagery. Illustration, authored
motion, illustrative hero photographs and liquid glass exist on the public home
page only, under the rules below and
[this decision](../docs/decisions/2026-10-13-home-motion-illustration.md).
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
high;44px minimum target. Controls10px, panels16px, image frames12px
(`rounded-frame`, the home illustration), existing checkbox4px, small status
tags6px and dialogs18px. Pills are permitted
for real selection chips only; ordinary forms/buttons stay10px. Avatars circle.
No nesting panels merely for decoration. Use rows, headings and separators for
dense content. Outside the public home page, motion is limited to short
functional color/state transitions. Everywhere, content is visible immediately
and reduced-motion preferences are respected.

### Public home motion

The owner asked on 2026-10-13 for scroll animation and a more engaging home page.
Its motion has four moves, each taken from the kit's "one highlight and one dot":
the mint highlight is drawn across a headline phrase; hairlines above list rows
are ruled left to right; a stroke is drawn through the three steps; and the
kit icon's parts (a ring, two stems, one teal dot) rearrange for each
step: a lens, a clock, then two people under one arc.

**How a lesson comes together** (revised twice at the owner's request: first
the shapes behind the tile and the filling line went, then a pinned tile that
filled with liquid while the steps tilted past it, which the owner found odd on
scroll). It now carries the hero's layered stroke, in blue on navy. One stroke
falls five degrees to the right across the whole viewport, the mirror of the
hero's, which rises; the three steps are set on it,
each with a glass tile that the stroke passes behind, so the glass bends the
line and the white glyph stands in front. On screens from 64rem the steps sit
in three columns on one stroke and the process climbs it (owner's request):
the first step, Find, is lowest at the bottom right, Choose is in the middle,
and the last, Meet, is highest at the top left. The steps stay in order in the
markup. A stop marks where the line starts, just before the first step. The
stop is the hero's to the pixel (a 2.5rem dot in a
0.375rem ring) in this section's colours, navy in white, and the stroke has
the hero stroke's thickness at each breakpoint. Narrower screens stack the steps and give each tile its
own stroke.

- Spacing follows the screen's height from tablet widths: 16vh above and below
  (between 6rem and 11rem) and 11vh between the heading and the steps (4rem to
  7rem), so the section fills about one screen on a laptop. Phones use 5rem
  and 3.5rem.
- Its introduction is set in Lexend, like the steps beneath it, at the owner's
  request; Literata is not used in this section.
- From 64rem the introduction and its link sit on the left and the heading on
  the right, its words meeting the right margin (owner's request). The heading
  stays first in the markup, so reading order is unchanged; narrower screens
  stack heading, then introduction.
- The blue (`--line`) is navy lifted toward white in navy's own hue. It is not
  a new brand colour and is used for this stroke only.
- Text never sits on the stroke: each step's words are below its tile.
- Nothing is pinned and nothing follows the scroll position except the stop
  and a few pixels of drift between tiles and line. On arrival the stroke
  is drawn from its low end at the right up to the left, and each glyph
  assembles from the step before it as the stroke reaches its tile, once.
  Stacked steps draw their own strokes left to right.
- On wide screens the three steps arrive together (`data-reveal-group`), so
  they always assemble in order whatever their height on the page.

- Server markup is complete. Only `HomeMotion` sets `data-reveal="pending"`, and
  only on an element still below the viewport, so nothing in view can vanish and
  a failed script hides nothing.
- Waiting is applied at once and only the release is animated, so a fast scroll
  never catches a stroke half way into hiding.
- Reduced motion keeps every state (the active step still changes) and removes
  travel: no sweep, no drawn rules, no scroll-linked position.
- Scroll-linked values are user-driven, never autoplay or looping. The review
  carousel is the one thing that advances by itself, under the rules below.
  The page-loading bar (Components and states) is the one loop, and it runs
  only for the length of a real wait.
- A highlight may use a single-colour `linear-gradient` only so its width can be
  animated; this and the select marker are the two permitted uses of the syntax.
- One mint highlight per headline at most. Teal stays one dot per image, marking
  what is next. Inactive steps on navy use the inverse-muted token, not opacity.
- `text-hero` (40–68px) is the home headline size; other pages start at display.
- The hero is a layered scene (see below). Its planes move by a few tens of
  pixels each with scroll, and a fine pointer leans the stage about three
  degrees. No pinning, no added scroll length, no pointer lock or capture.

### Public home liquid glass

The owner asked on 2026-10-13 for a liquid-glass environment on the home page,
with a LiquidButton as the reference. The flat surface rule is set aside there,
plus the public/auth site header (owner follow-up, 2026-10-13;
workspace separation, 2026-10-14).
The material is `.glass` in `site-shell.css`: a softened, tinted
backdrop, a lit rim, a contact shadow and a glint that follows the pointer.

- Glass is for layers that float above content: the shared header, the
  finder, the lesson tiles, the "What Learli looks after" card, the
  sample-review sheet, and the primary and outline actions. Reading sections stay solid.
- The shared header is transparent and spans the full viewport width. It takes on
  glass only once the page has scrolled beneath it (`data-raised`), because
  pinned labels over raw content cannot hold contrast. Without scripts it is
  transparent and scrolls away with the page.
- Every sheet has something of Learli's behind it to bend: the photographs, a
  stroke, or the page scrolling under the header. No gradient blobs, and no glass over an empty ground for its
  own sake.
- Text on glass must hold AA over anything on the page. Light sheets keep a
  white tint of at least 60%; sheets on navy stay dark with white text. Form
  fields inside a sheet stay solid white. The header is the one sheet that text
  scrolls beneath, so it carries an 80% tint and reads even if a browser fails
  to blur.
- Refraction (an SVG filter as the backdrop) is a Chromium-only enhancement,
  switched on by `GlassEffects`. Every other browser, and a page without scripts,
  gets the frosted sheet. Nothing may set `filter`, `opacity`, `mask`,
  `clip-path` or `isolation` above a sheet's backdrop layer.
- `prefers-reduced-transparency`, `prefers-contrast: more`, forced colors and
  browsers without `backdrop-filter` get solid surfaces with the same content.
- The header stays on screen only with scripts and a viewport at least 40rem
  tall, so enlarged text never loses the page to a fixed bar; the page sets
  `scroll-padding-top` to match. Kit radii are kept: 10px controls, 16px
  sheets. The stage tile uses the kit icon's own corner ratio.
- The reference's metal button and its other variants are not adopted.

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

**Page loading.** Pages await their data, so the page being left stays on
screen until the next one is ready. While that takes time, `NavigationProgress`
in the root layout draws a 3px bar along the top edge of the viewport, above
the header and the dock: a brand-teal run crossing a navy track, so it shows
over light and navy pages alike.

- It appears only after 150ms; a quick page shows nothing.
- It never fills up. How long is left is unknown, and it does not pretend to
  measure it.
- A polite live region says "Loading page…". The wrapper is not
  `role="status"`: it is on every page, and pages keep that role for their own
  messages.
- Reduced motion draws it still, teal above a navy line. Forced colours use
  system colours.
- It is set by the router's own navigation, so it cannot outlast one. Without
  scripts nothing is drawn and the browser shows its own loading state.
- A link that already says what is loading ("Loading your bookings…") keeps its
  words; the bar is in addition.

## Layout patterns

### Public marketing site

Paper first viewport with a large navy heading and one mint phrase highlight.
From 80rem the headline runs wide in two lines with the factual introduction at
its right; below it the layered hero scene takes centre stage with the real
finder or honest inventory state as a glass card at its right. One mint stroke,
the headline's highlight carried on, crosses the whole viewport at a five-degree
rise: behind the small photograph, through the main one between the room and
the learner, under the glass finder and off the right edge. It is drawn left to
right on load. The one teal dot is a stop on that line before the finder, ringed
in paper so it reads against the mint, and it moves along the line as the hero
scrolls away (wide screens only). The stroke is the single graphic allowed to
cross a photograph, and it always passes behind the person in it. It never runs
under text: where the words sit beside the scene it starts behind the far card.
Between 64rem and 80rem the words and finder stack beside the scene; on phones
the order is headline, words, finder, scene. Keep the finder/next action easy to reach.
Actual tutors/subjects may appear only from current eligible catalog data.

The home page then runs: real tutors when listed; the subject and learner-level
index from the current catalog, each row a real directory filter; the navy
three-step sequence (`#how-it-works`); what Learli looks after versus what the
tutor looks after, as a layered scene (below); and two closing doors
(Find a tutor / Get matched, and Become a tutor). Find a tutor, Get matched, Become a
tutor and Report a concern stay reachable in every catalog state. Use ruled
lists rather than cards. No stats, fake cards, prices, counts, verification
claims, large dead-end hero, or testimonials presented as genuine.

### Learli arranges the lesson: the layered scene

The owner removed the earlier day and night diptych, found the section plain
without it, and asked for a design. The lesson is a photograph in the middle;
"What Learli looks after" is a liquid-glass card over its left edge and "What
your tutor looks after" a solid navy card over its right, so the heading is
also the picture: Learli, the lesson, your tutor.

- From 64rem the three sit in a row with the cards overlapping the photograph
  by 4.5rem, the glass card low and the navy card high. From 40rem the cards
  sit side by side over the photograph's foot; on phones they stack beneath it.
  Source order is picture, Learli, tutor.
- The cards hold text, so they never move. Depth comes from the overlap and from
  the photograph drifting a few percent inside its frame with scroll and a fine
  pointer, which also slides the picture under the glass.
- The cards are in normal flow and grow with their words; nothing is positioned
  over a fixed-height stage.
- The glass card carries a 72% tint because it holds a list.
- The introduction is in Lexend, as in the section above.

### Content on the pages in the navigation

On 2026-10-14 the owner asked for content on each page in the navigation, with
the landing page as the reference. Find a tutor, Get matched, Subjects and
Become a tutor each carry a guide (`src/features/home/page-guides.tsx`) built
from the landing page's blocks and loaded with its stylesheet.

- A guide sits under the page's working area (the directory, the matching
  questions, the catalog, the application) and never replaces or restyles it.
  It adds no page heading, form, alert or status region, so each page keeps the
  structure its browser tests rely on.
- Blocks: the navy line with three glass tiles (`StepsLine`), the photograph
  with a glass card and a navy card (`LayeredScene`), a highlighted heading
  beside a ruled list (`Facts`), and two closing doors (`TwoDoors`).
- On these pages the line rises to the right, as in the hero, and the steps
  read left to right as they climb it. The landing page keeps its own
  arrangement.
- A tile shows a number only where the order is information: the three matching
  questions. The directory's steps use the lesson glyphs. Nothing else is
  numbered.
- Every sentence describes what the product does today. No prices, counts,
  results, reviews or verification claims, and nothing about tutor pay.
- The directory and matching carry no photographs, because that is where real
  tutors appear.

### Sample review carousel

The owner asked on 2026-10-13 for a testimonials section with the animation of
21st.dev's "circular testimonials" and natural placeholder messages "for now".
Learli has no published reviews, and PUB-01 allows no invented ones in public,
so the section is preview content:

- It sits between the "what Learli looks after" section and the closing doors,
  and renders only where `APP_ENV` is development, test or staging
  (`previewContentAllowed`). In production, or with the variable unset, the
  page has no review section at all.
- It carries a visible "Sample reviews" tag and the sentence "Written for this
  preview. They are not from Learli customers." Do not remove either while the
  content is sample content.
- The quotes in `sample-reviews.ts` name nobody and use no numbers, prices,
  results or verification claims; each describes something the product already
  does. Speakers are roles, because Learli publishes no reviewer names.
- Pictures are faceless crops of the hero photographs (hands, notebooks). A face
  is never shown beside a quote.
- Real reviews may replace them only from the review-publication feature, once
  its policy is approved; then the tag goes and the sample file is deleted.
- Motion follows the reference: three pictures in a shallow 3D arc that swing
  round with an overshoot (800ms), and the quote arriving word by word out of a
  blur. Learli's own parts are the mint sun behind the stack, the quote on glass
  in Literata, and the kit icon travelling along the track.
- It changes by itself, at the owner's request with no pause button and one
  control, Next. A review stays up for 6 seconds, as requested by the owner on
  2026-10-13. The clock runs only while the
  carousel is on screen in a visible tab; a review stays put while a pointer
  rests on it or keyboard focus is inside it, then for 2.5s more. Next moves on
  at once and the automatic change carries on. Reduced motion turns the
  automatic change off and makes Next instant. Without scripts every review is
  listed and there are no controls.

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

### Dedicated workspace navigation — 2026-10-14

The owner approved same-tab dedicated role workspaces, explicitly without the
landing navbar, mobile marketing dock or any footer. A solid white sidebar on
desktop and a compact topbar use existing navy/teal tokens. On mobile a labelled
Workspace menu expands in document flow, supports keyboard access and restores
focus on Escape. Role selection and navigation close the chooser; the mobile
menu closes on link activation, with focus returned to its trigger. The topbar shows the full wrapping account name and current
role; long names and enlarged text can grow it rather than being truncated.

Role navigation uses the existing guarded account endpoint. Explicit granted
role routes select the workspace; same-document shared account/bookings/learner/
support navigation retains that selected role. A sole actual grant resolves a
direct shared entry; a fresh ambiguous multi-role entry remains Your account.
Role context is in memory for this provider user/session only, never permission
or durable browser storage. A new document renders the full sidebar and name at
first paint from the server's guarded account read (no partial sidebar). Each
later destination rechecks the guarded account GET; the name and links stay
visible during that wait and during provider refreshes of the same session, so
nothing flickers. The public header keeps the signed-in chip while it re-checks.
Provider errors, identity/session changes, denied account reads and revoked
grants invalidate evidence. The sidebar owns role links, including
on tutor leaf pages; contextual prerequisite and recovery actions remain.
Account settings, existing Sign out, Visit website and safety reporting remain
reachable. Parent/student accounts keep Find a tutor. The workspace shell owns
role navigation, replacing duplicate family/tutor/admin page navigation. Public
header stability and auth document boundaries remain intact. See the dated
workspace-shell decision and M1.5 blueprint; execution evidence is separate.

### Booking and availability

Who, what and when stay visible together: tutor, authorized learner, subject,
actual date/time/zone, duration and status. Keep LessonTime and existing chronology,
filter scopes, pagination, lifecycle history, private links and real actions.
Availability controls retain keyboard/native operation and correct pending/error
behavior. No calendar invention or business-policy change from branding.

## Footer

Redesigned on 2026-10-13 at the owner's request (the earlier one was a logo and
a loose list). It is shared by public marketing and auth pages: a flat navy reading surface below
the landing page's diagonal accent, with no glass.

- Left: the reverse wordmark (7rem, then 9rem), the tagline in the headline
  size with the mint highlight on "personal.", and the one-line descriptor.
- Right: the same seven destinations as before under three plain labels
  (Learli, Help, Policies) in one `nav` named "Footer navigation". Links are
  44px targets. Policy links keep the word "draft". Do not add destinations
  that repeat the header's (Find a tutor, Sign in and so on): browser tests
  find those by name.
- A closing bar under a hairline: "Learli is a tutoring marketplace. Tutors
  teach independently." and a "Back to top" link to `#main-content`, which
  works without scripts.
- No copyright line, company name, address, social links or newsletter: the
  legal identity is an open decision and none of those exist. Add them only
  when the owner supplies them.

On public/auth pages, the shared footer's first element (`.site-footer-accent`) cuts its
top edge on the hero's five-degree diagonal: a navy wedge that joins
the footer, with the hero's mint stroke lying along it and its teal stop. The
stroke is drawn on arrival and the stop travels up it as the page ends. The
accent and its styles load from the root layout, including on direct visits.

## Navigation, icons, assets and imagery

Use original SVGs under `public/brand/`, byte-identical to kit exports. Primary on
white/paper, reverse on navy; no typed placeholder, distortion or recoloring.
Use the kit icon for browser metadata, never beside the wordmark. Respect clear
space and minimum size. Home links have a clear accessible name. Desktop and
mobile navigation keep all current real destinations and visible focus. On
public/auth pages, the shared header is transparent and full width, turning to glass
on scroll. Use the existing Lucide library for functional icons only. No emoji
icons or decorative icon tiles.

Page titles, descriptions, canonical addresses and share data come from
`src/lib/seo/metadata.ts`; a page states only what is true of it and names no
price, rating, count or credential. The share image is the reverse wordmark on
navy (`src/app/opengraph-image.tsx`), never a photograph. Search indexing stays
closed until launch; see
`docs/decisions/2026-10-14-search-indexing-and-seo.md`.

### Small-screen dock

On 2026-10-14 the owner asked to replace the burger menu on mobile with a
modern floating bottom navigation. Below 64rem the main navigation is a dock
(`.site-dock` in `site-shell.css`, rendered by `site-header.tsx`): a glass bar
floating 12px above the foot of the screen, at most 26rem wide. There is no
menu button and no dialog.

- Five tabs: Home, Find, Match, Subjects, Teach. Each is a Lucide icon over one
  word. The tab for the current page, or for the section a deeper page belongs
  to, is filled navy with white text and carries `aria-current`.
- Names come from the words, not from `aria-label`: "Find" is completed for
  assistive technology as "Find a tutor". Both navs are named "Main
  navigation"; styles display exactly one at any width.
- Below the wide breakpoint the top bar holds the wordmark and account control,
  and scrolls away with the page instead of staying pinned. A confirmed anonymous
  session shows Sign in; a signed-in session shows its display name and initials
  with a disclosure for Account settings and Sign out. Pending, refetching and unavailable
  session reads retain a native Account link, with checking or retry feedback.
  Every session state shares one responsive account slot. Desktop navigation is
  independently centered with stable link metrics, and branding/navigation stay
  top-aligned when a long name grows the header. Error/retry feedback appears on
  the existing solid account-panel surface without resizing the bar.
  The same control appears on desktop. Names wrap; enlarged text can move the
  control onto its own header row and the full name below initials/chevron.
  The closed disclosure exposes
  no duplicate logout action. Escape restores focus, and outside pointer/focus
  departure closes it. Disabling the pending Sign out button does not dismiss
  its disclosure or discard failure feedback. Navigation revalidates session presentation, including
  names saved through account settings; provider focus/online/cross-tab refresh
  remains in use. This display grants no permissions and stores no identity.
- When five words do not fit (about 320px, or enlarged text) the current tab
  keeps its word and the others show icons only; at very large text all five
  are icons. Hidden words stay available to assistive technology. The row
  never widens the page.
- Targets are at least 44 by 52px. The footer pads its foot and the page sets
  `scroll-padding-bottom`, so nothing rests or receives focus under the dock.
- The dock steps aside while a text field has focus, and is not printed.

Photography of real learners and tutors remains absent until rights/consent and
actual assets exist. The kit's imagery board rules out stock and generated
faces, and that stays the standard. The kit's [PHOTO] frames are not production
media. No uploaded tutor-photo feature or storage service is introduced.

**Owner exception, 2026-10-13: illustrative hero photographs.** The owner asked
for images of students in the home hero, then for the image to look "HD and in
3D" using the scroll-craft skill. Until consented photographs of real lessons
exist, the hero carries AI-generated photographs in `public/home/`; that
folder's README records what they are and how they were made.

The lead photograph is built as a layered scene after scroll-craft's hero-depth
method (`src/features/home/hero-scene.tsx`): a clean plate of the room, and the
learner with her desk as one cutout in front of it, her head breaking the top
of the frame. A second learner sits on a card behind and a worked problem on a
card in front. This sets aside the kit's "no cut-outs" line for this one scene:
the cutout is composited back into its own room, never onto a blank ground or a
shape. Things that touch stay on one plane, so nothing she holds can slide.
With scripts off or motion reduced the scene is the same composition, still.
Photographs are served at quality 90. Rules:

- On the home page: the hero, and one photograph of its own between the two
  lists in "Learli arranges the lesson". On Subjects: a still life with no
  person in it. On Become a tutor: one generated adult teaching at a desk.
  Never on the tutor directory, matching, tutor profiles, reviews or any place
  where a picture would stand for an actual person; those keep initials
  avatars.
- They follow the kit's own art direction: daylight, eyes on the work, brand
  colour from objects in the room, no tint or overlay, rectangular 12px frames.
- They depict no real person and no actual Learli learner, tutor or lesson. Alt
  text describes the scene and never says otherwise; no caption, name, quote,
  credit or testimonial may be attached to them.
- Laptop screens face away, so no meeting software or lesson content is shown.
- Replace them with consented photographs of real lessons when the owner has
  them. Whether to label them as illustrative for a public launch is the
  owner's decision and is not yet made.

The home page instead uses original vector artwork in `src/features/home/`,
drawn from the wordmark's geometry (square stems, round dots, rings) in existing
tokens: the lesson glyph. It is inline SVG, not a raster or a stored asset. It
depicts no actual tutor, learner, lesson time or inventory, and must not be
mistaken for evidence of any. It never redraws, recolors or animates the
wordmark or icon files themselves. An earlier "same table, two places" diptych
(a learner in daylight and a tutor at night) was removed at the owner's request
on 2026-10-13; do not bring it back.

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
reduce enlarged type or hide overflow to make a viewport check pass.

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

An explicit visit-zone choice is stored in sessionStorage and, since the owner's
2026-10-14 performance repair, a non-sensitive session cookie. A client initializer
records the visit/browser IANA zone before profile navigation. Server precedence
is explicit URL choice, current signed-in account zone, validated visit cookie,
then tutor fallback; this avoids a second page request when the visit zone is
already known. Higher-priority choices skip unnecessary fallback reads. Invalid
cookies are ignored; they never set account or booking authority. The server/no-JS
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


Sidebar refresh detail: a selected role enum may survive an ordinary provider
refresh within the same user/session, but no name or granted-role links display
until fresh guarded account data validates it. Error/denial and identity/session
changes clear the context. Shared booking current-page markers require the exact
matching scope; query scope never grants or selects an arbitrary workspace.
