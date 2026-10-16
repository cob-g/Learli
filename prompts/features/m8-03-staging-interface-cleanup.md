# M8.3 — Remove demonstration content and prepare owner-tested staging

## Implementation Plan — Learli staging interface cleanup

### What we are building

Remove demonstration content from the website and prepare an isolated staging
environment where the owner can create their own accounts. Preserve an admin
identity and all security controls. This is not authorization to turn simulated
reservations, guardian evidence or screening into real operating records.

### Requirement and milestone mapping

- Primary work package: M8.3 (environment/data separation); related M8.2, M8.8,
  M2.9, M3.7 and M5.3–6.
- PRD: PUB-01/03/04, AUTH-01/02/03/04, OPS-01/02/03, ADM-01/02/04;
  BKG-01/03 and FAM-01/02 remain subject to their existing operating gates.
- Repository: `/Users/cob/learli`, clean local `main` at
  `572cf4d6ad2cfccc6c1041bac49fcf129e11401e` at reconnaissance.
- Proposed branch: `feature/staging-interface-cleanup-20261016` (not created
  during architecture planning).
- Read AGENTS.md and all eight canonical context files in its required order.
  Existing historical evidence is not fresh verification of this change.

### Language and authorization

User request on 2026-10-16: remove simulation testing/creation and website
simulation content, prepare staging, and remove existing accounts except admin
so the owner can create test accounts.

**AUTHORIZED — build-feature delegation**, limited initially to independent
interface cleanup (Part A). This records authority from the actual request,
not separate human inspection or approval of this blueprint.

Part B's parent workflow direction was subsequently selected: on 2026-10-16 the
owner approved the recommendation to complete the parent registration → child →
tutor → booking → dashboard journey, then retire its legacy simulation screens.
The first independent unit is authorized in
`prompts/features/m2-04-parent-onboarding.md`. Dependent intake/booking policies,
target-specific account cleanup and hosted activation remain **BLOCKED** on the
concrete decisions/targets below. No deletion, provider write or deployment is
authorized by this planning document itself.

The owner subsequently approved the recommended Steps 5–9 acceptance checklist
on 2026-10-16: Parent/Tutor dashboard consistency, tutor-provided private meeting
link, authorized external joining, manual audited completion after the scheduled
end and accurate history, with cross-account denial tests. See the acceptance
extension in the parent blueprint and `docs/qa/parent-tutor-session-checklist.md`.
This records expected behavior without claiming implementation or choosing the
remaining operating, completion-actor or provider-target policies.

### Decisions made and assumptions

- Remove authored sample testimonials entirely; hiding their disclaimer would
  falsely present them as customer reviews.
- Use ordinary account language in account access/settings screens. Keep exact
  `.test` address requirements and truthful mail outcomes while those remain
  runtime contracts. Do not enable real email addresses by changing labels.
- Keep automated regression tests by default: the request concerns website
  simulation. The owner has been asked whether test tooling was also intended;
  no test suite will be deleted based on that ambiguity.
- Keep real booking, payment, guardian, screening and launch safeguards.
- No new dependencies, provider abstraction, schema migration or business rules
  are required for Part A.

### Scope

**Part A — independently implementable now**

1. Remove the sample-review section/imports from the public home page in every
   environment, including staging and local development.
2. Move fabricated carousel examples out of application source into test-owned
   fixtures, preserving existing carousel/hydration verification.
3. Remove the now-unused sample-preview environment helper and replace its
   obsolete tests with meaningful home-page absence coverage.
4. Change “Create test account”/“Test email” to ordinary account labels;
   remove synthetic-account banners from account and session settings. Describe
   actual email-address restrictions without simulated-customer claims.
5. Update affected existing test selectors; retain their behavioral assertions.
6. Update UI context and progress with actual implementation and evidence.

**Part B — parent journey approved; dependent policy/target decisions pending**

- Inventory and remove simulation-only booking/admission/review/screening
  navigation, direct page access and mutation entry points, or implement a
  separately approved usable replacement. Removing labels alone is insufficient.
- Replace dashboard simulation summaries with truthful empty/unavailable states
  and repair public profile/auth continuation paths to avoid dead links.
- Prepare exact isolated Railway/Neon staging configuration. Verify that manual
  account creation/verification and admin assurance actually work at that target.
- Produce a target-bound account cleanup preview preserving trusted admin
  membership, credentials/factors as appropriate, and recoverable data history.
  Execute only on the identified authorized environment with recovery evidence.

Excluded: production changes, payment enablement, live minor onboarding,
invented operating policies, seed/reset of shared data, blanket deletion of
audit/booking history, redesign, and removal of regression coverage.

### Current source and provider evidence

- `src/app/(marketing)/page.tsx` renders authored `sampleReviews` whenever
  `previewContentAllowed()` accepts development/test/staging.
- `src/features/home/sample-reviews.ts` explicitly says nobody supplied the
  testimonials. Its other consumers are carousel/hydration component tests.
- `src/features/auth/auth-frame.tsx`, `auth-form.tsx`, sign-up and account/session
  pages expose synthetic/test account labels.
- `src/app/(workspace)/bookings/demo/page.tsx`, public profile picker,
  family/tutor dashboards, learner creation/admission and readiness routes expose
  simulation workflows; these are not made real by copy changes.
- `src/lib/auth.ts` selects local domain runtime separately from hosted account
  runtime. `src/lib/env/schema.ts` permits hosted-synthetic auth only in staging.
  Hosted accounts require an explicit `.test` allowlist and grant no roles.
- `docs/operations/w3-hosted-auth.md` and staging/deployment runbooks describe
  additional ingress/mail/provider acceptance; the presence of tooling does not
  establish a deployed staging environment.
- Safe Neon metadata inventory on 2026-10-16 found the Learli project has
  `learli-local-development` and `production` branches, with no staging branch.
  No private application records or credentials were read; no provider writes.
- Account relationships include RESTRICT references and immutable histories
  (e.g. tutor profiles and booking lifecycle/review events). A blanket user DELETE
  is not an acceptable cleanup strategy.

### System invariants and data/authorization changes

Part A changes no database schema, identity eligibility, roles, ownership,
account validation, MFA, session lifecycle, mail transport or booking behavior.
Public content must remain truthful with an empty catalog and no actual reviews.
Private pages remain noindex and protected by their current guards.

Part B must preserve admin access, least-privilege runtime grants, auditable
history and environment separation. Never use production as a testing target or
disable constraints/triggers to erase fixtures. Do not copy active sessions or
encrypted factors across unrelated auth secrets without a reviewed recovery plan.

### Workflow and failure states

Existing account failures, pending state, verification/reset outcome wording,
safe return paths and `.test` restrictions remain in Part A. Public catalog
failures continue to differ from an honest zero-tutor state. No fabricated
testimonial should be rendered under either state.

Part B direct URLs and APIs must be covered as well as navigation; legacy
simulation pages must not masquerade as real reservations. Existing supported
tests must remain isolated on loopback PostgreSQL, never the Neon development
connection or staging.

### How to build it

1. End architecture planning; coordinator creates the proposed scoped branch.
2. Run focused existing presentation/auth component tests as a local baseline.
3. Implement Part A; retain test fixtures only under `tests/` and adapt exact
   accessible-name selectors without weakening assertions.
4. Review actual diff against this authorized Part A, then separately verify it.
5. Record evidence and local handoff. Keep remaining scope explicitly pending.
6. After answers, return to Architect to amend Part B before dependent code/data
   or hosting operations. Existing authorization persists; do not request routine
   reapproval of already clear Part A.

### Verification plan for the separate verification stage (DO NOT EXECUTE HERE)

- Focused Vitest home, carousel/hydration, auth form and account presentation
  tests before/after; ensure no sample testimonial is rendered in any APP_ENV.
- Repository `npm run check` (format, lint, typecheck, unit/component).
- Test-environment production build via `scripts/with-test-env.mjs`, using an
  isolated output directory if needed to preserve the owner's running dev server.
- Relevant isolated Chromium auth, account/session and public-page journeys;
  hosted-auth test fixture for changed hosted account copy. Update related E2E
  selectors and retain full security/permission assertions.
- Inspect desktop/mobile home and account-access forms for layout/labels and
  absence of fabricated content. No live mail or real accounts.
- Part A DB/concurrency business changes: none; no new database mutation test is
  warranted for copy changes. Existing regression suites remain available.
- Part B requires target-specific recovery/cleanup readback, direct-route/API
  denials, auth/roles and staging smoke evidence after its scope is resolved.
- Verification status: **NOT RUN — architecture planning only**.

### Acceptance criteria

- Part A: no sample testimonials in website HTML under any environment; generated
  examples absent from application data; account creation/access has ordinary
  labels while validation and failure behavior stay intact; relevant checks pass.
- Full request: all simulation creation/UI entries removed or replaced under an
  explicit scope; authorized target contains only intended admin identities
  before owner-created accounts; isolated staging URL and working account flow
  are actually verified. Part A alone does not satisfy the full request.

### Context updates and rollback

Update `context/ui-context.md` to retire public sample testimonials, and
`context/progress-tracker.md` with exact scope/checks and remaining blockers.
Update architecture/operational docs only when their facts change. The Part A
source diff is reversible; no data restoration is involved. Account cleanup
requires its own retained backup and target-bound recovery plan before execution.

### Risks and open decisions

1. Owner: which database should lose non-admin accounts — current Neon
   development, or a separately isolated staging target? Required before deletion.
2. Resolved direction: complete the normal parent journey before retiring its
   legacy simulation screens. The owner's approval does not select missing
   guardian or booking policies. Parent enrollment is independently authorized.
3. Retain automated regression tests, consistent with the subsequently approved
   recommendation to add a full parent-journey browser acceptance test.
4. Hosted target/account: identify exact Railway account/environment/service and
   isolated Neon staging target; two Railway connector accounts exist, so do not
   infer write destination. No staging database was found in the Learli inventory.
5. Manual account creation is currently `.test`/allowlist-bound, roles are not
   granted at signup, and email/provider ingress acceptance remains distinct.

### Approval gate

- Part A: **AUTHORIZED — build-feature delegation**, actual user request above.
- Parent enrollment: **AUTHORIZED — build-feature delegation**, subsequent owner
  approval; see `prompts/features/m2-04-parent-onboarding.md`.
- Dependent workflow/data/hosting scope: **BLOCKED — material answers pending**.
- No claim of implementation, tests, account removal, push or deployment follows
  from this blueprint.

## Subsequent owner decision — completion actor

The owner's “yes ;approve ur recommmendation” on 2026-10-16 resolves the actor
question recorded above: assigned tutor, after the scheduled end, with an audit
record. The bounded implementation blueprint is
`prompts/features/m5-05-assigned-tutor-completion.md`. This supersedes only the
actor uncertainty. The remaining guardian/booking and staging-target decisions
and the broader journey are still pending; no provider activation is inferred.
