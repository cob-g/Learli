# ARCHITECTURE POLICE — 2026-10-16

Status: one confirmed architectural defect corrected; execution validation and both independent audits complete.
Started October 15 and continued October 16, Asia/Manila.
Base/local main: `11d87f6a02f84130272909e391102ad796e4eb97`.
Run: `run_a250f25c8333`.

## Local main integration — 2026-10-16

Owner subsequently authorized commit and local merge. Implementation commit
`d165d6e` contains the exact four reviewed paths; merge
`4e301ca` has the identical tree, with no conflicts. All validated
application/test bytes are preserved, so existing execution evidence applies;
the full suites are not repeated just for Git integration. The integration
follow-up edits only this report and the tracker, with format/diff verification
recorded under the evidence archive's `local-merge/` directory.

Local `main` is checked out in the architecture operation directory. The feature
branch and operation worktree remain for a later cleanup step. Original dirty security work is
preserved; no push, deployment, provider call or production mutation occurred.
The sections below record the completed audit and its evidence before this merge.

## Exploration and intended architecture

Nine source-investigation/re-audit assignments cover the repository's major
boundaries. Eleven GPT-6 Luna agent starts were requested, including two extra
recovery/preparation sessions; one GPT-6.1 Sol worker implemented the correction.
The orchestrator model was unchanged. Parallelism stayed at three workers.

The inventory includes 31 feature modules, 474 source files, 56 API route
handlers, 22 schema files and 32 SQL migrations. The initial resolved graph covers
500 modules under `src/` and `scripts/`, with 1,684 internal static edges:
1,430 runtime and 254 erased/type-only. Vendor/generated output is excluded from
that source graph; production client artifacts were inspected separately.

| Scope | Boundaries reviewed                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| A     | Global imports, runtime/type edges, cycles, client/server dependency closures                                         |
| B     | Bookings, availability, time off, learners, family dashboards and private meeting information                         |
| C     | Better Auth ownership, accounts, sessions, current identity/permissions and admin MFA                                 |
| D     | Public catalog, matching, forms, presentation state and workspace composition                                         |
| E     | Admission, screening, safeguarding, support, private reviews and publication                                          |
| F     | Guarded PostgreSQL/runtime, environment, email, delivery, operators, migrations, CI and deployment configuration      |
| G     | Independent discovery/sign-in/ownership/booking/support/notice handoffs and hosted public-discovery gate adjudication |
| H / I | Independent final dependency/artifact and compatibility/regression-evidence audits                                    |

The established design is one Next.js App Router modular monolith. Presentation
collects input; trusted server entries invoke feature-owned rules and guarded
Drizzle/PostgreSQL operations. Feature-local SQL and narrow database functions
are legitimate. Better Auth owns provider state; focused adapters own email and
external transport. Local simulation, hosted synthetic readiness, Neon development
and operator capabilities intentionally have different admission/composition rules.
No repository layer, universal interface or new architectural framework is warranted.

Static breadth does not establish that every line or possible runtime interleaving
was audited. The individual reports identify examined files and limitations.

## Findings and decisions

Three candidate leads were adjudicated: one confirmed defect, one current-defect
false positive/intentional distinction, and one existing unresolved contract
ambiguity. Confirmed severity: Critical 0, High 0, Medium 1, Low 0. No additional
high-confidence unresolved architectural defect was established.

| ID                 | Category and evidence                                                                                                                                                                                                                                                                                                                             | Decision                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-001 / A-01      | Medium, client/persistence boundary: client `when-form.tsx` and `tutor-filter-form.tsx` import `matching/preferences.ts`; its runtime `learnerLevels` import evaluated `lib/db/schema/app.ts`, auth-table metadata and Drizzle constructors. A baseline 43,106-byte client chunk actually contains schema constraint markers and Drizzle symbols. | Fixed by reusing the existing client-safe `subjects/catalog.ts` options in the two URL-validation predicates. Three regression cases added.                                                                                               |
| AP-002 / D-PUB-01  | Public loaders use local-only `getAuthRuntime`, while hosted-synthetic accounts use a separate runtime.                                                                                                                                                                                                                                           | Independent G review confirmed the split is explicitly intentional under current decisions. No public runtime/screening scope was switched. Hosted public discovery remains a future gated capability, not a current architecture defect. |
| AP-003 / F-POT-001 | Previously recorded CP-G-001: delivery `timeoutMs` is outside the prepared configuration fingerprint, while broad operator wording leaves the immutable epoch ambiguous.                                                                                                                                                                          | Deferred. No confirmed architectural violation; changing the digest without an agreed version/compatibility mechanism could strand existing prepared retries.                                                                             |

Two runtime cycles remain: booking/workflow schema foreign-key callbacks and
permission/admin-assurance request-time functions. They are real graph cycles;
no concrete initialization failure or harmful architectural consequence was
established. No cycle was removed merely for uniformity. The identity review also
noted missing positive hosted session-revocation test coverage; it did not prove
a product defect. That remains a focused verification opportunity.

The D report's claim that matching preferences already had only pure runtime
imports was contradicted by the actual source, A graph and built artifact; that
claim was rejected. Explorer recommendations were independently checked.

## Implementation and compatibility

One Sol worker independently confirmed AP-001, reviewed consumers and selected
the smaller existing-catalog correction rather than relocating schema constants.
Only one production file changes: `src/features/matching/preferences.ts`.
`tests/unit/matching-client-boundary.test.ts` adds three cases that import/use the
real helpers with Drizzle constructors unavailable, verify exact URL roundtrips,
all four accepted levels, invalid/repeated values and private-key removal.

The exact final test bytes fail all three cases against original source, then
pass with the correction. The worker's 72 related unit/component cases, scoped
format/lint and full types pass. Raw red/green logs and content hashes are retained.

One runtime dependency edge is corrected; both client callers benefit. No functions
or files were relocated, no cycles removed, and no new layers, dependencies,
provider interfaces, generated clients, migrations or compatibility adapters were
introduced. Four final paths change including this report and the progress tracker.

The change is backward compatible: exported signatures, persisted values,
`elementary`, `middle_school`, `high_school`, `college_support`, ordering, URL
semantics and error behavior are preserved. Existing catalog/schema exhaustivity
and ordering checks remain. Permissions, booking rules and real-use gates are
unchanged. No conditional or breaking change was made.

## Executed validation

Environment: isolated macOS checkout, Node 24.20.0/npm 11.19.0, PostgreSQL 17.11,
pinned lockfile, fresh owned loopback databases, synthetic fixtures and mocked
external providers. Existing private environment files/credentials were not copied.

| Check                                   | Observed result                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Baseline `check`                        | Format, ESLint, full types; 1,748 unit/component cases in 117 files pass                                |
| Baseline complete PostgreSQL suite      | Correctly configured run: 996 cases in 69 files pass, zero skipped                                      |
| Final integrated `check`                | Format, ESLint, full types; 1,751 cases in 118 files pass                                               |
| Final affected PostgreSQL suites        | Matching, tutor catalog and public availability: 43 cases in three files pass                           |
| Final original-config Chromium suite    | All 205 cases pass, no failures/skips, 437.21 seconds; no retry override                                |
| Production build                        | Passes; existing local-mail dynamic tracing warning remains after fixture generation                    |
| Final client artifact scan              | All 61 client JavaScript files inspected; original schema/Drizzle markers absent, original chunk absent |
| Documentation formatting / diff         | Final commands/results recorded in `validation/documentation-checks.json`                               |
| Independent I compatibility/test audit  | Clean scoped result; no residual actionable finding                                                     |
| Independent H dependency/artifact audit | Clean; 62 client entry closures exclude database/server-auth runtime, final route chunks checked        |

The first baseline PostgreSQL attempt omitted the coordinator's required explicit
TLS fixture port: 988 cases passed, eight were setup-skipped and one suite failed
setup. This harness failure is preserved. The unchanged source passed all 996
when rerun with the assigned owned port; no product workaround was made.

Program/test source hashes remained stable through final checks, build, affected
PostgreSQL and browser execution. The client scan proves removal of the observed
schema construction together with source tracing; no latency, total bundle-size
improvement, secret-leak or universal architecture guarantee is claimed.
Remote CI, Firefox/WebKit, physical devices, live Neon/Resend, deployment and
real-user/public-launch acceptance were not executed.
The project formatter intentionally excludes `context/`; the report formatting
and tracked-diff whitespace checks are executed, while the tracker follows its
existing manual convention.

## Independent audit and cleanup

Independent I verified both changed predicates, actual consumers, catalog/schema
exhaustivity, exact red/green hashes and meaningful mock/assertion behavior.
Independent H resolved the changed alias/type-only seam, reconstructed all 62 client
closures from the preserved graph plus the verified source-edge delta, compared
unchanged cycles and independently scanned the actual final chunks/manifests.
Both audits found no residual actionable finding; neither ran tests or builds.

Original A/E source reports were recovered after their completion commands failed
through a pre-existing broken `orca` PATH alias. C stopped before source review
and was successfully retried with the explicitly selected working executable.
The stopped dispatches and transport failures remain in the ledger; their history
is not relabeled as successful completion delivery. No global CLI/configuration
was modified. One unused structured preparation chat is idle; its terminal-close
handle was rejected as stale, and no broad session close was attempted.
The fleet records ten released resources. C’s successful retry used a pre-created
terminal, so release retains external-resource accounting; its exact owned tab
was closed separately. The fleet still reports missing status for that external
lane, which is not evidence of process exit. No unrelated session was killed.

The Sol helper's exact two files were verified against the integrated checkout,
archived with read-back SHA-256 verification, then its worktree and branch were
removed. Owned runtime fixtures are stopped, assigned ports have no listeners,
and database data is preserved. At audit completion, the primary architecture checkout and branch remained
uncommitted for review. The audit performed no commit, merge, push, deployment,
production mutation, payment or real notification; the subsequent authorized
local merge is recorded above.

The dirty original security checkout and its existing changes were preserved.
Local main was unchanged during the audit and then advanced only by the authorized
integration above; byte/ref verification is recorded separately.

## Evidence and next step

Durable private evidence:
`/Users/cob/orca/archives/learli/architecture-police-20261015/`.
It contains the original-preservation snapshot, agent launch/lifecycle receipts,
A–G reports, H/I audits, dependency graphs, baseline failures/results, worker
red/green proof, integrated patch, final check/build/runtime receipts, source
hashes and helper archive/removal proof.

Next small task: owner-directed worktree/branch cleanup after the completed local
merge. The delivery epoch needs a separate explicit contract decision; hosted
public discovery needs its approved launch/policy composition first.
