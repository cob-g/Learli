# Security browser follow-up — 2026-10-15

Verified two narrow browser-test corrections on local-main base
`00cac7862ddc8b96c28c49fb5f014befea07e566`. The incomplete SQL test draft is
archived and deferred. The owner authorized committing/merging only passing
browser corrections and removing the old worktrees after preserving their work.
At this implementation checkpoint the four-path candidate is uncommitted;
subsequent Git integration and final cleanup are recorded separately below and
in the private evidence receipts.

This is a test-harness repair. No production vulnerability or security-control
fix is claimed. Application code, authorization, schema/migrations, dependencies,
shared configuration and fixture-support source remain unchanged.

## Corrections and preserved contracts

`tests/e2e/hosted-auth.spec.ts` previously clicked a Sign in link that does not
exist in authenticated workspace chrome. Its current-main baseline reproduced
six passing cases and one failure. The corrected final case establishes a
hydrated account form and A's actual inline bootstrap, revokes only synthetic A
sessions, and requires a fresh account API request to return 401. It clicks the
real Manage account sessions Next Link, observes its same-origin RSC request,
and waits for the actual fresh public-auth document. The matched response and
reached page require the exact trusted origin, `/sign-in`, the safe
`?next=%2Faccount%2Fsessions` query, and no fragment. The trusted server guard
generates that return target from the literal protected route.

No test-forced reload/goto replaces that client/history boundary exercise. The
preceding six hosted cases and the original assertion suffix are unchanged:
old email/private data exclusion, failed reauthentication, Back with fresh
document observation, A reauthentication, B account ownership, storage/password
exclusion and all five public auth-route private-marker checks remain.

`tests/e2e/private-document-identity.spec.ts` had one exact `/sign-in` expectation
after second-tab logout. Two valid handlers can win: SignOut replaces to sign-in,
or the private-document observer reloads account and the server redirects with
`next=/account`. The original related run passed 17/18 and an unchanged focused
rerun reproduced the same exact-URL failure. Only that destination assertion now
accepts the two exact same-origin URLs, with no other query or fragment. All
controlled A-to-B/provider/request barriers, removal-before-reload observation,
bootstrap release, foreign-account denial, exact query/hash preservation,
second logout and no-JavaScript assertions remain intact.

The earlier rejected Contact/home/history candidate from the old security
worktree was preserved as diagnostic history; it was not merged.

## Independent review and task accountability

Run: `run_1cf457f4dfb9`. Effective launch receipts confirm the requested models
and high effort. Every task succeeded and every worker resource is released.

| Task                | Model / ownership                     | Outcome and evidence                                                                                                                                                 |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task_ccfdaed4e657` | GPT-6.1 Sol high; initial test repair | Reproduced baseline, repaired hosted case, independently diagnosed and corrected related URL expectation after explicit scope extension. `implementation/report.md`. |
| `task_8153c3ebfbee` | GPT-6 Luna high; read-only audit      | Confirmed retained privacy/history assertions and related scope; requested exact hosted destination matching. Ran no tests. `audit-browser-followup.md`.             |
| `task_979e3575cc54` | GPT-6.1 Sol high; review correction   | Tightened only the hosted case's request/response/reached-URL matchers; reran final checks. `correction/report.md`.                                                  |

The coordinator independently checked the final exact-URL predicate against the
trusted source guard, actual passing strict browser assertions, unchanged first
six cases and unchanged security assertion suffix. The related test remains
byte-identical to its audited correction. This resolves the audit finding;
Luna's earlier report is not relabeled as a final-source acceptance or runtime
reproduction. `accepted-final-source-manifest.json` records root acceptance.

## Validation actually executed

Evidence directory: `/tmp/learli-security-browser-followup-20261015/`.

| Check                                                | Actual outcome                                                                            | Evidence                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Original current-main hosted Chromium                | 6 passed / 1 failed at absent Sign in selector                                            | `implementation/baseline-hosted-3.log/json`                      |
| Original unchanged related Chromium                  | 17 passed / 1 failed at exact logout URL                                                  | `implementation/related-browser.log/json`                        |
| Unchanged focused related rerun                      | 0 passed / 1 failed, same URL assertion                                                   | `implementation/related-focused-rerun.log/json`                  |
| Initial accepted two-file browser candidate          | Hosted 7/7 and related 18/18 passed                                                       | `implementation/hosted-final.log/json`, `related-final.log/json` |
| Final exact-destination hosted Chromium              | 7/7 passed, zero skipped/flaky/retried cases, 37.1s                                       | `correction/hosted-final.log/json`                               |
| Final related Chromium                               | 18/18 passed, zero skipped/flaky/retried cases, 12.4s                                     | `correction/related-final.log/json`                              |
| Final `node scripts/with-test-env.mjs npm run check` | PASS formatting, lint, strict types, 1,691 tests in 115 files                             | `correction/check-final.log`                                     |
| Ordinary production build through test wrapper       | PASS normal Turbopack before test-only edits; final app/dependency/config bytes identical | `implementation/production-build.log`                            |
| Ordinary discovery                                   | 43 cases in five files discovered; discovery is not execution                             | `implementation/ordinary-discovery.log`                          |

Only 25 unique browser cases are claimed passing across the final two bounded
runs; prior candidate/baseline reruns are not counted as new tests. No full E2E,
Firefox/WebKit, real BFCache engine, hosted-provider or production acceptance is
claimed. The same three existing JSDOM document-navigation notices remain in
passing unit runs. Exact commands, private config contracts and final hashes are
in the two worker reports and `correction/final-manifest.json`.

Tests used the operation's own loopback PostgreSQL/TLS databases, synthetic users,
provider/capture and production-source mirror. The normal fixture's 855-source
manifest and three established composition seams remain unchanged. Generic
global setup/reset/TRUNCATE was not run. Existing forward migrations initialized
only the fresh synthetic local test database; no migration source changed.

Retained setup failures: the initial long Unix socket path, private config cwd
and `.local` mode caused guard/setup refusals. A short owned socket, correct cwd
and 0700 directory resolved them without weakening a guard. Earlier original
test failures remain failures in the reports. The later correction reused only
this checkout's same-operation dependencies/data and ran no installation or
migration. No cloud database, real identity/provider, message or production data
was used.

## SQL disposition and archives

The old `security-sql-20261015` draft
`tests/integration/admin-evidence-isolation.test.ts` remains unverified. Its
earlier security run reported 18 failures and 15 passes before provider policy
ended verification. This follow-up only archived it: no inspection of its logic,
execution, retry, remediation, migration or merge occurred.

The original conditional SQL-ISO-01/02 concern across learner admission evidence
record/revoke and private review moderation remains deferred. No current-main
browser/API isolation-selection path or complete executed exploitation proof is
claimed. The earlier security report, preserved as
`archive/primary-security-report.md`, records its exact source/contract scope
and required separate verification. Existing SQL controls and launch gates were
preserved.

Both old worktrees were stopped and fully archived before cleanup. Every
archived regular file hash, mode and symlink matched its source: browser 1,210
regular files, SQL 3,279, and 12 symlinks each. Private archives include source,
local metadata/environments and retained synthetic data; regenerable dependencies,
Next builds and Git administration are excluded. A frozen validation-checkout
snapshot is also verified. Manifests and restoration notes are in `archive/`.
No secrets or private capture contents are reproduced in this report.

## Scope, Git integration and cleanup

Four paths comprise the planned merge: the two E2E specs, this report and the
canonical progress tracker. All application, permission, SQL, migration,
dependency and unrelated source bytes are unchanged. Test hashes remain those
of the passing final candidate; scoped documentation formatting/diff checks are
recorded during integration rather than repeating unchanged application tests.

The primary `/Users/cob/learli` security branch/HEAD, all 1,210 baseline tracked
regular files, 12 symlink targets and its uncommitted security notes remain
protected. Root owns the authorized commit/local merge and removal of both old
security worktrees plus the temporary validation checkout/branches. Final
observed Git/filesystem/Orca state, source hashes and preservation checks are
recorded in `git-integration/final-cleanup.json` in the evidence directory.
No push, deployment or production operation is authorized or performed.
