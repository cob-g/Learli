# M8.10 supplement — Cross-role workflow UX alignment

**Status: AUTHORIZED — build-feature delegation.**

Authorization record: on 2026-10-18 the owner approved the coordinator's
recommended five-item UX slice with “ok approve do that.” This authorizes the
bounded presentation, composition, and focused test changes below. It does not
authorize a database migration, a new learner-review policy, a new Tutor
screening claim, payment behavior, deployment, production data changes, commit,
merge, or push.

## Authority and observed baseline

- Repository: `/Users/cob/learli`, branch `main`, observed HEAD
  `3ad1933d3904a06bb11a8b37bc3251dd4106420d`.
- The working tree contains substantial authorized Parent-v2, independent-adult,
  master-workflow, and Tutor-screening work. Preserve every existing change,
  migration, historical record, and test; never reset, discard, or rewrite this
  mixed worktree.
- This slice follows the already approved ordinary workflows: Parent-created
  children and eligible independent adult College Support learners do not need
  routine Admin admission, while old admission requests remain immutable and
  accessible. Tutor publication and booking continue to require the existing
  profile approval, current screening, account, subject, and ownership rules.
- Primary work package: **M8.10 supplemental UX alignment**, with **M4.4/M4.5/M4.9**, **M3.3/M4.1**,
  **M5.2/M5.3/M5.6**, and the existing M8.10 screening UX slice.
- PRD trace: **AUTH-03**, **TUT-01**, **TUT-04**, **TUT-06**,
  **FAM-01/FAM-02/FAM-03**, **BKG-01/BKG-04**, **OPS-01/OPS-02/OPS-03**,
  **ADM-01**, and **NFR-01/NFR-02/NFR-03/NFR-05/NFR-09**.
- Read before implementation: repository `AGENTS.md`; all eight canonical
  context files in their required order; this blueprint;
  `prompts/features/m4-04-master-workflow-alignment.md`;
  `prompts/features/m4-04-automatic-parent-child-onboarding.md`; and
  `prompts/features/m8-10-tutor-screening-admin-ux.md`.

## What we are building

Five connected UX corrections make the implemented Parent, Student, Tutor, and
Admin workflows easier to follow without changing their business rules:

1. A booking-history link returns to the correct guardian or student scope.
2. Ordinary self-service onboarding no longer presents school-style admission
   as a routine navigation task; retained records remain readable under neutral
   historical/exception-review wording.
3. The booking choice form offers only compatible learner, subject, and Tutor
   combinations and uses the established IANA time-zone selector.
4. Tutor availability uses normal native time inputs while submitting the exact
   existing minute-of-week API contract.
5. Tutor and Admin screening surfaces use current, truthful language and show a
   useful readiness sequence derived from authoritative profile, screening,
   availability, and public-eligibility data.

This is an incremental UX alignment. It does not alter admission, screening,
booking, availability, publication, or authorization policy.

## Language and decisions already established

- **Booking scope:** `guardian` means the authenticated Parent is viewing a
  booking through current guardian authority; `student` means an eligible
  self-managed learner. A multi-role account follows the selected learner's
  management mode, not a guessed role.
- **Learner review records:** historical learner-admission rows and genuinely
  exceptional review cases. Ordinary child creation and eligible adult
  onboarding do not enter this queue. Existing route and database names may
  remain internal; user-facing copy must not suggest school enrollment.
- **Compatible booking choice:** one currently authorized learner, one eligible
  Tutor, and one active Tutor offering where the offering contains the learner's
  level and selected subject. Browser filtering helps the user; the existing
  server revalidation remains authoritative.
- **Native time input:** an accessible `input type="time"` representing a local
  wall-clock minute. It converts to the existing integer `startMinute` and
  `endMinute` fields only at the form boundary. “Ends next day” retains the
  existing `+1440` encoding.
- **Tutor readiness:** a truthful coordination checklist in the order Profile →
  Screening → Availability → Public listing. It explains the next action; it
  does not create new eligibility states or override the authoritative public
  Tutor predicate.
- **Screening status:** use `Passed and current`, `Expired`, `Failed`,
  `Revoked`, or `Not recorded`. Do not claim identity or eligibility is
  “Verified” until actual verification criteria/provider policy is approved.

No terminology clarification or additional founder decision is needed for this
slice.

## Scope

### Included

#### 1. Preserve booking-history scope

- Replace the unscoped `Your booking history` destination on the booking page
  with `/bookings?scope=guardian` for a guardian-managed learner and
  `/bookings?scope=student` for a self-managed learner.
- Preserve an explicit safe `scope` hint from Parent/Student workspace entry
  links while choices are incomplete. Once a learner is selected, its trusted
  server-returned `management` value wins over the hint.
- Keep booking detail destinations, server-side record authorization, and list
  query semantics unchanged.

#### 2. Reframe ordinary learner-admission navigation

- Remove `Learner requests` from the ordinary Parent and Student workspace
  sidebar. Keep current non-ordinary/private-test navigation behavior where it
  still represents that environment accurately.
- In ordinary local workflow, rename retained account and Admin entry points to
  neutral wording such as `Earlier learner review records` and `Assigned learner
review records`.
- Use ordinary-workflow page titles and help text that say these records are
  retained historical or exceptional reviews and that new Parent children and
  eligible independent adults use self-service onboarding.
- Preserve direct links, pagination, detail pages, assignment checks, receipts,
  audit history, and every stored admission row. The Parent `My Children` page
  remains the contextual path to older child-request records when they exist.
- Do not redirect, convert, approve, relabel in storage, or delete legacy data.

#### 3. Make booking choices compatible and replace the free-text zone

- Extract the GET choice controls from
  `src/features/booking-workflows/page.tsx` into a focused client component,
  proposed `src/features/booking-workflows/choice-form.tsx`, with pure option
  derivation helpers colocated or in a small proposed
  `choice-options.ts` module.
- Order the dependency clearly as Learner → Subject → Tutor. Subject choices are
  the union of active offerings compatible with the selected learner's level;
  Tutor choices require that same level plus the selected subject.
- Reset a downstream choice when an upstream change makes it invalid. Preserve
  valid deep-linked discovery values and the existing selected-slot hidden
  fields. Never silently substitute a different Tutor, subject, learner, or
  time.
- Use a labeled `<select>` populated by `listTimeZoneOptions` for
  `displayTimezone`; include the account zone and any valid retained query zone.
  Keep the existing server `workflowChoice` IANA validation and account-zone
  behavior.
- Keep the form as a GET form so choices remain shareable and recoverable. With
  JavaScript unavailable, render usable full option sets and let the existing
  server validation reject any incompatible combination; JavaScript enhancement
  must not be the security boundary.
- Provide a truthful empty message when the selected learner level/subject has
  no eligible Tutor. Preserve the existing stale-slot message and do not imply a
  reservation before successful mutation.

#### 4. Use native availability time controls

- Replace both 1,440-option start/end `<select>` controls in
  `src/features/availability/availability-form.tsx` with labeled native
  `type="time"`, `step=60`, required controls.
- Add pure conversion helpers for `HH:mm` ↔ minute-of-day. Invalid or temporarily
  blank draft values must block submission and receive a field error; the form
  must never submit a stale prior numeric value after the visible field is
  cleared.
- Preserve the current `WeeklyWindow` and API payload exactly: `isoWeekday`,
  `startMinute` in `0..1439`, `endMinute` in `1..2879`, version, timezone, and
  windows. For an end time with `Ends next day`, add 1,440 only after parsing the
  local time. Midnight must round-trip correctly.
- Preserve overlap checks across same-day and Sunday/Monday boundaries,
  maximum-window limits, optimistic revision conflict behavior, focus movement,
  pending state, add/remove behavior, time-zone warning, and audit behavior.
- Replace the forced `Use 24-hour times` instruction with locale-neutral copy;
  native controls may render 12- or 24-hour presentation while the persisted
  minute value remains identical.

#### 5. Clarify screening and Tutor readiness

- Replace the stale Admin queue statement that screening “is not decided.” In
  ordinary local workflow, state that current Identity and Eligibility checks
  are required before approval/public eligibility, while real-launch criteria
  and any external provider remain unapproved.
- Extend the bounded Admin Tutor queue read with a safe one-query screening
  summary per assigned application: current required-check count, total required
  count, and case state. Use the same current policy/round/latest-check semantics
  as `readScreening`; do not expose check receipts or private evidence in the
  queue and do not add an N+1 read.
- Show a concise row status and next step, for example `1 of 2 checks current —
record Eligibility check`, `Ready for decision`, or `Screening current`.
  Unknown/future required check codes use safe humanized labels.
- On the Admin detail screening panel, show the same `n of total required checks
current` summary above the existing check cards. Existing buttons and server
  decision rules remain authoritative.
- Add a Tutor-facing readiness summary, preferably a focused proposed
  `src/features/tutors/readiness-summary.tsx`, in the order Profile, Screening,
  Availability, Public listing. Derive:
  - Profile from the existing owned Tutor profile;
  - Screening from the existing owner-safe screening projection/current checks;
  - Availability from `readOwnAvailability` and at least one saved window;
  - Public listing by reusing the exact existing `findEligibleTutor`/public
    eligibility path for the current workflow scope, never by duplicating the
    predicate in React.
- Change the Tutor dashboard's empty-bookings action from always `Set
availability` to the first unmet actionable step. This is guidance only:
  preserve the Tutor's current ability to edit their profile and availability in
  the states already supported.
- Keep owner screening output free of reviewer receipt references. Never imply
  external identity verification, guaranteed publication, or guaranteed
  bookings.

### Excluded

- Schema, migration, seed, runtime-grant, or stored-data changes.
- Admission-policy changes, new exceptional-review intake, historical conversion,
  or routine Admin approval for ordinary Parent/adult flows.
- Screening duration/provider/criteria decisions, document uploads, or use of
  the word `Verified` as a new claim.
- Changes to who can create, confirm, cancel, reschedule, or view a booking.
- Changes to booking conflict prevention, idempotency, payment status, meeting
  links, notifications, or session lifecycle.
- New availability policy, interval encoding, slot duration, calendar sync, or
  deletion of confirmed bookings.
- Broad dashboard redesign, new dependencies, deployment, or production data.

## System invariants

- All protected reads and writes retain their current server-side role,
  ownership, exact assignment, current session/MFA, policy, and post-lock checks.
- UI filtering never grants booking authority. Submission still calls the
  existing server candidate and creation services, which recheck the authorized
  learner, Tutor eligibility, subject/level offering, current availability,
  overlap, policy, and idempotency.
- A booking remains one shared record. Scope changes only the authorized view and
  cannot expose another learner's booking or private meeting information.
- Every historical learner admission, receipt, decision, policy reference, and
  audit record remains byte-for-byte preserved in storage.
- The Tutor readiness display reads authoritative facts. It cannot set approval,
  screening, discoverability, or availability state.
- Existing confirmed bookings survive availability edits exactly as before.
- Payment remains disabled/unapproved; confirmed no-money bookings are never
  represented as paid.

## Affected areas and exact ownership

### Booking scope and compatible selections

- `src/features/booking-workflows/page.tsx`
- proposed `src/features/booking-workflows/choice-form.tsx`
- proposed `src/features/booking-workflows/choice-options.ts` only if pure
  compatibility helpers materially improve testing
- `src/components/workspace/navigation.ts`
- reuse `src/lib/time/zones.ts`; do not duplicate the zone catalog
- focused component/unit tests in existing booking-workflow test files and
  applicable Parent/Student Playwright workflow files

### Legacy learner-review presentation

- `src/components/workspace/navigation.ts`
- `src/features/learner-admission/navigation.tsx`
- `src/app/(workspace)/account/page.tsx`
- `src/app/(workspace)/learner-admission/page.tsx`
- `src/app/(workspace)/admin/learner-admission/page.tsx`
- `src/app/(workspace)/admin/page.tsx`
- `src/app/(workspace)/parent/children/page.tsx`
- related workspace/admission/component tests; no learner-admission service,
  schema, route handler, or migration change is expected

### Availability controls

- `src/features/availability/availability-form.tsx`
- `src/features/availability/input.ts` only for pure conversion/error mapping if
  that keeps one source of validation truth; server schema limits remain stable
- `tests/e2e/availability.spec.ts` and focused unit/component coverage

### Screening/readiness presentation

- `src/app/(workspace)/admin/tutors/page.tsx`
- `src/app/(workspace)/admin/tutors/[profileId]/page.tsx` only if composition
  props need adjustment
- `src/features/tutors/review.ts`
- `src/features/tutor-screening/forms.tsx`
- `src/features/tutors/booking-workspace.ts`
- `src/app/(workspace)/tutor/page.tsx`
- `src/features/tutors/booking-agenda.tsx`
- proposed `src/features/tutors/readiness-summary.tsx`
- reuse `src/features/tutors/eligibility.ts`,
  `src/features/tutor-screening/service.ts`, and
  `src/features/availability/service.ts` without weakening their contracts
- focused queue, screening, Tutor dashboard, service, and Playwright tests

## Data and authorization changes

- **Database/schema/migration:** None.
- **API mutation contracts:** None.
- **Booking creation payload:** unchanged.
- **Availability save payload:** unchanged.
- **Admission and screening rows:** unchanged.
- **Read projections:** add only the minimum safe screening count/state fields to
  the assigned Admin Tutor queue and the minimum owner-safe readiness fields to
  Tutor dashboard composition. Do not include evidence references, private
  documents, emails, learner details, or meeting links.
- **Denied cases:** retain indistinguishable missing/forbidden behavior and all
  existing cross-role/cross-record denials.

## Workflow and failure states

1. Parent/Student enters booking from its workspace; an explicit scope hint is
   retained until a trusted learner is selected. The selected learner's stored
   management mode then controls the history destination.
2. Choosing a learner filters subjects by level; choosing a subject filters
   Tutors by the exact offering. An upstream change clears incompatible
   downstream values and any now-invalid selected slot. The server still rejects
   stale or forged combinations.
3. An unsupported or tampered time-zone query is not offered or submitted as a
   valid option; the established schema returns the normal field/error behavior.
4. Native availability fields retain visible drafts. Empty/invalid values produce
   focused errors, while valid values map to the same integers. A concurrent
   version change returns the existing reload-and-review conflict.
5. Screening and public-listing facts can change between reads. Each refresh
   rebuilds the readiness summary from current authoritative data; the UI never
   caches or mutates a derived completion state.
6. If readiness data cannot be safely loaded, show the existing unavailable or
   retry surface and do not optimistically mark a step complete.

## How to build it

1. Add pure booking-option derivation and availability time-conversion helpers
   with focused tests before replacing controls.
2. Implement the scoped booking GET form and explicit history-scope propagation,
   preserving deep links, no-JavaScript safety, stale-slot behavior, and server
   validation.
3. Update ordinary-workflow navigation and learner-review copy while retaining
   direct historical access and all non-ordinary environment behavior.
4. Replace availability minute selects with native time drafts mapped to the
   unchanged numeric payload; update the focused interaction coverage.
5. Add the bounded Admin queue readiness projection and shared presentation
   summary, then compose the owner-safe Tutor checklist and next-action CTA from
   existing services.
6. Reconcile affected tests and approved context documents. Review the final
   diff independently before the separate verification stage.

Independent implementation workers may split steps 2–4 because their primary
files do not overlap. Step 5 owns shared Tutor screening/review files and should
be integrated after the M8.10 changes are preserved. The coordinator owns
`src/components/workspace/navigation.ts`, shared docs, and final integration to
avoid collisions.

## Acceptance criteria

1. From a Parent booking flow, `Your booking history` opens
   `/bookings?scope=guardian`; a Student flow opens `scope=student`; a selected
   learner on a multi-role account determines the scope.
2. Ordinary Parent/Student navigation does not advertise routine learner
   admission. Existing records remain accessible through clearly named
   historical/exception review surfaces, including pagination and direct detail
   URLs.
3. A learner level can only be paired in the enhanced UI with subjects and
   Tutors that have one matching active offering. Forged combinations remain
   server-denied.
4. Booking time zone is a labeled IANA selector using the established zone list;
   the saved/query value and displayed slots retain the chosen zone.
5. Availability uses native time inputs and round-trips ordinary, midnight, and
   overnight windows to exactly the same stored integers. Empty/invalid input,
   overlap, and stale version errors remain understandable and focused.
6. Admin Tutor queue copy no longer says screening is undecided. Every row shows
   truthful current-check progress and a useful next step without exposing
   evidence.
7. Tutor dashboard shows Profile → Screening → Availability → Public listing
   using current authoritative facts and routes its empty-state action to the
   first unmet actionable step.
8. No surface claims external verification, payment, school admission, or
   production readiness. Existing role/ownership/privacy behavior remains
   unchanged.
9. Phone and desktop layouts have no horizontal overflow, controls are labeled,
   keyboard usable, focus-visible, and understandable at 200% text zoom.

## Verification plan for the separate verification skill — DO NOT EXECUTE

### Automated checks to run later

- Focused unit/component tests:
  - option derivation across learner levels, subjects, Tutors, invalid retained
    query values, and multi-role scope;
  - timezone select labeling and retained valid zone;
  - `HH:mm` conversion, midnight, overnight `+1440`, blank/invalid drafts, field
    focus, overlap errors, save success, and stale version;
  - ordinary versus private-workflow navigation labels and retained direct
    history access;
  - screening readiness counts/next-step labels and Tutor checklist/CTA states.
- Focused PostgreSQL integration tests:
  - Admin queue count/state projection matches the same latest/current
    check semantics as `readScreening` at expiry boundaries and remains
    assignment-scoped;
  - owner readiness cannot expose reviewer receipt references;
  - existing booking combination authorization, overlap/idempotency, and
    availability persistence tests remain green. No new migration test is
    expected.
- Focused Playwright:
  - Parent and Student booking selection/history destinations;
  - incompatible choice reset, truthful zero-result state, deep-link retention,
    and IANA-zone slot display;
  - Tutor native-time save/refresh, overnight window, validation, phone/desktop,
    keyboard and Axe checks;
  - Admin queue/detail readiness plus Tutor checklist and first-unmet CTA;
  - legacy learner-review records remain readable while routine navigation is
    absent/reworded.
- Broader repository checks: format, lint, TypeScript, affected Vitest and actual
  PostgreSQL suites, production build, and the relevant Parent/Student/Tutor/Admin
  Chromium workflows. Run broader suites only when the final diff or a failure
  justifies them.

### Manual checks to run later

- At 320/390 and desktop widths, inspect the cascading booking form, long Tutor
  and time-zone labels, availability time controls, historical-review copy, queue
  table, and readiness checklist.
- Keyboard through every changed control; verify labels, error focus, disabled
  state, empty state, refresh persistence, and 200% text zoom.
- Confirm a real browser's localized native time widget does not change the
  integer wall-clock value or UTC slot calculation.

### Operational checks to run later

- Confirm `git diff --check` and no migration/journal/package/secret change from
  this slice.
- Use only the repository-owned local/test PostgreSQL target. Do not run against
  production or deploy.

### Evidence expected from verifier

- Exact commands, discovered/pass/fail/skip counts, durations, and distinction
  between new, pre-existing, and environment failures.
- Safe screenshots or accessibility output for representative narrow/desktop
  states if useful; no learner details, meeting links, cookies, or screening
  evidence.
- Final source state/commit and confirmation that the tested tree includes all
  integrated changes.

**Verification status: NOT RUN — architecture planning only.**

## Context updates after verified implementation

- `context/ui-context.md`: document dependent booking selects, native weekly
  time controls, neutral historical-review language, and readiness checklist
  conventions.
- `context/build-plan.md`: add the M8.10 supplemental scoped work note without marking broader
  milestones complete.
- `context/progress-tracker.md`: record only actual implementation state and
  executed evidence after Review and Verification.
- `context/prd.md` and `context/architecture.md`: no behavioral decision change
  is expected. Edit only if implementation reveals a real contradiction; do not
  restate the same approved rules unnecessarily.
- A new decision record is unnecessary unless implementation uncovers a material
  policy or architecture decision.

## Risks and open decisions

- Native time controls render according to browser/OS locale; tests should assert
  values and accessible names rather than a particular visual clock format.
- Cascading controls must preserve public deep links and no-JavaScript fallback;
  clearing an invalid child choice must be explicit and must never auto-book a
  replacement.
- Screening and publication can change between page loads. The summary is a
  current read, not an immutable receipt or guarantee.
- Real Tutor screening criteria, evidence providers, validity duration, and
  launch safeguarding remain open but do not block this truthful local UX slice.

Rollback is the scoped presentation/composition/test/document delta. Because no
schema or stored data changes, rollback must not touch database rows, legacy
admissions, bookings, or the owner's pre-existing work.

## Handoff

Blueprint ready. Scope is **AUTHORIZED — build-feature delegation** for separate
Implementation, read-only Review, executed Verification, and Remember stages.
No unresolved material decision blocks this slice. Any implementation need to
change an admission/screening/booking policy, add a migration, or remove working
behavior must return to architecture and the owner before proceeding.
