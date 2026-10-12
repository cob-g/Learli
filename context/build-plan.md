# Learli — Build Plan

> **Project:** Learli (`learli` is the visual wordmark)  
> **Document:** `build-plan.md` — implementation sequencing and verification plan  
> **Version:** 1.0  
> **Prepared:** 2026-10-11  
> **Status:** **Planning only.** No application implementation, repository, deployed service, CI results, or database migration has been verified by creating this document.  
> **Starting point:** Product and technical documentation prepared; MVP implementation not yet verified.  
> **Primary goal:** Build the smallest safe, useful **one-on-one tutoring marketplace and booking intermediary**—**not** an LMS.

**Read alongside:** [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md) · [`PRD.md`](./PRD.md) · [`architecture.md`](./architecture.md) · [`AGENTS.md`](./AGENTS.md) · [`CODE-STANDARDS.md`](./CODE-STANDARDS.md) · [`PROGRESS-TRACKER.md`](./PROGRESS-TRACKER.md) · [`ui-context.md`](./ui-context.md).

---

## 1. Purpose and instructions

This is the **execution roadmap** for a human developer, Claude Code, Codex, or another coding agent. It explains **what to build first, what depends on what, how to verify it, and when to stop for a product decision**. It is **not** an invitation to implement all tasks in one run.

The companion documents remain authoritative in their domains:

| Source | Provides | How this plan uses it |
|---|---|---|
| `PROJECT-OVERVIEW.md` | Audience, value proposition, product scope and goals | Defines the outcome every milestone serves. |
| `PRD.md` | 46 numbered requirements (`PUB`, `AUTH`, `TUT`, `FAM`, `MATCH`, `BKG`, `MEET`, `OPS`, `ADM`, `PAY`), business rules, acceptance criteria and priority | Every work package traces to its relevant requirement IDs. **Exact acceptance criteria live in the PRD.** |
| `architecture.md` | Full-stack design, suggested data model, domain boundaries and deployment approach | Guides schemas, transaction design and integrations; proposed details are not automatically approved. |
| `AGENTS.md` | Agent behavior, change controls, security and handoff expectations | Governs every development task. |
| `CODE-STANDARDS.md` | TypeScript, Next.js, API, SQL, styling, test and Git standards | Governs code quality and review. |
| `PROGRESS-TRACKER.md` | Actual implementation status, open decisions and evidence | **Only this tracker records observed progress.** Update it after verified work. |
| `ui-context.md` | Brand direction, tokens, component patterns and accessible UI behavior | Guides implementation of every visible screen; exact token values are proposed defaults. |

**When sources disagree:** follow the latest explicit founder decision and applicable safety requirements, then reconcile `architecture.md`/`PRD.md`/`AGENTS.md`. Ask for approval rather than silently inventing a business policy. Keep the change in `docs/decisions/` when substantial. This build plan does **not** supersede any source document.

### Labels in this plan

- **`[AGREED]`** — already decided product or technical direction.
- **`[RECOMMENDED]`** — proposed implementation order or tool choice, adjustable with justification.
- **`[OPEN]`** — awaits a founder/product/safety/legal decision.
- **`[GATED]`** — cannot be implemented for real use or released until the relevant `[OPEN]` decision is approved.
- **`[LATER]`** — outside the agreed first-release product.
- **`P0 / P1`** — follow the definitions and exact priorities in `PRD.md` §0.3.
- **`[ ]` checkbox** — **planned/unverified**, not a claim that work is incomplete in a repository we have not inspected. On first use, reconcile against actual code.

### How to execute a work package

1. Inspect the actual repository and the latest `PROGRESS-TRACKER.md`; determine whether the task is already partly implemented.
2. Read the indicated source sections and confirm that any **`[OPEN]`** requirement is still open.
3. Pick **one narrow, reviewable vertical slice**: a user-facing outcome with appropriate server logic, data constraints and tests. Do not build only decorative UI and call the feature complete.
4. Identify whether changes affect **UI, backend, database, external services, or several layers**. State the exact acceptance checks before coding.
5. Implement, run available checks, test the critical negative/security scenarios, review the diff, and report evidence.
6. Update `PROGRESS-TRACKER.md` with verified status, branch/PR and test results. Leave blocked tasks visibly blocked.

**Never interpret the phases as time estimates, budget guarantees, or approval to merge/deploy.**

---

## 2. Product contract and permanent guardrails

### Learli's one job

Help **elementary, middle-school, high-school and eligible college learners**, or their authorized parents/guardians, **discover real tutors, choose an available one-on-one session, arrange the booking, and join via Zoom or Google Meet**. Tutors independently conduct lessons and manage teaching materials. Learli handles coordination and essential trust/safety operations.

**Launch catalog `[AGREED]`:**

- **Core:** Mathematics, Science, English.
- **Support:** SAT/ACT and entrance-exam preparation, homework help, study skills.
- **Specialized subjects:** Real tutor-supported academic/college topics; never claim universal coverage.
- **Levels:** Elementary, Middle School, High School, **College Support at launch**.

**Allowed MVP capabilities:** public discovery, truthful tutor profiles and offered subjects, short **rule-based** matching, parent/eligible-student accounts, tutor profile and availability, authorized bookings, booking-focused dashboards, private Zoom/Meet links, essential admin operations, email notifications, basic support/safety reporting; payment **only after approval**.

**Explicit exclusions `[AGREED]`:** no assignment/worksheet uploads, homework submission, LMS/course system, grading, detailed progress analytics, required tutor lesson reports, custom live classroom, in-app minor–tutor chat, group classes, AI tutoring/matching, curriculum engine, native apps, advanced tutor performance management, broad media storage, microservices or default always-on extra infrastructure. **Do not create an upload subsystem merely to store tutor avatars**; initials/static avatars suffice initially.

### Approved technical direction

| Layer | Planned choice | Guardrail |
|---|---|---|
| Full-stack app | **Next.js App Router**, React, strict **TypeScript** | One deployable application; keep business logic server-side and reusable for later mobile APIs. |
| UI | **Tailwind CSS**, **shadcn/ui** | Implement the light-first `learli` design system from `ui-context.md`; responsive and accessible. |
| Persistence | **Neon PostgreSQL**, **Drizzle ORM + Drizzle Kit** | Typed migrations; DB-backed data ownership and transactional booking integrity. |
| Authentication | **Better Auth** | Server-enforced role and record-level authorization; do not trust a role sent by the browser. |
| Hosting | **Railway** | One Next.js Node service initially; generated HTTPS development URL is acceptable. |
| Email | **Resend** | Transactional only; use a permitted test setup until a production sending domain is verified. |
| Lesson delivery | **Tutor-supplied Zoom / Google Meet link** | Link accessible only to authorized booking participants. |
| File uploads | **None in V1** | Static brand assets are okay; object storage is conditional on a future approved need. |
| Payments | **Undecided** | No real checkout, subscriptions, payouts, pricing or refund policy by default. |

### Mandatory cross-cutting rules

1. **Authorize on the server** for every protected read/write, including parent-to-learner relationship and tutor-to-booking ownership.
2. **Do not publish or book an ineligible tutor.** Eligibility screening policy must be approved before real operations involving children.
3. **Keep times accurate:** use IANA time zones for user/tutor preferences, persist booked instants in UTC, and handle DST/time-zone changes.
4. **No double booking:** enforce non-overlapping active tutor slots using a **database-level transactional guarantee**, not UI checks alone.
5. **Keep sensitive details private:** no child profiles, meeting links or authenticated data in public routes, search indexes or shared caches.
6. **Do not make false claims:** no fake tutors, qualifications, reviews, available slots, prices, payments, free trials, attendance or verification badges.
7. **Payments and real-minor onboarding have independent launch gates.** Prototype with fictional data while those gates are unresolved.
8. **Use actual evidence:** tested and deployed are separate statuses; screenshots and agent assertions alone are not completion evidence.

---

## 3. Where the project really stands

`PROGRESS-TRACKER.md` (baseline 2026-10-11) says **documentation prepared; application implementation not verified**. The presence of a specification does **not** establish a live application, working CI, connected Neon instance or deployed Railway service.

| Milestone | Goal | Initial planning status | Depends on |
|---|---|---|---|
| **M0** | Document alignment, repository inspection and recorded decisions | Documentation prepared; repository unknown | No implementation prerequisites |
| **M1** | Next.js repository, design foundation, quality tooling | Planned / unverified | M0 repo inspection |
| **M2** | Neon/Drizzle, Better Auth, roles and server permissions | Planned / unverified | M1 |
| **M3** | Tutor catalog, directory, profiles, simple matching | Planned / unverified | M2; eligibility policy for *real* publication |
| **M4** | Tutor availability, learner relationships, atomic booking core | Planned / unverified | M2–M3; child/booking policies gate *real* flows |
| **M5** | External lesson links, dashboards, email, essential support/admin | Planned / unverified | M2–M4 |
| **M6** | Founder business/payment/legal policy approval | **Blocked until decisions are made** | Can run in parallel with M1–M5 |
| **M7** | Approved live payment integration and reconciliation | **Blocked by M6** | M4–M6 and processor onboarding |
| **M8** | Controlled pilot, operations verification and release | Planned; **launch-gated** | Relevant M1–M7 work + safeguarding/policy/email/backup gates |

**Important:** It is reasonable to develop M1–M5 using isolated, clearly labeled test data. It is **not** reasonable to enable real child accounts, real booking commitments or real charges before applicable policies are approved. Some M4/M5 tasks may therefore finish only as **tested technical capabilities**, not as authorized production workflows.

### Dependency picture

```text
M0 — repository + decisions baseline
 │
 └─ M1 — Next.js foundation + design + QA scripts
     │
     └─ M2 — Neon/Drizzle + Better Auth + roles + ownership
         │
         └─ M3 — real tutor catalog + public discovery + rule matching
             │
             └─ M4 — time zones + slots + learner links + booking integrity
                 │
                 └─ M5 — private meeting links + dashboards + Resend + support
                     │
                     └───────────────────────┐
                                             ├─ M8 — pilot / launch readiness
M6 — APPROVED business / legal decisions ────┤
 │                                           │
 └─ M7 — approved checkout (if needed) ──────┘
```

M6 begins **as early as possible in parallel**; postponing decisions until all engineering is finished would create unnecessary rework. Its unresolved status must not be hidden by mock payment UI.

---

## 4. M0 — Kickoff, documentation and decision registry

**Outcome:** Every contributor can identify the actual repo state, source requirements, hard blockers and next smallest slice.

**Inputs:** all seven documentation files. **No implementation claims.**

### Work packages

- [ ] **M0.1 — Inspect real project state.** Find the actual repository (if any), Git remote, active branch, commit, package scripts, installed dependencies, routes, migrations, test framework, CI and current deployments. If there is no repo, record that and create one only with authorization.
- [ ] **M0.2 — Put source documents under version control.** Preserve `PROJECT-OVERVIEW.md`, `PRD.md`, `architecture.md`, `AGENTS.md`, `CODE-STANDARDS.md`, `PROGRESS-TRACKER.md`, `ui-context.md` and this `build-plan.md`; add a clear `README.md` when bootstrapping.
- [ ] **M0.3 — Confirm application scope against requirements.** Recheck four roles, launch levels, categories, Zoom/Meet boundary, marketplace-only scope, public vs private pages.
- [ ] **M0.4 — Create lightweight decision log.** Establish `docs/decisions/` and record approvals as needed. Do **not** call proposed values approved because they appear in an example.
- [ ] **M0.5 — Assign approval owners.** Confirm who can authorize tutor eligibility/guardian policies, money flows, launch markets, email domain and deployments; identify a human escalation contact for safety issues before any real-user pilot.
- [ ] **M0.6 — Baseline the tracker.** Record verified repo/CI/environment facts in `PROGRESS-TRACKER.md`. If nothing exists, retain **not started/unverified** for implementation.

### Acceptance / evidence

- [ ] README/document links work; unresolved policies are listed with owners and status.
- [ ] Repository inspection has a verifiable branch/commit or explicit **no repository exists** finding.
- [ ] No invented app screenshots, deployed URLs, test counts, credentials, or completed milestones.

**Blocked decisions:** M6's commercial and safeguarding questions remain **open** until explicitly answered; documentation alone cannot clear them.

---

## 5. M1 — Full-stack project foundation

**Outcome:** A minimal responsive Learli Next.js app builds locally and is ready for feature-by-feature work. **Do not implement speculative marketplace functionality yet.**

**Source:** `architecture.md` §§3–4, 8, 16; `AGENTS.md` §§3–5; `CODE-STANDARDS.md`; `ui-context.md` §§Theme–Components.  
**PRD link:** foundational support for all P0 requirements; `PUB-01` visual shell only.

### Work packages

- [ ] **M1.1 — Initialize/verify the Next.js project.** Use App Router, React, strict TypeScript, supported Node **LTS**, a pinned lockfile, and one package manager. Check current version compatibility instead of hardcoding old install commands.
- [ ] **M1.2 — Establish a feature-oriented structure.** Keep routes under `src/app/`, reusable UI in `src/components/`, domain logic in `src/features/`, server-only helpers under `src/lib/`, migrations in `drizzle/`, and tests in `tests/` (adapt to the real repo; do not reorganize a working project without cause).
- [ ] **M1.3 — Set up Tailwind and shadcn/ui.** Start with approved primitives only as used: button, input, form, card, dialog/drawer, select, feedback states. Use React Server Components by default and `use client` only for interactive parts.
- [ ] **M1.4 — Implement Learli theme tokens.** Light-first navy/teal identity, lowercase wordmark, brand assets, accessible colors, Poppins proposed typography, radius/spacing scale from `ui-context.md`. Exact hex and typography values are **proposed defaults**, not a license to bypass review.
- [ ] **M1.5 — Create shared page shells.** Public header/footer, meaningful navigation, placeholder route layouts for authorized workspaces (not exposed private data), 404/not-found and error handling, skeleton/empty patterns.
- [ ] **M1.6 — Set up quality tools.** Confirm lint, `tsc` typecheck, a formatter, unit/component tests (Vitest/Testing Library **recommended**), browser tests (Playwright **recommended**), and production build scripts. Prefer repo-established compatible tools.
- [ ] **M1.7 — Prepare environment safety.** `.env.example` containing **names only**, `.gitignore`, development/staging/production naming and server-only config validation; do not put secrets under `NEXT_PUBLIC_*` or commit `.env.local`.
- [ ] **M1.8 — Prepare CI / basic health route.** Add a low-risk health endpoint that does not disclose secrets or student data; configure CI to run the scripts that actually exist. No fake green badges.
- [ ] **M1.9 — Build a truthful marketing skeleton.** A homepage indicating what Learli actually offers, primary paths **Find a Tutor / Get Matched**, a tutoring-versus-platform explanation, and appropriate SEO metadata. Do not add stock fake ratings, pricing or tutor inventory.

### M1 exit criteria

- [ ] App starts locally; typecheck, lint, relevant tests and production build pass with actual commands recorded.
- [ ] Responsive site shell is usable on mobile and desktop, with keyboard navigation and a visible focus indicator.
- [ ] There is no live database requirement for merely loading the public shell; missing optional integrations produce safe behavior.
- [ ] No production secrets or private data appear in generated client assets, errors or source control.

**Handoff:** provide repo commit/PR, scripts, screenshots/QA notes where applicable, outstanding design decisions and smallest M2 slice. Update tracker M1 only when verified.

---

## 6. M2 — Data foundation, authentication and authorization

**Outcome:** Verified identities and server-enforced roles/ownership, with a development-only PostgreSQL baseline. The platform must not trust a route name, a client role field or a hidden button as permission.

**Source:** `architecture.md` §§9–10, 17; `AGENTS.md` §§7–10; `CODE-STANDARDS.md` §§TypeScript/API/Data/Security.  
**PRD:** `AUTH-01`, `AUTH-02`, `AUTH-03` (P0); `AUTH-04`, `AUTH-05` (P1); technical prerequisites for `TUT`, `FAM`, `BKG`, `OPS`, `ADM`.

**Local-only execution decision (2026-10-11):** The owner requested no cloud services, deployment or external email. Use local PostgreSQL and captured local mail for M2; record Neon/TLS and provider email as deferred, not verified. See `docs/decisions/2026-10-11-local-m2.md` from the repository root.

### Work packages

- [ ] **M2.1 — Connect an isolated Neon development database.** Keep connection string server-only, verify TLS/connection mode, pooling/transaction behavior, error handling and permission restrictions. Do not configure local tests to hit production.
- [ ] **M2.2 — Establish Drizzle schema and migration process.** Integrate the installed Better Auth schema correctly; create only essential application tables as their approved dependencies become clear. Review generated SQL, constraints, indexes and migration rollback options.
- [ ] **M2.3 — Implement Better Auth fundamentals.** Register, sign in/out, verify email, initiate/complete password reset, secure HTTP-only sessions, session expiry and abuse/rate controls. Choose permitted test email behavior; never falsely label delivery as successful.
- [ ] **M2.4 — Implement trusted role assignment.** Support `student`, `parent`, `tutor`, `admin` as legitimate roles (multi-role accounts as appropriate); no self-admin, self-approval or arbitrary role escalation. Tutor approval belongs to server/admin logic.
- [ ] **M2.5 — Centralize authorization helpers.** Reusable server guards for session, role, ownership, tutor account state and authorized learner relationship. Apply in every protected query/mutation, not just middleware or layouts.
- [ ] **M2.6 — Isolate data and caches.** Prevent public indexing, shared HTML caching or cross-account leakage for dashboards, child profiles, support cases and meeting information.
- [ ] **M2.7 — Safe validation and audit primitives.** Validate untrusted inputs (Zod or equivalent), use consistent safe errors and redact secrets, credentials and child information from logs. Add minimal auditable record patterns for sensitive actions.
- [ ] **M2.8 — Test fixtures and factories.** Seed **fictional** tutors/learners only into isolated dev/test; never present fixtures as genuine tutors on public production pages.
- [ ] **M2.9 — Secure auth UX.** Sign-up/sign-in/verification/reset screens using approved visual tokens; accessible error/loading/success states and safe post-auth return URLs.
  - **2026-10-11 delegated local password subset:** signed-in active verified owner
    change flow, forced other-session revocation, replacement-cookie forwarding,
    narrow HTTP provider boundary and accessible account form. Blueprint
    `prompts/features/m2-09-secure-signed-in-password-change.md`; executed evidence
    belongs in the tracker. No hosted/whole-milestone promotion.

### M2 exit criteria

- [ ] Successful and failing account flows tested, including verification/recovery and logout/private-page access.
- [ ] Client cannot grant itself `admin` or bypass tutor approval.
- [ ] Authorization unit/integration tests show that unrelated users cannot read or mutate one another's protected data.
- [ ] Database migrations apply cleanly to an isolated PostgreSQL test database; schema tracked in Git.
- [ ] Production remains unused/unmodified and credentials are absent from client bundles/Git.

**Restriction:** Parent–child proof/consent procedures are **not** implicitly solved by implementing auth; real child onboarding still waits for the relevant policy gate.

---

## 7. M3 — Tutor catalog, discovery and rule-based matching

**Outcome:** Visitors can understand Learli, browse **actual approved** tutors, compare real offerings, and get explainable recommendations without mandatory registration or AI.

**Source:** `PRD.md` §§6–7 (`PUB`, `TUT`, `MATCH`); `architecture.md` §§6–7, 9.2; `ui-context.md` §Layout Patterns.  
**PRD:** `PUB-01`–`PUB-04`; `PUB-05` is gated for public paid launch; `TUT-01`–`TUT-03`, `TUT-06` as relevant; `MATCH-01`, `MATCH-02`, with live-slot accuracy completed in M4.

**Local status (2026-10-11):** M3.1–M3.3 are implemented and verified locally with synthetic data only: catalog table and launch subjects, admin add/activate/deactivate, tutor application form, a self-service "Start tutor application" entry on `/become-a-tutor` that grants only the `tutor` role (first slice of M3.4), audited admin review transitions, and one eligibility query. The boxes below stay unchecked because the real screening policy is `[OPEN]`, and nothing is hosted. M3.4 public pages (home entry, subjects, directory, tutor detail) and M3.5 subject and level filters are also verified locally (`prompts/features/m3-04-public-tutor-discovery.md`); Guided matching (M3.6) is verified locally on level and subject only (`prompts/features/m3-06-guided-matching.md`); its time question now has a separately delegated availability extension in `prompts/features/m3-06-availability-matching.md` (implemented and verified locally; exact matching evidence recorded separately in the progress tracker). See `prompts/features/m3-01-tutor-catalog-foundation.md`.

### Work packages

- [ ] **M3.1 — Model the subject catalog.** Categories: Math/Science/English, supported exam prep, homework/study skills, and tutor-backed specialized topics. Explicit active/disabled states; no universal subject database or formal international curricula engine.
  - **2026-10-12 delegated local subset:** specialized display-name correction,
    stable references, monotonic name revision, duplicate/stale protections and
    atomic audit. Blueprint `prompts/features/m3-01-specialized-subject-name-maintenance.md`;
    executed evidence in tracker. Core launch names remain fixed; full launch
    checkbox and real-user gates remain open.
- [ ] **M3.2 — Build basic tutor application/profile forms.** Tutor sets truthful headline, bio, supported learner levels/subjects, teaching background and necessary time zone. Use initials/static avatars; no file-upload service by default.
- [ ] **M3.3 — Build eligibility status gates.** Support `pending`/`approved`/`rejected`/`suspended` or a reviewed equivalent, with restricted administrator actions and audit. **The real screening process is `[OPEN]`; use fictional applications in development until approved.**
- [ ] **M3.4 — Create public discovery surfaces.** Home, subjects, tutor directory (`/tutors`), tutor detail (`/tutors/[slug]`), tutor application entry, and an accurate how-it-works explanation as prioritized in the PRD.
- [ ] **M3.5 — Implement search and filters.** Subject, learner level and only additional filters backed by actual data. Paginate if needed; don't add a search cluster prematurely. Never return suspended, unapproved or inactive tutors.
- [ ] **M3.6 — Build guided matching.** Short form asks topic/subject, level, preferred scheduling context and timezone; deterministic filtering + explainable ordering. Show a small *real* set, with a browse fallback; never promise exactly three matches or claim it uses AI.
- [ ] **M3.7 — Build truthful display states.** Zero tutors, zero matches, pending profile, disabled subject, no reviews and unknown availability must all have honest, actionable copy.
- [ ] **M3.8 — Add public metadata/SEO boundaries.** Public profile pages may be indexed when genuinely public; private learner data, restricted approvals, booking details and meeting URLs must not leak into public HTML or metadata.

### M3 exit criteria

- [ ] Only eligible, actually approved tutors appear in production-facing discovery; test fixture names are visible only in dev/test.
- [ ] Subject/level filtering and matching return accurate tutor sets; empty-state tests pass.
- [ ] One tutor cannot edit another tutor's profile; clients cannot set `approved` themselves.
- [ ] Public profile includes clear subject/level fit and safe CTA, but **not** meeting links, private child data, invented rates or review scores.
- [ ] Mobile search/filter/tutor-card/profile flow is navigable and accessible.

**Dependency:** Matching to *actual bookable times* is finalized in M4. Do not label a preview as an irrevocably reserved slot.

---

## 8. M4 — Availability, authorized learners and booking engine

**Outcome:** A guardian or eligible independent learner can request a genuinely available one-on-one tutor time, with correct time zones, clear states and hard protection against overlapping active bookings. **Policy-dependent live outcomes stay blocked until approved.**

**Source:** `architecture.md` §§9.3–9.5, 9.9, 11; `PRD.md` §§7.4–7.6, 8–10; `CODE-STANDARDS.md` §Booking invariants.  
**PRD:** `TUT-04`, `TUT-05` (P1), `FAM-01`–`FAM-03`, `FAM-04` (P1/open), `MATCH-03`, `BKG-01`–`BKG-06`, `BKG-07` (P1/open).

### Work packages

- [ ] **M4.1 — Model tutor availability.** Recurring weekly windows linked to a valid IANA timezone; valid local start/end times; clear timezone display and schedule ownership. Do not confuse a recurrence with a fixed UTC offset.
- [ ] **M4.2 — Generate actual-date slots.** Convert tutor-local availability to UTC instants for each date; handle DST nonexistent/ambiguous times, cross-midnight boundaries, timezone changes, and exclusions for existing active bookings.
- [ ] **M4.3 — Support necessary time-off exceptions.** `TUT-05` is P1; implement when real tutor scheduling needs it, without silently cancelling already-committed sessions.
- [ ] **M4.4 — Model minimal learners/guardian links.** Parent manages only learners with **verified/authorized** relationship; eligible self-managed adult college learner books without a parent. **Real-minor consent/guardian proof is `[OPEN]`**, so use fictional data before authorization.
- [ ] **M4.5 — Design booking data and invariants.** Proposed schema: tutor, learner, booked-by user, subject, UTC start/end, status, relevant timezone, private meeting reference and minimal history. Review state names and required fields against approved booking/trial/payment policies before final live semantics.
- [ ] **M4.6 — Build a single booking domain service.** Authenticate and authorize actor, re-fetch current tutor/learner/subject/schedule, verify time bounds/eligibility, perform a DB transaction, return safe status. Browser-visible availability is **advisory** and must be rechecked.
- [ ] **M4.7 — Prevent overlap at database level.** Use a reviewed PostgreSQL interval-exclusion/locking/transaction strategy (e.g., range exclusion constraint for agreed blocking states). Decide which provisional states block availability **only after hold/payment rules are approved**. A pure `SELECT`-then-`INSERT` check is insufficient.
- [ ] **M4.8 — Make booking requests retry-safe.** Enforce idempotency for double-clicks, network retries and repeated requests; return one logical booking for one idempotent operation.
- [ ] **M4.9 — Implement history and status boundaries.** Expose legitimate upcoming/history records. **Do not auto-confirm paid/trial sessions** while confirmation prerequisites, permitted state transitions and hold lifetimes are unresolved.
- [ ] **M4.10 — Add cancellation/reschedule capability behind policy gate.** Build only policy-independent service boundaries until duration, notice periods, actor permissions, refund consequences and rescheduling rules are approved. Preserve booking history and original records.
- [ ] **M4.11 — Connect tutor profile to availability.** Display only actual-date candidate slots, always revalidating at submission; when a slot disappears, show a friendly unavailable message and alternatives.

### Required tests — **hard exit checks**

- [ ] **Concurrent requests:** Two independent bookings for the same tutor/overlapping interval cannot both become active/confirmed; assert database results, not just UI errors.
- [ ] **Retry/idempotency:** Double-click and timeout/retry do not produce duplicate logical bookings.
- [ ] **Authorization:** Parent A cannot create/read/change Parent B's child's reservation; tutor A cannot mutate tutor B's schedule/booking; unauthorized self-guardian linking denied.
- [ ] **Eligibility:** Suspended tutors, disabled subjects, unsupported levels and stale slots are rejected **server-side**.
- [ ] **Time:** Manila/California offset changes across DST, midnight crossing, ambiguous/nonexistent local time, timezone preference changes after booking.
- [ ] **State transitions:** Only approved actors make allowed changes; provisional/test records never appear as paid or truly confirmed without approved conditions.
- [ ] **Audit/history:** Significant state changes are traceable without logging sensitive child details or secrets.

**Critical split:** The **booking engine can be proven in isolated development using simulated states**. Real operating bookings, service duration/hold rules, real minors, no-shows, refunds and other contractual promises **must wait for approvals**.

---
## 9. M5 — Session coordination, role dashboards, notifications and safety

**Outcome:** Everyone involved in a legitimate booking can see **only their own permitted information** and join the correct external lesson. Admins can handle minimum essential operations. This is a marketplace dashboard, **not** an academic reporting portal.

**Source:** `architecture.md` §§6–7, 13–15, 17; `PRD.md` §§7.7–7.9, 10–11; `ui-context.md` §Account and role workspaces.  
**PRD:** `MEET-01`–`MEET-03`, `OPS-01`–`OPS-05`, `OPS-06` (P1/open), `ADM-01`–`ADM-04`, `TUT-06`, `FAM-03`.

### Work packages

- [ ] **M5.1 — Private tutor-supplied meeting link.** Accept approved Zoom/Google Meet `https://` URLs with parsed protocol/hostname validation and a reviewed list of allowed hosts. **Never** trust text containing `zoom`/`meet` as sufficient validation. Store links only in the appropriate restricted booking context or another specifically approved private setting.
- [ ] **M5.2 — Authorized link visibility.** Only eligible participants for that particular booking (and a legitimately authorized support role with a real need) may receive the link, under approved age/guardian rules. No public profile link, email to unrelated users, search metadata or public cache.
- [ ] **M5.3 — Student workspace.** Display the student's own upcoming/past bookings, tutor/subject/time/status and valid join action when permitted. Do not build homework, grades, lesson submissions or progress charts.
- [ ] **M5.4 — Parent/guardian workspace.** Show only authorized learners, unmistakable selected-learner context, upcoming lessons, booking history, allowed changes and payment information **only if actual approved payment records exist**.
- [ ] **M5.5 — Tutor workspace.** Own profile, subjects, timezone, availability, next lessons, booked learners with minimum necessary details, safe meeting-link entry and personal booking history.
  - **2026-10-11 local slice:** authorized tutor dashboard consumes participant-scoped synthetic booking reads for next future simulation, agenda/history, minimal learner label/level and actual subject/time/demo status/expiry. Retains profile review, availability/time-off/profile/account routes. Uses native GET refresh with an accessible enhanced pending status; no meeting entry/join, money, attendance, cancellation or teaching metrics. This local slice does not complete M5.5's launch scope or authorize live lessons; verification evidence is in progress tracker and its canonical blueprint.
- [ ] **M5.6 — Essential admin workspace.** Limited tutor eligibility actions, subject catalog, booking/support lookup and account safety restrictions. Require audit for sensitive actions. **No tutor KPI scoring or curriculum enforcement.**
  - **2026-10-11 local account slice:** owner-provisioned exact staff-to-target grants
    support scoped synthetic account summaries and audited access suspend/restore,
    independent of support assignments. Existing sessions, tutor review and booking
    history persist; no blanket runtime account-status UPDATE. See
    `prompts/features/m5-06-scoped-account-restrictions.md` and progress tracker for
    executed evidence. This does not complete M5.6 or approve real safety/appeals
    policy, production access actions or launch.

- [ ] **M5.7 — Transactional email integration.** Better Auth emails and event-based booking/changes via Resend, with safe recipient resolution and sensible retry/error handling. **Queue/delivery strategy should match actual hosting limits**; do not add Redis or an always-on worker by default.
- [ ] **M5.8 — Respect transaction boundaries.** Send booking notices **after the booking DB transition commits**. Failed email delivery must not undo a valid booking or create a false confirmation. Scheduled reminders are optional and require a justified reliable scheduler.

  Local M5.7–M5.8 slice (2026-10-11 six-feature delegation): event-driven durable
  queue plus bounded owned manual HTML capture for simulation-created notices
  only; exact current creator/tutor authorization, recipient dedup, safe expiry
  suppression, committed-row visibility and capture-independent booking state.
  See `prompts/features/m5-07-local-booking-notifications.md`. This slice does not
  complete real Resend delivery or the full M5 exit gates; execution evidence
  belongs in the tracker.
- [ ] **M5.9 — Basic support and safeguarding reporting.** Provide a visible contact/report route, restricted `support_cases` access, human reviewer responsibilities and escalation path. **Real child-safety operations are launch-gated** until owner/process requirements are approved.
- [ ] **M5.10 — Reviews only when authorized by policy.** `OPS-06` is P1 and publication/matching policy `[OPEN]`. If implemented after approval, require eligible real bookings, appropriate moderation, no duplicates and no invented social proof.
- [ ] **M5.11 — Clear third-party responsibility.** UX says sessions occur on Zoom/Meet; Learli does not host recordings, run video calls, automatically verify who attended, or offer in-app adult–minor private chat.

Local synthetic M5.3/M5.4 slice (2026-10-11): student/parent reservation
overviews are implemented using the frozen private-read provider, current
authorized learner context, account-local times, next/agenda/history and
progressive GET selection. See `context/progress-tracker.md` for executed local
verification evidence. This does not complete full M5 or authorize real lesson
confirmation, joining, payments, cancellation, minor onboarding or deployment;
the work-package and exit checkboxes remain open for their full approved scope.

### M5 exit criteria

- [ ] Student/parent/tutor/admin views show correct account-specific data with no ID-guessing leak.
- [ ] Meeting-link access tests deny unrelated users; malicious/non-approved URL hosts are rejected; missing links have a truthful status.
- [ ] A committed booking remains correct when Resend fails, times out or retries.
- [ ] A tutor's profile and booking links are not indexed/leaked in public metadata.
- [ ] Support/safety reports are accessible only to authorized reviewers; actions affecting users are audited.
- [ ] Mobile and desktop navigation remains simple and consistent with `ui-context.md`; no LMS navigation or unsupported review/rating claims appear.

**Note:** Do not label booking attendance as “verified” merely because users clicked a join link. Status/claims must match the approved product policy and what Learli can actually observe.

---

## 10. M6 — Founder and safeguarding decision gate (parallel workstream)

**Outcome:** Written, explicitly approved business and operating decisions specify **what Learli is allowed to offer real users and what any checkout must charge**. A code implementation, mockup, or AI-generated suggestion **cannot approve a business rule**.

**Source:** `PRD.md` §§8, 11, 17–18; `architecture.md` §§12, 17, 20; `PROGRESS-TRACKER.md` §Open Questions.  
**PRD:** `PAY-01`, gated `PUB-05`, `BKG-03`, `BKG-05`, `BKG-06`, portions of `TUT-01`, `FAM-01` and launch-safety rules.

M6 is **blocked at baseline**, but founders can resolve decisions while engineers implement M1–M5 in development. Prioritize decisions that prevent architecture rework.

### Decision checklist — approval required

| ID | Founder/reviewer decision | Affects | Minimum recorded output |
|---|---|---|---|
| **D-01** | Legal entity / operating jurisdiction / first student and tutor markets | Payment eligibility, minor protection, tax and policies | Market and responsible owner confirmed; qualified review arranged where needed |
| **D-02** | Who receives customer money: Learli or tutor? | Merchant/payment ownership, payout responsibilities | Approved merchant-of-record and money flow diagram |
| **D-03** | Per-lesson, package, recurring subscription or combination? Trial/assessment offer? | Checkout, confirmation, booking entitlements | Actual customer offer, not placeholder price cards |
| **D-04** | Exact price setter, lesson rates, supported currencies, platform fees/commissions and tutor compensation | Amount calculations, quoted price, receipts | Approved pricing/fee formula and examples |
| **D-05** | Payment provider, supported country/currency combinations and settlement/payout rules | Integrations and records | Provider selected after eligibility/cost review |
| **D-06** | Session duration, advance booking notice, provisional reservation/hold time and expiration behavior | Slot generation, DB blocking states, workflow | Reviewed booking state machine with actor permissions |
| **D-07** | Cancellation, rescheduling, no-shows, tutor cancellations, refunds/credits, disputed bookings | Status transition, support, payment reconciliation | Published customer-facing rules and precise tests |
| **D-08** | Minimum tutor eligibility/qualification and safeguarding review, reviewer and escalation owner | Public tutor visibility and minors' safety | Practical human review process and restrictions |
| **D-09** | Minor-account eligibility, lawful guardian consent/authorization and privacy handling in each operating market | Child profiles, authentication and booking ownership | Approved child-access and guardian-link policy |
| **D-10** | Data privacy, retention/deletion, incident response and reviewed Terms/Privacy/Cancellation information | Compliance, support and backups | Actual policies, responsible persons and procedures |

### Recommended lower-priority decisions (do not block safe foundations)

- [ ] **D-11:** Standardized prices vs. tutor-selected rates (if not resolved by D-04).
- [ ] **D-12:** Exact minimum tutor and learner fields and whether separate child logins are allowed.
- [ ] **D-13:** Tutor-provided unique link for every session vs. approved reusable link.
- [ ] **D-14:** Review eligibility/moderation and whether reviews ship in V1.
- [ ] **D-15:** Tutor photo upload, automatic email reminders or other infrastructure additions justified by real user demand.

### M6 approval procedure

- [ ] Record **each substantive decision** in `docs/decisions/` with ID, date, owner, approver, status, rationale, alternatives, implications and acceptance tests.
- [ ] Update `PRD.md`, `architecture.md`, `AGENTS.md` and any impacted standards/UI copy. Proposed status names and database fields become final **only when reviewed**.
- [ ] Obtain appropriate specialist input for applicable child protection/privacy, financial and legal obligations. **Do not treat this document as a legal compliance determination.**
- [ ] Revisit any M4/M5 development-only simulation based on approved policy; add new tests before authorizing live use.

**M6 exit:** The above P0 decisions are **actually approved and recorded**, not merely discussed or selected by an AI agent. If any required answer is missing, affected real workflows stay **blocked**.

---

## 11. M7 — Approved payment integration (conditional on M6)

**Outcome:** If Learli's **approved** business model requires on-platform payment, checkout/verification/records operate safely without invented financial assumptions. If users **pay tutors directly** under an approved model, **adjust the deliverables**: do not create unnecessary platform checkout, payout or subscription machinery.

**Source:** `PRD.md` §7.10 and §8; `architecture.md` §12; `CODE-STANDARDS.md` §Payments.  
**PRD:** `PAY-01` (approval prerequisite), `PAY-02` (P0 *after approval*), `PAY-03` (P1 after approval); commercial dependencies of `BKG-03`, `BKG-05`, `BKG-06`.

### M7 prerequisites — all required before live financial work

- [ ] M6 payment/merchant/trial/currency/pricing/refund approvals are recorded.
- [ ] Supported payment provider account and operating-country eligibility verified.
- [ ] Customer-facing offers, terms and cancellation/refund text approved.
- [ ] A reviewed booking/payment transition diagram exists, including failure, expiry, refunds and retries.

### Work packages (only for approved on-platform commerce)

- [ ] **M7.1 — Introduce only necessary payment tables.** Schema reflects approved flow; store currency codes, integer minor-unit amounts where applicable, booking/customer references, provider identifiers and status/event history. **No card/CVV storage.**
- [ ] **M7.2 — Add minimal payment-provider adapter.** Server-authoritative quotes and provider-hosted/approved checkout; no sprawling multi-provider abstraction before justified.
- [ ] **M7.3 — Secure verified provider callbacks.** Check signatures, event ownership and expected object/amount/currency; idempotently process duplicate or out-of-order webhooks.
- [ ] **M7.4 — Reconcile booking with money.** A browser success redirect never means “paid.” Bookings are confirmed only after **all approved prerequisites** hold; failed/expired transactions release any eligible reservations correctly.
- [ ] **M7.5 — Handle approved cancellations/refunds/credits.** Implement **only** published rules. Never perform a payout or refund from an untrusted browser field.
- [ ] **M7.6 — Display truthful financial information.** Participant-only payment details/receipts/history where required; amounts, currencies, fees and states match actual provider records.
- [ ] **M7.7 — Sandbox test full negative matrix.** Failed payments, network retry, signature failure, replayed webhook, webhook before browser return, partial/out-of-order events, slot expiry, authorized refund and invalid ownership.
- [ ] **M7.8 — Create reconciliation/incident procedure.** Define how staff investigate mismatched booking/payment states without altering records silently.

### M7 exit criteria

- [ ] Sandbox events are verified; duplicate events cannot duplicate booking confirmation, charges or refunds.
- [ ] Unexpected amounts/currencies and invalid webhook signatures are rejected.
- [ ] The platform never marks a session paid based only on a browser navigation result.
- [ ] User-visible fees and terms match approved policies; cross-account financial reads/writes are denied.
- [ ] Live payment credentials remain disabled until explicit launch authorization.

**Alternative outcome:** If approved operations deliberately have **no Learli-collected payments**, record an approved **“M7 not applicable under chosen model”** disposition and specify any honest coordination/recordkeeping requirements. Never implement a fake checkout just to make this milestone look complete.

---

## 12. M8 — Deployment, controlled pilot and public-launch readiness

**Outcome:** Deploy the approved build to an isolated, observable environment, prove recovery and security, and receive explicit permission before taking on paying customers or real child/student information.

**Source:** `architecture.md` §§16–21; `PRD.md` §§11, 13, 15, 17; `AGENTS.md` §14; `CODE-STANDARDS.md` §Deployment; `ui-context.md` §UI Build and QA Checklist.

### Infrastructure and deployment packages

- [ ] **M8.1 — Build the deployment runbook.** Document runtime/port/health checks, install/build/start commands, Railway environment setup, rollout and rollback behavior based on the **actual repo**, not assumptions.
- [ ] **M8.2 — Deploy one Next.js Node service to Railway.** Attach the generated HTTPS Railway subdomain for development or an approved pilot; verify routes, server actions and DB connections work in the target runtime.
- [ ] **M8.3 — Separate environments and data.** Development/staging/test credentials and Neon databases must be isolated from real-user production. No synthetic tutor profiles or fake reviews in the public production catalog.
- [ ] **M8.4 — Apply reviewed migrations intentionally.** Version migration SQL, review destructive changes, back up where appropriate, validate migration order and provide rollback/restoration steps. Never run migrations against production without the required authorization.
- [ ] **M8.5 — Confirm domain and Resend readiness.** A Railway-generated URL is sufficient for initial development; **Resend production sending requires domain verification** and correct DNS/authentication. A branded public domain may be chosen separately; do not claim free public email delivery without a verified sender.
- [ ] **M8.6 — Verify observability and reasonable usage controls.** Safe server logs, failure tracking, access to Railway/Neon/Resend usage/cost information and alerts/manual reviews appropriate for a small team. No hard promise of a fixed $5 all-in Railway bill.
- [ ] **M8.7 — Prove backup/recovery and owner escalation.** Verify actual backups, recovery procedure, restore test, key incident contacts and ability to disable sensitive flows safely.
- [ ] **M8.8 — Run security/privacy checks.** Authorization, session/cookie security, rate limiting, input validation, private SEO/no-cache rules, credential scanning, data minimization, safeguarding/report routes and abuse response.
- [ ] **M8.9 — Run the end-to-end acceptance matrix.** Real-browser role journeys with synthetic test users, multiple time zones, concurrency, provider failure behavior, responsive layouts, keyboard-only and screen reader smoke tests.
- [ ] **M8.10 — Review the operating business gates.** Approved guardian/age policy, tutor safety screening, actual policies, market eligibility, and payment go-live conditions (if applicable).
- [ ] **M8.11 — Conduct a limited pilot only when authorized.** Distinguish internal synthetic-data demo from a pilot using real learners. Observe actual issues/usage and prioritize P0 fixes; don't interpret a successful demo as public-readiness proof.
- [ ] **M8.12 — Explicit release approval.** Founder/release owner reviews evidence and issues a recorded go/no-go decision; deployment is **not** an implied authorization to accept bookings or collect money.

### M8 exit criteria

- [ ] Valid production-like Next.js build and healthy Railway service are verified; secrets remain private.
- [ ] Production data and test fixtures are completely separated.
- [ ] Recovery test, auth/security checks, booking concurrency/time-zone tests, meeting-link checks, approved payment tests and essential accessibility tests pass with retained evidence.
- [ ] Actual policy disclosures, safeguarding operations, incident contacts and verified production email/domain configuration are working for the intended launch markets.
- [ ] Founders sign off explicitly before real-user or paid/public launch.

---

## 13. PRD-to-milestone traceability

**This table is an execution index, not a replacement for the acceptance criteria in `PRD.md` §7.** P1 capabilities may be deferred with an explicit scope decision; P0 capabilities that are `[GATED]` remain blocked rather than implicitly waived.

| PRD requirement | Priority/status per PRD | Primary milestone | Key proof |
|---|---|---|---|
| `PUB-01` Discover Learli | P0 agreed | M1 / M3 | Honest homepage and primary journeys |
| `PUB-02` Subjects | P0 agreed | M3 | Real active catalog only |
| `PUB-03` Tutor directory/filtering | P0 agreed | M3 | Approved tutors, correct filters, empty state |
| `PUB-04` Tutor profile | P0 agreed | M3 | Accurate public data, no private links |
| `PUB-05` Trust/policies | Paid-launch P0 gated | M6 / M8 | Published approved claims and policies |
| `AUTH-01` Register/verify | P0 agreed | M2 | Account flows; no privilege escalation |
| `AUTH-02` Sign in/out/reset | P0 agreed | M2 | Session lifecycle and private-route controls |
| `AUTH-03` Roles/record ownership | P0 agreed | M2 + all later | Unauthorized requests denied server-side |
| `AUTH-04` Account settings | P1 recommended | M2 (optional) | Safe user-controlled profile changes |
| `AUTH-05` Booking return after auth | P1 recommended | M2 / M4 (optional) | Safe return; slot revalidated |
| `TUT-01` Application/eligibility | P0 agreed + open policy | M3 / M6 | Ineligible tutor not bookable |
| `TUT-02` Own profile | P0 agreed | M3 | Profile editing and ownership checks |
| `TUT-03` Subject/specialty | P0 agreed | M3 | Real offered subject/level pairing |
| `TUT-04` Timezone/availability | P0 agreed | M4 | Valid schedule, ownership, local time |
| `TUT-05` Exceptions/time off | P1 recommended | M4 (optional) | Existing confirmed bookings protected |
| `TUT-06` Assigned bookings | P0 agreed | M5 | Tutor sees only own bookings |
| `FAM-01` Guardian-managed learner | P0 agreed; consent open | M4 / M6 | Verified link; data isolation |
| `FAM-02` Eligible self-managed learner | P0 agreed | M4 | No forced parent for eligible adult |
| `FAM-03` Parent booking overview | P0 agreed | M5 | Authorized learner and booking list |
| `FAM-04` Child login model | P1 recommended; open | M6 decision / M4 if approved | No self-login for minors by assumption |
| `MATCH-01` Guided matching | P0 agreed | M3 | Rule-based real recommendations |
| `MATCH-02` Search/matching consistency | P0 agreed | M3 / M4 | Same accurate tutor eligibility and fit |
| `MATCH-03` Real available slots | P0 agreed | M4 | Accurate dated slots; revalidation |
| `BKG-01` Authorized booking | P0 agreed | M4 | Ownership, fit and idempotency |
| `BKG-02` Atomic conflict protection | P0 agreed | M4 | Concurrent DB-level no-overlap |
| `BKG-03` Provisional/confirmed states | P0 gated | M4 / M6 / M7 | Correct approved status lifecycle |
| `BKG-04` Booking details/history | P0 agreed | M4 / M5 | Private accurate booking history |
| `BKG-05` Reschedule | P0 capability; policy gated | M4 / M6 / M7 | Approved changes, ownership, history |
| `BKG-06` Cancel | P0 capability; policy gated | M4 / M6 / M7 | Approved changes, financial consistency |
| `BKG-07` Completion/no-show | P1 open | M6 decision / M5 if approved | No inferred attendance |
| `MEET-01` Allowed URL | P0 agreed | M5 | Safe validated external host/protocol |
| `MEET-02` Private participant access | P0 agreed | M5 | Outsider denied, status-aware link access |
| `MEET-03` External lesson boundary | P0 agreed | M5 | Clear third-party responsibility |
| `OPS-01` Student dashboard | P0 agreed | M5 | Own upcoming/history only |
| `OPS-02` Tutor dashboard | P0 agreed | M5 | Own schedule, role protection |
| `OPS-03` Parent dashboard | P0 agreed | M5 | Only authorized linked learners |
| `OPS-04` Transactional email | P0 agreed | M2 / M5 / M8 | Correct recipient; safe failure behavior |
| `OPS-05` Support/safety | P0 agreed | M5 / M6 | Restricted incident access + human response |
| `OPS-06` Verified lesson reviews | P1 agreed concept; policy open | M6 / optional M5 | Booking-backed moderated review only |
| `ADM-01` Tutor eligibility admin | P0 capability; details open | M3 / M5 / M6 | Authorized audited approvals |
| `ADM-02` Subject admin | P0 agreed | M3 / M5 | Approved catalog state only |
| `ADM-03` Booking/support lookup | P0 agreed | M5 | Restricted staff search; no bypass |
| `ADM-04` Account safety actions | P0 agreed | M5 / M6 | Authorized, auditable restrictions |
| `PAY-01` Money flow approval | Paid-launch P0 open | M6 | Signed decision record, actual model |
| `PAY-02` Verified checkout | P0 after approval / gated | M7 | Provider-verified idempotent payment |
| `PAY-03` Payment visibility | P1 after approval / gated | M7 | Accurate actual payment history |

**Requirement coverage:** All **46** functional IDs in `PRD.md` §7 are mapped above. Additional business invariants `BR-01`–`BR-18` apply throughout (especially authorization, no-overlap, privacy, financial truth and legal gates).

---

## 14. Vertical slices: recommended order inside each milestone

Implement **one useful slice per branch/PR**, not one giant branch per entire milestone. These examples are suggestions; match the actual repository and review workflow.

| Suggested slice | Prerequisite | User-visible/operational outcome | Minimum tests or proof |
|---|---|---|---|
| **V01 — Learli shell** | M0 | Real branding, mobile-ready public site shell | Build/lint/typecheck, accessibility smoke check |
| **V02 — Auth basics** | V01 + dev DB | A user signs up and signs in safely | Verification, reset, logout/security tests |
| **V03 — Permissions** | V02 | Correct routes/data for real server-assigned roles | Role escalation + cross-account denied |
| **V04 — Subject catalog** | V03 | Real active subjects render | Category/active filters, disabled state |
| **V05 — Tutor apply + basic admin state** | V03–V04 | Tutor can submit profile; not self-approve | Pending/suspended public exclusion |
| **V06 — Public tutor cards/profile** | V05 | Browse and compare eligible tutors | Valid filters, no private info/no fake reviews |
| **V07 — Get Matched** | V06 | Rule-based genuine recommendations | Fit, ordering, no-match behavior |
| **V08 — Tutor availability** | V05 | Tutor manages own timezone and weekly windows | DST/invalid interval/ownership tests |
| **V09 — Learner links** | V03 + approved model for real use | Authorized parent-managed/test learner or eligible adult | Relationship and permission denial tests |
| **V10 — Atomic booking core** | V08–V09 | One real slot maps to one logical reservation in test mode | DB concurrency + idempotency + server validation |
| **V11 — Booking details/dashboards** | V10 | Correct upcoming/history to each actor | Data access, local times, stale state |
| **V12 — Private meeting links** | V10 | Eligible participants can join externally | URL allowlist, ownership, no public leaks |
| **V13 — Notifications + support** | V11–V12 | Accurate email/support pathways | Provider failure and restricted case tests |
| **V14 — Commercial decision + implementation** | M6 | Only approved money flow; may be N/A | Sandbox webhook/idempotency if relevant |
| **V15 — Pilot readiness** | All applicable previous slices | Safe, observable deployment | E2E, backup/restore, launch approvals |

**Implementation heuristic:** For each slice, deliver the smallest complete backend + UI + tests necessary; avoid empty mock buttons and “coming soon” backend logic masquerading as finished functionality.

---

## 15. UI delivery plan and brand quality gates

Treat `ui-context.md` as the source for design and interaction behavior. The **product identity** is agreed; precise color/spacing tokens and sizes are **initial proposed defaults** to adopt consistently or change by review.

### Page order and required interactions

| Surface | Build with | Required states | Milestone |
|---|---|---|---|
| Public home, how it works | Accurate offerings, Find Tutor / Get Matched | Loading not required for static copy; honest CTAs | M1/M3 |
| Subjects directory | Active academic catalog | Empty, disabled, populated | M3 |
| Tutor directory (`/tutors`) | Filter/search and approved tutor cards | Loading, no results, error, filters applied | M3 |
| Tutor details (`/tutors/[slug]`) | Approved profile, offered levels, subject and slot preview | Eligible, unbookable, slot unavailable | M3/M4 |
| Guided matching (`/get-matched`) | Short accessible questionnaire | Invalid input, no tutor match, available results | M3/M4 |
| Auth | Register, sign in, verify, reset | Pending, validation, delivery failure, success | M2 |
| Tutor workspace | Profile, schedule, bookings, private link | No availability, no bookings, unauthorized action | M3–M5 |
| Parent workspace | Linked learner selector, upcoming/history | No authorized learner, no booking, blocked action | M4/M5 |
| Student workspace | Own bookings, join when valid | No bookings, expired/missing link, denied | M4/M5 |
| Admin workspace | Eligibility, catalog, support/safety | Pending, restricted, audited action | M3/M5 |
| Policy/pricing/checkout | **Only when approved** | Actual policies and accurate amounts | M6–M8 gated |

### Visual guidance

- Use the **lowercase `learli` logo**; capitalize *Learli* in running text. Primary navy `#1E2A78`, teal `#2ECCB0`, neutral `#F7F9FC` as the proposed initial theme from `ui-context.md` (version 1.1 removed the lavender accent).
- Use theme **CSS variables** and semantic tokens; no feature-level hardcoded colors. Use **navy/white** for primary CTA; avoid low-contrast white text on bright teal.
- Use **Poppins** as the proposed brand font; do not mix arbitrary font families across pages. Shared Tailwind/shadcn components should be responsive, navigable and accessible.
- Show real profile, status, timezone and action context before secondary decoration. Keep dashboards compact; no fake performance charts or LMS navigation.
- Distinguish visitor/public pages from private workspaces via layout, but maintain one design system and app.
- Artwork is an initial concept, not evidence of finalized vector production files; obtain consent/rights for actual photography and never copy competitors' imagery or UI assets.

### Viewports/accessibility validation

Check **320, 390, 768, 1024 and 1440 px**, **200% zoom**, keyboard-only navigation, meaningful screen-reader announcements for forms/errors, visible focus, reduced-motion support, and functional mobile booking forms. Target **WCAG 2.2 AA** for core journeys. User-facing time labels include **date and timezone context**, not an ambiguous “10:00 AM.”

---

## 16. QA strategy and critical regression matrix

The codebase does **not** have verified test tooling yet. Select/verify a compatible implementation during M1; `CODE-STANDARDS.md` recommends TypeScript checking, ESLint, Vitest/React Testing Library, PostgreSQL integration tests and Playwright. Do not claim these are already installed.

### Test layers

1. **Static/format:** typecheck, lint, format consistency, dependency/security checks where configured.
2. **Unit:** validation, matching rules, date/UTC/DST utilities, booking eligibility and URL parsing.
3. **Integration with isolated real PostgreSQL:** schema/constraints/migrations, role ownership, guardian links, status transitions, DB-level concurrent booking attempts, idempotency.
4. **Component/accessibility:** inputs, filters, loading/error/empty states, dialogs, keyboard focus and responsive layouts.
5. **E2E browser:** visitor → tutor → sign-in → learner selection → book in test mode → correct private join link → dashboard/history, plus tutor and admin paths.
6. **External-provider simulation/sandbox:** Resend failures and safe retries; payment provider only when M6 approved and M7 implemented. Do not call mocked third-party results proof of live delivery.
7. **Deployment/ops:** Railway build, health, private SEO/caching, isolated production configuration, backup/recovery and cost monitoring.

### Minimum negative tests (non-negotiable for affected features)

- [ ] Visitor cannot read child profiles, private booking data or meeting links.
- [ ] Parent A cannot view, edit or book for Parent B's learner; forged guardian association fails.
- [ ] Tutor A cannot alter Tutor B's schedule, eligibility or bookings.
- [ ] Client cannot self-approve tutor or self-assign `admin`.
- [ ] Suspended/unapproved tutors cannot be booked even if their public profile is cached or stale.
- [ ] Two concurrent overlapping booking attempts cannot both succeed as active reservations.
- [ ] Network retries/double-click do not duplicate bookings or payment events.
- [ ] DST and midnight shifts do not silently change lesson instants.
- [ ] URL validator blocks unrelated, deceptive and unsafe hosts/schemes.
- [ ] Missing Zoom/Meet link does not trigger a fake join button or false attendance claim.
- [ ] Failed or delayed Resend messages never alter a successful DB booking into an inconsistent state.
- [ ] Unapproved or failed payment cannot produce confirmed-paid status; forged/out-of-order webhooks rejected after M7.
- [ ] Public HTML/caching/SEO exposes no child data, private join URL or secret.
- [ ] Empty catalog/reviews show **truthful** empty states, not sample testimonials.
- [ ] Core functionality works on phone and via keyboard with clear errors and recovery.

### Per-pull-request quality gate

- [ ] Requirement ID(s) and scope are stated in the PR/task.
- [ ] Database changes/migrations reviewed; no destructive production operation without permission.
- [ ] Boundary input is validated and identity + ownership enforced on server.
- [ ] Success, failure, empty, unavailable and permission-denied paths considered.
- [ ] Exact test/lint/typecheck/build commands and observed outcomes recorded; failed or unrun checks disclosed.
- [ ] UX tested on the relevant small/large viewports if visual change.
- [ ] No accidental secret exposure, fabricated claims, out-of-scope LMS additions or premature financial handling.
- [ ] Docs/decision logs and `PROGRESS-TRACKER.md` updated only to reflect observed implementation work.

---

## 17. Deployment environments and minimum operations

| Environment | Users/data | Neon | Railway / URL | Email | Payments |
|---|---|---|---|---|---|
| **Local/dev** | Fictional synthetic data only | **Dev** DB | Local app; optional dev deploy | Test/mocked permitted Resend mode | Disabled/simulated only |
| **Staging** `[RECOMMENDED]` | Safe synthetic test accounts | **Isolated** staging DB | Test service/URL if justified | Test verified domain/config as appropriate | Sandbox only after approval |
| **Production** | Authorized real records only *after launch gates* | **Separate** production DB | Railway Node app with HTTPS, approved domain/URL | Verified production sender domain | Live only with explicit approval |

**Security:** Use Railway service variables or equivalent server-side secret management. Do not leak `DATABASE_URL`, Better Auth secret, Resend key, private admin credentials or future payment secrets. Do not share credentials between environments. Validate runtime configuration on startup and redact failure logs.

**Deploy sequence:** review and merge approved code → back up where needed → apply reviewed migrations in permitted environment → deploy/build/health-check → smoke-test critical roles/flows → monitor/errors → roll back or disable affected feature if safety or data consistency fails.

**Monitoring:** Track actual Railway resource usage and limits, Neon storage/connectivity/compute, and Resend sending quotas. Free tiers and minimum prices may change; never promise production availability or costs based solely on a promotional plan headline.

**Recovery:** Write `docs/operations/` runbooks for deploy/rollback, database backup/restore, external email outage, payment incident (if enabled), and child-safety escalation. Define a responsible human operator before pilot.

---

## 18. Release modes and explicit go/no-go checklists

### A. Internal development demo — **not a launch**

A demo is acceptable with **fictional users** and isolated test services if:

- [ ] No live charges, real minors' information, or public claims that simulated bookings are actual purchased lessons.
- [ ] End-to-end technical path works in test mode: browse → select tutor/slot → authorized test booking → private external lesson link.
- [ ] Obvious errors, role escapes, overlap failures and accidental private information leaks are absent.
- [ ] All demo-only behavior is clearly labeled and cannot be mistaken for production payment confirmation.

### B. Controlled pilot — **explicit authorization required**

- [ ] Define the audience, permitted data, safeguarding and support operations, and whether the pilot includes real users or only additional synthetic testing.
- [ ] Confirm that all relevant real-user consent/privacy and tutor-eligibility controls have been approved; do not use real minors merely because the pilot is small.
- [ ] Confirm booking/trial/payment rules relevant to pilot activity and how incidents will be handled.
- [ ] Monitor real usage, errors and costs; preserve incident history and record follow-up fixes.
- [ ] Receive explicit founder permission for the intended pilot scope.

### C. Public/paid launch — **hard gates**

- [ ] Registration jurisdiction, tutor/student markets, lawful customer terms and privacy review complete.
- [ ] Child eligibility, verified guardian relationships and safeguarding response process approved and tested.
- [ ] Tutor screening minimum and safe publication/complaint handling genuinely operational.
- [ ] Booking durations, holds, confirmations, cancellations/reschedules and no-show rules approved and tested.
- [ ] Money flow/provider/pricing/currencies/commission/payout/refund policies approved; real financial flows fully sandbox-tested and explicitly enabled **if applicable to the chosen model**.
- [ ] Policies accurately published; no unsupported free-trial, rating, verification or outcome claims.
- [ ] Verified Resend sending domain configured for actual email users.
- [ ] Production migrations, role controls, backup/restore, security, accessibility, booking concurrency, timezone behavior and incident ownership verified.
- [ ] Founder/release owner issues a written go/no-go decision. **Deploying code by itself does not satisfy this.**

### Definition of complete Learli V1

Under approved real-world rules, an eligible learner/authorized guardian can **find an actually eligible tutor, choose a genuinely available one-on-one time, satisfy the approved booking and commercial conditions, access the appropriate private Zoom/Meet session, and manage the legitimate booking**. Tutors and admins can perform only the essential authorized marketplace duties. Security, child protection, privacy, QA and operational gates for the intended launch audience must pass.

**Learli V1 is not defined by how many dashboards, uploads, AI models or analytics features it contains.**

---

## 19. Progress tracking, scope changes and developer handoff

### Status convention

Use **Not started**, **In progress**, **Blocked**, **Ready for QA**, and **Done** only with observable evidence. A document, mockup, single screenshot or unrelated passing test does **not** convert an implementation task to Done.

For each meaningful development session, update `PROGRESS-TRACKER.md` with:

```markdown
### Session — YYYY-MM-DD
- Owner / branch / PR:
- Work package / PRD IDs:
- Goal and implementation scope:
- Changes actually made:
- Tested: exact command(s), result(s), important negative cases:
- Manual QA: viewports and flows checked (or not run):
- Database/integration/deployment impact:
- Blockers or decisions required (with owner):
- Milestone status change and evidence:
- Next smallest testable task:
```

### Approval and change control

- **Product changes:** Record the founder's approval for adding an LMS-like feature, AI, custom classroom, broad tutor management, new money flow or other out-of-scope work. Update `PRD.md` and `architecture.md` before code relies on the new requirement.
- **Data/stack changes:** Explain why current Next.js/Neon/Drizzle/Better Auth/Railway stack is insufficient; avoid replacing technologies without a documented decision.
- **UI system changes:** Update `ui-context.md` tokens/patterns and affected components together.
- **Security/operations changes:** Follow `AGENTS.md` and `CODE-STANDARDS.md`; production alterations need explicit permission.
- **Status changes:** Tracker is the source of verified progress; this build plan's checkboxes are planning aids, not an alternative factual status log.

### Reusable coding-agent kickoff instruction

> Read `PROJECT-OVERVIEW.md`, `PRD.md`, `architecture.md`, `AGENTS.md`, `CODE-STANDARDS.md`, `ui-context.md`, `PROGRESS-TRACKER.md`, and `build-plan.md`. Inspect the actual repository before coding. Identify the first unverified/unblocked work package, map it to exact PRD IDs, and propose one small vertical slice with acceptance tests. Preserve Learli as an intermediary—not an LMS. Treat `[OPEN]` and `[GATED]` conditions as blockers for real use; never invent pricing, minor-consent, booking-duration or refund policies. Implement only approved scope, run available checks, report exact evidence, and update `PROGRESS-TRACKER.md`. Do not deploy or modify production without explicit authorization.

---

## 20. Suggested first development session

**Do M0, then the smallest verifiable portion of M1.** Do not start with a paid checkout, a feature-rich parent dashboard, or a tutor uploads portal.

1. Inspect/create the authorized repo and confirm the source files, branch and actual runtime.
2. Decide which compatible current versions and quality tools to use; initialize/verify Next.js App Router + TypeScript.
3. Wire Tailwind/shadcn tokens from `ui-context.md` and implement a responsive, truthful Learli public shell.
4. Set `.env.example` names, Git ignore rules, scripts and CI baseline. Keep production credentials out.
5. Run observed lint/typecheck/build and any configured tests; capture results.
6. Update `PROGRESS-TRACKER.md` with real M0/M1 evidence and the next slice (usually isolated Neon + Better Auth from M2).

**Final guiding principle:** *Build the smallest safe path from finding a genuine tutor to a legitimately booked external lesson. Ship verifiable capabilities, not imagined marketplace scale.*

## Local five-feature integration — 2026-10-11

The verified integration was fast-forwarded into local main at `a169f61` from
foundation `3a055de`, under explicit user merge/cleanup authorization. It combines
M2.3/M2.9 own-session management, M3.2/M3.5 optional declared
languages, M4.3 guarded time off, M4.5–M4.8 synthetic atomic reservations, and
M5.9 exact-case support. These local slices preserve real guardian/legal/
commercial/incident/production gates; full milestone exit boxes remain gated.
The default browser command selects every new suite. Candidate verification and
source/migration evidence live in `docs/operations/five-feature-premerge.md` and
the tracker. All six related worktrees/branches were removed after private
archival; no push, main database migration or deployment was performed.

### 2026-10-11 — Local M4.11 / M2.9 worker evidence

The isolated profile-booking worker implements M4.11 actual-date advisory preview
and the M2.9 public-selection continuation subset for the existing local demo.
Evidence:506 unit/component,170 real PostgreSQL,55 default browser cases and
production build passed; blueprint `prompts/features/m4-11-profile-booking.md`,
current worker tracker entry and ignored worker report contain exact commands and
hashes. Provider v1 is released to matching through the coordinator. Live booking,
whole-milestone completion and production readiness remain gated; this note does
not check off policy-dependent M4 or the entire M2.9 package. Coordinator owns
shared-file reconciliation, consumer integration and independent combined review.

### 2026-10-11 — Six-feature combined local candidate

`prompts/features/m4-09-six-feature-premerge-integration.md` integrates the six
frozen M4.9/M4.11/M3.6/M5.3–M5.5/M5.7–M5.8 local slices under AUTHORIZED —
build-feature delegation. Initial full check578cases,255 real PostgreSQL cases,
fresh13/baseline12→13 preservation/restricted-grant proof passed. Authorized
integration repairs received17 affected family cases, static validation and
production rebuild. All79 default-discovered browser cases have applicable passing
evidence:78 unchanged cases from the full sequential command and the corrected
combined journey1/1 after exact test-only setup repair. No single79/79 full-pass
command is claimed. Parent accepted both final independent reviews for runtime
f83f80976a63927e6699865f1113e7cb97980e1e018dd162a3cd7952cd6db402, with no
outstanding findings; final file audit/commit/merge remain parent-owned. Worker
neither commits nor merges. See
`docs/operations/six-feature-premerge.md` and current progress-tracker evidence.
This records local subsets without checking off entire M2/M3/M4/M5 launch packages
or changing real-user/commercial/consent/provider/production gates.

### Local M5.1/M5.2/M5.11 meeting-link work — 2026-10-11

Agent1 implements the delegated local-only per-reservation private test-link slice.
Existing validator, simulation TTL and participant boundaries remain governing.
This does not check off full M5 or authorize real external lessons. Verification
status belongs to progress-tracker and the own-checkout ignored worker report.

### Local M5.6/M5.9 booking-linked support — 2026-10-11

The Agent2 isolated candidate adds optional immutable simulated-booking report
association and exact-case minimum investigation context under delegated wave
authority. Requester participation remains current; assigned reviewers also need
current admin/support capability. No learner/contact/meeting/notification projection,
case replies or real incident operations. Blueprint
`prompts/features/m5-06-booking-linked-support.md`; actual review/verification
status belongs in the tracker and ignored worker report. Root inserts the separate
booking-detail CTA and reconciles shared files. Full M5.6/M5.9 boxes remain open
for real operations and policy gates; this note does not grant release readiness.


## Four-feature local assembly —2026-10-11

The authorized local wave combines M2 signed-in password changes, M5 local reservation links, booking-linked synthetic support and exact-target local restrictions. Its frozen import contract is prompts/features/m5-06-four-feature-coordination-wave.md. Source results are historical isolated evidence; combined checks and root independent reviews are distinct gates. No milestone completion, commit, merge or launch authorization follows from this wave.


### M3.5 / M4.11 directory filter branch (2026-10-12)

The supervised directory-only slice is implemented in an isolated branch under
AUTHORIZED — build-feature delegation. Optional actual-date filtering composes
the existing provider/preferences with exact pre-pagination results and the
coordinator-approved100-tutor capacity. No migration or dependency change.
Scoped tests and additive default Playwright registration are authored; Review
and executed Verify are still pending at this implementation checkpoint. This
entry does not promote the entire milestone or remove real-launch gates.


The M3.5/M4.11 directory branch now has same-agent read-only Review PASS and
separate local Verify:618unit/component,349real-PG, production build, and105
registered browser cases covered as101 unchanged full-run inherited passes plus
4affected directory passes after a test-only native-navigation observation
repair. Exact failures, commands, scope and limitations are in the branch's
ignored .local/next-wave/report.md and canonical recovery history. Local slice
verified; no whole-milestone, integration, production or launch promotion.

### 2026-10-12 — Scoped M2.9 local account email slice

AUTH-02/03/04 email change uses installed provider current/new re-verification
with exact fresh active verified owner/session binding, private local capture,
provider atomic consume and other-session revocation. Scoped blueprint:
`prompts/features/m2-09-verified-account-email-change.md`. Required evidence is
real provider/database adverse cases plus actual browser confirmation and
current check/build; partial completion needs explicit recovery. This does not
mark the whole M2.9 package or production authentication ready.
