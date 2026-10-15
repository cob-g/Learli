# RACE CONDITION POLICE — 2026-10-15

Completed run `run_72ea7128142a` with one verified Medium defect corrected,
regression coverage added, and two independent audits accepting the integrated
fix. Three new candidate groups were triaged: one confirmed/fixed, one rejected
under the established in-flight authorization contract, and one unsupported
operator-overlap concern deferred. No new unresolved high-confidence application
race was established. Confirmed severity: Critical 0, High 0, Medium 1, Low 0.

Work is uncommitted on `cob-g/race-condition-police-20261015`, based on local
main `d357aacc57612a26daf7c53885ebe04f5c10caa8`, in
`/Users/cob/orca/workspaces/learli/race-condition-police-20261015`. No commit,
merge, push or deployment was performed for this operation. The user's separate
dirty security checkout was preserved.

## Exploration and actual agent accounting

Fourteen GPT-6 Luna high workers performed read-only investigation: nine initial
domains, three cross-module investigations, two post-fix audits. Two GPT-6.1 Sol
high workers implemented the independently verified fix and its ordinary browser
test registration. Launch receipts confirm every effective model and effort.
The environment supported three workers plus the coordinator concurrently;
independent waves used that capacity. All 16 tasks succeeded and their worker
resources were released with transcripts captured. The final reclaimable-worker
list is empty.

The inventory contains 1,215 tracked regular files, 31 feature directories,
56 route handlers, 22 schema sources and 32 forward SQL migrations. Exploration
mapped actual execution contexts and callers rather than treating all async
code as defective. Shared resources examined included booking/availability rows,
user/learner/guardian relationships, moderation and support state, delivery
claims and prepared payloads, provider session atoms and cookies, retained React
children, DB connection leases and operator filesystem outputs.

Core invariants checked included overlap prevention, retry deduplication, fresh
authorization after lock waits, consistent lock ordering, immutable delivery
material, current ownership, stale-result rejection, connection lifecycle and
private document identity. Existing locks, constraints, conditional claims and
documented eventual/in-flight behavior were traced before accepting findings.

The evidence directory is
`/tmp/learli-race-condition-police-20261015/`; report names below are relative
to that private directory. Every task's accepted outcome is recorded here;
`final-agent-accounting.json` includes exact dispatches and release states.

| Scope and task           | Accepted outcome                                                                                                                                   | Evidence                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A — `task_17a613bc133d`  | Booking locks, reservation/expiry/retry, rescheduling and private links investigated; no new supported race.                                       | `explore-A-booking-locks.md`                                                                          |
| B — `task_a76bec4dc1a8`  | Delivery claims, retries, prepared material and uncertain provider outcomes investigated; no new supported race.                                   | `explore-B-delivery-claims.md`                                                                        |
| C — `task_fab9a7788b50`  | Auth/account, sessions, OTP/MFA and sign-up transaction boundaries investigated; no new supported race.                                            | `explore-C-auth-account.md`                                                                           |
| D — `task_0ccba054dbff`  | Frontend async, navigation and shell state investigated; no initial finding. The later Y cross-boundary investigation found the actionable defect. | `explore-D-frontend-async.md`                                                                         |
| E — `task_c2ed8b8f66f4`  | Tutor scheduling, availability and catalog ordering investigated; no new supported race.                                                           | `explore-E-tutor-scheduling-catalog.md`                                                               |
| F — `task_fa2d0ead499c`  | Family, admission, support and restriction paths investigated; FS-RACE-01 proposed and later rejected by policy/source cross-check.                | `explore-F-family-support-state.md`                                                                   |
| G — `task_44a1155d9f38`  | Screening, safeguarding, private/public reviews and moderation locks investigated; no new supported race.                                          | `explore-G-reviews-screening.md`                                                                      |
| H — `task_73954f123c41`  | Runtime pools, lease/TLS identity, initialization and shutdown investigated; no new supported race.                                                | `explore-H-runtime-pool-lifecycle.md`                                                                 |
| I — `task_6dbd355f736d`  | Operator mirrors, local files and test infrastructure investigated; OPS-FS-01 proposed and later deferred outside supported parallel execution.    | `explore-I-operator-files-tests.md`                                                                   |
| X — `task_b75541edd606`  | Cross-module authority and lock-order review rejected FS-RACE-01 under the explicit permitted in-flight rule.                                      | `cross-X-authority-locks.md`                                                                          |
| Y — `task_94fa7b0e3db8`  | Cross-boundary provider identity, server render and private-child retention analysis identified Y-RACE-01.                                         | `cross-Y-client-server-ordering.md`                                                                   |
| Z — `task_2ddbfa4fc5bc`  | Cross-boundary delivery, lifecycle and filesystem review established no additional application race; assessed OPS-FS-01 scope.                     | `cross-Z-delivery-lifecycle-files.md`                                                                 |
| S1 — `task_2c1f4adfc718` | Independently verified Y-RACE-01; implemented and froze seven files; original-red/fixed-green and controlled Chromium verification passed.         | `implementation-private-document/report.md`, `source-manifest.json`, `source.patch` in that directory |
| S2 — `task_aa511e052d13` | Added the browser spec to the existing auth project; exactly three normal cases discovered; only `playwright.config.ts` changed.                   | `implementation-browser-registration/report.md`, `discovery.log` in that directory                    |
| K — `task_da667d9b4001`  | Independent post-fix identity/document/caller audit accepted the integrated hashes; no confirmed residual found.                                   | `audit-K-document-boundary.md`                                                                        |
| L — `task_b3ad926d3bc7`  | Independent post-fix test, integration, guard and registration audit accepted the integrated hashes; no confirmed residual found.                  | `audit-L-integration-tests.md`                                                                        |

Luna investigations and audits were source/evidence analysis, with no tests,
database writes or application execution by those agents. Runtime results below
belong to the coordinator or named Sol worker. Coverage is substantial but does
not prove all possible interleavings or deployments correct.

## Findings and dispositions

### Y-RACE-01 — settled account switch retains the previous private document

**Confirmed Medium; fixed.** Category: frontend async/session identity race.
Affected source: `src/features/auth/document-boundary.tsx`,
`src/app/(workspace)/layout.tsx`, `src/lib/permissions/workspace.ts`, and the
existing shell/meeting/session consumers traced by Y and S1.

Actors are the original private tab, another tab sharing the cookie jar, and
Better Auth's cross-tab session refresh. Shared state is the current provider
identity alongside already rendered server/private component state. The
invariant is that a settled replacement identity cannot continue using the
preceding identity's private screen. This is retained previously authorized
data, not an authorization bypass on a new server request.

Failure interleaving:

1. Server authorizes A/sessionA and delivers private children and inline
   bootstrap; meeting/session components retain their own previously read data.
2. Another tab signs out A and signs in B using the same browser cookies.
3. The first tab's installed Better Auth session atom settles to B/sessionB or
   null. Existing chrome changes or clears its identity.
4. The original private children and inline bootstrap remain under that changed
   identity; changing chrome alone does not release them.

S1 independently inspected installed Better Auth 1.7.7 storage/focus refresh,
then demonstrated the original defect with identical final component-test bytes:
10 failed/8 passed on original source; all 18 passed on fixed source. Failures
asserted actual retained private children, including the existing meeting and
session components, rather than just expecting a reload function call.

The smallest complete correction binds the document to the server-authorized
user/session independently of the optional display-account query. A display
query failure cannot erase a successful identity binding. The private boundary
subscribes to the existing provider atom, waits for a settled success or explicit
401, and latches any mismatch during render. It removes the complete private
subtree before an effect reloads the exact current document under normal server
authorization. A latch prevents ABA, pending/error changes or StrictMode replay
from reviving old children or reloading repeatedly. No extra provider fetch,
polling loop or database query/lock was added.

Controlled browser verification exposed that replacing an identical URL with a
fragment can stay within the same document. The corrected identity path uses
`location.reload()`; real tests preserve both query and fragment and prove a new
server document releases A's inline bootstrap. Pending/refetching reads,
transient errors and unchanged user/session retain normal mounted form state.
Existing server guards, per-render identity memoization, auth-route and BFCache
guards remain authoritative/unchanged.

### FS-RACE-01 — restriction after an already-authorized request

**Rejected / intentionally permitted behavior.** An initial family/support
report proposed stronger serialization when account status changes between a
successful authorization and commit. The architecture explicitly permits an
already-authorized in-flight request to finish, while requiring a fresh check
after relevant waits. Cross-review X traced those reads/locks and found no
demonstrated stale pre-wait authorization gap. Adding a status lock would invent
a stronger business policy. No source change or regression test was justified.

### OPS-FS-01 — overlapping acceptance tools in one checkout

**Deferred; unsupported operator overlap, not a confirmed application defect.**
W6/W8 acceptance tools share local mirror/fixture/manifest/build/port outputs.
Simultaneous independent invocations could conflict, but the documented
one-server, serial-build, isolated-checkout workflow does not support that
overlap. No supported concurrent caller or runtime reproduction was established.
The existing tooling boundary remains; no file-lock framework was introduced.

No distinct new unverified application finding was promoted during the two
post-fix audits. Possible same-fragment public-auth navigation was traced, but
no concrete supported caller established an additional violation. The workspace
Contact navigation was checked against the public header's persistent session
subscription and private-route remount guards; it was not runtime-tested as a
separate new browser journey. These limits are recorded in K/L.

## Implementation and compatibility

S1 used a separate fresh checkout,
`/Users/cob/orca/workspaces/learli/race-private-document-20261015`, with the same
base. The coordinator imported only the seven accepted source/test files after
matching SHA256 manifests. S2 separately owned the common Playwright config,
avoiding overlapping edits. The two post-fix Luna audits checked the actual
integrated snapshot, not the unchanged Git HEAD.

Eight application/test/config paths changed:

| Path                                                        | Result                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/auth/document-boundary.tsx`                   | Settled identity comparison, permanent transition latch, complete child removal, one full reload.                                                    |
| `src/app/(workspace)/layout.tsx`                            | Pass the trusted identity independently from optional shell display data.                                                                            |
| `src/lib/permissions/workspace.ts`                          | Replace the sole-consumer shell read with `readWorkspaceDocument`, preserving successful authorization after display-query failure.                  |
| `tests/components/private-document-identity.test.tsx`       | 13 deterministic identity/document cases with real private child components and a controlled deferred response.                                      |
| `tests/components/private-document-server-binding.test.tsx` | Five actual-layout composition cases, including display failure with first settled client identity B.                                                |
| `tests/e2e/private-document-identity.spec.ts`               | Three real-route Chromium cases for two-tab identity switch, logout and navigation without JavaScript.                                               |
| `tests/e2e/workspace-shell.spec.ts`                         | Existing cross-tab journey now expects document replacement/sign-in, followed by fresh authorized navigation as B; privacy/role assertions retained. |
| `playwright.config.ts`                                      | Register the new spec in the existing auth project; update one obsolete adjacent comment.                                                            |

Canonical architecture, progress tracker and this report are the three related
documentation changes: 11 paths total. Public APIs, persisted data, auth policies,
roles/ownership/MFA, booking transitions, SQL functions, schema/migrations,
dependencies and lockfile are unchanged. No new synchronization primitive,
atomic SQL operation, transaction, idempotency key, global serialization or
distributed coordination was necessary for this defect. Native server-rendered
private pages remain functional without JavaScript. No business-policy or public
contract change was introduced.

## Executed validation

### Coordinator baseline and final combined checks

| Check                                                                     | Actual result and evidence                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Baseline `node scripts/with-test-env.mjs npm run check`                   | PASS: formatting, lint, strict types; 1,673 tests in 113 files. `baseline-check.log`.                             |
| Baseline normal production `node scripts/with-test-env.mjs npm run build` | PASS. `baseline-build.log`.                                                                                       |
| Final same combined check after integration and registration              | PASS: formatting, lint, strict types; 1,691 tests in 115 files. `final-check.log`, `final-check-result.json`.     |
| Final normal production build, default Turbopack                          | PASS. `final-build.log`, `final-build-result.json`. No font mock or webpack override in this coordinator command. |
| Final scoped documentation formatting and diff check                      | Recorded in `final-doc-check.log` and `final-doc-check-result.json`.                                              |

The same three existing JSDOM “navigation to another Document” diagnostics occur
in the passing unit/component suite. They are not evidence of browser behavior.
The actual controlled Chromium run supplies that separate evidence.

### Synthetic PostgreSQL baseline

Fresh coordinator-owned loopback PostgreSQL covered **852 unique cases in 55
files across the initial run and a focused unchanged retry**. Initially 54 files
and 844 cases passed; hosted-auth setup refused to start eight cases without the
required TLS-port variable. An initial wrong-variable attempt also failed at
setup. With the correct assigned `LEARLI_STAGING_TEST_PORT`, the unchanged eight
hosted-auth cases passed. This was not one all-green 55-file run; both setup
failures and the successful correction remain in evidence.

Thirteen suites containing reset/TRUNCATE/structural-cleanup setup were excluded;
exact paths/reasons are in `integration-exclusions.json`. No suite assertions or
source were weakened. The aggregate is pre-change baseline evidence, not a final
repeated database suite. All persistence/schema/migration/grant and integration
test bytes remain unchanged, so no broad database repetition was needed for this
client document fix. S1 independently migrated a fresh own synthetic test
database for its browser tests; no migration file was added or changed.

### Sol focused and browser proof

S1 evidence is in `implementation-private-document/`:

- Exact final two component-test files on original production source:
  **10 failed/8 passed**, exit 1; fixed source: **18 passed**, exit 0.
  `identical-test-bytes.json`, `original-final-tests-red.log`,
  `fixed-final-tests-green.log`.
- Related workspace/header focused run: **60 passed** in four files;
  `focused-green.log`.
- Worker full check: **1,691 passed** in 115 files plus formatting/lint/types;
  `check.log`.
- Worker offline-font webpack production build passed. An earlier dynamic-font
  mock/default-Turbopack attempt failed; logs remain. This bounded worker build
  does not substitute for the coordinator's passing normal final build.
- Real production-server Chromium run: **18 passed**, 15 existing workspace
  cases plus three new cases, one worker; `browser-all-final.log`.
  A private config explicitly selected only these specs and avoided the broad
  reset/global setup. No full browser suite success is claimed.

The two-tab browser proof uses real local sign-in/sign-out, synthetic identities,
shared cookies and an actual provider response explicitly asserted to identify
B. Controlled promises and request interception hold a fresh document request;
a MutationObserver proves A's private DOM is removed before commit while the old
inline payload still exists. Releasing the request proves the new HTML/scripts
exclude A and the exact query/fragment survive. Separate cases verify logout
returns to guarded sign-in with A's API rejected, and account/session navigation
works with JavaScript disabled. A's account API under B is also rejected.

No actual booking/meeting URL was created in the browser database. The existing
meeting and session components are exercised by the deterministic component
regression; the browser uses a genuine synthetic private account/bootstrap.
Earlier same-fragment replacement and pending-navigation observation failures
are retained with the final correction. No random sleep/flood is the race proof.

S2 formatting/lint and normal discovery passed:
`node scripts/with-test-env.mjs node_modules/.bin/playwright test --project=auth private-document-identity.spec.ts --list`.
Exactly three cases are selected in one file. This is discovery, not another
execution of the browser suite or global setup.

## Deadlock, performance and second-pass assessment

No locks, transactions, retry loops or serialized shared database resource were
introduced, so this fix adds no lock-acquisition cycle or cross-instance lock
ownership requirement. Existing session observation is shared; regression
coverage checks there is no added fetch/refetch. This is code/test assessment,
not a throughput benchmark, load test or measured performance improvement.

Independent auditors K/L matched all seven imported hashes, reviewed the
server/display split, actual provider lifecycle, latch, full document reload,
page guards, tests and browser evidence, and accepted the fix. They did not run
tests. No confirmed residual required a further worker. They preserved intended
pending/transient behavior and identified no supported alternate auth path
bypassing this correction. Neither audit certifies every browser engine or
possible deployment.

## Preservation, resources and remaining risks

The original `/Users/cob/learli` remains on `fix/security-police-20261015` at
`1cab7228c1a6cfa864a7136e2c2e105da4c433d5`. All 1,210 baseline regular files,
12 symlink targets, protected uncommitted security notes and Git status are
preserved. Local main remains `d357aacc57612a26daf7c53885ebe04f5c10caa8`.
All unrelated integration baseline files and symlinks are preserved;
`final-preservation.json` records exact comparisons and the accepted 11-path
change scope. Final source hashes still match the accepted worker manifests.

Coordinator-owned DB 56131/TLS helpers and worker-owned DB 56141/server 3327 are
stopped; final owned PID/listener checks are in `final-resources.json`.
Synthetic databases, ignored environments/builds and private logs remain in their
own task checkouts for reproducibility. No live production data, provider
credentials or peer database were copied, reset or repaired. No real email,
payment or other external integration side effect was triggered.

The inherited provider-blocked direct-SQL isolation findings SQL-ISO-01/02 remain
deferred from the earlier security operation. They were explicitly excluded from
new worker scopes; no retry or alternative implementation was attempted.
Existing launch gates and unresolved business policies remain unchanged.

Remaining coverage limits: excluded destructive-setup suites; Firefox/WebKit and
actual BFCache restoration acceptance; the full E2E suite; hosted/provider and
production acceptance; multi-instance deployment stress; unsupported parallel
acceptance-tool invocations. There is no application queue/cache/storage system
added to satisfy hypothetical concurrency patterns. No stronger instantaneous
revocation policy was assumed. These limits are not represented as reproduced
defects or successful validation.

Next small action: review and commit/merge the isolated verified patch when
requested, then archive/remove its two task worktrees and branches. Existing
unrelated security worktrees and user work must continue to be preserved.
