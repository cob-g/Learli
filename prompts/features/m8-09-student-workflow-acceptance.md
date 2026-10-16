# M8.9 — Independent College Student onboarding and workflow acceptance

## Authority and baseline

2026-10-16: owner approved the Student cross-check recommendation (“ok approve
go for recommendation”): add a clear College Student onboarding entry, correct
Parent/Student role-view filtering, and execute dedicated Student browser
acceptance including admission, Science/College Support discovery, booking,
privacy, cancellation/rescheduling and completed history.

**AUTHORIZED — build-feature delegation**. This records authority from the
requested implementation; it is not separate human inspection of this generated
blueprint. Owner-approved private fictional audience/payments-disabled scope and
assigned-Tutor post-end completion remain resolved. No further policy choice is
needed for this bounded software/test slice.

Repository `/Users/cob/learli`, existing branch
`feature/staging-interface-cleanup-20261016`, HEAD `572cf4d`, with preserved mixed
uncommitted interface/onboarding/completion/private-workflow work. Compare this
unit with its exact dirty baseline, not HEAD alone. Do not commit, merge, reset,
deploy, purge accounts or modify provider state.

## Requirements and intended outcome

Primary M8.9; related M2.4/M2.9, M4 independent learner/booking and M5 coordination.
PRD AUTH-01–05, FAM-02/04, PUB-03/04, BKG-01–07, MEET-01–03 and OPS-01–03.
Read AGENTS.md and the eight canonical context files in order; reuse unchanged
context already read in the preceding feature/cross-check. PRD governs behavior;
architecture and existing private packet govern authority and environment.

An eligible fictional College learner can choose that intent during signup,
verify and sign in, request independent admission, see pending review, and reach
their Student workspace after current assigned eligibility review. Student-only
accounts never gain Parent/Tutor/Admin authority from that intent. Existing
accounts can reach the same setup from Account settings. Preserve a valid public
tutor/subject/time continuation across signup, verification and admission.

## Existing evidence and corrections

- Signup currently offers Choose later/Parent only. Parent continuation is an
  existing client-safe pattern; generic signup grants no roles.
- Independent admission already creates inactive College Support profiles and
  grants Student only through assigned MFA eligibility authorization, without
  guardian links. Ordinary defaults remain disabled without a private packet.
- Learner edits already limit reviewed profiles to display name/timezone; College
  Support remains locked. Reuse this, not a new Student data model or age form.
- Readiness booking reads currently share one generic learner-authority predicate
  between guardian and Student scopes; the learner aggregation has the same
  omission. A legitimate dual-role account can mix its own authorized records
  across views. Add management/identity scope in both places, retaining all current
  SQL/session/role/private-packet authority. This is not a cross-account leak claim.
- The normal-build private browser case covers Parent/Tutor only. Old College
  tests use fixtures/mirrors and do not establish this connected Student journey.

## Minimal implementation

1. Add client-safe College onboarding intent/continuation helper and a focused
   `/student/onboarding` entry (proposed module `features/student-onboarding`).
   It must require verified current identity; show the existing disabled state
   when intake is unavailable; guide to independent admission or current request
   status. Reuse existing admission UI/services with a narrowly scoped initial or
   fixed self-management prop. No new role-grant endpoint or SQL function.
2. Offer College Student in signup and Account settings. Preserve the existing
   Parent and Choose later behavior, safe redirects, provider callbacks and MFA
   continuation. Selecting an intent is not eligibility or authorization. Expose
   a Student workspace link only once current access is authorized; do not claim
   dashboard readiness merely from a submitted request or a stale role.
3. Fix `features/bookings/read-query.ts` readiness record and learner predicates:
   Student scope is self-managed, owned by the actor, College Support; guardian
   scope is guardian-managed and retains its current authorized relationship;
   Tutor behavior stays assigned-booking scope. A wrong scope must not reveal
   details, aggregates, learner options or history. Keep the local-fixture paths.
4. Add deterministic actual-PostgreSQL dual-role regressions, including list,
   overview, detail and learner options, and direct foreign-account denial. Show
   the new regression fails before the predicate repair when practical.
5. Add `tests/e2e/private-fictional-student.spec.ts` (proposed) to the existing
   normal-build private configuration, serially alongside the Parent/Tutor case.
   Extend only the finite synthetic audience with disjoint Student-run accounts.
   Use the actual provider verification, UI admission, assigned MFA admin review,
   Tutor application/screening, availability, directory and booking routes.
6. Browser acceptance must cover two independent Students, no guardian links,
   pending/no premature role, owned profile save/refresh, Science/College Support
   search, selected booking persistence, same-key retry/one reservation,
   assigned-admin confirmation, Student/Tutor dashboard/details, private link
   save/reopen with intercepted fictional destination, cross-account/role/logged
   out denials, conflicting slot rejection, cancel and replacement/history.
7. Verify post-end Tutor completion and Student completed history through a
   separately identified, already-ended synthetic historical booking fixture
   owned by the same approved Student/Tutor. Invoke real Tutor UI completion and
   Student reads. This fixture is not the new future booking, real elapsed lesson,
   video attendance or a complete fresh-booking-duration browser claim. Reuse
   existing owned fixture guards; an optional subject slug on the existing helper
   is acceptable, defaulting to Math for old callers. Do not move production time,
   shorten policy periods, fake eligibility or weaken current mutation checks.
8. Correct the ten-step Student checklist, record actual evidence/limits and
   update governing docs/tracker. Use College Support, request/provisional then
   assigned confirmation, assigned-Tutor completion, pricing Not Applicable,
   and replacement records as audited versions rather than duplicate lessons.

## Invariants, failures and exclusions

All identity, active account, verified email, finite audience, immutable policy,
current eligibility/evidence, ownership, assigned MFA review, UTC/IANA time,
database exclusion/transactions, safe idempotency/revisions and post-wait checks
remain. No migrations, grants, dependency changes or new business policies are
planned. No independent minor intake, real-age verification, real-family policy,
payments, photos/uploads, real mail/video, hosted activation or deployment.

Unsafe/duplicate return fields must be normalized or rejected without open
redirects or granting access. A pending/rejected/revoked admission must not offer
current Student access. An uncertain request retains existing safe retry/status
behavior. Rescheduling retires the prior head and link, preserves logical history
and original confirmed/provisional semantics, and needs a fresh private link.

## Separate verification plan — NOT RUN in Architect

- Run current repository check (format/lint/typecheck/unit/component), production
  build and relevant existing Parent continuation/admission tests.
- Actual owned local PostgreSQL: new dual-role regression plus family dashboard,
  booking reads/overview, independent admission, private workflow scope, policy
  booking/overlap/retries, meeting links and Tutor completion suites.
- Normal-build private Playwright: existing Parent/Tutor case and new Student
  case, one worker/no production traffic. Synthetic proofs/links stay private,
  trace/video disabled and fake destinations intercepted. Check narrow and wide
  onboarding/dashboard layouts plus labels, keyboard focus and Axe as applicable.
- Independently review the exact feature delta against this preserved baseline;
  review is read-only and distinct from executed verification. Rerun affected
  checks after repairs and final integration. Record failures honestly.
- Real hosted target, Resend delivery and actual Zoom/Meet connectivity remain
  unverified. Preserve the owner preview and stop only test services owned here.

## Acceptance and handoff

The slice is complete locally when College intent reaches reviewed admission
without early authority, both role views are scoped in real SQL, dedicated Student
and existing Parent/Tutor normal-build acceptance pass, relevant database/static/
build checks pass, independent review has no open blocking findings, and docs and
local Remember match the actual verified state.

Implementation owns PRD AUTH/FAM/OPS clarification, M8.9 build-plan entry, a concise
decision/checklist/results record and progress tracker. No milestone launch gate
is checked complete. Preserve all earlier QA/history and dirty source bytes
outside this unit; rollback is the scoped delta only, never a repository reset.

Architect stage status: blueprint ready; verification NOT RUN. Return to the
build-feature coordinator for separate implementation, review and verification.
