# Six-worker readiness wave — 2026-10-12

Authority: **AUTHORIZED — build-feature delegation**. The user approved the six
readiness packages and explicitly requested GPT-6.1 Sol with **High** effort for
every worker. This authorizes scoped local implementation, verification,
coordination, recovery and integration preparation. No merge, push, deployment,
production operation or worktree deletion is included in this wave request.

Baseline: `5634e44fd71e8851400e004de6bbe3554e65eae1` on main/origin/main.
Root `ORCHESTRATION-LESSONS.md` is an existing uncommitted user-requested artifact;
preserve it. Workers read that file from `/Users/cob/learli` because it is not yet
part of the Git baseline. Main has no application edits at kickoff.

## Outcome and scope

Deliver six useful readiness packages from M1/M8 and PRD NFR requirements.
Preserve the local-only authentication, synthetic booking, private capture,
authorization, guardian and commercial boundaries. No new customer policy,
provider provisioning, actual email delivery or public pilot is authorized.

Each worker reads AGENTS.md and the eight canonical context files in order and
uses `$build-feature` for its bounded code/tooling/documentation package, with
separate read-only Review and executed Verify stages. Each has its own blueprint,
report, source manifest and local memory. Root owns coordination and combined
acceptance. Routine in-scope technical decisions are delegated; material scope
changes return to root.

## Ownership and local environments

| Worker | Package and traceability                                   | Exclusive primary edit scope                                                                                             | DB / dev / test ports                     |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 1      | Dependency security maintenance; M1.1/M1.6/M8.8, NFR-05/06 | package.json, package-lock.json, dependency-specific compatibility changes only after root allocation; dependency report | 55501 / 3061 / 3161                       |
| 2      | Reusable local backup/restore proof; M8.4/M8.7, NFR-11/12  | New local backup/restore tooling and tests, recovery runbook; no historical migration edits                              | 55502 / 3062 / 3162; restore target 55512 |
| 3      | Deployment preparation; M8.1/M8.3, NFR-11                  | New deployment runbook and narrowly necessary startup/preflight tooling; no provider/environment mutation                | 55503 / 3063 / 3163                       |
| 4      | Safe operational diagnostics; M8.6/M8.8, NFR-09/10/05      | New server diagnostics helper, bounded shared mutation/database failure integration, dedicated tests/runbook             | 55504 / 3064 / 3164                       |
| 5      | Firefox/WebKit acceptance; M8.9, NFR-01/02/05/09           | Separate cross-browser config and owned test files, compatibility report; application fixes require root assignment      | 55505 / 3065 / 3165                       |
| 6      | Reproducible performance baseline; PRD NFR-08, M8.9        | Separate performance harness/config/fixtures and evidence/runbook; no speculative optimizations                          | 55506 / 3066 / 3166                       |

All branches start independently from the baseline. Setup hooks are skipped:
the repository hook runs `npm install`, whereas these workers need controlled
`npm ci` from the pinned lockfile and coordinated resource usage. Use the pinned
Node/npm versions and owned PostgreSQL only. Never copy root/peer credentials,
node_modules, generated build output or database state. Restoration may populate
only a new disposable target owned by Worker 2; never overwrite existing data.

Workers may update their own isolated context documents and unique blueprints as
required by build-feature; root reconciles those contributions into the combined
candidate. Root owns shared test registration/CI and final canonical docs. Worker
1 alone edits package/lockfile; other workers request new scripts/dependencies.
No application migration is expected. Request root allocation before adding one.

## Dependencies and verification scheduling

All six begin independent inspection/design immediately. Worker 1 publishes a
frozen dependency result; consumers await root's explicit accepted import before
claiming final dependency-compatible verification. Unavailable upstream fixes
must be reported honestly; do not force downgrades or hide advisories.

Worker 5 authors/executes explicit Firefox and WebKit synthetic journeys; root
coordinates fixes with the owning worker. Worker 6 can design the harness now,
but final measurements require a root-approved dependency/runtime candidate and
an exclusive timing slot. Baseline measurements must identify their source and
conditions; they do not establish production latency or an SLA.

At most two heavy jobs run concurrently across the wave, including npm installs,
builds, large test suites and DB restore verification. Slots are granted through
Orca ask/reply and released by a worker message after each granted phase. Initial
slots: Worker 1 (A), Worker 2 (B). Others may inspect/design/edit before requesting
a slot. Performance timing requires both slots exclusive. No worker may spawn
additional agents or start an unallocated heavy phase.

Integration and browser suites sharing a test database run sequentially. Build
and type generation in a checkout do not race. Fixtures have explicit ownership
and guaranteed teardown; preserve real authentication and expiry behavior. Check
new test discovery before accepting results. Do not weaken assertions or privacy
boundaries to make Firefox/WebKit or timing scenarios pass.

## Required handoff and acceptance

Each worker supplies a sanitized `.local/readiness-wave/report.md` with actual
branch/HEAD, modified-file hashes, blueprint authority, decisions, separate
Review and Verify results, commands/exit codes, evidence paths, failures and
remaining limits. Preserve original failed attempts. Never expose secrets,
private meeting values, mail proofs, cookies or identifying fixture payloads in
tracked reports. Same-agent review is labeled honestly.

Root accepts the frozen dependency result, reconciles the six outputs in an
isolated integration candidate, runs applicable combined verification and obtains
independent review before reporting merge readiness. Reuse unchanged evidence
only with explicit applicability; new shared runtime/dependency changes trigger
affected retesting. Worker completion is not whole-wave completion.

At kickoff all implementation/review/verification outcomes are **pending**. The
proposed six workers are the initial team size, not an Orca hard-limit claim.
Authoritative Run/Task/Dispatch IDs, launch settings, heavy-job grants and progress
are maintained privately in `.local/readiness-wave/` by root.

## Accepted coordination refinements during verification

- The restoration proof is registered through `vitest.restore.config.ts` and
  `tests/operations/local-backup-restore.test.ts`, with explicit `test:restore`
  and `db:restore:drill` scripts owned by root. It requires a checkout-owned
  cluster and must not silently enter the Docker CI integration suite.
- Worker 5 reproduced WebKit native select targets at 30px instead of the existing
  UI contract's 44px minimum. Root allocated only the necessary `.field` native
  control repair in `src/app/globals.css`, related documentation and regression
  evidence to Worker 5 (Orca message `msg_33183702628d`). This is a scoped repair
  under the existing build-feature delegation, not a new visual system decision.
  Final performance/browser acceptance must use the accepted repaired runtime.

- Independent restore Review A found startup could leave the new target running
  if tool-result logging failed after PostgreSQL started. A separate repair owner
  reconciles positive process ownership and verifies real post-start failure
  cleanup; independent re-review remains required before closure.
- Combined integration checks twice reproduced the baseline email form's initial
  status-focus failure (759/760 each; isolated 8/8 passed). Root allocated only
  `src/features/account-email/email-form.tsx`, its component test and the canonical
  integration recovery note to a separate High-effort build-feature worker for
  evidence-based diagnosis and a bounded repair. Existing focus, privacy,
  validation and uncertainty assertions must remain; no timeout or test weakening.
  This is local verification recovery, not authorization for broader auth changes.

- Independent Review C found Playwright request failures could propagate private
  verification URLs or session headers through the new browser harness reporter.
  Worker 5 owns a bounded harness-only failure projection and meaningful negative
  regression, preserving failed outcomes and all behavior assertions. Root will
  obtain independent re-review and affected browser verification for the revised
  source. No application runtime or privacy-policy expansion is authorized.

- The later Firefox matrix reproduced a saved-booking result focus failure after
  retry. Root owns only `demo-booking-form.tsx` and its focused regression for a
  commit-tied result-focus correction. Controlled early-frame cases must first
  reproduce the defect, then pass without changing idempotency, uncertainty,
  expiry, authorization or existing browser assertions. Review C and affected
  browser proof are required; timing waits for the accepted revised runtime.
