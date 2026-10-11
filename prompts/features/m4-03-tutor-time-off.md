# M4.3 — Tutor time off

Status: **AUTHORIZED — build-feature delegation (2026-10-11)**.
Authority: dispatched full feature workflow for owner-managed dated unavailability,
local synthetic `.test` development only. This is execution authority, not separate
human blueprint approval. Baseline `3a055deff54149be48a91b44237d0e28b26f3405`,
clean branch `cob-g/m4-3-time-off`.

## Outcome and scope

Both UI and backend/database: a verified active tutor adds and removes dated time
off from a private page linked to weekly availability. It suppresses affected
schedule intervals and candidate times while preserving weekly hours. Trace:
TUT-05/M4.3, AUTH-03, MATCH-03, NFR-01/02/03/05/06/11, QA-03/08/19/20.
Pending/rejected tutor profiles may prepare a schedule; suspended profiles may
read their own time off but cannot mutate it, following weekly availability.

No booking table, cancellation, sensitive reason, prices, holds, real onboarding,
public slot UI, cloud service, external email, commit, merge, push or deployment.
Existing repeating windows and all authorization/testing guards are preserved.

## Technical decisions

- `tutor_availability_exceptions`: UUID id, tutor FK, concrete timestamp-with-zone
  `start_at_utc`, `end_at_utc`, `created_at`. Half-open intervals, finite valid
  supported dates, end > start, unique tutor/start/end. Index tutor/start.
- Minimal reversible add/remove rather than a new calendar editor. Overlapping
  exceptions have union semantics; removal removes only the selected interval.
  Technical per-owner row bound (128) prevents unbounded reads; not a booking or
  retention policy. Past records are not automatically purged.
- Add takes strict `YYYY-MM-DDTHH:mm` local endpoints and current teaching zone.
  Resolve each against actual IANA rules. Reject nonexistent and ambiguous
  endpoints instead of silently moving or selecting a fold. Interior transitions
  are allowed. Cross-midnight/multi-day ranges use explicit dates.
- Existing UTC intervals never move when the teaching zone changes. Display both
  endpoints with date, local time and offset in the current teaching zone.
- GET `/api/tutor/time-off` returns an owner snapshot. POST accepts strict
  discriminated `add`/`remove`, `version` plus add timezone/endpoints or removal id.
  No submitted tutor/owner ID. Same-origin, bounded JSON, private/no-store replies.
- Lock the owner `tutor_profiles` row FOR UPDATE; recheck editability, expected
  `availability_version` and zone; persist, advance shared revision and audit in
  one transaction. Cross-tab weekly/profile/time-off edits invalidate stale writes.
- Export `readTutorTimeOffIntervals(dbOrTx,tutorId,from,to)` returning
  `{start: Date, end: Date}[]`, predicate `start_at_utc < to AND end_at_utc > from`.
  Caller owns tutor eligibility/authorization. Feed these to engine `busy`.
- Private effective-interval adapter locks profile FOR SHARE for a consistent
  weekly/zone/time-off snapshot and subtracts time off; no lesson policy selected.

## Combined booking integration contract (required, not claimed implemented)

Baseline has no bookings. Booking worker/coordinator receives this contract early.
Booking creation and time-off mutation must lock the SAME tutor profile row FOR
UPDATE before conflict reads. Booking creation rechecks these intervals and rejects
any overlap. Addition of time off must check the booking model's actual active
reservation states and reject overlap before inserting or advancing the revision.
Do not silently cancel, change or delete a booking. Removal adds availability only;
booking conflicts still remain excluded by booking code. Combined integration must
prove both lock/race orders with real PostgreSQL, plus preservation of bookings on
failure. This branch completes baseline schedule suppression only; consuming the
booking model and proving combined behavior remains coordinator-owned integration.

## File ownership and implementation sequence

1. New time-off schema/module/API/page; generated next migration and minimal
   schema export/audit action/runtime grant changes.
2. Strict local conversion and interval subtraction; guarded owner service and
   availability adapter; link from weekly availability and fixed-instant warning.
3. Native labelled form, private empty/populated/error/loading/stale states and
   accessible focus recovery; no shared CSS/auth refactor.
4. Unit and PostgreSQL negative/concurrency/rollback tests; dedicated browser
   configuration/spec plus regressions; operations contract and architecture note.
5. Same-agent read-only Review, separate executed Verify, tracker and ignored memory.

## Verification criteria

Use existing pinned dependencies; assigned owned PostgreSQL 55452, dev HTTP 3012,
test HTTP 3112. Inspect scripts, ports and isolation before setup. Never use 55432.
Run format/lint/typecheck/unit suites, full real PostgreSQL integration suite and
production build; full baseline browser suite plus dedicated time-off suite with
one browser worker. New tests prove date validity, IANA gap/fold/end ordering,
cross-midnight/multi-day/DST transitions, half-open overlap/suppression, anonymous
and wrong-role denial, foreign removal/forged ownership, verification/suspension,
stale zone/version, exactly one winner under simultaneous schedule edits, DB checks
and runtime grants, unchanged weekly rows, and transaction rollback on audit failure.
UI: 320/390/768/1024/1440, 640x400 reflow, axe, keyboard focus, forced colors/reduced
motion, empty/loading/network failure/stale/suspended/no-profile paths. Inspect
screenshots; detector if available; diff/secret/privacy scan. Report actual commands,
counts and limits, never same-agent review as independent/full QA.

## Documentation and handoff

Update architecture §9.4 and own tracker evidence; new operations doc describes
read/lock integration and limits. Keep local report, DB/email/credentials/screenshots
and `memory.md` ignored. Report exact migration/files/fingerprint to coordinator.
No unresolved business decision is needed for this standalone policy-independent
slice; real booking and launch decisions retain their existing gates.
