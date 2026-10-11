# Implementation Plan — Booking-linked support and case-scoped investigation

Status: **AUTHORIZED — build-feature delegation**, 2026-10-11. Actual request:
`$build-feature Booking-linked support and case-scoped investigation`, dispatched
under the user's “ok lets do it and spawn agents what you need to spawn” request.
Canonical wave contract `/Users/cob/learli/prompts/features/m5-06-four-feature-coordination-wave.md`
is read-only. This records delegated execution authority, not separate human review.

Repository: `/Users/cob/orca/workspaces/learli/m5-booking-support`; clean baseline
`024dd4d7ce885da7ca391aefeaf4096fc75fc91e`, branch `cob-g/m5-booking-support`.
PRD ADM-03, OPS-05, AUTH-03, BKG-04, NFR-05; build plan M5.6/M5.9.
Read AGENTS.md and the eight canonical context files in its required order;
local M2, synthetic booking and local support decisions govern existing behavior.

## Outcome and scope

An active verified synthetic participant opens the existing support form from an
accessible simulated reservation, saves an optionally booking-linked fictional
case and reads it. The exact currently assigned authorized reviewer sees minimal
live booking context only while that requester is still a permitted participant.
Standalone reports, fixture-only assignment, revisions and status workflow stay.
No terminology clarification or new real-world policy decision is needed.

Exclude learner details/level, guardian contact, meeting links, notifications,
other bookings, replies/chat/notes, live email, refunds/cancellation, production,
real people or incident response. Preserve local/unmonitored/not-emergency wording.

## Decisions and invariants

- One optional immutable association per case in `support_case_bookings`, created
  in the same transaction as the case and creation event. Foreign keys restrict
  deletion; insertion after the creation transaction and retargeting are refused.
- Submission checks current provider-derived session, active verified synthetic
  account, role, active fixture learner and exact self/guardian/tutor relationship
  on its transaction after support serialization waits. No admin bypass.
- Retry fingerprint includes optional booking ID. Same retry returns one case;
  changed association conflicts. A linked retry rechecks current participation.
- Detail context uses a final current SQL authorization snapshot: requester
  identity/relationship, plus viewer current session/access and case ownership or
  exact assignment/admin/support capability. Reviewer cannot review own case.
- Successful reviewer projections append minimal case/booking/actor/action/time
  audit in that same SQL statement; failure exposes no context and creates no audit.
  Assignment tooling's existing case lock serializes case read versus reassignment.
- Return only subject, tutor display name, recorded UTC range rendered using the
  viewer's current account zone, effective simulation state and stored status events.
  Elapsed TTL projects expiry without materializing events. No learner IDs or names.
- Unavailable live projection leaves the existing case readable with generic
  booking-unavailable text. Standalone DTOs retain their existing shape.

## Build sequence and areas

1. Record delegated local choices in a unique decision plus append-only PRD and
   architecture notes before application changes; tracker records partial reality.
2. Add `src/lib/db/schema/support-bookings.ts`, local additive 0013 and restricted
   grants/export hunks. Preserve all migrations 0000–0012.
3. Add `src/features/support-bookings/` permission/projection service and UI;
   integrate existing support service/input/form/entry/detail only.
4. Provide `BookingSupportAction({ bookingId })` linking to `/contact?bookingId=…`
   and exact insertion instructions. Do not edit Agent1-owned booking-detail route.
   Query selection contains only opaque booking ID; form never accepts arbitrary
   learner fields. Denied/malformed association refuses linked submission explicitly.
5. Author meaningful PostgreSQL/race/atomicity/permission tests and browser UI flow,
   add one default Playwright project with sensitive captures disabled.
6. End Implement; read Review skill and perform same-agent read-only review.
   End Review; execute Verify. On failures read Recover, diagnose then repair under
   coordinator authority and repeat affected review/checks. Finish with Remember.

## Verification plan (NOT RUN — Architect only)

Pinned checkout-only npm ci; allocated owned DB55482/dev3042/test3142, PostgreSQL17.
Inspect loopback config without secrets before migration. Fresh dev migration plus
actual test baseline0012→0013 upgrade with preserved row hashes and restricted
grant probes. No main55432 or peer DB. Run npm run check, test:integration, build
and default test:e2e sequentially where DB suites share test data.
Test genuine participant/reviewer flow, wrong IDs/owner/admin-only, role/access/
capability/session revocation, revoked guardians, reassignment waits, idempotent
concurrency/changed payload, rollback without partial association/history/audit,
immutable storage, effective expiry and actual history, safe DTO/cache/metadata.
Check 320/390/768/1024/1440, keyboard/focus, axe, pending/error/unavailable states,
reflow/reduced motion and safe synthetic UI captures. No provider visits/live mail.

## Handoff and limitations

Root reconciles schema export, grants, migration number/journal, Playwright project,
canonical docs and detail CTA insertion. Own candidate remains uncommitted.
Report exact changed/untracked paths and SHA256, contracts/commands/results/logs
in ignored `.local/four-feature/report.md`; save ignored untracked memory preserving
history. Same-agent review is not independent; root supplies independent review.
Rollback means disable linked surfaces while preserving records, no down/reset.
Real consent/safeguarding/incident owner/legal/retention/commercial/production gates
remain OPEN and this work is not merge or public-launch readiness.
