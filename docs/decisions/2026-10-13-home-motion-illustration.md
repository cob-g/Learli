# Authored motion and original illustration on the public home page

On 2026-10-13 the owner asked for a more engaging, professional landing page:
"add some design professional design and motion", "use images if you can",
"add some information based on the repo requirements", then "add some scrolling
animation, I just want you to be completely fully creative on this", while
keeping the Impeccable rules. This is the owner's explicit decision to lift two
limits that `context/ui-context.md` 2.0 placed on the public marketing site:
motion restricted to short state transitions, and no illustration.

## Decision

The public home page (`src/app/(marketing)/page.tsx`) may carry authored,
scroll-linked motion and original vector illustration. Every other surface keeps
the 2.0 rules. Brand kit 2.0 stays the visual identity: same palette, Lexend and
Literata, flat bordered surfaces, original wordmark files untouched.

The motion and artwork are built from the kit's own sentence, "the wordmark,
Navy, one highlight and one dot": a drawn mint highlight, ruled hairlines, a
step rail, and the kit icon's parts rearranged for each of the three steps.
`context/ui-context.md` 2.1 holds the working rules.

## Imagery, first pass: illustration instead of photographs

The request allowed images "if you can". The kit's imagery board says
"Photograph actual learners and tutors, with consent. No stock smiles, no
generated faces", and no consented photography exists. The first pass therefore
used no photographs, as in the brand-kit decision, and drew original inline SVG
from the wordmark's geometry instead. It depicts no
real tutor, learner, lesson time or inventory. The two-places diptych sits in
the kit's 12px image frame and should give way to real, consented lesson
photography when the owner has it.

## Follow-up the same day: illustrative photographs in the hero

After seeing the illustration-only page, and having been told why no photographs
were used, the owner asked: "I want you a to add a images on it, to make it more
real like an images of students in the hero section of the landing page." That
is an explicit owner decision to set aside the kit's "no generated faces" line
for the home hero, since no consented photographs exist to use instead.

The hero now carries three AI-generated photographs (a learner at a desk, a
college-age learner at a kitchen table, hands working an algebra problem), made
with the owner's Higgsfield account for 8.25 credits. Provenance, job IDs and the
replacement instruction are in `public/home/README.md`. The illustration moved
down to close the "what Learli looks after" section.

Generated rather than stock: stock photographs of identifiable young people come
without a model release Learli could rely on, and a generated image uses no real
person's likeness. The limits in `context/ui-context.md` 2.2 keep them out of
anywhere a picture would stand for an actual person, and forbid captions,
names, quotes or credits that would present them as real Learli learners.

Still open, and the owner's to decide before a public launch: whether to label
the photographs as illustrative, and when to replace them with consented
photographs of real lessons. This follow-up approves presentation only.

## Second follow-up the same day: liquid glass

The owner then asked for "an environment of liquid glass" on the landing page,
pasting a `LiquidButton` component as the reference for the look and asking for
it to be combined with the current UI. That is an explicit owner decision to set
aside the flat surface rule ("no glass, no card shadows") on the public home
page only.

The reference was used as a reference, not installed. Its technique (a softened
backdrop bent through an SVG displacement filter, inset rim shadows, a clear
body that scales on hover) was rebuilt as one `.glass` material in Learli's
tokens and radii. Its metal button and generic button variants were not added,
and no dependency was introduced.

Where it is used: the header on the home page, which now floats and stays on
screen; the finder, laid across the foot of the photographs with the
illustration's sun and dot behind it; the stage tile around the lesson glyph;
the illustration's caption plate, across the day/night seam; and the primary and
outline actions. Reading sections stay solid.

Limits recorded in `context/ui-context.md` 2.3: text on glass holds AA over
anything on the page; refraction is a Chromium-only enhancement and every other
browser gets a frosted sheet; reduced transparency, higher contrast, forced
colors and missing backdrop filters fall back to solid surfaces; the header only
stays fixed when the viewport is tall enough. The shared header component gained
a home-only variant; on every other page it is unchanged.

Not measured: scroll performance on low-powered devices. Backdrop filters cost
more than flat fills, and the refraction filter more again. Not seen: the
frosted sheet in real Safari or Firefox. The headless WebKit and Firefox test
engines here do not render any backdrop filter, so those captures only confirm
that the page stays legible when the blur is missing.

## Third follow-up the same day: scroll-craft and a layered hero

The owner asked to install the skill at
`https://github.com/nateherkai/scroll-craft` and to use it "specially in the
hero section", with the image looking "HD and in 3D".

The skill was read and its scripts audited before installing. It is MIT
licensed; its scripts check tools, serve files locally and take screenshots,
and the one script that makes network requests calls kie.ai and only runs with a
key Learli does not have. It is installed unmodified at
`.claude/skills/scroll-craft/` (version 0.3.1, commit `75d81f7`), linked for
Codex, with its source recorded in `SOURCE.md`. Its workspace is `scrollcraft/`.

What was used is its hero-depth method and layer contract, recorded in
`scrollcraft/builds/learli-home-hero/BRIEF.md`. The lead photograph became a
scene of separate planes: a clean plate of the room and the learner with her
desk as one cutout, plus a card behind and a card in front, moving at their own
rates under scroll and a fine pointer. Two more images were generated for it
with the owner's Higgsfield account (about 6 credits): the cutout and the plate.

What was not used: the skill's standalone engine, its whole-page grammar and
fingerprint gate, and kie.ai. The page already exists in Next.js under Learli's
design system, and the skill itself says to preserve the framework and write
page-specific choreography in page-local code. No dependency was added.

This sets aside the kit's "no cut-outs" line for the hero scene only, by owner
decision; `context/ui-context.md` 2.4 records the limits. `next.config.ts` now
allows image quality 90 for these photographs.

## Fourth follow-up the same day: transparent header and a new hero layout

The owner asked whether the navigation bar could be transparent, with its
elements "outside of the padding like the whole vw", and for a different hero
layout that keeps the layered scene ("I really love that, maintain that").

The header on the home page is now transparent and spans the viewport. One
limit was kept: once the page scrolls beneath a pinned bar, a fully transparent
one cannot keep its labels readable, so it takes on glass at that point and is
clear again at the top.

The hero is now a wide two-line headline with the introduction at its right, the
unchanged layered scene at centre stage, the finder as a glass card at its
right, and a mint table band across the full viewport width beneath. The
finder form went back to its original stacked layout, so
`tutor-filter-form.tsx` is unchanged from `main`.

## How a lesson comes together, revised at the owner's request

The owner liked the glass tile and its icon transitions but not the ring and
dot behind it, nor the line that filled beside the steps on scroll, and asked
for something more unique. The shapes behind the tile and the rail are gone.
The tile now fills with mint liquid as the lesson comes together, and on wide,
tall screens the three steps roll past it like a time-picker wheel, which
echoes the step about choosing a time. The step being read is never tilted or
blurred. No dependency was added.

The owner then found that version odd on scroll and asked for the hero's
layered line here instead, in blue with white elements. The liquid, the pinned
tile and the tilting steps were removed. The section now has one blue stroke
across the viewport passing behind three glass tiles, a stop on the line,
and icons that assemble once as the stroke reaches them. The blue is navy
lifted toward white in its own hue, used for this stroke only. At the owner's
further request the stroke runs the opposite way to the hero's (top left to
bottom right), and its stop copies the hero's size and ring exactly, in navy
with a white ring.

## Two-places illustration removed

The first pass drew a "same table, two places" diptych (a learner in daylight, a
tutor at night) in place of photographs. Near the end of the day the owner said
they did not like that comparison, and it was removed with its glass caption.
The fact it illustrated stays on the page as a list item: "Dated lesson times,
in your time zone".

The owner then found the section plain and asked for a design. It became a
layered scene: a lesson photograph in the middle with a liquid-glass card for
what Learli looks after over one edge and a navy card for what the tutor looks
after over the other. It first reused the hero's kitchen picture; the owner
asked for a different image, so one more was generated with the owner's
Higgsfield account (about 3 credits): a parent and a young learner at a table
with a laptop. It depicts a generated adult and child and follows the same
limits as the other photographs. The photograph rule now covers this one use
as well as the hero.

## Content on the pages in the navigation (2026-10-14)

The owner asked for content on each page in the navigation, using the landing
page as the reference. Find a tutor, Get matched, Subjects and Become a tutor
each gained a guide beneath their working area, built from the landing page's
blocks. The directory, the matching questions, the catalog and the application
are unchanged.

This extends two home-only allowances to those four pages by owner request:
the landing page's motion and glass, and photographs. Two photographs were
generated with the owner's Higgsfield account (about 6 credits): a still life
for Subjects and a tutor at a desk for Become a tutor. The directory and
matching carry none, since that is where real tutors appear. The tutor in the
photograph is generated and represents no Learli tutor; whether to keep a
person's picture on the recruitment page is the owner's call.

The copy states only what the product does today, and says nothing about tutor
pay, prices or lesson terms, which remain open decisions.

## Small-screen navigation: a floating dock instead of a menu (2026-10-14)

The owner asked: "I don't want the burger bar. I want a bottom floating
navigation that is modern right now." Below the wide breakpoint the Menu button
and its side dialog are removed, and the main navigation is a glass dock
floating at the foot of the screen with five tabs: Home, Find, Match, Subjects
and Teach.

Two choices were made with it. Home was added, and the top bar now scrolls away
on small screens instead of staying pinned, so a phone carries one fixed bar
and not two. Sign in stays in the top bar.

Three browser tests opened the old menu; they were rewritten for the dock but
could not be run here.

## Footer redesigned

The owner found the footer plain and unprofessional and asked for a design. The
shared footer now has the wordmark and tagline on the left, the same seven
links under three labels on the right, and a closing bar with a Back to top
link. It stays flat on every page. On the home page only, the page ends with
the hero's mint stroke lying along a diagonal cut into the footer's top edge.

Nothing was invented to fill it: no copyright line, company details, social
links or newsletter, because the legal identity is still an open decision and
those things do not exist. No destinations were added, because browser tests
find header links such as "Sign in" by name and a duplicate in the footer could
change which one they reach.

## Hero green, revised at the owner's request

The owner did not like the placement of the hero's green (a flat mint band under
the scene, with a teal dot beside it) and asked for something more unique. It is
now one mint highlighter stroke across the viewport, drawn on load after the
headline's highlight. It passes behind the small photograph, through the main
photograph between the room and the learner, and under the glass finder. The
teal dot became a stop on that line that travels with scroll. This is the one
graphic that crosses a photograph; the kit's "no overlays" line is set aside for
it, by owner decision, on the condition that it stays behind the person.

## Fifth follow-up the same day: a sample review carousel

The owner asked to add testimonials with the animation of the 21st.dev
"circular testimonials" component in Learli's theme, and "for now just use some
natural placeholder for the message".

This touches an agreed boundary: PUB-01 says no invented reviews appear, the
review policy is still open, and invented testimonials shown to the public as
genuine would mislead the families Learli is for. The request was for
placeholder content, so it was built as preview content that cannot reach the
public: the section renders only where `APP_ENV` is development, test or
staging, and it is visibly tagged "Sample reviews" with a plain sentence saying
the quotes are not from Learli customers. In production the page has no review
section. PUB-01 therefore still holds for the public site, and no PRD change
was made.

The sample quotes name nobody, use roles as speakers, and say only things the
product already does. Their pictures are faceless crops of the existing
photographs, so no generated face is presented as a reviewer.

The reference's source needs a 21st.dev API key and was not downloaded. Its
animation was rebuilt in CSS from how the component behaves; its two
dependencies (framer-motion, react-icons) were not added.

The owner then asked to remove the play/pause button, keep only Next, and have
it change by itself slowly enough to read. It now has one control, Next. Each
review stays up in proportion to its length (2.5s plus about a third of a
second per word), the automatic change carries on after Next is pressed, and a
review stays put while a pointer rests on it or keyboard focus is inside it.
With no pause control, someone on a touch screen who needs longer than that has
no way to stop it short of holding a finger on the card; reduced motion still
turns the automatic change off.

Still the owner's to decide: when real reviews exist and the review policy is
approved, they replace the samples and the tag comes off.

## Content added

All of it restates existing approved copy or implemented behavior: the four
learner levels as directory filters, the three steps, matching by subject, level
and available time, times in the viewer's zone, the availability recheck at
booking, meeting details held with the private booking, who arranges lessons,
the route to report a concern, and Learli's boundary (it arranges; the tutor
teaches on Zoom or Google Meet). PUB-01's entry points (Find a tutor, Get
matched) are now present in every catalog state.

Nothing commercial or gated was added: no prices, trials, counts, statistics,
reviews, testimonials, verification or safety guarantees, and no claim that
booking is open. The honest "No tutors are listed right now" and "Tutor search
is unavailable" states are unchanged.

## Alternatives considered

- Stock or AI-generated photographs of learners and tutors: rejected by the
  kit's own imagery rule, and they would present invented people on a service
  for minors.
- A motion library: unnecessary. CSS transitions, two IntersectionObservers and
  one passive scroll listener cover it; no dependency was added.
- CSS scroll-driven animations alone: not yet available in every supported
  engine, and the attribute approach degrades to complete static markup.

## Risks and limits

Scroll-linked motion must never hide content: the server markup is complete,
and only an element still below the viewport is ever withheld. Reduced motion
keeps each state and removes the travel. The single-colour gradient used to size
the highlight is a technique, not a visible gradient; decorative gradients stay
prohibited. This decision changes presentation only. It approves no product
capability, policy, launch or deployment.

## Shared navigation/footer and six-second reviews

The owner requested the landing page navigation and footer on all pages,
including tutors and get-matched, and a six-second automatic review interval.
This extends the existing full-width transparent/glass header and the footer's
angled mint stroke and scroll motion to the shared root shell. Page content
retains its existing styling. Shared material, refraction and footer motion
load independently of the homepage. Hover/focus holds, hidden-tab/offscreen
pauses, reduced motion and sample-review publication restrictions are retained.
