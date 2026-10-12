# Local booking lifecycle — Task A

Date: 2026-10-12. Status: AUTHORIZED — build-feature delegation; coordinator frozen 2026-10-12 (Orca ask response).
Authority: AUTHORIZED — build-feature delegation, dispatched task_500a97b964f7 / ctx_75c9a34ef7de; implementation additionally waits for coordinator freeze.
Baseline: 0494f6b4cd1044ebebb89f0d41b1b706cb851352, clean cob-g/m4-local-booking-lifecycle checkout.
Parent: /Users/cob/orca/workspaces/learli/m4-local-completion-integration/prompts/features/m4-10-local-completion-wave.md (unchanged coordinator reference).

## Outcome / requirements

Both UI and backend/database: M4.5/M4.9/M4.10, BKG-01–07 local subset. Eligible family actors cancel a future live synthetic reservation or atomically move it to another available interval with the same tutor/learner/subject. Preserve current creation policy (60-minute duration, 30-minute starts, 60-minute notice, 14-day horizon, 10-minute expiry). Synthetic administrative completion supplies review eligibility without attendance/payment claims. No notification/review implementation, real policies, cloud, mail, commits or nested workers.

## Proposed concrete contract (coordinator must freeze)

- State union: demo_reserved, demo_expired, demo_cancelled, demo_replaced, demo_confirmed, demo_completed. Cancellation/rescheduling apply to future live reserved or fixture-confirmed rows. Default app creation stays reserved. All live states retain saved expires_at; confirmation does not renew TTL. Completion is an owner-only historical synthetic fixture after end_at, never runtime clock override or attendance claim.
- Immutable bookings retain every original request/schedule/time-zone/expiry field. Add logical_booking_id (root ID, default current id), replaces_booking_id (nullable unique predecessor), revision (default 0). New row preserves logical ID, increases revision, retains original expires_at, and references predecessor. Existing IDs backfilled to own logical ID, all baseline facts remain.
- Active exclusion expands to reserved/confirmed. Previous active row becomes replaced and new row insertion share one transaction; exclusion failure rolls everything back. At most one live logical head via partial unique constraint. No general UPDATE expansion; only state update retains trigger guards.
- Append-only booking_lifecycle_events with id, logical_booking_id, booking_id, replacement_booking_id, actor_user_id, event (cancelled/rescheduled/confirmed/completed), request_id, request_fingerprint, created_at. Unique actor/request plus transition provenance. Existing booking_events baseline remains immutable and provides reserved/expired facts; current detail combines both event streams for logical history. No meeting URL/contact/free text in event.
- Request {requestId, expectedRevision}; reschedule adds canonical startAtUtc/endAtUtc/displayTimezone. Opaque booking ID in path; exact payload hash binds retries. Current authorization rechecked even on replay. Same concurrent request yields same result; differing payload/key conflicts; differing stale revisions fail. B/E consume committed lifecycle events keyed by immutable event UUID and logical ID; review one per logical ID.
- Tutor-first -> current booking FOR NO KEY UPDATE -> actor NO KEY UPDATE -> learner/session/subject SHARE, READ COMMITTED. Final fresh SQL after every wait checks session expiry, active verified .test actor/trusted role, current authorized guardian/self relation, active fixture learner, approved active verified .test tutor/trusted tutor role, current active subject/offering/level. DB clock TTL/future-start evaluated after waits. Current candidates exclude the replaced row only while locked. Retry deadlock/serialization at bounded count; no return before commit.
- Eligible family student/parent may mutate only current head; assigned tutor sees history/current projection but cannot cancel/reschedule. Admin has no bypass. Reads preserve original detail, show replacement navigation, current head appears in dashboards; retired rows in history. Meeting-link access immediately invalidates retired row and never transfers its private URL to replacement; fresh link required. Time-off/availability/public previews count all unexpired reserved/confirmed rows.
- Admin fixture tooling proposed under owned bookings feature, guarded loopback/.test/local owner connection. Completed historical fixture root+events is explicit and nonpublic; no arbitrary future completion, real customer or no-show handling.

## Tradeoff

Replacement rows keep original idempotency and schedule immutable and avoid broad runtime updates. Consumers must distinguish physical reservation ID from stable logical booking ID; current lists use the head, original detail/history remain accessible. This makes rollback and link invalidation explicit.

## Affected areas

src/features/bookings; private booking pages/API routes; schema/bookings.ts; reserved forward0017; narrow runtime grants; meeting/time-off/public-availability/dashboard/support projections only for state compatibility; scoped tests. Root final owner schema index/journal/snapshots/shared registrations/context reconciliation. No0000–0016 edits.

## Verification plan (NOT RUN — architecture only)

Pinned npm ci; own DB55811/dev3081/browser3181/disposable55711. Lease before heavy work. Check/build; actual PG cancel, reschedule success/conflict rollback, identical/differing retry races, two logical-head attempts, overlap and expiry/role/session/guardian/tutor/subject changes during waits; forward migration preserves baseline and runtime mutation/history denial. Browser phone390/desktop1440/narrow320, keyboard, axe, no-JS, current dashboard, conflict/pending/stale outcomes, private URL invalidation/navigation/session privacy; no external provider visit. Preserve failures and scoped recovery then re-review/affected verification. Report source hashes/evidence separately from same-agent read-only Review. Save ignored memory preserving history.

## Context / gates / next consumer

Read AGENTS and eight canonical context files in order; ORCHESTRATION-LESSONS. Own factual tracker after implementation; root governing-doc reconciliation before integration. Real confirmation/payment/consent/attendance/cancellation/no-show/safeguarding terms remain OPEN. Next consumer root freeze, then B/E exact-hash provider bundle after scoped verification.

## Coordinator freeze amendments

Cancellation checks current family/session/learner authority and live future head only, even when tutor/subject no longer eligible. Rescheduling additionally requires all current tutor/subject/availability checks. Runtime promotions/TTL renewal are prohibited. Retired terminal states never become expired merely because TTL elapsed. Replacement booked_by_user_id remains original creator; inserted physical request key is generated internally, with canonical create fingerprint for its new interval, while lifecycle actor/request fingerprint is the retry authority. Old physical-ID retries return saved replacement result, after current authorization, even if expired or later retired. Root owns staging-verifier updates; no assertions weakened. Heavy lease1 granted for sequential own setup/check/PG/build/browser; release explicitly.

## Final coordinator technical refinements

Root-directed DST observation repair scopes the unchanged exact expected time to the saved detail region; native disclosure/no-JS behavior stays unchanged. Root source review requested public-qualified trigger row types/relations plus fixed pg_catalog/public function search_path for possible staging TEMP rights. Supported Drizzle FK/index/revision/event-check metadata now mirrors already-enforced SQL; logical ID uses an insert-time NULL default function so DB trigger fills the root without inventing a persisted SQL default. Provider-v1 is superseded, before B/E consume it. Preserve original child v1 migration journal stamp; report explicit owned qualified-function amendment separately from true fresh/populated source-v2 migration proof. Root final0017 not applied. No product/policy/state/TTL/grant widening.
