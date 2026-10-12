# M8.7 — Local backup and restore drill

Status: **AUTHORIZED — build-feature delegation**, 2026-10-12. Authority is the
actual six-package local readiness request and Worker 2 dispatch
`task_055dbc98ef0e` / `ctx_0c842ac9f465`; no separate human blueprint approval.

## Outcome and traceability

An operator rehearses recovery of this checkout's synthetic `learli_test`
PostgreSQL database into a newly created disposable cluster, with positive
schema, data, grants, constraints and migration-state evidence. Primary M8.7,
related M8.4; PRD NFR-11/NFR-12. This is a local operational subset, not completion
of hosted backup, retention, SLA, incident staffing or paying-customer readiness.

Baseline: `5634e44fd71e8851400e004de6bbe3554e65eae1`, clean
`cob-g/m8-local-backup-restore` at
`/Users/cob/orca/workspaces/learli/m8-local-backup-restore`.
Read AGENTS.md and its eight canonical lowercase context files in their required
order, plus the root-owned readiness/lessons files in place. Existing
`scripts/local-db.mjs`, `scripts/migrate-local.ts`, Drizzle history and restricted
connection helpers are the source patterns. No terminology or policy decision
blocks this delegated technical slice.

## Scope and invariants

Own new `scripts/local-backup-restore.*`, narrowly named helpers, dedicated tests,
`docs/operations/local-backup-restore.md`, this blueprint and isolated factual
context updates. No package edits, schema changes or historical migration edits.
Root owns package script registration, shared docs/test integration and acceptance.
No main/peer checkout/database access, credentials inherited/copied, stage/commit/
merge/push/deploy, external mail, real identities or further workers.

Only explicit test/local configuration and synthetic `.test` users are accepted.
Prove source filesystem ownership (private regular files, no symlink traversal,
existing setup marker/state) and running server `data_directory`, loopback/port,
role and system identity before reading source records or invoking pg_dump.
Do not widen runtime target validation. Source operations are read-only.

Default assigned source/dev/test ports: 55502/3062/3162. Restore only on 55512 in
a newly exclusive-created directory under this checkout's ignored `.local`.
Reject existing target directories, occupied ports, source/target coincidence,
unsafe paths/configuration and unproved ownership/emptiness. A restored target
never becomes the application source automatically. Generate fresh owner/runtime
credentials; do not archive or replay source role passwords.

## Planned implementation and failure states

1. Add a Node-only CLI/library using existing pg and PostgreSQL 17 tools. Read
   private local test configuration/state rather than arbitrary URL arguments.
   Use bounded safe errors, private artifacts/logs, explicit operation phases.
2. Export a repeatable-read source snapshot; capture ordered per-table row hashes,
   actual normalized schema and ACL/catalog evidence, migration hashes and role
   attributes. Dump custom format against that exact snapshot.
3. Initialize a fresh loopback disposable cluster with an ownership manifest;
   establish server identity and pristine catalog before creating restore roles/
   database. Restore with exit-on-error and a single transaction, without clean,
   drop or overwrite. Preserve dumps/logs/failed target, stop owned target safely.
4. Compare restored rows/schema/grants/roles/database ACL/migrations and validate
   runtime permission denial plus actual constraint enforcement under rollback.
   Success requires comparison and probes, not pg_restore --list readability.
5. Add meaningful unit refusals and a dedicated real-PostgreSQL drill test.
   Document how to inspect failures safely, preserve artifacts and retry with a
   new target; no destructive retry/reset. Update factual progress.

## Verification plan (NOT RUN at architecture stage)

Initial slot B covers pinned `npm ci`, owned local setup/migrations and safe initial
investigation, then release. Request subsequent heavy phases through Orca.
Require root's accepted frozen dependency import before final compatibility.
Run normal test discovery, dedicated unit/refusal checks and complete restoration
proof against actual migrated synthetic data, grants and protected constraints;
run format/lint/typecheck/unit and production build. Browser/viewport checks are
not applicable because no browser/application surface changes. Whole unrelated
integration/browser suites may remain root combined acceptance responsibilities,
clearly disclosed. Tests may not run concurrently against the source DB.

## Acceptance and evidence

- Existing/main/peer/remote/non-test/unsafe targets denied before backup/restore.
- Fresh separate owned cluster restored with exact populated rows and schema,
  restricted runtime grants, constraints/triggers and all migration journal hashes.
- Actual forbidden runtime writes and invalid protected data fail and roll back.
- Private dump/log/config paths and mode checks pass; no secrets/private URLs in
  stdout, tracked docs or shareable report. Failures preserved, no false success.
- Same-agent read-only Review is separate from executed Verify and is not
  independent review. Save exact commands/status/environment/source SHA256
  manifest in `.local/readiness-wave/report.md`; ignored local memory succeeds.

Rollback is stopping only the positively owned drill cluster and preserving its
files. No deletion or destructive down-migration is provided. Production backup
provider features, retention/RPO/RTO, real incident owner and launch authorization
remain OPEN/outside this slice. No governing product/architecture change needed;
append scoped local capability/evidence to build plan/progress only.

## Root-authorized discovery correction — 2026-10-12

Root msg_7943db8618bb allocates `vitest.restore.config.ts` and
`tests/operations/local-backup-restore.test.ts` for this owned-source-only drill.
Existing Docker CI provisions no local cluster ownership marker/state; strict
proof must remain. Therefore use an explicit operations command/config instead
of default integration discovery. Root registers test:restore and db:restore:drill;
no package edit here. Verify operations discovery/execution and normal integration
list exclusion; Docker restore remains NOT RUN, not skipped/passed. This replaces
the initial default integration discovery assumption without changing scope or
source/target safety. Canonicalization/negative proof authority is root
msg_fa86bbc4acb4; only CHECK SQL uses rolled-back PostgreSQL parsing.

## Bounded independent-review recovery F1 — 2026-10-12

AUTHORIZED — build-feature delegation, dispatched repair task_e2bcafb8b671 /
ctx_d56c731f95c7, baseline5634e44 plus the accepted nine-file hash manifest.
Recover diagnosis is recorded in the existing recovery note. Reuse this blueprint;
no policy, dependency, application runtime or schema decision changes.

Cleanup must reconcile actual owned postmaster state after every attempted
startup, including post-start private log failure and pg_ctl nonzero/timeout.
Use a fresh per-run cluster_name token, private PID/data/port/loopback identity
and live process command to refuse foreign processes before stopping. Evidence
writing cannot authorize or suppress a lifecycle action. Keep source guards,
exclusive targets, exact comparisons, no-PASS-on-failure and private preservation.

Add real disposable PostgreSQL regression proof using test-only module mocks:
post-start ENOSPC-like tool log failure and nonzero/timeout startup reporting
while real target is alive, followed by actual stop/PID absence/free port and
preserved archive/no PASS. Existing/foreign target refusal remains mandatory.
Root must explicitly grant the heavy verification slot after implementation and
read-only Review; estimated check plus operations proof is under five minutes.
Root requests independent re-review of revised exact source/package hashes.
