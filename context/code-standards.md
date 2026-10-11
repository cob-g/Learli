# Learli — Code Standards

> **Project:** Learli (`learli` in the visual brand)  
> **Document:** `CODE-STANDARDS.md`  
> **Version:** 1.0  
> **Status:** Engineering standards for the planned V1; not a claim that implementation already exists  
> **Audience:** Developers, Claude Code, Codex, and other coding agents  
> **Companion documents:** [`architecture.md`](./architecture.md), [`PRD.md`](./PRD.md), [`AGENTS.md`](./AGENTS.md), [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md)

## How to Use This Document

This file fills the supplied code-standards template and adds the rules required to implement Learli safely. Use it when writing, reviewing, testing, or changing code.

**Source-of-truth rules:**

1. The latest **explicit founder/user decision** and applicable security requirements take priority.
2. `architecture.md` defines approved architectural boundaries and the technology direction.
3. `PRD.md` defines product behavior, priorities, and acceptance criteria.
4. `AGENTS.md` defines coding-agent conduct and the implementation workflow.
5. This `CODE-STANDARDS.md` defines coding conventions and quality gates; existing repository patterns apply when compatible.

Follow the labels in the source documents: **`[AGREED]`** is confirmed, **`[RECOMMENDED]`** is a justified default, **`[OPEN]`** is undecided, **`[GATED]`** requires a decision before release, and **`[LATER]`** is outside V1. If documents conflict, **surface the conflict** rather than silently selecting a convenient interpretation.

**Product boundary:** Learli is a **tutoring marketplace and booking intermediary**, **not an LMS**. It helps elementary-through-college learners and guardians discover, match with, and book real tutors. Actual lessons happen in **Zoom or Google Meet**. A clean implementation must not add assignment submissions, grading, custom classrooms, academic analytics, mandatory tutor reports, AI tutoring, or advanced tutor management without an approved scope change.

**Confirmed stack:** Next.js App Router + React + TypeScript, Tailwind CSS + shadcn/ui, Neon PostgreSQL + Drizzle ORM/Kit, Better Auth, Railway (one Node app), and Resend for transactional email. **Payments are not yet approved**; object storage is not required in V1. Use current mutually compatible stable dependency versions and check official documentation at implementation time.

---

## General

### Engineering principles

- **Solve the actual user story:** Implement the smallest complete, secure marketplace behavior the PRD requests; do not build speculative infrastructure.
- **Prefer clarity over cleverness:** Simple readable functions, explicit names, and predictable control flow are better than dense abstractions.
- **Keep modules single-purpose:** Separate UI rendering, business decisions, database access, and third-party integrations.
- **Fix root causes:** Do not mask permission bugs, timezone errors, duplicate bookings, or failed mutations with frontend workarounds.
- **One codebase, one deployable app:** Keep a modular Next.js monolith until an actual requirement justifies another service.
- **Build server truth first:** Browser state is a convenience, never a source of truth for identity, guardian linkage, tutor eligibility, availability, price, or payment state.
- **Treat child safety as a baseline:** Use minimal learner data, appropriate guardian controls, restricted booking access, and genuine tutor-eligibility checks.
- **Do not invent business policy:** Pricing, payment collection, commission, payout, free trials, confirmation rules, cancellations, refunds, no-shows, minor-consent policy, and related thresholds are not finalized.
- **Preserve historical records:** Do not delete bookings, related events, or financial facts to conceal an error; follow an approved retention policy.
- **No fake production data:** Never publish invented tutors, credentials, availability, review totals, lessons, or prices as real.

### Naming and code cleanliness

| Item | Default convention | Example |
|---|---|---|
| React components and TypeScript types | `PascalCase` | `TutorCard`, `BookingSummary` |
| Variables and functions | `camelCase` | `findAvailableSlots`, `learnerId` |
| Constants (true constants only) | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| Feature folders and ordinary source files | `kebab-case` | `bookings/`, `create-booking.ts` |
| React hooks | `use-*.ts` | `use-booking-filters.ts` |
| Next.js special route files | Framework names | `page.tsx`, `layout.tsx`, `route.ts` |
| PostgreSQL tables and columns | `snake_case` | `guardian_learner_links`, `start_at_utc` |
| Validation schemas | Descriptive `camelCase` + `Schema` | `createBookingSchema` |

- Prefer descriptive domain names such as `guardian`, `learner`, `tutor`, and `booking`. Avoid ambiguous names such as `data`, `info`, `handler2`, or `userType` when a clearer term exists.
- Keep functions focused. Extract shared logic when there is actual repetition or a clearly separable rule; do not create a generic framework for one use case.
- Avoid `console.log` debugging in committed production paths. Use safe, structured logs for necessary diagnostics.
- Avoid commented-out blocks, unexplained magic numbers, hidden side effects, and TODOs without context. A TODO is not permission to leave an authorization or correctness hole.
- Follow the project's formatter and lint configuration. If these do not exist yet, establish lightweight ESLint/Next.js rules and consistent formatting before broad feature development; avoid introducing multiple competing formatters.
- Comments should explain *why* a non-obvious rule exists (e.g., a booking constraint), not narrate what an ordinary line does.

### Scope guardrails

- Launch categories: **Math, Science, English, SAT/ACT/entrance exams, homework help, study skills**, plus **specialized subjects only when actually offered**. **College Support stays in V1.**
- Product experiences: public discovery, real tutor profiles, rule-based matching, basic accounts/guardian relationships, availability, bookings, external meeting links, email, simple dashboards, limited admin and safety/support operations.
- **Not V1:** custom classroom, learning uploads, quizzes, curricula engine, built-in chat, AI matching, AI tutor, native mobile app, group classes, advanced tutor performance management, speculative storage, microservices, Redis/Kafka/Kubernetes.
- Design business services so later mobile clients can call approved API endpoints; **do not build a mobile client now**.

---

## TypeScript

### Required settings

- Enable and maintain **`strict: true`** in `tsconfig.json`; do not weaken compiler settings to silence errors.
- Do not routinely use `any`. Prefer `unknown` for untrusted values, then narrow with validation or type guards.
- Define meaningful types for domain inputs, results, DTOs, states, and permitted role combinations. Infer types from Drizzle and schema libraries where useful; avoid manually duplicating types that can drift.
- Avoid unsafe casts (`as SomeType`), non-null assertions (`!`), and broad `@ts-ignore`. If truly unavoidable, explain why and narrow the scope.
- Handle nullable/optional data explicitly. A meeting link that has not been supplied must not render as a fake usable link.
- Prefer discriminated unions for state-dependent results rather than weakly typed objects with unrelated optional fields.

### Trust boundaries and validation

- **Everything outside a trusted domain function is untrusted:** URL parameters, form bodies, headers, JSON, cookies, file fields, webhook payloads, and values from third parties.
- Use **Zod (recommended)** or a consistent equivalent for boundary validation; validate *server-side*, even when forms are also validated in the browser.
- Validate IDs, dates, time zones, durations, booleans, enums, query limits, and text lengths according to approved domain rules. Use bounded pagination parameters on public lists.
- Do not accept role assignments, tutor approval state, guardian ownership, price, currency, payment success, or booking confirmation directly from user-submitted fields.
- Keep returned objects minimal. A public tutor DTO must not accidentally include private user columns, raw auth/session data, support-case details, or meeting links.
- Treat database records as trusted only for what the application guarantees; validate external provider payloads even when they appear typed.

**Example — input validation boundary (illustrative, not a finalized booking policy):**

```ts
import { z } from "zod";

export const browseTutorsSchema = z.object({
  subjectId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export type BrowseTutorsInput = z.infer<typeof browseTutorsSchema>;
```

Values such as page size are **implementation examples**, not approved product policy. Confirm any domain-sensitive default before shipping.

### Asynchronous and error handling

- Await promises; do not launch untracked mutations or assume external integrations will succeed.
- Use typed, domain-specific errors for expected outcomes (e.g., `SlotUnavailable`, `NotAuthorized`, `TutorNotEligible`) and translate them to safe user messages at the server boundary.
- Distinguish a missing resource, forbidden access, validation failure, stale availability, and temporary service outage; avoid exposing sensitive record existence.
- Never catch exceptions and return a false success, silently skip a failed database write, or mark an email/payment as delivered without provider confirmation.

---

## Next.js (App Router)

### Components and rendering

- Prefer **React Server Components** for server-driven pages, database-backed reads, and public tutor profiles. Keep client components small and focused on genuine browser interactivity.
- Add **`"use client"`** only for components needing browser state/events or client-only APIs. Never import server secrets, Better Auth server configuration, or Drizzle clients into client components.
- Put database mutations in **server actions or route handlers** that call domain services. Treat server actions as public network entry points requiring the same validation and authorization as APIs.
- Use route groups for organization without assuming that folders such as `(dashboard)` implement access control. Enforce real permissions on the server for each read and write.
- Keep public SEO metadata truthful. Tutor directory and public profiles can be indexed where appropriate; private learner pages, booking records, and meeting links must not be exposed in public metadata.
- Do not statically generate or publicly cache personalized account information. Choose safe per-user rendering and caching strategies; ensure a cached response can never cross users or guardians.
- Server-side redirects and navigation destinations must be validated when their target can be influenced by a request.

### Separation of concerns

```text
Next.js page / component       => presents the experience
Server action / route handler  => authenticates, validates, authorizes
Feature service                => performs Learli business rules
Drizzle query/transaction      => safely reads and writes Neon data
Provider adapter               => talks to Resend / approved external services
```

- Do not implement booking conflict logic in page components, client hooks, or generic middleware alone.
- Do not call Drizzle directly from interactive client components or bypass a feature service for sensitive mutations.
- Prefer `server-only` boundaries where supported and separate client-safe imports from server-only modules.
- Use `loading.tsx`, `error.tsx`, `not-found.tsx`, and explicit empty states when useful; do not create pages just to check off a template.

### Public and dashboard behavior

- **Public:** show only approved/bookable tutors and actually supported subjects; matching may yield zero results and must describe that honestly.
- **Student/parent:** show only their own or authorized linked learner's bookings. Parent dashboard is booking coordination, **not academic grading or assignment management**.
- **Tutor:** edit only own public profile, subject offering, availability, and permitted assigned booking information.
- **Admin:** perform limited eligibility, subject, booking support, and safety actions with server authorization and appropriate audit records.

---

## Styling

### UI system

- Use **Tailwind CSS + shadcn/ui** as the primary styling system. Favor reuse of approved primitives and app-level components over one-off UI frameworks.
- Define **brand/design tokens** centrally (CSS variables / Tailwind theme). Use those tokens for colors, typography, spacing, radii, states, and shadows. Avoid scattering hardcoded color hex values or pixel measurements through feature components.
- Initial identity: `learli` wordmark in lowercase, modern rounded typography, **deep navy + teal** as the proposed direction. Do not treat the earlier brand mockup as a complete approved design-token specification.
- If `ui-context.md` or a design system is later created, follow its approved tokens. **Do not assume that file already exists.**
- Maintain consistent component states: default, hover, focus-visible, disabled, loading, empty, error, success.
- Use real typography hierarchy, readable copy, and restrained motion. Avoid gratuitous animation and excessive gradients.

### Responsive and accessible by default

- Build **mobile-first** and test narrow/medium/wide widths. Booking forms, slot pickers, dashboards, and navigation must work on phones without horizontal scrolling.
- Use semantic HTML, associated form labels, keyboard-operable controls, visible focus indicators, useful accessible names, and sufficient color contrast.
- Never rely on color alone to communicate availability, cancellation, confirmation, or validation state.
- Surface validation errors beside the relevant fields and announce them accessibly as appropriate.
- Use accessible date/time presentation with the **viewer’s local date, time, and time-zone context**; do not display ambiguous times without a zone.
- Reuse shadcn/ui primitives, but still verify keyboard/focus behavior when composing dialogs, menus, date pickers, or popovers.

### Content integrity

- Do not invent tutor credentials, review counts, qualifications, prices, available time slots, or claims of identity verification.
- Show honest empty states such as **“No tutors match these filters”** or **“Meeting link not provided yet.”**
- Use fictional content only in clearly marked local development/test fixtures, not production marketing or tutor results.
- Keep public copy welcoming to learners and guardians without presenting Learli as a school, LMS, or live-classroom provider.

---

## API Routes

### Route handler / server action contract

For **every protected read or write**, follow this sequence:

1. **Authenticate** using the server-side Better Auth session (unless intentionally public).
2. **Parse and validate** request inputs; apply reasonable request-size and parameter limits.
3. **Authorize** the required role *and* ownership/guardian relationship/booking participation.
4. **Call the feature service** where business invariants live.
5. **Persist atomically** where consistency is required.
6. **Return only the needed response**, using consistent statuses and safe error messages.

Validation may happen before authentication when necessary for safe parsing, but **neither can replace authorization**. Public reads must also validate filters and avoid leaking private information.

### API design rules

- Use consistent resource naming, HTTP semantics, and predictable JSON response/error shapes. A lightweight recommended error shape is:

  ```json
  { "error": { "code": "SLOT_UNAVAILABLE", "message": "That time is no longer available." } }
  ```

  Agree on the project's shape once and use it consistently; this example is **not a deployed contract**.
- Use appropriate statuses (`400` invalid request, `401` unauthenticated, `403` unauthorized, `404` unavailable/not disclosed, `409` slot conflict, `429` excessive requests, `500` internal failure). Choose `404` instead of `403` where disclosing a private resource's existence is unsafe.
- Never accept `userId` as proof of ownership, or an arbitrary `learnerId` without checking the approved guardian link.
- Restrict list queries to supported filters, safe pagination, and clearly ordered results.
- Apply rate limits or other abuse protection to sign-in, registration, matching, booking, contact forms, and other sensitive operations; choose tooling compatible with the actual Railway deployment rather than adding Redis by default.
- Keep CORS narrow and use Better Auth's supported session/cookie/CSRF protections. Do not weaken origins, cookies, or CSRF settings to fix a local integration issue.
- Keep route handlers focused. A large route handler that checks availability, sends email, manipulates payment, and performs SQL inline should be refactored into suitable services.
- Use **idempotency** for retryable side effects, especially booking creation, rescheduling, and future payment/provider callbacks.

### Future mobile-client readiness

- Business logic must be callable from service functions independent of React page structure.
- Route Handlers can later expose authenticated APIs for approved mobile clients without duplicating booking logic.
- Do **not** build a versioned public mobile API or introduce separate backend hosting before there is a real client requirement.

---

## Data and Storage

### Neon PostgreSQL + Drizzle

- **Neon PostgreSQL** is Learli's application database. Use **Drizzle ORM + Drizzle Kit** for typed queries and reviewed migrations; do not add Supabase, Firebase, MongoDB, or a second production database without approval.
- Use a **separate dev/test environment** from production. Tests and local experiments must never use production Neon or real learner records.
- Create and commit schema migrations; review SQL before applying. Do not run destructive production migrations, `DROP`, `TRUNCATE`, or bulk deletes without explicit authorization and a recovery plan.
- Respect **Better Auth's actual installed-version schema** and adapter. Never hand-roll conflicting auth tables or store passwords yourself.
- Use appropriate foreign keys, uniqueness, check constraints, indexes, nullability, and transaction boundaries. Query patterns should guide indexes; do not add speculative indexing everywhere.
- Keep database access in server-only modules with least privilege where practical. Never put `DATABASE_URL` in any `NEXT_PUBLIC_*` variable or browser code.
- Use parameterized typed queries and safe Drizzle expressions. Raw SQL is acceptable for a PostgreSQL feature not adequately expressible through the ORM, but it must be parameterized, reviewed, and tested.

### Core data modeling boundaries

Proposed domain groups in `architecture.md` and `PRD.md` (subject to reviewed schema design):

- Authentication/session records managed through Better Auth; trusted app role memberships.
- Tutor profiles, subjects, tutor-subject offerings, eligibility and availability.
- Learner profiles and verified/authorized guardian–learner links.
- Bookings, appropriate history/status events, restricted external meeting links.
- Minimal reviews, support cases, and sensitive-action audit history where approved.
- **Payment, payout, commission, and subscription schema only after the founders approve the commercial model.**

Do not define an elaborate final ERD merely because this list exists. Verify account relationships, status choices, and sensitive-data fields against the PRD and approved policies.

### Booking invariants — must be true before booking is called complete

- Only eligible, approved, non-suspended tutors with a genuine offered subject/level can be booked.
- Only an eligible independent learner or **authorized linked guardian** may book for a learner.
- The booking uses a real free slot; client-provided slot availability cannot be trusted.
- **Overlapping active bookings for the same tutor must be impossible under concurrency.** Use a PostgreSQL-backed atomic strategy (e.g., transaction plus a suitable exclusion constraint for applicable active statuses), not a read-then-insert race. Final active statuses depend on approved business rules.
- Repeated clicks/retried requests must not create duplicate bookings.
- Record meaningful state changes without inventing paid/confirmed rules. Payment-related confirmation is **`[OPEN]`** until decided.
- Rescheduling rechecks authorization, availability, overlap and policy; it must not silently orphan an existing booking.
- An email failure must not rewrite a successfully committed booking or pretend a delivery occurred.

### Dates and time zones

- Store appointment instants as **UTC** in appropriate PostgreSQL timestamp-with-time-zone fields; be explicit about serializing/deserializing instants.
- Store named zones using **IANA time-zone IDs** such as `Asia/Manila` or `America/Los_Angeles`.
- Model recurring tutor availability in the **tutor's local wall-clock time**. Resolve each candidate date to a UTC instant while handling ambiguous/nonexistent daylight-saving times.
- The learner and tutor may see different local calendar dates for the same booking. Display the viewer's local time **with the zone**.
- Do not assume everyone is in Philippine Standard Time or use a hardcoded hour offset between countries.
- Test DST transitions, overnight boundaries, tutor unavailability exceptions, and user timezone changes after booking.

### Data minimization and file storage

- PostgreSQL stores only the **structured data needed to operate a tutoring marketplace**. Do not collect child school/address/date of birth, government IDs, academic records, or teaching materials by default.
- **No student assignment uploads, homework submissions, worksheets library, tutor document portal, or general file-storage service in V1.**
- Store brand/logo/static assets in `public/`. Use initials avatars or other approved static options rather than setting up user uploads by default.
- If a real approved upload feature is later added, document its purpose, authorization, storage provider, retention/deletion rules, content-type/size limits, malware handling, and secure delivery. **Do not store large binary files inside PostgreSQL.**
- Delete or retain personal data only under an approved lawful policy; backups, support cases, and financial records may have different requirements.

---

## File Organization

The following structure is **recommended** by `architecture.md` and `AGENTS.md`. Follow an existing compatible repo layout rather than reorganizing working files without need.

```text
learli/
├── architecture.md             # System and infrastructure blueprint
├── PRD.md                      # Requirements and acceptance criteria
├── AGENTS.md                   # Agent workflow and constraints
├── PROJECT-OVERVIEW.md         # Short product overview
├── CODE-STANDARDS.md           # This file
├── README.md                   # Install/run/deploy entry point
├── .env.example                # Variable names and placeholders only
├── drizzle.config.ts           # Migration configuration
├── drizzle/                    # Versioned SQL migrations
├── public/                     # Public brand/static assets (no learner uploads)
├── src/
│   ├── app/
│   │   ├── (marketing)/        # Public homepage, subjects, tutor search/profiles
│   │   ├── (auth)/             # Sign up, sign in, verification, recovery
│   │   ├── (dashboard)/        # Authorized student/parent/tutor/admin screens
│   │   └── api/                # Better Auth, health, future approved webhooks
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── shared/             # Shared presentational components
│   ├── features/
│   │   ├── tutors/             # Tutor profile, approval, subjects
│   │   ├── subjects/           # Real offered subject catalog
│   │   ├── matching/           # Deterministic tutor selection rules
│   │   ├── learners/           # Learner + guardian relationships
│   │   ├── bookings/           # Scheduling, booking service, status transitions
│   │   ├── support/            # Reports, basic case handling
│   │   └── payments/           # Add implementation only after approval
│   ├── lib/
│   │   ├── auth.ts             # Better Auth server configuration
│   │   ├── auth-client.ts      # Browser-safe auth client
│   │   ├── db/                 # Neon/Drizzle client, schemas, queries
│   │   ├── permissions/        # Server-side role + ownership guards
│   │   ├── validation/         # Shared boundary validation schemas
│   │   ├── time/               # Timezone, DST, recurring-slot utilities
│   │   └── email/              # Resend adapter and safe templates
│   └── types/                  # Types truly shared across modules
├── tests/
│   ├── unit/                   # Pure rules and validation
│   ├── integration/            # DB/auth/transaction boundary tests
│   └── e2e/                    # Real user-journey tests
└── docs/
    ├── decisions/              # Approved architecture/business decisions
    └── operations/             # Deploy, recovery and incident instructions
```

**Organization rules:**

- Put domain-specific data access, schemas, and services close to their owning feature as suitable; avoid circular imports.
- Prefer feature-owned components to an enormous generic `components/` folder; move to `shared/` only when actually reused.
- Keep global providers and app shell in the appropriate Next.js layout; don't add global state libraries for isolated page state without need.
- Do not put runtime secrets, generated private documents, database dumps, student profiles, or temporary credentials under `public/` or in Git.
- Use explicit server/client module boundaries. Don't re-export a server-only module from an index file used by client components.

---

## Authentication, Authorization, and Learner Safety

- Use **Better Auth** with its supported Next.js and Drizzle integration. Password reset, verified email, session expiry, and logout must follow the selected library version's documented security model.
- Use **trusted server-side roles**: `admin`, `tutor`, `student`, `parent`. A user may have legitimate multiple roles; roles are not editable through ordinary account form fields.
- **Authorize every record**, not just the URL: parent↔learner link, tutor ownership, booking participants, admin action scope, eligibility/approval, and suspended-account limits.
- Keep child profiles private and collect only necessary information. Guardian consent/age and tutor-screening policies must be approved for the launch markets before real minor participation.
- Do not implement direct student–tutor messaging, recording, or public child profiles as shortcuts.
- Provide a clear report/support flow with a real human escalation owner before public launch; recording a report with no response process is insufficient.
- Use secure HTTP-only session cookies, HTTPS in production, supported CSRF/trusted-origin controls, reasonable anti-abuse protections, and admin MFA when feasible before production handling of real users.
- Never leak session secrets, reset tokens, raw student data, or meeting URLs through public errors, metadata, analytics, or logs.

**Authorization test rule:** For every protected feature, include a success case for the permitted actor and failure cases for a different account, wrong guardian, unrelated tutor, or unauthenticated caller as relevant.

---

## Booking, Zoom/Google Meet, and Notifications

### External meeting links

- Tutors use their own **Zoom or Google Meet** accounts. Learli never hosts, records, or streams lessons in V1.
- Validate submitted URLs through a real URL parser: require `https:` and the **approved legitimate Zoom/Meet hostname patterns**; do not accept misleading substrings such as `meet.google.com.evil.example`.
- Treat stored meeting links as **private booking data**. Reveal only to the tutor and authorized learner/guardian or legitimate support staff, according to approved session rules.
- Missing links are a truthful missing-link state, not a fabricated room. Do not reveal links in public tutor profile pages, logs, search previews, or open graph metadata.
- Do not claim that Learli automatically verified attendance, conducted a lesson, or monitored the Zoom/Meet room.

### Transactional email

- Use **Resend** for account and booking-related transactional messages as approved. Keep email delivery behind a focused adapter.
- Development uses Resend's permitted testing behavior. General-user production sending requires a **verified sender domain** and tested delivery; a Railway-generated app URL is not a substitute for that sender domain.
- Do not embed child-sensitive details or private joining credentials in unnecessary email fields, previews, or logs. If a message requires a link, scope it to the authorized recipient and approved product behavior.
- After successful database state changes, handle outgoing email failures explicitly and safely. Avoid duplicate sends on retries; add a simple durable dispatch/retry approach if operational needs justify it.
- Monitor provider quotas and errors; do not assume the free tier is limitless.

---

## Payments and Other Unapproved Business Rules

**Stop before implementing real commerce.** The following remain **`[OPEN]`/`[GATED]`**: payment collector, provider, local/international merchant eligibility, session price, tutor price control, subscription vs per-booking, commission and payouts, currencies/taxes, paid vs free trial, hold duration, confirmation/cancellation/no-show/refund/chargeback policy.

- You may build **provider-independent UI skeletons or simulated development-only flows** when a task requires them, clearly labeled as not live.
- Never choose a gateway, take a real charge, send a real payout, or present a payment-success screen as proof of settlement without an approved business decision.
- When approved, use the provider's documented checkout/webhook integration, **verify webhook authenticity server-side**, handle duplicate/out-of-order delivery idempotently, and reconcile provider events with recorded state.
- Amounts, currencies, commissions, and paid status always originate from verified server/provider truth; never from browser-calculated totals.
- Require explicit authorization before any production charge/refund/payout, live key change, or destructive financial operation.
- Record approved policy decisions in `docs/decisions/` and update `PRD.md`/`architecture.md` before implementing behavior that depends on them.

---

## Configuration, Environments, and Railway Deployment

- Maintain **local/dev, recommended staging, and production separation** with separate Neon data and provider credentials. Do not copy real student data into test fixtures.
- Keep secrets in local `.env.local` (gitignored) or Railway environment variables. Commit only safe placeholder names in `.env.example`.
- Example server-only keys (not necessarily all used on day one): `DATABASE_URL`, `DATABASE_URL_DIRECT` if required, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.
- Only explicitly safe public configuration may use the `NEXT_PUBLIC_` prefix. Never place database, auth, Resend, or eventual payment secrets there.
- Deploy one **Next.js Node application on Railway** with **Neon** as the external database. Do not accidentally provision a second Railway PostgreSQL service.
- Railway's assigned `*.up.railway.app` URL is valid for development/pilot access; verify the deployed origin in Better Auth/trusted-origin and callback settings. A custom product domain can be attached later.
- Test migrations on an isolated database before production. Do not auto-run irreversible schema changes as a side effect of every server start.
- Use health checks that do not expose customer data or secrets. Verify start/build settings, HTTPS, error visibility, and basic rollback approach on the actual deployed app.
- Set usage alerts and monitor Railway CPU/RAM/network bills, Neon storage/connections, Resend quotas, and other provider charges. A low-cost hosting tier is **not a guaranteed fixed total bill**.
- Backup and restore procedures must be verified before a public paid launch; do not assume a backup exists merely because the provider has a backup feature.

---

## Testing and Quality Gates

### Recommended tools (choose/confirm when repository is initialized)

- **Type check:** TypeScript compiler (`tsc --noEmit`) or established repo script.
- **Lint/format:** Next.js-compatible ESLint rules and one consistent formatter, if configured.
- **Unit/component:** Vitest + React Testing Library or equivalent.
- **Integration:** Tests against an **isolated real PostgreSQL** database for booking constraints, joins, transactions, and permissions.
- **End-to-end:** Playwright or equivalent for role-based booking journeys and responsive UI.

These are tool recommendations, not claims that the repo already contains these scripts or packages. Prefer the existing compatible tooling when implementation begins.

### Required tests by area

| Area | Minimum checks |
|---|---|
| Catalog and matching | Real approved tutors only; correct subjects/levels; honest empty state. |
| Auth and roles | Cannot self-assign admin/tutor approval; verified session behavior; cross-account denial. |
| Parent/learner | Guardian link verified; Parent A cannot view/book for Parent B's learner; eligible independent learner path. |
| Tutor | Tutor A cannot edit Tutor B's profile, availability, or booking details. |
| Booking | Real availability; **concurrent** overlap prevention; retry/idempotency; valid transitions and safe history. |
| Time zones | Local↔UTC conversions, DST boundary, midnight crossover, timezone changes after booking. |
| External meeting | Safe URL validation; private participant-only access; missing-link state. |
| Email | Correct recipient/template; failure does not corrupt booking; duplicate delivery avoided where appropriate. |
| Reviews/support | No review without eligible booking; safety case access restricted when those flows are enabled. |
| Payments (only after approval) | Verified webhook, duplicate/out-of-order events, server-authoritative amounts, failure and reconciliation. |
| UX | Keyboard access, mobile layout, error/loading/empty states, privacy-safe SEO/caching. |

### Before merging or delivering work

1. Review changed code for scope drift, accidental secrets, inappropriate logging, and destructive changes.
2. Run **the checks actually configured** for the affected feature: lint, typecheck, tests, and production build where applicable.
3. Add unit tests for domain logic and integration tests for permission, scheduling, booking consistency, and any new database constraints.
4. Inspect database migration output and make sure tests are isolated from production.
5. Manually validate the changed end-to-end flow on a narrow viewport and a desktop viewport when UI behavior changed.
6. Report exact commands and pass/fail results; mark unexecuted checks as **not run** rather than assuming success.

**Never call a feature “done” because it looks polished if security, booking correctness, or required launch policies are missing.**

---

## Git, Change Control, and Code Reviews

- Work in scoped branches and create reviewable commits. Follow the repository's actual branch policy (a `feature/<topic>` convention is recommended, not assumed).
- Avoid unrelated refactors, sweeping rewrites, dependency churn, and format-only edits mixed with business features.
- Describe notable data migrations, environment changes, and irreversible effects in the PR/task handoff.
- Do not deploy, merge, modify production environment variables, change live payment settings, run destructive migrations, or delete production data without explicit authorization.
- For material changes to architecture or `[OPEN]` decisions, create a short `docs/decisions/` record describing **decision, rationale, alternatives, risks, and approval**; update the governing docs as needed.
- Before committing, verify `.gitignore` excludes `.env.local`, local dumps, temporary credentials, and generated private data.

---

## Definition of Done (DoD)

A Learli change is **complete** only when all applicable conditions are met:

- [ ] It satisfies the specific `PRD.md` acceptance criteria and preserves the agreed marketplace-only scope.
- [ ] Client and server logic are separated appropriately; server-side validation and record-level authorization are enforced.
- [ ] Database changes use reviewed migrations and preserve data integrity.
- [ ] Scheduling and booking logic remains concurrency-safe and timezone-correct.
- [ ] Error, loading, empty, disabled, and unauthorized states are handled honestly.
- [ ] No sensitive student/account/meeting/payment data leaks to public pages, logs, or client bundles.
- [ ] Relevant automated and manual checks have **actually** been run; failures and limitations are reported.
- [ ] User-facing changes work on mobile and desktop with accessible interactions.
- [ ] Any affected docs, environment examples, tests, and decision records are updated.
- [ ] No unapproved payment rules, LMS features, video infrastructure, or tutor-management expansion was introduced.
- [ ] Deployment and production writes happened **only if explicitly requested and authorized**.

### Required agent/developer handoff

```text
Changed:
- <what was implemented, briefly>

Verified:
- <actual commands and pass/fail results>

Open decisions / risks:
- <any unapproved behavior, limitation, or test not run>

Deployment:
- <not deployed, or the verified deployed environment if authorized>
```

**Final rule:** Build a small, trustworthy tutoring marketplace. Prefer correct permissions, reliable bookings, clear code, and a smooth user journey over additional features.
