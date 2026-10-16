# REGRESSION POLICE — 2026-10-16

Status: **READY FOR MANUAL QA** in the isolated development stage. No
application regression was confirmed. Eight test/harness defects are corrected;
final automated gates pass on the integrated source. The unresolved origin of
one availability-focus miss remains an explicit manual-QA item. Changes are
uncommitted in `cob-g/regression-police-20261016`.

## Baseline and coverage

Comparison: `6ca48aac45c113ebcfb1a21bad3721103f4f5985` through
`92ff3b9369a552b607587da6d17b0abef2c9bb13`. The first reference immediately
precedes the merged bug/abstraction/dead-code work. It is a source-comparison
reference with historical evidence, not a universally re-executed known-good
release. No release tags exist. Current contracts and each change's actual
parent/history determine intent; older unsafe behavior is not restored.

The range contains 12 implementation commits across 108 changed paths, including
migration snapshots and documentation. Investigated changes are `6567a52`
(retry identity/SQL isolation), `ff0908c` (shared responsibilities), `2a50823`
(retired navigation/unused animation dependency), `3bcf2f4` (current authority and
owned mirrors), `e0bf67f` (atomic signup), `5aaedca` (migration arguments),
`079a57b` (private document identity), `cc7e579` (browser observation), `a2c6415`
(formatting/booking projection), `00be982` (subprocess outcomes), `f535a50`
(behavioral tests/native GET/test pool lifetime), and `d165d6e` (matching client
boundary). Their intentional improvements remain intact.

The inventory covers 31 feature modules, 470 TypeScript/TSX source files and 56
route handlers. Reviewed workflows include provider signup, RBAC/ownership,
private-document lifecycle, family admission/College support, tutor screening,
public discovery/matching, availability/DST, booking/retry/conflict/history,
private meeting links, support/safeguarding, reviews/publication, transactional
delivery, operators, migrations, configuration, dependencies and CI consumers.
No hypothetical payment, upload, queue or school-tenant subsystem was invented.

Seventeen GPT-6 Luna launches cover 16 read-only assignments, with at most three
workers beside the coordinator. One E launch stopped before investigation after
consumer fencing; its same-task retry completed. Refused F structured-terminal
reuse created no task, dispatch or agent and is excluded. Five GPT-6.1 Sol
workers independently verified and implemented focused corrections in isolated
children. Requested/effective models are confirmed by runtime receipts.

| Assignments | Evidence-backed outcome                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A–F         | Identity, SQL/persistence, UI/retry, discovery/performance, operators/email, removals/dependencies: no supported application regression; existing delivery ambiguity retained    |
| G–I         | Cross-module identity/security, authority/failure/retry and discovery/booking: no supported application regression; null-identity lead rejected using actual framework semantics |
| J/K         | Source diagnosis of observed account/native-browser failures; Sol/coordinator execution independently established the defects                                                    |
| L/M/N       | Independent repair/evidence reviews; L found Low waiter issue, S4 corrected it, N accepted closure; M's fixture scope was clean                                                  |
| O/P         | Independent private-snapshot investigation and final correction closure; P accepted the two readers and their negative controls                                                  |

F's matching-import description and K's baseline chronology were independently
corrected in retained source-check receipts. Both W8 files already exist at
`6ca48aa`; `c0c6cdc` is earlier. Application code did change within the reviewed
range, including intentional identity replacement in `079a57b`; application
byte-preservation claims below compare against this operation's initial
`92ff3b9` source, not against `6ca48aa`.

## Findings and implementation

Ten leads comprise seven legacy test/harness defects, one Low test-only defect
introduced and corrected during this operation, one rejected application-privacy
candidate, and one unclassified availability-focus observation. Confirmed
application regressions: zero; unresolved high-confidence application regressions:
zero. The eight corrected verification defects have seven Medium and one Low
severity, with zero Critical/High. The inherited delivery-contract question is
separate and is not counted as a confirmed defect.

| ID              | Verified root cause                                                                                    | Focused correction and safeguard                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RG-T001, Medium | Global account-sessions link locator matches two legitimate links that predate the baseline            | Select the main-content link; keep real navigation/logout/Back/privacy checks                                                                                                        |
| RG-T002, Medium | Test reload competes with the save-triggered account refresh in Firefox                                | Register the exact owned-origin account RSC response wait before Save, finish its body before reload, retain persisted-value assertion                                               |
| RG-T003, Medium | Screening tests assume unique global tutor labels and empty inventory                                  | Select exact tutor href/row; create a genuine eligible same-name decoy; retain targeted exclusion while the decoy remains visible                                                    |
| RG-T004, Medium | Next engine reuses an MFA-enrolled reviewer but the fixture expects password-only login                | Retain provider-returned test factor privately by actor ID; perform real challenges; assert null pending session and current assurance afterward                                     |
| RG-T005, Medium | College denial test permanently deletes a retained actor's student grant                               | Keep actual revoked-role/private-link denial; restore exactly the prior grant and full-precision timestamp in finally                                                                |
| RG-T006, Medium | Firefox disabled-JS context hangs restoring nonempty origin storage                                    | Preserve actual provider cookies, omit client-only origins; keep native disabled forms/exact protected URLs and explicit nonempty-origin regression precondition                     |
| L-001, Low      | New S1 refresh waiter can reject unobserved when an earlier save step fails                            | Attach immediate rejection observer; retain original await and primary failure; controlled early-failure probe verifies both branches                                                |
| RG-T007, Medium | Private HTML acquisition can fail during legitimate Back/document replacement before marker comparison | Two immediate readers acquire a completed root through SDK context reacquisition; run original marker/URL comparisons once afterward, with deliberate contaminated-document controls |

The first six assumptions predate the comparison baseline. RG-T007's direct read
helpers also predate it; the precise introducing trigger of the observed failure
is not established. Legitimate identity replacement is preserved. No private
payload leak was observed: the recorded post-Back read threw before producing
its privacy boolean. This is a verified observation defect, not evidence of a
product vulnerability. SDK generic error wording does not prove one underlying
cause.

S1 reproduced both account failures, then passed the repaired case twice per
engine and 12 neighbors. S2 reproduced all three original screening/MFA failures;
restoring its old heading selector against the controlled decoy failed as
expected. Corrected matrix: 18 passed, then 36 repeated cases; 24 repeated policy
cases passed after its final privacy-safe assertion edit. These overlap and are
not 60 unique scenarios. Intermediate setup/throttle failures remain recorded.
Owned loopback throttle reset follows existing W7 fixture conventions; no
product rate limit or provider factor is changed.

For RG-T006, coordinator and S3 independently reproduced the SDK/runtime failure
using trivial loopback HTML without Learli or a database. Empty origins work,
nonempty localStorage with disabled JS hangs, identical JS-enabled state works.
Cookie-authenticated no-JS controls work in all three engines and prove scripts
stay disabled. The full hosted journey passes all engines; safeguarding helper
consumers pass Firefox/WebKit. No general upstream cause is claimed.

For L-001, the actual extracted save block uses real Firefox/WebKit waiters,
click/status failures and teardown: four original cases produce unhandled
redacted rejections; all four corrected cases preserve the primary error and
produce none. The ordinary journey passes both engines. S4's scoped fix is
retained and independently accepted even though its expanded Chromium task
honestly settled **failed** on unrelated acceptance failures listed below.

For RG-T007, actual extracted helpers and event-gated Chromium navigation
reproduce the original acquisition failure; corrected readers capture completed
HTML. Each reader still rejects all nine raw/encoded/token canaries in script,
element attribute and root attribute. Shared reader controls also reject URL
contamination, a real script error and a closed-page read. The six normal
integration cases and ten shared Firefox/WebKit consumer cases pass. Privacy
comparisons are outside acquisition and never retried until markers disappear.
Ordinary root markup includes attributes and bootstrap scripts; doctype/default
shadow-root limitations do not remove any tested marker representation.

One new test definition covers retained MFA challenge; existing tests gain
meaningful identity, denial, ordering and native/HTML safeguards. No tests,
privacy checks, retries, timeouts, security controls or policies are weakened.
No framework, dependency, index, lock, production cache or architectural layer
is added. Application/schema/public API/business behavior is unchanged.

Modified verification files:

- `tests/e2e/cross-browser-acceptance.spec.ts`
- `tests/e2e/cross-browser-support.ts`
- `tests/e2e/four-feature-integration.spec.ts`
- `tests/e2e/hosted-workflows-integration.spec.ts`
- `tests/e2e/policy-booking.spec.ts`
- `tests/e2e/tutor-screening.spec.ts`
- `tests/e2e/w8-fixtures.ts`

## Validation and combined source identity

Environment: owned loopback synthetic PostgreSQL 17.11, Node 24.20.0,
npm 11.19.0, exact lockfile and Playwright 1.64.0. Child databases and ports are
independent. Authoritative validation subprocesses use basic environment allowlists plus
explicit local targets, without inherited cloud/provider credentials. Email/HTTPS/provider
failure fixtures are local; no live customer/provider experiment occurred. Two
preliminary pure HTTP/browser S5 probes inherited the shell environment; their
code read no credentials and used no external service, and they were rerun under
the scrubbed wrapper for the authoritative evidence.

| Executed check                                           | Observed result                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Pinned install/dependency tree, fresh 32-migration chain | Pass                                                                                           |
| Initial check                                            | Format/lint/types and 1,751 unit/component cases in 118 files pass                             |
| Full PostgreSQL integration                              | 996 cases in 69 suites pass; no skips                                                          |
| Production build                                         | Pass                                                                                           |
| Populated backup/restore                                 | One actual round-trip test passes                                                              |
| Original normal Chromium                                 | All 205 cases pass                                                                             |
| Original expanded Firefox/WebKit                         | 66 pass, six fail, four not run of 76 registered                                               |
| Original standalone hosted Firefox                       | Same native-context acquisition failure reproduced                                             |
| Integrated expanded before/after S4                      | Two separate 78-case runs pass; these overlap                                                  |
| S4 first full Chromium                                   | 67 pass, one availability-focus failure, 138 dependency-blocked                                |
| Unchanged availability diagnostic                        | All three cases pass; cause of first miss remains unestablished                                |
| S4 second full Chromium                                  | 150 pass, one private-snapshot acquisition failure, 55 dependency-blocked; availability passes |
| Final complete-source check                              | Format/lint/types and all 1,751 unit/component cases pass                                      |
| Final complete-source full Chromium                      | 206 pass, no failures/skips/unrun (418.085s)                                                   |
| Final complete-source full Firefox/WebKit                | 78 pass, no failures/skips/unrun; exit 0 (11.3m)                                               |
| Independent L/M/N/O/P closure                            | Scoped evidence accepted; L-001 and snapshot corrections independently closed                  |

Partial runs are not combined into a full-pass claim. No third unchanged full
Chromium retry occurred: the final run follows the separately verified snapshot
correction. One intermediate final-check attempt failed only draft-report
formatting; formatting was corrected and the full check passed afterward.

An executed actual-parent/current formatter comparison agrees for 3,456 cases
(12 IANA zones, 48 instants, six spans) and three invalid-input classes, including
DST folds/gaps, midnight and non-hour offsets. This is correctness parity, not a
speed measurement. No paired historical system-latency, throughput or memory
benchmark is claimed. Runtime import analysis finds two unchanged cycles, zero
new cycles, and no local database/server-only modules in 62 client closures;
computed imports/external internals are outside that finite scan.

All 833 originally frozen program/test paths are compared. Exactly seven E2E
paths change; the other 826, including all application/schema/configuration and
dependencies, retain the initial tested bytes. Parent and S5 child match all
833 final hashes independently checked by P. This supports carrying unchanged
PostgreSQL/build evidence while executing both full final browser suites against
identical integrated code with isolated data. All 833 hashes were rechecked after both executions and still match in both
worktrees. Acceptance combines actual suite exits, source identity and independent
review; individual worker claims alone are not the gate.

## Remaining risk and handoff

The availability status-focus assertion failed once; its unchanged diagnostic
and the next full attempt passed. Playwright requires both active element and
focused document, and the artifact does not distinguish them. React commit/rAF
timing, document focus and environment effects remain hypotheses. No app fix or
“flaky” classification is invented. Keep the assertion and specifically check
save/validation/keyboard focus during manual QA; use bounded timing/focus
instrumentation if it recurs.

Existing CP-G001 timeout/configuration-fingerprint epoch semantics remain
owner-deferred. Changing the digest can invalidate prepared delivery rows;
clarify timeout mutability and compatibility before any migration. This is not a
new confirmed regression. Existing public-launch/real operating-policy gates
remain. Real providers, deployed Railway/Neon, remote CI, physical devices,
every historical database dataset and paired system-performance measurements
are not verified.

Seven test/helper paths plus this report and progress tracker comprise the
operation diff. The original security checkout at `/Users/cob/learli`, its
branch/HEAD, 1,222 tracked contents/symlinks and existing report are preserved.
Local main remains `92ff3b9`. No commit, merge, push, deployment or production
mutation occurred. All owned fixtures are stopped with data retained and all 27 assigned ports
have no listeners. Worker resources are stopped/released with none reclaimable;
the original stopped E attempt retains only its historical bookkeeping record. Worktrees remain for
review.

Private evidence: `/Users/cob/orca/archives/learli/regression-police-20261016/`.
`exploration/` holds all scoped reports and source corrections;
`implementation/S1`–`S5` hold actual failures, probes, negative controls,
patch/hash/freeze/import receipts; `validation/` holds commands, exits and source
preservation proofs. Failed browser artifacts are separately archived. Raw
credentials/private captures are not reproduced here.

Final readiness: **READY FOR MANUAL QA**. Required automated checks pass on the
final integrated bytes, with no known blocking application regression. Revisit
availability save/validation/keyboard focus during manual QA. The assessment
applies to the isolated development stage; existing public-launch gates remain.
Next task: manual QA and owner review/commit decision, preserving the separate
security work and the retained evidence.
