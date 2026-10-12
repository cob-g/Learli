# Private synthetic reviews recovery

Authority AUTHORIZED — build-feature delegation, Task E local only.
R1: pg-focused-1.log,21PASS/3FAIL of24. Observed session-wait test deliberately
expires the moderator provider session and then exercises a denied read. Better
Auth's real getSession removes expired session rows; an owner UPDATE cannot
restore that deleted provider session. Subsequent role-wait/grant test begins
with401. Preserve the expiry/denied-read assertion and obtain a fresh session
through normal sign-in after the test, without weakening session behavior.
Observed API privateJson supplies no-store but no x-robots-tag. New review
handler should explicitly add noindex rather than changing global auth boundary
or removing assertion. Targeted fix, no reset/production action. Repair then
read-only revised Review and separate focused PG/static/browser verification.
Historical fixture source inspection found tutor_subjects uses levels[]; aligned
owner offering predicate to actual schema before execution, with final current
eligibility statement after all advisory/domain waits. No policy change.

The third independent fixture defect is precision loss copying a PostgreSQL
expires_at through JS Date (milliseconds). A's replacement constraint correctly
refuses changed microseconds. Repair fixture INSERT SELECT to preserve exact
original DB value; do not alter provider constraint or expected head assertions.
R1 diagnosis returned to implementation: repaired exact microsecond fixture copy,
obtained replacement session through genuine sign-in after expired-session read,
and added review-only noindex header on every response. No assertions removed.

R2: final Verify PG-focused-2PASS48/48 (25review +23provider lifecycle). Full
check-1 stopped at formatting in new journal append/owned fixture tooling before
lint/types/tests. Targeted formatter repair only, preserving runtime semantics.
Read-only revised Review retains READY FOR VERIFICATION; PG evidence remains
applicable because formatting does not change statements/values. Broad checks rerun.

R3: check-2formatPASS then lintFAIL on static admin queue anchor. Use the
framework Link without prefetch for that navigation; sensitive dynamic review
links and full-document result replacement remain. No lint rule disabled.
Revised read-only Review READY FOR VERIFICATION; UI browser evidence pending.

R4: check-3format/lint/typesPASS and915unit/componentPASS; one inherited
root-owned migration-count assertion expected17/current19FAIL. Do not change
or repeat that known shared assertion. Root supplied in-progress compatibility
feedback: guardian return link defaults to student in provider route. Correct
private authorized DTO to derive learner-management scope and use existing
bookingDetailPath, with actual browser return-navigation assertion. No role
parameter trusted or booking-detail provider edit. Revised Review retains
READY FOR VERIFICATION. Rerun affected static/PG/build/browser.

R5: browser-1result1PASS/4FAIL. Actual no-JS awaited/disabled POST casePASS.
Three keyboard cases left native rating at placeholder: Chromium/macOS select
requires Enter to commit open-menu arrows before Tab. Add that native keyboard
commit and assert actual numeric selection. Uncertain retry reached correct
application alert but strict locator included Next route-announcer alert; scope
to expected feedback text while retaining visibility/focus assertions. Test-only
repair, no application behavior/authorization change. Preserve browser1artifacts,
revised read-only Review READY FOR VERIFICATION; rerun all5affected browser cases.

R6: browser-2again1PASS/4FAIL. After two select attempts, reclassified native
headless keyboard assumption as unproven harness behavior: assert hydration and
actual focus first, use native numeric type selection and observe value before
Tab. No programmatic selection substitutes for keyboard assertion. Actual
uncertainty focus defect is now observed: requestAnimationFrame could run before
React committed the alert, unlike jsdom. Repair effect keyed by committed message
focuses the mounted feedback; retain all visibility/focus checks. The stale-alert
locator also accidentally composed contradictory filters; remove wrong filter.
Focused component/build and real browser reverify required; no guard weakening.

R7: effect repair omitted its import due mismatched text replacement. Component2
and build2FAIL useEffect undefined; browser3NOT RUN (server requires valid build).
Targeted add React import, inspect result, review and repeat component/build before
browser. Both failed logs retained; build-dependent checks now gated on exit0.

R8: browser4native numeric keyboard/focus/submission/text/axe and guardian
return URL succeeded across3viewports; those tests then failed guessed provider
heading (actual frozen label Fixture completion). Uncertainty focus and stale
moderation reached correctly; privacy flow timed out on guessed auth label
(actual Test email). Source inspected; correct test selectors to actual approved
provider text without reducing assertion. No application source change. All
original browser4artifacts/screenshots retained. Review remains ready.

R9: browser5result2PASS/3FAIL only guessed No reviews yet copy. Coordinator
approved truthful frozen public omission: assert actual absence of rating/review
aggregates, private token and learner metadata on unchanged directory/profile.
No invented zero-real-review claim/public source edit. Preserve original copy
failure and subsequent evidence. Entire5case browser run required.
