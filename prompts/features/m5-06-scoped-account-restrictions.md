# Scoped and audited local account restrictions

## Authority and baseline

**AUTHORIZED — build-feature delegation**, 2026-10-11. Actual user execution
request: "ok lets do it and spawn agents what you need to spawn", dispatched as
Agent 3 in the canonical read-only four-feature wave contract at
`/Users/cob/learli/prompts/features/m5-06-four-feature-coordination-wave.md`.
This is delegated execution authority, not separate human blueprint approval.

Own checkout `/Users/cob/orca/workspaces/learli/m5-account-restrictions`, clean
branch `cob-g/m5-account-restrictions`, HEAD
`024dd4d7ce885da7ca391aefeaf4096fc75fc91e`. Allocated loopback ports:
PostgreSQL 55483, development 3043, browser test 3143; no listeners observed.
Read AGENTS.md and eight canonical context documents and relevant local identity,
booking, support and notice decisions. Required child skills are present.

## Outcome, language and trace

UI + backend + database, M5.6; ADM-04, AUTH-03, NFR-05. An active verified admin
with owner-provisioned exact staff-to-target authority can inspect only authorized
synthetic account summaries, suspend/restore one target, and see its minimal
immutable transition history. Account access and tutor review status are separate.
No terminology clarification or unresolved local product decision is required.

## Decisions and invariants

- Preserve existing `user_access.status` and session records. No new auth provider
  endpoint, session revocation, tutor approval, booking cancellation or restoration.
- Owner-only fixture target registry proves explicit provisioning, independently
  of `.test` email and support assignments. An exact pair grant has authorized or
  revoked state. Runtime cannot insert/update targets, grants or action history.
- Target registry has a monotonic revision, initially zero. Minimal action events
  retain actor, target, request UUID, expected/result revision, prior/new access,
  bounded local reason and database time. No free text, contact or learner fields.
- Local reason choices: `local_access_test`, `local_review_test`,
  `local_restore_test`; labels explicitly say simulation and make no misconduct
  finding. Suspend uses the first two; restore uses the last.
- Narrow `SECURITY DEFINER` PostgreSQL function, fixed `pg_catalog` search path,
  qualified tables, no public execute and runtime execute only. Actor/session
  arguments come from provider-resolved identity, never request fields. Function
  validates current session/account/admin, provisioned synthetic non-admin target,
  self exclusion and exact current grant after target lock waits.
- Target registry then target access lock serializes revisions/status; pair grant
  share lock excludes concurrent owner revocation while authorization is used.
  Owner grant/revoke follows the same target-first order. Revocation committed
  before the final authorization check denies; already authorized work may finish.
- Exact replay returns its original result without new history. Changed payload
  under the same actor/key conflicts. New stale requests conflict; status no-op
  with a new key is rejected, so every saved event is an actual transition.
- Scoped list/detail use final current session/account/admin/grant/target checks
  in one SQL statement. History is limited/paged; foreign/missing/self/admin targets
  have the same unavailable response. No user search or private relationship joins.

## Implementation sequence

1. End Architect; record local choices in decision, PRD and architecture notes.
2. Add proposed `src/lib/db/schema/account-restrictions.ts`, schema export,
   additive local 0013 migration/snapshot/journal and narrow runtime grant hunk.
   Never change 0000–0012. Keep base user_access columns unchanged.
3. Add `src/features/account-restrictions/` strict input, scoped read/mutation
   service, safe handler and owner-only tooling. Add explicit trusted CLI using
   the existing private fixture manifest; do not seed automatic staff authority.
4. Add `/admin/accounts` and `/admin/accounts/[targetId]`, minimal API boundaries,
   additive admin nav. Await server content for native no-JS list/detail/GET
   navigation; mutation client progressively confirms with native dialog keyboard
   semantics, bounded reason, pending feedback, retry/conflict/error/success focus.
5. Author real PostgreSQL permission, mutation, rollback, replay and race cases;
   exercise current booking/read/profile/discovery/sign-in guards using stored
   cookies and preserve historical data. Password-change interaction belongs to
   root's final combined verification after Agent 4 integration.
6. End Implement; read Review, inspect exact diff read-only. Then separate Verify;
   use Recover for failures and repeat relevant review/verification after repairs.
7. Update factual tracker, save ignored memory preserving prior content and
   `.local/four-feature/report.md` with exact file hashes/contracts/evidence.

## Verification plan (NOT RUN during Architect)

Install locked dependencies in own checkout. Use existing local-db script only
with PG_BIN PostgreSQL17 and allocated ports; verify loopback/port/db/user mode
without printing credentials. Fresh development migration and real seeded test
0012→0013 upgrade must preserve all existing table values. Assert constraints,
fixed search path/function execute restrictions, no blanket account status update,
and runtime denials for target/grant/history mutation.

Run `npm run check`, serialized `npm run test:integration`, `npm run build` and
default `npm run test:e2e -- --workers=1` including all baseline cases and a new
sensitive project with trace/screenshots disabled. Test forbidden self/admin/
unprovisioned/foreign targets, revoked grant, revoked actor role/status/session,
stale concurrent writes, identical retry, changed payload, atomic rollback and
lock-wait revocation. Test stored sessions surviving suspension while booking,
participant reads, profile/learner edits, discovery/bookability and new sign-in
deny; restoration leaves tutor review and booking/event history intact.

UI: populated/empty/denied/error/conflict/pending, phone390/desktop1440/320px
overflow, axe, keyboard confirm/dismiss/focus, noindex/private-cache, native no-JS
reads. Capture only sanitized settled synthetic UI, never entered credentials.
Retain command/exit/log/hash evidence and disclose unrun checks. No real provider
visits, mail or production operations. No commits/push/merge/nested workers.

## Ownership and handoff

Own new feature/schema/tooling/routes/tests/blueprint/decision paths. Shared hunks:
schema export, 0013 numbering/journal/snapshot, migrate-local grants, Playwright
project, admin nav, PRD/architecture/build-plan/tracker notes. Root reconciles
those and performs independent combined reviews. Send concrete schema/API
contract and owned paths; version/hash before any requested import. Same-agent
Review is not independent. Disable the new surface to roll back; keep history and
data, no destructive down migration. Real appeals, incident policy, retention,
consent, safeguarding, commercial and production gates remain OPEN.
