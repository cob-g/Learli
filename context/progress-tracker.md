# Learli — Progress Tracker

> **Project:** Learli (`learli` visual brand)  
> **Document:** `PROGRESS-TRACKER.md`  
> **Version:** 1.0 — Initial development baseline  
> **Last updated:** 2026-10-11  
> **Current overall status:** **Pre-implementation / documentation prepared; application implementation not verified**  
> **Source documents:** [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md) · [`PRD.md`](./PRD.md) · [`architecture.md`](./architecture.md) · [`AGENTS.md`](./AGENTS.md) · [`CODE-STANDARDS.md`](./CODE-STANDARDS.md)

**Purpose:** Keep a factual, resumable record of Learli development. Update this file **after every meaningful implementation change**, approved product decision, or verified deployment. This is a tracker, **not** a second PRD or permission to implement undecided business rules.

**Evidence rule:** Mark an implementation task **Done** only after the relevant code, tests, and result have been verified. A written specification is **not** an implemented feature. Because no application repository, CI run, or deployment was inspected while establishing this baseline, the development milestones below are **not verified**; their statuses must be refreshed from actual repository evidence at the first coding session.

**Status legend:** `Documented` = specified only · `Planned` = not verified as started · `In progress` = active work with evidence · `Blocked` = waiting on an explicit decision/dependency · `Done` = verified and linked to evidence.

---

## Current Phase

- **Phase:** **0 — Preparation and project bootstrap**.
- **Product definition:** Documented; core marketplace scope agreed.
- **Application implementation:** **Not verified** (no Learli code repository or CI evidence inspected for this tracker).
- **Pilot / production deployment:** **Not verified**.
- **Live payment processing:** **Blocked pending founder-approved business rules**.
- **Public onboarding of minors:** **Blocked pending launch-market guardian-consent and safeguarding decisions**.

## Current Goal

**Prepare a safe, testable foundation for Learli without expanding the MVP scope.**

1. Confirm the GitHub repository, current branch, and whether any implementation already exists; record the evidence before changing statuses.
2. Bootstrap or verify **Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui** with basic responsive pages and quality scripts.
3. Establish an isolated **Neon development PostgreSQL** database, **Drizzle ORM / migrations**, and a non-sensitive health check.
4. Wire up **Better Auth**, basic role/ownership boundaries, and test-only email flows; do not expose real learner data.
5. Obtain founder decisions needed to unlock real bookings involving minors and any live commercial flow.

**Immediate success condition:** A developer can run the app locally, build it, verify the development database/migrations, and demonstrate the first protected auth flow against **test data**, with passing checks and a documented handoff.

## Completed

### Product and documentation — *Documented, not implemented*

- [x] **Business direction agreed:** Learli is a one-on-one online tutoring **marketplace/intermediary**, **not an LMS**. See `PROJECT-OVERVIEW.md` and `PRD.md`.
- [x] **Brand direction documented:** **Learli** in prose, **`learli`** for visual branding; “Learning made personal.” remains an **initial tagline direction**, not an approved marketing claim.
- [x] **Launch catalog agreed:** Math, Science, English; SAT/ACT and entrance-exam preparation; homework help; study skills; and **specialized subjects actually supported by available tutors**.
- [x] **Learning levels agreed:** Elementary, Middle School, High School, and eligible College Support.
- [x] **Delivery approach agreed:** Tutors conduct lessons independently using **Zoom or Google Meet**; Learli coordinates discovery, guided matching, bookings, and limited dashboards.
- [x] **Technical direction documented:** Next.js/TypeScript, Tailwind/shadcn, Neon PostgreSQL, Drizzle, Better Auth, Railway, and Resend.
- [x] **`architecture.md` prepared:** System boundaries, interactions, schema proposal, booking rules, integrations, deployment, and safeguards.
- [x] **`AGENTS.md` prepared:** Instructions and implementation guardrails for coding agents.
- [x] **`PRD.md` prepared:** Product journeys, requirement identifiers, acceptance criteria, and launch gates.
- [x] **`PROJECT-OVERVIEW.md` prepared:** Goals, user flow, features, scope, and success criteria.
- [x] **`CODE-STANDARDS.md` prepared:** TypeScript, Next.js, database, API, security, testing, and deployment conventions.
- [x] **Initial `PROGRESS-TRACKER.md` baseline prepared** using the supplied template.

### Application implementation — *No completion verified*

- **No application code, migrations, tests, CI, or Railway deployment has been inspected for this baseline.** Do not mark any software milestone complete until verified against the actual repository.

## In Progress

- **Requirements readiness:** Founders still need to resolve launch and commerce decisions listed under **Open Questions**.
- **Repository reconnaissance:** **Not started in this tracker / no evidence supplied**. First development session should confirm repository state and replace this line with findings.
- **Coding tasks:** **None confirmed as actively in progress** by the evidence available here.

> **How to record actual work:** Once development starts, add an item such as `- [ ] [In progress] Auth foundation — owner: … · branch/PR: … · started: YYYY-MM-DD · current blocker: …`. Move it to **Completed** only with passing test/build evidence.

## Next Up

Prioritized, small tasks; **these are planned, not completed**.

1. **P0 — Inspect or initialize the Learli repository.** Read the five source documents; confirm branch conventions, dependencies, scripts, and current work. **Exit:** Actual repo/commit identified; baseline lint/typecheck/build commands and results captured.
2. **P0 — App foundation.** Set up Next.js App Router, TypeScript strict mode, Tailwind/shadcn, environment validation, responsive homepage shell, and safe logging. **Exit:** App runs and production build succeeds locally; no credentials committed.
3. **P0 — Neon + Drizzle foundation.** Use a **development-only** Neon database, typed schema/migration workflow, and a health endpoint that exposes no secrets. **Exit:** Migrations run and are tested on an isolated database; connection fails safely when unconfigured.
4. **P0 — Authentication and authorization baseline.** Better Auth; sign-up/sign-in, logout, verification/reset in test mode; server-enforced Student/Parent/Tutor/Admin roles. **Exit:** Unauthenticated access, privilege escalation, and cross-account data access are denied in tests.
5. **P0 — Tutor catalog and discovery.** Genuine subject catalog, tutor records, minimal eligibility/publication gate, public directory, profiles, subject/level filters, and honest empty states. **Exit:** Only actually eligible test tutors appear; unauthorized edits fail. Maps to `PUB`, `TUT`, `ADM` PRD requirements.
6. **P0 — Availability and guided matching.** Rule-based recommendations, IANA time zones, UTC storage, available-slot calculation, and basic tutor-schedule editing. **Exit:** Time-zone/DST tests pass; unavailable slots and unapproved tutors are never suggested. Maps to `MATCH` and `TUT`.
7. **P0 — Learner/guardian records and bookings.** Guardian ownership model (with **real-minor onboarding gated** until approved), eligible self-managed learners, retry-safe booking and **database-level overlap protection**. **Exit:** Concurrent overlapping requests cannot both confirm; cross-family access denied. Maps to `FAM` and `BKG`.
8. **P0 — Lesson coordination and safety.** Role-specific schedules/history, participant-only Zoom/Meet links, Resend test emails, support and safety-report path, essential admin operations. **Exit:** Private links are inaccessible to outsiders; test email failures do not corrupt bookings. Maps to `MEET`, `OPS`, `ADM`.
9. **BLOCKED — Real commerce.** Select and approve payment model, processor, prices, payout/refund rules and market compliance **before** live checkout or subscription work. **Exit:** Decision records approved; only then implement and test payment webhooks/idempotency/reconciliation. Maps to `PAY`.
10. **P0 for public release — Controlled pilot and readiness.** Railway deployment with separate Neon production data, verified sending domain, backups/restoration test, safeguarding/legal review, monitoring, accessibility and E2E QA. **Exit:** Founder explicitly approves pilot/public launch after all hard gates pass.

### Milestone Snapshot

| Milestone | Scope | Status at baseline | Evidence required to change to Done |
|---|---|---|---|
| M0 | Business scope and technical documentation | **Documented** | Five source documents and this tracker exist; unresolved decisions remain visible |
| M1 | Repository + app foundation | **Planned / not verified** | Repo commit, local build, typecheck/lint results |
| M2 | Neon, Drizzle, authentication, role controls | **Planned / not verified** | Migration/test results, protected-auth flow, authorization tests |
| M3 | Tutor catalog, public discovery, matching | **Planned / not verified** | Public browsing QA, filtering tests, tutor-publication checks |
| M4 | Availability, guardians/learners, booking integrity | **Planned / not verified** | Time-zone/DST, ownership, concurrent-booking tests |
| M5 | Meeting links, dashboards, notifications, basic support | **Planned / not verified** | E2E role journeys, meeting-link privacy and email tests |
| M6 | Commerce policy approval | **Blocked** | Founder-approved decision records and provider/jurisdiction assessment |
| M7 | Payment integration (only if approved) | **Blocked by M6** | Sandbox checkout, verified webhooks, duplicate-event/reconciliation tests |
| M8 | Pilot, operational readiness, public launch | **Planned; launch-gated** | QA evidence, safeguarding/legal signoff, backups, email domain, explicit release approval |

**Scheduling rule:** These are ordered work packages, **not promised dates or claimed completion percentages**. Update when the team validates actual progress.

## Open Questions

Resolve through explicit founder/product approval. Until then, keep affected workflows in **test-only or policy-independent mode**.

| Priority | Open decision | Why it matters | Status |
|---|---|---|---|
| **P0** | Does Learli receive student payments or do tutors receive them directly? | Checkout ownership, platform revenue, merchant obligations, payouts | **Open** |
| **P0** | Per-session lessons, prepaid packages, subscriptions, or a mix? Exact prices and charges? | Booking entitlement, billing data model, UI promises | **Open** |
| **P0** | Pricing/commission rules, tutor compensation, payout timing, supported currencies | Accounting, financial records, fees, taxes | **Open** |
| **P0** | Company's registration jurisdiction and initial customer/tutor markets | Provider eligibility, tax/legal obligations, minor privacy rules | **Open** |
| **P0** | Free trial, paid trial, assessment, or no trial? | Discovery CTAs, reservation lifecycle, refund/charge logic | **Open** |
| **P0** | Booking duration, minimum notice, temporary holds, cancellation/rescheduling, no-show and refund rules | Booking state transitions and availability accuracy | **Open** |
| **P0** | Minimum tutor eligibility/safeguarding checks, incident owner, and escalation route | Safe public tutoring, especially with children | **Open** |
| **P0** | Minors' eligibility, guardian verification/consent, child-account access and applicable privacy requirements | Real student account creation and lesson coordination | **Open** |
| P1 | Minimum tutor/learner profile fields; how to publish specialist subjects | Data minimization and honest catalog | **Open** |
| P1 | Standard pricing or tutor-set prices? | Profile presentation and matching filters | **Open** |
| P1 | Single-use vs approved reusable tutor-provided meeting link | Workflow and participant security | **Open** |
| P1 | Reviews/ratings eligibility, moderation and publication | Reputation integrity and dispute handling | **Open** |
| P1 | Whether to use tutor photo uploads, scheduled reminders, or separate child logins | Optional infrastructure/product expansion | **Open** |

**Decision workflow:** Record substantial approvals in `docs/decisions/` with date, owner, rationale, alternatives, behavior, and test implications. Update the PRD/architecture/agent standards if the decision changes them. **Do not invent answers on behalf of the founders.**

## Architecture Decisions

These are **documented selections, not proof of completed deployment or code**.

| Decision | Status | Rationale / implications |
|---|---|---|
| Learli is a **one-on-one tutoring marketplace/intermediary**, not an LMS | **Agreed** | Focus effort on discovery, booking, and safe coordination; no assignment uploads or progress/grading engine |
| Launch covers Elementary → College; Math/Science/English + test prep, academic support, specialized tutor-supported topics | **Agreed** | Focused catalog without promising every subject or universal curricula |
| External **Zoom / Google Meet** for live lessons | **Agreed** | No custom video/audio/whiteboard infrastructure; keep meeting links private |
| **Next.js App Router + React + TypeScript** in one modular application | **Agreed** | Avoid separate Laravel API / React deployment; isolate server business logic for future mobile APIs |
| **Tailwind CSS + shadcn/ui** | **Agreed** | Consistent responsive learner/parent/tutor UI |
| **Neon PostgreSQL + Drizzle ORM/Kit** | **Agreed** | Typed relational model and database-level booking integrity; isolate development and production data |
| **Better Auth** with server-side RBAC and ownership rules | **Agreed** | Prevent role escalation and cross-account access; protect guardian/learner records |
| **Railway** hosting and generated development URL first | **Agreed** | Deploy Node-based Next.js without mandatory upfront custom domain purchase |
| **Resend**, start on a suitable free tier | **Agreed** | Transactional verification/booking emails; **production sender domain verification** required |
| **No file storage required initially** | **Agreed** | Text records and placeholder avatars suffice; any later uploads/storage are separately reviewed |
| **No advanced tutor management / mandatory lesson reports / custom classroom / AI tutor** | **Agreed (out of V1)** | Keep product as a coordination medium, not a school-management or AI-learning system |
| Payment provider, merchant model, commerce policies | **Open / blocked** | No live charges, payout logic, pricing promises or subscriptions before explicit approval |
| Legal/safeguarding details for operating markets and child learners | **Open / launch-gated** | Basic protections remain mandatory; no real minor onboarding until approved controls are in place |

## Session Notes

### Baseline entry — 2026-10-11

- **What changed:** Created the initial development tracker from the user's blank template; aligned milestones with `PRD.md`, `architecture.md`, `AGENTS.md`, `PROJECT-OVERVIEW.md`, and `CODE-STANDARDS.md`.
- **What was verified:** Those five documentation files were available and consulted. **No source repository, tests, branch, CI, database instance, payment integration, or Railway deployment was verified.**
- **Current risks:** Commerce and child-safeguarding policies are not finalized. Don't turn these into invented requirements. Don't represent demo bookings or sample tutor profiles as real inventory.
- **Recommended next session:** Inspect the real repository, record its URL/branch/commit and current test commands, then begin or verify **M1**. Work on non-commercial foundations while the founder resolves gated policies.
- **Last known deployment:** **Unknown / not verified**.

### Session — 2026-10-11 (UI context revision)

- **Owner / branch / PR:** Claude Code session for the repository owner · `main` working tree · no commit or PR created.
- **Goal:** Install the Impeccable design skill and use it to revise `context/ui-context.md` so UI built from it avoids generic "AI slop" defaults.
- **Changed:** `context/ui-context.md` 1.0 → 1.1 (documentation only). `context/build-plan.md` Visual guidance line (lavender mention removed to match). `.gitignore` (Impeccable ignore block, engine binary, local Claude settings). Added `.claude/skills/impeccable/` and `.claude/agents/impeccable-*.md` (Impeccable 4.5.2, project scope, design hook not enabled).
- **Verified:** Documentation only. No application code exists, so no typecheck, lint, test, or build was run. Review evidence for the document: an eight-lens Impeccable analysis of 1.0 (131 findings, every quote machine-checked); contrast ratios recomputed by script; a four-angle review of the first 1.1 draft (104 findings, applied in the final text); a blind before/after probe in which builds from 1.0 scored 9 and 2 detector findings and 1/4 specificity, and builds from the first 1.1 draft scored 1 and 1 and 3/4. **Not verified:** the final text was edited after that review, and a last verification pass was stopped early. The CSS and TypeScript snippets in the final text were not recompiled after the last edits. One build from the final text was scanned (3 `cramped-padding` findings; the list-panel padding rule behind two of them was then changed and not re-scanned).
- **Milestone status:** M0 Documented → unchanged. No software milestone changed.
- **Blockers / decisions:** 23 open design decisions are listed in `ui-context.md` under Change management. All values remain `[PROPOSED]`. No approved `learli` wordmark or app-icon file is in the repository. Lines in `build-plan.md`, `code-standards.md`, and `project-overview.md` that 1.1 makes stale are listed in the same section and were not edited.
- **Deployment:** Not deployed.
- **Next session:** Founder review of the open design decisions in `ui-context.md`, then M1 as planned.

### Required update format after each meaningful development session

Copy this compact entry for the next session; include only **actual evidence**:

```markdown
### Session — YYYY-MM-DD
- **Owner / branch / PR:**
- **Goal:**
- **Changed:** Files, database migrations, or user-visible behaviors actually changed.
- **Verified:** Exact commands/test results, critical cases covered, and relevant screenshots if available.
- **Milestone status:** Previous status -> new status, with links to commit/PR/CI evidence.
- **Blockers / decisions:** Unresolved approvals or technical issues; owner and next action.
- **Deployment:** Environment and URL if verified, or "Not deployed".
- **Next session:** The smallest next testable task.
```

**Maintenance rules:**

1. Update **Current Phase**, **Current Goal**, **Completed**, **In Progress**, **Next Up**, and the **Milestone Snapshot** when status changes.
2. Preserve a chronological trail in **Session Notes**; do not overwrite the only evidence of previous work.
3. Never mark something **Done** based only on a screenshot, agent claim, placeholder UI, a passing unrelated test, or a speculative assumption.
4. If a feature is partially implemented, mark it **In progress** and clearly state what remains untested or blocked.
5. Reconcile any approved scope/architecture decision with `PRD.md`, `architecture.md`, `AGENTS.md`, `CODE-STANDARDS.md`, and `PROJECT-OVERVIEW.md` as applicable.
6. Record actual hosting/database/email costs when available. **Do not claim Railway stays at a fixed $5/month without usage data.**

---

**Definition of progress for Learli:** An eligible learner or authorized guardian can safely discover an eligible tutor, book a genuinely available 1:1 slot without conflicts, obtain the correct private Zoom/Meet details, and manage the booking under **approved** business and safeguarding rules. Everything else should support that journey—not turn Learli into an LMS.
