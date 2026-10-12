# Learli orchestration lessons

Recorded 2026-10-12 from the completed local feature waves. This is a reusable
working guide for the next orchestrator, with particular attention to testing,
integration, and safe cleanup.

Read this alongside [AGENTS.md](AGENTS.md) and its eight canonical context files
in their required order. Current user instructions, project requirements, actual
repository state, and current evidence take precedence over this historical
guide. This file does not authorize spawning, implementation, merging, pushing,
deployment, or production operations. Reuse authorization already given for the
current task; do not ask for it again unnecessarily.

## 1. Lessons supported by the previous waves

| What happened                                                                                                                                                        | What the next orchestrator should do                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four support component assertions were authored but not discovered by the test configuration. Integration brought them into the existing include convention.         | Check test discovery before accepting a worker's test count. A test file's existence does not prove execution.                                                              |
| A deliberately oversized availability fixture remained publicly eligible and caused a later matching suite to hit its legitimate capacity bound.                     | Give fixtures explicit owners and guaranteed teardown. Diagnose pollution before changing application limits or assertions.                                                 |
| A combined browser journey assumed a tutor was signed in after registration, although automatic sign-in was intentionally disabled.                                  | Exercise the real authentication flow and prove its preconditions. Do not replace the journey with privileged fixture shortcuts.                                            |
| Browser navigation retained previously authorized private data in an existing document, despite server access denials. Independent review required further recovery. | Test the same browser across logout, account switching, revoked sessions, failed reauthentication, and Back navigation. Server denial alone does not prove browser privacy. |
| Generated HTML reports embedded private fixture values and failure payloads.                                                                                         | Inspect evidence artifacts as well as application responses. Keep sensitive evidence private and sanitize shareable summaries without changing results.                     |
| Repairs produced mixed evidence: unchanged cases from a full run plus focused reruns.                                                                                | Describe exactly what ran. Never turn combined historical coverage into a claim that one complete suite passed.                                                             |
| Main's databases lagged behind reviewed feature migrations. The latest closeout found main at 0012 before applying 0013–0016.                                        | Inspect the actual migration journal and grants in every target database. A Git merge does not migrate a database.                                                          |
| Orca accepted a worktree removal before physical removal finished; an immediate existence assertion was premature.                                                   | Observe completion after an accepted removal. Do not issue duplicate destructive requests because cleanup is asynchronous.                                                  |

Evidence: [six-feature integration](docs/operations/six-feature-premerge.md),
[four-feature integration and recovery](docs/operations/four-feature-premerge.md),
and [three-feature closeout](docs/operations/three-feature-closeout.md).
These reports contain historical checkpoints; later completion entries supersede
earlier pending-state descriptions.

## 2. Define ownership and integration before spawning

Choose workers from independently useful work packages in the PRD/build plan.
Unchecked milestone boxes can represent launch gates for already implemented
local capabilities. Inspect code and current evidence before proposing a feature.

Each implementation worker needs a self-contained contract:

- User outcome, PRD IDs, build-plan package, baseline commit, and definition of done.
- Its branch/worktree, editable areas, prohibited areas, and shared-file owner.
- Required inputs from other workers and the exact interface/version it consumes.
- Assigned application/test/database ports and isolated data ownership.
- Required checks, reporting location, and a clear next owner after completion.
- The applicable model/effort request; verify the actual launch settings.
- An explicit instruction to read and use `$build-feature` for implementation.

Use the build-feature stages: Architect → Implement → read-only Review → Verify
→ Remember, with Recover for failures. Record delegated blueprint authority as
`AUTHORIZED — build-feature delegation`; do not invent separate human approval.
Read-only reviewers and verification specialists need tasks matching their role,
without automatic authority to implement unrelated fixes.

Assign one owner to shared dependencies/lockfiles, migration numbering and journal,
schema exports/grants, test discovery configuration, shared page integration, and
canonical context reconciliation. Workers can prepare scoped contributions in
their own worktrees; the integration owner reconciles them deliberately. Separate
worktrees do not eliminate semantic conflicts.

Freeze a provider's interface before a dependent worker imports it. Record source
versions and accepted files. Let workers continue independent tasks while waiting
for an actual prerequisite. Avoid simultaneous editors for the same responsibility.

## 3. Treat testing as a coordinated workload

### Isolate state and schedule expensive checks

- Give each worker its own synthetic database, credentials, capture directory,
  ports, and build output. Never reset main's or another worker's fixtures.
- Run integration and browser suites sequentially when they share a database.
  Existing suites mutate fixtures and reset rate-limit counters.
- Serialize competing build/type-generation operations within one checkout when
  they write the same generated files.
- Use guaranteed cleanup for owned fixtures, including failure paths. Avoid
  deleting unrelated records or weakening production guards to clean a test.
- Prepare short-lived reservations and authentication proofs near the assertion
  that needs them. Distinguish legitimate expiry from synchronization errors;
  do not extend product lifetimes just to make a test green.
- Prefer observed conditions over arbitrary sleeps. Record the original failure
  before repairing a locator, fixture, timing assumption, or implementation.

The proposed next wave was six workers plus the orchestrator: four implementation/
preparation workers and two verification specialists. On the inspected 16 GB
machine, the recommended starting budget was at most two heavy build/browser
jobs at once, with performance measurements running alone. This is a scheduling
recommendation, not a proven hard capacity limit. Recheck workload, memory, and
available runtime slots before each wave; reduce concurrency when needed.

### Verify the individual slice and the combined behavior

Workers execute the relevant checks required by their scope and repository rules.
The integration owner then verifies the assembled candidate. Isolated passes do
not prove that shared authorization, imports, migrations, or browser flows agree.

Before accepting verification:

1. Confirm new test files are discovered by the normal commands. Check explicit
   Playwright project registration and unit/component include patterns.
2. Run the applicable formatting, lint, type, unit/component, real PostgreSQL,
   production-build, and browser checks. Record exclusions and reasons.
3. Include combined journeys across feature boundaries, especially auth,
   ownership, suspension, expiry, meeting links, support, and notifications.
4. Exercise applicable negative cases, concurrency, DST/time zones, no-JS,
   keyboard, narrow/mobile/desktop layouts, and browser navigation privacy.
5. Report the actual browser engines and accessibility methods used. Chromium and
   axe results do not establish Firefox/WebKit or hardware screen-reader coverage.

A production build proves the application can compile and produce its deployment
output. It does not establish booking correctness, privacy, working migrations,
email delivery, or a successful deployment.

## 4. Bind review and verification to the exact candidate

For each check, preserve the command, result/exit status, environment, test scope,
evidence path, and source identity. Include relevant uncommitted/untracked files;
HEAD alone cannot identify a dirty candidate. Use a scoped file manifest or hashes
when integrating frozen work from multiple branches.

Keep these claims distinct:

| Claim                                 | Required meaning                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Implemented                           | Code exists; review or execution may remain.                                     |
| READY FOR VERIFICATION                | Read-only review found the scoped implementation ready to test.                  |
| Verification passed                   | Named checks actually passed for the identified state.                           |
| Independently reviewed                | A different agent/reviewer inspected the identified candidate.                   |
| Merged / migrated / pushed / deployed | Each operation was separately observed; none follows automatically from another. |

After a repair, review the changed scope and rerun affected checks plus required
broader checks. Reuse earlier passing evidence only with a documented argument
that relevant source, dependencies, configuration, schema, and assumptions remain
applicable. Label it retained evidence, not a fresh execution. New runtime,
dependency, or shared configuration changes can invalidate broad earlier results.

Do not rerun the entire matrix after every unchanged status-document edit. Also
do not use old passing counts to conceal a newer failure. A full run with 78 passes
and one failure followed by a focused pass is different from a single 79/79 run.
Keep both attempts and their source identities clear.

Freeze the final candidate before independent acceptance. Recheck its identity
when committing and merging so the accepted source is what reaches main.

## 5. Coordinate workers through actual runtime state

When Orca supervision is requested, load its current orchestration guidance from
the session's selected executable. Use real Run/Task/Dispatch records and supported
commands; do not substitute unrelated subagents or reconstruct authority from old
terminal titles or historical messages.

- Track every task's owner, stage, dependency, evidence, and unresolved finding.
- Answer worker questions at the narrowest useful scope; continue independent work.
- Diagnose failures before dispatching repairs, and identify the repair owner.
- Process all delivered messages before acknowledgment. A timeout or empty inbox
  does not prove a worker is finished or dead.
- Validate completion against the authoritative dispatch and its report.
- After accepting settlement, reuse for immediate authorized work, explicitly
  retain when requested, or release the worker. Never release a live/unknown worker
  merely because its last report is quiet.
- Give concise progress updates stating findings, blockers, and the next action.

Resolve ordinary technical and product details within existing delegated scope.
Do not invent commercial, guardian, safeguarding, or launch approval to keep an
agent busy. A prior completed wave's permission is not blanket authority for new
external or destructive operations.

## 6. Close out deliberately

When authorized for the current task:

1. Audit accepted files, unrelated changes, secrets, scope, and final evidence.
2. Commit/merge the reviewed candidate and verify the resulting source identity.
3. Inspect each database's real target identity, migration journal, and grants.
   Back up appropriately, apply reviewed migrations, and verify preservation and
   runtime permissions. A readable backup archive is not a successful restore test.
4. Report local merge, database migration, remote push, and deployment separately.
5. Before cleanup, prove worker settlement and account for all tracked, untracked,
   and valuable ignored work. Branch ancestry alone does not preserve uncommitted
   changes or local evidence.
6. Preserve necessary private evidence/handoffs before removing a worktree. Stop
   only its owned processes/database, then verify cleanup actually finished.
7. Update durable status from observed facts, preserving historical failures and
   limitations. Keep raw logs, credentials, captures, and backups out of Git.

### Verify process ownership before stopping anything

A process's current working directory is a reference to a folder, not proof of
which project or task owns the session. During readiness cleanup, the orchestrator
mistakenly associated background processes with the user's Claude session from
that directory alone. The user identified the actual session in EduSphere, and
its unchanged Orca terminal identity and connection were verified after Learli
cleanup. The unregistered background group exited during worktree removal; that
observation does not establish its exact owner or exit cause.

Check Orca's actual project/worktree/session binding, terminal identity, process
ancestry and open files before deciding what to stop. Target only the authorized
workspace, and recheck the other project's actual session afterward. An empty
terminal list does not prove no background processes exist; a matching CWD does
not establish an active task. Keep these facts separate in cleanup reports.

Local simulation, local mail capture, clean builds, and merged code never establish
real-user readiness. Consult current canonical decisions for remaining launch gates.

## 7. Prompt for a new orchestrator

Copy this into the new session, then state the actual task and its authorization:

```text
You are the Learli orchestrator for this session.

Read ORCHESTRATION-LESSONS.md, AGENTS.md, and the eight canonical context files
in AGENTS.md's required order. Treat the lessons as historical guidance, not
current status or permission to start work. Reconcile the latest relevant
handoff with actual Git, worktrees, worker state, and applicable evidence.

Before spawning, propose or confirm the authorized wave's ownership, dependency,
integration, environment-isolation, and verification plan. Follow my current
instruction about whether to plan only or execute. Use the applicable requested
model/effort and $build-feature for implementation workers. Coordinate shared
files and expensive checks; use independent review for the final candidate.

Pay special attention to test discovery, fixture cleanup, shared database resets,
real auth preconditions, expiry-sensitive tests, cross-feature browser privacy,
and evidence tied to exact source versions. Preserve failures and rerun affected
checks after repairs. Distinguish retained evidence from newly executed checks.

Continue authorized work without repeatedly requesting the same permission.
Do not infer new production, commercial, safeguarding, merge, push, or destructive
authority from this document. Report verified outcomes and remaining work clearly.

Current task and authorization: [describe what I want you to do now]
```
