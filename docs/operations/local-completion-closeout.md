# Local completion wave closeout

Date: 2026-10-12. Explicit user scope: main local database migration, completed
worktree/branch cleanup and remote push. Feature source is `185cb94`; prior merge
record is `eccd9d6`. Payments remain deferred.

## Main local databases

Both `learli_dev` and `learli_test` belong to main's existing PostgreSQL cluster
on `127.0.0.1:55432`. Verified configuration, ownership marker, actual data path,
listener, roles, absence of competing client sessions and exact historical SQL
hashes before running the reviewed migration scripts. No hosted target was used.

- Created private synchronized custom-format backups at migration17 and checked
  complete archive readability. Actual restoration into a fresh owned cluster on
  port55532 then proved the 32 original tables, 42 development /54 test rows,
  all17 migration entries and original protection functions/triggers. The fresh
  target was stopped and its files retained; no existing database was overwritten.
- `npm run db:migrate` and `npm run db:migrate:test`: **PASS**. Both now have22
  migrations, through0021, and44 public tables. No seed or reset was run.
- Compared every original column value across all32 pre-existing tables before
  and after migration: **PASS**. Booking logical IDs, initial revisions and absent
  replacement links were backfilled correctly. No prior record was removed.
- Exact protection checks: **24 functions /21 triggers**, booking constraints and
  logical index **PASS**. Each database passed **1,192 column /176 table /24
  function** privilege checks, **6 denied permission /3 integrity** probes, and a
  further unchanged-data check after rollback. Main PostgreSQL remains running.

Evidence is private under `.local/local-completion-closeout/`: per-database
`*-before.json`, `*-before.dump`, `*-migration.log`, `*-after.json`, and
`restore-main-backups-v2/result.json` plus its stopped-target receipt.

Two failed temporary helper attempts are preserved. The initial catalog query
returned PostgreSQL domain arrays as strings; casting column names to text fixed
inspection before any backup or migration. The first restored-row comparison
used the new cluster's Asia/Manila session while the baseline used UTC; explicit
UTC serialization on a new isolated restore target passed. Neither repair changed
runtime code, SQL migrations, data, permissions, or comparison requirements.

## Worktree and branch cleanup

All nine supervised tasks had settled successfully and been released. Verified
Orca workspace bindings and actual OS process ownership; closed one unused
integration shell and stopped only the seven feature-owned PostgreSQL clusters.
No main or other-project process was stopped. The separate EduSphere workspace
remained active on the same identity after cleanup.

Archived and removed through Orca:

- `m4-local-booking-lifecycle`
- `m4-local-completion-integration`
- `m4-local-learner-onboarding`
- `m5-local-lifecycle-notices`
- `m5-local-private-reviews`
- `m5-local-support-assignment`
- `m6-local-policy-surfaces`

The corresponding `cob-g/` branches were removed. Git now lists only main's
worktree and branch. Each physical removal was observed after Orca accepted it;
no duplicate removal was issued while cleanup was in progress.

Archives under `.local/archives/local-completion-2026-10-12/` preserve every source
file, uncommitted child contribution, handoff, private configuration, stopped
PostgreSQL data directory and verification artifact. Only reproducible root
`node_modules`, `.next` and `tsconfig.tsbuildinfo` were excluded. Every archived
file/link matched its source manifest; receipts include archive hashes. This
preserves child drafts and intermediate evidence beyond the accepted merged
source instead of assuming branch ancestry covers uncommitted work.

For convenient access, final integration reports, logs and manifests are also
copied to `.local/local-completion-closeout/integration-evidence/`. Prior references
to the removed integration path are historical; use this preserved location.
Archives and raw evidence are ignored, private local material, never push input.

## Remote publication and limits

Publication is authorized to the existing Git remote `origin` for
`github.com/cob-g/Learli`, branch `main`, using a normal fast-forward push. The final
head/ref comparison is recorded in `.local/local-completion-closeout/push-receipt.json`
and the local handoff after the push; repository status documents do not substitute
for that observed result. No other remote branch deletion or force push is needed.

The recorded974 unit/component,575 PostgreSQL plus57 affected rerun,140 Chromium,
production-build, privacy and integration restore results remain evidence for
the unchanged feature source. This closeout adds migration/restore/cleanup proof,
not a fresh full-suite or remote-CI pass. No hosted migration or deployment was
performed. Production provider checks, real-user/legal/safeguarding decisions,
public review policy and payments remain gated.
