# M3.6 — Availability preferences in guided matching

Status: **AUTHORIZED — build-feature delegation**. Date: 2026-10-11.
Authority: actual dispatched `$build-feature Extend M3.6 rule-based matching with
real availability preferences (PRD MATCH-01, MATCH-02, MATCH-03)` request, under
the user-approved six-feature wave. No separate human blueprint approval.
Baseline: clean `cob-g/m3-6-availability-matching` at
`0c078bf50f9f967b20391ef3640353a7b3897e62`.

## What we are building

A public visitor answers Level, Subject and When on `/get-matched` and sees only
eligible tutors with an actual date-specific time fitting the visitor's answers.
When includes explicit Any time, a viewer IANA zone, seven weekdays and bounded
wall-clock ranges. Back/refresh restore allowlisted visitor filters without any
learner record. College Support and existing core subject choices remain.

## Requirement and milestone mapping

PRD MATCH-01, MATCH-02, MATCH-03; NFR-01/02/03/05/06/09/11; M3.6/M3.7,
consuming M4.2/M4.11. Existing code has two progressive GET questions and uses
the directory's `filterTutors` over `listEligibleTutors`. Weekly schedules,
time off and immutable synthetic reservations already exist. No clarification
of product terminology is required.

## Decisions and invariants

- Reuse the exact directory subject+level filter. Specialized choices stay
  eligible-offering-backed; unsupported core choices give honest no matches.
- Visitor zone is explicit URL state; browser detection only enhances an empty
  native select. No assumption of UTC or server-local zone. With no JavaScript
  visitors choose their zone themselves. No account or learner lookup.
- Time ranges are technical visitor filters, not lesson policy: early morning
  00:00–06:00, morning06:00–12:00, afternoon12:00–18:00, evening18:00–24:00.
  The entire half-open candidate interval must fit the selected range/day.
  Any time ignores other day/range values and still needs a valid zone.
- Reuse the UTC weekly-window expansion engine to filter wall-clock preferences;
  do not generate a second candidate list. DST gaps and repeated hours remain
  actual instants. Sort earliest fitting time, then display name/slug; show at
  most five real rows, no score/rank/guaranteed total. Directory alternative
  links cannot claim they applied availability when they did not.
- Consume Agent4's parent-approved shared privacy-safe actual-date query,
  captured database clock and bounded batch semantics. Import only exact frozen
  file hashes authorized by parent, preserving separate provenance.
- Demo candidate policy remains duration60/step30/notice60/horizon14/TTL10,
  explicitly local simulation. Only unexpired demo_reserved intervals block.
  Preview is advisory and selection must be revalidated by booking service.
- No auth/grant/schema/migration/booking mutation changes, slot-picker edits,
  dependencies/CSS, real users, providers, live booking/consent/payment policy.

## Affected areas and implementation sequence

1. New matching preference validation, safe URL state and pure filtering tests.
2. Extend matching step resolver; add accessible native When form with explicit
   zone, weekday checkboxes and range radios; restore prior answers on Back.
3. Once frozen dependency is authorized, integrate shared batched actual-date
   query into matching results; display truthful reasons and shared LessonTime.
4. Update baseline matching tests for three questions and real availability;
   add PostgreSQL agreement/expiry/DST tests and default browser discovery.
5. Record factual tracker and architecture/PRD implementation notes; no new
   product decisions or milestone-wide completion claim.

## Workflow and failure states

Missing answers lead to the next question. Malformed repeated/scalar/day/zone
answers are safely rejected without echoing values. Explicit error links connect
to native inputs; validation focuses the first invalid group after hydration.
Empty inventory, no fit and database outage remain distinct. When uses the installed Next.js Form GET enhancement (prefetch disabled).
Hydrated submission announces a busy state and keeps the form visible; native full-page GET keeps
core content populated without JavaScript. No automatic streaming boundary
wraps the async matching route. Forms work as plain GET;
navigation URLs carry only known filter values and never private request input.

## Verification plan — NOT RUN in Architect

- Pinned npm ci; own PostgreSQL17.11 cluster55475, dev3035/test3135; full baseline
  0000–0011 migration chain, synthetic records only, no sibling environment.
- `npm run check`, full `npm run test:integration`, `npm run build`, default
  `npm run test:e2e -- --workers=1` including unchanged booking concurrency/
  authorization regressions and new matching suite. No hidden special config.
- Pure validation/URL duplicate bounds, College Support/actual offering pairing,
  Any time vs preference filters, whole-duration/end-exclusive boundaries,
  Manila/Los Angeles DST folds/gaps, Lord Howe half-hour DST and midnight zones.
- Real PostgreSQL: same tutor/time returned by shared profile preview and
  matching; exception suppression; unexpired reservation exclusion, elapsed
  stale demo_reserved inclusion; subject/tutor/account/role revocation agreement;
  query-count guard independent of tutors/days. Provider evidence is imported
  provenance only; consumer agreement runs here.
- Browser three questions, URL Back/refresh, no-JS navigation, invalid inputs,
  results/empty/error/loading, keyboard, axe, 320/390/768/1024/1440 viewports,
  forced colors/reduced motion/reflow; inspect phone+desktop screenshots.
- Scan changed files/client output against actual private values without
  printing them; `git diff --check`; current-state review then Remember save.

## Review, ownership and handoff

Same-agent read-only Review is separate from executed Verify and is not
independent review. Parent owns combined independent review/reconciliation.
Only local memory and ignored report/logs hold detailed evidence. No commit,
push, merge, deployment or reset. Rollback is scoped local file reversion under
parent control; no database mutation is required by matching itself.
Dependency: parent-approved frozen candidate bundle is required for shared imports.
Real commercial/legal/
safeguarding and production launch gates remain OPEN and outside this slice.

Blueprint ready.

### Coordinator contract reconciliation

Parent messages `msg_02e392717ba2`, `msg_420459596c81` and `msg_14592bce429a`
confirm the consumer contract, <=100 complete eligible set in <=5 20-slug batches,
common effective-window filtering, five-per-page actual results, and canonical
`publicProfileHref({tutorSlug,subjectSlug,level,displayTimezone,startAtUtc,endAtUtc})`.
Provider `readPublicCandidates(runtime,input)` returns source/generated clock/
effective range/duration/step and slug-keyed safe times. Its overflow is an
explicit service failure. Parent authorized `public-availability-v1` on 2026-10-11
through the dispatch's durable ask reply, after verifying five exact source hashes
and 64 PostgreSQL cases (55 baseline bookings and 9 provider cases). Only the five
manifest files were copied from the immutable snapshot; their original provider
and snapshot provenance remains separate in `.local/import-provenance.json`.
The shared search horizon bounds candidate start times. Full final intervals are
preserved when fitting viewer preferences, with all batches restricted to their
common start-time window. Pre-render URL canonicalization additionally
removes unknown/malformed input from Next's own serialized route state.

The baseline shared `LessonTime` implements the full date/time/zone form only.
Reuse it within the specified 13rem result time column; do not introduce a second
formatter or alter peer-owned profile/booking presentation for this slice.

### Final executed handoff

Same-agent read-only Review: plan alignment/system/unintended-change PASS,
READY FOR VERIFICATION, with scoped re-reviews in `.local/review.md`; not an
independent review. Executed final check516, real PostgreSQL172 (55 baseline
booking+11 matching), production build and all53 default browser cases PASS.
Exact commands/results/failure history and checksums belong to
`.local/worker-report.md` and `context/progress-tracker.md`. Seven screenshots
inspected, final aligned time column asserted; private-value scan0 matches.
Validated submitted public filters update the When history URL through Next's
native history adapter; controlled When fields restore from that URL on Back.
No account/learner persistence or provider policy was introduced. Parent owns
independent combined reconciliation and any release; no production claim.
