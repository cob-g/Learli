# Registration request and verification feedback

- **Status:** AUTHORIZED — build-feature delegation, 2026-10-17.
- **Authority:** The user requested understandable registration errors and a
  dedicated loading/verification state after finding the current “If this
  address can be registered…” inline notice confusing. The build-feature
  coordinator delegated this bounded implementation; the user has not separately
  reviewed this generated blueprint.
- **Primary work package:** M2.9 — Secure auth UX; related M2.3 — Better Auth
  fundamentals. The coordinator-requested filename does **not** designate the
  unrelated M2.1 database connection package.
- **PRD:** AUTH-01/02/03/05; NFR-01/02/05/09/11; §14.2 form UX.
- **Repository:** `/Users/cob/learli`; observed branch
  `feature/desktop-navbar-reference-20261017`, HEAD
  `616e8c734acebec0f7b51c5f96fb182dc4001d93`, with substantial existing dirty
  navbar/auth/parent work. Preserve all of it. No branch creation is required by
  this plan.
- **Architecture activity:** read-only inspection and this handoff only. No
  implementation, tests, browser QA, progress update or operational change ran.

## What we are building

A visitor submitting Create account can distinguish correction, a real pending
request, a received registration request and recovery from an error. A successful
provider response replaces the signup fields with a stable, focused verification
panel inside the existing card. It explains the next action without claiming an
account was created, email was delivered or the visitor is verified. The existing
verification link, sign-in and safe onboarding/booking continuation remain intact.

## Required context and inspected evidence

Read `AGENTS.md`, then the eight canonical context files in its order:
`project-overview.md`, `architecture.md`, `ui-context.md`, `code-standards.md`,
`ai-workflow-rules.md`, `progress-tracker.md`, `prd.md`, `build-plan.md` under
`context/`. Also retain the approved reference in
`docs/decisions/2026-10-17-sign-up-reference.md` and its blueprint
`prompts/features/m1-05-signup-reference.md`.

Current source evidence:

- `src/features/auth/auth-form.tsx` owns all five auth modes, current pending
  disablement, immediate password clearing/remasking, status focus, account intent
  and callback construction. Only signup currently ends in the confusing inline
  notice; the fields remain visible after that response.
- `src/features/auth/sign-up-layout.tsx` and `sign-up.css` own the accepted signup
  card, header, scoped controls, native choices and real pending spinner.
  `SignUpArtwork` retains its existing 4500ms settling/visibility behavior.
- `src/lib/local-mode.ts` exports the client-safe `syntheticEmail` predicate.
  `src/lib/auth-handler.ts` already rejects non-`.test` or disallowed addresses
  with generic 400; hosted membership cannot be inferred in the client. Hosted
  message-disabled mode returns 503 before registration dispatch.
- `src/lib/auth-options.ts` requires email verification, disables auto sign-in,
  permits passwords of 12–128 characters and sends verification links on signup.
  `src/features/hosted-auth/composition.ts` requires a nonblank display name of
  at most 100 characters. These are existing rules, not new product choices.
- Installed Better Auth **1.7.7**
  (`node_modules/better-auth/dist/api/routes/sign-up.mjs`) returns successful
  `token: null` plus a synthetic user for an existing address under this exact
  configuration. A returned user object therefore proves neither creation nor
  a new verification message. Keep that enumeration protection.
- Installed `@better-fetch/fetch` returns failed HTTP results as `data: null`,
  `error: { ...safe-or-unsafe-body, status, statusText }`; provider errors can
  include `code`. Network exceptions can throw. Never render raw `message`,
  `statusText`, nested errors or returned user fields.
- `src/features/hosted-auth/mail-attempt.ts` explicitly allows uncertainty:
  account changes may already be saved when message dispatch fails. An error
  must not promise that registration was rolled back.

## Language and decisions

No terminology clarification or business decision is needed for this slice.

- **Received:** the signup request returned success. It does not mean a new
  identity, delivered email, verified email, role, learner or booking exists.
- **Pending:** the actual signup promise is unresolved. Keep the existing
  accessible pending ring and disabled form; do not simulate progress or add a
  minimum display delay.
- **Verification:** use the existing email **link** and callback, not an OTP.
- **Dedicated state:** replace fields in the current card, rather than creating
  a new route. This is the smallest complete solution and avoids putting email
  addresses or completion assertions into URLs, storage or server state.
- Keep completion local to the mounted form. Refresh restores the normal entry
  form; no persisted success receipt, polling, email-delivery check or automatic
  verification detection is introduced.

## Scope and invariants

Included: signup field feedback for current constraints; safe signup HTTP/error
classification; actual pending feedback; dedicated received/verification panel;
explicit next actions; focused accessible error/status behavior; corresponding
regression updates and scoped documentation.

Excluded: changing sign-in/reset/resend behavior, provider configuration, server
handlers, DB/schema/migrations/grants, packages, email transports, OTP, automatic
resends, real-account intake, policies, role grants, deployment or Git operations.

- Preserve the exact four-field provider body (`name`, `email`, `password`,
  `callbackURL`) and existing callback `/sign-in?verified=1&next=…` construction.
- Preserve Choose later / Parent or guardian / College Student intentions,
  default selection, nested safe return handling and full public booking choice.
  Signup and verification never grant Parent/Student or guardian authority.
- Preserve all other auth modes, both reference UIs, navbar, compact footer,
  artwork lifecycle, reduced-motion/forced-color/no-script behavior and document
  privacy guards. Do not restart or extend decorative loops for completion.
- Passwords are cleared and remasked **before an actual provider request** and
  never copied into state, notices, URLs, storage, captures or diagnostics.
  Rejected local validation does not call the provider or unnecessarily discard
  correct nonsecret fields. Preserve the existing credential exposure limits.
- New and duplicate successful requests render the same state and actions. Do
  not branch on synthetic `result.data.user`, query account existence or reveal
  whether the address is registered/allowed in a hosted membership set.
- No database or authorization change. No production operation. Existing
  development-only `.test` restrictions and real-user/payment gates remain.

## Workflow and failure states

1. **Editing/correction:** preserve native labels, required/type/length constraints,
   autocomplete and account choices. Signup validates the existing nonblank name,
   email format/254-character bound, `.test` restriction and 12–128-character
   password before dispatch. Use `syntheticEmail` for the environment rule; do
   not invent a different domain parser, strength rule or hosted allowlist.
   Errors appear at their field with `aria-invalid`/`aria-describedby`, plus a
   focused concise summary when needed. Keep password help associations intact.
   If native validation is bypassed for custom messages, scope that choice to
   signup and preserve its constraints and inert prehydration form.
2. **Submitting:** one actual in-flight request. Clear/remask the credential,
   disable choices/fields/toggle/submit, expose `aria-busy` and a polite explicit
   request-in-progress message. Preserve the current spinner/static reduced-motion
   alternative. Guard repeated submits synchronously; a disabled button alone
   does not guard form-event retries. Do not claim the email is being delivered.
3. **Received:** remove the input fields/submit and stop all request-pending
   feedback. Show a prominent **“Verify your email”** heading and a focused
   **“Registration request received.”** status. Keep one page h1; the panel may
   use h2. Use short paragraphs rather than the old single conditional sentence.
   Recommended local copy: “For a new account, open the verification link in the
   local test mailbox, then sign in.” Explain that local test messages are
   captured rather than sent to an inbox. Recommended hosted copy: “For a new
   account, use the verification link for the address you entered, then sign
   in.” Add plain truthful wording that this screen does not confirm delivery;
   do not claim private capture or sending when the boolean cannot prove which.
   Shared recovery: “Already have an account? Sign in or reset your password.”
   Final wording may improve readability while retaining these exact semantics.
4. **Next actions:** offer Sign in using the same safe `returnTo`; a clearly named
   existing `/verify-email?next=…` link for requesting another verification link;
   existing password-reset recovery; and a “Use a different email” button returning
   to editing. Avoid duplicate help links with identical accessible names. Do not
   append email/password to any URL. Editing again retains the chosen intent and
   continuation and starts with an empty masked password.
5. **Known field/provider error:** only whitelist installed, non-enumerating
   `INVALID_EMAIL`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG` (and a password-only
   `INVALID_PASSWORD` if useful) into plain field instructions. Example: “Enter a
   valid email address”, “Use 12–128 characters”. Local `.test` feedback explicitly
   explains the preview restriction. Do not reinterpret every 400 as bad email.
6. **429:** explain too many attempts and ask the visitor to wait before retrying;
   no invented countdown or retry timing header.
7. **5xx/503, thrown network error or unknown refusal:** return to actionable error
   state, retain nonsecret input/intent and leave password empty/masked. Use safe
   copy such as “We couldn't confirm that your registration request finished.
   Try again, or sign in if you already have an account.” Offer verification/reset
   recovery where useful. Do not show raw provider data or promise no account was
   created. Unknown 4xx/duplicate-specific codes stay non-enumerating fallbacks.

## Affected areas and implementation sequence

1. Capture the root's existing baseline before edits. Restrict source changes to
   signup branches of `src/features/auth/auth-form.tsx` and, if necessary,
   signup-scoped rules in `src/features/auth/sign-up.css`. A small client-safe
   feedback helper/component under `src/features/auth/` is optional if it keeps
   the shared component clear; proposed new names are implementation choices.
2. Add the explicit editing/submitting/received behavior and accessible focus.
   Build safe signup validation/classification without changing other modes or
   importing server configuration into the client.
3. Render the dedicated terminal panel with existing semantic tokens and real
   destinations; preserve header/card/artwork/booking context. No replacement
   outer page composition or new UI theme is needed.
4. Extend meaningful component/provider/browser regressions below. Update old
   copy-based observations to the new stable state while retaining every payload,
   continuation, ownership, credential and workflow assertion. Add
   `tests/e2e/registration-feedback.spec.ts` and register it in the existing `auth`
   project's `testMatch` in `playwright.config.ts`; change no other project or
   fixture behavior. The scoped execution config below is private ignored QA
   material, not a replacement committed runner configuration.
5. Separate Review, executed Verify and factual documentation follow through the
   build-feature coordinator. Architect stops after this file.

## Verification plan — separate verifier; DO NOT EXECUTE in Architect

- `npm run check` and `npm run build` using the repository's pinned toolchain.
- Component coverage: pending promise; rapid duplicate submit; success stops
  pending and removes fields; standard/reference and local/hosted completion;
  duplicate-shaped/fresh-shaped success renders identical copy/actions; focus;
  empty/invalid/non-`.test`/nonblank-name/length correction; code-less wrapper
  400; known field code; 429; 503; unknown error; thrown network error; retry;
  password clear/remask; different-email reset; exact callback and Parent/College
  Student/full-booking continuation. Include no raw provider detail/credentials
  in rendered feedback or new browser storage/URLs.
- Existing relevant component files include `sign-up-presentation.test.tsx`,
  `parent-onboarding.test.tsx`, `hosted-auth-form.test.tsx` and the sign-in
  presentation/verification tests under `tests/components/`.
- Run the existing real PostgreSQL `tests/integration/auth.test.ts` via
  `npm run test:integration -- tests/integration/auth.test.ts`; it already
  establishes non-enumerating signup/reset responses and existing verification,
  required-write/role/session boundaries. New UI does not justify DB changes.
- Run `tests/e2e/auth.spec.ts`, `tests/e2e/hosted-auth.spec.ts` and the new
  `tests/e2e/registration-feedback.spec.ts` with the existing registered `auth`
  and `hosted-auth` projects, `--no-deps --workers=1`, once the owned loopback/TLS
  fixtures and current build are ready. Use an ignored private scoped Playwright
  config under `.local/registration-feedback-20261017/` that imports the canonical
  config and retains those registered projects, with only the required local
  authentication app and hosted HTTPS auth fixture web servers. Omit the
  unrelated readiness mirror; preserve the selected projects' actual settings,
  test discovery, global auth setup and privacy-safe recording limits. Record
  the actual private config path and exact command in verification evidence.
  Keep provider journeys separate from intercepted presentation/error cases.
  Prove fresh signup → captured verification link → existing sign-in callback →
  safe return, plus the full targeted signup state/error contract above. Preserve
  Parent enrollment and College Student intent. Component continuation cases,
  actual auth/hosted-auth journeys and the real PostgreSQL auth integration suite
  cover this changed boundary and unchanged provider/permission contracts.
- Copy-dependent observations also exist in `tests/e2e/auth.spec.ts`,
  `hosted-auth.spec.ts`, `private-fictional-security.spec.ts`,
  `private-fictional-workflow.spec.ts`, `learner-admission.spec.ts` and
  `tests/support/private-student-browser.ts`. Update only success observations
  that need the new state; the honest local explanatory paragraph may retain
  compatible “verification message” wording, conditional on a new account.
  Do not retain an unconditional creation/delivery claim just to preserve a text
  matcher, or relax any business/security assertion. Full downstream private,
  admission, screening and booking journeys are **NOT RUN for this slice** when
  their only change is an observation of signup success copy: their business
  behavior is unchanged, and exercising their independent fixture stacks is
  disproportionate to this auth UI boundary. State that scope and rationale in
  the final evidence rather than claiming those journeys passed. Any additional
  behavior change or discovered regression requires targeted verification of
  the affected downstream boundary.
- Visually inspect correction/pending/received/error at 1440/390/320px, keyboard
  focus/next actions, 200% text, reduced motion, forced colors and prehydration/
  no-script disablement. Check visible pending announcement, zero overflow and
  appropriate contrast. Capture screenshots only with credentials removed and
  no verification/reset tokens or private customer content.
- Preserve the single root preview on port3000 until the coordinator's final
  authorized build/restart. Automated verification uses owned isolated local
  test resources, never production Neon or the development preview database.
- **Verification status: NOT RUN — architecture planning only.** Record actual
  commands, failures, pass counts, screenshot paths and limits downstream.

## Acceptance, documentation, risks and rollback

Acceptance: the user can tell the request finished, understands that verification
is next for a new account, has usable recovery actions, sees understandable safe
correction/errors, and never waits on a completion spinner. Duplicate and fresh
responses remain indistinguishable; all existing callbacks, permissions,
credential hygiene and accepted reference/motion behaviors remain.

Downstream update `context/ui-context.md` with the authorized signup received
state and truthful wording, superseding only the earlier inline-feedback detail.
Update `context/progress-tracker.md` with actual implementation/Review/Verify
evidence and limitations. No PRD, architecture, build-plan, schema, dependency or
operational change is required. Never mark the whole M2 or hosted launch complete.

Risks: UI copy can accidentally claim account creation or sent email; shared
AuthForm edits can alter unrelated modes/continuation; success unmounting can
break focus or stale tests; generic 400 lacks safe field attribution; existing
dirty work must survive. All are addressed by the bounded contract and checks.
There are **no unresolved material decisions blocking this slice**.

Rollback: restore only this task's scoped UI/test/document hunks against the
captured dirty baseline. No provider, DB, email, migration or external rollback is
needed. No commit, merge, push, production operation or deployment is authorized
by this blueprint.

**Blueprint ready.** Return to the coordinator for separate implementation,
Review, Verify and Remember stages.
