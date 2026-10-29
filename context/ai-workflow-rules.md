# Learli — AI Workflow Rules

### Approved optional Google Meet integration — 2026-10-26

Owner-approved blueprint: `prompts/features/m5-01-google-meet-provisioning.md`
(M5.1/2/5/11; MEET-01/02/03). Optional tutor-owned Google OAuth may create a
separate private Meet space for each new eligible confirmed booking. Manual
Zoom/Meet links remain supported; Learli retains booking/scheduling/completion
ownership. This bounded exception supersedes older blanket later-only OAuth
wording, without enabling Calendar sync, attendance, recordings or payments.
Implementation is present locally; full verification remains incomplete. See
`context/progress-tracker.md` for executed checks and blockers. Default operation
stays disabled; production/deployment and live provider actions remain separately
gated. New encrypted credentials, durable jobs and explicit system provenance
must preserve existing history, permissions and manual-link behavior. Ambiguous
remote create outcomes do not automatically replay. See the blueprint for exact
scope, additive migration, failure handling, UI and verification requirements.


> **File:** `ai-workflow-rules.md`  
> **Project:** Learli (`learli` in the visual identity)  
> **Version:** 1.0  
> **Prepared:** 2026-10-11  
> **Applies to:** Claude Code, Codex, other coding agents, and human developers using AI assistance  
> **Status:** Development workflow specification. This document **does not** imply the application, repository, tests, database, or deployment already exists.

**Purpose:** Tell an AI coding agent **how to work** on Learli safely, incrementally, and consistently with the existing project specifications. This file complements—not replaces—[`AGENTS.md`](./AGENTS.md), [`CODE-STANDARDS.md`](./CODE-STANDARDS.md), and [`build-plan.md`](./build-plan.md).

---

## Approach

Build Learli **incrementally using a spec-driven, verification-first workflow**:

1. **Read** the project context relevant to the task.
2. **Inspect** the actual repository and current progress before assuming anything exists.
3. **Select one small implementation unit** from the approved requirements/build plan.
4. **Define acceptance criteria and risks** before changing code.
5. **Implement the smallest correct solution**, including server safeguards when needed.
6. **Test the unit against the requirements**, not just whether the UI appears polished.
7. **Review, document, and hand off** observed work; update the progress tracker.
8. **Move to the next unit only after verification** or clearly record why the current unit is blocked.

### The product boundary is permanent unless explicitly changed

**Learli is an online, one-on-one tutoring marketplace and coordination medium—not an LMS.** It connects parents/guardians and eligible students with tutors, provides discovery and simple rule-based matching, facilitates bookings, and supplies private Zoom/Google Meet meeting information. **Tutors conduct lessons independently.**

- **Launch levels:** Elementary, Middle School, High School, and **College Support**.
- **Core:** Math, Science, English.
- **Academic help:** SAT/ACT/entrance examinations, homework help, study skills.
- **Specialized subjects:** Only those genuinely offered by available, eligible tutors.
- **Essential operations:** Registration, role/ownership checks, tutor profiles, discovery, availability, booking, booking-focused dashboards, transactional notifications, and minimal admin/safety support.
- **Excluded:** Assignment uploads, homework submissions, an LMS, grades or academic progress engines, mandatory tutor lesson reports, built-in video/whiteboards, in-app minor–tutor chat, AI tutoring/matching, small groups, advanced tutor performance management, and extra infrastructure without justified requirements.

**Principle:** Build the simplest safe marketplace that meets the approved Learli experience. Do not expand the product just because a tool or competitor makes a feature easy to imagine.

---

## Project Context and Source of Truth

At the start of a new agent session, **read this file and `AGENTS.md`**, then the relevant parts of the following documents. On the first project session or after a significant scope change, review all of them.

| File | Authority / purpose | When to consult |
|---|---|---|
| [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md) | Product mission, audience, user flow, launch boundaries | To verify **why** a feature matters |
| [`PRD.md`](./PRD.md) | Functional requirements, requirement IDs, priorities, acceptance criteria, business decisions | **Before every feature** and when testing completeness |
| [`architecture.md`](./architecture.md) | Architecture, domain invariants, stack, database approach, integration boundaries | Before design, schema, auth, booking, or integration changes |
| [`AGENTS.md`](./AGENTS.md) | Primary coding-agent operating contract, safeguards, change approval, handoff | **Every session** |
| [`CODE-STANDARDS.md`](./CODE-STANDARDS.md) | TypeScript, Next.js, data, security, API, accessibility, Git, and test conventions | During implementation and code review |
| [`ui-context.md`](./ui-context.md) | Brand, visual tokens, components, responsive/accessibility standards | Before any UI/UX change |
| [`build-plan.md`](./build-plan.md) | Work packages **M0–M8**, dependencies, requirements mapping, exit criteria | To select and sequence work |
| [`PROGRESS-TRACKER.md`](./PROGRESS-TRACKER.md) | **Observed** status, current goal, blockers, decisions, session handoff evidence | At the beginning and end of a meaningful development session |
| `docs/decisions/` | Records of **approved** material product/architecture/business decisions (when created) | When a decision affects behavior, data, money, or safety |

**Filenames are case-sensitive.** The actual project tracker is `PROGRESS-TRACKER.md`, **not** `progress-tracker.md`. Do not create competing lowercase/uppercase copies. If a repository contains a different canonical filename, inspect it and reconcile the documentation links rather than silently duplicating documents.

### Resolving conflicting instructions

1. Honor the **latest explicit and authorized user/founder decision**, subject to applicable security, safety, and legal requirements.
2. Preserve **`[AGREED]`** product boundaries and architectural invariants in `architecture.md` and the PRD.
3. Apply `AGENTS.md` and `CODE-STANDARDS.md` to implementation practice; use `ui-context.md` for presentation.
4. Use `build-plan.md` for execution order and **`PROGRESS-TRACKER.md` for verified status**.
5. If there is a real conflict, **stop the affected change**, explain it briefly, and seek a decision. Do not quietly decide that one document is obsolete.

Recognize documentation status labels:

- **`[AGREED]`** — approved direction; respect it.
- **`[RECOMMENDED]` / `[PROPOSED]`** — an implementation or design default, not a permanently binding business promise.
- **`[OPEN]`** — no founder decision yet; do not invent it.
- **`[GATED]`** — work or release waits for the relevant approval.
- **`[LATER]`** — future roadmap, not permission to implement now.
- **P0/P1** — priorities defined in the PRD; do not automatically treat P1 as necessary for the first vertical slice.

If code and documentation disagree, **inspect the code and report the discrepancy**; the existence of code does not retroactively approve an unapproved business rule.

---

## Scoping Rules

- **Work on one feature unit at a time.** Link it to the relevant PRD requirement ID(s) and `build-plan.md` milestone.
- Prefer **small, verifiable vertical slices** to large speculative rewrites. A slice may touch UI, server logic, schema, and tests when all are necessary for one user outcome.
- Keep unrelated system boundaries out of the same change: do not combine tutor search with payment setup, for example.
- Prefer existing components, libraries, patterns, and abstractions when suitable; do not add a service or dependency for a trivial requirement.
- Respect the **actual repository state**. Do not recreate a feature, force a folder restructure, or overwrite work because a planning document describes a suggested layout.
- Keep mobile readiness through reusable server-side business logic and appropriate API boundaries, **without building a mobile app now**.
- Follow the repo's established package manager, lockfile, scripts, branch policy, and testing conventions. If starting from scratch, choose sensible defaults once and record them.
- Label each task **UI**, **Backend**, **Database**, **Integration**, or **Both**, and identify any security-sensitive boundary.
- Never substitute a mock screen, fixture, or sample response for working production behavior without clearly marking it as a demo/test implementation.

### Before starting: define the task contract

Use a compact task plan in the agent response or issue/PR description:

```markdown
Task: <specific outcome>
Type: UI / Backend / Database / Integration / Both
Milestone: M# — <work package>
PRD references: <e.g., PUB-03, TUT-02>
In scope: <observable behavior being added/changed>
Out of scope: <related behavior deliberately not included>
Dependencies / open decisions: <none or named blockers>
Files/areas likely affected: <inspect first; no invented paths>
Acceptance: <happy path + meaningful negative/error cases>
Verification: <tests/commands/manual checks to run>
```

The task contract is a working plan, **not** a substitute for inspecting the implementation.

---

## When to Split Work

Split a proposed change into smaller, independently verifiable units when it combines:

- **Unrelated product features**, such as tutor profile editing plus subscriptions.
- **Several unrelated API routes or domains**, such as availability, reviews, and support incidents at once.
- **Database migration plus unrelated UI redesign**, or a breaking data migration hidden in a cosmetic task.
- **New third-party integration plus broad application refactoring** that isn't required by the integration.
- **An unapproved behavior** alongside an already approved one (e.g., cancellation UI vs. unresolved cancellation policy).
- **Multiple build-plan milestones** without clear dependencies or independent acceptance checks.
- **High-risk operations** (production migrations, external billing, secrets, sensitive user data) alongside ordinary feature work.
- A feature so wide that end-to-end correctness and negative/security cases **cannot be verified promptly**.

**Important:** Do **not** split a single feature into “UI-only complete” and “security later” if that would misrepresent the result. For example, a booking is not done until server-side ownership and **database-level double-booking prevention** are both proven. It is acceptable to mark the UI slice complete as **UI work only**, not the entire booking requirement.

---

## Handling Missing Requirements

**Never invent business decisions.** If a requirement is incomplete:

1. Search the PRD, architecture, decision records, and latest explicit user instructions.
2. Determine whether the missing detail is an ordinary **technical implementation choice** or a **product/business/safeguarding decision**.
3. For a low-risk technical detail, choose the simplest option consistent with standards; label a meaningful new choice **`[RECOMMENDED]`** and document the rationale.
4. For pricing, refunds, booking entitlements, consent, tutor eligibility, lesson duration, or similar product rules, **ask for approval** instead of choosing a default.
5. Record the question in **`PROGRESS-TRACKER.md` → Open Questions**, with owner and the blocked work package. If an existing question is there, update it rather than duplicate it.
6. Mark the affected work **Blocked** or build a clearly bounded test-only portion that does not depend on the missing decision.
7. Once the founder approves a material decision, add a dated record under `docs/decisions/` and update the relevant source documents **before implementing behavior that relies on it**.

### Mandatory decision gates

**No real payment implementation or activation without explicit approval** of the commercial model: who collects payment, provider/merchant eligibility, price model, currencies, commissions, tutor compensation/payouts, booking/payment confirmation, trial rules, cancellation/rescheduling and refund/credit policies. Payment schemas and provider-specific flows are **conditional**, not implied requirements.

**No real minor onboarding or minor bookings until** the applicable guardian/consent, tutor safeguarding/eligibility, incident handling, legal/privacy, and operational controls are reviewed and approved. **Synthetic test data** may be used for safe development.

**No public tutor-verified claims, ratings, free-trial offers, prices, or credentials** unless supported by actual records and approved rules. Do not fabricate trust signals to fill empty UI states.

These gates are **separate**: authorization to test booking with synthetic data does not authorize production onboarding or live billing.

---

## Protected Files

**Do not modify the following unless the task explicitly requires it and the action is authorized:**

- `.env`, `.env.*` containing real secrets, production connection strings, exported credentials, local dumps, and files containing personal customer data. Edit **`.env.example`** for safe variable names; never commit actual values.
- Production Railway variables, real Neon project settings/production schema, Resend sending-domain records, external payment/billing accounts, or DNS configurations.
- Applied production migrations or historical migration files; create reviewed forward migrations instead of rewriting applied history.
- Generated files or third-party internals: `node_modules/`, `.next/`, `dist/`, `coverage/`, vendored packages, and generated shadcn/ui primitives **unless a justified UI-library customization is approved**.
- CI/CD definitions, security checks, and deployment scripts if the requested task doesn't require changing them; never disable checks just to make a build pass.
- The Git history, default/protected branches, remote repositories, or existing PRs outside the authorized work scope.
- **Governing specification files** (`PRD.md`, `architecture.md`, `AGENTS.md`, `CODE-STANDARDS.md`, `PROJECT-OVERVIEW.md`, `ui-context.md`, `build-plan.md`, and this document) **for unrelated or unapproved scope changes**.

**Exception:** Updating **`PROGRESS-TRACKER.md` after meaningful verified implementation work is expected**. Legitimate approved changes also require updating the relevant governing documents; these files are controlled, **not permanently frozen**. Do not edit business scope in a way that manufactures the approval needed for the code.

A lockfile is **not** a protected artifact against legitimate dependency changes: update it together with `package.json` when necessary, and explain material dependency updates.

---

## Implementation Workflow

### Optional complete-feature coordinator

The repository's [`build-feature`](../skills/build-feature/SKILL.md) skill runs
Architect → Implement → Review → Verify → Remember for one requested feature,
with Recover for confirmed defects or failed checks. The repository owner
requested automatic coordination on 2026-10-11. Its coordinator owns code edits,
test execution, routine in-scope repairs, and factual tracker updates; the four
child skills retain their stage-specific responsibilities.

For a full build request, a blueprint within that request and established
decisions can be `AUTHORIZED — build-feature delegation`. Record the actual
request and scope; this is execution authority, not a claim that the user
separately reviewed the generated plan. Routine transitions need no repeated
confirmation. A request to approve the plan first, unresolved material decisions,
and production/destructive actions retain their applicable gates. Standalone
Architect/Review/Recover/Remember behavior is unchanged. The coordinator saves
actual review and verification outcomes through Remember to ignored local
`memory.md`; it never treats Review alone as executed verification.

### Step 1 — Establish reality

- Inspect the repo path, branch, status, recent commits, installed dependencies, app routes, schema, migrations, tests, and build scripts.
- Read the tracker. Treat **“documented”**, **“implemented”**, **“tested”**, **“deployed”**, and **“live for customers”** as different states.
- When the repository or environment cannot be accessed, say so and **do not guess** that features exist or actions ran.
- Never point dev/test scripts at production services; use **separate Neon development data** and synthetic learners/tutors.

### Step 2 — Choose the smallest work package

- Locate the current M0–M8 milestone and relevant PRD IDs.
- Confirm whether policies or a previous feature must be completed first.
- Define happy path, permission-denied path, validation failures, empty/no-result states, and data integrity expectations.
- State which exact files and domains may change; avoid opportunistic rewrites.

### Step 3 — Implement within the agreed architecture

- **Next.js App Router + React + strict TypeScript**, one modular application; no Laravel, separate backend, or microservice without approval.
- **Tailwind CSS + shadcn/ui** using `ui-context.md` design tokens and accessible, responsive interactions.
- **Neon PostgreSQL + Drizzle/Drizzle Kit** with reviewed, version-controlled migrations; validate untrusted input before database access.
- **Better Auth** for identity; perform **server-side role and record-ownership authorization** on every protected action or query.
- Keep business logic on the server in reusable modules; do not embed sensitive policies solely in React components or browser requests.
- Store booking instants consistently in **UTC**, user/tutor time zones as **IANA identifiers**, and handle daylight saving changes correctly.
- Enforce one-to-one tutor booking exclusivity via **database-level, transaction-safe constraints/locking** appropriate to the chosen schema. A frontend availability check is insufficient.
- Treat **Zoom/Google Meet** as external classrooms. Tutor-provided links must be validated and visible only to authorized participants.
- Use **Resend** for approved transactional emails, with safe retry/error handling and verified sending-domain requirements before real email delivery.
- Do not introduce object storage, payment providers, queues, Redis, analytics platforms, or new external services just because they are convenient.

### Step 4 — Validate changes and inspect the diff

- Test success and failure paths, especially authorization, ownership, booking concurrency, time-zone/DST, link privacy, and retry/idempotency when relevant.
- Check that no secret, student PII, private lesson link, or sensitive record appears in logs, public HTML, SEO metadata, open APIs, or client bundles.
- Check phone and desktop states for visual changes; ensure keyboard focus, labels, loading, errors, empty states, and readable contrast.
- Inspect `git diff`; ensure changes match the task contract and do not silently alter unrelated modules or documentation.
- If a test can't run because a tool or environment is absent, **say “Not run” with the reason**, not “Passed.”

### Step 5 — Close or block the unit honestly

- Mark a unit **Done only with evidence** against its acceptance criteria and relevant build-plan exit checks.
- If one layer is done but the full feature is not, report the partial result as **In progress / Ready for QA / Blocked**, as appropriate.
- Record a concise session entry in `PROGRESS-TRACKER.md` including branch, PRD IDs, actual tests, manual QA, blockers, and next task.
- Do not deploy or merge unless the user authorized that action and all required gates for that target environment are satisfied.

---

## Keeping Docs in Sync

Update only the documents affected by a **real approved decision or verified implementation change**:

| Change | Update |
|---|---|
| Functional requirement, acceptance criterion, launch scope | `PRD.md`, `PROJECT-OVERVIEW.md` if positioning changes; `architecture.md` if boundaries change |
| Technical architecture, database entity/boundary, storage model, integrations | `architecture.md` + dated `docs/decisions/` record for material decisions |
| Engineering convention, API pattern, testing standard | `CODE-STANDARDS.md`; `AGENTS.md` if coding-agent duties change |
| Brand tokens, shared component behavior, responsive layouts | `ui-context.md` |
| Milestone dependency or approved delivery sequencing | `build-plan.md` |
| Actual code/test/QA/deployment outcome or blocker | **`PROGRESS-TRACKER.md`** (every meaningful session) |
| Setup commands, environment variables, developer onboarding | `README.md`, `.env.example`, or relevant operations docs if present |
| Changes to this operating protocol | `ai-workflow-rules.md`, only within explicit scope/approval |

**Workflow:** Make the required source-of-truth correction → implement against it → verify → update the tracker. Don't rewrite all project documents after every small UI change. Don't quietly promote `[OPEN]` decisions to `[AGREED]` or record plans as completed features.

If an approved change affects multiple documents, reconcile conflicting descriptions **in the same reviewed change**. Maintain exact file casing and relative links.

---

## Verification and Testing Rules

Testing depth follows the risk and feature area; **do not skip critical negative cases** to save time.

| Area | Minimum required evidence when affected |
|---|---|
| TypeScript / code quality | Strict typecheck, lint, relevant formatter checks, production build |
| Authentication / authorization | Unauthenticated request denied; forged role/ID rejected; cross-user/cross-family access denied |
| Tutor publishing and search | Unapproved/suspended tutor excluded; no fake profiles or reviews; filters and empty states correct |
| Availability and bookings | UTC/time-zone/DST checks; invalid slot rejected; two simultaneous overlapping requests cannot both confirm; retry doesn't duplicate |
| Meeting links | Only authorized parties see links; unsafe URL rejected; missing URL yields honest UI |
| Notifications | Resend test/mock delivery and failure behavior; booking integrity not dependent on successful email |
| Payment work (**only if approved**) | Sandbox tests, signed webhook verification, idempotency, failed/duplicate/out-of-order events, reconciliation |
| UI changes | Small and large viewport checks; keyboard operation, focus, labels, contrast, loading/error/empty states |
| Database migration | Apply/test on isolated database; check constraints and rollback/recovery approach for risky changes |

**Default commands (only if the repo defines them):** `npm run lint`, `npm run typecheck`, `npm test` / project test scripts, and **`npm run build`**. Use the repo's actual package manager (`npm`, `pnpm`, etc.) and scripts. If an essential script is missing during M1, add it as part of the approved foundation task; otherwise report why the required check could not run. Never fabricate CLI results.

Prefer unit tests for pure logic, integration tests against isolated PostgreSQL for booking/auth/database invariants, and targeted browser E2E tests for complete journeys. Use any test runner already approved by the repo; suggested tools in planning documents are **not** a mandate to install every test framework immediately.

---

## Before Moving to the Next Unit

The unit may be marked **Done** only if:

1. Its exact PRD acceptance criteria are satisfied for the declared scope.
2. The current unit works end to end **within that scope**; necessary server checks and database constraints are part of the result.
3. **No invariant in `architecture.md` or safeguard in `AGENTS.md` was violated.**
4. No new unapproved behavior, out-of-scope LMS/AI/classroom feature, or invented payment/trial/tutor promise was introduced.
5. Input validation, role/ownership permissions, error handling, and privacy protections were checked as applicable.
6. Relevant automated checks **actually passed**, and **`npm run build` passes** with the configured npm workflow (or the equivalent verified project-package-manager build command). Any unrun/failed check is disclosed and blocks a **verified-Done** claim until addressed or explicitly accepted as an exception.
7. Relevant phone/desktop/accessibility QA passed when UI was changed; evidence recorded.
8. `PROGRESS-TRACKER.md` reflects the **observed** implementation, exact verification results, outstanding questions, and next unit.
9. Documentation and decision records affected by approved changes are synchronized.
10. No production deployment, data migration, live charge, or remote repository change was performed without the specific required authorization.

**If any condition fails:** do not hide it. Mark **In progress**, **Blocked**, or **Ready for QA**, describe the evidence and smallest safe next step, then continue only when appropriate.

---

## Session Handoff Format

At the end of a meaningful coding session, give a concise, evidence-based report:

```markdown
### Learli Development Handoff
- **Task / milestone / PRD IDs:**
- **Status:** Not started / In progress / Blocked / Ready for QA / Done
- **Changed:** Key files and user-visible/server behavior
- **Tests run:** Exact commands and pass/fail results (or Not run + reason)
- **Manual QA:** Specific journeys/viewports checked (or Not run)
- **Database / deployment:** Actual changes; otherwise "None"
- **Scope and security check:** Relevant invariants maintained; issues if any
- **Open decisions / risks:** Owner, blocker, and next approval needed
- **Tracker updated:** Yes/No and why
- **Next smallest unit:** One concrete, testable follow-up
```

Do not claim “implemented,” “tested,” “deployed,” “secure,” or “production-ready” without supporting observations. A **specification**, **mockup**, **passing build**, **merged PR**, and **live release** are separate kinds of evidence.

---

## Launch and Operations Boundary

The `build-plan.md` milestones (**M0–M8**) guide the work order; **M6 is an approval gate, not permission to invent a payment model**, and M7 is conditional on the approved model.

- **Internal demo:** Synthetic users and test resources only; label simulation honestly.
- **Controlled pilot:** Requires explicit authorized pilot scope and applicable guardian, tutor screening, privacy, and operational safeguards before using real participants.
- **Public/paid release:** Requires approved real booking/payment/policy rules, safety and legal readiness for launch markets, tested permissions and booking integrity, a verified production email domain, monitoring, backup/restore evidence, and explicit release authorization.
- **Production changes:** Never deploy, merge to a protected branch, mutate live data, run destructive migrations, rotate real credentials, or change real billing without authorization and an appropriate rollback plan.

Railway's generated development URL can be used for development/pilots **within the authorized scope**; it does not by itself grant permission to onboard real children, collect payments, or send transactional email from an unverified domain.

---

## Quick Start for a New AI Coding Session

1. Read `AGENTS.md`, `ai-workflow-rules.md`, `PROGRESS-TRACKER.md`, and the relevant sections of `PRD.md`, `architecture.md`, `CODE-STANDARDS.md`, `build-plan.md`, and `ui-context.md`.
2. Inspect the **actual repository**, branch, changes, dependencies, test scripts, and last verified milestone.
3. Select exactly **one small, unblocked PRD-backed unit** and define acceptance and negative tests.
4. Implement with our approved **Next.js + TypeScript + Neon + Drizzle + Better Auth + Railway** direction; preserve Learli's marketplace-only boundaries.
5. Verify with actual commands and user-flow checks; update `PROGRESS-TRACKER.md`; hand off evidence and the next smallest task.

> **Final agent rule:** Make the smallest approved change that is correct and testable. Never trade learner safety, data integrity, or honesty about progress for speed.
