# Six-feature local premerge integration

2026-10-11. Baseline `0c078bf50f9f967b20391ef3640353a7b3897e62`; isolated
`cob-g/six-feature-integration`. Blueprint
`prompts/features/m4-09-six-feature-premerge-integration.md` is
**AUTHORIZED — build-feature delegation**, based on the actual integration task
and user's local commit/merge request. Parent alone accepts, commits and merges.
Parent committed the accepted 123-file candidate as
`1cbfa10c2632e5f22ae2a55be737b77fd4415ce7` and fast-forwarded local `main` from
`0c078bf`. Authorized repairs, applicable local verification and both independent
final reviews are complete. All 99 runtime file hashes match the reviewed
candidate after merge.

## Scope and provenance

Six frozen slices are assembled: participant-private booking details/history;
student/parent dashboards; tutor dashboard; actual-date profile selection and
authentication/verification continuation; availability matching; bounded manual
creation-notice local capture. M4.9/BKG-04 owns integration, with the related
M2.9/M3.6/M4.11/M5.3–M5.5/M5.7–M5.8 subsets named in the blueprint. This is
synthetic local acceptance, not a whole milestone or public launch.

All source per-file hashes and six aggregates matched the authoritative manifest
before import. Only listed frozen snapshots were copied; originals remained
unchanged. Ignored `.local/source-provenance.json` preserves every source path,
hash and reconciliation disposition. Exact15-file private-read-v4 and5-file
public-availability-v1 imports, family LessonTime optional variants/default,
baseline demo loading boundary and migration0000–0011 remain intact.

Overlaps were reconciled against baseline: all49 browser cases plus six additive
projects and one real combined journey; separate family/tutor auth headings;
profile and matching catalog assertions; baseline booking_events INSERT plus one
column-limited SELECT and notification grants. Notification0012/snapshot/journal
and schema export are the only schema addition. Booking service preserves locks,
writes and idempotency, with the approved pure schedule extraction and complete
last-duration busy/time-off query tail. Canonical documents combine local facts
and keep isolated-worker evidence historical.

## Executed verification

Execution used pinned Node24.20.0/npm11.19.0 and `npm ci`; no dependency/lockfile
change. The owned PostgreSQL17.11 cluster uses only55477, development3037 and
browser test3137, with fresh generated local credentials and synthetic data.
Static checks finished before build/browser; database-mutating integration and
browser suites ran sequentially.

| Executed check                                                            | Observed result                                                             | Ignored evidence                                                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pinned npm ci / assigned local setup                                      | PASS777 packages, fresh isolated services;13 inherited advisories unchanged | `.local/npm-ci.log`, `.local/setup.log`                                                                                                                                              |
| npm run check                                                             | PASS formatting/lint/typecheck,578 cases/24files                            | `.local/check-initial.log`                                                                                                                                                           |
| npm run test:integration                                                  | PASS255 cases/15files, real PostgreSQL                                      | `.local/integration-initial.log`                                                                                                                                                     |
| Initial and repaired production builds                                    | PASS; rebuild includes DST presentation repair                              | `.local/build-initial.log`, `.local/build-repaired.log`                                                                                                                              |
| Default Playwright discovery                                              | 79 cases/17files; all49 baseline retained                                   | `.local/browser-discovery-repaired.log`                                                                                                                                              |
| First full default browser command, workers1                              | 72PASS/1FAIL/6not run, preserved                                            | `.local/browser-initial.log`                                                                                                                                                         |
| Affected family unit/component cases                                      | 17/17PASS; new DST case failed before fix                                   | `.local/repair-family-tests.log`, `.local/dst-regression-before.log`                                                                                                                 |
| Repaired full static and final test-only static validation                | PASS formatting/lint/typecheck                                              | `.local/repair-format-check.log`, `.local/repair-lint.log`, `.local/repair-typecheck.log`, `.local/signin-format-check.log`, `.local/signin-lint.log`, `.local/signin-typecheck.log` |
| Second full default browser command, workers1                             | 78PASS/1FAIL; only missing tutor fixture sign-in                            | `.local/browser-repaired.log`                                                                                                                                                        |
| Corrected combined case, project=six-feature-integration/no-deps/workers1 | 1/1PASS, actual end-to-end journey                                          | `.local/browser-combined-final.log`                                                                                                                                                  |
| Real fresh/upgrade proof                                                  | PASS13 migrations/24 tables;23 baseline row sets preserved                  | `.local/migration-fresh-evidence.json`, `.local/migration-upgrade-evidence.json`                                                                                                     |
| Source/client-output private-value scan                                   | PASS0hits;123changed files/68src/38client assets,2976patterns               | `.local/privacy-scan-initial.json`, `.local/privacy-scan.json`                                                                                                                       |

All79 default-discovered cases have applicable passing evidence: the unchanged78
from the full sequential run plus the corrected combined case after its exact
test-only setup repair. Parent msg_c6ea196e1741 authorized this evidence reuse;
the default command itself did not produce a single79/79 pass. No failed or skipped
case is accepted without a subsequent applicable successful result. Unchanged
backend/query/config/migration/PG-test bytes preserve the255-case and migration
proof; the actual UI source repair received affected17-case checks and rebuild.

Fresh development applied all13 reviewed migrations. Separately, baseline0000–0011
was applied to the blank owned test database; representative synthetic records
were written in all23 baseline tables. Candidate0012 advanced actual migration
history12→13 and preserved every row set exactly (counts and hashes only retained
in the safe report). Older events did not receive fabricated backfill notices;
a new committed creation event queued the correct deduplicated recipient.

The actual runtime role could SELECT the four approved booking_event columns,
SELECT notification delivery state and UPDATE allowed attempt state. PostgreSQL
42501 denied event UPDATE/DELETE, delivery INSERT/DELETE/identity UPDATE, guardian
permission UPDATE, role INSERT and direct queue-function execution. Runtime role
flags disallow superuser/create-db/create-role/replication. No production, main or
peer database was accessed or reset.

## Review and recovery

Same-agent FULL read-only Review initially reported plan/system/unintended-change
PASS, READY FOR VERIFICATION; the missed tutor locator superseded that initial
recommendation with CHANGES REQUIRED. Both independent initial reports identified
locator/overflow-fixture blockers; flows also found the minor family DST label
inconsistency. Parent authorized exact repairs and the later explicit tutor
sign-in correction. Final own scoped Review returns plan/system/unintended-change
PASS, READY FOR VERIFICATION. Parent-owned independent follow-ups target final99
runtime aggregate `f83f80976a63927e6699865f1113e7cb97980e1e018dd162a3cd7952cd6db402`;
Parent msg_3addf9d89cee accepts definitive backend and original broad + focused
final flows reports: plan/integrity/unintended-change PASS, READY FOR VERIFICATION,
zero outstanding findings. Reports remain ignored at
`.local/independent-backend-review.md`, `.local/independent-flows-review.md`,
`.local/independent-flows-followup-review.md`. Review runs no tests; Verify evidence
is separate and accepted subject to parent final file audit.

First browser failure was owned fixture pollution: the intentional848-window
profile stayed approved, correctly triggering the840-window matching bound.
Read-only actual-service diagnosis isolated that cause. Authorized repairs suspend
only profile-owned IDs in guaranteed teardown, correct real detail heading and
separate exact state, and group family rows by local date plus zone with unique
keys. The opposite-offset rendered DST regression failed before and passed after
repair. Second run passed78, then exposed the missing tutor sign-in because auth
intentionally disables automatic sign-in; the authorized real sign-in200 fixture
step completed the combined journey. No records were deleted by repairs, and no
assertions/bounds/auth behavior were weakened. Failures and113 repaired-run
artifacts remain preserved; runtime is refrozen for final independent follow-ups.
See `prompts/recovery/2026-10-11-six-feature-integration.md`.

## Limits and next owner

`local_simulation`/`demo_reserved`/`demo_expired`,60-minute duration/notice,
30-minute grid,14-day horizon and600-second TTL remain. Current server sessions,
roles, exact self/guardian/assigned-tutor authorization, private details, actual
viewer zones and monotonic expiry remain. No admin bypass, real confirmation,
money, meeting storage/attendance, cancellation/refund policy, real minor
onboarding, LMS/messages/uploads or external provider/email execution was added.
Local HTML capture is not email delivery.

Sixteen representative phone/desktop/pending/forced-reflow screenshots were
inspected without clipping or hidden actions, including final combined390/1440
and matching/local capture. No-JS/keyboard/axe/reflow checks are local Chromium
evidence only; `.local/visual-qa.md` records exact observed limits. Remote CI, hosted Neon/Resend/Railway, other browser engines,
literal zoom/hardware screen reader and production remain unverified. Inherited
13 audit advisories are unchanged; commercial/consent/safeguarding/launch gates
remain open. Final manifests `.local/final-manifest.json` and
`.local/final-runtime-fingerprint.json` cover every changed tracked/untracked
nonignored path and the separate runtime subset. Aggregate algorithm is sorted
relative UTF-8 path + NUL + lowercase SHA256(bytes) + LF, then SHA256 concatenation.
Both independent reviews cover the final runtime; the parent validated the exact
manifest and staged bytes, committed the candidate and verified the merged
runtime identity. Factual final documents
were completed after review without runtime drift. Ignored sanitized report and
root memory preserve the local handoff; no worker commit/staging/merge occurred.

## Local merge completion

Completed at 2026-10-11T22:21:00+08:00 (Asia/Manila). Integration commit
`1cbfa10c2632e5f22ae2a55be737b77fd4415ce7` is on local `main`. At merge time, the original six
feature worktrees and integration worktree were preserved. All four supervised
integration/review tasks succeeded and their agent terminals were released.

At merge time, only the isolated integration databases received migration 0012 and
updated runtime grants. The main databases were subsequently migrated under the
user's separate request, recorded below. No push, deployment or production
operation was performed. The merge
does not change the local-simulation or public-launch policy gates.

## Subsequent cleanup

On 2026-10-11, the user explicitly requested cleanup. All seven feature/integration
worktrees were removed through Orca, together with their seven branches and the
older merged `feature/m3-tutor-catalog` branch. Git and Orca now show only the main
checkout, and `main` is the only local branch. All branch tips were verified as
ancestors of main before deletion; the six frozen source snapshots and all 99
reviewed runtime hashes were also rechecked.

The seven workspaces' terminals were closed and their owned PostgreSQL clusters
on ports 55471–55477 were safely stopped. Private archives preserve source work,
local configuration, stopped synthetic databases, handoffs and test evidence.
Every archived regular file was verified against its source hash before removal.
Reinstallable dependencies, generated build output and Git worktree metadata were
excluded. Archives, manifests and cleanup receipts are in ignored
`.local/six-feature-cleanup-2026-10-11/`; readable integration and review reports
are in its `evidence/` directory. Historical worktree-local evidence paths in this
report can be found inside the corresponding archive.

Application runtime files are unchanged. Main database migration was pending at
cleanup time and was subsequently completed as recorded below. No push, deployment
or production operation was performed.

## Main local database migration

On 2026-10-11, the user explicitly requested the main checkout's pending
migrations. Inspection found both `learli_dev` and `learli_test` at migration 0005,
so seven committed migrations, 0006–0012, were required. The earlier handoff's
assumption that only 0012 remained was incomplete.

Validated local environment modes, loopback connections on port 55432, the
main-owned PostgreSQL data directory, and owner/runtime credentials without
printing their values. Created private custom-format backups of both databases;
their table of contents and complete archive streams were readable. Backups,
before/after hashes and permission evidence are in ignored
`.local/main-migration-2026-10-11/`.

`npm run db:migrate` and `npm run db:migrate:test` both completed successfully.
Both databases now have all 13 applied migration hashes matching committed SQL
and 24 public tables with columns matching snapshot 0012. Counts and hashes of
existing column values in all 11 baseline tables are unchanged. The added tutor
availability version defaults to zero; no notification history was backfilled.

Verified the booking overlap exclusion constraint and all three supplemental
booking/notification triggers. Twelve actual runtime permission probes per
database passed, including expected 42501 denials for forbidden writes and schema
creation. All probes were rolled back; runtime role flags and internal function
execution permissions remain restricted.

No seed/reset or application-code change was needed. The main local databases are
current for the merged schema. No remote/production database, push or deployment
operation was performed, and no backup restore was needed or exercised.
