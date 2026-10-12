# Three-feature merge, main migration and cleanup — 2026-10-12

The user explicitly authorized completing the reviewed candidate's commit/merge,
main local database migrations, and removal of safely completed worktrees and
branches. One independent cleanup auditor was launched through Orca with observed
GPT-6.1 Sol / **High** effort. It completed successfully and was released.

## Merge and verification

- Reviewed feature commit: `3cea4920a65cd274e2d949e7fd70ce383ed16790`.
- Fast-forwarded local `main` from `b6cf237`; all 62 accepted file hashes matched
  before staging, in the index and after merge. The earlier untracked coordinator
  plan was preserved privately before its newer reviewed version became tracked.
- Delivered directory actual-date availability filters, local verified account
  email changes, and specialized subject display-name editing. Final independent
  re-review closed F1/M1 with zero remaining confirmed findings.
- Retained exact-state verification: formatting/lint/types, 657 unit/component
  tests and one full 117-case Chromium run. Earlier 389 PostgreSQL cases and
  isolated fresh/upgrade migration proofs retain their documented applicability;
  these suites were not rerun for this unchanged merge.
- A fresh `npm run build` from merged main passed. No application code or
  dependencies changed during closeout; the later closeout commit records status
  documentation only.

## Main local databases

Validated local modes, loopback host, port 55432, owner/runtime roles and the
main-owned data directory. No other client connections were present during
backup preparation. Both `learli_dev` and `learli_test` were actually at 0012.

- Created private custom-format backups; verified table-of-contents and complete
  archive readability. A restore was not needed or exercised.
- Ran repository `npm run db:migrate` and `npm run db:migrate:test`, applying
  reviewed 0013–0016 and current runtime grants.
- Both databases now have 17 matching migration hashes and 32 public tables;
  columns match the 0016 snapshot. Existing column values in all 24 baseline
  tables were preserved by row-count and digest comparison.
- Historical constraints were preserved except the reviewed audit-action
  expansion. Historical triggers remain enabled; the six expected new triggers,
  booking overlap exclusion and subject revision defaults passed inspection.
- 29 runtime permission probes passed per database, with all probes rolled back.
  Runtime role flags and restricted function privileges passed as well.
- Main's PostgreSQL cluster remains running. No seed/reset, remote/production
  database, external mail, push or deployment was performed.

## Completed cleanup

The independent audit matched 326 accepted file versions, found no unaccounted
nonignored work or active feature owner, and confirmed all nine branch tips were
ancestors of main. The 63 source versions differing from combined integrations
were accounted for in frozen snapshots; they were not silently discarded.

Stopped only the nine owned temporary clusters on ports 55481–55485 and
55491–55494. Verified stopped processes, absent listeners/sockets and no remaining
process working directories under the source worktrees. Retained complete private
worktree archives, including source, local configuration, handoffs, evidence,
mail and stopped PostgreSQL data/WAL. Every included file hash, file mode,
relative path and symlink target was checked against the archive and rechecked
before deletion. Only `.git`, `node_modules`, `.next` and `tsconfig.tsbuildinfo`
were excluded as Git metadata or regenerable files.

Removed all nine worktrees through Orca and their nine merged local branches:

- `m2-account-password-change`
- `m2-verified-email-change`
- `m3-directory-time-filters`
- `m5-account-restrictions`
- `m5-booking-support`
- `m5-four-feature-integration`
- `m5-private-meeting-links`
- `m5-specialized-subject-editing`
- `m5-three-feature-integration`

Branches used the `cob-g/` prefix. Git now has only the main checkout and local
`main` branch. Orca removal receipts can report `removing: true`; physical and Git
completion were observed before considering each removal finished. The first
immediate existence assertion was premature, and its receipt was retained without
retrying the accepted removal.

## Retained evidence and limits

Private closeout records live in `.local/three-feature-closeout-2026-10-12/`:
`merge-verification.json`, `learli_dev-before.dump`, `learli_test-before.dump`,
before/after migration proofs, `build-main.log`, `cleanup-audit.md`,
`archive-manifest.json`, per-worktree archives/inventories/removal receipts and
readable reports under `evidence/`. Earlier source freezes and independent reviews
remain under `.local/four-feature-wave/` and `.local/next-three-feature-wave/`.
Original worktree paths in historical reports now refer to content in the named
archives. Never publish private archives or raw auth fixtures/logs.

This entry supersedes historical pending-merge/migration/cleanup wording in the
wave records. Inherited 13 dependency advisories, other-browser/hosted-service
verification gaps, and commercial/consent/safeguarding/public-launch gates remain.
Local completion is not production launch clearance. No new feature wave was
started as part of this closeout.
