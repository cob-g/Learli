# M5.5 — Assigned tutor completion after the scheduled end

Status: **AUTHORIZED — build-feature delegation**, 2026-10-16.

## Owner decision and scope

The owner answered “yes ;approve ur recommmendation” to the specific choice:
the assigned tutor can mark a session completed after its scheduled end, with an
audit record. This resolves the completion-actor decision in BKG-07; it does not
approve real-family intake, other booking terms, a staging target, deployment,
payment or deletion of accounts. It is not separate human review of this generated
blueprint. The approved Steps 5–9 checklist remains the acceptance reference.

Primary work: M5.5, related M5.4/11 and BKG-04/07, OPS-02/03, MEET-02/03.
Repository `/Users/cob/learli`, branch
`feature/staging-interface-cleanup-20261016`, base `572cf4d` plus the verified
Parent onboarding and interface cleanup and the approved checklist documents.
Preserve all those uncommitted changes. All eight canonical context files were
read earlier in this ongoing workflow; relevant policy/source sections were
reconciled for this decision. Use their unchanged rules.

This independent unit implements and tests the completion software path without
activating the shipped booking/admission/screening factories. The app currently
supports only `local_simulation` and `synthetic_readiness` booking sources. Never
rename such records into real sessions or silently enable their fixed test terms.
Production/staging integration of the full normal journey remains separate work.

## Established behavior and minimal correction

- `src/features/booking-workflows/policy.ts` has an immutable v1 test policy whose
  completion and no-show actors are assigned MFA administrators.
- `drizzle/0025_booking_workflows.sql` enforces that actor in the database through
  `has_booking_workflow_task`; the mutation, post-write assertion and receipt use
  this same boundary. Terminal mutation requires confirmed state and end<=now.
- Existing service requires admin assurance for confirm/complete/no_show; private
  participant details have no tutor completion control.
- Policy receipts are immutable. Preserve v1 rows, digests and behavior. Add a
  distinct v2 capability with `completionActor=assigned_tutor`, retaining the
  existing admin confirmation/no-show terms. Only test-owned composition may
  select these test capabilities; the shipped factory remains disabled.

## Intended behavior and invariants

1. Only the booking's currently assigned, verified, active and eligible tutor
   with a current session may complete a v2 confirmed booking, after its saved
   scheduled end. Role alone and submitted actor/booking state are insufficient.
2. Completion is administrative, not externally verified attendance. Ending a
   call, a page view or passage of time does not itself mark completed.
3. Persist one completed state transition, actor, database timestamp, revision
   and event atomically. Preserve notification intents and history. Repeating
   the same request is idempotent; conflicting or stale requests are rejected.
4. Parents, unrelated tutors, admins without this v2 actor entitlement, stale
   sessions and revoked/ineligible actors cannot complete. Retain current
   guardian and tutor-screening checks; recheck after waits and before commit.
5. v1 remains admin-only. Confirmation and no-show actions remain admin-only in
   both versions. No new admin override/correction policy is inferred.
6. Current row locks, constraints, receipt validation, origin/JSON bounds,
   safe errors, private URLs and no-JS mutation safety remain in force.

## Implementation plan

1. Record the actual owner decision in the decision record, PRD, architecture,
   checklist and build-plan/tracker. Supersede only the open completion actor,
   keeping the other policy and environment decisions visible.
2. Add a strict discriminated v1/v2 policy representation. Keep the exact v1
   digest input unchanged; include the v2 completion actor in its digest. Add
   only the corresponding v2 version/reference shape to the policy table check.
3. Generate additive migration 0033 and snapshot/journal. Preserve every prior
   SQL/snapshot. Replace only `booking_workflow_policy_current` and
   `has_booking_workflow_task`, keeping owner/search-path/execute ACLs intact.
   The former validates exact v1/v2 terms; the latter adds only the current
   assigned-tutor complete entitlement under v2 and excludes v2 admin completion.
   Existing authoritative mutation/receipt guards reuse that decision.
4. Service requires ordinary current identity for v2 tutor completion only; keep
   all other admin assurance branches unchanged. Add a guarded tutor-completion
   read for the private detail page, showing the control only for an authorized
   confirmed booking whose scheduled end has passed. An unavailable/disabled
   capability yields no new control; actual mutation always rechecks independently.
5. Reuse the existing idempotent workflow mutation/form. Tutor control says
   “Mark session completed”, returns to tutor-scoped details, and explains the
   administrative outcome. Keep admin form labels and behavior for v1 unchanged.
6. Extend only test-owned policy fixtures to opt into v2. For browser coverage,
   the existing five-factory loopback mirror may load its booking capability
   from an owned private fixture packet on each request. Default packet remains
   v1. A final serial v2 scenario switches/restores that packet and policy head
   in `finally`; no production capability loader or public policy API is added.
7. Preserve pinned historical migration proofs. Tests that inspect the latest
   candidate account explicitly for the two replaced functions, while retaining
   exact metadata/ACL/history checks. Add fresh/populated0032→0033 proof, v1
   receipt/data preservation and strict current protection/grant verification.

## Proposed affected files

- Policy/service/forms/model/private booking-detail feature and
  `src/lib/db/schema/booking-workflows.ts`.
- Proposed migration `drizzle/0033_assigned_tutor_completion.sql` and generated
  snapshot/journal; exact generated filename to be recorded after generation.
- Existing policy unit/integration/migration/browser tests and test-only
  `tests/support/booking-workflows-fixtures.ts`, five-factory mirror script.
- Proposed focused tutor-completion PostgreSQL tests and presentation component
  when useful. No new package/dependency, worker, external API or database role.

## Verification plan — NOT RUN during Architect

- Existing v1 digest/validation and admin-only completion tests still pass.
- v2 rejects missing/forged completion actor, invalid digest/version/reference,
  extra trusted fields and use outside isolated test composition.
- Actual restricted PostgreSQL: assigned tutor success, exact audit/event/state,
  parent/tutor shared read/history, duplicate/concurrent retry, early/provisional/
  cancelled/expired/wrong-tutor/parent/admin/no-role/session/policy/screening denial,
  audit failure rollback and deterministic current-authority recheck after a lock
  or after mutation before receipt. Ordinary success and other actions unchanged.
- Fresh and populated0032→0033 preserve prior rows, policy receipts, ledger and
  function owner/config/ACL metadata; exactly the intended definitions change.
  Current staging grant/protection verifier remains strict.
- Actual browser: historical synthetic confirmed v2 fixture with guarded test
  records → assigned Tutor detail → enabled completion control after end →
  persisted completion → Parent detail/history. Test duplicate and forbidden
  request paths plus phone/desktop keyboard/axe/no-JS states. This is not a
  fresh full parent onboarding/booking or external attendance test.
- `npm run check`, actual isolated policy/migration integration checks, required
  broader PostgreSQL regression, test-env build and affected browser projects.
  Compare against preserved 842-file Parent-unit evidence; record current results.
- Never migrate Neon/provider targets, send real mail, conduct external calls,
  delete accounts, commit, merge or deploy as part of this unit.

## Review, compatibility and handoff

Same-agent read-only Review, then separate Verify; repair and re-review scoped
failures. Record exact evidence, limitations and earlier attempts in progress.
Save the local ignored memory handoff without truncating history.

Additive rollback: application can return to v1/default-disabled behavior while
retaining immutable v2 receipts and recorded history. Do not delete policy/event
records to roll back. Any provider activation requires its own exact target and
reviewed migration/recovery evidence.

The completion actor no longer needs approval. Remaining guardian, booking
duration/hold/confirmation/cancellation, meeting-reuse and real-family/staging
target decisions are not selected here. Keep them closed in the shipped runtime.

## Scoped verification repair — Parent setup contrast

The broader browser run observed a contrast failure on the preserved Parent
setup button during its disabled-to-enabled hydration color transition. Reuse
`transition-none` on that one control, as existing guarded auth/workflow forms do.
This is a behavior-preserving adjacent accessibility repair under build-feature
authority, not a new product decision. Keep the axe check and native safety gates.
See `prompts/recovery/2026-10-16-tutor-completion-validation.md` for the actual
failure and required re-review/reverification; no result is inferred here.

## Executed implementation result — 2026-10-16

The bounded software unit is implemented and locally verified. Same-agent
read-only Review/re-review passed; separate Verify passed check (1,770/119),
focused PostgreSQL 28/3, full PostgreSQL 1,033/71, rebuilt test-env production app
and a final single 71/71 selected Chromium run. Initial browser failures and the
two scoped repairs are retained in the recovery note and private evidence.
All 853 final program/test/migration/config hashes and 66 prior migration/snapshot
hashes match. Exact commands, environments and limitations are recorded in
`context/progress-tracker.md` and
`.local/tutor-completion-20261016/verification.json`.

This is not activation of a normal staging journey, manual external-call QA,
provider migration or public-launch acceptance. Existing disabled factories and
remaining policy/target gates still apply; 0032/0033 are unapplied to the current
Neon development preview. Work remains uncommitted, with earlier work preserved.
