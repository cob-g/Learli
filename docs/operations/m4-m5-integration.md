# M4/M5 local integration evidence

Date: 2026-10-11. This is local verification, not production or merge approval.

## Scope and provenance

Blueprint: `prompts/features/m4-01-m5-integration.md`, **AUTHORIZED — build-feature
delegation**. Worktree: `/Users/cob/orca/workspaces/learli/m4-m5-integration`;
branch: `cob-g/m4-m5-integration`; base: `2803d1f3bf2579cc30f5c332b15482c092a9401c`.
The user authorized source commits, integration, reconciliation, checks and review;
merging into main remains a final checkpoint. No push, deployment or production
operation was performed.

| Slice                           | Source commit                              | Integration merge |
| ------------------------------- | ------------------------------------------ | ----------------- |
| A: weekly availability          | `3271e1e423c94721da685ff382d78a0e2d4ee60c` | `30571b0`         |
| B: synthetic learner profiles   | `cbc3c7c285fd9c500aeae6a5350161e50d208666` | `c2ecd64`         |
| C: standalone meeting validator | `aba7a7790444e5aa1baca8d0986429090795e994` | `c07f558`         |

All three started at the base above. The intended tracked/untracked feature files
were inspected, scanned against private configuration values, and rechecked for
unexpected changes before staging exactly one coherent commit per source slice.
Source implementation, ignored environments, databases, memory and artifacts were
preserved. No source database migration was renumbered or replayed.

## Reconciliation

- A's `0006_tutor_weekly_availability.sql` and snapshot are preserved. Drizzle
  generated `0007_local_learner_profiles.sql` against the combined schema and A's
  snapshot; SQL is byte-identical to B's original 0006. The 0007 snapshot chains to
  0006 and retains every existing table. Journal indexes are consecutive 0–7.
- Runtime availability CRUD and learner SELECT/column-limited UPDATE grants both
  survive. Runtime cannot create/claim learners, change ownership/status/provenance
  or mutate guardian links. The direct schema/grant inspection confirms this on
  both integration databases, alongside permission-denial integration tests.
- Auth outage testing closes an actual isolated runtime pool before asserting
  the safe 503 response; it no longer guesses a port that another cluster may own.
- Standard `npm run test:e2e` covers all 32 cases. Catalog waits for empty-inventory
  and auth tests; availability follows catalog; learner tests follow availability
  and auth and run serially. Test-only throttle cleanup cannot race the other
  projects. Removed the separate learner configuration; no copied private specs
  are needed to reproduce acceptance.
- Preserved source verification histories while updating current architecture,
  tracker, README and local learner instructions. No product policy was changed.

## Recovery and same-agent Review

Initial read-only review identified a targeted UI defect: learner field validation
focused the general alert, contrary to `context/ui-context.md` status-messaging
rules. Recover classified it as a targeted implementation fix, requiring no reset
or architecture change. Implementation now focuses the first invalid field, with
the result alert as fallback; the browser assertion was strengthened accordingly.
The first check also found formatting-only issues in generated metadata and the
blocked private-meeting draft; these were formatted without semantic changes.

Final reviewed and verified implementation commit is `c25d7c4cd037470bfececcacb06ba7d85ffc6b58`,
with baseline `2803d1f`; a subsequent documentation-only evidence commit records
this hash without changing tested code. Coverage: full integration scope against
the authorized blueprint and all three source contracts. Work packages: M4.1,
local M4.4 and library-only M5.1; requirements TUT-04, FAM-01/FAM-02 and MEET-01.

- Architect plan alignment: **PASS**. All three scopes and their guards remain.
- System integrity: **PASS**. Ownership is server-side; local gates, limited
  learner data, synthetic-only provisioning and pure validator boundaries remain.
- Verification readiness: **PASS**, with separate evidence below. No booking,
  meeting persistence/access or real-user launch behavior is claimed.
- Unintended-change audit: **PASS**. Extra changes are limited to reconciliation,
  accessibility focus, reproducible test configuration and accurate documentation.
- Documentation completeness: architecture, tracker, README and operations docs
  updated. PRD/build-plan product scope and standards did not change.
- Confirmed unresolved findings: **0 Critical, 0 Important, 0 Minor** within this
  scope. Initial focus issue is repaired; no test assertions or guards weakened.
- Recommendation: **READY FOR VERIFICATION**. Review itself ran no tests; the
  build coordinator's separate Verification stage supplied the evidence below.
- This is a same-agent scoped review, not independent review or release clearance.
  The coordinator will arrange independent read-only review before main merge.

## Separate Verification evidence

Node 24.20.0, npm 11.19.0 and PostgreSQL 17.11. Port occupancy was checked before
creating the integration-only cluster: PostgreSQL **55442**, configured development
HTTP **3003**, browser HTTP **3103**. Development/test databases are distinct.
Source clusters A 55441, B 55434 and main 55432 were not used or stopped. Their
branch-specific applied histories are isolated, noncanonical integration targets;
use fresh combined databases rather than upgrading those histories.

| Command / check                                                                       | Observed result                                                                                                              |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                              | PASS, pinned lockfile; 777 packages, existing 13 advisories (4 moderate, 9 high)                                             |
| `LEARLI_DB_PORT=55442 LEARLI_DEV_PORT=3003 LEARLI_TEST_PORT=3103 npm run local:setup` | PASS, fresh owned dev/test databases and synthetic account fixtures                                                          |
| `npm run db:migrate` and `npm run db:migrate:test` again                              | PASS, eight applied migration hashes match the SQL journal on both databases                                                 |
| `npm run db:seed` again                                                               | PASS                                                                                                                         |
| `npx --no-install tsx scripts/seed-local-learners.ts` repeated                        | PASS; exact row comparison confirms 4 profiles and 3 guardian links unchanged                                                |
| Combined schema/grant inspection                                                      | PASS, 14 public tables match 0007 snapshot; chain and table/column privileges checked on both databases                      |
| `npm run check`                                                                       | PASS: format, lint, generated route types, TypeScript and **373/373 unit tests in 11 files**                                 |
| `npm run test:integration`                                                            | PASS: **58/58 PostgreSQL tests in 4 files**                                                                                  |
| `npm run build`                                                                       | PASS, production build                                                                                                       |
| `npm run test:e2e`                                                                    | PASS: **32/32 cases**, standard configured projects, no retries needed                                                       |
| Visual/accessibility evidence                                                         | PASS: axe/keyboard/overflow assertions; inspected availability 320/1440 and forced-color captures, learner 320/1440 captures |
| Private-value scan                                                                    | PASS against tracked/untracked intended files and 36 production static assets; no local configuration/fixture secrets found  |
| `git diff --check`                                                                    | PASS                                                                                                                         |

Ignored local logs: `.local/check.log`, `.local/integration.log`, `.local/build.log`,
`.local/e2e.log`, `.local/schema-evidence.log`, `.local/seed-evidence.log`, and
`.local/private-evidence.log`. Screenshots are under ignored `test-results/`, and
the Playwright HTML report is under `playwright-report/`. Local verification scripts
and captured credentials remain ignored and are not published.

## Remaining gates and next step

Existing dependency advisories remain; package/lockfile were not changed. No
Neon/Resend/Railway, remote CI, real minors, booking transactions/concurrency,
payment processing or actual provider meeting behavior was verified or activated.
The private-meeting integration draft remains **BLOCKED** on its existing product
decisions. Learner safeguards and real onboarding, booking policies and provider
access timing still require their separate approvals.

Next: independent read-only review of the final integration branch, followed by
the user's main-merge checkpoint. The final commit hash and unexecuted merge
command are recorded in the local handoff/report after committing this evidence;
main remains at the base above.
