# Local feature completion wave

Date: 2026-10-12. Status: AUTHORIZED — build-feature delegation.
Baseline: main `0494f6b4cd1044ebebb89f0d41b1b706cb851352`.
Run: `run_844502b13426`. Integration: `cob-g/m4-local-completion-integration`.

## Authority and outcome

The user requested the remaining local features before deployment, authorized
agents and safe parallel work, and explicitly deferred payments. Earlier model
preference remains GPT-6.1 Sol with High effort. This authorizes local planning,
implementation, testing, scoped recovery and handoffs; no new commit/merge/push,
cleanup, provider operation, deployment, real-user onboarding or external message.
The user delegated ordinary product decisions to the coordinator in this session.
All new demo choices are coordinator-delegated synthetic behavior, not real
booking, review, consent, safeguarding, legal or financial terms. Payments stay
idle: no checkout, gateway, paid flag, manual-payment approval flow or refund.

Build six isolated work packages covering the seven non-payment feature areas
identified in the preceding code audit. At most three workers run concurrently;
at most two heavy check/build/browser/integration workloads run concurrently.
All implementation workers must read/use `$build-feature`, all eight canonical
context files in order, AGENTS.md and ORCHESTRATION-LESSONS.md. No nested workers.

## Scope and dependencies

A. M4.5/M4.9/M4.10 — synthetic booking lifecycle, cancellation and atomic
rescheduling. PRD BKG-01/02/03/04/05/06, with BKG-07 local administrative fixture
outcomes only if needed for review eligibility. Own all booking states, locks,
constraints, immutable event/revision/idempotency contracts and cross-feature
booking projection compatibility. Preserve old records and request identity;
failed changes preserve the original valid reservation. No arbitrary UPDATE or
DELETE grants and no attendance/payment claim. First publish a short lifecycle
contract and ask root to freeze its bounded local semantics before implementation.
Confirmation/completion must be visibly simulated and never stand in for payment
or external attendance. Keep existing default creation timing until root records
any explicit demo-only amendment; do not independently prolong abandoned holds.

B. M5.7/M5.8 — local captured booking lifecycle/change notices, after A's frozen
verified provider bundle. PRD OPS-04. Durable post-commit events, current recipient
checks, stable retries, no private learner/meeting details, safe stale suppression.
Preserve original creation notices. No actual email, Resend calls or scheduler.

C. M4.4 — synthetic learner creation/onboarding. PRD FAM-01/02, AUTH-03.
Only existing active verified synthetic role holders: parent creates a minimal
synthetic learner plus authorized local fixture relationship atomically; existing
student creates their own College Support fixture. This is an explicitly local
relationship demonstration, not verified guardian proof or adult/minor eligibility.
No role self-escalation, arbitrary linking to existing children, DOB/school/contact
collection, real consent capture, deletion or production route enablement.
Existing view/edit and ownership rules remain. Duplicate/retry/concurrency checks.

D. M5.9/M5.6 — synthetic support assignment/reassignment/escalation interface.
PRD OPS-05/ADM-03. Require narrowly provisioned local dispatcher authority and
case scope, plus eligible provisioned reviewers; never global admin browse/grant.
Record minimal immutable audit, stale-write/retry behavior, and immediately
recheck former/new reviewer's access. Escalation means an explicit local reassignment
workflow, not a human response promise. No private messages, notes, email,
self-granted capability or real incident response. Existing report/status flow stays.

E. M5.10 — private synthetic booking-backed reviews and moderation, after A.
PRD OPS-06. Eligible locally completed fixture only, current participant and
trusted narrow moderator authorization, one review per logical booking,
idempotency/stale-state handling and audit. Local test rating/text/moderation
choices must be recorded as demo-only; no publication on public tutor pages,
public rating aggregate, fabricated social proof or real attendance claims.
Coordinator freezes eligibility with A before implementation; safe fixture tooling
may demonstrate completed states without a clock shortcut in application code.

F. M6/PUB-05 — truthful policy surfaces and decision visibility. Add /privacy,
/terms and /cancellations as clearly labelled preparation/draft information,
linked from existing UI; distinguish implemented local behavior from unresolved
real policy. No invented retention/age/refund/jurisdiction promises, consent
checkbox/acceptance or assertion of legal compliance. No-index draft surfaces.
Record exact outstanding decisions instead of presenting placeholder rules as law.

Initial ready wave: A, C, D. Later B and E consume A only after root accepts a
source manifest; F can use the next available slot. Root owns shared navigation,
package/config/test-registration reconciliation and canonical status reconciliation.
Independent read-only combined review follows assembly, with separate verification
and any scoped repairs. No seven-way competing edits to booking/schema files.

## Isolation and shared files

Names A=m4-local-booking-lifecycle; B=m5-local-lifecycle-notices;
C=m4-local-learner-onboarding; D=m5-local-support-assignment;
E=m5-local-private-reviews; F=m6-local-policy-surfaces.
Ports in A/B/C/D/E/F order: DB55811–55816, dev3081–3086,
browser3181–3186, disposable staging55711–55716. Integration uses
DB55819/dev3089/browser3189/disposable55719. Main55432 and other projects excluded.
Fresh npm ci and local setup; never copy peer secrets/env/database/build outputs.

Final integration migration order is reserved A0017, C0018, D0019, E0020;
B requests the next number if needed. Isolated independent branches must use the
next contiguous local ordinal (0017 at baseline) with a feature-specific suffix;
dependent branches use the next ordinal after their accepted imported provider.
Root renames only new SQL files and reconciles journal/snapshot metadata on import,
preserving SQL bytes and0000–0016 historical files. This avoids intentionally
invalid gap journals: the existing staging parser requires idx/tag continuity. Root reconciles journal
indices/snapshot chains, schema exports and runtime-grant hunks in integration;
no worker imports peer changes without root's source-hash contract. Shared
scripts/runtime-grants.ts and schema/index.ts may contain only essential own-scope
hunks; root is final owner. Preserve original staging tooling invariants, updating
only through coordinator-owned integration if new migrations require it.

## Definition of done and evidence

Each worker saves a canonical child blueprint with delegated authority, implements,
performs read-only scoped Review, separately runs Verify and Recover as needed,
updates its own tracker, and saves ignored memory preserving history. Report exact
files/hashes, acceptance coverage, migrations/grants, executed commands/results,
original failures, exclusions and next consumer in .local/local-completion-wave/.
Ask root for a heavy-work lease before full check/build/PG/browser runs. Independent
light inspection and implementation can continue while waiting. No tests that
weaken identity, permission, TTL, rate-limit or lock behavior to get a green result.

Relevant evidence: format/lint/types/unit, real-PG ownership/conflict/race/retry,
forward migration and grant denial, build, actual phone/desktop UI and browser
navigation/session privacy for changed user flows. Root performs combined journeys,
full integration, scope-sensitive browser suite, source freeze, independent review
and final privacy audit. Keep public evidence sanitized. Physical devices, real
provider acceptance, customer policy and launch remain unverified/gated.

## Documentation

Root updates PRD/architecture and decision records for new local exceptions before
integration of dependent behavior, and reconciles build-plan/tracker by evidence.
Do not check off a full milestone because a synthetic local subset passes.
Parent verification status: NOT RUN — blueprint only at creation.

### Root compatibility implementation

The staging protection verifier must evaluate the applied migration prefix in
order: final function replacement bodies and dropped/recreated triggers retain
one exact definition. Deferred constraint triggers must match enabled status,
row/event timing, table/function, conditional/column/argument absence and exact
deferral flags. Unsupported protection DDL fails closed. New booking constraint
and runtime function grant inventories remain explicit and reviewed after source
freeze; neither historical SQL nor strict drift detection is relaxed. Verify old
prefixes, forward/fresh combined migration and changed/disabled/conditional or
wrong-deferral drift against actual PostgreSQL.

Root also owns the cross-feature navigation: no-learner dashboard/booking CTAs,
a saved booking result details link, and optional creation-success continuation
back to a previously selected public tutor/subject/level/time. Accept only the
existing selectionFromReturnPath/bookingSelectionHref contract; never arbitrary
redirects or private learner identifiers in next URLs. The booking service must
revalidate availability and ownership after onboarding. Root combined browser
evidence covers this continuation, stale selection and private fields.

The private review demonstration contract is frozen in the wave decision record
(rating 1–5, optional 1000-character text, ended completed fixture, author-only and
exact moderator reads, always-private moderation, no self-review/publication).

Task B's frozen extension consumes actual lifecycle events in a separate narrow
queue, preserving created revision0 notices and suppressing stale logical states.
Task E's frozen moderation reconsideration and manifest-owned historical fixture
preparation contracts are recorded in the wave decision under Frozen dependent
notice and review implementation contracts. These are local implementation
choices under delegated authority, not commercial policy or completed evidence.

## Verified local closeout — 2026-10-12

All six bounded slices implemented and integrated on cob-g/m4-local-completion-integration. Independent ACDF/UI/server reviews found no confirmed findings; later exact negative-email fixture cleanup had a separate root same-agent scoped review. Final check 974, full PG 575 plus affected cleanup 57, production build, default Chromium 140 and 22-migration exact backup/restore passed. Final new SQL numbers: 0017 lifecycle, 0018 onboarding, 0019 support, 0020 reviews, 0021 notices; previous SQL and dependency pins preserved. Detailed evidence, original failures, limitations and next operator action are recorded at context/progress-tracker.md under Local completion wave — verified candidate. Payments remain deferred. The result is uncommitted local code, not a production policy, main merge, migration or deployment authorization.

## Commit and merge closeout — 2026-10-12

After local verification, the user explicitly instructed “okay commit and merge.” This supersedes the earlier no-commit/no-merge boundary for the accepted local candidate only. Feature commit `185cb94ead1a1101227d23f8c0f359725600ffcb` was fast-forwarded into local main, with all 165 candidate paths verified against the frozen source manifest before and after merge. Existing local verification evidence is retained for that exact feature source. Main database migration, worktree/branch cleanup, remote push, deployment and provider operations were not performed. Payments remain deferred and real-user launch decisions remain open. See the latest merge entry in `context/progress-tracker.md`.
