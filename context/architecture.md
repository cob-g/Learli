# Learli — System Architecture

> **Product:** Learli (`learli` in the visual identity)  
> **Document type:** System Architecture / Technical Blueprint  
> **Version:** 1.0 — Initial MVP architecture  
> **Updated:** 2026-10-11
> **Status:** Approved technology direction; several business decisions remain open  
> **Intended audience:** Founders, beginner developers, and implementation assistants

---

## 0. How to read this document

This is the technical source of truth for the **initial version of Learli**. Read sections 1–6 to understand the product, sections 7–15 to understand how to build it, and sections 16–20 before deploying or launching.

The tags below matter:

- **[AGREED]** — confirmed in our planning conversations. Build around this assumption.
- **[RECOMMENDED]** — a practical technical choice proposed here, but changeable after a justified review.
- **[OPEN]** — unresolved. **Do not assume a policy, price, provider, or behavior is final.**
- **[LATER]** — intentionally outside the first launch, even if mentioned in the older CalcStream proposal.

**Important distinction:** This is an *architecture document*, not a promise that the product has been built or that a specific provider/plan has already been purchased.

### Quick glossary for beginners

| Term | Meaning in Learli |
|---|---|
| Frontend | Pages and interactions that students, parents, tutors, and admins see. |
| Backend | Server-side code that checks permissions, handles bookings, and stores data. |
| Full-stack | Frontend and backend can live within one Next.js project. |
| Database | Organized records such as users, tutors, schedules, and bookings. |
| ORM | A TypeScript interface for safely querying the SQL database (Drizzle). |
| Authentication | Proving who a user is (sign-in, sessions, password reset). |
| Authorization | Deciding what that signed-in user is allowed to access or change. |
| API | Server endpoints that receive requests and return structured results. |
| Webhook | A verified event sent by an external provider (e.g., successful payment). |
| Migration | A reviewed change to database structure, committed with the code. |
| UTC / IANA time zone | Reliable ways of storing and displaying dates across countries. |
| MVP | The smallest usable product that delivers the core business experience safely. |

---

## 1. Product definition and boundaries

### 1.1 What Learli is [AGREED]

**Learli is an online tutoring marketplace and booking intermediary.** It connects students and parents to suitable tutors, makes tutor discovery and scheduling simpler, and provides a place to manage bookings and their payment status.

**Plain-language summary:**

> Find a tutor → review their profile → choose a time → book → attend a lesson in Zoom/Google Meet.

Tutors independently deliver their lessons. **Learli does not deliver the classroom itself.** It is not intended to replicate Google Classroom, Canvas, or a school management system.

### 1.2 Who the platform serves [AGREED]

- **Elementary learners** (with an appropriate parent/guardian relationship).
- **Middle-school learners** (with an appropriate parent/guardian relationship).
- **High-school learners** (with an appropriate parent/guardian relationship).
- **College learners** (who may independently manage their accounts if legally permitted).
- **Tutors** who offer academic instruction.
- **Parents/guardians** who book and manage tutoring for learners.
- **Learli administrators** who operate accounts, bookings, basic support, and safety processes.

Age-related enrollment/consent rules depend on operating markets and must be finalized before a public launch (see §17).

### 1.3 Launch learning categories [AGREED]

**Academic core:** Mathematics, Science, English.

**High-demand support:** SAT/ACT and other entrance examinations, homework help, and study skills.

**Specialized subjects:** Keep this category, including relevant college-level subjects, **but only list subjects the available tutors genuinely offer**. Do not claim an unlimited global subject catalog.

**Not a promise:** Global curriculum certification or a worldwide curriculum engine. Tutors can describe the curricula, examinations, and school material they can support.

### 1.4 V1 promise

- A clear website that explains the service.
- Discoverable, understandable tutor profiles.
- Guided tutor matching **and/or** self-serve browsing.
- Availability, bookings, time zones, and meeting links.
- Simple parent/learner/tutor booking dashboards.
- Transactional email notifications.
- Basic payment-related records and checkout **only when the payment model is approved**.
- Account safety, reporting, and minimal administration.

### 1.5 Explicitly *not* Learli V1 [AGREED]

Do **not** build these unless the founders approve a scope change:

- Student assignment uploads or homework submission portals.
- Learning content repositories, an LMS, grading, quizzes, or a curriculum engine.
- Mandatory post-lesson teaching reports or elaborate learning analytics.
- AI tutoring or AI avatar classrooms.
- A custom video call system, recording, video streaming, or digital whiteboards.
- In-app tutor/student chat or social feeds.
- Advanced tutor performance management, mandatory teaching templates, or content audits.
- Small-group class infrastructure.
- Mobile apps (design for them, but launch on responsive web).
- Microservices, Redis, Kafka, Kubernetes, a search cluster, or a large event architecture.

**Clarification:** The previous CalcStream business proposal included richer academic progress tracking. The **newest Learli decision supersedes it for V1**: the product is the *medium for tutoring*, not the place where lessons and assignments are managed.

---

## 2. Architecture principles

1. **One codebase and one deployable application.** Start with a modular Next.js monolith.
2. **Business rules live on the server.** A button or hidden frontend component is not a permission system.
3. **PostgreSQL is the single source of truth.** Never trust the browser for booking, price, or payment status.
4. **Limit services and bills.** Prefer existing provider tiers, but confirm limits before launch.
5. **Support international time zones correctly from day one.** Never assume Philippine time for all users.
6. **Protect minors by design.** Collect the minimum necessary information and preserve guardian control where required.
7. **Make booking and money operations idempotent.** Network retries must not create duplicate bookings or charges.
8. **Mobile-ready contracts.** Separate business logic from Next.js page code, so future mobile clients can reuse it through authenticated APIs.
9. **Use boring technology first.** Add Redis, search engines, workers, and more instances only when measurements justify them.
10. **No speculative features.** Changes to the MVP scope require a business decision before architecture expansion.

---

## 3. Agreed technology stack

| Layer | Choice | Role | Status |
|---|---|---|---|
| Web framework | **Next.js App Router** | Full-stack website, server rendering, server actions, API handlers | [AGREED] |
| UI framework | **React + TypeScript** | Interactive UI; shared types throughout the app | [AGREED] |
| UI styling | **Tailwind CSS** | Responsive and accessible styling | [AGREED] |
| UI components | **shadcn/ui** | Reusable components, forms, dialogs | [AGREED] |
| Database | **Neon PostgreSQL** | Users, tutor profiles, bookings, payment metadata | [AGREED] |
| ORM / migrations | **Drizzle ORM + Drizzle Kit** | SQL schema, typed queries, controlled migrations | [AGREED] |
| Authentication | **Better Auth** | Sign-up, login, sessions, verified email, password reset | [AGREED] |
| Authorization | Application RBAC + ownership checks | Restrict admin, tutor, student, parent operations | [AGREED] |
| App hosting | **Railway** | Deploy and run the Next.js Node server | [AGREED] |
| Transactional email | **Resend (start on Free tier)** | Verification, password resets, booking email | [AGREED] |
| Live lessons | **Zoom / Google Meet** | Audio, video, screen sharing outside Learli | [AGREED] |
| Object/file storage | **None required initially** | Default avatars and text records are enough for V1 | [AGREED] |
| File storage if later needed | Neon Object Storage | Optional future tutor photos/documents; re-check availability/pricing | [LATER] |
| Payment processor | **Not selected** | Secure checkout and payments | [OPEN] |
| Checkout model | Learli-mediated vs tutor-direct | Business and legal settlement flow | [OPEN] |
| Currency / pricing | Not selected | Sessions, packages, commissions, fees | [OPEN] |
| Error monitoring | Railway logs at first; Sentry if needed | Diagnose errors without logging student data | [RECOMMENDED] |
| DNS / custom domain | Railway-generated domain initially; purchased custom domain later | URL, branding, production email identity | [AGREED] |

### Local M2 implementation mode — 2026-10-11

The owner explicitly requested local-only M2. For this phase use an isolated,
repository-owned PostgreSQL 17 cluster on loopback with separate dev/test databases,
Drizzle's node-postgres driver, and a private local email capture adapter. Neon,
Resend and Railway remain the hosted targets, but are not contacted. Local auth
accepts synthetic `.test` identities, starts with no assigned roles, and is gated
off for staging/production. See `docs/decisions/2026-10-11-local-m2.md` (repository
root) and the M2 blueprint. This is a local development exception, not a change of
hosted provider or approval for real-user onboarding.

### Local M3.1–M3.3 implementation note — 2026-10-11

`subjects`, `tutor_profiles` and `tutor_subjects` now exist as reviewed local
migrations, following §9.2 with these recorded differences: no
`meeting_provider_preference` column yet; teaching languages now use an optional
normalized relation (see §9.2); `slug` was
added with the public pages and is set once at creation; `teaching_background` added per build-plan M3.2;
`tutor_profiles.user_id` is `ON DELETE RESTRICT`; `audit_events` gained
`target_subject_id` and tutor/subject actions. `listEligibleTutors` in
`src/features/tutors/eligibility.ts` is the single public-eligibility query. The
public directory, tutor page, subjects page and home page read tutors only
through it, and guided matching (`src/features/matching/match.ts`) applies the
directory's own filter to the same result; booking must do the same. By owner decision an approved tutor's
edit needs no re-review and a rejected tutor may submit again
(`docs/decisions/2026-10-11-tutor-profile-edits.md`). A verified account obtains
the `tutor` role itself from `/become-a-tutor`; the runtime grants it only through
the `grant_tutor_role` function, which can add no other role
(`docs/decisions/2026-10-11-tutor-role-self-service.md`). Tutor screening policy
remains undecided. See `prompts/features/m3-01-tutor-catalog-foundation.md`.

### Why Next.js, not Laravel?

Next.js lets the first Learli team build the site, data fetching, forms, protected actions, and API routes with TypeScript in **one repository**. A separate Laravel backend is unnecessary for this particular MVP.

### Why Neon, not a database on Railway?

Neon was selected as the managed PostgreSQL provider. Hosting the app on Railway does **not** require putting its database on Railway. The app connects securely to Neon using a **server-side database connection string**.

### What about React vs Next.js?

React is already the frontend library used by Next.js. There is **no separate React deployment** and no extra Vite single-page app to maintain.

### Versions

Use stable, maintained releases that work together at implementation time. **Pin the Node.js version, package lockfile, and deployed dependencies** after testing. Do not blindly paste a framework version from this document into a future deployment.

---

## 4. Overall system diagram

```text
                              LEARLI WEB USERS
                   Visitor | Parent | Student | Tutor | Admin
                                        |
                              Browser (HTTPS)
                                        |
                                        v
                            RAILWAY: NEXT.JS APP
                 +-------------------------------------+
                 | React Pages / Server Components      |
                 | Forms / Server Actions               |
                 | Route Handlers (API + webhooks)       |
                 | Better Auth + RBAC checks            |
                 | Business services:                  |
                 |   Tutor Search & Matching            |
                 |   Availability & Booking             |
                 |   Parents & Learners                 |
                 |   Payments (when finalized)          |
                 +-------------------------------------+
                       |            |           |
                       v            v           v
                  DRIZZLE ORM     RESEND     PAYMENT PROVIDER
                       |          Email        [OPEN]
                       v
                  NEON POSTGRESQL
                  Accounts / Tutors / Subjects
                  Guardians / Availability / Bookings
                  Reviews / Support / Payment references

                A confirmed booking exposes the correct private
                Zoom/Google Meet joining information to attendees.
                Learli does not carry the actual video traffic.
```

### What happens during a normal page request?

1. The user opens a public or signed-in Learli URL.
2. Railway serves the Next.js application over HTTPS.
3. A server component or route handler checks the session if the page is private.
4. Server-side business logic requests authorized records from Neon through Drizzle.
5. Next.js renders the page and returns only the data that user may see.
6. Client-side React handles interactions; writes go through validated server actions or route handlers.

### What happens during a write (e.g., booking)?

1. Client submits selected tutor, learner, subject, and time.
2. Server validates inputs and real permissions.
3. Server checks the tutor's availability and competing bookings.
4. An atomic database operation creates the correct booking status.
5. Payment authorization/confirmation is handled according to the **approved payment model**.
6. The booking is shown as *confirmed only when all required conditions are met*.
7. Learli sends an email notification, and the learner/parent and tutor can see it on their dashboards.

---

## 5. Roles and permissions

One person may eventually have multiple legitimate roles (e.g., tutor and parent). For that reason, **[RECOMMENDED] store app roles in a small `user_roles` relation**, rather than trusting a browser-provided role string.

| Action | Visitor | Student | Parent | Tutor | Admin |
|---|---:|---:|---:|---:|---:|
| View public tutor profiles | Yes | Yes | Yes | Yes | Yes |
| Search tutors/subjects | Yes | Yes | Yes | Yes | Yes |
| Book for self | No | If eligible | No | No | Support only |
| Book for linked learner | No | No | Yes | No | Support only |
| See own / linked bookings | No | Own | Linked learners | Assigned lessons | Support scope |
| Manage own tutor profile | No | No | No | Yes | Basic moderation |
| Set own tutor availability | No | No | No | Yes | Support only |
| Change another tutor's schedule | No | No | No | No | Restricted, audited |
| Access internal support tools | No | No | No | No | Yes |
| See all users' private data | No | No | No | No | **Not by default**; legitimate support scope only |

**Rules:**

- A student must never see another student's private booking.
- A tutor sees only the necessary details for their assigned lessons.
- A parent sees only learners they are **verified or authorized** to manage.
- An admin role must not bypass logging, privacy, or consent requirements.
- The client cannot self-select `admin` or mark a tutor `approved` during registration.
- A user whose account is suspended must not book, teach, or access restricted sessions.

### Safety baseline is not “advanced tutor management”

We are **not** building elaborate tutor coaching/performance management. But before allowing adults to tutor minors through the platform, the business still needs appropriate **identity/qualification review, safe communication rules, a reporting path, and incident response**. These are launch safeguards, not optional marketplace analytics.

---

## 6. Main user journeys (end to end)

### 6.1 Visitor discovers a tutor

1. Open homepage.
2. Choose **Math**, **Science**, **English**, **Test Preparation**, **Homework Help**, **Study Skills**, or available **Specialized Subjects**.
3. Optionally filter by education level, time availability, teaching language, and supported topic.
4. See public tutor cards showing name/display name, introduction, subjects, level, and relevant availability.
5. Open a tutor profile.
6. Select **Book a Lesson** or **Get Matched**.
7. If not signed in, Learli asks them to sign in/create an account **without losing their selection**.

**No assignment upload is needed for any step.**

### 6.2 Parent books for a child

1. Parent creates an account and verifies email.
2. Parent adds a learner profile with **minimal necessary fields** (e.g., display name and school level).
3. Platform records and verifies/establishes the parent/guardian relationship as required by policy.
4. Parent browses tutors or answers a small matching questionnaire.
5. Parent selects a tutor, subject, and proposed available slot.
6. Learli confirms the slot is actually free at booking time.
7. Booking goes through the approved trial/payment process.
8. After confirmation, the parent can view the meeting link and booking details.
9. The tutor independently teaches on Zoom or Google Meet.
10. Parent sees booking status, date, time, tutor, and receipts/payment history when applicable.

**Parent dashboard = coordination dashboard, not an academic grading dashboard.**

### 6.3 College student books independently

1. Eligible college student signs up and verifies email.
2. Creates/maintains their own learner profile.
3. Selects a specialized or core subject and an appropriate tutor.
4. Completes booking and payment flow.
5. Joins external lesson and later sees booking history.

A college student should **not** be forced to have a parent account when legally able to manage their own learning and billing.

### 6.4 Tutor joins the platform

1. Tutor registers, verifies email, and provides a basic public profile.
2. Selects subjects, specialized topics, and grade/college levels offered.
3. Sets teaching time zone, recurring availability, and any schedule exceptions needed.
4. Supplies a Zoom or Google Meet join link **through a protected, validated form** when a booking requires it.
5. Tutor becomes publicly bookable only after the platform's required basic safety/account review is complete.
6. Sees upcoming and past sessions; updates their own availability.
7. Independently prepares and teaches the lesson outside Learli.

No mandatory lesson plans, homework uploads, grades, or performance dashboards.

### 6.5 Guided matching (simple version)

**V1 matching should be rule-based, not AI-based.** For example:

1. Ask for subject/topic, learner level, time zone, and preferred time.
2. Filter tutors who actually teach that subject and level.
3. Exclude unavailable or unapproved tutors.
4. Rank remaining tutors by availability fit and simple criteria that users can understand.
5. Show a short set of tutor recommendations and allow browsing alternatives.
6. If none match, show a truthful empty state and a contact/support option.

Do not claim the platform “found three matches” if there are fewer than three legitimate results.

### 6.6 Booking confirmation and lesson delivery

```text
Select time
   |
Server verifies tutor + learner + time
   |
Create provisional booking / reservation
   |
Apply agreed trial or payment policy  <-- [OPEN]
   |
Payment/conditions confirmed?
   +-- No --> Booking remains pending/expires/fails; slot is released
   |
  Yes
   |
Confirmed booking with restricted meeting-link access
   |
Email + dashboards
   |
Zoom/Google Meet lesson takes place outside Learli
   |
Session marked completed/cancelled/no-show as appropriate
```

A tutor and learner can be in different countries. Each should see their **local time and explicit time-zone abbreviation/offset**, especially near daylight saving changes.

### 6.7 Cancellation/rescheduling

- Users see the cancellation/rescheduling policy **before confirming a booking**.
- Changing a slot must re-check availability and prevent double booking.
- Refunds, credits, no-show fees, and cutoff windows are **[OPEN] business policies**.
- Preserve booking/event history for operational accountability.
- Send the appropriate notice to affected parties once the change is committed.

### 6.8 Reviews and safety reports

- Users may review a **completed and eligible booking**; block fabricated reviews from visitors who never booked.
- Keep reviews separate from abuse/support reporting.
- Provide an easily accessible method to report unsafe behavior or an incorrect booking.
- Escalate safety-related reports for manual admin follow-up. Do not build a complex automated moderation platform for V1.

---

## 7. Website pages and navigation

### Public website

| Example route | Screen |
|---|---|
| `/` | Homepage, value proposition, clear tutor search/CTA |
| `/subjects` | Available subjects and support categories |
| `/tutors` | Search results and basic filters |
| `/tutors/[slug]` | Public tutor profile (only approved public fields) |
| `/get-matched` | Small guided questionnaire |
| `/how-it-works` | Parent/student/tutor process explanation |
| `/become-a-tutor` | Tutor sign-up / application introduction |
| `/pricing` | **Only when pricing rules are approved** |
| `/privacy`, `/terms`, `/cancellations` | Required public policies |
| `/sign-in`, `/sign-up` | Authentication |

### Signed-in dashboards

| Example route | Who | Minimum features |
|---|---|---|
| `/student` | Learner | Own bookings, tutor links, account information |
| `/parent` | Parent | Linked learners, bookings, statuses, basic payments |
| `/tutor` | Tutor | Profile, subjects, availability, bookings, meeting links |
| `/admin` | Admin | Safe account review, bookings, subject catalog, reports/support |

> **Design note:** Routes are examples, not a mandate for four independent frontend applications. They can share the same components, authentication, design tokens, and server-side modules.

### UI principles

- **Mobile-first responsive** design: phone, tablet, desktop.
- Accessible form labels, keyboard navigation, screen-reader support, contrast, and readable error messages.
- Modern, clean visual identity: lowercase `learli`, rounded friendly UI, navy/teal direction.
- Public pages should be SEO-friendly with meaningful metadata.
- Dashboards and private data should not be indexed or accidentally cached for other users.
- Never display a student's private information or a meeting URL on a public tutor profile.

---

## 8. Recommended application structure

**One repository; domain modules inside it.** Do not create microservices or a monorepo unless a real second application is added.

```text
learli/
├── architecture.md
├── README.md
├── package.json
├── package-lock.json
├── next.config.ts
├── drizzle.config.ts
├── .env.example              # example keys ONLY, never secrets
├── .gitignore
├── drizzle/                  # reviewed SQL migrations
├── public/                   # static brand assets, not user uploads
├── src/
│   ├── app/
│   │   ├── (marketing)/      # public-facing pages
│   │   │   ├── page.tsx
│   │   │   ├── subjects/
│   │   │   └── tutors/
│   │   ├── (auth)/           # sign-in and sign-up pages
│   │   ├── (dashboard)/      # parent/student/tutor/admin pages
│   │   └── api/
│   │       ├── auth/[...all]/route.ts
│   │       ├── health/route.ts
│   │       └── webhooks/     # only when providers are chosen
│   ├── components/
│   │   ├── ui/               # shadcn/ui building blocks
│   │   └── shared/           # reusable presentation pieces
│   ├── features/
│   │   ├── tutors/
│   │   ├── subjects/
│   │   ├── matching/
│   │   ├── learners/
│   │   ├── bookings/
│   │   ├── payments/         # implement AFTER business decisions
│   │   └── support/
│   ├── lib/
│   │   ├── auth.ts           # Better Auth config (server-only)
│   │   ├── auth-client.ts
│   │   ├── db/
│   │   │   ├── index.ts      # Neon/Drizzle connection
│   │   │   └── schema/       # Auth + application tables
│   │   ├── email/
│   │   ├── permissions/
│   │   ├── validation/
│   │   └── time/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── decisions/           # short architecture/business decisions
    └── operations/          # deploy/backup/incident instructions
```

### Layering rules

**Pages/components:** render UI, collect user input, and display results. Avoid raw SQL here.

**Server action / route handler:** authenticate, validate, authorize, call a domain service, return safe data.

**Domain service (e.g., `bookings`):** enforce business rules such as double-booking prevention, who may book for whom, and legal status transitions.

**Database access:** Drizzle queries and transactions. No direct database connection from the browser.

**External provider adapters:** Resend, Zoom/Meet link handling, future checkout provider. Keep provider-specific code away from domain rules.

### Example request boundary

```text
Book button (client)
    -> server action / POST handler
        -> validate form with Zod
        -> validate Better Auth session
        -> authorize parent or learner
        -> bookings.create(...)
             -> atomic availability check + database write
        -> return safe booking summary
```

Don't rely on a hidden UI element, `proxy.ts`, or a role passed in the request body to secure privileged actions. **Every protected read and write must authorize on the server.**

---

## 9. Database design — proposed MVP ERD

Use PostgreSQL for **structured records**, not for general-purpose file storage. The table names below are a **starting model** to refine into a reviewed ERD before writing migrations.

**Current local implementation:** identity, roles/access/audit, subject catalog,
tutor profiles/subjects, weekly availability and synthetic learner/guardian tables
are implemented. The combined migration chain adds availability as `0006` and
learners as `0007`; local implementation notes below distinguish these from the
remaining proposed review/payment and live-booking entities. The five-feature
integration merged locally at `a169f61` adds demo booking/time off0008–0009,
optional languages0010 and corrected support0011. Baseline0007 upgrades and
fresh migration checks passed in isolated databases. Source-branch databases
with conflicting histories were stopped and privately archived before worktree
cleanup; main's existing database was not migrated as part of the Git merge.

### 9.1 Identity and roles

**Better Auth-owned tables** (names/schema according to the installed version): users, sessions, linked accounts, verification records. Let Better Auth generate its required schema; don't independently recreate competing auth tables.

**`user_roles`** [RECOMMENDED]

- `user_id` → Better Auth user ID.
- `role` → one of `admin`, `tutor`, `student`, `parent`.
- Unique combination (`user_id`, `role`).
- Assign/update from trusted server/admin logic, never public form input alone.

### 9.2 Tutors and supported subjects

**`tutor_profiles`**

- `id`, `user_id` (unique).
- `slug` (unique and public, no private ID disclosure required).
- `headline`, `bio`, `teaching_languages`, `timezone` (IANA identifier).
- `review_status` (`pending`, `approved`, `rejected`, `suspended`).
- Optional `meeting_provider_preference` (`zoom`, `google_meet`).
- `created_at`, `updated_at`.

**`subjects`**

- `id`, `name`, `slug` (unique), `category`, `is_active`.
- Categories may be academic core / test prep / academic support / specialized.

**`tutor_subjects`**

- `tutor_id`, `subject_id`, supported learner levels, optional specialty description.
- Unique pair (`tutor_id`, `subject_id`) unless a justified level-specific design replaces it.

### Local M3.2 / M3.5 teaching-language implementation — 2026-10-11

`tutor_teaching_languages` stores optional tutor declarations as a tutor FK plus
the bounded `teaching_language_code` enum, with a composite primary key. It
replaces the proposed `tutor_profiles.teaching_languages` field; no existing
profile is inferred/backfilled or made ineligible for missing languages. Exact
unique code arrays are validated in the owner profile service and replaced in
the existing locked transaction. Omitted fields preserve declarations; [] clears.
Public eligibility reads include the complete set in the same SQL statement;
the directory composes language with its subject/level filters. English display
labels originate in `src/features/tutors/teaching-languages.ts`, not free text.
Public copy identifies tutor declarations and makes no proficiency verification
claim. See `docs/decisions/2026-10-11-teaching-languages.md` for the coordinator's
delegated catalogue choice. This remains local synthetic development.

### 9.3 Learners and guardians

**`learner_profiles`**

- `id`, optional `user_id` (if learner has their own login).
- Minimal display name, education level, timezone, and state (active/inactive).
- An adult/self-managed learner may own their own profile; a child profile can exist without a separate login.
- **Do not require a date of birth or school name by default.** Add sensitive fields only if legally/operationally required.

**`guardian_learner_links`**

- `guardian_user_id`, `learner_id`, relationship status and verified/authorized state.
- Unique pair (`guardian_user_id`, `learner_id`).
- Controls who can book, pay, and view a minor's schedule.

### Local M4.4 implementation note — 2026-10-11

The local synthetic slice adds `learner_profiles` and `guardian_learner_links`
under `src/lib/db/schema/learners.ts`. Display name, level and IANA time zone are
the only editable learner details. Fixture provenance, status, ownership and
relationships are owner-tooling controlled; runtime grants allow only SELECT and
column-limited profile UPDATE. A composite foreign key prevents guardian links
to self-managed profiles; self profiles require a unique user and College Support.
The server checks current account status, verification, trusted roles, active
profile and authorized link or exact self ownership on reads and writes. No admin
bypass exists. `scripts/seed-local-learners.ts` provisions synthetic records only
for identities owned by the existing private fixture manifest and preserves edits
and revoked links on rerun. Browser creation/linking is absent. This local
technical model is not an approved real-world age, consent or guardian policy;
real onboarding and booking remain gated. See `prompts/features/m4-04-learner-profiles.md`.

### 9.4 Tutor scheduling

**`tutor_availability`**

- `id`, `tutor_id`, day of week, local start/end time, IANA timezone, effective dates, active flag.
- Used to **calculate candidate slots**. Recurring local times must be translated to UTC for specific dates, respecting daylight saving changes.

**`tutor_availability_exceptions`** [RECOMMENDED when tutors need holidays/time off]

- `id`, `tutor_id`, UTC start/end, created_at. Local M4.3 collects no reason text.
- A tutor can mark exceptions without changing weekly patterns.

**Local M4.1 implementation — 2026-10-11:** weekly windows now use ISO weekdays
(1–7) and integer local start/end minutes, with explicit overnight ends above
1440 and a maximum span of 24 hours. `tutor_profiles.timezone` is the shared IANA
teaching zone; no per-window duplicate zone, effective dates or inactive rows yet.
`availability_version` and a locked profile row protect atomic whole-schedule
replacement from stale tabs. Overlapping recurring windows (including Sunday to
Monday) are rejected by the service; database checks enforce valid day/minute
bounds, FK ownership and duplicate prevention. This is not booking overlap protection.
Profile edits cannot change the zone while windows exist; the availability editor
saves zone and hours together, preserving wall-clock hours with an explicit warning.
Initial/profile-only zone changes increment the same revision. Pending/rejected
profiles can prepare hours without becoming public; suspended profiles cannot edit.
Reads and writes are owner-scoped. `readOwnAvailabilityIntervals` connects stored
windows to the existing UTC engine; public slots, busy-booking exclusion, time off
and actual bookings were later work at M4.1 completion. The 42-window request limit is a technical
bound, not a lesson duration or booking policy.

**Local M4.3 time-off integration — 2026-10-11:** dated owner-only periods store
finite UTC instants with duplicate prevention and no reason text. Add/remove,
shared revision and minimal audit event commit under the tutor profile lock.
IANA local input rejects ambiguous/nonexistent endpoints; stored intervals survive
teaching-zone edits. Effective weekly availability subtracts their union. The
128-period bound is technical, not retention or booking policy. The verified
standalone source was imported under coordinator authority; combined addition
rejects overlap with `demo_reserved` rows whose expiry is after current DB time,
before any exception/revision/audit write. No reservation is silently cancelled.
Real PostgreSQL tests must cover both lock acquisition orders, adjacent and
expired reservations and rollback preservation before claiming combined acceptance.

### 9.5 Bookings and attendance status

**Local simulation work — 2026-10-11:** M4.5–M4.8 introduces separate explicit
`demo_reserved` / `demo_expired` semantics, not the illustrative live states below.
UTC instants and actor-scoped request fingerprints stay immutable; minimal events
retain creation/expiry. GiST exclusion on half-open tutor intervals blocks only
`demo_reserved`; server transactions materialize elapsed expiry before inserts.
Booking/time-off share a tutor-row-first lock protocol and actual exception query.
READ COMMITTED statements after domain waits recheck current identity, trusted
roles, access and learner ownership. The tutor lock plus exclusion constraints
serialize overlapping reservations; an actor user-row NO KEY UPDATE lock bounds the technical
create quota across tutors. Creation and expiry history use the same captured
post-lock database clock as the mutation. Revocations committed before a fresh
authorization check deny the request; an already authorized in-flight request may
finish. Post-lock tutor and support checks use their transaction's connection,
without expanding role/access/link/capability write grants. The local
policy is coordinator-delegated (60-minute elapsed duration, 30-minute step,
60-minute notice, 14 days, 10-minute TTL), documented in
`docs/decisions/2026-10-11-local-synthetic-booking.md`. Real policy remains OPEN;
combined time-off acceptance requires the integrated guard and real database tests.

**Local M4.9 participant reads — 2026-10-11:** detail/history read services use one
current session/account/role/relationship SQL snapshot and acquire no domain row
locks or writes. Elapsed TTL projects `demo_expired`; persisted state and expiry
materialization remain distinct, and detail history contains actual stored events
only. Existing candidate-read/create expiry materialization retains tutor-first
locks and post-wait authorization unchanged. Viewer-local times use the current
account zone. Family learner selectors and active/history overview share the same
authorization/time snapshot; no generic admin access exists. The local runtime
gains SELECT only on the four booking-event columns, preserving append-only
history. A separate internal creation-notice recipient projection accepts committed
IDs on the notification owner's READ COMMITTED connection: only current eligible
creator or assigned approved tutor, actual creation event and live TTL; no learner
data, sessionless web route or notification delivery. The new private booking read
pages await authorized SSR content without automatic loading boundaries: browser
evidence showed those new boundaries left resolved HTML hidden without JavaScript.
Native GET works without scripts; hydrated GET uses a bounded booking URL through
client navigation to retain content and pending feedback. A keyed form aligns
learner/filter inputs on Back/Forward; enhanced links also report pending. This
applies to these new booking read
routes only; no global rendering change is claimed. See the M4.9 blueprint for
coordinator contract authority; real launch and confirmation policies remain gated.

**`bookings`**

- `id` (opaque UUID), `tutor_id`, `learner_id`, `booked_by_user_id`, `subject_id`.
- `start_at_utc`, `end_at_utc`, original displayed timezone for reference.
- `status`: `pending`, `awaiting_payment`, `confirmed`, `completed`, `cancelled`, `expired`, `no_show` (final state diagram/policy to be approved).
- Meeting provider and **restricted** meeting link, if present.
- Optional `payment_id` reference after payment design is chosen.
- Creation/update timestamps; cancellation metadata where justified.

**`booking_events`** [RECOMMENDED]

- `booking_id`, actor, prior/new status, timestamp, minimal event metadata.
- Helps investigate reschedules, cancellations, and disputed booking states.

### 9.6 Payments — schema reserved until decisions are made

**[OPEN]** Choose whether learners pay Learli, pay tutors directly, buy subscriptions, buy packages, or pay per lesson. **Do not finalize `payments`, `payouts`, `commissions`, or `subscriptions` table definitions until that model is chosen.**

Whichever model is selected, payment records should store:

- A **provider reference**, internal booking/customer reference, status, currency (ISO 4217), and integer amount in minor units where applicable.
- The provider event ID for webhook idempotency.
- Created/settled/refunded timestamps where relevant.
- **Never store raw card details or sensitive payment credentials.**

### 9.7 Reviews and reports

Local M5.9 synthetic support (2026-10-11): `support_cases`, support-specific
reviewer capability/events, current case assignments and append-only case events
are added in integration migration `0011`, with nullable event-shape checks
requiring TRUE. The frozen support source retains its applied0008/0009 history;
this unapplied combined chain generates the corrected shape directly. Active verified synthetic accounts submit/read
only their cases. Reviewers require admin role, explicit active fixture capability
and exact current assignment, and cannot review their own case. Owner tooling
alone grants/revokes capability and assigns/reassigns cases; runtime column
grants cannot change those records or case ownership/body/history. Status and
assignment revisions/events commit atomically. No learner/booking joins, replies,
notes, email or real incident operations. See the delegated local decision
`docs/decisions/2026-10-11-local-support-reporting.md`; real safeguarding response,
owner/escalation, consent/legal/retention remain OPEN launch gates.

**`reviews`** (simple, verified lesson review)

- `id`, `booking_id` (unique if one review per booking), reviewer, tutor, rating, optional public text, moderation state.

**`support_cases`** (minimal complaint/safety contact record)

- `id`, submitting user, optional booking, category, status, created/updated times.
- Only staff with legitimate need may see sensitive case details.

**`audit_events`** (sensitive operations only)

- Actor, action, target reference, timestamp, minimal safe metadata.
- Capture approvals/suspensions, guardian-link changes, payment adjustments, and important admin actions.
- Do not indiscriminately log personal messages, raw tokens, or student details.

### 9.8 Relationships (simplified)

```text
Better Auth user --< user_roles
       |
       +-- 0..1 tutor_profiles --< tutor_subjects >-- subjects
       |                             |
       |                             +-- tutor_availability
       |
       +--< guardian_learner_links >-- learner_profiles
       |                                     |
       +-- booked_by_user_id                |
                  \                         /
                   +-------- bookings ------+
                                |
                                +-- tutor_profiles
                                +-- subjects
                                +-- booking_events
                                +-- reviews (eligible only)
                                +-- payment reference [OPEN]
```

### 9.9 Database integrity rules

- Enforce foreign keys, `NOT NULL` where required, unique constraints, and appropriate indexes.
- Index approved tutor visibility, subjects, tutor-subjects, booking tutor/date/status, guardian links, and user booking history.
- Never permit a booking with `end_at_utc <= start_at_utc`.
- Prevent **overlapping active tutor sessions at the database transaction level**. An availability check only in the frontend is not safe. A PostgreSQL range/exclusion constraint for relevant booking states is one possible robust solution; define it carefully during ERD/migration design.
- Use database transactions for reservation/booking state changes.
- Require idempotency keys for retried booking creation and provider payment webhook events.
- Never hard-delete confirmed financial or significant booking history merely to make UI data disappear; implement an appropriate retention/deletion policy.
- Separate database credentials for runtime and migrations if operationally feasible; use direct connection for migrations when required by tooling, pooled connections for normal high-concurrency runtime usage if appropriate.

---

## 10. Authentication and authorization

### 10.1 Better Auth [AGREED]

Use Better Auth for:

- Email + password login/sign-up (initial method).
- Email verification and secure password reset.
- Sessions in secure, HTTP-only cookies with production HTTPS.
- Logout and session revocation.
- Appropriate rate limiting / brute-force safeguards.

Social login, passkeys, and complex organization membership are **not necessary for V1**.

**Local signed-in password boundary — 2026-10-11:** delegated M2.9 uses only
`POST /api/account/password`, exact bounded password/confirmation fields and
current active verified owner identity. The internal Better Auth HTTP handler
retains sensitive-session/origin checks and database-backed five-per-minute
change-password throttling; the raw auth allowlist remains unchanged. Server
checks the current session's creation time against installed `freshAge` before
dispatch, because 1.7.7 sensitive-session middleware checks validity, not age.
Server forces other-session revocation, forwards all Set-Cookie headers and strips
provider tokens/body. A nonblocking account-keyed transaction advisory lock plus
current identity recheck rejects overlapping wrapper changes, without auth-row
locks or new grants/schema. Provider operations remain provider-owned and may
partially fail; uncertainty is disclosed with existing reset/sign-in recovery.
One nonblocking global provider-capacity slot precedes the account lock to keep
distinct concurrent wrappers from saturating the shared five-connection pool.
See `docs/decisions/2026-10-11-signed-in-password-change.md`.

**Local signed-in email boundary — 2026-10-12:** delegated M2.9 adds private
`POST /api/account/email` with strict start/request/confirm stages for active
verified synthetic owners. Better Auth1.7.7 emailOTP requires current-address
proof before issuing new-address proof, stores hashed five-minute single-use
codes and enforces HTTP throttles. Each stage rechecks the exact persisted
session and configured freshness. Supported identifier-prefix custom hashing
adds purpose/owner/session/address binding through scoped server context and
rejects matching plain legacy rows read-only. The scoped context belongs to the
actual auth runtime/hasher closure to preserve binding across Next bundles;
unrelated auth identifiers stay unchanged. No auth-row/token rewrites or
additional identity store/schema.
Completion retains this session, revokes others through the provider, and fully
replaces the private document. Partial revocation failure discloses that email
may already have changed and directs native account/session recovery. Raw OTP
and core change-email routes remain closed; local private capture only. See
`docs/decisions/2026-10-12-verified-account-email-change.md`.

### 10.2 Recommended integration pattern

- Mount Better Auth at `src/app/api/auth/[...all]/route.ts`.
- Keep its server configuration in a **server-only** module.
- Use its supported Drizzle adapter for PostgreSQL and generate auth schema/migrations using the installed version's documented workflow.
- Verify a valid session **and** record-level permission at the server boundary.
- Avoid caching personalized account pages across users.

Official integration instructions: [Better Auth Next.js](https://better-auth.com/docs/integrations/next), [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle).

### 10.3 Example checks

**Tutor availability update:** user is authenticated and verified, has an active account and trusted tutor role, owns the `tutor_id`, and requested times are valid. In the local M4.1 slice, pending/rejected tutor profiles may prepare hours; suspended profiles cannot edit. Public eligibility and booking approval remain separate gates.

**Parent's child booking:** parent is authenticated, link to the learner is authorized, tutor is approved, slot is free, booking/payment policy is met.

**Booking detail view:** user is the eligible learner, authorized guardian, assigned tutor, or authorized support admin.

### 10.4 Roles and minor accounts

Local M5.6 delegated account restrictions (2026-10-11) add an owner-only fixture
target registry, exact staff-to-target grants and append-only transition/capability
history. Runtime changes existing user_access only through a narrow SECURITY
DEFINER function with pg_catalog search path and schema-qualified tables; no
blanket runtime account-status UPDATE. Target-first locks serialize revision and
status; current provider session/admin/account/grant and non-admin/self exclusions
are rechecked after waits. Owner tooling follows the same order. Scoped reads use
one final authorization snapshot and disclose only target name/status/revision and
minimal history. Existing session records and all tutor/learner/booking state stay
intact. See the local-account-restrictions decision; real policies remain gated.

- Do not equate “knows the child's name” with “is the child's guardian.”
- For minor users, require an appropriate parent/guardian relationship and the consent/notice workflow mandated by launch jurisdictions.
- Keep learner data minimal; default to parent-managed child profiles when appropriate.
- Do not publish minors' contact details or session URLs.

---

## 11. Availability, time zones, and double-booking prevention

Scheduling is among Learli's most important backend responsibilities.

### Baseline rules

1. Each tutor chooses an IANA timezone (e.g., `Asia/Manila`, `America/Los_Angeles`).
2. Tutor can define recurring windows in **their local wall-clock time**.
3. For each actual calendar date, Learli computes available UTC slots.
4. Bookings persist UTC start/end timestamps.
5. Users see the time converted into **their preferred local timezone**, with its date and offset/abbreviation.
6. Never allow overlapping confirmed/held bookings for the same tutor.
7. Validate lead time, duration, reschedule window, and cancellation policy once approved.
8. Account for DST gaps/overlaps and cross-midnight changes.

**Window semantics [RECOMMENDED] — M4.2 engine, `src/lib/time/`:** a weekly window covers exactly the instants at which the tutor's local wall clock reads inside it. A local time skipped by a daylight-saving change yields no availability and is never moved to another wall-clock time; a repeated local hour is available on both passes. Lesson lengths are elapsed real time. Lesson duration, the step between start times, and minimum notice are supplied by the caller and stay `[OPEN]` policy. The engine's output is advisory; rule 6 is still enforced in the database.

### Example

A tutor in Manila offers Monday at 9:00 PM Manila time. A learner in California must see the **correct California date/time for that specific Monday**, which can change when California changes daylight-saving time. Do not use one fixed “Philippines minus 16 hours” rule year-round.

### Concurrency example

Two families click the same slot at once:

- Both browsers may have seen the slot available.
- The **server/database** accepts at most one valid reservation for that tutor/time.
- The second family gets a clear “This time is no longer available” message and alternatives.

Avoid building a calendar synchronization engine or Google Calendar OAuth for V1. Tutors can set availability directly in Learli.

---

## 12. Payments: required decision gate [OPEN]

Payment is part of the planned marketplace, but **how it works has not yet been chosen**. Do not implement live charging until the founders resolve the following:

| Decision | Why it matters |
|---|---|
| Does the customer pay Learli or the tutor? | Determines legal merchant, processor, payout requirements. |
| One-off booking, prepaid package, or subscription? | Determines checkout screens, bookings, invoicing, renewals. |
| Who sets the price? | Tutor prices vs standard packages. |
| Does Learli take a commission or subscription fee? | Determines revenue accounting and tutor payout records. |
| Which countries/currencies at launch? | Determines gateway eligibility, FX, taxes, chargebacks, disclosures. |
| Which provider? | Stripe/PayMongo/other must be evaluated against entity jurisdiction. |
| What are trials, cancellations, refunds, and no-show rules? | Defines booking/payment statuses and consumer disclosures. |

### Architecture rule regardless of gateway

- The browser must **never** mark a booking as paid just because the user saw a success page.
- Use hosted checkout or secure payment elements from the approved provider.
- Verify signed payment webhooks **on the server** and deduplicate using provider event IDs.
- Reconcile payment and booking states; a failed/late payment must not silently reserve a slot forever.
- Do not store card numbers/CVV; use provider tokens/references.
- Treat refunds and payouts as separate auditable financial operations where relevant.
- Before accepting money, publish legally reviewed policies and support contact information.

### Development before payments are decided

Use **mock bookings in a local/test environment only**, visibly marked as test data. Do not present a “paid” production booking or collect real money through manual insecure workarounds.

For the first implementation, design a small payment-provider boundary such as `initiateCheckout`, `handleVerifiedEvent`, `getPaymentStatus` **after the business model is approved**. Avoid building a huge payment abstraction before choosing a provider.

---

## 13. Zoom and Google Meet responsibilities

### Learli handles [AGREED]

Tutor discovery, availability, booking, meeting-link **access control**, email reminders, status/history, and basic customer support.

### Zoom / Google Meet handle [AGREED]

Video, audio, screenshare, the live lesson, and their own meeting controls.

### Simplest MVP implementation [RECOMMENDED]

- Tutors use their **own** Zoom/Google Meet accounts.
- Tutor supplies a valid meeting URL for a booked lesson or a protected reusable meeting configuration, subject to an approved safety policy.
- Learli validates the allowed URL/domain and displays it only to the authorized tutor, learner, and guardian for that booking.
- Use waiting rooms, appropriate meeting permissions, and parent supervision according to safeguarding policy.
- Do not attempt to fetch Zoom/Meet attendance or claim verified participation unless an actual integration supports it.
- Session completion in V1 is an **administrative status**, not guaranteed proof of attendance.

**No Zoom API keys, Google OAuth integration, video recordings, or embedded video SDK are required initially.** Automated meeting creation is a later enhancement only if operationally valuable.

---

## 14. Email and domains

### 14.1 Resend [AGREED]

Transactional emails needed initially:

- Email verification.
- Password reset.
- Booking confirmation / changed time / cancellation.
- Tutor-side booking notices.
- Optional basic reminder if dependable scheduling infrastructure is available.

Do not build bulk marketing, newsletters, or a full notification center for the MVP.

### 14.2 Railway-generated URL vs a branded domain

- Railway can generate a public `*.up.railway.app` URL with HTTPS for app development/pilot.
- This means **a purchased website domain is not needed to deploy and test Next.js**.
- **But a Railway app URL is not automatically a verified email-sending domain.** For production email to arbitrary customers, Resend generally requires a domain you own/control and verify with the provided DNS records (SPF/DKIM and related requirements).
- During development, use Resend's supported testing/sandbox workflow or verified test recipients. Do not assume the account can email arbitrary addresses without a verified domain.
- When a custom website domain is later added, update Better Auth base URL/trusted origins, OAuth/callback origins if any, email links, webhook URLs, and public canonical URLs. Test cookies and password-reset links again.

**Practical launch gate:** Buy/verify an appropriate domain **before relying on public transactional emails**. The application can still be developed on the free Railway-generated URL.

### 14.3 Email reliability

**Local M5.7–M5.8 slice authorized 2026-10-11:** migration 0012 queues one
`booking_notification_deliveries` row per committed demo creation-event/account/
kind through an event trigger, using creator/tutor UNION dedup. A bounded owned
manual invocation on an independent local Pool connection captures private HTML
only after current recipient authorization and TTL checks; stale rows are
suppressed with safe internal state. Capture failure cannot alter booking state.
Stable atomic artifact identity permits retries after capture-before-ack failure;
filesystem/PostgreSQL do not establish exactly-once delivery. No learner or
meeting fields, recipient override/public retry endpoint, Resend call or reminder
worker. Auth verification/reset capture stays intact. See
`docs/decisions/2026-10-11-local-booking-notifications.md`; real-email/consent/
commercial/safeguarding gates remain unchanged. Verification status is recorded
in the tracker, separately from this authorized architecture.

- Trigger email only after a successful database state transition.
- If mail fails, keep the correct booking state; log a safe, retryable failure.
- Avoid a mandatory always-on queue service in V1. Add durable background delivery when reminders/volume require it.
- Never expose API keys to the browser or put child-specific sensitive details in email subjects/logs.
- Confirm current Resend free-tier limits before launch; quotas/prices can change.

Official reference: [Resend pricing](https://resend.com/pricing), [Resend domain setup documentation](https://resend.com/docs/dashboard/domains/introduction).

---

## 15. File uploads and storage — not needed in V1

**Decision [AGREED]:** Learli is an intermediary, not an LMS. Therefore:

- **No assignment, homework, PDF worksheet, or lesson-material uploads** for students.
- Use **initials avatars** and fixed branded assets at launch if necessary.
- Don't create an uploads table, upload APIs, S3 bucket, or object-storage bill just for hypothetical features.

If later the product genuinely needs tutor profile photos or limited verification documents:

1. Confirm the actual use case and safety/privacy requirements.
2. Evaluate Neon Object Storage at that time (including **current** cost, limits, and regional availability).
3. Keep private files private; issue controlled time-limited access if necessary.
4. Store only metadata/object keys in PostgreSQL, not large binary files in ordinary records.
5. Add retention, deletion, malware scanning, and file-type/size restrictions appropriate to the file type.

**Important:** Neon Object Storage exists, but this architecture does **not** require provisioning it for the initial marketplace.

---

## 16. Local development — beginner step-by-step

### 16.1 Accounts and tools to prepare

You need:

1. A laptop with Git and a code editor (VS Code is fine).
2. A maintained Node.js **LTS** release and npm installed.
3. A GitHub repository for Learli (private during early development is reasonable).
4. A Neon account and a **development** PostgreSQL database.
5. A Railway account for a later deployment.
6. A Resend account for transactional email testing.

Payment processor, custom domain, and Neon Object Storage are **not prerequisites for first local development**.

### 16.2 Initialize the application

Example terminal commands:

```bash
npx create-next-app@latest learli --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd learli
npm run dev
```

Visit `http://localhost:3000` to check the Next.js starter app.

Install the initial integrations after confirming compatible current versions:

```bash
npm install drizzle-orm @neondatabase/serverless better-auth @better-auth/drizzle-adapter zod resend
npm install -D drizzle-kit
npx shadcn@latest init
```

**Note:** Dependency names and APIs can change. Use the current official Better Auth/Drizzle integration instructions when implementing; the above commands are a starter checklist, not generated application code.

### 16.3 Create a Neon development database

1. Create a Neon project/branch for development.
2. Copy its PostgreSQL connection string from the Neon dashboard.
3. Put it in `.env.local` as `DATABASE_URL` (server-only).
4. Never commit `.env.local` or print connection credentials in screenshots/logs.
5. Set up Drizzle's configuration and a typed database client.
6. Generate the Better Auth database schema with the **current supported adapter workflow**.
7. Generate/review Drizzle migrations and apply them to **development** first.

### 16.4 Suggested `.env.example`

```dotenv
# Public app location — replace with the actual deployed address
APP_URL=http://localhost:3000

# Server only. DO NOT prefix credentials with NEXT_PUBLIC_
DATABASE_URL=postgresql://REPLACE_WITH_DEV_CONNECTION
DATABASE_URL_DIRECT=postgresql://REPLACE_WITH_DEV_DIRECT_CONNECTION
BETTER_AUTH_SECRET=REPLACE_WITH_STRONG_RANDOM_SECRET
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=REPLACE_WITH_TEST_KEY
EMAIL_FROM=REPLACE_WITH_VERIFIED_SENDER_WHEN_READY

# Payment provider settings: NOT configured until selected
```

These are **placeholders, not working secrets**. `DATABASE_URL_DIRECT` is only needed if the selected migration approach requires a separate direct connection. `APP_URL` is our own application setting, not a built-in Next.js requirement.

If Better Auth configuration requires trusted origins or proxy settings for the selected release, define them explicitly when deploying to the actual Railway URL.

### 16.5 Build in small milestones

**Milestone A — Foundation**

- Public homepage/navigation; responsive visual system.
- Neon connection and basic health check.
- Better Auth login, verified email (test mode), logout, password reset.
- Roles with server-side authorization.
- Seed a few fictional tutors/subjects in development only.

**Milestone B — Tutor discovery**

- Subject catalog, tutor profile, search/filter, approved visibility.
- Simple matching form backed by actual tutor capabilities.
- Tutor ability to edit profile and availability.

**Milestone C — Learners and booking**

- Parent-managed child profiles and appropriate safeguards.
- Self-managed eligible college-student flow.
- Available slots, atomic booking, double-booking tests.
- Zoom/Google Meet links and basic booking emails.
- Simple student/parent/tutor dashboards.

**Milestone D — Commercial readiness (only after decisions)**

- Pricing, checkout/provider, payment verification, refund/cancellation policy.
- Basic disputes, review eligibility, safety/reporting route.
- Legal/privacy policies and production email domain.
- Production operational checks and pilot.

### 16.6 Recommended Git workflow

- `main` = approved production releases.
- `dev` = integration/testing branch, if the team needs it.
- `feature/<short-name>` = focused features, merged by review.
- Require checks before merging into production.
- Never share the same production Neon database with local experiments or automated tests.

A single-developer team may simplify this further; the important protection is **separate production data** and reviewed changes.

---

## 17. Security, safety, and privacy baseline

Learli connects adults and young learners. It needs a safe operating policy even though it is *not* a school system.

### Account and data security

- Force HTTPS for the public site and secure cookie settings.
- Validate inputs server-side (Zod is suitable) and use parameterized Drizzle queries.
- Keep secrets in local env and Railway variables, not Git or `NEXT_PUBLIC_*` variables.
- Authorize every data read/write by identity, role, and **record ownership**.
- Rate-limit sign-up, login, password resets, matching submissions, booking attempts, and public forms.
- Use CSRF protection appropriate to the chosen authentication/session mechanism; do not disable framework safeguards for convenience.
- Do not expose internal booking IDs as authorization credentials or trust a guessable URL.
- Protect against open redirects, unsafe user-provided links, XSS in tutor bios, and leaked meeting links.
- Log errors without passwords, session tokens, payment secrets, student private information, or full meeting URLs.
- Restrict admin access, use strong authentication (MFA for admins is recommended), and audit sensitive admin operations.

### Child/learner safety

- Establish appropriate guardian consent/account controls for minors **before collecting their information or enabling bookings**.
- Minimize child data; no public child profiles or unneeded phone/address/school details.
- Publish safeguards for tutor conduct, supervision, and professional communication.
- Restrict meeting URLs to authorized booking participants; encourage meeting waiting rooms and suitable safety settings.
- Provide an abuse/safety report channel with human review and escalation procedures.
- Avoid built-in private messaging between adults and minors in V1.
- Do not record tutoring sessions through Learli; future recording requires a separate legal and consent review.

### Legal and cross-border review [OPEN]

Before public operation, confirm the company's jurisdiction, learner/tutor target countries, payment flow, age/guardian rules, data retention, privacy notice, applicable consumer requirements, and any tutor screening obligations. Depending on markets, examples to assess include the **Philippine Data Privacy Act**, **COPPA** (US children), and **GDPR/UK GDPR** where applicable. **This document is not legal advice.**

### Backups and retention

- Confirm Neon backup/restore features for the selected plan; don't assume the free tier meets production recovery requirements.
- Define a recovery point objective (RPO) and recovery time objective (RTO) appropriate to actual paying customers.
- Test recovery in a non-production environment before launch.
- Keep operational records only as long as justified by privacy, consumer, and tax requirements.
- Implement account/data deletion and access-request processes where applicable, subject to lawful record-retention needs.

---

## 18. Deployment to Railway — beginner step-by-step

### 18.1 Prepare production-grade configuration

1. Get the Next.js application running locally.
2. Push tested code to GitHub.
3. Create a **production-specific Neon database/project or carefully isolated branch** with separate credentials.
4. Ensure the app reads `DATABASE_URL` only on the server.
5. Pin Node and dependencies; test `npm run build` locally.
6. Add a minimal health endpoint that does not disclose private details.

### 18.2 Create a Railway app service

1. In Railway, create a project and select **Deploy from GitHub repo**.
2. Connect Learli's repository and deployment branch.
3. Railway will build and run Next.js as a Node application; verify its detected build/start commands.
4. Start with one web service. **Do not add Redis, a Railway PostgreSQL database, or worker services** just because templates suggest them: Neon is our DB.
5. Add server-only environment variables under Railway's service **Variables**.
6. Build, deploy, and inspect application logs.
7. Under **Settings → Networking**, generate the public Railway domain.
8. Update production `APP_URL`, Better Auth base URL/trusted origins as required and redeploy.
9. Test sign-up/login, protected pages, tutor search, and mock bookings on that exact HTTPS URL.

**Deployment packaging:** A normal Next.js Node start command can be used initially. If optimizing with `output: 'standalone'`, follow Railway's official standalone guide and correctly package Next.js static assets; don't mix `next start` and standalone server instructions without testing.

Official guide: [Railway — Deploy a Next.js App](https://docs.railway.com/guides/nextjs).

### 18.3 Database migrations in production

- Keep migration files in source control.
- Test every migration on a fresh development/staging database.
- Run reviewed migration commands as a **controlled pre-deploy step** where supported.
- Back up/snapshot appropriately before destructive changes.
- Do **not** run `drizzle-kit push` casually against live customer data.
- Use expand/backfill/contract steps for breaking schema changes once users exist.

### 18.4 Monitoring and costs

- Track Railway **memory, CPU, network usage, errors, and billing**.
- Railway Hobby currently has a **$5/month minimum with $5 included resource usage**, not unlimited usage for $5. If usage exceeds the included amount, the bill grows. Recheck pricing at purchase time.
- Track Neon database storage/compute/connections and Resend email quotas.
- Set budget alerts where offered; review after the first week of live pilot use.
- Use a single app instance initially. Add workers/queues, read replicas, caching infrastructure, or more instances when actual telemetry proves they are needed.

### 18.5 Production environment layout

| Environment | Hosting | Database | Data |
|---|---|---|---|
| Local dev | Laptop | Neon dev | Fake/test learners and tutors |
| Staging [RECOMMENDED] | Railway staging service or controlled preview | Neon staging | Synthetic test data only |
| Production | Railway production service | Neon production | Real users/bookings after launch requirements |

Don't create unnecessary paid always-on staging resources if a limited pilot can be verified safely with a controlled preview, but **never run development tests against production student records**.

---

## 19. Testing, acceptance criteria, and go-live checklist

### Test types [RECOMMENDED]

- **Unit:** subject filters, matching ranking, timezone conversion, status transitions, policy/permission rules.
- **Integration:** Drizzle queries and constraints, guardian/learner links, booking concurrency, webhook signatures and idempotency (when payment provider exists).
- **E2E (Playwright):** search → tutor profile → sign-in → booking; parent and tutor dashboard visibility; cancellation; access denied.
- **Manual responsive/accessibility QA:** desktop, tablet, phone, keyboard-only and screen-reader spot checks.

Vitest + React Testing Library + Playwright are reasonable tools; introduce them pragmatically.

### Minimum critical scenarios

- [ ] Visitor can browse only approved tutor profiles.
- [ ] Tutor can't impersonate another tutor to edit a profile or time slots.
- [ ] Parent A cannot view Parent B's learner or booking.
- [ ] Minor profile cannot be exposed or booked without the required guardian control.
- [ ] An eligible college learner can book independently.
- [ ] Two simultaneous requests cannot confirm the same tutor/time.
- [ ] Timezone and daylight-saving conversions are correct at boundary dates.
- [ ] Invalid/expired/suspended accounts cannot access booking actions.
- [ ] Meeting link appears only for eligible confirmed booking participants.
- [ ] Cancellation/rescheduling updates are consistent and recorded.
- [ ] Booking emails never include secrets and do not contradict DB state.
- [ ] Search remains usable with **zero tutors**, not fake results.
- [ ] `npm run build` passes; no production TypeScript/ESLint errors.
- [ ] Neon credentials, Better Auth secret, Resend key are not in client JavaScript or Git history.
- [ ] Restore procedure tested; known backup plan documented.
- [ ] Production error/support contact and reporting path exist.

### Additional go-live gates for *paid public launch*

- [ ] Company/operating jurisdiction and initial customer markets confirmed.
- [ ] Payment recipient, gateway eligibility, pricing, commission/payout and refund policy approved.
- [ ] Payment webhook signature/idempotency and reconciliation tested.
- [ ] Customer-facing terms/privacy/cancellation and child safeguarding policy reviewed.
- [ ] Production sending domain verified with Resend; email delivery tested.
- [ ] Required guardian/child-data safeguards are functional.
- [ ] Tutor basic eligibility/safety review is operational.
- [ ] Admin/support and emergency escalation responsibilities assigned.
- [ ] Database access controls and backup/recovery tested.
- [ ] Billing limits and usage monitoring enabled.

Passing local tests alone is **not** enough to declare a platform handling minors and payments ready for public launch.

---

## 20. Open decisions, later roadmap, and change control

### 20.1 Questions to answer before finalizing PRD + detailed ERD

| Priority | Question | Owner/status |
|---|---|---|
| **P0** | Who charges the customer: Learli or individual tutor? | Founder — [OPEN] |
| **P0** | One-off sessions, subscriptions, or prepaid packages? What are exact prices? | Founder — [OPEN] |
| **P0** | Which jurisdiction/market launches first? What currency/processor is eligible? | Founder — [OPEN] |
| **P0** | Free trial, paid trial, or none? Cancellation/refund/no-show terms? | Founder — [OPEN] |
| **P0** | Minimum tutor safety vetting, guardian age/consent and support requirements? | Founder + legal/safety review — [OPEN] |
| **P1** | Are tutor prices standardized or self-set? | Founder — [OPEN] |
| **P1** | What data is mandatory on tutor and learner profiles? | Product — [OPEN] |
| **P1** | Are tutor join links entered once, per booking, or via external meeting APIs later? | Product — [OPEN] |
| **P1** | Is there a parent-managed child login at launch, or parent-only access? | Product — [OPEN] |
| **P1** | What is the precise policy for reviews and tutor applications? | Product — [OPEN] |

**Do not guess** an answer based on Superprof, Preply, or the old CalcStream proposal. Those are inspirations, not approved policies.

### 20.2 Later additions — only when justified

- Tutor profile photo uploads → evaluate Neon Object Storage.
- Automated Zoom/Meet meeting creation.
- Reliable scheduled reminders via a background job service.
- Tutor payouts and subscription billing, if the chosen revenue model requires them.
- Smarter search, ranking, and search infrastructure after tutor inventory grows.
- Native mobile apps using stable authorized API endpoints.
- Optional progress summaries or AI assistance **only after a new product decision**.
- Group classes, formal curriculum mappings, and advanced tutor management **well after MVP**.

### 20.3 Decision records (lightweight)

When a material change is approved, record it in `docs/decisions/` with:

- **Decision** and date.
- **Why** it is needed.
- **Alternatives considered.**
- **What changes** in product scope, cost, privacy, schema, and deployment.
- **Who approved it.**

This is enough governance for an early startup. Don't introduce enterprise architecture bureaucracy.

---

## 21. Quick implementation checklist (for a beginner developer)

Follow this order. Each completed item should produce a testable result:

1. [ ] Read §§1–3. Confirm all [AGREED] and [OPEN] items with the founder.
2. [ ] Create the GitHub repository, Next.js TypeScript project, Tailwind, and shadcn/ui.
3. [ ] Create Neon development database and server-only connection.
4. [ ] Set up Drizzle schema and migrations; implement health check.
5. [ ] Install Better Auth and its Drizzle adapter; get login + logout + reset working.
6. [ ] Define roles and server authorization policies; verify IDOR protections.
7. [ ] Create subjects/tutor profiles and public search.
8. [ ] Add tutor editing, approval gate, and availability.
9. [ ] Add parent-managed learner and self-managed college-learner flows.
10. [ ] Add booking server logic with correct time zones and atomic collision prevention.
11. [ ] Add basic dashboards and secure Zoom/Meet link handling.
12. [ ] Connect Resend testing and verify booking/identity email flows.
13. [ ] Build basic admin/support and safety reporting.
14. [ ] Settle the payment business model **before** implementing live checkout.
15. [ ] Implement and test real payment flows only after the payment decisions.
16. [ ] Deploy to Railway with Neon production separation and safe secrets.
17. [ ] Run critical unit/integration/E2E and real-device QA.
18. [ ] Finish legal/guardian/tutor-safety, domain/email, backups, and payment launch gates.
19. [ ] Run a limited monitored pilot; measure actual usage and support burden.
20. [ ] Launch more broadly only when the pilot, safeguards, and operations are reliable.

### Definition of done for Learli V1

A legitimate learner/guardian can find an eligible tutor, book an actually available slot without collision, complete the **approved** payment/trial step, access the authorized Zoom/Google Meet link, and manage bookings safely. Tutors can manage their own profile and availability. Admins can handle essential approvals and reports. **No learner uploads or LMS features are required.**

---

## 22. Official technical references

These references support the proposed integrations but **do not replace testing the exact versions and account plans used**.

- [Next.js documentation](https://nextjs.org/docs)
- [Railway — Deploy Next.js](https://docs.railway.com/guides/nextjs)
- [Railway — Plans and usage billing](https://docs.railway.com/pricing/plans)
- [Railway — Environment variables and secret exposure](https://docs.railway.com/guides/frontend-environment-variables)
- [Neon documentation](https://neon.com/docs)
- [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview)
- [Better Auth — Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth — Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Resend documentation](https://resend.com/docs)
- [Resend pricing](https://resend.com/pricing)
- [Neon Object Storage overview](https://neon.com/blog/building-neon-object-storage) — **future option, not a V1 dependency**

**Document precedence:** This Learli architecture updates/supersedes the earlier CalcStream concept *only where our latest discussions explicitly changed the business*: brand, marketplace-only scope, simplified dashboards, launch categories, technical stack, hosting, and removal of assignments/LMS features. Pricing, payment flow, legal compliance details, and other open choices still require approval.

**Local profile preview and auth continuation — 2026-10-11:** M4.11/M2.9 uses
`features/public-availability` for an advisory read-only repeatable-read snapshot.
One database clock, public eligibility by1..20 unique slugs, and bulk weekly
window/time-off/unexpired reservation reads avoid per-tutor SQL. Strict public
subject/level/IANA-zone/from/to filters intersect existing60min notice/14day
horizon;60min candidates at30min starts use the existing actual-date/DST engine.
Bounded rows/output refuse excess with503, never partial/false-empty results.
Busy reads include the entire final candidate duration. The query returns only
public slugs and formatted/UTC times, never learner/account/booking/participant
identifiers; preview ignores elapsed holds without writing expiry events.

The native profile picker carries only public tutor/subject/level/zone/start/end
selection into `/bookings/demo`. Auth return validation extends safeReturnPath
with a strict canonical selection; signup/verification/signin carry the same
safe next. Learner choice remains after authentication and ownership scoped.
Resume and create revalidate current eligibility, learner level, subject and time;
stale choices show current alternatives and never automatically reserve. Existing
atomic reservation/retry/expiry mutation behavior remains authoritative. This
work is gated to loopback development/test and remains local_simulation only;
commercial, guardian/consent and real-user launch gates remain OPEN.

### Local M5.3/M5.4 family dashboard composition — 2026-10-11

Student and parent landing pages consume the coordinator-frozen private booking
provider's single-statement overview, using one current authorization snapshot,
viewer account time zone, authorized learner context and expiry projection for
both active and history lists. The consumer adds no booking query or authorization
layer. Parent All learners/single-learner selection and history paging use GET;
students use only eligible self-managed profiles. Future starts supply Next
simulated reservation; ongoing active times remain in the agenda. Expired rows
retain original scheduled instants and link to private detail; reads append no
events or mutations. Local simulation labels and expiry deadlines remain explicit.
No join, payment, cancellation, onboarding, meeting storage, LMS or production
capability is added. Runtime receives column-limited booking_events SELECT for
private persisted detail history, preserving existing grants. Exact imported
hashes and local execution evidence are retained in the worker's ignored report.
Core document content is fully awaited so native GET and detail navigation work
without JavaScript. Hydrated filter submission enhances the same GET URL with a
router transition and pending feedback; server validation and authorization stay
identical. The authoritative selected learner keys the form for Back restoration.


### Local M3.6 availability matching extension — 2026-10-11

`AUTHORIZED — build-feature delegation` for the dispatched 2026-10-11 request. Public matching accepts only visitor-selected subject/level, an explicit valid IANA viewer zone, Any time or ISO weekday preferences with one bounded time band. Preferences remain in an allowlisted GET URL; no learner lookup, account-zone mutation, or private learner field is involved. Unknown/malformed query values are removed before rendering.

Actual dates come from the parent-authorized shared `public-availability-v1` query using the existing DST engine, tutor time off, and unexpired local simulated reservations. The public read neither materializes expiry nor changes booking state. Matching rechecks the shared directory eligibility and requests <=100 complete eligible tutors in <=5 batches of <=20, then filters whole viewer-local intervals within a common start-time window, orders by earliest matching time/name, and pages five genuine matches. Overflow or a failed batch produces a retry state, never partial or fabricated matches. Profile links use the shared canonical helper and carry only visitor filters and the selected public UTC interval. Every subsequent booking still revalidates.

The existing 60-minute/30-minute-step/60-minute-notice/14-day-start-horizon/10-minute-reservation-TTL values remain local simulation inputs. Live duration, pricing, trial, cancellation/rescheduling, consent and safeguarding policy remain OPEN. No schema or booking mutation change is part of this matching feature. Final executed evidence belongs to the progress tracker and worker handoff.

### Local private reservation meeting-link boundary — 2026-10-11

Separate booking_meeting_links storage and append-only booking_meeting_link_events
carry the current URL and safe actor/revision/request/time history respectively.
URLs never join general booking projections. READ COMMITTED mutations acquire
tutor-first then booking locks; final fresh SQL rechecks current identity,
assignment, approved active verified tutor, learner relation and DB-time TTL.
Reads use one current-auth statement. Dedicated endpoint alone returns private
link state or an authorized no-store external redirect; no provider calls.
Runtime grants are column-limited and cannot delete links or edit audit history.
Per-reservation model/access is delegated for local simulation only; real policy
remains OPEN. See the local reservation meeting-link decision and blueprint.

### Local support booking association — delegated 2026-10-11

M5.6/M5.9 adds optional immutable `support_case_bookings` and append-only
`support_booking_access_events`. Association insertion is limited to the case
creation transaction; restricted runtime grants and immutable triggers prevent
retargeting/deletion. Support submission authorizes current participant access
after serialization waits. Final case-context SQL rechecks viewer session/account,
case owner or exact admin/capability/assignment, and requester current participant
relationship. Successful reviewer context and minimal read audit share one SQL
statement; missing participant access yields generic unavailability without learner
or meeting data. Existing case share locks serialize fixture reassignment. Read
projection uses database time for effective expiry and never mutates booking state.
See `docs/decisions/2026-10-11-booking-linked-support.md`. Local only; real safety,
consent, retention, commercial and production gates remain OPEN.


## Four-feature integration migration chain —2026-10-11

The local combined candidate preserves immutable0000–0012 and applies0013 meeting links,0014 booking-linked support, then0015 scoped account restrictions. Each custom SQL migration retains accepted source bytes; snapshots are cumulative. Runtime grants remain explicit; account-status mutation is exposed only through the exact scoped SECURITY DEFINER function. Meeting URLs remain participant-only and excluded from support/notifications/lists/audit/metadata. This is local synthetic coordination, not live meeting provisioning or production access governance.

The observed prior private bootstrap retention across browser actor changes is handled at successful sign-out/sign-in by full document replacement. Existing validated return paths and server current-session/account/record authority checks remain intact; no authorization is delegated to the browser.

### Four-feature final recovery — document lifetime (2026-10-12)

After accepted independent finding F1, private-workspace documents are marked
with a nonpersistent client boolean. A client transition into the public auth
route group replaces that document at the current URL before rendering auth
children, clearing the earlier inline private bootstrap without waiting for a
successful sign-in. A private bfcache restoration reloads for current server
authorization. This is document housekeeping, not identity or permission state;
all guarded reads/writes and validated return/booking paths remain unchanged.
Fresh public SSR and no-JS navigation remain ordinary server responses. Existing
successful sign-out/sign-in replacements remain. Recovery/runtime evidence is
separate from historical verification, under .local/four-feature/recovery-final/.


### M3.5 directory actual-date read composition (2026-10-12)

AUTHORIZED — build-feature delegation, including coordinator approval of the
directory-only optional-filter provider seam and capacity bound. The original
profile/matching public query contract remains strict. Directory reads share
the same read-only, repeatable-read candidate engine and current eligibility
predicate; optional subject, level and declared-language filters are rechecked
inside each batch. At most100 pre-candidate eligible tutors are evaluated in
at most5 complete batches of20. Intersect batch start horizons before whole-
interval matching. Over-cap, row/output overflow and provider failure are
unavailable states with no partial count/list. Plain directory browsing is
uncapped and unchanged. Snapshots across batches are advisory; reservations
always revalidate. No schema, migration, production policy or write-path change.

### Local specialized-subject display-name maintenance — 2026-10-12

Delegated ADM-02/M3.1/M5.6 adds subject name_revision and subject.renamed audit
in forward0016. A DB-owned revision advances only on an actual specialized-name
change; core launch names and subject ID/slug/category stay fixed. Column-limited
runtime UPDATE permits name/is_active/updated_at. Rename locks the subject under
READ COMMITTED, rechecks current session/verification/access/admin authority on
the transaction connection, rejects differing stale edits and uses existing
lower(name) uniqueness. Name plus minimal audit commit together; identical
retries are no-ops. Existing activation, tutor offerings, bookings and historical
snapshots remain. Public consumers continue reading current catalog names through
their existing eligibility/reference joins. No public/matching service changes or
real-user launch authority; exact executed evidence belongs to the tracker.

### Integration local auth error privacy — 2026-10-12

The integration runtime synchronously normalizes unknown provider HTTP errors
through supported onAPIError.onError into a fresh safe APIError500. Installed
Better Call otherwise logs raw non-API exceptions despite logger.disabled, including
Drizzle parameters. Known provider statuses, proof binding and all permission/
origin/throttle/session behavior remain; partial revocation retains uncertainty.
No global console replacement, auth-row rewrite or dependency patch. Exact local
fixture containment and sanitized evidence are in the integration Recover note;
see docs/decisions/2026-10-12-local-auth-error-privacy.md. Local synthetic only.
