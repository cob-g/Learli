## Repository-local skills

Skill sources live in `skills/<name>/SKILL.md`. Codex discovers them through
relative directory symlinks in `.agents/skills/`, and Claude Code through the
same kind of symlinks in `.claude/skills/`; edit the source files under
`skills/` so there is only one maintained copy. All project paths in these
skills are relative to the repository root unless explicitly stated otherwise.

- **architect** — Plan a Learli change and prepare an implementation blueprint. Read [SKILL.md](skills/architect/SKILL.md).
- **recover** — Diagnose failures and prepare a safe recovery handoff. Read [SKILL.md](skills/recover/SKILL.md).
- **remember** — Save or restore a concise session handoff. Read [SKILL.md](skills/remember/SKILL.md).
- **review** — Review implementation against its approved blueprint. Read [SKILL.md](skills/review/SKILL.md).

In Codex, invoke these with `$architect`, `$recover`, `$remember save`,
`$remember restore`, or `$review`. Slash-command examples inside the skill
instructions express the same intent; use `$name` for Codex skill mentions.
In Claude Code, invoke them as `/architect`, `/recover`, `/remember save`,
`/remember restore`, or `/review`.
Other agents can read the linked files directly. Load the applicable skill
before using it, preserve its scope, and do not automatically chain skills.
These four skills do not supply implementation or test-execution workflows.

---

## Application Building Context

Read the following files in order before implementing
or making any architectural decision:

1. `context/project-overview.md` — product definition,
   goals, features, and scope
2. `context/architecture.md` — system structure,
   boundaries, storage model, and invariants
3. `context/ui-context.md` — theme, colors, typography,
   and component conventions
4. `context/code-standards.md` — implementation rules
   and conventions
5. `context/ai-workflow-rules.md` — development workflow,
   scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase,
   completed work, open questions, and next steps

Update `context/progress-tracker.md` after each
meaningful implementation change.

If implementation changes the architecture, scope, or
standards documented in the context files, update the
relevant file before continuing.

### Additional required project context

Read these **before selecting or implementing any feature**, in addition to the six files above:

7. `context/prd.md` — definitive V1 functional requirements, requirement IDs, acceptance criteria, role permissions, launch gates, and open business rules.
8. `context/build-plan.md` — M0–M8 implementation sequence, dependencies, tests, and evidence required to mark milestones complete.

**Mandatory path check:** Paths above are relative to the **repository root**. These are the canonical filenames (all lowercase) on case-sensitive filesystems. Do not use the earlier root-level mixed-case planning filenames as alternate copies. If a required context file is missing, stop before implementing the affected change; locate the original source and reconcile paths rather than guessing or creating a conflicting copy. A documentation-only move/rename to establish this layout is permitted when requested, but do not silently change product decisions while migrating.

**Spec consistency:** The PRD owns detailed product behavior and acceptance criteria; the architecture owns technical boundaries and invariants; UI context owns the design system; code standards own engineering conventions; AI workflow rules own execution protocols; build plan owns sequencing; progress tracker records **verified current status**. New approvals must be recorded in the applicable documents. Latest explicit user decisions and essential security/safeguarding constraints take priority. The presence of a feature in a plan does **not** prove it exists in code.

---

# AGENTS.md — Learli Coding Agent Instructions

> **Project:** Learli (`learli` in the visual identity)  
> **Purpose:** Instructions for AI coding agents and human contributors working in the Learli repository  
> **Architecture reference:** [`context/architecture.md`](./context/architecture.md)  
> **Version:** 1.1 — Context workflow alignment  
> **Status:** Initial MVP development guide; not a claim that features are already implemented  
> **Applies to:** Claude Code, Codex, and any other development agent acting on this codebase

---

## 1. Read this first

**Learli is a tutoring marketplace and booking intermediary, not an LMS.** Its job is to help a learner or parent **find a tutor, book an available time, and join a lesson through Zoom or Google Meet**. Tutors deliver instruction independently.

Read the **Application Building Context** section above in full before implementing or making architectural decisions. In particular, read `context/prd.md` for exact feature requirements and `context/architecture.md` for technical invariants. This file explains *how coding agents should work* within those decisions.

### Document and instruction precedence

1. Follow the user's **latest explicit task instructions** and applicable safety/security requirements.
2. Follow `context/project-overview.md` for product direction, `context/prd.md` for detailed functional requirements, and `context/architecture.md` for architectural invariants.
3. Follow `context/ui-context.md`, `context/code-standards.md`, `context/ai-workflow-rules.md`, and `context/build-plan.md` for the applicable design, engineering, workflow, and delivery rules.
4. Follow this `AGENTS.md` as the repository-wide agent contract, and use `context/progress-tracker.md` for verified status.
5. Follow existing repository conventions when they do not conflict with these requirements.

If a requested feature changes an agreed product boundary, **call out the conflict and seek a decision** before expanding scope. Once approved, update all affected context files (especially `context/prd.md` and/or `context/architecture.md`) and a concise record in `docs/decisions/` as part of that work. Do not silently replace an unresolved business choice with an agent's guess.

The labels in `context/architecture.md` must be respected:

- **`[AGREED]`** — established project direction; preserve it.
- **`[RECOMMENDED]`** — default implementation choice; change only for a justified reason.
- **`[OPEN]`** — decision is not made; do not present an assumption as approved.
- **`[LATER]`** — intentionally out of scope for initial launch.

### One-sentence product contract

> Learli connects elementary-through-college learners and their parents/guardians with appropriate academic tutors, handles discovery, matching, scheduling, bookings, and essential coordination, while Zoom/Google Meet deliver the lessons.

---

## 2. Fixed MVP boundaries — do not expand them casually

### In scope

- Responsive public marketing website and explanations of how Learli works.
- Tutor profiles and an approved-tutor public directory.
- Search/filter by actual subject, level, availability, and relevant criteria.
- Simple, **rule-based** tutor matching; allow self-serve tutor browsing too.
- Student/learner, parent/guardian, tutor, and admin accounts.
- Parent-managed learner profiles and independent eligible college-learner accounts.
- Tutor-maintained profile, supported subjects, time zone, and availability.
- Reliable booking, cancellation/rescheduling (under an approved policy), and history.
- Private Zoom/Google Meet joining information for authorized booking participants.
- Essential booking-related transactional emails through Resend.
- Simple dashboards focused on **coordination**, not classroom activities.
- Basic admin review, account controls, safety/support reporting, and audit events.
- Verified-lesson reviews, subject to a simple approved review policy.
- Payments **only after** the unresolved business and payment decisions are approved.

### Academic categories — exact intended launch scope

**Academic core:** Math, Science, English.  
**Academic support:** SAT/ACT/entrance exams, homework help, study skills.  
**Specialized subjects:** Keep the category, including relevant college topics, but only advertise subjects covered by actual available tutors.

**Learner levels:** Elementary, Middle School, High School, **College Support**. Never drop college support as an agent optimization.

### Explicitly out of scope for V1

Do **not** create any of the following without explicit approval:

- Assignment uploads, homework submissions, worksheets library, student documents portal.
- An LMS, quizzes, grades, curricula engine, learning content management, or academic analytics.
- Mandatory tutor lesson reports, progress scores, or enforced lesson plans.
- Built-in classrooms, conferencing, recording, whiteboards, or video streaming.
- In-app student–tutor direct messages, group chats, or social feeds.
- AI tutors, AI matching, AI avatars, or vector-search infrastructure.
- Small-group classes, school multi-tenancy, or a multi-school admin system.
- Advanced tutor performance management, lesson audits, or complex tutor coaching.
- Native iOS/Android clients at launch (but **keep server logic reusable for later APIs**).
- File/object storage service without an actual approved upload requirement.
- Microservices, Kafka, Redis, Kubernetes, bespoke search clusters, or extra always-on workers by default.

**Never solve a marketplace task by accidentally building an LMS.**

---

## 3. Approved stack and infrastructure

| Layer | Use | Agent rule |
|---|---|---|
| Full-stack framework | **Next.js App Router** | Single application; do not add Laravel or a second backend. |
| Language | **TypeScript** | Strict types across server and client; no routine `any`. |
| UI | **React, Tailwind CSS, shadcn/ui** | Mobile-first, accessible, reusable components. |
| Database | **Neon PostgreSQL** | Single source of truth for application records. |
| ORM | **Drizzle ORM + Drizzle Kit** | Reviewed migrations and typed queries. |
| Authentication | **Better Auth** | Use its supported PostgreSQL/Drizzle integration. |
| Authorization | **Server-side RBAC + ownership checks** | Roles alone are insufficient: check the exact record. |
| Deployment | **Railway** | One Next.js Node web service initially. |
| Email | **Resend**, start with free tier | Transactional email only; respect limits and verified sending-domain rules. |
| Live lessons | **Zoom / Google Meet** | Tutors supply approved links; no embedded conferencing. |
| Files | **None initially** | Branded static assets/initials avatars are sufficient. |
| Payments | **`[OPEN]`** | Never pick a gateway or charge real money without approval. |

**Use current mutually compatible stable package releases at implementation time**, verify installation commands against official documentation, pin runtime/dependencies, and commit the lockfile. Do not assume a command in a planning document will remain valid forever.

### Non-negotiable environment separation

- **Local/dev:** Synthetic tutors and learners, development-only Neon database.
- **Staging (recommended):** Isolated test database and non-production credentials.
- **Production:** Separate Neon data and Railway variables; no seeded fake customer records.
- Never point tests or local experiments at production Neon.
- Never copy real student data into development fixtures.

---

## 4. Agent working protocol

### Before writing code

1. **Read** all eight context files in the required order above, this file, and any applicable approved decision record. Use `context/prd.md` for specific requirement IDs and acceptance criteria.
2. **Inspect the repository**: existing routes, services, schema, migrations, dependencies, scripts, tests, and deployment settings. Do not invent files or claim features exist without checking.
3. **Restate the task briefly**: UI, backend, or both; in-scope behavior; risks; definition of done.
4. Identify any **`[OPEN]` business decisions** that block implementation; ask one focused question when genuinely necessary.
5. Choose the **smallest complete change** that satisfies the task safely. Avoid speculative abstraction.

### While implementing

- Make **small, coherent, reviewable changes**; preserve unrelated behavior.
- Follow existing conventions. Don't refactor unrelated modules just because a task touches them.
- Keep server-only code and secrets out of client bundles.
- Add schema migrations, tests, and docs when a feature genuinely requires them.
- Use explicit empty/loading/error states; don't invent tutors, reviews, prices, or completed bookings.
- Use accessible, responsive UI and consistent `learli` branding.
- Never weaken permission checks, child safeguards, booking correctness, or payment verification to make a demo appear to work.

### Before considering work complete

1. Review diff for accidental files, unapproved scope, and exposed secrets.
2. Run relevant **typecheck, lint, unit/integration/E2E tests and production build** using scripts the repo actually defines.
3. Add or update tests for all changed business rules and permissions.
4. For user-facing changes, check phone and desktop layouts as appropriate.
5. Report **what changed, what tests actually ran, their results, limitations, and any remaining open decision**.
6. Do not claim tests or deployment passed unless you observed them pass.
7. **Update `context/progress-tracker.md`** with the verified work, exact test evidence, blockers, and next small task after every meaningful implementation change. Update any governing context files when approved implementation changes their documented scope, architecture, UI conventions, or standards.

### Production change safeguards

- Do **not** deploy, run destructive migrations, change production environment variables, purge data, issue refunds, create charges, or modify external billing without explicit authorization for that operation.
- Do not push directly to `main` or silently merge feature branches if the repository uses code review.
- Preserve user data; take an appropriate rollback/backup plan before impactful database changes.

---

## 5. Recommended repository layout

Keep one deployable project. Use this structure as a target, **not permission to reorganize a working repo unnecessarily**:

```text
learli/
├── AGENTS.md                  # This agent contract
├── context/                  # All canonical project context documents
│   ├── project-overview.md
│   ├── architecture.md
│   ├── ui-context.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   ├── progress-tracker.md
│   ├── prd.md
│   └── build-plan.md
├── README.md
├── .env.example              # Names and placeholders only
├── drizzle.config.ts
├── drizzle/                  # Reviewed SQL migrations
├── public/                   # Static site/brand assets; no student uploads
├── src/
│   ├── app/
│   │   ├── (marketing)/      # Homepage, tutors, subjects, how it works
│   │   ├── (auth)/           # Registration, login, reset, verification
│   │   ├── (dashboard)/      # Student, parent, tutor, admin experiences
│   │   └── api/
│   │       ├── auth/[...all]/route.ts
│   │       ├── health/route.ts
│   │       └── webhooks/     # Add only after choosing an actual provider
│   ├── components/
│   │   ├── ui/               # shadcn primitives
│   │   └── shared/           # Cross-feature UI components
│   ├── features/
│   │   ├── tutors/
│   │   ├── subjects/
│   │   ├── matching/
│   │   ├── learners/
│   │   ├── bookings/
│   │   ├── payments/         # NOT live until business approval
│   │   └── support/
│   ├── lib/
│   │   ├── auth.ts           # Server-only Better Auth configuration
│   │   ├── auth-client.ts
│   │   ├── db/               # Neon client, Drizzle schemas and queries
│   │   ├── permissions/      # Server-side checks
│   │   ├── validation/       # E.g. Zod schemas
│   │   ├── time/             # Timezone and scheduling utilities
│   │   └── email/            # Resend adapter
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── decisions/           # Approved material decisions
    └── operations/          # Deploy, restore, incident notes
```

### Application layers: who owns what

- **Pages + React components:** Rendering, accessibility, input collection, safe UI state. Never enforce permission *only* here.
- **Server actions / route handlers:** Authenticate → validate → authorize → invoke service → send minimal response.
- **Feature/domain services:** Core tutor, matching, guardian, booking, and support business rules.
- **Data layer:** Drizzle queries, transactions, constraints, indexes; no direct client DB access.
- **Integrations/adapters:** Resend; private Zoom/Meet link validation; future approved payment processor.

Do not put complex booking business rules directly inside React components or duplicate authorization logic across pages. Prefer a focused domain service shared by web actions and future mobile API routes.

---

## 6. User flows agents must preserve

### Public browsing and tutor matching

```text
Home / subject → search or get matched → tutor directory → tutor profile
     → choose slot → sign in if needed (keep selection) → booking flow
```

- Show **only approved, publicly eligible** tutors.
- Only display genuine subject/level coverage and real available options.
- V1 matching is **rule-based**, filtering by subject, learner level, time fit, and eligibility.
- Rank matches using transparent criteria; show fewer than three if only fewer than three exist.
- Provide truthful empty states, not fabricated ratings or tutors.

### Parent/guardian books for a learner

```text
Parent signs up / verifies email
  → creates minimal learner profile
  → authorized guardian/learner link established
  → finds eligible tutor and time
  → server validates availability/ownership
  → follows approved trial/payment rule
  → confirmed booking shows private meeting link
  → parent sees booking status and history
```

Parent dashboards are for learner accounts, bookings, status, cancellation/rescheduling, and applicable payment records. **Do not add mandatory grading or lesson reports.**

### Independent eligible college learner

```text
College learner signs up → own learner profile → browse/match
  → valid booking → join Zoom/Meet → manage own history
```

Don't require guardian accounts for eligible adults managing their own account.

### Tutor

```text
Tutor registers → verified account → profile/subjects/levels
  → basic required eligibility review → approval
  → set IANA timezone + availability → receive bookings
  → provide validated Zoom/Meet link → teach externally
```

Tutors control teaching, materials, and methodology; the platform controls only essential marketplace safety and coordination. **Basic safety review is not advanced tutor management.**

### Admin

Admin can review tutor eligibility, manage the subject catalog, handle essential account/booking support, and process safety cases. Admin access must be **scoped, logged, and protected**, not a universal bypass to all private learner records.

---

## 7. Roles, permissions, and learner safety

### Roles

`admin`, `tutor`, `student`, `parent` — model a user's role(s) through trusted server-side records. A person may legitimately hold more than one role, so a `user_roles` relation is the default recommendation.

### Always check ownership at the server boundary

- Tutor edits only **their** profile, subjects, availability, and assigned booking information.
- Student sees only **their** learner details and eligible booking information.
- Parent can book/view only **verified or authorized linked learners**.
- Assigned tutor sees only the minimum learner information required to deliver a booked lesson.
- Admin sees only information needed for a legitimate support or safety task.
- Suspended/ineligible users cannot act as bookable tutors or perform restricted actions.
- A UI-hidden button, URL slug, or submitted `role` parameter is **never authorization**.

### Child-safety baseline

Because learners may be minors, before a public launch agents must not bypass:

- Appropriate age/guardian rules and consent determined for launch markets.
- Private child profiles; minimum data collection, no default school/address/DOB requirement.
- Appropriate tutor identity/eligibility review to support safe participation.
- Private meeting links and safer external-meeting settings.
- A clear safety reporting route and actual human response/escalation plan.
- No built-in private messaging or recording in V1.

**Blocked policy decision?** Implement a non-public development fixture or paused flow; do not invent consent text or launch with an unsafe shortcut.

---

## 8. Database rules and proposed schema

`context/architecture.md` §9 provides the **proposed**, not yet finalized, ERD. Refine it in a reviewed schema task; do not pretend the table design is already implemented.

### Planned domain entities

| Group | Entities / intention |
|---|---|
| Identity | Better Auth-owned user/session/account/verification tables; app `user_roles` |
| Tutors | `tutor_profiles`, `subjects`, `tutor_subjects` |
| Families | `learner_profiles`, `guardian_learner_links` |
| Scheduling | `tutor_availability`, optional `tutor_availability_exceptions` |
| Sessions | `bookings`, recommended `booking_events` |
| Trust/support | `reviews`, `support_cases`, limited `audit_events` |
| Money | Payments, payouts, subscriptions, commissions **not fixed until business approval** |

### Database implementation principles

- Use migrations in version control, not ad hoc production schema changes.
- Respect Better Auth's **installed-version schema and documented migration process**; don't build duplicate auth tables.
- Use foreign keys, unique indexes, appropriate `NOT NULL` and check constraints.
- Use opaque identifiers for bookings; do not treat their secrecy as authorization.
- Index real lookup paths: approved tutors, subjects, tutor slots, learner/guardian links, booking ownership/history.
- Maintain timestamps consistently; store dated booking instants in UTC.
- Query records through server-side Drizzle; never expose `DATABASE_URL` to browser bundles.
- Don't put large binary files into PostgreSQL for hypothetical homework uploads.
- Use least-privilege DB credentials where practical; production migrations must be deliberate.
- Avoid deleting real booking/payment history to hide errors; apply approved retention policies.

### Booking integrity is a P0 requirement

The server/database must prevent two simultaneous requests from reserving the same tutor/time. An optimistic frontend availability check is not sufficient.

Use transactions plus a well-designed **database-level conflict rule** (for example, an appropriate PostgreSQL exclusion constraint for active booking states) or another demonstrably atomic strategy. Test concurrency against an actual PostgreSQL test database. Do not claim safety from a single-threaded demo.

---

## 9. Time zones and booking invariants

Time-zone correctness and booking consistency are core functionality, not enhancements.

- Store tutor and user time zones using **IANA identifiers**, e.g. `Asia/Manila`.
- Define recurring tutor availability in the tutor's **local wall-clock time**.
- Convert each actual date's slot to **UTC**, handling DST transitions correctly.
- Persist `start_at_utc` and `end_at_utc`; require end > start.
- Show each participant their **local date, local time, and time-zone context**.
- Keep availability exceptions (leave/holiday) when needed; do not create a full calendar sync engine.
- Recheck eligibility and slot availability on the **server** during booking and rescheduling.
- Make retries idempotent; avoid duplicate reservations from repeated clicks or network retries.
- Preserve auditable history of important booking status transitions.
- Do not call a booking **paid or confirmed** unless the approved business conditions are satisfied.
- Keep pending/awaiting-payment reservations bounded; **expiry/hold duration is a policy to approve**, not a guessed constant.
- Cancellation windows, no-show handling, credits, and refunds require approved business rules.

### Example mutation sequence

```text
Client selects available slot
  → validate request schema
  → load authenticated session
  → authorize who can book for learner
  → confirm tutor/subject/eligibility and slot
  → atomic provisional booking / conflict prevention
  → approved trial/payment step [OPEN]
  → server-confirmed final state
  → reveal private link to participants
  → send transactional notification
```

Do not trust the browser for availability, amount, currency, or booking status.

---

## 10. Authentication, input validation, and secrets

- Use **Better Auth** with its supported Next.js integration and Drizzle adapter.
- Initially support email/password, verified emails, password reset, secure sessions, and logout.
- Use secure HTTP-only session cookies over HTTPS in production.
- Apply protection against brute-force sign-in, account enumeration, and abusive booking/form requests.
- Validate external inputs server-side (Zod is recommended).
- Encode/sanitize user-provided profile content correctly; validate redirects and meeting links.
- Use provider-supported CSRF mitigations and trusted-origin configuration; don't disable them for convenience.
- Use safe error messages; don't reveal whether a private learner or booking belongs to another user.
- Keep secrets in `.env.local` or Railway environment variables, **never Git or `NEXT_PUBLIC_*`**.
- Never print auth cookies, private meeting URLs, payment credentials, or student information in logs.
- Implement admin MFA when feasible before handling real users; do not call an unprotected admin surface production-ready.

### Configuration examples (names, not values)

- `DATABASE_URL`
- `DATABASE_URL_DIRECT` (only if migration tooling needs it)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `APP_URL` (application-defined)
- `RESEND_API_KEY`
- `EMAIL_FROM`

Use `.env.example` with unmistakable placeholders; never commit actual values.

---

## 11. Third-party services — narrow contracts

### Zoom / Google Meet

- Tutors initially bring their own meeting accounts and provide valid links.
- Accept only approved HTTPS meeting URL patterns; safely parse and validate hostnames rather than loose substring checks.
- Treat meeting URLs as **private booking information**, not public tutor-profile data.
- Do not log full private links or display them to unrelated people.
- Learli **does not** provide audio/video, recording, waiting rooms, or attendance verification.
- Do not claim Zoom/Meet attendance happened unless a real verified integration provides that evidence.
- Meeting creation OAuth/SDK integrations are **later** features.

### Resend

- Use for verification, reset, booking confirmation, booking change/cancellation, and essential notices.
- Prefer sending only after the DB mutation has committed; keep booking state correct even if email fails.
- Log safe failures and establish retry behavior when reliable reminders become important.
- Production messages to general recipients usually require **a domain owned and verified for sending**.
- A Railway-generated web URL is fine for testing the app, **but not a substitute for Resend domain verification**.
- In development, use approved test recipients/testing mechanisms.
- Check actual free-tier limits and sending policy; don't hardcode assumed quotas.

### Payments — blocked until founders decide

These choices remain **`[OPEN]`**:

1. Student/parent pays **Learli** or the tutor directly.
2. One-off lessons vs prepaid packages vs subscriptions.
3. Standardized price vs tutor-set price, and any commission model.
4. Payout/merchant responsibilities and provider eligibility.
5. Countries, currencies, tax/FX and billing obligations.
6. Trial, cancellation, refund, and no-show policies.

**Agent rule:** Do **not** choose Stripe, PayMongo, a commission percentage, a subscription plan, or a payment schedule unprompted. Do not add a production `pricing` page with invented prices.

Once approved, use a provider-hosted secure checkout, verified signed webhooks, event idempotency, server-side reconciliation, and auditable refunds/payouts. Never store raw card data. Until then, mocks may exist **only in clearly marked development/test contexts**.

### File/object storage

None for initial Learli. Use static branded files and initials avatars. Tutor photo uploads or private documents need a separately approved use case and storage/privacy design; Neon Object Storage is a **possible future option**, not a launch dependency.

---

## 12. Frontend, content, and accessibility conventions

- **Brand:** `learli` in the logo; “Learli” in normal written content.
- Visual direction: approachable, modern, professional, navy + teal, rounded interfaces.
- Use semantic HTML, accessible labels, keyboard operation, focus states, readable validation messages, and adequate contrast.
- Build mobile-first; verify narrow and wide viewports.
- Public tutoring pages should use appropriate server rendering/metadata for search discovery.
- Private dashboard data must not be publicly indexed or cached across users.
- Do not show meeting links publicly, expose child details in metadata, or embed secrets into serialized page props.
- Keep registration/matching short and recover the user's intended tutor/slot after sign-in.
- Show honest availability and review counts; never use fake testimonials or made-up tutors in production.
- Public `/pricing` content waits for approved prices and business terms.

### Route examples — follow existing structure if implemented

| Route | Purpose |
|---|---|
| `/` | Marketing/home/search entry |
| `/subjects` | Actual offered subjects |
| `/tutors`, `/tutors/[slug]` | Tutor directory and profile |
| `/get-matched` | Simple matching questionnaire |
| `/how-it-works`, `/become-a-tutor` | Product education and tutor application |
| `/sign-in`, `/sign-up` | Auth flows |
| `/student`, `/parent`, `/tutor`, `/admin` | Role-appropriate dashboards |
| `/privacy`, `/terms`, `/cancellations` | Launch-required public policies |

---

## 13. Tests and non-negotiable acceptance criteria

Choose pragmatic tools (e.g., Vitest, React Testing Library, Playwright) only when the repository is ready for them. **Test business boundaries, not just happy-path screenshots.**

### Core checks

- [ ] Only approved tutors appear publicly and can be booked.
- [ ] Role escalation via form/request body is impossible.
- [ ] Parent A cannot access Parent B's linked learner or bookings.
- [ ] Tutor A cannot edit Tutor B's profile, schedule, or bookings.
- [ ] Minor accounts follow required guardian/consent safeguards.
- [ ] Eligible college learner can operate without a parent account.
- [ ] Search/matching returns truthful results and a graceful zero-results state.
- [ ] Two simultaneous booking requests cannot both reserve an overlapping slot.
- [ ] Time-zone conversion and DST edge cases work correctly.
- [ ] Cancel/reschedule revalidates overlap and leaves correct history.
- [ ] Invalid/suspended/ineligible accounts cannot perform restricted actions.
- [ ] Zoom/Meet URLs are properly validated, private, and participant-scoped.
- [ ] Email failures don't incorrectly change committed booking state.
- [ ] A visible payment-success page alone cannot mark a payment as paid.
- [ ] Review eligibility requires a valid completed booking.
- [ ] Auth/data secrets are not exposed in client bundles, source, or logs.
- [ ] `npm run build`, typecheck, lint, and relevant tests pass **if defined in the project**.
- [ ] Responsive UI and accessibility smoke checks pass.

### Test distribution

- **Unit:** matching filters/ranking, input schemas, policies, date-time utilities, status transitions.
- **Integration:** actual Neon-compatible PostgreSQL transactions/constraints, role ownership, guardian relations, booking concurrency; future payment webhook deduplication.
- **End-to-end:** browse → tutor profile → auth → booking → private join link; parent and tutor dashboard access; denied access from unrelated accounts.
- **Manual:** mobile/desktop, booking clarity, time-zone labels, empty/error cases, support/safety reporting.

Never use production credentials, real children's personal details, or real payment charges to validate routine tests.

---

## 14. Deployment and operations conventions

### Development setup

1. Initialize Next.js App Router + TypeScript + Tailwind using a maintained Node LTS.
2. Add shadcn/ui, Neon, Drizzle, Better Auth according to verified compatible docs.
3. Create an isolated Neon **development** database and reviewed migrations.
4. Create server-side auth, permissions, seeded fictional subjects/tutors, and a safe health check.
5. Add marketplace features in the recommended build order below.

### Railway deployment

- Deploy **one Next.js Node service** from GitHub initially.
- Supply secrets through **Railway Variables**, not Git.
- Use a **separate production Neon database/credentials**.
- Confirm build/start commands and health checks with the actual deployment.
- Generate a Railway `*.up.railway.app` domain while a purchased website domain is pending.
- Update Better Auth base/trusted origins and app URLs after domain changes.
- Do not add a Railway Postgres service: the agreed database is Neon.
- Migrate deliberately after testing on non-production data; avoid casual schema pushes in production.
- Track Railway CPU/RAM/network/billing and Neon connections/storage. Railway's $5 Hobby level is **a billing minimum with included usage, not a guaranteed unlimited flat rate**.
- Confirm backups/restores, incident contact, privacy requirements, tutor safety, and production email before a paid public launch.

### Branches and reviews

`main` as production and `feature/<topic>` branches are recommended; a `dev` integration branch can be used if the team needs it. Adapt to the **actual repository policy** instead of creating Git conventions without being asked. Require successful appropriate checks before release.

---

## 15. Recommended build order (small, testable milestones)

1. **Foundation:** Next.js shell, branded responsive homepage, configuration, Neon connection, Drizzle migration system, health check.
2. **Identity:** Better Auth, email verification/reset testing, role/record access control, safe admin access.
3. **Catalog:** Subject categories, tutor profiles, visibility approval, simple directory/filtering, matching.
4. **Tutor operations:** Basic profile editing, IANA timezone, weekly availability and exceptions.
5. **Learners:** Parent-managed minor profiles/authorized guardian links and eligible self-managed college learners.
6. **Bookings:** UTC slots, database-level overlap protection, idempotency, booking statuses, status history, rescheduling/cancellation scaffolding without invented policies.
7. **Coordination:** Simple role dashboards, private external meeting links, Resend test notifications, support/report flows.
8. **Commercial readiness gate:** Founder decisions about pricing, trials, processor, money flow, refunds, jurisdiction, and safety policy.
9. **Approved payments only:** Checkout, webhook verification, reconciliation, and settlement logic appropriate to the approved model.
10. **Pilot and launch:** Controlled pilot, tests, production email domain, backups/restore verification, legal/privacy review, security and cost monitoring.

Never build payments, learning uploads, or a video platform just because a generated template makes it easy.

---

## 16. Blockers requiring an explicit product decision

**Do not fill these gaps with assumptions.** See `context/prd.md` and `context/architecture.md` §20 for the authoritative requirements and open-decision list, then log blockers in `context/progress-tracker.md`.

| Priority | Decision still needed |
|---|---|
| P0 | Who receives customer payment: Learli or individual tutor? |
| P0 | Per-session, subscription, packages, or some combination? Exact prices? |
| P0 | Target launch jurisdictions and eligible payment provider/currency? |
| P0 | Free/paid trial and cancellation, reschedule, refund, no-show policies? |
| P0 | Tutor eligibility review and guardian consent/safety policy for real minors? |
| P1 | Standardized vs self-set tutor prices? |
| P1 | Minimal mandatory profile information? |
| P1 | Meeting link per booking vs reusable link? |
| P1 | Parent-only child management vs independently signed-in minor? |
| P1 | Exact reviews and tutor-application policies? |

If a task touches one of these, implement only the **policy-independent part** that is safe, mark the remaining decision as blocked, and ask for approval when required.

---

## 17. Definition of done and required agent handoff

A feature is complete only when its **UI, server authorization, data integrity, errors/empty states, tests, and relevant documentation** agree. A feature that looks correct but permits data leaks or double bookings is **not done**.

### Per-task handoff format

When reporting implementation work, summarize:

1. **Changed:** concise list of important files/behaviors, not a transcript.
2. **Verified:** commands/tests run and actual pass/fail results.
3. **Risks / blockers:** what remains unverified, any required founder decision.
4. **Deployment:** only if explicitly requested, state whether it was actually deployed.

Never state “production-ready” based on styling alone or claim a deployment/migration happened unless it really did.

### Full V1 outcome

Learli V1 is successful when an eligible learner or authorized guardian can **discover a real approved tutor, book a genuinely available slot without conflicts, complete the approved trial/payment step when defined, access the private Zoom/Google Meet session, and manage the booking**, while tutors and admins perform their limited operational tasks safely.

**Learli does not need an LMS, assignment uploads, academic reporting engine, file-storage account, or custom classroom to achieve that goal.**

---

## 18. Reference material

- **Product definition:** [`context/project-overview.md`](./context/project-overview.md).
- **Functional requirements and acceptance criteria:** [`context/prd.md`](./context/prd.md).
- **Primary architecture reference:** [`context/architecture.md`](./context/architecture.md) — rationale, ERD proposals, deployment details, and all `[OPEN]` choices.
- **Visual/UI specifications:** [`context/ui-context.md`](./context/ui-context.md).
- **Coding standards:** [`context/code-standards.md`](./context/code-standards.md).
- **AI execution workflow:** [`context/ai-workflow-rules.md`](./context/ai-workflow-rules.md).
- **Milestones and dependency order:** [`context/build-plan.md`](./context/build-plan.md).
- **Verified project state and session notes:** [`context/progress-tracker.md`](./context/progress-tracker.md) — update after each meaningful change.
- **Architecture decisions:** `docs/decisions/` (create when a material decision is actually approved).
- **Official platform references:** [Next.js](https://nextjs.org/docs), [Railway](https://docs.railway.com/guides/nextjs), [Neon](https://neon.com/docs), [Drizzle](https://orm.drizzle.team/docs/overview), [Better Auth](https://www.better-auth.com/docs/introduction), [Resend](https://resend.com/docs).

**Final instruction for all agents:** Build the **smallest safe marketplace** that fulfills the approved Learli experience. Preserve every agreed architectural boundary, escalate genuine business uncertainties, and verify critical booking and permission rules instead of inventing extra functionality.
