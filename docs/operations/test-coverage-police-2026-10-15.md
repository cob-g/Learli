# TEST COVERAGE POLICE — 2026-10-15

Five valuable improvements are implemented and independently reviewed: three
verified test defects are repaired and two meaningful behavioral gaps are closed.
Final coordinator validation passes 1,748 unit/component tests, all 996 PostgreSQL
tests and the full 205-case Chromium suite. One small application correction gives
pending directory/finder submit buttons their required native disabled behavior.
Owner subsequently authorized local commit, merge and cleanup. The nine reviewed
paths were committed as `f535a50` and merged into local main as
`9e4fc1f`; the merge tree exactly matches the reviewed commit.
Application and test bytes still match the completed validation evidence.

Run: `run_94eb599eb411`. Durable private evidence, raw failures, exact commands,
hashes, reports and cleanup receipts:
`/Users/cob/orca/archives/learli/test-coverage-police-20261015/`.
No production, external provider, remote CI, deployment or real-user operation
was performed.

## Exploration and coverage limits

Ten GPT-6 Luna high workers completed five domain investigations, two
cross-boundary investigations and three independent implementation audits. Four
GPT-6.1 Sol high workers independently verified and implemented the improvements.
Every requested/effective model matches its launch receipt. At most three workers
ran concurrently. All fourteen Tasks completed and all fourteen worker resources
are released; the final inbox and reclaimable-worker inventory are empty.

Inventory: 31 feature modules, 56 API handlers, 22 schema source files and 32 SQL
migrations; 70 unit, 47 component, 69 PostgreSQL integration and 43 browser spec
files. The default browser matrix contains 40 projects and now 205 test instances;
opt-in cross-engine/operations tests are distinct. Inventory is not a claim that
every source line, test body or possible failure combination was audited.

| Area                 | Important behaviors and boundaries examined                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking/scheduling   | Candidate eligibility, UTC/DST, time off, overlap, retries, lifecycle, private links, family/tutor history and persisted events               |
| Identity/permissions | Real provider signup atomicity, sessions/password/email, MFA, role/ownership denials, learner/guardian links, screening and safeguarding      |
| Test infrastructure  | Discovery, CI, isolated databases, fixture ownership/cleanup, clocks, hooks, TLS, migrations, restore and operational test conventions        |
| Public/frontend      | Catalog, subjects, matching, filtering/pagination, native forms, loading/failure states, navigation and private document identity             |
| Delivery/support     | Transaction/event coupling, leases/retries, SDK boundary mocks, recipient revalidation, support/reviews, policy gates and safe diagnostics    |
| Cross-module         | Candidate engine → test fixture → actual PostgreSQL; UI → URL/route/service; authentication → private records; transaction → durable delivery |

Existing real PostgreSQL/provider/browser adverse-case coverage was reused rather
than duplicated. School tenancy, payments, AI and upload workflows are not
invented for this marketplace. Approved local/readiness compositions remain
separate from real policies and hosted/provider acceptance.

No coverage provider, percentage threshold or mutation framework is configured.
No statement/branch/function/line percentage or mutation score is claimed, and no
new framework, dependency or numerical target was introduced.

## Findings and disposition

Six unique candidates were triaged: three confirmed test-quality defects, two
meaningful coverage gaps, and one false positive. All five actionable items are
resolved. Severity applies to the test/behavior risk: Critical 0, High 0,
Medium 4, Low 1. No open confirmed finding remains. The native-control mismatch
was the only product behavior defect corrected; the other changes concern tests.

| ID / original lead | Class / severity                               | Verified gap and resolution                                                                                                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-C01 / C-01       | Test defect / Medium                           | Native TLS setup wrote its private receipt before creating its directory. Fresh baseline skipped all eight cases with ENOENT. The suite now creates the parent itself; original assertions/mocks are unchanged and all eight execute successfully from an absent directory.                                                   |
| T-F01 / F-C-01     | Test defect / Medium                           | The booking race assumed the first two actual candidates overlap; notice cutoff can put them on different days. It now selects both safely future overlapping intervals and requires the expected 409 conflict, exact winning booking and one correct creation event.                                                         |
| T-D01 / D-01/G-01  | Meaningful gap and native-control defect / Low | Pending filters announced disabled state but left native submit enabled. Two component cases and a stronger real held-navigation assertion protect native GET values, pending state and restoration; the source adds only native disabled properties and a submit guard. Harmful duplicate-GET/data-loss claims are excluded. |
| T-D03 / D-03/G-02  | Meaningful coverage gap / Medium               | The distinct five-row matching pager had no actual multi-page assertion. One new SQL-backed browser case proves six fitting tutors plus two genuinely available excluded controls, exact 5/1 identities/order, no omissions/duplicates, retained filters and More/Previous/reload/Back. No pager product bug was established. |
| T-R01              | Test defect / Medium                           | The full browser run exposed a closed pool reused across Playwright hook groups. Moving test pool creation into matching `beforeAll` preserves cleanup and all privacy assertions, without serializing tests or changing retries/config.                                                                                      |
| T-D02 / D-02       | False positive                                 | Complete matching preferences reach results without `submit=results`; the parameter controls incomplete-input errors. Source, an existing unit case and actual serializer/sanitizer/resolver roundtrips disprove the alleged retry defect. Retry behavior is unchanged.                                                       |

The first booking explorer's ordinal-assumption dismissal was independently
corrected by cross-boundary review and the implementation proof. Findings were
not accepted solely because an explorer asserted them.

### Reproduction quality

- **TLS:** coordinator and S1 independently observed original ENOENT with eight
  skipped cases. S1 and the coordinator then passed the same eight cases from an
  absent directory, retaining private directory/receipt modes and real TLS/PG.
- **Booking:** S2 used the unchanged actual pure candidate engine at controlled
  17:45 Manila to demonstrate the original non-overlap, exact cutoff boundaries
  and 96 sampled clock inputs. The original 55-case PG file passed at its actual
  current clock outside that window; no runtime PG failure in the old window is
  claimed. The repaired real service race and 118 related PG/134 pure cases pass.
- **Native control:** the final component assertions produced 3 passes/2 failures
  against original source. An actual original production artifact also failed
  the new native-disabled browser assertion, then the corrected artifact passed.
- **Privacy fixture:** S4 independently reproduced unchanged main as 2 passes/1
  failure. Original global workers 3, auth project worker limit 1 and inherited
  full parallelism split hook groups in a cached module. Red reused workers
  `[0,0,1]`; green passed all three in `[0,0,0]`, with three successful setup/close
  pairs. A global one-worker override would mask the defect and was not used.
  Every helper/case/assertion byte after `beforeEach` remains unchanged.

Two new component cases and one new E2E journey were added. Existing booking and
directory assertions were strengthened; three fixture defects were repaired.
The eight existing TLS cases were restored, not counted as new tests. No tests
were disabled, assertions weakened, thresholds lowered or arbitrary sleeps added.

## Validation and original failures

Environment: local macOS, Node 24.20.0, npm 11.19.0, PostgreSQL 17.11,
Vitest 5.0.3 and Playwright 1.64.0. Only newly owned loopback databases and
synthetic accounts/records were used. Installed lockfile/dependencies are unchanged.

| Executed check                                                      | Observed outcome                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Fresh baseline `node scripts/with-test-env.mjs npm run check`       | PASS: format, lint, full types, 1,746 cases / 117 files                                    |
| Fresh baseline ordinary production build                            | PASS                                                                                       |
| Complete baseline PG run, integration config with `--pool threads`  | 988 passed, 8 skipped, one setup-failed suite / 69 files; exit 1, 419.29 seconds           |
| Baseline original matching/directory Chromium projects, `--no-deps` | 8 passed, 38.01 seconds                                                                    |
| Integrated aggregate `npm run check` through test-env wrapper       | PASS: format/lint/full types, 1,748 cases / 117 files                                      |
| Integrated ordinary production build                                | PASS, one tracing warning after local fixture growth                                       |
| Complete integrated PG run, same config/pool                        | PASS: 996 cases / 69 files, no skips, 387.96 seconds                                       |
| First full original-config Chromium run                             | 60 passed, one private-document pool failure, 144 dependent cases did not run; exit 1      |
| Independent base/fixed S4 actual privacy file                       | Original: 2 passed / 1 failed; fixed: 3 passed on same reused worker/topology              |
| Coordinator post-S4 checks                                          | Full project types, full lint, scoped test formatting and diff check PASS                  |
| Final full original-config Chromium run                             | PASS: 205 cases, no failures/skips/not-run cases, 382.75 seconds; no retry/worker override |
| Independent audits H / I / J                                        | Scoped source/assertion/raw-evidence PASS; no residual actionable finding                  |

The unit/PG/build acceptance preceded the final E2E-only pool correction; final
application bytes remained identical. Full types/lint were rerun after that
correction and the entire original-config browser matrix then completed. Source
hashes bind each execution; old failing logs are retained rather than overwritten.
The existing GitHub CI workflow/discovery is unchanged, but remote Ubuntu CI was
not executed. Local compatibility checks are not a remote CI result.

A newly observed build warning references the unchanged local-mail file pattern
after synthetic mail artifacts accumulated; the baseline build had no warning.
A worker's generated nested mirror also failed font/Turbopack startup once,
before any browser case. Archiving only that owned generated mirror and a fresh
retry succeeded with unchanged config/helpers; root original-config runs also
started successfully. Its underlying environmental/cache cause remains
unverified. These diagnostics are preserved, not hidden behind assertion changes.

H/I audits reviewed scoped completed worker evidence while aggregate results
were still pending in their dispatch snapshots; they do not substitute for the
coordinator's completed runs. One H evidence-path/count-wording error is corrected
in `audit/coordinator-evidence-note.json`; source verdict and actual counts agree.

## Task accountability

Paths are relative to the durable private evidence directory.

| Task                          | Model | Outcome / evidence                                                                         |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| A booking/scheduling          | Luna  | Coverage map; initial clock dismissal superseded by F/S2; `exploration/explore-A.md`       |
| B identity/permissions        | Luna  | Existing substantial adverse coverage, no retained new gap; `exploration/explore-B.md`     |
| C infrastructure/CI           | Luna  | TLS setup defect; `exploration/explore-C.md`                                               |
| D frontend/public             | Luna  | Three leads independently narrowed/adjudicated; `exploration/explore-D.md`                 |
| E delivery/support/reviews    | Luna  | Existing strong lifecycle coverage, no retained new gap; `exploration/explore-E.md`        |
| F cross-boundary booking      | Luna  | Clock-sensitive fixture confirmed; `exploration/explore-F-cross.md`                        |
| G cross-boundary UI/contracts | Luna  | Native-control/pager gaps retained; retry lead disproved; `exploration/explore-G-cross.md` |
| S1 TLS setup                  | Sol   | Original red, fixed eight-case green; `implementation/S1/report.md`                        |
| S2 booking race               | Sol   | Actual engine proof and stronger real PG regression; `implementation/S2/report.md`         |
| S3 public UI tests            | Sol   | New pager, native-control red/green, preserved native flows; `implementation/S3/report.md` |
| H database audit              | Luna  | Scoped PASS; `audit/audit-H-database.md`                                                   |
| I UI audit                    | Luna  | Scoped PASS; `audit/audit-I-ui.md`                                                         |
| S4 privacy fixture            | Sol   | Independent base red, same-topology three-case green; `implementation/S4/report.md`        |
| J residual audit              | Luna  | Scoped PASS; `audit/audit-J-privacy-closure.md`                                            |

`agent-ledger.json`, `final-tasks.json` and `final-workers.json` retain exact
Task/Dispatch and requested/effective model identities and settled outcomes.

## Files, preservation and remaining limits

Nine paths change: one application component, six test files, this report and
the progress tracker. No schema/migration, dependency, shared test/CI config,
provider, auth, booking service or business-policy implementation changed.

All four implementation worktrees/branches were removed only after exact
integration and verified private archives of non-regenerable files, modes and
symlink targets. All workers are released. Owned database/browser processes are
stopped, assigned ports are free and synthetic data is preserved. The original
security checkout branch/HEAD/status, 1,210 tracked regular files, twelve symlinks
and dirty security report remain unchanged. Local main now contains the reviewed
changes; unrelated local refs are preserved. Removal of the operation checkout
and merged branch is authorized after a verified private archive. The actual
archive, Git bundle, deletion and preservation outcomes are recorded under
`local-merge/` in the durable evidence directory. Receipts are
`preservation-and-cleanup.json`, `owned-resource-cleanup.json` and
`worker-archives/`; final validation records bind the final files and patch.

No open confirmed test finding remains. Coverage percentages/mutation analysis,
Firefox/WebKit and physical devices, dedicated backup/restore rehearsal, live
provider delivery, hosted deployment and production recovery were not executed
here. The finite clock proof is not exhaustive timezone/runtime verification.
Real safeguarding/guardian/commercial policies and launch gates remain separate.
The isolated mirror-build incident and broad local tracing warning are retained
limitations requiring focused investigation if they recur; no unsupported
production/configuration repair was made. No historical customer data repair or
production operation is required or implied by these changes.
