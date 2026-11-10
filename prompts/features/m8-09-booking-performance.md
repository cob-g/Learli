# Booking and live-update performance

Status: AUTHORIZED — build-feature delegation, 2026-11-10.

Authority: the owner requested implementation of the supplied measured performance
sequence, starting with slot formatting and then live-update overhead. This is
execution authority, not separate human approval of this generated blueprint.

Repository: /Users/cob/learli, main, cbc55d7, substantial pre-existing uncommitted
work including booking coordination and Parent level updates. Preserve all of it.
Read AGENTS.md and the eight canonical context files. Primary work item M8.9;
related M3.4/5 and M4.6/10, M5.3/4/5; PRD NFR-03/04/05/08/10/11,
BKG-01/02/03/04/05/06, PUB-03 and MATCH-02/03 current acceptance criteria.

## Outcome and scope

Make current booking/rescheduling and idle Student/Parent live updates do less
work, without changing displayed strings, timing, authority or booking rules.
Measure current production-built routes and actual service transactions on an
owned isolated synthetic PostgreSQL environment before editing application code.
Retain a private baseline source copy because HEAD does not include the user's
current working implementation. Save reproducible workload and sanitized results.

1. Establish response, query/connection-wait, session-request and browser samples
   for current search, candidates/rescheduling and all three participant dashboards,
   including several tabs. The old demo benchmark alone is insufficient.
2. Reuse createLessonTimeFormatter once per operation/viewer timezone in booking
   and reschedule maps, including the reschedule page's second viewer-timezone
   display map found during implementation. Keep single-record formatting unchanged.
3. Replace full booking-overview reads in Student/Parent SSE access checks with
   a current identity/role and authorized learner-ID-only projection. Share the
   learner authority predicate with booking reads so local, private and legacy
   modes cannot drift. Initial authentication uses the installed provider;
   subsequent checks validate the bound session directly in PostgreSQL, including
   expiry, verification, account status, role, source and exact guardian/self
   authority. Preserve private packet continuity and all origin checks. Never
   cache authorization across requests. Retain 25s heartbeat, 240s stream lifetime,
   reconnect and 60s browser fallback. Preserve subscribe-gap recovery and generic
   payloads. Trace rate-limit requests without weakening/resetting application
   throttles during measurements.
4. Bound candidate blocking-booking reads to end > first candidate bound and
   start < horizon end plus lesson duration. Keep exclusion, active/provisional
   expiry, screening, database clock, locks and writes intact. Compare plans and
   returned rows with growing irrelevant history. Add no index unless supported
   by actual plans and a separate reviewed additive migration.
5. Measure catalog inventory/query cost and discarded search-slot formatting.
   Change discovery pagination only if that evidence supports additional scope;
   otherwise document the measured reason to defer. Never change truthful counts,
   subject/level conjunction, complete offerings, eligibility or ordering.
6. Profile existing hero/mobile scroll/pointer behavior. Modify effects/assets
   only on demonstrated browser cost. No visual redesign is authorized.

No production/hosted deployment, real user data, external services, new dependency,
shared data/permission cache, weaker security, timing-policy change or support work.
The native formatter objects are operation-local, never cached dates/offsets.

## Reviewable units and failure handling

Keep formatting, authorization projection and availability bounds separate in
the source diff and results. Baseline/build/test artifacts stay ignored/private.
Any material new discovery/index/effect choice returns to planning with measured
evidence. Confirmed failures use Recover before a scoped repair. Do not alter
applied SQL or user sessions to obtain a pass.

## Verification plan

Separate read-only same-agent Review, then executed verification. Exact equality
for ordinary, midnight, invalid-date and DST/non-hour formatting; real PostgreSQL
candidate boundary/expiry/exclusion tests and existing concurrency/ownership suites;
authorized-ID equivalence for legacy/local/private modes, empty/foreign/suspended/
revoked/expired-session cases; commit-only event update/reconnect and hidden-tab
cleanup checks. Check stream access does not query bookings or format dates and
does not repeatedly call provider getSession. Query plans and service transaction
timings include unbounded versus bounded histories; tail bounds include final
lesson end. Compare before/after production routes using identical data/workload,
record raw samples and all failures, and report noisy/no-improvement results.
Run relevant unit/component/integration/browser checks, typecheck, lint, format,
production build. Browser profiling is phone-sized Chromium, not physical-device
or hosted capacity proof. Mark unavailable checks honestly.

## Documentation and handoff

Update progress-tracker after each meaningful unit; record measurements and
limits in docs/operations, technical projection boundaries in architecture only
if changed. No product rule changes. Save ignored memory.md with review and
verification distinguished. Rollback is the three scoped source changes, with
no data conversion required unless an independently justified index is added.

Verification status: NOT RUN — architecture planning only.

## Scoped verification recovery — 2026-11-10

Browser verification exposed a pre-existing confirmed-reschedule invariant bug,
reproduced by the identical pre-performance service. An elapsed original hold
fails bookings_expiry_valid when a replacement is created. Under the already
established BKG-03/05 confirmed-booking semantics, a forward constraint correction
is included solely to allow non-provisional workflow replacements to retain their
exact original finite deadline. No hold renewal, record rewrite, policy, function
body or permission change. This is an explicit exception to the no-schema-change
plan above, not an index or speculative optimization. See
`prompts/recovery/2026-11-10-confirmed-reschedule-expiry.md`. Verify malformed
root/provisional intervals still fail, confirmed reschedule/retry/cancel after
hold succeeds, and fresh/populated migration protection and record preservation
before applying to local operating data. Separate review/verification is required.
