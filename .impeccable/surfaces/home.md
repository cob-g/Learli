# Public home page

Targets: src/app/(marketing)/page.tsx, src/app/(marketing)/home.css, src/features/home
Mode: Persuade. Extends the brand-kit-ui world; it does not replace it.

## Direction contract

THESIS: A lesson is two people, one time and one link. The page shows that
coming together, using the kit's own two devices: one highlight for the words
that matter and one teal dot for what is next.

OWN-WORLD: Brand kit 2.0 unchanged: paper, white and navy, Lexend and Literata,
flat bordered surfaces. Motion and artwork are assembled from the wordmark's
parts (square stems, rings, round dots). At the owner's request the hero also
carries three illustrative, AI-generated photographs, art-directed to the kit's
imagery board and standing in until consented photography of real lessons exists.

STORY: Find a tutor (photographs, then the real finder or honest state) → what
you can study and at which level → how a lesson comes together → what Learli
looks after and what the tutor looks after (a lesson photograph with a glass
card over one edge and a navy card over the other) → sample
reviews (preview environments only, labelled) → two doors → the close: the
hero's mint stroke lying along the footer's diagonal top edge.

FIRST VIEWPORT: A transparent full-width header, then a wide two-line navy
headline with its mint highlight drawn on load and the introduction at its
right. Below, at centre stage, a layered scene built with scroll-craft's
hero-depth method (a room, a learner whose head breaks the frame, a card behind
and a card in front) with one mint highlighter stroke crossing the whole
viewport through it, behind the learner, and a teal stop on the line.
The real finder or honest inventory state sits beneath as a full-width bar, in
view on a laptop screen. Phones read words, finder, photographs.

SIGNATURE INTERACTION: On the navy stage the kit icon's parts rearrange as the
reader scrolls the three steps: a lens, a clock, then two people under one arc,
with the teal dot moving from "found" to "the chosen hour" to "the lesson". Each
step has its own glass tile, and the hero's layered stroke returns in blue: it
falls to the right across the whole viewport, the mirror of the hero's, behind
the three tiles; the steps climb it from Find at the bottom right to Meet at
the top left,
and each glyph assembles as the stroke reaches it. On phones each step's tile
has its own stroke.

GLASS: At the owner's request the page is a liquid-glass environment: one
`.glass` material for floating layers only (header, finder, stage tile, caption
plate, actions), each lying over Learli's own material so there is something to
bend. Reading sections stay solid. Refraction is a Chromium enhancement over a
frosted sheet; transparency and contrast preferences get solid surfaces.

MOTION GRAMMAR: highlight is drawn, rules are ruled, the dot travels, parts
rearrange. Nothing else moves. Markup is complete without scripts; reduced
motion keeps every state and removes the travel.

TRUTH: No prices, counts, statistics, reviews, testimonials or verification
claims. Artwork depicts no real tutor, learner, lesson time or inventory.

FINISH: two inspection rounds per change (1440, 1820 and 390 wide; then reduced
motion, no scripts, 320 and doubled text), the tutors-listed state rendered in a
harness, a detector run per change, DESIGN.md and sidecar updated.
The independent finish review was not run; see the progress tracker.


Owner follow-up, 2026-10-13: the transparent/glass header and diagonal footer
close are now shared across all routes through the root layout. Material lives
in `src/components/shared/site-shell.css`; `GlassEffects` owns refraction/glints
and `FooterAccent` owns the close. The sample carousel advances every six
seconds, retaining hover/focus holds and reduced-motion behavior.
