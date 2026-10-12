# M5.7/M5.8 — Local booking lifecycle notices

Date: 2026-10-12. Authority: AUTHORIZED — build-feature delegation.
Status: AUTHORIZED — build-feature delegation; exact design accepted by coordinator
on 2026-10-12 through the live Orca ask reply. No separate human blueprint approval.
PRD: OPS-04. Repository: m5-local-lifecycle-notices.
HEAD baseline: 0494f6b4cd1044ebebb89f0d41b1b706cb851352, initially clean.
Provider baseline: coordinator A-consumer-bundle, manifest of42 exact files, imported
unchanged as explicitly dirty prerequisite; provider-A-v2 contract governs states.
Parent reference (unchanged source):
/Users/cob/orca/workspaces/learli/m4-local-completion-integration/prompts/features/m4-10-local-completion-wave.md.
Required context: AGENTS.md, the eight canonical context files in their listed order,
ORCHESTRATION-LESSONS.md, architect/review/recover/remember at their stages.

## Outcome and scope

An owned bounded loopback manual invocation captures minimal synthetic cancellation,
rescheduling and owner-fixture confirmation/completion notices from committed immutable
lifecycle events. Preserve revision0 creation notices. Replacement creation events
must not produce duplicate creation captures. No actual email/Resend/scheduler,
real policies, paid/attendance claims, user notification endpoint or recipient override.
No A service/lifecycle redesign; unchanged original10-minute TTL and logical identity.

## Data and integration

Proposed own schema: booking_lifecycle_notification_deliveries, event_id restrict FK
booking_lifecycle_events.id, recipient_user_id restrict FK user.id, composite PK
(event_id,recipient_user_id,kind). Four bounded simulated lifecycle kinds; same
pending/captured/suppressed, monotonic attempts, finite timestamps and immutable
identity/terminal protection as existing delivery table. Queue trigger executes
atomically with actual lifecycle event insertion; recipients UNION creator and current
assigned tutor, no copied content. Replace original queue function to require
bookings.revision=0. Original table/data/FKs remain intact. Forward local0018,
root final0021; historical0000–0017 provider preserved. Root reconciles snapshot,
journal, schema exports and grant additions. Runtime SELECT and narrow state/attempt
UPDATE only, no arbitrary insertion/deletion, no new callable SECURITY DEFINER grant.

## Authorization, freshness and failure behavior

Reuse the independent connection dispatcher: committed visibility, READ COMMITTED,
queue row lock SKIP LOCKED, one bounded page per call, one total limit25 across both
queues. Own resolver derives current participant scope with active verified .test
account, roles, active fixture learner/current authorized guardian or self ownership,
current approved assigned tutor, valid account IANA zone. Queue creator/tutor only,
no additional guardians/admins. Current logical head must match event target;
rescheduled/confirmed notices require corresponding current live state and original
TTL, cancelled/completed remain terminal notices with current participant checks.
Fixture-confirmed superseded by completed is suppressed. Old pending creation and
moved notices suppress after later transitions. No learner/contact/meeting details
enter HTML; safe authenticated detail link only. No secrets/private detail logging.

Stable file identity includes actual event/account/kind. Capture failure preserves
committed lifecycle state and pending retry; capture-before-ack failure can retry
same artifact. No exactly-once filesystem/DB claim. Existing captured artifacts
remain immutable historical captures, not a claim of present state or access.

## Implementation sequence

1. Coordinator freeze exact proposed schema/semantics; record accepted authority.
2. Own forward SQL/schema/essential grants; shared metadata local append only.
3. Minimal recipient adapter and reused delivery/capture/template handling.
4. Meaningful unit, actual-PG negative/concurrency/commit/retry/staleness cases;
   real browser capture keyboard/current authorization/phone/desktop/privacy.
5. Update own tracker/docs; read-only same-agent Review; separate executed Verify;
   Recover scoped defects, review/rerun affected checks; Remember preserved history.

## Verification plan (not executed in Architect)

Pinned npm ci, owned DB55812/dev3082/test3182/staging55712. Heavy lease before
full check/build/PG/browser, sequential checks within checkout. Full npm run check,
production build, focused real PG existing and lifecycle notice/provider suites;
fresh migration/grants and populated0017→0018 preservation. Prove queue FK,
source/runtime grants, terminal identity denial, uncommitted rollback invisibility,
parallel drains, logical/event dedup, current revocations, stale notices, .test only,
failure/ack retry, no learner/meeting/private values. Browser320/390/1440 with axe,
keyboard authenticated link, stale detail and logout/relationship denials; captures
visually inspected. Shared staging inventory failure is reported, never weakened.
Root runs combined full integration/restore/default registration/independent review.

## Documents and handoff

Own tracker and minimal operation note; root owns PRD/architecture/build-plan and
wave decision reconciliation. Report at .local/local-completion-wave/report.md,
manifest.json separating provider baseline/own hashes/authorized metadata delta;
ignored memory.md preserves prior history. Next consumer: root integration owner.
Completion requires current scoped Review ready, executed applicable checks,
truthful limitations and memory. No commit/merge/push/cloud/deploy or peer data.

## Final compatibility clarification

Coordinator accepted normal PostgreSQL63-byte truncation of generated PK/FK
identifiers, already present in baseline. SQL/schema remain unchanged; report
declared/catalog aliases, unique names and correct valid definitions. Root owns
final metadata and combined actual catalogue verification. No migration amendment.
