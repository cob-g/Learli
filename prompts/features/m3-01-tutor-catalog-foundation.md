# M3.1–M3.3 — Subject catalog, tutor application and review gate

- Status: **AUTHORIZED — build-feature delegation**
- Date: 2026-10-11
- Authority: The repository owner invoked `/build-feature M3.1–M3.3 tutor catalog.`
  after being told the slice is local-only with synthetic data. This is delegated
  execution authority, not separate human review of this blueprint.
- Baseline: `main` at `d22a061`, clean working tree, in sync with `origin/main`.
  Every change in this slice is therefore the diff against `d22a061`.
- Primary package: M3.1; related M3.2 and M3.3. Vertical slices V04 and V05.
- PRD: TUT-01, TUT-02, TUT-03, ADM-01, ADM-02 (partial), AUTH-03; BR-01, BR-02,
  BR-11; QA-02, QA-03. Public discovery (PUB-02/03/04, MATCH) stays M3.4–M3.8.
- Constraint carried from `docs/decisions/2026-10-11-local-m2.md`: local PostgreSQL,
  synthetic `.test` accounts, no cloud service, deployment or external email.

## Outcome

A signed-in account that holds the trusted `tutor` role submits one tutor
application (headline, introduction, teaching background, time zone, subjects with
learner levels) and can keep editing it. The application starts `pending`. An
account with the trusted `admin` role sees a review queue, opens an application,
and approves, rejects, suspends, reinstates or reopens it. An admin also adds a
specialized subject and activates or deactivates any subject. Every one of those
changes is authorized on the server and written to `audit_events`. One query
defines which tutors are publicly eligible; no public page consumes it yet.

## Language

- **Tutor application / tutor profile:** the same `tutor_profiles` row. It is an
  application while `pending` and a profile once reviewed.
- **Review status:** `pending`, `approved`, `rejected`, `suspended`. It is a stored
  eligibility state. It is never worded as "verified".
- **Offering:** one `tutor_subjects` row: a subject, the learner levels the tutor
  teaches it at, and an optional specialty note.
- **Specialized subject:** a catalog row an admin adds. Tutors choose from the
  catalog and never create subjects.

No further terminology clarification is needed.

## Decisions

1. **Who may apply.** The form requires the existing server-side `tutor` role plus
   ownership. Locally that role comes only from trusted fixture or test setup, as
   M2 decided. How a new account obtains the tutor role (the "Start tutor
   application" entry) belongs to M3.4 and is not built or decided here. The
   runtime database role still cannot write `user_roles`.
2. **Statuses and transitions.** Submitting creates `pending`. Only an admin moves
   status: pending→approved, pending→rejected, approved→suspended,
   suspended→approved, rejected→pending. Any other move is refused. Updates are
   conditional on the current status, so two simultaneous reviews cannot both win.
3. **No self-review.** An account holding both `admin` and `tutor` cannot review
   its own application. Admin is not an ownership bypass: admins change status
   only and never edit profile content.
4. **Editing.** Amended by owner decision on 2026-10-11
   (`docs/decisions/2026-10-11-tutor-profile-edits.md`): an approved tutor's edit
   needs no re-review and the profile stays `approved`; a rejected tutor may edit
   and save, which returns the profile to `pending`. `suspended` stays read-only.
5. **Review is a bare audited transition.** No checklist, document, reason text or
   "verified" claim. The real screening process is `[OPEN]` (PRD TUT-01); the admin
   screen says so. This is local synthetic data only.
6. **Catalog.** `subjects` carries name, slug, category, `is_active`. The agreed
   launch catalog is inserted by migration as reference data: Math, Science,
   English (academic core); SAT, ACT, Entrance exams (test preparation); Homework
   help, Study skills (academic support). Admins create rows only in the
   specialized category. Renaming and deleting are not built.
7. **Deactivation.** A deactivated subject cannot be chosen on save and is excluded
   by the eligibility query. Existing offering rows are kept.
8. **Levels** are stored per offering as a checked `text[]` of `elementary`,
   `middle_school`, `high_school`, `college_support`, as `architecture.md` §9.2
   proposes.
9. **Fields.** Exactly the M3.2 list. Teaching languages, public slug, photo,
   meeting preference and prices are not added. Exact mandatory profile fields
   remain a P1 open product decision; these are the recommended default.
10. **Existing pattern reused.** Route handler → `sameLocalOrigin` → role guard →
    Zod strict input → feature service → Drizzle transaction → `{ message }` JSON,
    as the account feature does. Native controls and the native `<dialog>`; no
    generated shadcn primitive (design decision 14 remains open).

## Scope

Included:

- Schema and reviewed migration: `subjects`, `tutor_profiles`, `tutor_subjects`,
  widened `audit_events` action check plus `target_subject_id`; launch catalog
  rows; runtime grants for the three new tables.
- `src/features/subjects/` and `src/features/tutors/` services and handlers;
  API routes `PUT /api/tutor/profile`,
  `POST /api/admin/tutor-applications/[profileId]`, `POST /api/admin/subjects`,
  `PATCH /api/admin/subjects/[subjectId]`.
- Pages: `/tutor` (review-state notice and profile link), `/tutor/profile`,
  `/admin` (work-area links), `/admin/tutors`, `/admin/tutors/[profileId]`,
  `/admin/subjects`. All dynamic, `no-store`, `noindex`.
- One synthetic pending application for the tutor fixture in `db:seed`.
- Unit, real-PostgreSQL integration and browser tests; README, operations guide,
  architecture, build plan and tracker updates.

Excluded: public `/subjects`, `/tutors`, `/tutors/[slug]`, `/become-a-tutor`
changes, matching, search, availability, learners, bookings, meeting links,
email, payments, uploads, review reasons, subject rename/delete, sortable admin
columns, the admin mobile menu, and any way for a client to obtain a role.

## Invariants

- Every read and write authorizes on the server: verified, active identity, the
  required role, and ownership. A hidden control is not authorization.
- A client cannot set `review_status`, `userId` or a profile id. Unknown body
  fields are rejected.
- Tutor A cannot read or change Tutor B's profile through any endpoint.
- Not-found and not-authorized admin lookups do not reveal private profile data.
- Public eligibility requires all of: `approved` status, an active verified
  account, and at least one offering on an active subject.
- Tutor-written text is rendered as text, never as HTML.
- No learner data, meeting link, price, rating or verification claim is introduced.

## Data

- `subjects`: `id uuid` PK, `slug` unique (lowercase kebab check), `name` (unique
  on `lower(name)`, 2–60 chars), `category` check, `is_active` default true,
  timestamps.
- `tutor_profiles`: `id uuid` PK, `user_id` unique FK→`user` **on delete
  restrict**, `headline` (1–100), `bio` (1–1500), `teaching_background` (1–1000),
  `timezone`, `review_status` check default `pending`, timestamps; index on
  `review_status`.
- `tutor_subjects`: PK (`tutor_id`, `subject_id`), FK→`tutor_profiles` cascade,
  FK→`subjects` restrict, `levels text[]` check (1–4 allowed values), `specialty`
  (≤120, nullable); index on `subject_id`.
- `audit_events`: action check extended with `tutor_profile.submitted`,
  `tutor_profile.updated`, `tutor_review.approved|rejected|suspended|reinstated|reopened`,
  `subject.created|activated|deactivated`; new nullable `target_subject_id`.
- Runtime grants: `subjects` and `tutor_profiles` SELECT/INSERT/UPDATE;
  `tutor_subjects` SELECT/INSERT/UPDATE/DELETE. No DELETE on profiles or subjects.
- Forward-only local migration. Rollback is stopping the app and keeping data; no
  destructive reset is provided.

## Failure states

- Not signed in → redirect to sign-in with a safe return path (pages) or 401 (API).
- Wrong role, unverified or suspended account → unavailable page or 403.
- Invalid input or unknown field → 400 with a field-level instruction.
- Subject missing or inactive at save → 400; the form reloads the current list.
- Read-only profile edit, illegal transition, stale review → 409.
- Self-review → 403. Unknown profile or subject id → 404.
- Duplicate subject name → 409. Database unavailable → 503 with a safe message.

## Build order

1. Schema, generated migration, launch-catalog migration, grants.
2. Subject and tutor services with their rule errors; eligibility query.
3. Handlers and API routes.
4. Workspace guard helper, tutor pages and form, admin pages, confirm dialog.
5. Fixture seed, tests, documentation, tracker.

## Verification plan — not yet executed

- Migration applies to dev and test databases and reruns idempotently; generated
  SQL reviewed; runtime role cannot delete profiles/subjects or write roles.
- `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.
- Integration, real PostgreSQL: submit and edit own application; forged
  `reviewStatus`/`userId`/`id` rejected; anonymous, non-tutor, unverified and
  suspended denied; Tutor A cannot change Tutor B; inactive or unknown subject and
  bad levels rejected; DB check constraints; every legal and illegal transition;
  tutor cannot review; admin cannot self-review; concurrent approve/reject yields
  one winner; subject create/duplicate/toggle and non-admin denial; audit rows;
  eligibility excludes pending, rejected, suspended, suspended-account and
  inactive-subject cases; cross-origin writes refused.
- Browser: tutor submits an application; admin approves it through the dialog;
  tutor sees the new state; non-admin and anonymous are kept out; a deactivated
  subject leaves the tutor form; no overflow at 1440, 390 and 320; axe; keyboard.
- UI greps and the Impeccable detector from `ui-context.md` on changed files.

## Context updates

`architecture.md` (implemented M3 tables note), `build-plan.md` (M3.1–M3.3 local
status), `progress-tracker.md`, `README.md`, `docs/operations/local-development.md`.
No product decision is promoted from `[OPEN]`.

## Risks and open decisions

- Tutor screening policy, incident owner: `[OPEN]`, founder plus safety/legal.
- Decided 2026-10-11: no re-review after an approved tutor edits; a rejected
  tutor may reapply on their own. No moderation step or reapply limit exists.
- How a new account becomes a tutor: M3.4, needs a safe role-grant mechanism.
- Mandatory profile fields and teaching languages: P1 open.
- Mutation endpoints have no rate limit beyond authentication, as with M2 account
  settings. Acceptable for loopback-only use; revisit before any hosted phase.
- 13 known dependency advisories remain; this slice adds no dependency.

Blueprint ready.
