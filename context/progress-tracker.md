# Learli — Progress Tracker

> **Project:** Learli (`learli` visual brand)  
> **Document:** `progress-tracker.md`
> **Version:** 1.2 — Verified local identity foundation
> **Last updated:** 2026-10-11  
> **Current overall status:** **M3 verified locally (catalog, applications, review, public directory, matching on level and subject); hosted integration deferred**
> **Source documents:** [`project-overview.md`](./project-overview.md) · [`prd.md`](./prd.md) · [`architecture.md`](./architecture.md) · [`AGENTS.md`](../AGENTS.md) · [`code-standards.md`](./code-standards.md) · [`build-plan.md`](./build-plan.md)

**Purpose:** Keep a factual, resumable record of Learli development. Update this file **after every meaningful implementation change**, approved product decision, or verified deployment. This is a tracker, **not** a second PRD or permission to implement undecided business rules.

**Evidence rule:** Mark an implementation task **Done** only after the relevant code, tests, and result have been verified. A written specification is **not** an implemented feature. The original documentation-only baseline is preserved in Session Notes. Current statuses below reflect local repository evidence; a local result does not establish remote CI, provider integration, or deployment success.

**Status legend:** `Documented` = specified only · `Planned` = not verified as started · `In progress` = active work with evidence · `Blocked` = waiting on an explicit decision/dependency · `Done` = verified and linked to evidence.

---

## Current Phase

- **Phase:** **M3 verified locally; M4 (availability, learners, bookings) is next**.
- **Product definition:** Documented; core marketplace scope agreed.
- **Application implementation:** Next.js shell, local PostgreSQL, Better Auth flows, account settings and server role/ownership checks verified on `main` at base `4503177` plus uncommitted M1/M2 changes. Tutor catalog, guardian links and bookings are not implemented.
- **Pilot / production deployment:** **Not verified**.
- **Live payment processing:** **Blocked pending founder-approved business rules**.
- **Public onboarding of minors:** **Blocked pending launch-market guardian-consent and safeguarding decisions**.

## Current Goal

**Keep the verified M2 identity foundation entirely local while preparing the next catalog slice.**

Local M2 is implemented and verified under the owner's local-only instruction.
See the M2 session below for exact checks and deferred hosted acceptance. Nothing
has been committed, pushed or deployed during this implementation.

**Next development slice:** Architect M4.1–M4.3: tutor time zone and weekly
availability. The pure time and slot engine for M4.2 is merged in `src/lib/time/`
and verified in isolation; build M4.1 to call it. Booking durations, lead
times and guardian-consent policy are open and gate later M4 packages.

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

### Application implementation — *Verified locally*

- [x] **M1.1 / M1.2:** Next.js 16.4.0, React 19.3.0, strict TypeScript 6.0.3; Node 24.20.0/npm 11.19.0 pins, exact dependency lockfile, application/shared/helper/test directories. Domain services and migrations were added in M2 when needed.
- [x] **M1.3 / M1.4 local setup:** Tailwind 4.3.3, Learli proposed tokens/Poppins, semantic class merging, shadcn CLI/config. No generated primitives; final preset approval, brand artwork and design decisions remain open.
- [x] **M1.5 / M1.9:** Responsive public header/footer, keyboard/mobile menu, truthful discovery/unavailable pages, metadata, 404 and retry error boundary. M2 now replaces the original workspace placeholders with authenticated, role-guarded shells.
- [x] **M1.6:** ESLint, Prettier, Vitest/Testing Library, Playwright/axe; 17 unit/component tests and 15 browser checks passed. Production build passed without integration credentials.
- [x] **M1.7 / M1.8 local setup:** Non-secret environment template, ignored credentials/artifacts, server-only startup validation with redacted errors, uncached liveness endpoint. GitHub Actions workflow exists; a remote CI run is not yet observed.
- [x] **Development startup:** Homepage and health HTTP 200. Next's automatic agent-rule generation is disabled to preserve the maintained repository contract.
- [x] **M2 local data:** Owned PostgreSQL 17.11 cluster, isolated dev/test databases, generated Better Auth schema, reviewed Drizzle migration, restricted runtime role and idempotent synthetic fixture setup.
- [x] **M2 local identity:** Registration, verification through local capture, sign-in/out, password recovery, session revocation, persistent rate limits, trusted multi-role grants, account status and ownership guards. New signups have no roles.
- [x] **M2 local account UI:** Safe return paths, private account settings and guarded role shells; accessible native forms tested at desktop, phone and 320px widths. No learner relationship or tutor eligibility claim.
- [x] **M2 verification:** 37 unit/component, 15 real PostgreSQL integration and 22 browser tests passed; lint/typecheck/format and production build passed. Details in the M2 session.
- [x] **M3.1–M3.3 local tutor catalog:** `subjects`, `tutor_profiles`, `tutor_subjects` migrations with the eight launch subjects; tutor application form for trusted `tutor` accounts; audited admin review transitions and subject add/activate/deactivate; one public-eligibility query with no public consumer yet. 62 unit/component, 32 PostgreSQL integration and 25 browser tests passed. Details in the M3 session.
- **Hosted services deferred:** Neon and Resend packages remain installed but unconnected; Railway and remote CI unrun. Local capture is not email delivery. Marketplace functionality and real-user onboarding remain future work.

## In Progress

- **Requirements readiness:** Founder decisions under **Open Questions** remain unresolved.
- **Design readiness:** The M1 development shell uses proposed UI tokens and the documented plain-text brand placeholder. Generated shadcn primitives and final brand assets remain gated by `ui-context.md` decision 14 and related open decisions.
- **Dependency maintenance:** 13 audit findings (4 moderate, 9 high) remain in upstream tooling chains. `--omit=dev` still reports 4 moderate findings because Better Auth declares Drizzle Kit as an optional peer. See README and the recovery handoff; do not represent the audit as clean.
- **Remote verification:** Changes are local and uncommitted. GitHub CI and Railway have not been run in this session.

## Next Up

Prioritized, small tasks; **these are planned, not completed**.

1. **Done locally — M3.** Directory/filtering and rule-based matching based on actual local records; honest empty states and no fabricated production inventory.
3. **P0 — M4, availability and bookings.** IANA time zones, authorized learner relationships, approved booking policies and database-level overlap protection with concurrency tests.
4. **P0 — M5, lesson coordination and safety.** Participant-only meeting links, role dashboards, transactional notifications, support/reporting and scoped admin operations.
5. **Deferred — Hosted M2/operations acceptance.** Neon connection/TLS, provider email, production session settings and remote CI require a later externally enabled phase. Keep all current runtime work local.
6. **BLOCKED — M6/M7, commerce.** Obtain explicit business decisions before implementing real charges, prices, payouts or refunds.
7. **P0 before release — M8.** Separate deployment environments, email domain, safeguarding/legal decisions, operational evidence and explicit release authorization.

Resolve open design decisions and dependency advisories alongside this sequence.

### Milestone Snapshot

| Milestone | Scope | Current status | Evidence / remaining exit requirements |
|---|---|---|---|
| M0 | Business scope and technical documentation | **Documented; M0.1/M0.6 local evidence recorded** | Repository and context inspected; approval ownership and open decisions remain |
| M1 | Repository + app foundation | **Local foundation verified** | Session evidence below; brand/primitive approval pending, remote CI unrun |
| M2 | Data, authentication, role controls | **Local scope verified; hosted acceptance deferred** | Local migrations, auth/ownership tests and browser journeys passed; Neon/TLS/Resend and production settings unrun |
| M3 | Tutor catalog, public discovery, matching | **Verified locally** | Catalog, application, review, public discovery and matching tests passed locally; screening policy, time-based matching (needs M4) and hosting remain |
| M4 | Availability, guardians/learners, booking integrity | **In progress — M4.2 engine verified in isolation; nothing else started** | Engine unit tests cover time zones and DST. Availability schema and editor, learner links, bookings, ownership and concurrent-booking tests remain |
| M5 | Meeting links, dashboards, notifications, basic support | **Partial — M5.1 validation library verified in isolation** | Protected storage, participant access, booking integration, E2E role journeys and email tests remain; M5.1/M5 not complete |
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

### Session — 2026-10-11 (Build Feature skill)

- **Owner / branch / PR:** Codex for the repository owner · `main` working tree, based on `4503177` · no commit or PR created for this change.
- **Goal:** Add the requested automatic feature workflow using Architect, Review, Recover, and Remember.
- **Changed:** Added `skills/build-feature/SKILL.md` and Codex UI metadata, with discovery symlinks in `.agents/skills/` and `.claude/skills/`. Added explicit orchestrated-mode exceptions to the four child skills while preserving their standalone responsibilities. Updated `AGENTS.md`, `context/ai-workflow-rules.md`, and the `/memory.md` ignore rule.
- **Workflow decision:** The user's full build request authorizes routine scoped planning, implementation, review, verification, recovery repairs, and memory saving. Blueprints record `AUTHORIZED — build-feature delegation`; this does not represent separate human review of the generated plan. Material unresolved decisions and production/destructive actions retain their applicable gates.
- **Verified:** `quick_validate.py` passed for all five skills. Python checks passed for both discovery directories, child-skill links, UI metadata, default implicit discovery, and the untracked/ignored memory path. `git diff --check` passed. Manually inspected routing for normal completion, reserved blueprint approval, failed checks, review findings, missing verification access, and resume. No application build/tests or real feature workflow was executed; this is instruction/configuration setup only.
- **Milestone status:** No application milestone changed; no feature implementation or deployment claimed.
- **Next session:** Invoke `$build-feature` with a specific Learli feature or work package; observe the workflow on actual implementation.

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

### Session — 2026-10-11 (M1 application foundation)

- **Owner / branch / PR:** Codex for the repository owner · `main` working tree at base `4503177` · remote `cob-g/Learli` · no commit, push, PR or deployment performed for this slice.
- **Authority:** User requested the app foundation, dependencies/tools, and analysis of `context/build-plan.md`. Blueprint: `prompts/features/m1-01-app-foundation.md` — **AUTHORIZED — build-feature delegation**. This is delegated authority, not a claim of separate human blueprint approval.
- **Plan analysis:** M1 is the correct first application slice. M2 owns isolated PostgreSQL, schema/auth and permissions; M3–M5 own marketplace functionality; M6/M7 require commercial policy decisions; M8 owns deployment/launch evidence. Installing an SDK does not complete its integration milestone.
- **Changed:** Pinned Node/npm and current compatible dependencies; Next.js App Router/TypeScript/Tailwind/shadcn configuration; proposed theme and responsive shell; unavailable public/workspace routes; generic error/404 handling; server-only environment validation; `/api/health`; quality scripts/tests; GitHub Actions; README. UI context records provisional CLI configuration without final primitive approval. Previous uncommitted skill work was preserved.
- **Review:** `prompts/reviews/m1-01-app-foundation.md` records full scoped source/diff inspection. Plan alignment **PASS**, unintended-change audit **PASS**, recommendation **READY FOR VERIFICATION — local foundation only**. The initial malformed-origin configuration issue was repaired and re-reviewed. No remaining confirmed application defect in scope; upstream dependency findings remain documented. Same agent performed review and separate verification; no independent reviewer or release approval is claimed.
- **Verification:** `npm ci` succeeded; `npm ls --all --json` reported no dependency problems; `npx --no-install shadcn info` recognized the configuration. `npm run check` passed formatting, lint, typecheck and **17 unit/component tests**. `npm run build` passed without integration credentials. Final `npm run test:e2e` passed **15/15** Chromium checks at **1440×900, 390×844, 320×720**, including keyboard navigation, Escape/focus return, route/health/404 semantics, no overflow, dark-OS light rendering, and axe scans. Homepage screenshots for all three sizes were visually inspected. The required `.claude/skills/impeccable/scripts/impeccable detect src --json` returned **[]**. Client asset search found no server configuration secret names/validation strings. Dev homepage and health returned HTTP 200, including after configuration restart.
- **Recovery:** `prompts/recovery/2026-10-11-foundation-tooling.md` records peer compatibility, sanitized configuration parsing, lint repairs, the corrected duplicate-robots-tag test assertion, and disabling Next's automatic AGENTS edits. Failed checks were repaired rather than skipped; all final app checks above passed.
- **Dependency limitations:** Clean install reports **13 vulnerabilities: 4 moderate, 9 high** in braces and legacy Drizzle Kit/esbuild chains. `npm audit --omit=dev` reports **4 moderate**, because Better Auth's optional Drizzle Kit peer is in that graph. No patched stable braces release was available when inspected; forced audit fixes proposed incompatible downgrades. ESLint 9 is compatible but deprecated. Audit is **not clean**; reassess upstream fixes/exposure before database tooling or public release.
- **Not verified / not implemented:** Remote GitHub CI, Neon connectivity/migrations, Better Auth flows/authorization, Resend delivery, payments, real learner records, provider provisioning and Railway deployment. Final brand assets and generated shadcn primitive approval remain open. No release approval is implied.
- **Next smallest task:** Architect M2.1–M2.2: isolated development Neon plus reviewed Drizzle/Better Auth schema/migration workflow. Keep real-minor onboarding and commercial policy gates unresolved until explicitly decided.

### Session — 2026-10-11 (M2 local identity — verified)

- **Authority:** User requested M2 entirely locally and confirmed no further restriction beyond no cloud services, deployment or external email. Blueprint: `prompts/features/m2-01-local-identity-foundation.md` — **AUTHORIZED — build-feature delegation**.
- **Baseline:** `main` at `4503177` plus prior uncommitted M1/skill work; pre-M2 file digests captured locally for scoped comparison. Earlier work is preserved.
- **Implemented:** Repository-owned PostgreSQL 17.11 on loopback, separate development/test databases, generated Better Auth 1.7.7 schema, reviewed Drizzle migration and restricted runtime grants; local verification/reset mail; complete account/auth flows, no-role signup, trusted synthetic multi-role fixtures, account status/ownership guards and minimal audit events. Native account/forms follow the current proposed theme; final shadcn/brand decisions remain open.
- **Review:** Same-agent read-only inspection against the authorized M2 blueprint and pre-M2 file-digest baseline: plan alignment **PASS**, unintended-change audit **PASS**, recommendation **READY FOR VERIFICATION — local scope**. Revised Host handling and scoped browser assertion re-reviewed. No outstanding confirmed application finding. No independent review or release clearance claimed. No tests were executed by Review; results below belong to separate Verification.
- **Verification:** Clean `npm ci` succeeded (777 packages); dependency tree reported no problems. Local cluster initialization, both migrations, idempotent migration reruns and fixture rerun succeeded. `npm run check` passed formatting, lint, typecheck and **37 unit/component tests**. `npm run test:integration` passed **15/15** real PostgreSQL tests: verification/recovery, expired/single-use tokens, logout/session revocation, synthetic input/role injection, active/verified status, multi-role and cross-account/admin ownership denial, CSRF/origin/redirect rejection, throttling, constraints, restricted privileges, transaction rollback and safe DB failure. `npm run build` passed. Final `npm run test:e2e` passed **22/22** Chromium checks, including complete auth/settings/reset/logout journeys, private cache behavior, role denial, zero external browser requests in the primary journey, responsive/keyboard/axe checks at **1440×900, 390×844, 320×720**. All three sign-in screenshots visually inspected; local artifacts under `test-results/` and `playwright-report/` remain ignored.
- **Additional checks:** UI detector returned **[]**. All 29 production client asset files scanned against actual local auth/DB configuration values: **zero secret matches**. Private env/database/mail/fixture files remain ignored. `git diff --check` passed. Development sign-in and health returned HTTP 200 at `http://127.0.0.1:3000`; test server stopped after the suite.
- **Recovery evidence:** `prompts/recovery/2026-10-11-local-m2.md` records loopback CI binding, suspended-login response, formatting normalization, Better Auth test-mode origin defaults, Next internal localhost versus incoming Host, and Next route-announcer test ambiguity. Final checks pass without skipped tests or disabled origin/CSRF checks.
- **Remaining acceptance:** Hosted Neon/TLS/pooling behavior, Resend delivery, production secure-cookie behavior, remote CI and deployment are **NOT RUN** under local-only scope. Guardian relationships/tutor eligibility belong to subsequent milestones; auth does not establish their policy. The existing **13 dependency advisories (4 moderate/9 high)** remain; audit is not clean. No real-minor onboarding, payment or release approval.
- **Next smallest task:** Architect M3.1–M3.3 using local synthetic data, preserving open screening and product decisions.
- **Scope distinction:** Local PostgreSQL replaces hosted Neon only for this authorized development phase. No Neon/Railway/Resend operation, real-user data, message send, push or deployment was performed. Updated the architecture, build plan and local-only decision record accordingly.

### Session — 2026-10-11 (M3.1–M3.3 local tutor catalog — verified)

- **Owner / branch / PR:** Claude Code for the repository owner · `main` working tree at base `d22a061` (clean before this slice) · no commit, push, PR or deployment.
- **Authority:** `/build-feature M3.1–M3.3 tutor catalog.` Blueprint `prompts/features/m3-01-tutor-catalog-foundation.md` — **AUTHORIZED — build-feature delegation**; not separate human approval of the blueprint. Local-only constraint from `docs/decisions/2026-10-11-local-m2.md` kept.
- **PRD:** TUT-01, TUT-02, TUT-03, ADM-01, ADM-02 (create specialized, activate, deactivate; rename not built), AUTH-03; QA-02 and QA-03 at the service level.
- **Changed:** Migrations `0001_tutor_catalog` and `0002_launch_subjects`; runtime grants; `src/features/subjects`, `src/features/tutors`, `src/features/admin`; API routes for own tutor profile, admin review and admin subjects; pages `/tutor`, `/tutor/profile`, `/admin`, `/admin/tutors`, `/admin/tutors/[profileId]`, `/admin/subjects`; shared confirm dialog, mutation boundary, rule error, time-zone labels; the account service now imports the extracted time-zone check; `readSmallJson` takes an optional size limit; seed adds one fictional pending application. Applied to the local dev and test databases only.
- **Review:** Same-agent read-only inspection of the full diff against the blueprint. Plan alignment **PASS**, unintended-change audit **PASS**, **READY FOR VERIFICATION — local scope**. One minor finding (a browser assertion accepting two status codes) fixed and re-inspected. Not an independent review; no release clearance.
- **Verification (final code state):** `npm run check` PASS (format, lint, typecheck, **62** unit/component tests). `npm run test:integration` PASS **32/32** on real PostgreSQL, 17 new: submit and edit, forged status/owner/id rejected, anonymous/role-less/unverified/suspended/cross-origin denied, tutor A cannot change tutor B, inactive or unknown subject rejected, read-only when rejected or suspended, database constraints and runtime privileges, every legal and illegal review transition, admin-only review, no self-review, one winner of two simultaneous decisions, queue and detail expose no account data, catalog add/duplicate/toggle with audit, non-admin denial, eligibility exclusions. `npm run build` PASS. `npm run test:e2e` PASS **25/25**, 3 new, with axe and no-overflow checks at 1440, 390 and 320 and keyboard Escape/focus return on the dialog. Screenshots of the form, queue, detail and dialog inspected. UI guardrail greps returned only existing token definitions; detector returned `[]`; no database code and zero secret-value matches in client assets (the one `BETTER_AUTH_SECRET` name match is the Better Auth client library's own environment lookup, present since M2); `git diff --check` clean.
- **Recovery:** First browser run failed 1 of 25: the assertion expected focus on Math, while the form correctly focuses the first checkbox (English). Assertion corrected; no application change. Inspection also found the integration test left two subjects deactivated in the shared test database; it now restores them.
- **Not built / not verified:** Public subjects, directory, profile and matching pages; the self-serve application entry; teaching languages and public slug; review reasons; subject rename; sortable admin columns and admin mobile menu; rate limits on these endpoints; anything hosted. Remote CI not run. The 13 dependency advisories are unchanged; no dependency added.
- **Blockers / decisions:** Tutor screening policy (founder plus safety/legal). Before M3.4: re-review after an approved tutor edits; how an account obtains the tutor role; whether a rejected tutor may reapply.
- **Coordination:** A parallel session reports building M4.2 time utilities on branch `feature/time-utils` in a separate worktree, including a stricter `isValidTimeZone`. After that merges, `src/lib/validation/time-zone.ts` can be replaced by it; both branches add a note to `context/architecture.md`.
- **Deployment:** Not deployed.
- **Next session:** Decide the three M3.4 questions, then architect M3.4–M3.5.

### Session — 2026-10-11 (tutor edit and reapply decisions)

- **Owner / branch:** Claude Code for the repository owner · `main` working tree at base `d22a061` · no commit, push or deployment.
- **Decisions recorded:** `docs/decisions/2026-10-11-tutor-profile-edits.md`. An approved tutor's edits need no re-review. A rejected tutor may reapply on their own.
- **Changed:** The first was already the behavior. For the second, saving a rejected profile now returns it to pending and is audited as a submission; the rejected notice, the reject dialog wording and the form's button label follow. Suspended profiles stay read-only. No schema change. PRD TUT-02, architecture note and blueprint updated.
- **Verified (final code):** `npm run check` PASS (62 unit/component tests); `npm run test:integration` PASS 33/33, including the new rejected-tutor resubmission case; `npm run build` PASS; `npm run test:e2e` PASS 25/25. Same-agent inspection of the change only; no independent review.
- **Still open:** how an account obtains the tutor role; tutor screening policy. No moderation of approved tutors' edits and no reapply limit exist.

### Session — 2026-10-11 (M3.4 first slice: tutor application entry — verified)

- **Owner / branch:** Claude Code for the repository owner · `main` working tree at base `d22a061` · no commit, push or deployment.
- **Authority:** Owner agreed to the recommended design. Blueprint `prompts/features/m3-04-tutor-application-entry.md` — **AUTHORIZED — build-feature delegation**. Decision record `docs/decisions/2026-10-11-tutor-role-self-service.md`.
- **Changed:** Migrations `0003_tutor_role_audit` (audit action) and `0004_grant_tutor_role` (a `SECURITY DEFINER` function that adds only the `tutor` role); execute grant for the runtime role; `startTutorApplication` service and `POST /api/tutor/application`; `/become-a-tutor` now explains applying and has the "Start tutor application" button. Applied to local dev and test databases.
- **Review:** Same-agent read-only inspection against the blueprint: plan alignment PASS, unintended-change audit PASS, no confirmed finding. Not independent.
- **Verification (final code):** `npm run check` PASS (62 unit/component); `npm run test:integration` PASS **36/36**, 3 new (one audited grant, idempotent, cannot be public without approval; signed-out, suspended, cross-origin and forged bodies refused; runtime still cannot write `user_roles` and the function can add only `tutor`); `npm run build` PASS; `npm run test:e2e` PASS **26/26**, 1 new with axe and overflow checks at three widths. Detector `[]`; `git diff --check` clean.
- **Not built:** account-type choice at sign-up; public subjects, directory, profile and matching pages; rate limiting. Remote CI not run.
- **Open:** tutor screening policy. Any verified account can now hold the tutor role, which reaches only its own application.
- **Next session:** Architect the public directory and tutor profile pages (rest of M3.4, M3.5) on `listEligibleTutors`.

### Session — 2026-10-11 (M3.4–M3.5 public tutor discovery — verified)

- **Owner / branch:** Claude Code for the repository owner · branch `feature/m3-tutor-catalog`; earlier work committed as `9dca651` at the owner's request (not pushed); this slice is uncommitted on top of it. No deployment.
- **Authority:** "commit and proceed next piece". Blueprint `prompts/features/m3-04-public-tutor-discovery.md` — **AUTHORIZED — build-feature delegation**.
- **PRD:** PUB-01, PUB-02, PUB-03, PUB-04, TUT-03, MATCH-02; QA-01, QA-02.
- **Changed:** Migration `0005_tutor_profile_slug` (hand-edited backfill); eligibility module now returns the public tutor shape with subject and level filters and a by-slug lookup; `/tutors` with filters, result line, pagination and three empty states; `/tutors/[slug]`; `/subjects`; home page finder and up to three tutors; admin and tutor wording corrected because approval now publishes; browser tests start from zero inventory and order the zero-inventory checks first.
- **Review:** Same-agent read-only inspection against the blueprint: plan alignment PASS, unintended-change audit PASS, no confirmed finding. Not independent.
- **Verification (final code):** `npm run check` PASS (**64** unit/component); `npm run test:integration` PASS **37/37** (public shape has only allowed fields, ineligible tutors unreachable by slug, subject and level filter within one offering); `npm run build` PASS; `npm run test:e2e` PASS **26/26** including signed-out directory, filters, empty states, subjects links, home finder, public profile, no email or time zone in public HTML, 404 after suspension, axe and overflow at 1440, 390 and 320. Screenshots inspected. Detector `[]`.
- **Recovery:** One browser assertion read the URL before navigation finished; changed to wait for the URL. No application change.
- **Limits:** Filters sit above results below `lg` instead of in a sheet; no days, language or text search; no time column or booking (M4); filtering is in memory; pages remain `noindex`. By owner decision an approved tutor's edits are public without review. Remote CI not run.
- **Next session:** Architect M3.6 guided matching.

### Session — 2026-10-11 (M3.6 guided matching — verified)

- **Owner / branch:** Claude Code for the repository owner · branch `feature/m3-tutor-catalog` · not pushed, not deployed.
- **Authority:** "go the next piece now", with no commit until M3 was finished. Blueprint `prompts/features/m3-06-guided-matching.md` — **AUTHORIZED — build-feature delegation**. PRD MATCH-01, MATCH-02.
- **Changed:** `src/features/matching/match.ts` and `/get-matched`: two questions (level, then subject) as GET forms with answers in the query string, a results sentence stating the rule, up to five tutors by name, and a no-match state. The "when" question is not asked because availability does not exist until M4.
- **Review:** Same-agent read-only inspection: plan alignment PASS, unintended-change audit PASS, no confirmed finding. Not independent.
- **Verification (final code):** `npm run check` PASS (**67** unit/component); `npm run test:integration` PASS **37/37**; `npm run build` PASS; `npm run test:e2e` PASS **26/26** including both questions, Back, results, no-match and invalid-answer states, axe and overflow at 1440, 390 and 320. Results screenshot inspected. Detector `[]`.
- **Limits:** A match does not mean the tutor has an open time; no time or day preference; no ranking beyond name. Remote CI not run.
- **Next session:** Architect M4.1–M4.3 after reconciling with `feature/time-utils`.

### Session — 2026-10-11 (M4.2 time-zone and slot engine — verified in isolation)

- **Owner / branch / PR:** Claude Code for the repository owner · built in worktree branch `feature/time-utils`, rebased onto the M3 commits and fast-forwarded into local `main` as `254c16a` and `d6cf53e` · not pushed, no PR, no deployment.
- **Authority:** Owner requested `/build-feature` for the M4.2 library, then asked for the commit, the form dedupe and the merge. Blueprint `prompts/features/m4-02-time-zone-slot-library.md` — **AUTHORIZED — build-feature delegation**.
- **Goal:** Policy-independent engine for TUT-04 and MATCH-03: IANA validation, weekly windows to UTC, daylight-saving handling, slot generation.
- **Changed:** `src/lib/time/time-zone.ts`, `src/lib/time/availability.ts`, `tests/unit/time-zone.test.ts`, `tests/unit/availability.test.ts`; `context/architecture.md` §11 window-semantics note. `src/lib/validation/time-zone.ts` now calls `isValidTimeZone`, so the account and tutor forms refuse fixed-offset names such as `EST`, `GMT` and `Etc/GMT+8`; every value the time-zone picker offers is still accepted. No schema, migration, dependency, route or UI change.
- **Review:** Same-agent read-only review, not independent. First pass CHANGES REQUIRED (instants before year 100 bypassed the 366-day range guard; one query ran 29 s); repaired with regression tests; then plan alignment PASS, unintended-change audit PASS, READY FOR VERIFICATION.
- **Verified:** On the final commits: `npm run check` PASS (**205** unit/component); `npm run test:integration` PASS **37/37**; `npm run build` PASS. On merged `main`: `npm run test:e2e` PASS **26/26**. Engine tests also passed under host zones UTC, America/New_York, Pacific/Apia and Asia/Manila, and 19 of 19 injected single-line faults were detected (run before the rebase; the engine files are unchanged since). Remote CI not run.
- **Milestone status:** M4 Planned → **M4.2 engine verified in isolation; work package not complete** until M4.1 and M4.5 supply availability rows and active bookings.
- **Blockers / decisions:** Lesson duration, start-time step, minimum notice and holds remain `[OPEN]`; the engine takes them as arguments. A repeated fall-back hour is offered on both passes as a `[RECOMMENDED]` default. An account already stored with a fixed-offset zone must choose a region zone on its next save.
- **Deployment:** Not deployed.
- **Next session:** Architect M4.1 availability schema and tutor editor, calling `expandWeeklyWindows` and `generateSlots`.

### Session — 2026-10-11 (M5.1 standalone meeting-link validator)

- **Authority / baseline:** User requested the standalone MEET-01 validation portion; `AUTHORIZED — build-feature delegation`. Blueprint `prompts/features/m5-01-meeting-link-validator.md`. Clean worktree `cob-g/m5-meeting-link-validator` at `2803d1f`; all eight canonical context files present.
- **Validation library verified in isolation:** Pure parsed HTTPS Zoom/Meet validator, hostile-input unit tests and supported-format documentation in `docs/meeting-link-validation.md`. No dependencies, persistence, routes, UI, booking integration or availability changes. No network or logging in validation.
- **Scope:** Only the library portion; M5.1 and M5 remain incomplete. Reusable versus per-booking links and safety/access policy remain open. M4 dependencies and participant-scoped storage/integration are later work.
- **Review:** Same-agent read-only review of all five changed/new files against the delegated blueprint: plan alignment PASS, system integrity PASS, unintended-change audit PASS; no confirmed findings, READY FOR VERIFICATION. No independent review or release clearance.
- **Verification:** Node 24.20.0 / npm 11.19.0; `npm ci` PASS (777 packages; existing 13 advisories: 4 moderate, 9 high). `npm run check` PASS (format, lint, typecheck, 326 unit/component tests including 121 new validator tests). `NEXT_TELEMETRY_DISABLED=1 npm run build` PASS; `git diff --check` PASS. Checked uncommitted implementation on unchanged HEAD `2803d1f`; package/lockfile and `src/lib/time` unchanged. No failed checks or recovery loop.
- **NOT RUN:** `npm run test:integration` and `npm run test:e2e`: no `.env.test.local` or owned isolated cluster in this worktree; existing suites mutate their test database. No other session's database/configuration was borrowed. Provider runtime, remote CI and deployment not run. Responsive/accessibility QA not applicable (no UI changes).
- **Remaining / next:** Founder/product decides link reuse and safety/access rules; after booking ownership exists, integrate server-side validation with authorized private storage and reads, then test cross-account denial and missing-link behavior. Format acceptance proves neither meeting existence nor attendance nor participant authorization. No commit, push, merge, deployment, database operation or other checkout edit.
