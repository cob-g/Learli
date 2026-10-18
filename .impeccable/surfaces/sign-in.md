# Sign in — reference composition

Target: src/app/(auth)/sign-in/page.tsx; src/features/auth/sign-in-layout.tsx;
src/features/auth/sign-in-companion.tsx; src/features/auth/sign-in.css;
src/features/auth/auth-form.tsx; src/features/auth/sign-up-footer.tsx;
src/features/auth/sign-up-footer.css; src/features/auth/auth-footer.tsx;
src/app/(auth)/layout.tsx; src/components/shared/public-shell.tsx.
Mode: Operate. Existing Learli world, owner-specified composition, code-led.

## Direction contract

THESIS: A returning user can sign in directly in an unboxed working form,
paired with the owner's navy tutoring panel rather than the previous auth card.

OWN-WORLD: Preserve Learli's Lexend/Literata, semantic Paper/White/Navy/Mint
palette, approved navbar and real account states. No raster asset is needed.

STORY: Welcome the account holder, collect credentials, provide real recovery
and verification links, then continue through existing safe authentication.

FIRST VIEWPORT: Beneath the unchanged navbar, a 420px form sits in the left half
and a rounded navy panel fills the right. Mint diagonal category ribbons and
an orb carry the reference's signature. Narrow/enlarged layouts prioritize form.

FORM: The owner's supplied standalone Sign In v2 HTML pins the direction and
composition; no seed or alternative-concept round applies. Keep existing help,
notices and the existing Create account compact footer, shared by the owner's
footer continuation. Show/Hide controls only password presentation.

MOTION CONTINUATION: The owner explicitly requests reference motion: hover lifts
the enabled submit 1px, advances the arrow 4px and softens its shadow; press scales
to .985. Two seamless ribbon rows drift in opposite directions over 38s/46s and
the orb bobs 8px over 6s. The latest owner continuation removes the decorative
motion button: a local controller freezes artwork within 4500ms of mounting,
retaining offscreen/hidden-tab gates and no restart after completion. Reduced
motion/no script retain the complete static design.
Only transforms/shadow animate; no layout, credentials or auth state is driven
by animation and no background transition crosses disabled/enabled states.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Implemented source record — 2026-10-17

Source: `src/features/auth/sign-in-layout.tsx`, `sign-in-companion.tsx`,
`sign-in.css` and the guarded sign-in reference presentation in `auth-form.tsx`.
The compact footer comes from retained `sign-up-footer.tsx`, its extracted
`sign-up-footer.css`, `auth-footer.tsx`, the auth layout and `PublicShell`.
Authority: **AUTHORIZED — build-feature delegation**, including the owner's
explicit motion continuation in `prompts/features/m1-05-signin-reference.md`
and the explicit request to use Create account's existing compact footer. The
latest owner continuation removes decorative controls on both auth pages and
supersedes the earlier manual-pause requirement.
This records source facts;
Review, browser inspection, test execution and release status are separate.

- The local grid is bounded at 90rem with 1rem inset/gap and 1:1.08 columns. The
  working form is unboxed and capped at 26.25rem (420px); notices and selected
  booking content may expand the normal document flow above the form.
- Existing Lexend and Literata italic, Navy/Paper/White/Mint/teal tokens remain.
  Local title/control/panel tokens in `DESIGN.md` describe this surface only:
  54px minimum inputs, 56px minimum submit, 14px control radius, 28px companion
  radius. Inputs use the existing stronger Slate control border and visible
  Deep teal focus. The submit's small Navy shadow is a local exception.
  The draft-policy row's 12px text is also local, not a shared type-ramp change;
  its links retain 44px minimum targets.
- Password recovery shares the label's visual grid row but follows the input
  in focus order. Show/Hide has a 44px target and Mint hover, changes only the
  input presentation and retains no credential value in React state. Submission
  conceals and clears the password before the real provider call.
- The enabled submit lifts 1px and gains a softer local Navy shadow on hover;
  its arrow travels 4px and press scales to .985. Transform/shadow take 200ms
  and the arrow takes 300ms, using cubic-bezier(.2,.8,.2,1). Disabled controls
  do not animate and background changes are immediate across enabled states.
- The solid Navy companion, diagonal Mint category ribbon and teal orb remain
  code-native decoration. Two identical ribbon groups include their boundary
  gap; half-track translation retains seamless 38s and 46s periods, the second
  reversed. The orb retains its alternating upward 8px/6s motion and local
  easing. Playback freezes within 4500ms of mounting.
  Category vocabulary includes College Support and makes no availability claim.
  No new raster, font, dependency or generated asset is involved.
- A local client companion receives the server-rendered decoration as children.
  Its `aria-hidden` artwork wrapper sits inside a named aside with no decorative
  motion button. Animations start paused in CSS and run only with hydration,
  observer support, panel intersection, a visible document and an unset completion
  latch. The mount effect starts a 4500ms timer that sets the latch, freezing
  artwork in place; hidden/offscreen time counts, and later visibility changes
  cannot restart it. Timer, observer and visibility subscription clean up on
  unmount. No scripts or missing observer support keeps the complete artwork still.
- At 900px sign-in container width, the companion hides; at 384px, recovery
  moves below the input. Reduced motion defines no loops and removes local
  transitions; forced colors removes the companion
  and submit shadow. The current navbar and default other-auth presentations
  remain outside this scope. The footer continuation below only extends the
  existing compact-footer selection to exact `/sign-in`.

### Compact footer continuation

- Exact `/sign-in` now uses the same `SignUpFooter` component and extracted
  `sign-up-footer.css` as exact `/sign-up`; no separate sign-in footer variant
  or new token is introduced. The component name and original markup remain.
- The original primary wordmark is 48px wide with its vector proportions intact;
  the server supplies the current copyright year. Privacy draft, Terms draft
  and Help retain `/privacy`, `/terms` and `/contact` destinations.
- The Paper row retains its thin Stone top rule, Slate 13px text, wrapping
  row/brand/navigation groups, 44px minimum link width and height, Navy
  underlined hover and shared visible focus. Its width is
  `calc(100% - 2.5rem)`, capped at 1400px, with 20px top, 32px side and 24px
  bottom padding. Below 1024px, side padding is 20px and bottom padding is
  `calc(5rem + env(safe-area-inset-bottom, 0px))` to clear the mobile dock.
- `PublicShell` retains `SiteFooter` as its default. The auth layout passes
  server-rendered compact/default nodes to `AuthFooter`; its exact-path selector
  returns the compact node directly for `/sign-in` and `/sign-up`, and the
  shared node for other auth routes. Other public pages keep `SiteFooter`.
- The existing sidecar compact-footer preview describes both routes and the
  extracted stylesheet. Its recorded year is static; the app year is server
  generated. Form, companion artwork, navbar, motion, authentication behavior,
  original assets and shared tokens are unchanged by this continuation.
