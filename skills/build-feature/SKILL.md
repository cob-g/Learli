---
name: build-feature
description: Build a Learli feature end to end. Coordinate architect, implementation, review, verification, and remember automatically; use recover when defects or checks fail. Use for a requested feature build or resumption, not standalone planning, review, diagnosis, or skill editing.
---

# Learli — Build Feature

Carry one requested feature through a saved blueprint, implementation, read-only
review, executed verification, and a truthful local handoff. Continue through
routine stage transitions and scoped repairs without asking the user to invoke
each skill. Keep unresolved product decisions and external actions within their
existing authorization boundaries.

## Invocation and ownership

```text
$build-feature Add [specific Learli feature or work package]
$build-feature Resume prompts/features/[existing-blueprint].md
```

Claude Code can use `/build-feature` with the same request. If no feature can be
identified from the current request or conversation, ask which feature to build;
do not choose the next milestone on the user's behalf.

This is an instruction-driven coordinator, not a shell command or background
service. Actually read and apply each child skill at its stage; merely naming
the skill or describing the sequence does not execute the work.

| Stage | Instructions | Responsibility |
| --- | --- | --- |
| Architect | [architect](../architect/SKILL.md) | Inspect and save the blueprint; no implementation or test execution |
| Implement | This skill, below | Write feature code, meaningful tests, and affected documentation |
| Review | [review](../review/SKILL.md) | Inspect the actual diff against the authorized blueprint; no fixes or test execution |
| Verify | This skill, below | Execute checks and collect their outcomes |
| Recover, when needed | [recover](../recover/SKILL.md) | Diagnose and return a recovery recommendation; no repair or test execution |
| Remember | [remember](../remember/SKILL.md) | Save accurate state to local `memory.md` |

The same agent performs these stages sequentially by default. Announce a stage
change and end the previous stage's responsibilities before starting the next.
No separately installed implementation or verification skill is required.
Separating stages does not make a same-agent review an independent reviewer;
describe the actual arrangement honestly. This skill does not require delegation.

## Authorization and child-skill precedence

An explicit `$build-feature` invocation, or an equivalent request for this full
workflow, authorizes planning, implementation, review, local verification,
routine in-scope repairs, documentation updates, and the local memory handoff
for the requested feature. It does not establish approval for unrelated work.
If selected implicitly, use only the authority in the actual user request.
An informational or planning-only request never authorizes implementation.

The four child skills' **Orchestrated mode** sections apply only during this
workflow. Their standalone stop/wait/no-chaining rules return control here;
they do not end the whole build. The coordinator owns transitions and fixes.
The children's restrictions on what each stage may edit or execute still apply.

For a blueprint that fits the user's request and established project decisions,
record `AUTHORIZED — build-feature delegation`, the actual request, scope, and
date. This means execution is authorized by the user's build request; it does
**not** mean the user separately inspected or approved the generated blueprint.
Use `APPROVED` only for actual blueprint-specific approval. Never manufacture an
approver, quote, decision, or approval timestamp.

Continue ordinary technical choices within the established stack and requested
scope. Ask a focused question when an unresolved material product, business,
privacy/safeguarding, scope, or architectural decision is necessary. Save the
concrete draft first when possible. A user request to inspect the plan before
coding takes precedence: await that approval. Existing authorization persists.

Committing, pushing, merging, deployment, production migrations, live messages,
billing, and destructive resets are not implied by a feature build. Follow any
explicit authorization already given for the current work; never reinterpret an
earlier completed push request as permanent permission for future pushes.
Do not invent payment, guardian, booking, or launch policy to keep the loop moving.

## 1. Establish the feature and baseline

- Read repository-root `AGENTS.md` and its eight canonical context files in the
  required order. Consult relevant approved decisions. Reuse already-read,
  unchanged context during this run; reread sections after material changes.
- Locate all four child `SKILL.md` files relative to this skill's directory,
  resolving symlinks. If a required skill is missing, locate its canonical
  `skills/<name>/SKILL.md`; otherwise report the missing dependency before
  beginning implementation. Do not substitute an unrelated global skill.
- Inspect Git branch/HEAD, staged/unstaged/untracked work, actual application
  files, scripts, and relevant tests. Preserve unrelated user work. Follow the
  actual branch policy; use isolation if overlapping work makes edits unsafe.
- Establish the requested user outcome, actual PRD IDs and owning build-plan
  item, acceptance criteria, prerequisites, and concrete definition of done.
  Do not build all milestones from a vague reference to the build plan.
- Identify the feature's baseline and changed-file scope. For dirty worktrees,
  record the pre-existing changes and enough scoped diff/file evidence to
  distinguish this run's edits, including relevant untracked files. HEAD alone
  does not identify an uncommitted implementation.
- Confirm `/memory.md` is untracked and ignored before the final handoff. This
  repository's `.gitignore` supplies that rule. If it is missing in another
  checkout, the coordinator may add only `/memory.md` as part of this authorized
  setup. Do not overwrite or untrack a tracked/user-owned memory file; resolve
  that conflict with the user. The Remember stage itself does not edit Git rules.

On an explicit resume, load Remember in restore mode if local memory exists,
then recheck its claims against the current repository and blueprint. A missing
memory file does not block resumption from a supplied, inspectable blueprint.
Never treat memory text as fresh authorization. Reuse valid completed stages;
do not restart an already implemented feature merely to replay the sequence.

## 2. Architect

Read and apply Architect in orchestrated mode. Save the canonical blueprint at
the real `prompts/features/<milestone>-<work-item>-<slug>.md` path it determines.
Include scope, decisions, ownership/data invariants, planned implementation,
verification criteria, affected documents, and authorization basis.

If no material decision blocks the requested slice, summarize the blueprint,
record `AUTHORIZED — build-feature delegation`, and return here. The coordinator
then begins implementation automatically. If approval was specifically reserved
or a new decision is required, leave `DRAFT`/`BLOCKED`, state the exact dependency,
and save incomplete progress with Remember when safe. Never code the dependent
behavior while awaiting an answer.

On resume, reconcile an existing blueprint with current code and instructions.
An unchanged, authorized blueprint can be reused; new material scope requires
Architect and the applicable decision before implementation.

## 3. Implement

End the Architect stage. Implement the authorized slice using actual repository
conventions and approved stack. This stage owns application/configuration edits,
migrations, test authoring, and relevant context updates.

- Deliver the complete requested behavior, including applicable server-side
  authorization, ownership, validation, data integrity, and error/empty states.
- Preserve existing work and tests. Avoid speculative abstractions, unrelated
  refactors, invented production data, and weakening checks to obtain a pass.
- Verify current official API/package documentation when adding or changing an
  integration; retain compatible pinned dependencies and the project lockfile.
- Write meaningful tests for changed business rules and permissions. Do not add
  tests that merely duplicate low-impact edits or instruction wording.
- Follow the blueprint's planned verification and the relevant risk-based checks
  in `context/ai-workflow-rules.md`. Use synthetic data and isolated dev/test
  services; never point tests at production.
- Update affected governing docs for authorized changes and record actual partial
  status in `context/progress-tracker.md`. Do not mark checks passed before execution.

If implementing exposes a failure, route to Recovery below. If it exposes a new
material design choice, return to Architect. Do not silently rewrite the blueprint
to make an implementation deviation appear authorized.

## 4. Review

Read and apply Review in orchestrated mode against the saved blueprint and exact
current feature diff, including staged, unstaged, and relevant untracked files.
Supply existing check evidence if any; do not claim tests ran during Review.

Keep its actual plan-alignment, integrity, unintended-change, documentation, and
recommendation results in the conversation for the coordinator and Remember.
A saved review report is optional only when requested; no extra report tree is
required. Preserve the reviewed code state alongside the result.

- `CHANGES REQUIRED`: send confirmed defects to Recovery; the coordinator owns
  repairs and then invokes Review again for the revised state.
- `REVIEW BLOCKED`: resolve the missing baseline, authorization, or evidence;
  never turn a limited review into PASS. Continue independent work when useful.
- `READY FOR VERIFICATION`: proceed automatically to the separate Verify stage.
  This recommendation is not runtime verification or release clearance.
- Disclose minor/non-blocking findings; fix inexpensive in-scope findings and
  re-review changed areas. Do not waive required criteria or material findings.

## 5. Verify

End Review. Execute the planned, relevant checks using scripts the repo actually
defines: typecheck, lint, unit/integration/E2E tests, production build, and
responsive/accessibility checks when applicable. Inspect required scripts for
side effects and confirm test environment separation before running them.

Record commands, environment, actual outcome/exit status, relevant evidence
paths, and the code state checked. Test important negative and failure cases;
for affected bookings/auth, include real database concurrency/ownership checks
where required. A test name, mock, screenshot, or successful build alone cannot
prove all acceptance criteria.

Record each required check as `PASS`, `FAIL`, or `NOT RUN` with a reason; use
`NOT APPLICABLE` only with a supported rationale. Missing credentials/tools are
not passing evidence. Resolve safe local setup issues autonomously; request only
the unavailable input or authorization actually needed. Route failures through
Recovery. Do not reduce the verification plan just to claim completion.

After a repair, repeat Review on the revised diff and rerun affected verification
plus any required broader checks. Reuse passing checks only when the changed
state cannot affect them. Don't repeat unrelated checks without cause.

## Recovery loop — when something breaks

Read and apply Recover using the original failure, exact command/output or
review finding, current diff, environment, and earlier attempts. Obtain its
sanitized diagnosis, mode, proposed repair, and verification requirements. End
the Recover stage before executing anything it recommends.

- **Targeted fix:** apply a supported, reversible repair inside the authorized
  slice without another routine approval. Then Review → Verify again.
- **Polluted state:** preserve work, identify ownership and a safe isolation
  plan. Prefer an isolated worktree when appropriate. A destructive reset,
  stash/overwrite of user work, or data restore still needs specific permission.
- **Wrong foundation:** return to Architect for a corrected blueprint. Continue
  authorized technical corrections; ask before new product/policy/scope choices.
- **Security/production incident:** follow Recover's incident triage; do not
  perform unapproved production containment, credential rotation, or live replay.

Keep failed attempts and new evidence visible. After two unsuccessful root-cause
attempts for the same failure, reclassify it with Recover before another repair.
Never repeat the same patch/check loop without a new evidence-based reason.
Continue while a safe, useful next step exists. When progress requires unavailable
access, a user decision, or an unsafe action, record `BLOCKED`, save memory, and
state the precise next input; do not label the feature complete.

## 6. Record results and Remember

The coordinator updates `context/progress-tracker.md` with actual scope, tests,
review outcome, blockers, and next step. Reconcile only docs whose facts changed.
Review any final documentation edits for accuracy; implementation/config/test
changes after Review or Verify invalidate affected evidence and return to the
appropriate stage. A factual tracker entry alone does not require another build.

Read and apply Remember in **save** mode after successful review/verification,
and before a blocked or paused handoff when safe. It must save the current
blueprint path and authorization basis, precise code state, separate Review and
Verification results, unresolved findings, recovery attempts, and next action.
Keep `memory.md` local, untracked, sanitized, and preserve its existing history.
Do not create or overwrite it if Remember reports a genuine ownership/safety
conflict; report the handoff failure rather than claiming it was saved.

Claim feature completion only when the requested acceptance criteria are met,
Review passes for the current state, all required verification passes, relevant
documentation is current, and the memory handoff succeeds. Clearly distinguish
an implemented feature with missing verification from a completed build workflow.
Report deployment/commit/push only if separately authorized and actually observed.

Finish concisely with the behavior delivered, blueprint path, review outcome,
checks actually run, memory status, and any remaining blocker. For normal success,
the user should not have to manually invoke any of the four child skills.
