# Sign-in reference composition — M1.5 / M2.9

- Status: **AUTHORIZED — build-feature delegation**
- Authority: the owner's explicit 2026-10-17 request to redesign **only the
  sign-in page** to the same UI as
  `/Users/cob/Downloads/learli Sign In v2 (standalone).html`, preserve current
  functionality and project standards, and keep the already-approved navbar
  unchanged. This is delegated execution authority, not a claim that the owner
  separately reviewed this written blueprint.
- Repository: `/Users/cob/learli`.
- Observed branch: `feature/desktop-navbar-reference-20261017`; HEAD
  `616e8c734acebec0f7b51c5f96fb182dc4001d93`.
- Existing uncommitted navbar implementation, tests and documentation are
  intentional accepted work. Preserve their exact baseline. No branch, commit,
  merge, push or deployment is authorized by this blueprint.

## Implementation Plan — Learli sign-in reference

### Owner motion continuation — 2026-10-17

The owner now explicitly requests the missing reference Sign in hover animation
and right-card animation. This supersedes the static ribbon/orb choice below
and authorizes only the small client controller needed to pause decorative
motion and suspend it offscreen/in a hidden tab. Authority remains
**AUTHORIZED — build-feature delegation**, from that direct continuation.

- Match button hover lift1px, arrow travel4px, active scale.985 and increased
  soft shadow with the reference's200/300ms easing. Animate no disabled submit;
  do not reintroduce background interpolation across hydration/pending states.
- Match opposing ribbon38s/46s loops and orb6s alternate8px bob. Identical
  repeated groups include their boundary gap for a seamless period.
- One sign-in-only client companion wraps the existing server decoration and
  owns Pause/Resume, intersection and document visibility, with cleanup. Keep
  the control outside the aria-hidden decorative wrapper. No-JavaScript and
  unsupported-observer fallbacks are static; reduced motion always wins.
- Preserve prior auth handlers/fields/gates/notices, navbar/footer/default auth
  views. No new dependencies or credentials in animation state. Verify actual
  motion, seam geometry, pause/resume/visibility cleanup, reduced-motion/mobile
  behavior and existing auth/accessibility checks separately.

### What we are building

A returning account holder sees the supplied reference's welcoming, unboxed
sign-in form and large navy companion panel beneath the current navbar. The
existing real email/password authentication, account recovery, verification,
pending tutor/time selection, safe continuation and second-factor routing keep
working. The visual change belongs only to `/sign-in`; all other account screens,
public pages and private workspaces retain their current composition.

### Requirement and milestone mapping

- Primary owner: **M1.5 — Create shared page shells**, continuing the auth page
  composition. Related: **M2.9 — Secure auth UX**. This does not complete either
  entire work package.
- PRD: **AUTH-02** for real sign-in/recovery, **AUTH-05** for safe selected-booking
  continuation, **NFR-01/NFR-02** for responsive accessible auth, **NFR-05/NFR-09**
  for private access and honest failure behavior. Preserve **AUTH-01/AUTH-03**,
  verification and current server permissions; do not reimplement them.
- Inspected source: `src/app/(auth)/sign-in/page.tsx`, auth route layout,
  `src/features/auth/auth-frame.tsx`, `auth-form.tsx`, shared `public-shell.tsx`,
  `site-footer.tsx`, `unavailable-page.tsx`, and
  `src/features/bookings/pending-choice.tsx`.
- Inspected coverage: `tests/components/sign-in-verification-notice.test.tsx`,
  `hosted-auth-form.test.tsx`, `support-entry-sign-in.test.tsx`, current auth
  continuation component coverage, and `tests/e2e/auth.spec.ts`. The existing
  normal-build auth suite already exercises genuine signup, captured verification,
  safe return, recovery, settings, logout and phone/narrow accessibility.
- The actual reference is the JSON string in
  `script[type="__bundler/template"]`, not its initial loading thumbnail. Its
  source was decoded for read-only inspection without dumping bundled font data.

### Language we agreed on

- **Sign-in page** means the content at `/sign-in`, including its real notices
  and current form; it does not mean every route in the shared auth route group.
- **Same UI** means reference composition, hierarchy, form alignment and
  decorative geometry adapted to existing approved fonts/tokens and functioning
  account behavior. Placeholder links and demo scripts are not functionality.
- **Navbar unchanged** includes current desktop white Sign in capsule, mint
  hover, no underline, current dot, account states, mobile topbar/dock and their
  styling. No clarification is needed for this scope.

### Decisions made

1. Reuse the existing server availability gate and `AuthForm` submission logic.
   `AuthFrame` selects a new server `SignInLayout` only when
   `presentation="sign-in"`, after its availability gate. `AuthForm` accepts
   `presentation="reference"` only when `mode === "sign-in"`; never fork the
   authentication implementation into a new form.
2. Keep the auth layout's `PublicAuthDocumentBoundary`, shared `PublicShell`,
   one main landmark, no-index metadata and no-referrer sign-in metadata. Keep
   the actual shared footer unchanged below the new full-viewport sign-in
   composition. A small local Privacy draft / Terms draft row may sit at the
   left column's foot, using the existing `/privacy` and `/terms` destinations
   and exact truthful labels; the template's fake copyright is not imported.
3. Use a dedicated stylesheet under `src/features/auth/` scoped under
   `.sign-in-page`. Do not style generic `form`, `input`, `h1`, `.field`, `body` or
   header/footer selectors globally. Shared auth screens keep the default frame
   and default form markup/classes.
4. Use existing Lexend interface and Literata italic for the reference's serif
   emphasis, plus existing navy/mint/teal/paper/white semantic tokens. Do not
   load the template's Newsreader/font CDN, approximate palette, bundler,
   JavaScript, assets or third-party dependencies.
5. The owner-supplied design authorizes a local sign-in composition exception
   to the prior centered bordered auth card: wide two-column page, unboxed form,
   navy decorative panel and the reference's local sizes/radii. Record only that
   scoped visual exception before implementation. Preserve readable control
   borders, visible focus, semantic disabled/error states and 44px targets.
6. A reference Show/Hide password control may be added as presentation-only
   client state **only for sign-in**. It changes only the existing input type,
   has an accessible name/pressed state, and keeps the same credential field,
   autocomplete, constraints, provider call and clearing. Its button stays
   inside the disabled fieldset. Reset it to masked before a submission clears
   the password; no password value enters React state. The Forgot password?
   link follows the password input in DOM focus order and a local label grid
   places it visually beside the Password label.
7. Keep the ribbon/orb decorative and static by default. Reference geometry is
   sufficient; no perpetual marquee, bobbing, timer or fake progress is required.
   Any optional short functional transition honors reduced motion.

### Reference composition and safe adaptation

- Reference outer content: max1440px, 16px outer inset/gap, columns
  `minmax(0,1fr) minmax(0,1.08fr)`. Left area has approximately40px inset and
  48px vertical form space; the form max-width is420px. Use flexible minimums,
  not a fixed viewport crop: selected-booking and error content can grow.
- Form: teal-dot “Welcome back” eyebrow, large navy “Sign in” heading, visible
  Email/Password labels, white inputs, existing help text, Forgot password?
  beside Password, full-width navy submit action with a decorative teal arrow
  disc, and ruled Create account / Verify email links beneath. Preserve exact
  accessible label/button names used by current real journeys. The reference's
  54px fields and56px submit may be scoped locally; 16px input text remains.
- Companion panel: rounded navy field with white/mint type, concise existing
  tutoring message, italic final word, diagonal mint ribbon with capsule-like
  **decorative** labels and teal orb. No new inventory or account claim.
- Safe content: the reference hardcodes Spanish, French, German, Coding, Piano
  theory and other offerings without evidence. Do not import these as available
  subjects. Use a static ribbon of generic approved academic-category vocabulary
  without an inventory/availability claim, keeping College Support. Do not add
  a data dependency solely to fill decoration. The decoration contains no
  actionable controls and may be hidden from assistive technology.
- On narrow screens, hide the decorative companion panel and keep the form
  usable in normal flow, following the reference's approximately900px collapse
  (an ordinary local layout choice, not a navbar breakpoint change). Honor the
  existing mobile dock and its focus/scroll accommodations.
- Do not import the reference's prefilled demo email, placeholder `href="#"`,
  custom `.test` regex, live password-length praise, `novalidate`, simulated
  loading/success timers, mobile hamburger, typed logo, fabricated copyright or
  non-draft policy labels. A real server success controls navigation; a timer
  never says “Signed in”. No social login, Remember me, new backend or policy.

### Assumptions

- The parent coordinator supplies separate visual inspection, implementation,
  independent source Review and executed verification. Architect performs none.
- Preserve existing helper text (including environment `.test` restrictions and
  12–128-character password limits) even where that increases reference height.
- The shared public footer stays unchanged below the full-viewport sign-in
  content. The local left-column Privacy draft / Terms draft links use current
  destinations. Matching the template does not authorize removing current
  help/safety/policy navigation.
- There is no unresolved material product/business/security choice for this
  presentation-only change.

### Scope

- Included: sign-in-only layout, responsive sizing, heading/eyebrow, form visual
  hooks, password/recovery alignment, optional accessible Show/Hide, decorative
  submit arrow/panel/ribbon/orb, and scoped UI/design documentation.
- Excluded: navbar, mobile dock, shared footer redesign, signup/reset/verify/
  MFA screen redesign, workspace changes, authentication/session/validation/
  continuation algorithms, provider configuration, API contracts, schema,
  packages, migrations, external services, real-user/policy/payment activation.

### System invariants

- `AuthFrame` remains the authoritative availability gate: disabled accounts
  show the existing truthful UnavailablePage; hosted-synthetic requires the
  current runtime and allowed headers. A presentation variant cannot bypass it.
- Keep `safeBookingReturnPath`, parent/student continuation helpers and current
  `next`/token props unchanged. `PendingBookingChoice` remains visible and
  truthful; selecting a time never reserves it or grants learner authority.
- Keep the shared form's `method="post"`, existing auth action and initially
  disabled fieldset before hydration. The JavaScript requirement message and
  accessible recovery/navigation remain available without scripts.
- Keep `aria-busy`, actual pending disabling, native input validation, field
  names/IDs/types/autocomplete/required/min/max constraints and help associations.
- Continue clearing the password DOM input **before** the real auth request.
  Keep safe generic provider/network error strings, live alert/status role,
  focusable feedback and requestAnimationFrame focus behavior.
- Preserve actual `authClient.signIn.email({ email, password })`, MFA
  `twoFactorRedirect` handling, form reset and full-document location replacement
  to the existing validated destinations. Do not use client-router-only auth
  navigation or stale private bootstrap data.
- Keep query-driven verification success/expired-link messages and the actual
  renewal link. An error takes precedence over `verified=1` as it does now.
- Decorative panel cannot expose private data, real names, fake trust/review/
  price/availability claims, imply an LMS, or alter existing disabled factories.

### Affected areas

Required source candidates, confirmed from repository inspection:

- `src/app/(auth)/sign-in/page.tsx`: opt into the unique composition while
  preserving current props, metadata, notices and PendingBookingChoice.
- `src/features/auth/auth-frame.tsx`: minimal optional presentation variant
  after the existing availability gate; every other caller keeps its default.
- `src/features/auth/auth-form.tsx`: sign-in-only presentational composition or
  classes for field/recovery/help arrangement and optional visibility control;
  retain one existing submission function and all non-sign-in behavior.
- Proposed `src/features/auth/sign-in.css` (or equivalent locally scoped name):
  import from the sign-in page/feature, semantic-token-only visual rules.
- Proposed `src/features/auth/sign-in-layout.tsx`: server-only presentation of
  the two-column composition, form children, local draft-policy row and static
  companion decoration. No new client controller solely for decoration.

Validation/documentation candidates:

- Existing `tests/components/hosted-auth-form.test.tsx` and
  `sign-in-verification-notice.test.tsx`; add only meaningful sign-in isolation/
  visibility/clearing/notice regressions as needed. New dedicated component file
  is optional; do not mirror CSS implementation in brittle tests.
- Existing `tests/e2e/auth.spec.ts` and selected related auth/header browser
  cases; use exact current labels and retain core auth assertions.
- `context/ui-context.md`, a concise proposed dated decision
  `docs/decisions/2026-10-17-sign-in-reference.md`, and the established design
  metadata/surface brief if required by the coordinator's Impeccable workflow.
- `context/progress-tracker.md`: coordinator records factual implementation,
  Review and executed verification evidence separately.

Do not edit `site-header.tsx`, `header-account.tsx`, `site-shell.css`, auth layout,
`public-shell.tsx`, workspace code, auth services or provider files for this
slice unless a newly confirmed defect is separately scoped. Preserve their
existing uncommitted navbar baseline.

### Data and authorization changes

None. No schema, migration, API, server authorization, session configuration,
role/guardian grant, booking state, policy, secret, deployment or infrastructure
change. No Neon/Resend/Railway operation is needed.

### Workflow and failure states

Normal flow remains: enter credentials → native validity → pending and clear
credential input → real Better Auth → second-factor document or validated
continuation document. Invalid credentials/provider errors and unavailable
network retain safe focusable feedback with retry. Query verification notices
and pending booking choice are in the readable form column above credentials,
not covered by fixed decorative content. The form may exceed a short viewport;
normal document scrolling exposes every control and existing footer. Long
errors, zoom and forced colors never become clipped to match a screenshot.

### How to build it

1. Preserve and fingerprint the current intentional navbar diff; record this
   separate sign-in scope in UI context/design documentation and its decision.
2. Add the minimal optional sign-in AuthFrame composition **after** its existing
   availability check, delegating to server SignInLayout; keep the default
   rendering byte-equivalent in behavior.
   Opt in only from the current sign-in page. Keep one h1 and no nested main.
3. Add the dedicated scoped stylesheet and server-rendered companion decoration.
   Match reference layout and type hierarchy with current semantic tokens/fonts,
   static ribbon/orb and safe copy. Keep form sizing flexible with real notices.
4. Add sign-in-only markup hooks to AuthForm for the recovery link/password row,
   submit decoration and account-help links. Preserve every destination/return
   parameter and all submit/helper/failure behavior. Add the optional accessible
   visibility control only as specified, without storing the credential.
5. Run independent source Review against this blueprint and preserved navbar
   baseline. Separate verification then executes the checks below; scoped
   confirmed defects return through the coordinator's Recover flow.
6. Coordinator records actual evidence and remaining limits in the tracker and
   saves the final session handoff. No commit, merge or deploy is implied.

### Verification plan for the separate verification stage (DO NOT EXECUTE)

- Automated: `npm run check` (format/lint/typecheck/unit-component), configured
  production `npm run build`, and existing isolated normal-build Playwright auth
  selection via `npm run test:e2e -- --project=auth ...`, selecting exact existing
  cases appropriate to the change. Inspect configured global setup and isolated
  test environment before running; never use production data or owner preview
  credentials. Record actual command/selection and result.
- Component boundary checks: SSR inert form/POST/hydration message, sign-in
  field names/constraints/helper associations, pending disabled state, password
  clearing before request, focusable safe failures, unchanged non-sign-in
  screens, `verified=1`/error notice precedence and safe recovery hrefs. If
  Show/Hide is added, test keyboard/pressed/input type and masked cleared retry.
- Browser functional checks: existing actual signup→verification→sign-in→safe
  return→logout case, recovery→new login, phone sign-in, malformed external
  `next` returning safely, and existing MFA redirect route through current
  coverage. Preserve current header navigation/disclosure/current semantics.
- Manual/visual: compare reference and final ordinary sign-in at1440/1024px;
  check900px transition,768/390/320px, short viewport and200% zoom/text. Check
  one h1/main, no document overflow, complete notice/help/error wrapping, footer
  and dock clearance, Tab/Enter/Shift+Tab, show/hide if added, visible focus and
  AA text/input-boundary contrast. Axe supplements keyboard/visual observation.
- Verify unavailable gate, no-JavaScript disabled controls/navigation, pending
  and error states, successful verification notice and expired link. Ensure
  decorative panel is non-interactive and absent from the accessibility tree
  where hidden as decoration.
- Check forced colors, increased contrast, reduced motion/transparency; preserve
  system focus/borders. The panel must not overlap the form at enlarged text.
- Regression visuals: signup, forgot/reset/verify/MFA and one private workspace
  keep existing composition; compare desktop/mobile navbar source fingerprint
  and appearance to the accepted pre-change baseline. Do not silently restyle it.
- No database-correctness suite, migration or external-provider acceptance is
  required solely for this UI change. Real auth browser fixtures use existing
  owned isolated synthetic tooling. Do not capture passwords, cookies, reset/
  verification tokens or private meeting URLs in shareable artifacts.
- Evidence expected: separate independent Review findings, exact checks/results,
  browser engines/viewports, ignored screenshot/artifact paths, unchanged-scope
  diff/fingerprint evidence and disclosed unrun cases.
- Verification status: **NOT RUN — architecture planning only**.

### Acceptance criteria

1. `/sign-in` visibly adopts the supplied two-column form/navy-panel composition
   at ordinary wide sizes, with the reference hierarchy, aligned Password/Forgot
   row, navy action/teal arrow and diagonal decorative mint ribbon/orb.
2. All existing real auth, MFA, safe-return, pending-selection, recovery,
   verification, hydration, credential-clearing and failure behavior remains.
3. The form is accessible and usable at320px and enlarged text without clipping,
   horizontal page overflow or covered controls; decoration can collapse.
4. Other auth screens/workspaces and the accepted navbar/mobile dock retain
   their current behavior and presentation. No fake success or subject/trust/
   copyright/policy claim from the template is imported.
5. Independent Review and separate relevant check/build/browser/visual evidence
   support completion of this UI slice only; broader M1/M2/launch gates remain.

### Context updates

Downstream implementer records the scoped sign-in visual adaptation in
`context/ui-context.md` and a concise dated decision, plus existing Impeccable
design metadata where applicable. Coordinator owns factual progress evidence.
No PRD/architecture/build-plan behavior or sequencing change is required.
Architect changes only this canonical blueprint.

### Risks and open decisions

No material unresolved decision. Main risks are shared AuthForm/AuthFrame
regression, CSS leakage to other auth screens, dropping recovery/return links,
password visibility surviving a cleared submit, short-screen clipping and
accidental navbar drift. Use an explicit opt-in, unique selector prefix, flexible
normal flow and existing auth regressions. Rollback is reverting only this
scoped presentation/test/doc change, with no data restoration.

### Approval gate

- **AUTHORIZED — build-feature delegation**, within the owner's explicit
  2026-10-17 sign-in-only request and preserved functionality/standards/navbar.
- No routine blueprint confirmation is needed in orchestrated mode. Material
  new product/security scope and production/destructive actions retain their
  separate authorization gates; none is necessary for this UI slice.
- Handoff: coordinator implementation → independent read-only Review → separate
  executed verification → Remember. Architect stops at this written blueprint.

## Owner continuation — compact Sign in footer

Authority: **AUTHORIZED — build-feature delegation**, owner's 2026-10-17
instruction to use the same footer as Create account on Sign in and change no
other pages. M1.5 / related M2.9 and AUTH-01/03/05 presentation only; no new
business, data, permission or provider behavior.

Reuse the existing compact SignUpFooter markup and exact appearance. Extend
AuthFooter's exact route selection to `/sign-in` and `/sign-up` only. Extract
its existing footer CSS unchanged from sign-up.css to a proposed component-owned
`sign-up-footer.css`, imported by SignUpFooter, so direct Sign in loads styles
without requiring a prior signup visit. Retain the existing component/class names
to avoid unrelated migration. All other routes keep the original SiteFooter.
Preserve forms, cards, companion/artwork motion, navbar, auth guards and metadata.

Update the focused existing footer selection tests for both routes, default
fallbacks and navigation. Separate verification: relevant tests, repository check
and production build, direct and client navigation plus no-script markup,
desktop/mobile/200% reflow, links and dock focus clearance. Compare unchanged
source against the task's private baseline. Local anonymous browser checks use
intercepted session-null only, with no submissions/database/provider actions.
Record actual results in the progress tracker and reconcile scoped UI/design/
decision docs. Review and verification remain separate; no commit/merge/deploy.

Blueprint ready.

## Owner continuation — remove decorative motion control

Authority: **AUTHORIZED — build-feature delegation**, owner's 2026-10-17 request
to remove Pause animation from both Sign in and Create account. The shared task
plan is the final continuation in `prompts/features/m1-05-signup-reference.md`.
Remove only the decorative Pause/Resume control and its CSS. Existing artwork
keeps original timing while visible, then freezes within 4.5 seconds of component
mounting; no restart after completion. Retain reduced-motion/static fallbacks,
visibility/intersection guards and complete cleanup. Forms/footer/navbar and
provider behavior remain unchanged. Separate integrated verification is required.
