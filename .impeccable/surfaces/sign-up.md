# Create account — reference composition

Target: src/app/(auth)/sign-up/page.tsx; src/features/auth/sign-up-layout.tsx;
src/features/auth/sign-up-artwork.tsx; src/features/auth/sign-up.css;
src/features/auth/auth-form.tsx; src/features/auth/sign-up-feedback.ts;
src/features/auth/sign-up-footer.tsx;
src/features/auth/sign-up-footer.css; src/features/auth/auth-footer.tsx; src/components/shared/public-shell.tsx.
Mode: Operate. Existing Learli world, owner-pinned reference, code-led.

## Direction contract

THESIS: Account creation is a clear, centered working card, surrounded by the
reference's subject vocabulary rather than the former generic auth frame.

OWN-WORLD: Keep Learli's app-served Lexend, Paper/White/Navy/Mint/teal tokens,
approved navbar and the owner's compact footer continuation. Dot field, angled
ribbon and floating labels are code-native decoration, with no invented tutor
or booking records.

STORY: Choose the existing account intent, enter the same credentials, request
registration and verify email through the existing secure continuation.

FIRST VIEWPORT: A 520px white card holds the centered title and introduction,
three native account-intent choices, Display name, Email, Password and the navy
CTA with teal arrow. Subject labels float beside it on wide screens; mobile
removes floats and card elevation, retaining the complete scrolling form.

FORM: The supplied Create Account standalone HTML fixes composition; no concept
seed or generated comp applies. Preserve Choose later, Parent or guardian and
College Student, all validation/notices, selected booking and Sign in links.
Terms agreement, password meter, sample accounts and demo success are excluded.

MOTION: Enabled submit lift/arrow/press feedback, 7s side-label bob and 6s orb
follow the reference. Native inputs and account choices add the reference's
border/focus-shadow feedback; the actual busy form replaces its decorative
arrow with an 800ms pending ring. The latest owner continuation removes the
decorative motion button and freezes artwork within 4500ms of mounting, with no
restart after completion. Offscreen/tab suspension, paused SSR and static
reduced-motion/no-script fallbacks preserve visible content.
The real form retains its existing disabled pre-hydration gate and JavaScript guidance.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Recorded implementation

Source: `src/features/auth/sign-up.css`, `sign-up-layout.tsx`,
`sign-up-artwork.tsx`, the `sign-up-reference` AuthForm presentation and the
signup route. The compact footer is sourced from retained `sign-up-footer.tsx`,
its extracted `sign-up-footer.css`, `auth-footer.tsx`, the auth layout and
`PublicShell`. Authority: `docs/decisions/2026-10-17-sign-up-reference.md`,
`context/ui-context.md` and the owner continuation in
`prompts/features/m1-05-signup-reference.md` (**AUTHORIZED — build-feature
delegation**). The latest owner continuation supersedes earlier manual-pause
requirements on both auth pages and preserves the form-motion continuation.
This is a source record,
not a verification verdict; the progress tracker owns verification evidence.
The bounded registration-feedback continuation is authorized by
`prompts/features/m2-01-registration-verification-feedback.md`
(**AUTHORIZED — build-feature delegation**). It extends the existing signup
states inside the accepted composition; it introduces no global token or
component change. `DESIGN.md` and `.impeccable/design.json` retain the incumbent
system and static reference preview.

### Composition and material

- White card: 520px maximum width, 44px top/side and 36px bottom padding,
  28px corners and the two-part Ink/Navy shadow recorded in the sidecar.
- Centered Lexend title: 44px, weight 600, line-height 1.05 and -0.035em tracking;
  narrow title 36px. The reference's “Get started” introductory label stays
  local content and is not canonized as an eyebrow style for other screens.
- Dot field: 22px spacing, radial Navy 13% points with a radial mask. The static
  Mint 75%/Paper ribbon rotates -7deg and has a Navy 75%/Paper bottom edge.
- Native account-intent cards use 14px corners, a Slate border, visible radios
  and a Navy 4%/White selected fill. Parent or guardian and College Student
  share a row; Choose later spans the row and remains the ordinary default.
  Existing parent/student continuation can select its own established intent.
- Display name, Email and Password use 54px minimum inputs and 14px corners;
  submit uses 56px minimum, a Navy fill and teal arrow disc. Existing requirements,
  limits, autocomplete, helpers, disabled/pending and real status behavior stay
  with AuthForm. Show/Hide has 44px minimum targets; submit remasks and clears
  the password before the same provider request.
- Academic labels and mini-panels use category text and solid marks rather than
  invented tutors, learners, availability or reviews. No raster assets ship.
- Accepted navbar, sign-in and other auth presentations retain their existing
  design records. The owner's footer continuation shares the existing compact
  footer with exact `/sign-in` and `/sign-up`; other public/auth routes keep
  `SiteFooter`. This local surface does not replace shared tokens.

### Registration request and verification feedback continuation

Source: signup branches of `auth-form.tsx`, the client-safe
`sign-up-feedback.ts` classifier and signup-scoped CSS. Other auth modes retain
their existing behavior. No assets, dependencies, providers, routes, storage,
role grants or delivery checks are added.

- Editing keeps the same labels, native constraint attributes, helpers and
  account intentions. Signup alone uses custom validation for the existing
  nonblank/100-character display name, valid/254-character email, `.test`
  preview restriction and 12–128-character password rules. Field-specific
  instructions use `aria-invalid` and associated descriptions; a concise
  focused alert identifies correction. Valid nonsecret input remains available.
- Actual pending disables fields, choices, Show/Hide and submit, sets
  `aria-busy`, labels the CTA “Creating account…” and exposes a polite status:
  “Creating account… Your registration request is in progress.” A synchronous
  in-flight guard prevents repeated submissions. Password clearing/remasking
  happens before the unchanged provider request; local correction does not
  dispatch. No minimum wait or simulated progress is added.
- A successful response replaces fields and submit with a stable section under
  the existing page h1. Its h2 reads “Verify your email”; the focused live status
  reads “Registration request received.” All pending feedback ends. The local
  panel directs a new account to the verification link in the local test mailbox
  and explains that messages are captured rather than sent to an inbox. Hosted
  copy directs a new account to the link for the entered address and explicitly
  says this screen does not confirm email delivery. New and duplicate successful
  responses share this copy and these actions; neither proves account creation,
  delivery or verification.
- The panel reuses the existing Navy CTA for Sign in, retaining
  `/sign-in?next=${encodeURIComponent(returnTo)}`. Verification help uses
  `/verify-email?next=${encodeURIComponent(returnTo)}`; password recovery uses
  `/forgot-password`. The provider callback remains
  `/sign-in?verified=1&next=${encodeURIComponent(returnTo)}` with the same four
  provider fields. Existing validated Parent/College Student onboarding and
  full booking continuations remain; intention is never role authority.
- “Use a different email” restores editing, keeps display name and account
  intention/continuation, clears email and errors, focuses Email and starts with
  an empty masked password. Completion belongs only to the mounted form;
  refreshing restores entry. No email or credential enters URLs or storage.
- Only safe known email/password provider codes become field instructions.
  Rate limiting asks the visitor to wait without inventing a countdown.
  Unknown refusal, 5xx and network errors say the request could not be confirmed
  and offer retry, Sign in, verification-link and reset recovery. Raw provider
  details, duplicate-specific information and rollback/delivery promises are
  never rendered; errors retain nonsecret input and an empty masked password.
- The received section uses a 24px vertical gap, 8px top padding, wrapping text,
  the existing 24px section-title role and Navy heading. White paragraph surfaces
  keep copy readable over the ribbon when the mobile card is transparent.
  Navbar, compact footer and the 4500ms artwork lifecycle remain unchanged.

### Compact footer continuation

- The original primary `BrandLogo` is 48px wide and keeps its vector proportions;
  the copyright year comes from the server. Privacy draft, Terms draft and Help
  link to `/privacy`, `/terms` and `/contact`, preserving truthful policy status.
- The Paper row has a thin Stone top rule, existing Slate 13px text, 44px
  minimum link width and height, Navy underlined hover and the shared focus outline.
  Row, brand group and navigation wrap. Width is `calc(100% - 2.5rem)`, capped
  at 1400px, with 20px top, 32px side and 24px bottom padding.
- Below 1024px, side padding becomes 20px and bottom padding becomes
  `calc(5rem + env(safe-area-inset-bottom, 0px))` to clear the mobile dock.
- `PublicShell` defaults to `SiteFooter`; the auth layout supplies server-rendered
  compact/default nodes to `AuthFooter`. Its exact-path selector returns the
  compact node directly for `/sign-up` and `/sign-in`; other auth routes retain
  the shared node. `SignUpFooter` keeps its name and original markup, importing
  the footer styles extracted unchanged into `sign-up-footer.css`. Form, card,
  artwork, navbar, motion and provider behavior are unchanged by this continuation.
- The sidecar's existing compact-footer preview describes both exact routes and
  the extracted stylesheet, retaining the original inline SVG and recorded year
  snapshot. The application supplies the current server year; the preview adds
  no runtime hooks or authentication behavior.

### Responsive behavior

Container queries belong to the signup surface, not the browser viewport:

- At 1180px or less, side-label groups and small dots hide; the orb moves to the
  right gutter.
- At 900px or less, the stage uses 24px top, 20px side and 64px bottom padding;
  the card uses 28px block/20px side padding and loses its border, rounding,
  White background and shadow. Orb hides. The static ribbon
  moves down; the complete form, notices and selected booking keep scrolling.
  Form alerts retain the existing White surface background so the ribbon cannot
  cross refusal text. This targeted finish correction changes no alert markup,
  message, focus or authentication behavior.
- At 384px or less, intentions stack and the card's own side padding becomes 0.

### Motion lifecycle

The submit transitions only transform and shadow over 200ms using
`cubic-bezier(0.2, 0.8, 0.2, 1)`: enabled hover lifts 1px and strengthens its
shadow; the arrow travels 4px over 300ms, and press scales to 0.985. Its background
changes immediately. Side groups alternate upward 8px over 7s, with -3s delay on
the right; the orb alternates 8px over 6s. The band and dot field remain static.

The form-motion continuation adds native input border transitions over 150ms
linear and focus-shadow transitions over 200ms with the local easing. Account
choices use the same border/shadow timing plus 150ms linear selected-background
feedback. Enabled input/choice hover uses a Navy border. Input focus uses a Navy
border and a 4px shadow of Bright teal (`--accent-primary`) at 28% against
transparency. Visible radio focus adds the 4px shadow at 35%; both keep the
existing Deep teal two-pixel outline and offset. Slate resting control borders,
native radios and checked Navy/White-mix state remain.

Only actual `.sign-up-form[aria-busy="true"]` hides the decorative Chevron and
exposes a 14px open ring with a two-pixel current-color border. The ring spins
over 800ms linear only under no-preference motion; reduced motion retains the
static ring and the actual “Creating account…” pending text. All input/choice
transitions and pending rotation are defined only under no-preference. Disabled fieldsets clear
input, choice, submit and arrow transitions/transforms immediately, including
the existing disabled pre-hydration and real pending states. The earlier CSS
continuation changed no AuthForm logic, payload, timer, simulated success,
entrance animation or credential handling; the later registration-feedback
continuation above records the current signup state behavior.

CSS starts decoration paused. `SignUpArtwork` adds `data-motion-running` to the
hidden artwork only after hydration with IntersectionObserver support, while
intersecting, document-visible and its completion latch is unset. The mount
effect starts a 4500ms timer that sets the latch and freezes artwork in place.
Hidden/offscreen time counts toward the limit; later visibility changes cannot
restart motion. There is no decorative motion button or `data-ready` attribute.
Timer, observer and visibility subscription clean up on unmount. No script or
missing observer support stays static. Reduced motion defines no artwork loops
or pending rotation and removes local transitions/travel. Forced colors hides
artwork and removes the existing card/submit shadows while retaining system-color
control borders.

The design sidecar mirrors paused server markup without a running attribute or
motion button, retaining the disabled form fieldset. Its preview does not
implement authentication, fake verification or fake JavaScript success.

### Preservation boundary

Intention remains navigation intent, not role or safeguarding authority. Preserve
the real provider payload, continuation validation, native field constraints,
hosted/local guidance, selected booking summary, notices and focus, credential
clearing, verification path and Sign in link. Terms consent, password meters,
new eligibility assertions and business-rule changes are outside this UI change.
