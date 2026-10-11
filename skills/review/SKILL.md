---
name: review
description: Read-only post-implementation review for Learli. Compare a completed change against the explicitly approved architect blueprint and Learli context; identify missing planned behavior, unauthorized scope changes, regressions, unsafe data or permission paths, and documentation drift. Report evidence and release blockers without modifying code, running verification, deploying, or fixing anything.
---

# Learli — Review Skill

## Orchestrated mode — called by `build-feature`

During an authorized [build-feature](../build-feature/SKILL.md) run, return the
completed report to the coordinator instead of ending the overall task or waiting
for another routine instruction. This overrides Step 4's standalone wait and
no-chaining requirement for the coordinator only. Review stays read-only and
does not repair code or execute checks. The coordinator owns recovery, repairs,
separate verification, and re-review after changes.

Accept a blueprint labeled `AUTHORIZED — build-feature delegation` as the scoped
execution baseline only when its recorded user request supports that authority
and all necessary product/policy decisions are resolved. Report this exact status;
do not relabel it as separately human-approved. A bare label is not permission.
Missing authorization, an unresolved material decision, or an unreliable code
baseline still blocks a full PASS. Standalone Review keeps the rules below.

A feature is **not** correct merely because the developer says it is finished or its UI looks right. This skill compares **what the Architect approved** with **what the Implementation workflow actually changed**, and checks whether existing Learli behavior and invariants were preserved.

**Learli is a one-on-one online tutoring marketplace and booking intermediary, not an LMS.** Its job is tutor discovery, rule-based matching, scheduling, booking, basic account and marketplace administration, and coordination of Zoom/Google Meet lessons. Do not accept unnecessary expansion into assignment uploads, teaching tools, grading, AI tutors, or advanced tutor management.

**This skill does ONE job: review the implementation.** It does not implement, recover, architect, or independently verify the system. The separate **Verification** workflow executes the tests, builds, browser checks, and operational checks. The reviewer may inspect the resulting evidence, but must not claim checks were run if they were not.

## What This Skill Does Not Do

**This is a read-only review.** Do not change the repository, including source files, tests, snapshots, dependencies, package lockfiles, schemas, migrations, configurations, generated files, context documents, or progress tracking.

Do **not**:

- Fix a finding, refactor code, apply patches, generate migrations, install packages, format files, or auto-update documentation.
- Run database writes, `drizzle-kit push`/migrations, seeds, production queries with side effects, payment requests, or emails.
- Run tests, builds, linters, browsers, formatters, or commands that may create or modify generated artifacts/caches. Those belong to the separate **Verification** skill. In particular, **do not** run `npm run build` simply to report a review pass.
- Commit, checkout, reset, stash, clean, revert, push, merge, change branches, restart services, deploy to Railway, or change Neon/Resend/provider settings.
- Accept an unapproved policy decision or label an unverified result as passed.
- Claim “nothing else broke” solely from diff inspection, screenshots, comments, a green badge, or the implementer's summary.
- Create or modify an in-repository review report unless the developer **explicitly asks** for a saved report; default to reporting in chat.

**Read-only operations** such as `git status`, `git diff`, `git log`, `git show`, file viewing, source search, and inspecting existing test/CI results are allowed. Use only commands whose effects you understand. Preserve every unrelated change in the user's working tree.

## Step 1 — Understand What Should Have Been Built

Establish a precise **approved baseline** before examining the implementation.

Read in this order:

1. Repository-root `AGENTS.md`, especially **Application Building Context**.
2. The **approved** `architect` blueprint and canonical prompt at `prompts/features/<milestone>-<work-item>-<slug>.md` (if it exists), including approval status, assumptions, decisions, scope, exclusions, and planned acceptance checks.
3. The original developer request, PR/issue description, and relevant feature requirement IDs.
4. `context/project-overview.md` — marketplace purpose and launch scope.
5. `context/architecture.md` — architecture boundaries, invariants, `[AGREED]` / `[RECOMMENDED]` / `[OPEN]` / `[LATER]` labels.
6. `context/ui-context.md` — design tokens and interface patterns, if UI is affected.
7. `context/code-standards.md` — implementation, API, database, security, and code-quality rules.
8. `context/ai-workflow-rules.md` — scope control and evidence standards.
9. `context/progress-tracker.md` — claimed current status; **do not treat the tracker as proof**.
10. `context/prd.md` — exact requirement IDs, user roles, policy gates, and acceptance criteria.
11. `context/build-plan.md` — owning M0–M8 milestone and numbered work package(s).

If the repository declares additional relevant instructions, consult them without silently overriding `AGENTS.md` or an explicit business approval. Do not fabricate context files or reconstruct an absent approved plan from memory.

### Identify the review target

Determine the exact **baseline → implementation** range:

- Approved blueprint identifier and approval evidence.
- Owning Learli milestone/work package, e.g., **M3.4**, plus related **PRD IDs**, e.g., `PUB-03`, `MATCH-01`, or `BKG-02`.
- Target branch, pull request, base commit, feature commits, affected files, and **uncommitted/untracked** files if applicable.
- Implementation handoff and any **separate Verification** report, CI logs, or test artifacts already produced.

Inspect with read-only tools, for example `git status --short`, `git diff --stat`, `git diff --name-status`, `git diff <base>...<head>`, `git diff --check`, `git show`, and targeted source searches. Use commands only after confirming the intended base; **do not assume `main` is the right baseline**. Review staged changes and untracked files too, as they can affect the result.

**Stop for one focused clarification** when any of the following prevents an honest review:

- The scope cannot be isolated from unrelated commits/worktree changes.
- The supposed architect blueprint is missing, unapproved, or materially different from what was implemented.
- There is no trustworthy baseline to identify which files changed.
- A critical required decision is still `[OPEN]` and the implementation acted on it.

You may still provide a **limited preliminary review**, clearly labeled as such, when safe and useful; **do not issue a full plan-alignment PASS** without the approved blueprint and reliable target.

### Build the review contract

Before judging the code, identify:

- **Expected:** What exact user outcome, routes, API behavior, states, and data changes were approved?
- **Permitted:** Which files/modules and supporting cross-cutting changes could reasonably be affected?
- **Excluded:** What was explicitly deferred or forbidden?
- **Preserved:** Which existing routes, permissions, data contracts, workflows, and integrations must remain unchanged?
- **Evidence:** What source code, migrations, diffs, tests, logs, and docs actually support the conclusion?

The correct target is **“only approved behavior changed, and existing protections remain intact,”** not **“the codebase has zero changes.”**

## Step 2 — Review in Three Layers

### Layer 1 — Does It Match the Architect Blueprint?

Compare the **actual diff and observed code paths** to the **approved architect plan**, not to an imagined better feature.

Check:

- All approved user outcomes, acceptance criteria, PRD IDs, and applicable build-plan items are implemented.
- The flow behaves as approved for the intended actors: visitor, parent/guardian, eligible student, tutor, or admin.
- Decisions, states, route contracts, data ownership, and error behavior from the blueprint were followed.
- Every necessary part of the approved vertical slice is present; distinguish a stub, mock, or UI-only demo from functioning server logic.
- Scope exclusions were respected; no unintended LMS, AI, file uploads, custom classroom, group classes, or advanced tutor-management workflow was introduced.
- **Unrelated functionality was not modified**, directly or indirectly. Examine shared components, middleware, auth utilities, schema, config, dependency changes, and global styling for knock-on effects.
- No existing tests were deleted, skipped, weakened, or rewritten just to make a change appear correct.
- No new infrastructure, external service, ongoing cost, or package dependency was added without justification/approval.
- Changes to the blueprint's scope or business rules have **explicit subsequent approval**; a developer's implementation choice does not silently become a product decision.
- `context/progress-tracker.md` describes only actually implemented work, not planned or assumed completion.

For each changed file, ask: **Why did this file have to change for the approved slice? What previously depended on it?** Flag unexplained extra edits, even if the main feature works.

**Change-scope matrix** (build internally; show it when valuable):

| Category | Question |
| --- | --- |
| Required changes | Are all blueprint steps and acceptance checks represented? |
| Supporting changes | Are cross-cutting edits justified and safely scoped? |
| Unapproved changes | Did any unrelated route, role, DB table, config, package, or UI behavior change? |
| Missing changes | Is required backend validation, migration, error state, or auth missing? |
| Unverified effects | Which downstream behavior still needs the separate Verification skill? |

### Layer 2 — Does It Preserve Learli System Integrity?

Trace sensitive paths **end to end**: public/server component or UI → route handler/server action → input validation → authentication and authorization → business service → Drizzle query/Neon transaction → return value, email, and meeting-link visibility.

Check only relevant areas, but never skip a directly affected boundary:

**Product boundaries**

- Learli remains a **1:1 tutoring marketplace/medium**. Teaching, assignments, worksheets, and live classes occur **outside** Learli over **Zoom/Google Meet**.
- Launch scope remains Elementary through College Support; core **Math, Science, English**, **SAT/ACT/entrance exams, homework help, study skills**, and **specialized subjects backed by real tutors**.
- **Find a Tutor** and **Get Matched** remain distinct, usable discovery paths; matching is simple and rule-based, **not AI-driven**.
- No fabricated tutor profiles, ratings, prices, lesson history, verified reviews, or available slots.

**Identity, ownership, and minors**

- **Better Auth** sessions are validated server-side; authorization is enforced on every protected read/write, not only by hiding buttons or routes.
- Parent/guardian can access or book only for learners with a proven, authorized relationship. Knowing a student ID or URL does not grant access.
- Eligible independent students access only their own data; tutors see only records needed for their authorized lessons; admins follow least privilege.
- Cross-account and cross-role denial paths cannot leak child identity, contact details, booking history, meeting links, payment information, or support reports.
- Real-minor onboarding remains **gated** until age/consent, guardian verification, safety ownership, and launch-market requirements are approved. No direct minor–tutor in-app messaging or unauthorized recording is introduced.

**Scheduling and booking**

- Bookings are stored as **UTC instants**, with relevant **IANA time-zone** context; daylight-saving behavior is not based on fixed offsets.
- Tutor-slot availability is revalidated on the server; **database-level concurrency protection** prevents overlapping active bookings, including simultaneous requests and retries.
- State transitions, who may perform them, and cancellation/rescheduling/trial behavior match **approved** policies; `[OPEN]` policy-dependent states must not be silently finalized.
- A meeting URL is visible only to authorized booking participants and is never embedded in public tutor listings, page metadata, caches, or logs. A Zoom/Meet link alone does **not** prove attendance.
- Retry and idempotency behavior does not duplicate bookings or notifications.

**Payments, external services, and data**

- Payment provider, recipient, prices, commissions, subscriptions, payouts, refund/cancellation terms, and trial terms remain **unapproved unless documented approval is present**. Do not accept invented checkout flows or money states.
- If payment integration was approved, server-side verified provider events—not redirect success—control payment state; duplicate webhook deliveries must be safe.
- **Resend** sends transactional emails only; a mail failure must not corrupt a booking or falsely imply the booking never existed.
- Next.js server-only code and secrets never reach client bundles. Neon PostgreSQL is accessed through approved server-side Drizzle patterns, not public browser credentials.
- No file/object storage or student assignment upload pipeline was added without a separate approved reason.
- Runtime, environment, and role-aware queries preserve separation of development/test from production; no real learner data appears in fixtures or client logs.

**Architecture patterns**

- Changes use **Next.js App Router + TypeScript + React + Tailwind/shadcn/ui**, **Neon PostgreSQL + Drizzle**, **Better Auth**, **Railway**, and **Resend** without adding an unnecessary second backend, microservices, or unrelated infrastructure.
- Domain logic is kept in reusable, server-side modules where appropriate for eventual mobile clients; presentation-layer controls are not treated as security controls.
- Database migrations, indexes, constraints, and state changes are consistent with existing records and have an explicit deployment/rollback or forward-recovery strategy.

Do **not** label an integrity concern resolved merely because there is a test name for it; inspect the relevant code and any trustworthy executed-test evidence.

### Layer 3 — Is It Review-Ready for Verification and Release?

Evaluate implementation quality and the **existence/completeness of evidence**. This layer **does not execute Verification**.

Check:

- Changed inputs are validated server-side; permission, ownership, denial, stale state, error, and malformed input paths are handled.
- Race conditions, transactions, atomicity, retries, and idempotency are addressed where appropriate—not deferred to hopeful client UI behavior.
- Loading, empty, error, no-access, stale-slot, booking-confirmation, and external-service-failure states exist when relevant.
- Affected UI matches `context/ui-context.md`: **light-first**, lowercase **`learli`** branding, navy/teal token system, accessible components, usable mobile layouts, semantic labels, visible focus, and non-color-only status signals. Do not treat proposed tokens as approved if the context still labels them proposals.
- No sensitive information appears in error payloads, browser metadata, logs, analytics, public caches, or emails sent to unauthorized recipients.
- Dependency/lockfile, environment-variable, Railway, Neon, email-domain, and deployment changes are justified, compatible, and documented.
- Existing unit/integration/E2E tests cover the feature's important happy, denied, failure, and concurrency paths; inspect assertions for meaningful behavior.
- Supplied **Verification** results include actual commands, environment, outcome, and any known failures; distinguish missing evidence from failed checks.
- No new `skip`, `only`, weakened assertion, mocked-away authorization, test bypass, or ignored build/type/lint error hides a defect.
- Release/pilot restrictions are respected: real-minor onboarding, live payments, production migrations, or public paid launch cannot be treated as approved by default.
- Documentation and tracker changes agree with reality, and open decisions remain visible rather than silently resolved.

**Explicit boundary:** Do not run `npm run build`, tests, browser automation, database checks, production health checks, or deployment validation in this skill. Write **“Not executed by Review — requires Verification”** where applicable. A code inspection can find a defect; it cannot establish runtime correctness.

## Step 3 — Report What You Found

Present **specific evidence** in severity order. Use **file:line** references where possible, or an exact path plus code symbol/route when line numbers are not reliable. For an issue, explain **expected vs. actual behavior**, why it matters, and how it relates to the approved blueprint.

Distinguish:

- **Confirmed finding:** Supported by inspected code/diff and a realistic failure path.
- **Unapproved change:** A code or behavior change outside the blueprint, even if not obviously broken.
- **Missing requirement:** Planned behavior or protection absent from the implementation.
- **Unverified risk:** Plausible issue not established without test/production evidence; **not** a confirmed defect.
- **Blocked review:** Inadequate baseline, missing approved blueprint, or unavailable evidence prevents a full decision.

Use this report shape:

```markdown
## Learli Review — [Feature Name]

### Review target and approved contract
- Blueprint: `prompts/features/[path]` — APPROVED / DRAFT / MISSING
- Build-plan work package: [e.g., M4.6]
- PRD requirements: [e.g., BKG-01, BKG-02]
- Code range: `[base]..[head]` and [staged/unstaged/untracked if applicable]
- Evidence inspected: [paths/commit or CI/Verification references]
- Review coverage: FULL / LIMITED / BLOCKED — [reason]

### Layer 1 — Architect plan alignment
[PASS / ISSUES FOUND / INCOMPLETE]
- [Critical/Important/Minor] `[file:line]` — Expected: [...]. Actual: [...]. Impact: [...].

### Layer 2 — Learli system integrity
[PASS / ISSUES FOUND / INCOMPLETE]
- [Critical/Important/Minor] `[file:line]` — [finding and realistic impact]

### Layer 3 — Verification/release readiness
[PASS / ISSUES FOUND / INCOMPLETE]
- [Critical/Important/Minor] `[file:line]` — [finding and realistic impact]

### Unintended-change audit
- Expected changed areas: [modules/files]
- Additional changed areas: [paths + whether justified]
- Existing behavior at risk: [what might regress, or None identified]
- Unapproved scope changes: [items, or None identified]

### Documentation completeness
- Already updated: [paths, or None]
- Missing or inaccurate: [paths and reason, or None identified]
- No-update rationale: [supported reason, or Not applicable]
- Business/legal/safeguarding approval needed: [specific gate, or None identified]

### Evidence and checks
- Read-only inspection performed: [diff/source/test/release evidence inspected]
- Verification results supplied: [actual result/link, or Not provided]
- Commands/tests/builds executed by Review: NONE — read-only review
- Required separate Verification: [exact critical checks not yet evidenced, or evidence already reviewed]

### Unverified areas
- [area, impact and why it cannot be confirmed, or None]

### Summary
- Confirmed findings: [N Critical, N Important, N Minor]
- Plan alignment: PASS / FAIL / BLOCKED
- Unintended-change audit: PASS / ISSUES FOUND / BLOCKED
- Recommendation: READY FOR VERIFICATION / CHANGES REQUIRED / REVIEW BLOCKED
- Release clearance: NOT GRANTED by the Review skill; follow the separate Verification and approval gates.
```

Do not repeat the same root defect as separate findings in each layer unless distinct consequences require it. If there are **no confirmed findings**, say **“No confirmed findings in the reviewed scope”** and disclose what was not tested or proven. **No findings is not proof that no regressions exist.**

## Step 4 — Let the Developer Decide

After the report, **stop**. Do not edit code, open a fix branch, silently update documents, or trigger implementation, recovery, or verification skills.

Wait for the developer to:

- Ask the **Implementation** workflow to address specified findings.
- Explain why an apparent change was authorized and provide the approval reference.
- Request the separate **Verification** workflow to execute the outstanding tests and runtime checks.
- Accept a non-blocking documented risk through the appropriate approval process.
- Supply the missing blueprint/commit range and request a renewed review.

A new implementation revision requires a new review of the revised diff. Do not mark previously reported issues resolved without inspecting evidence.

## Severity Guide

**Critical — blocks approval/rollout**

- Unauthorized access, exposure of a child's or guardian's information, public meeting links, session/secrets leakage, missing consent gate for real minors, or privileged action bypass.
- Booking corruption, double bookings, destructive migration/data-loss risk, or unsafe cross-user record access.
- Unapproved live charging, refunds, payouts, financial data changes, or tampered payment verification.
- Entire required core behavior missing, significant unauthorized scope change, or unsafe production-impacting configuration/deployment.

**Important — fix before rollout unless explicitly accepted by the proper owner**

- Material deviation from the approved blueprint or unapproved change to shared behavior that could regress an existing flow.
- Incorrect timezone/DST handling, unreliable status transitions/retries, stale slot booking, partial transaction failures, or weak permissions tests.
- Material UI/accessibility failure, missing failure/denial handling, significant integration problems, unreviewed migrations/dependency changes, or undocumented policy implications.

**Minor — address when practical**

- Localized naming, maintainability, wording, cosmetic polish, or limited documentation drift with low user/safety impact.

Every **confirmed finding** must have severity and location. **Questions, missing review inputs, or unverified hypotheses are not automatically defects.** If a suspected issue has a serious possible impact but insufficient evidence, state the potential impact and call it **unverified**, not confirmed.

## Documentation Completeness Gate

Learli's repository organizes its living context under `context/`. Review changes against their **actual** paths, not the older uppercase filenames from earlier standalone drafts.

When a feature changes product behavior, APIs, data shape, workflow, access, UI, integration, cost, or deployment, check the relevant context files:

- `context/prd.md` — requirement IDs, acceptance rules, policy gates, and product behavior.
- `context/architecture.md` — changed boundaries, data model, invariants, or provider choices.
- `context/ui-context.md` — changed visual tokens, components, interaction patterns, or accessibility decisions.
- `context/code-standards.md` — actual changes to coding conventions.
- `context/ai-workflow-rules.md` — actual changes to delivery workflow (rare).
- `context/build-plan.md` — milestone scope, dependencies, or work package changes.
- `context/progress-tracker.md` — factual implementation progress, test evidence, blockers, and next steps.
- `context/project-overview.md` — product goals or in/out scope, only if the business direction changed.
- The approved blueprint in `prompts/features/` — approved deviations and implementation acceptance checks.

**Do not demand edits to every document.** Require a justified update only where a durable fact changed. Treat unapproved policy or architectural drift as a finding, not a cue to silently rewrite the source-of-truth documents.

For sensitive changes, identify required owner review (without claiming legal compliance): **founder/business** for prices, commissions and payouts; **privacy/safeguarding/legal** for children, guardian consent, recording and international obligations; **security/operations** for credentials, storage, retention, backups, or production migration. Do not invent a Learli employee role or an approved policy not present in the context.

Report **updated files, missing changes, no-update reasoning, and any approval needed** in the **Documentation completeness** section of every review.

## The Standard

The review does not ask only **“Does the new feature appear to work?”** It asks:

> **“Does the implementation faithfully match Learli's approved Architect blueprint, change only what was authorized, preserve existing user and data protections, and provide enough evidence for a separate Verification workflow to test it safely?”**

**Review is read-only. Findings go to the developer. Verification and implementation are separate.**
