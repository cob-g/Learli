# Learli Recovery — Master Workflow Alignment Review Repairs

- Status: APPROVED FOR HANDOFF
- Mode: Targeted Fix
- Severity and environment: Important, local development working tree
- Current branch/commit/deploy: `main` at `3ad1933d3904a06bb11a8b37bc3251dd4106420d` plus preserved tracked and untracked work; no deployment
- Related PRD/build-plan work: M4.4 primary; related M2.3–M2.5, M2.9, M4.5–M4.11, M5.1–M5.6, M5.8–M5.9, M8.3, M8.5, M8.9–M8.10

## Expected versus observed

The approved V2 workflow makes eligible independent adult learner onboarding and confirmed no-money booking self-service while retaining historical admission requests as read-only legacy records.

Independent Review found four bounded inconsistencies:

1. New ordinary self-managed legacy admission requests remain creatable through `/learner-admission/new`, so a fresh adult can still enter the manual-review workflow.
2. Confirmed `local-independent-booking-v2` details still show provisional-deadline language because the presentation special case covers only Parent V2.
3. Active canonical and operational documentation still contains older manual-review and provisional-booking instructions.
4. The implemented independent onboarding heading differs from the approved UI wording.

## Evidence and confidence

- Observed: legacy self intake remains linked and accepted in `src/app/(workspace)/learner-admission/`, `src/features/learner-admission/`, family navigation, and student onboarding precedence.
- Observed: `src/features/bookings/read-presentation.tsx` recognizes `local-parent-booking-v2` but not `local-independent-booking-v2` for direct confirmation copy.
- Observed: conflicting text remains in `context/prd.md`, `context/ui-context.md`, `context/build-plan.md`, and `docs/operations/local-workflow.md`.
- Observed: `context/ui-context.md` specifies “Set up your Student profile,” while the page says “Set up College Student.”
- Observed: Parent-v2 baseline hashes match; migration 0039 is additive; Tutor cancellation/rescheduling remains unchanged; no payment or production behavior was introduced.
- Confidence: Confirmed by independent read-only source review.
- Earlier attempts: initial implementation added the new path and supplemental documentation but did not retire every entry point or reconcile all older active text.

## Root cause or wrong assumption

The implementation added the V2 workflow alongside the legacy workflow but treated legacy preservation as preserving new intake as well as historical reads. The approved contract requires preserving historical records and their detail/review surfaces while preventing new ordinary independent adults from entering the superseded queue. Presentation and documentation used Parent-v2-only special cases instead of the shared direct-confirmation policy set.

## Impact and protection

- Eligible adults can still become blocked in an unnecessary Admin queue.
- Their confirmed bookings can show inaccurate provisional-expiry information.
- Contributors and operators can follow contradictory instructions.
- No evidence indicates data loss, cross-user access, payment activation, Parent-v2 regression, or changed Tutor authority.

All repairs must preserve legacy request reads, policy receipts, booking/audit history, Parent-v2 work, migrations 0038/0039, authorization, concurrency, idempotency, and the complete dirty working tree.

## Recovery recommendation

Apply a targeted, reversible repair within the approved feature:

1. Redirect or disable new ordinary self-managed legacy admission intake and remove current navigation advertisements, while retaining access to actual historical request details and Admin review history.
2. Treat both Parent-v2 and Independent-v2 booking policies as direct-confirmation policies in presentation code, with a regression assertion for Independent-v2.
3. Replace the contradictory active documentation sections with the approved V2 rules and retain explicit legacy-record preservation language.
4. Align the onboarding heading to “Set up your Student profile.”

Do not change schema, rewrite records, remove Tutor authority, activate payments, touch production, reset the tree, or delete legacy routes/data.

## Proposed execution by separate owner

1. Implement the four scoped repairs in the existing preserved tree.
2. Add or update focused tests for retired legacy intake and Independent-v2 booking presentation.
3. Request a fresh independent Review.
4. If Review clears the implementation, run the separate integrated Verification stage.

## Verification required from separate skill

- Fresh eligible adult cannot create a new ordinary legacy self-admission request and reaches self-service onboarding instead.
- Historical admission request detail/review behavior remains available for existing records.
- Confirmed Independent-v2 booking details contain no provisional deadline/expiry language.
- Parent-v2 and legacy-v1 presentation semantics remain correct.
- Canonical context and local operations guide agree with the implemented policy.
- Relevant unit/component/integration suites, typecheck, lint, production build, and isolated PostgreSQL migration/integration checks.
- Status: NOT RUN BY RECOVER

## Required decisions and documentation changes

No new product decision is required. These are corrections within the user-approved blueprint and conditions. Public/minor eligibility, launch-market consent, payment policy, production migration/deployment, and any future Tutor authority narrowing remain separately gated.

## Approval and outcome

- Approval: AUTHORIZED — build-feature delegation; user approved the master workflow alignment blueprint and scoped conditions on 2026-10-18.
- Implementation: The separate implementation stage resolved the four original product/documentation findings. A fresh independent Review confirmed those repairs and found no new product, authorization, privacy, payment or data-integrity defect.
- Independent verification: NOT PERFORMED BY RECOVER

## Second-pass review recovery — missing durable evidence

- Status: APPROVED FOR HANDOFF
- Mode: Targeted Fix
- Observed: the populated migration matrix does not seed pending, authorized, rejected and revoked legacy-v1 self/guardian admissions with their evidence, events, links and bookings before applying migration 0039. Its preservation comparison therefore cannot prove those absent records remain byte-for-byte/semantically unchanged.
- Observed: migration 0039 preserves the existing Tutor cancellation/rescheduling predicates, but the reviewed suites do not exercise successful supported Tutor cancellation and rescheduling through the existing boundary.
- Observed: independent-v2 cross-role coverage denies unassigned Admin access but does not prove the exact-assigned, current-MFA Admin support projection succeeds without granting routine confirmation authority.
- Root cause: implementation focused on new V2 behavior and structural SQL comparison; the blueprint's explicit legacy-state and unchanged-authority test matrix was only partially realized.
- Impact: this is a plan-completeness and regression-evidence gap. Review found no evidence of current record corruption, lost Tutor behavior, or Admin overreach.
- Recommended repair: add only focused migration/integration tests for the missing legacy record matrix, supported Tutor actions, and exact-assigned current-MFA Admin read. Do not change application code, SQL policy, schema, historical data, or product behavior unless a new test deterministically exposes a genuine defect.
- Verification required: run the new cases against the isolated PostgreSQL environment, then repeat independent Review before the full integrated Verification stage.
- Approval: AUTHORIZED — build-feature delegation; these tests are explicitly required by the approved blueprint and owner conditions 1, 6, 7 and 9.

## Verification recovery — repository formatting gate

- Status: APPROVED FOR HANDOFF
- Mode: Targeted Fix
- Observed: the final-tree `npm run check` stopped at `prettier --check .` because `drizzle/meta/_journal.json`, `drizzle/meta/0039_snapshot.json`, and `prompts/features/m4-04-master-workflow-alignment.md` are not formatted according to the repository's installed Prettier configuration.
- Observed: the independently started isolated PostgreSQL regression command completed successfully with five requested cases passed and one unrelated case intentionally excluded by the test-name filter.
- Root cause: earlier targeted formatting checks did not include these generated/planning artifacts; this is a mechanical formatting omission, not a product or architecture defect.
- Recommended repair: run the repository-pinned Prettier writer on exactly those three files, inspect the resulting diff to ensure it is formatting-only, request a narrow read-only re-review, then restart `npm run check` from the beginning.
- Preserve: migration content/hash semantics, journal order, blueprint approval text, all application/test changes and the entire dirty baseline.
- Do not change: code, SQL, schema meaning, tests, product behavior, production or operating data.
- Approval: AUTHORIZED — build-feature delegation; repository formatting is part of the approved Verification workflow.

## Verification recovery — integration invocation and stale timezone fixture

- Status: APPROVED FOR HANDOFF
- Mode: Targeted Fix
- Observed: `npm run test:integration` completed 81 files and 1,102 tests successfully, with 24 environment-gated tests skipped, then exited nonzero for two suites.
- Hosted-auth failure: `tests/integration/hosted-auth.test.ts` requires `LEARLI_STAGING_TEST_PORT`; the ordinary command omitted the dedicated TLS fixture port even though CI and repository operations documents supply one. This is a verification invocation error, not an application defect. Rerun the guarded suite/full command with an unused assigned loopback TLS port.
- Private Admin booking failure: the fixture registered its requester with the schema default account time zone `UTC` but submitted hard-coded `Asia/Manila` to `changePolicyBooking`. The newly approved server rule correctly rejected that stale receipt with HTTP-domain 409 semantics. The test fixture is outdated; production code is behaving as designed.
- Recommended repair: update only the private Admin booking test to obtain/use the authenticated actor's trusted account time zone instead of a hard-coded unrelated value. Do not weaken or bypass server validation. Request a narrow Review, rerun the affected suite, then rerun the full integration command with the required isolated TLS port.
- Preserve: application service, migrations, policies, rate limiting, Parent-v2, historical data and every authorization boundary.
- Do not change: product behavior, server validation, schema/SQL, production/operating data, or hosted test safeguards.
- Approval: AUTHORIZED — build-feature delegation; this is a reversible test-fixture correction and safe local verification invocation within the approved plan.

## Verification recovery — isolated fixture rate-window exhaustion

- Status: APPROVED FOR HANDOFF
- Mode: Targeted verification retry; no implementation change
- Observed: after multiple focused local-operation runs against the same owned port-55434 fixture, the complete local-operation suite passed 35 tests and failed three auth lifecycle assertions because the real provider returned HTTP 429 instead of the expected 200/503.
- Evidence: the failures occur at login/capture setup before the asserted feature behavior; earlier focused migration/workflow/SQL runs passed, and the same fixture's persisted rate counters were intentionally not bypassed.
- Root cause: repeated verification commands consumed the isolated fixture's real authentication rate window. This is temporary test-environment state, not evidence of an application regression.
- Recommended action: do not edit tests, timeouts, rate-limit code or database rows. Allow the natural local rate window to expire, then rerun the complete local-operation suite once. If the same assertions fail after an unconsumed window, reopen recovery as a potential harness/product defect.
- Approval: AUTHORIZED — build-feature delegation; waiting for and reusing the real guard is part of safe local Verification.

### Follow-up diagnosis after the clean-window rerun

- Observed: the clean-window complete suite allowed `auth.test.ts` to pass, then the pagination case in `workflow-services.test.ts` inherited the same real provider rate window and timed out at exactly 60,000 ms. The helper explicitly honors a provider `retry-after` of up to 60 seconds before retrying, while that test's total timeout is exactly 60 seconds.
- Conclusion: waiting alone cannot make the complete ordered suite deterministic; the test timeout contract is shorter than its deliberate retry path. This is a confirmed test-harness reliability defect, not polluted data or a product failure.
- Targeted fix: increase only that pagination test's timeout to the already established 120,000 ms pattern used by the adjacent full workflow case. Retain the real limiter and retry-after handling unchanged. Do not reset rate rows, bypass the provider or widen global suite timeouts.
- Required after repair: narrow read-only Review, then one complete local-operation run proving all files/cases pass together.

## Verification recovery — missing booking-list GET route

- Status: APPROVED FOR HANDOFF
- Mode: Targeted Fix
- Severity and environment: Important functional/API regression, reproduced in loopback Playwright test data only
- Observed: 31 of 32 affected browser cases passed. The revoked-guardian booking-history case received an empty response for `GET /api/bookings?scope=guardian`, so JSON parsing failed before its privacy assertions.
- Root cause: repository history proves commit `07007af` replaced the existing `GET` export in `src/app/api/bookings/route.ts` with the booking `POST` export. The intended read handler and its ownership/error tests remain, but the collection route no longer dispatches GET requests. Next.js therefore returns a method response without the expected private JSON contract.
- Impact: browser/server pages can still read booking history through direct services, but API consumers cannot list their authorized bookings; revoked-link callers also lose the expected empty, non-leaking JSON response. This is a supported contract regression, not an intentional V2 change.
- Targeted fix: restore `GET` in the same route by delegating to `handleBookingRead(await getDomainAuthRuntime(), request)` while retaining the current POST behavior unchanged. Add a focused route regression test proving GET delegates and returns the private read contract; retain existing handler authorization tests.
- Preserve: POST creation, all server ownership checks, revoked-link empty projection, private cache/error behavior, Parent-v2 and Independent-v2 policy routing.
- Do not change: handler/service authorization, schema/SQL, business policy, payments, test data outside isolated environments, or deployment.
- Evidence: `git show 07007af^:src/app/api/bookings/route.ts` contains the GET export; `git show 07007af -- src/app/api/bookings/route.ts` shows it was removed when POST was added.
- Approval: AUTHORIZED — build-feature delegation; booking history/API compatibility and cross-role consistency are explicit approved blueprint requirements.

## Verification recovery — restore drill ran against a stale test schema

- Status: RESOLVED BY ENVIRONMENT ALIGNMENT; no source repair required
- Mode: Targeted local verification recovery
- Observed: `npm run test:restore` initially failed when the deliberate missing-tool scenario tried to read `.local/backup-restore/failure-.../failure.json`; no matching run directory had been created.
- Root cause: the owned `.env.test.local` database had 39 applied migrations and did not contain `public.learner_independent_attestations`, while the working-tree journal and restore inventory included migration `0039_independent_adult_learner`. The restore drill therefore failed closed in `assertSyntheticSource` before it created the per-run evidence directory or reached the injected missing-tool fault. The missing artifact was a downstream symptom of local schema drift, not an evidence-writing defect.
- Classification: local verification environment drift. The restore implementation and test expectation are correct once the owned test schema matches the working tree; weakening inventory/provenance checks would conceal migration drift.
- Recovery: the coordinator ran the existing safe owned-test migration command, `npm run db:migrate:test`, without altering production or user data. A subsequent read-only inspection confirmed 40 applied migrations, 40 journal entries, latest tag `0039_independent_adult_learner`, and the independent-attestation table present.
- Verification: after migration alignment, the unchanged `npm run test:restore` passed its single restore drill test in 7.62 seconds. No restore script, test, migration, guard, or production data was modified for this recovery.
- Future invocation: apply pending migrations to the owned test database before restore verification. Continue treating a pre-artifact failure as an upstream source/schema validation failure rather than fabricating a failure artifact for a run that never acquired its target directory.
- Approval: AUTHORIZED — build-feature delegation; this used the repository's existing local test migration and verification commands only.
