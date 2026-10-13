---
name: Learli
description: The implemented Learli brand kit 2.0 interface for tutor discovery and lesson coordination.
colors:
  brand-navy: "#1e2a78"
  brand-navy-hover: "#192260"
  brand-navy-active: "#131a3d"
  accent-primary: "#2eccb0"
  brand-mint: "#a7dccb"
  accent-strong: "#0a7566"
  bg-base: "#f5f8f6"
  bg-surface: "#ffffff"
  bg-subtle: "#e6ece8"
  border-default: "#c9d3ce"
  border-control: "#55605d"
  text-primary: "#131a3d"
  text-muted: "#55605d"
  text-inverse: "#ffffff"
  text-inverse-muted: "#c9d3ce"
  focus-ring: "#0a7566"
  focus-ring-inverse: "#ffffff"
  state-success: "#0a7566"
  state-success-soft: "#e6ece8"
  state-warning: "#8a5300"
  state-warning-soft: "#fff4dd"
  state-error: "#b42318"
  state-error-soft: "#fef1f1"
  scrim: "rgb(22 32 77 / 0.5)"
typography:
  display:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "clamp(2.25rem, 1.833rem + 2.083vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.07143
    letterSpacing: "-0.025em"
  headline:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "clamp(1.75rem, 1.583rem + 0.833vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "0"
  section-title:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "0"
  item-title:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "0"
  lead:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: "1.75rem"
    letterSpacing: "0"
  reading:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: "1.875rem"
  body:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.625rem"
    letterSpacing: "0"
  prose:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.625rem"
    letterSpacing: "0"
  action:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "0"
  time:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "0"
  label:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "0"
  label-strong:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    letterSpacing: "0"
  small:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "0"
  caption:
    fontFamily: 'Lexend, "Avenir Next", Verdana, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.125rem"
    letterSpacing: "0"
rounded:
  check: "0.25rem"
  tag: "0.375rem"
  control: "0.625rem"
  surface: "1rem"
  overlay: "1.125rem"
  full: "calc(infinity * 1px)"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
  "12": "3rem"
  "16": "4rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.brand-navy-hover}"
  button-primary-active:
    backgroundColor: "{colors.brand-navy-active}"
  button-outline:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.brand-navy}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-outline-hover:
    backgroundColor: "{colors.bg-subtle}"
  button-inverse:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.text-primary}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-inverse-hover:
    backgroundColor: "{colors.bg-subtle}"
  button-destructive:
    backgroundColor: "{colors.state-error}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-disabled:
    backgroundColor: "{colors.bg-subtle}"
    textColor: "{colors.text-muted}"
  field:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
  native-select:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.5rem 2rem 0.5rem 0.75rem"
  nav-link:
    textColor: "{colors.brand-navy}"
    typography: "{typography.label}"
  status-tag:
    backgroundColor: "{colors.bg-subtle}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "0 0.5rem"
  choice:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1rem"
  choice-selected:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.text-inverse}"
  panel:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.surface}"
    padding: "1.5rem"
---

# Design System: Learli

## Overview

**Creative North Star: "Paper, navy and one useful signal"**

Learli's implemented brand kit 2.0 combines a paper ground, white working surfaces,
navy hierarchy and a restrained mint phrase highlight. Lexend makes the interface
direct and readable; Literata gives longer explanations and tutor biographies a
distinct reading voice. The original wordmark supplies the identity rather than
a newly drawn logo or decorative imagery.

The same flat materials carry public discovery, account forms and private lesson
coordination. Borders and spacing group work; native controls expose real choices
and current state. Synthetic testing notices, unavailable states and policy draft
labels remain visible. This is a derived reference for the current implementation,
not evidence of release, completed browser verification or real-user readiness.
Canonical authority remains [UI context](context/ui-context.md) and the product,
architecture and PRD documents referenced by [PRODUCT.md](PRODUCT.md).

**Key Characteristics:**

- Paper and white surfaces with navy hierarchy.
- Lexend interface and explicit Literata reading passages.
- Flat bordered panels and native accessible controls.
- Mint highlights and small teal selection signals.
- Truthful states, readable lesson details and responsive wrapping.

## Colors

The palette pairs cool navy ink with warm green neutrals; the frontmatter resolves
the actual CSS aliases without introducing another theme.

### Primary

- **Navy:** Headings, primary actions, current navigation and selected choices.
  Its hover shade is darker; the pressed primary action uses Ink.

### Secondary

- **Bright teal:** Original artwork and small selected-state dots; the inverse
  action uses it as a fill with Ink text.
- **Mint:** The home headline's phrase highlight and initials avatar fills.
- **Deep teal:** Underlined links, success text and focus on light surfaces.

### Neutral

- **Paper / White / Mist:** Page ground, working surfaces and neutral insets or hover.
- **Ink / Slate:** Body text and secondary text. Slate also defines enabled fields.
- **Stone:** Panel borders and disabled select boundaries.
- **White / Stone on navy:** Inverse foreground and secondary inverse text.

### Semantic states

Success uses Deep teal on Mist. Warning retains its amber foreground and warm
background. Error uses Alert with the pale error background where a notice needs
a fill. Status text and functional icons communicate meaning alongside color.
The scrim is a translucent navy-toned native-dialog backdrop, not a brand tint.

**The Readable Signal Rule.** Bright teal and Mint are fills or accents on light
surfaces; body text and links use Ink, Navy, Slate or Deep teal. Never put white
text on Bright teal.

**The Surface Focus Rule.** Focus is a two-pixel outline with a two-pixel offset;
light surfaces use Deep teal, navy fields and checked matching choices use White.
Text selection also reverses between navy-on-white and white-on-navy contexts.

The sidecar's synthesized tonal ramps are preview strips only. They do not add
production colors or authorize gradients, tints or recoloring the supplied artwork.

## Typography

**Display and interface font:** Lexend, with Avenir Next, Verdana and sans-serif
fallbacks. **Reading font:** Literata, with Georgia and serif fallbacks.

Both are configured in `src/app/layout.tsx` with `next/font/google`: Lexend
normal weights (400/500/600), Literata normal and italic (400/500), display swap.
Next serves the generated font assets from the application; Literata is not
preloaded. Font synthesis is disabled. Labels and numbers use the interface font.

### Hierarchy

Display and headline are the two fluid roles. Page, section and item titles give
task pages a stable hierarchy; lead is the larger introductory interface copy.
Body and prose share the same Lexend role. Reading explicitly combines Literata
with the reading size. Action and time share the stronger interface treatment;
label, label-strong, small and caption provide secondary hierarchy. Exact sizes,
weights, line heights and tracking are in the frontmatter.

**The Two Voices Rule.** Use Lexend for headings, forms, names, dates and lesson
times. Apply Literata explicitly to longer explanations or biographies; the
`prose` size token alone does not switch font family.

Sentence case, left alignment and normal label tracking are the defaults. The
prose container is (34rem); actual measure also follows its available column.
Headings and important identifiers wrap. Directory biography excerpts are the
observed exception: they clamp to two lines before the full profile.

## Layout

The page shell is centered and full width up to (80rem), with horizontal gutters
of (1rem), then (1.5rem) from the small breakpoint and (2rem) from large. Standard
page spacing is (2rem) vertically, increasing to (3rem) at medium. Core spacing
steps are in the frontmatter; larger public sections also use (6rem).

Public home stacks introduction and finder, then uses two flexible columns at
large widths. Auth content centers at (36rem). Matching questions constrain the
working column to (42rem). Directory filters become a (18rem) sidebar at large;
admin work-area navigation becomes a (16rem) sidebar. Tutor and matching result
rows change columns at a container width of (48rem), rather than assuming that
the page viewport guarantees room inside a sidebar layout.

Headers and action groups wrap as content grows. Main content columns and fields
have zero minimum inline size where needed; fieldsets and legends stay within
their container. Actions allow their labels to wrap. Native time-zone and subject
selects occupy the available width. Lesson dates, times and zones remain visible
and wrap instead of being shortened. Narrow layouts stack sections; bounded
scroll regions are used for wide administrative tables.

## Elevation & Depth

Depth comes from White against Paper or Mist, thin borders and spacing. The
implemented floating and modal shadow tokens are `none`. The native confirmation
dialog and mobile menu use a dimmed scrim, not a cast shadow. Content appears
immediately. Shared actions use a short color transition (150ms); pending spinners
are limited by motion-safe or reduced-motion utilities where used. The declared
enter/exit curves are retained in the sidecar as source tokens, not evidence that
an entrance animation runs on every surface.

**The Flat Surface Rule.** Group work with borders, tonal surfaces and spacing;
do not add resting card shadows, glass or decorative elevation.

## Shapes

Controls use gently rounded corners; panels are rounder and native confirmation
dialogs slightly rounder again. Small tags and checkboxes have their own compact
radii, all recorded above. Circular shapes are used for initials avatars and
small active dots. Matching choices currently use the control radius, not pills.
Thin Stone borders separate panels and list rows; enabled fields use Slate.
Original logo geometry is not modified.

## Components

### Buttons

Primary actions are Navy with White labels; outline actions are White with Navy
text and a Navy border. The inverse variant is Bright teal with Ink text; its
hover becomes Mist. Destructive confirmation is Alert with White text and has no
separate destructive hover color in the current shared CSS.

Shared actions have minimum height (3rem), minimum width (2.75rem), no fixed
height, maximum width (100%) and wrapping labels. They use the control radius,
action typography, horizontal/vertical padding and hover variants recorded above.
Disabled shared actions use Mist, Slate and a Slate border with a not-allowed
cursor. Pending attributes and handlers remain behavior owned by each component.

### Chips and choices

Status tags are compact bordered labels with the tag radius and minimum height
(1.75rem); they are not pretend buttons. Success, warning and terminal states
have distinct text, background and borders plus actual labels/icons.

Native radio/checkbox choice rows use a visible (1.25rem) control and a wrapping
label. Checked matching rows become Navy/White with a small Bright teal dot.
Their inherited focus token becomes White, including focus on the native input.
Selection does not confirm a lesson.

### Cards / Containers

White bordered panels use the surface radius and padding of (1.5rem), often
increasing to (2rem) at small or medium widths. Dense history and directory
content uses rows and separators instead of a decorative card for every item.
Empty states use a heading, readable explanation and the applicable recovery link.

### Inputs / Fields

Fields are native controls on White with Slate borders, the control radius,
body typography, a minimum height of (3rem), and zero minimum width. Labels remain
visible. Placeholders use Slate at full opacity. The shared focus outline is
global and deliberately outside CSS layers so an outline-removal utility cannot
erase it. Error text/summaries retain their native validation and described-by
relationships; the shared field rule does not automatically recolor every
`aria-invalid` control.

Single-value native selects remove browser painting only to apply shared sizing
and two flat current-color triangles. Multi-selects/listboxes do not get this
marker. Disabled selects use Mist, Slate text and Stone borders. Forced-colors
mode restores native select appearance and uses system colors for inverse text
and focus.

### Navigation

Main navigation uses Navy interface labels with minimum (3rem) height; the current
page is stronger and underlined. Large-screen links appear from (64rem); below
that a named Menu button opens the native side dialog, capped at (20rem) and the
viewport width. Escape and focus return remain native/explicit behavior. Header
groups wrap with enlarged text. Footer navigation sits on Navy with White labels.
Admin current navigation uses Navy/White and a small teal dot with `aria-current`.

### Artwork and lesson details

`public/brand/` holds five original kit SVGs: primary, reverse, mono navy and mono
white wordmarks plus the icon. The current shared logo renders primary on light
and reverse on the footer; it is (6rem) wide, then (7rem) at small, preserving the
original aspect ratio. Home links are named “Learli home”; the icon is metadata
artwork, not a second mark next to the wordmark. Provenance is recorded in
`public/brand/README.md`. No photography or raster production asset is added.

Lesson details render server-formatted date, time and time-zone context together.
Normal time uses the time role; prominent time uses section-title. Synthetic
notices, actual state labels and private document boundaries remain part of the
interface and must not be removed for a cleaner screenshot.

## Do's and Don'ts

### Do:

- **Do** use the shared semantic colors and type roles from the implemented CSS.
- **Do** preserve original wordmarks and the icon, with reverse artwork on Navy.
- **Do** keep native controls, visible labels, focus and truthful state text.
- **Do** let actions, names, lesson times and time-zone context wrap on narrow or enlarged layouts.
- **Do** use borders and spacing to group work on White and Paper surfaces.

### Don't:

- **Don't** use Bright teal or Mint as ordinary text on a light surface.
- **Don't** add card shadows, glass, decorative gradients or invented imagery.
- **Don't** turn kit example practice sets, messages or progress screens into product functionality.
- **Don't** invent tutors, availability, reviews, prices or customer claims to fill a layout.
- **Don't** hide synthetic notices, policy drafts, private-data boundaries or booking state for visual polish.
