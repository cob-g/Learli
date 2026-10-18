# Create account reference UI — M1.5 / related M2.9

- Status: **AUTHORIZED — build-feature delegation**.
- Authority/date: the owner's 2026-10-17 request to redesign the Create Account
  UI using `/Users/cob/Downloads/learli Create Account (standalone).html`, while
  preserving all current functionality and implementation. UI only. The
  coordinator delegates architecture, implementation, independent Review and
  separate verification; this does not claim separate human blueprint review.
- Repository: `/Users/cob/learli`.
- Observed branch: `feature/desktop-navbar-reference-20261017`.
- Observed HEAD: `616e8c734acebec0f7b51c5f96fb182dc4001d93`.
- Working location: continue the existing scoped checkout. No new branch is
  needed or created. Preserve its intentional uncommitted desktop navbar,
  sign-in reference/motion, tests and documentation. No commit, merge, push,
  deployment, provider operation, database mutation or dependency change.

## Implementation Plan — Learli Create account reference UI

### What we are building

At `/sign-up`, give a visitor the supplied reference's centered, rounded white
account card, quiet dot field, angled mint ribbon, abstract floating subject
decoration and navy action with teal arrow. The page remains an Operate screen:
its real account task, current fields, eligibility boundaries, verification
outcomes and safe continuation lead. Keep the accepted navbar, shared footer,
sign-in/motion composition and other auth screens. The reference pins the visual
direction; no alternative concept, external design service or new integration
is needed.

### Requirement and milestone mapping

- Primary owner: **M1.5 — Create shared page shells**; related **M2.9 — Secure
  auth UX**. This is a signup presentation subset, not whole-package acceptance.
- PRD: **AUTH-01** register/verify; preserve **AUTH-03** trusted roles and
  relationships, **AUTH-05** safe continuation, and the owner-approved Parent
  and College Student intent semantics. **NFR-01/NFR-02** own responsive,
  accessible UI; preserve **NFR-05/NFR-09** privacy and truthful errors.
- Read `AGENTS.md`, then the eight canonical context files in their required
  order: project-overview, architecture, ui-context, code-standards,
  ai-workflow-rules, progress-tracker, prd, build-plan. Read the current brand,
  Parent/College Student and 2026-10-17 navbar/sign-in decisions too.
- Inspected source: `src/app/(auth)/sign-up/page.tsx`, `(auth)/layout.tsx`,
  `src/features/auth/auth-frame.tsx`, `auth-form.tsx`, `document-boundary.tsx`,
  `sign-in-layout.tsx`, `sign-in-companion.tsx`, `sign-in.css`,
  `src/features/bookings/pending-choice.tsx`, the Parent/Student continuation
  modules, `src/app/(workspace)/student/onboarding/page.tsx` and admission form.
- Inspected coverage: `tests/components/student-registration.test.tsx`,
  `parent-onboarding.test.tsx`, `hosted-auth-form.test.tsx`,
  `sign-in-presentation.test.tsx`; normal-build auth, hosted-auth and private
  workflow browser callers; actual package scripts and Playwright projects.
- The supplied artifact is a bundle. Its actual reference is the decoded JSON
  string in `script[type="__bundler/template"]`, inspected read-only in memory.
  Its loading thumbnail/bundler and unused sign-in CSS are not the signup design.

### Language we agreed on

- **Create account UI** means `/sign-up` presentation, not onboarding policy,
  registration implementation or every route in the auth group.
- **Account type** means current navigation intent: `later`, `parent`, `student`.
  A choice is not a role, guardian relationship or independent eligibility grant.
- **Preserve functionality** means the same field constraints, provider request,
  notices, disabled/pending behavior, safe `next`, verification and downstream
  setup rules. Reference demo behavior is not product authority.
- No terminology clarification or material business decision is needed.

### Decisions made

1. Add a signup-only presentation to the existing server `AuthFrame`, **after**
   its unchanged availability gate. A proposed server `SignUpLayout` owns the
   reference card/stage and receives the current children. Keep one existing
   main landmark and one page h1; do not import the template header/footer.
2. Add an explicit signup reference option to `AuthForm`, for example
   `presentation="sign-up-reference"`. Preserve its existing sign-in
   `presentation="reference"` condition and standard path. Continue using the
   single existing submit function and current accountType/returnTo helpers.
   Do not fork authentication into a second signup form.
3. In the signup reference variant only, render three **native radio cards**
   under the legend **Account type**: **Choose later**, **Parent or guardian**,
   **College Student**. Preserve their values `later`/`parent`/`student`, default
   `later`, inherited intent defaults and current change handling. Keep the
   standard AuthForm select markup/tests unchanged. No new role value.
4. Preserve exactly the actual signup fields: **Display name**, **Email**,
   **Password**. The source has no age/adult checkbox, consent checkbox, timezone
   field, password confirmation or other signup requirement. Independent adult/
   college eligibility remains downstream assigned review; guardian authority
   remains downstream separate authorization. Do not add a signup attestation.
5. Add the reference's accessible Show/Hide control for the signup variant using
   transient boolean state only. Keep the existing password DOM field
   uncontrolled; clear and remask it before the existing provider request.
   Do not store credentials in React state, browser storage, URLs or diagnostics.
6. Use proposed `sign-up.css` with selectors scoped to `.sign-up-page`, existing
   semantic palette/font tokens and local reference sizes/radii. No raw copied
   palette, browser font CDN, Newsreader, dependency, generated image or global
   generic input/form/heading/header/footer override.
7. Reference motion is part of this slice: enabled submit lift/press/arrow,
   gentle side-group bob and teal orb bob. Use a small signup-only decoration
   controller patterned after the accepted `SignInCompanion` lifecycle without
   editing/refactoring it. Autoplay is opt-in after hydration/observer support
   and only while the decoration is visible and document active. Expose a
   keyboard-operable Pause/Resume control outside `aria-hidden` artwork. Static
   reduced-motion/no-script/unsupported-observer fallbacks and persistent manual
   pause take precedence. No timer-driven auth state or fake success.
8. Record this explicit reference as a local signup exception to prior flat-card,
   radius and non-home decoration/motion rules, before implementation. It does
   not change shared tokens or authorize the effect on other pages.

### Reference composition and safe adaptations

- Centered card approximately520px wide, with44px wide-screen padding,28px
  corners, quiet border and reference shadow on existing paper. The h1 may read
  **Create account** as supplied, with **Get started** eyebrow and a short
  factual introduction. Retain current metadata/no-referrer/no-index behavior.
  Do not promise immediate matching, booking access or tutor availability.
- Use the reference's54px white inputs/56px navy submit, local14px control
  radius, readable16px input text and teal arrow disc; semantic control/focus
  contrast and44px touch targets still govern. Display name remains a display
  name (`name`, autocomplete `nickname`, max100), not a new legal-name rule.
- The three choice cards may use two columns with Choose later spanning a row,
  or a compact responsive arrangement. Keep every full label readable, obvious
  checked state, native keyboard radio behavior and visible focus. At narrow
  widths/large text stack them; never hide Choose later or College Student.
- Keep current `.test` email helper, hosted variant wording and12–128 password
  helper. `PendingBookingChoice` stays inside the readable card above the form,
  in normal document flow. Errors, no-script explanation and success notices can
  grow the card; there is no fixed-height crop or fixed footer over controls.
- Behind the card, reproduce the quiet dot texture, diagonal mint band with
  navy lower edge, floating generic category chips and simple teal/navy dots.
  Clip only a separate non-interactive decorative layer, not the page/form or
  focus outlines. Its positions adapt to actual growing content. It must not
  obscure real text/controls or cause document overflow.
- Replace the fake **Maya R./Chemistry tutor/Matched** and **4:30/Next session/
  Tue · Algebra with Sam** cards with abstract category/process geometry or
  honest generic copy. Use approved academic vocabulary, including College
  Support where useful. Do not import Spanish or imply advertised inventory,
  actual match, booking, real person, qualification or outcome. Decoration is
  `aria-hidden`, with no clickable fake cards.
- Actual signup animation is the side groups'7s alternate bob (staggered phase)
  and orb's6s/8px alternate bob. The diagonal background band is static.
  Unused38s/46s marquee/sign-in panel rules in the source are not signup motion.
  Preserve enabled button hover lift1px, arrow movement4px and press scale.985
  if matching the reference. Do not interpolate enabled/disabled foreground and
  background through insufficient contrast; reuse the accepted transition-none
  convention for that state change. Reduced motion removes travel/loops.
- Following the reference, hide side floats near1180px, remove the outer card
  surface/shadow near900px and retain the form in normal flow with sufficient
  phone gutters. At narrow or enlarged layouts, suppress interfering dots/band
  as necessary. These local/container layout choices do not change navbar
  breakpoints. Keep the existing footer and mobile dock/focus scroll behavior.
- Keep real Sign in help with the current computed `next`; an adjacent “Already
  have an account?” phrase is safe. Draft policy/help destinations remain in the
  accepted shared footer. Do not add the template's **I agree** checkbox: current
  Terms/Privacy are draft preparation surfaces, and UI work cannot invent legal
  consent. Do not add a password meter, length praise, `novalidate`, fake timed
  success/loading, `href="#"`, typed logo, fabricated copyright or demo handlers.

### Assumptions

- The supplied reference plus preservation instruction authorizes local visual
  adaptation, including its actual motion, not a product-policy change.
- Coordinator owns UI brief/design workflow, durable UI decision/context edits,
  implementation, separate Review/Verify and accurate progress/handoff.
- Additional form height for three genuine choices/help/notices is acceptable;
  reference hierarchy and usable task flow take precedence over a fixed crop.

### Scope

- Included: signup-only server composition, native account-intent radio cards,
  form visual hooks/visibility control, local reference decoration/motion,
  responsive/accessibility behavior, focused regression coverage and UI docs.
- Excluded: accepted navbar/mobile dock/footer and sign-in/motion changes; other
  auth/workspace redesign; registration/provider/session/validation/continuation
  algorithm changes; onboarding/admission/guardian policy; APIs, schemas,
  migrations, packages, assets/services, email transport, payments or deployment.

### System invariants and caller mapping

| Existing caller/contract                          | Required preservation                                                                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-up` async page                             | Keep dynamic rendering, metadata, next/token/error props and PendingBookingChoice. Opt into the new presentation only.                                                            |
| `AuthFrame` availability                          | Local is available; hosted-synthetic still requires the current runtime and allowed headers; unavailable uses existing UnavailablePage. A layout variant cannot bypass this gate. |
| `(auth)/layout.tsx`                               | Keep PublicAuthDocumentBoundary, PublicShell and no-index; no nested main/new public shell.                                                                                       |
| `AuthForm` standard and sign-in reference callers | Retain existing markup/classes/destinations/behavior when signup reference is not selected. Accepted sign-in CSS/companion/layout remain unchanged.                               |
| Signup choice state                               | Default later; inherited Parent/Student intent remains selected. Changing intent preserves/unwraps current canonical selection exactly as the existing helpers do.                |
| Provider signup payload                           | Exactly `{name, email, password, callbackURL}` to existing `authClient.signUp.email`; no accountType, role, eligibility, guardian or consent field.                               |
| Verification callback/help                        | Existing `/sign-in?verified=1&next=...` and computed Sign in href survive. Native query selection is validated by existing safe return helpers.                                   |
| Parent intent                                     | Leads through verification/sign-in to explicit authenticated Parent setup; no signup grant, learner, guardian link or booking authority.                                          |
| College Student intent                            | Leads through verification/sign-in to independent College Support request/review; no early Student role, independent minor enrollment or self-approved eligibility.               |
| Generic registration                              | Remains roleless and uses current safe account/selection return. No forced Parent default.                                                                                        |
| Pending selection                                 | Remains public-only, truthful, checked later; no time automatically reserved and no private learner ID enters auth URLs.                                                          |

Preserve form method POST/action, initial disabled fieldset/no-script explanation,
`aria-busy`, pending disabled state, native constraints, names/IDs/autocomplete and
help associations. Keep safe provider/network strings, focusable alert/status
feedback and existing focus scheduling. Local success says verification is
available; hosted success says accepted and delivery unestablished. Neither means
verified, signed in, matched or authorized. Keep every restricted server guard,
disabled factory, private-document boundary and production launch gate unchanged.

### Affected areas

Required inspected candidates:

- `src/app/(auth)/sign-up/page.tsx`: explicit composition/form opt-in only.
- `src/features/auth/auth-frame.tsx`: add signup layout dispatch after gate;
  keep standard/sign-in paths.
- `src/features/auth/auth-form.tsx`: isolated signup visual variant and same
  state/submission logic; keep existing standard/sign-in paths.
- Proposed `src/features/auth/sign-up-layout.tsx`, `sign-up.css` and
  `sign-up-decoration.tsx`: server composition, scoped CSS, local lifecycle.
- Optional proposed `src/features/auth/registration-choice.tsx`: native
  presentational radio cards using existing accountType state; do not create a
  separate form controller or persisted choice store.
- Focused proposed signup component/lifecycle coverage. Existing Parent/Student
  standard-select tests remain; add variant tests for equivalent intent results.
- Browser callers currently using `getByLabel("Account type").selectOption`
  need presentation-locator-only updates: `tests/e2e/auth.spec.ts` (two calls)
  and `tests/e2e/private-fictional-workflow.spec.ts` (registration helper shared
  with Student/security/admin consumers). Use native `getByRole("radio", ...)`
  `.check()`. Preserve all downstream provider/authority assertions.
- UI context, coordinator-owned dated decision, DESIGN/sidecar/surface brief if
  required by design workflow; tracker records actual evidence separately.

Do not edit accepted `site-header.tsx`, `site-shell.css`, footer/public shell,
auth layout, `sign-in-layout.tsx`, `sign-in-companion.tsx`, `sign-in.css`, provider
or continuation modules. Shared AuthForm/AuthFrame minimal edits must retain the
accepted existing behavior. Fingerprint protected current work before edits.

### Data and authorization changes

None. No schema/migration, API, provider, role grant, guardian authority,
independent admission, booking state, secret, external service or operational
change. No database-correctness rerun or provider activation is justified solely
by the styling; actual-provider browser regressions reuse owned isolated local
synthetic tooling.

### Workflow and failure states

Enter existing fields/choose intent → native validity → pending/clear and remask
credential → existing real signup → truthful verification notice or generic safe
failure → current Sign in help/verification continuation → current independent
onboarding. Parent, Student and Choose later may be switched without losing the
valid public selection. Mutation remains inert before scripts. Long notices,
invalid fields, unavailable auth mode, short viewport and200% text remain readable
and focusable. Decorations pause while offscreen/tab hidden; manual pause survives
visibility changes. Scripts/observer failure leaves full static content.

### How to build it

1. Coordinator captures/fingerprints current uncommitted navbar/sign-in baseline
   and records this bounded signup visual exception in UI context/decision.
2. Add signup-only layout dispatch and server card/stage. Keep current page data,
   availability gate and actual pending-selection child. Preserve one h1/main.
3. Add unique signup presentation hooks to AuthForm and three native choice
   cards using existing state/returnTo. Retain actual field contracts and submit.
   Add Show/Hide with masked credential clearing, never credential state.
4. Add semantic-token-only signup CSS and abstract decoration. Match card,
   ribbon, dots, reference hover/press and actual bob motion. Add an independent
   tiny motion lifecycle patterned after accepted sign-in without changing it.
5. Add focused behavioral tests and update only affected browser control
   locators. Independent read-only Review compares contracts/default/sign-in
   paths and preserved work; coordinator handles scoped defects through Recover.
6. Separate verification executes below. Record exact evidence/limitations in
   tracker and save session handoff. No repository release operation implied.

### Verification plan for separate verification (DO NOT EXECUTE)

- Automated: actual `npm run check`, configured production `npm run build`, and
  existing owned normal-build `npm run test:e2e -- --project=auth ...` selection
  including auth and accepted header/sign-in regressions. Inspect configured
  isolated test setup first. Record exact command/selection, engine and results.
- Component contracts: signup-reference SSR/hydration keeps POST/action/inert
  controls; all three radios/default/inherited states/native keyboard semantics;
  switching Parent↔Student↔later keeps canonical callback/public selection;
  exact provider payload excludes trusted role fields; current constraints,
  helpers, pending/error/success focus, credential clearing/remasking and safe
  Sign in href. Standard select and accepted sign-in tests remain applicable.
- Motion lifecycle: static SSR/no script/unsupported observer, offscreen and
  hidden-tab pause/resume, persistent manual pause and observer cleanup; reduced
  motion removes loops/travel and hides unnecessary motion control. Test
  behavior rather than CSS source spelling; no fake auth timeout.
- Actual browser: existing signup→captured verification→signin→safe return→
  settings/logout and Parent explicit setup/safe continuation, no early role
  grant; generic later registration remains roleless. Add/extend a bounded
  signup-reference College Student callback selection case if not already
  covered by the chosen normal-build journey. Full private workflow/provider
  policy/DB suites are not required solely for this UI change; disclose reused
  unchanged downstream evidence and unrun hosted/private cases.
- Visual: ordinary1440/1280/1024 reference adaptation; thresholds1180/900;
  768/390/320px, short viewport,200% text. Card grows with real selected-booking,
  no-script, pending, safe error and verification notices; one h1/main, no
  horizontal overflow, complete labels/help, no covered/disabled usable action.
- Keyboard Tab/Shift+Tab/arrow selection/Enter, visible focus, radio state and
  44px targets; AA text/control contrast including disabled→enabled transition;
  forced colors, increased contrast, reduced transparency/motion. Axe
  supplements actual keyboard/layout observations. Inspect footer/dock clearance.
- Motion visual evidence: enabled hover/press/arrow feedback; actual7s/6s bob;
  Pause/Resume phase and manual pause after offscreen round trip; static reduced,
  hidden-mobile and no-JS. Simulation of visibility getter/events is distinct
  from actual headed-tab lifecycle acceptance and must be labelled accurately.
- Regression: compare accepted navbar/mobile dock/footer and sign-in/motion
  source fingerprints/appearance; other auth screens retain default. No CSS
  leakage into public/private surfaces or credential/private data in artifacts.
- Operational: None. No migration/provider/deployment/production or live email
  action. Keep credentials, tokens/cookies/private URLs out of shareable captures.
- Expected evidence: independent source Review, exact executed check/build/
  browser results, scoped screenshots, motion/a11y/reflow observations,
  preserved-scope diff/hashes and explicit unrun limits.
- Verification status: **NOT RUN — architecture planning only**.

### Acceptance criteria

1. Signup visibly adopts the supplied centered white-card, dot-field,
   angled-ribbon/floating-decoration composition and navy/teal action at wide
   sizes; actual reference button/bob motion has accessible static/pause paths.
2. All existing account fields, real provider/verification/failure behavior and
   safe next/selected-booking contracts work. All three intents are available,
   generic defaults later, and actual roles/guardian/independent eligibility
   remain downstream trusted operations.
3. Signup remains usable at320px, short heights and enlarged text; complete
   errors/help/controls/focus survive. No document overflow or clipped task.
4. Accepted navbar/footer/sign-in/motion and other auth/workspace screens retain
   current behavior/presentation. No demo record, terms consent, password meter,
   fake success, invented subject/inventory or policy integration is added.
5. Independent Review and separate relevant verification support only this UI
   slice. No whole-M1/M2/launch/provider/production acceptance is implied.

### Context updates and coordinator-owned UI decision text

Architect edits only this canonical blueprint. Before implementation, coordinator
records the signup-local reference exception in `context/ui-context.md` and the
proposed `docs/decisions/2026-10-17-sign-up-reference.md`, using these facts:

> The owner supplied the standalone Create account HTML and requested its UI
> while preserving current functionality/implementation. Authority is
> AUTHORIZED — build-feature delegation through this blueprint, not separate
> human blueprint approval. Adopt the centered rounded white signup card,
> dot/ribbon/category decoration, local sizes/shadow, submit feedback and
> controlled bob motion using current palette/fonts. Keep the accepted navbar,
> shared footer and sign-in/motion unchanged. Account type is later/Parent/
> College Student navigation intent, with original defaults/continuation and
> roleless provider payload. Keep actual fields, hydration/pending/credential
> clearing, verified-email/failure semantics and downstream guardian/independent
> review. No signup legal consent, password meter, fake tutor/session/match,
> demo handlers, new service/dependency or production operation. Motion has
> Pause/Resume, offscreen/tab suspension and static reduced/no-script fallback.

Coordinator's UI brief/design metadata records this single Operate surface and
code-native implementation. Tracker updates belong after meaningful work with
actual Review and verification recorded separately. No PRD/architecture/build
plan behavioral change or milestone checkbox promotion is needed.

### Risks, rollback and open decisions

No unresolved material decision. Main risks: shared-form regression, changing
intent defaults/continuations, accidentally adopting demo consent/role rules,
fake inventory decoration, CSS leakage, static fallback failure and clipping the
taller real form. Use explicit signup opt-in, native radios and unique selectors,
preserve submit/helpers and accepted sign-in files, and keep task flow unbounded.
Rollback reverts only scoped signup presentation/tests/docs; no data restoration
or service rollback. Existing uncommitted navbar/sign-in work must survive.

### Approval gate and handoff

- **AUTHORIZED — build-feature delegation** within the owner's explicit
  2026-10-17 signup UI request and preservation constraints. No separate human
  blueprint approval is claimed or routinely required in this orchestration.
- Material business/safeguarding scope and production/destructive operations
  retain separate gates; none is necessary for this presentation slice.
- Handoff: coordinator implementation → independent read-only Review → separate
  executed verification → Remember. Architect stops at this blueprint.

**Blueprint ready.**

## Owner continuation — compact Create account footer

Authority: **AUTHORIZED — build-feature delegation**, the owner's subsequent
request to remove the large Create account footer and use only the reference's
compact footer. This supersedes shared-footer preservation for `/sign-up` only.

Use a small original-wordmark/copyright row with working Privacy draft, Terms
draft and Help links, thin rule, muted text and responsive wrapping. Existing
policy draft status stays truthful. Keep every other footer and the signup form,
card, motion, navbar, server gate and authentication unchanged.

Minimal structure: PublicShell accepts an optional server-rendered footer slot,
defaulting to its existing SiteFooter. Only the auth layout supplies an exact
`/sign-up` pathname selector with compact/default server-rendered slots. The
small client selector returns the chosen node directly, so semantic footer and
mobile dock spacing remain intact. No route regrouping, CSS-hidden duplicate
footer, provider/data change or client import of the large footer. The compact
footer is server-rendered even without scripts. Other paths retain SiteFooter.

Validate native footer links, one footer per route, direct/no-JS/client
navigation isolation, desktop/mobile/200% text, target/focus/dock clearance,
Axe and existing auth presentation regressions. No database/provider acceptance
needs repeating for a footer-only change. Run scoped tests, check and build;
independent source/finish Review and accurate docs/handoff complete the slice.

## Owner continuation — form interaction motion

Authority: **AUTHORIZED — build-feature delegation**, owner's 2026-10-17 request
to implement reference animations on the Create account form. M1.5 / related
M2.9, AUTH-01/03/05 presentation only. Existing context and child-skill boundaries
remain in force; no unresolved product decision for this CSS-only slice.

Reference evidence: decoded original standalone template input border150ms /
shadow200ms, account option border150ms / shadow200ms / background150ms,
cubic-bezier(.2,.8,.2,1); focus navy border and teal ring; real submission pending
indicator spins800ms linear. Current submit lift/arrow/press and artwork bob
already exist. The reference has no form entrance animation.

Implement only signup-scoped CSS: enabled hover/focus feedback and transition
properties on native inputs/account choices, preserving stronger existing control
borders and focus outlines. Bind a decorative open-ring pending indicator to the
existing real form aria-busy state; hide only its decorative Chevron while busy.
Spin only under no-preference; reduce retains static ring and existing Please
wait text. Busy/disabled controls must not retain stale hover movement or animate
the disabled appearance. Retain selected native radios and instant hydration
state changes. Do not modify AuthForm logic, payloads, validation or credential
handling. No meter/consent/demo timeout/simulated success, entrance choreography,
new dependencies, images, data operation or changes to other pages/footer/navbar.

Separate verification: existing signup/form tests and repository check/build;
production Chromium input/choice hover and focus transition sampling, native
keyboard selection, actual intercepted pending/refusal/retry, same request body
and cleared/remasked password, spinner only during real pending, reduced/static
and no-script/forced-color states, responsive desktop/phone and no overflow/Axe.
Use local anonymous synthetic browser fixtures and no provider/database mutation.
Capture a bounded interaction-state matrix and inspect once, with independent
source/finish review, scoped docs and truthful tracker/handoff. Scope baseline
is saved privately before edits. No commit/merge/push/deployment.

Blueprint ready.

## Owner continuation — remove decorative motion controls on both auth pages

Authority: **AUTHORIZED — build-feature delegation**, owner's next instruction
while verification was underway: remove Pause animation on both Sign in and
Create account. Preserve the newly implemented form interaction effects.

Remove the visible Pause/Resume buttons and their unused CSS from SignInCompanion
and SignUpArtwork. Keep existing native forms, footers, navbar, decorative design,
reduced-motion/no-script fallbacks and offscreen/document-visibility gates.
To avoid uncontrolled automatic motion without a pause mechanism, decoration
runs for at most 4.5 seconds after component mounting, then freezes in place.
Use a small component-local timer beside each existing observer, clear it on
unmount, and latch completion so visibility changes do not restart animation.
Existing original CSS animation timing/keyframes stay unchanged; only the
existing running gate stops them. If observers/scripts are unavailable, artwork
remains static. No generic motion framework, new dependency or server change.

Update existing component tests for no control/hydration, gated playback,
automatic settling without restart, static fallback and observer/listener/timer
cleanup. Controlled fake clocks test the bound without sleeps. Re-run affected
checks/build and final combined desktop/mobile browser captures, checking no
controls, advancing then frozen decorative timelines, retained form effects
and static reduced-motion. Initial form-only check/build/browser/finish ship is
historical evidence for that snapshot, not final combined verification.
Reconcile design/UI/decision/tracker/handoff records for both auth pages; no
commit/merge/deploy. The owner was told decoration runs briefly then settles.

### Scoped finish correction — mobile refusal contrast

The final finish reviewer identified an incumbent contrast defect on the
verified signup failure path: transparent alert text crosses the decorative
ribbon on phones. Authorized targeted recovery adds an opaque existing surface
background through signup-only alert CSS. Preserve exact alert semantics/copy/
focus and all auth logic. Verify same final matrix and explicit mobile alert
surface; no other visual corrections or layout change are authorized.
