# M4.2 — Time-zone and slot-generation library

- **Status:** AUTHORIZED — build-feature delegation
- **Authority:** Repository owner's request of 2026-10-11: "run /build-feature M4.2 time-zone and slot-generation library … New src/lib/time/ with unit tests: IANA validation, tutor-local weekly windows to UTC instants, DST gaps and overlaps, midnight crossing … use built-in Intl rather than a new dependency … make sure to do all the safe rule". This is execution authority for the scoped slice. It is not a claim that the owner separately reviewed this generated blueprint.
- **Work package:** `context/build-plan.md` M4.2 (primary). Supplies the policy-independent engine that M4.1, M4.3, M4.6 and M4.11 will call.
- **PRD:** TUT-04 (time-zone and wall-clock-to-UTC parts), MATCH-03 (schedule, existing-booking exclusion and DST parts), BR-07, NFR-03, QA-08. PRD §10 edge cases "DST makes a proposed local time nonexistent/ambiguous" and "User changes timezone after booking".
- **Type:** Backend, pure library. No UI, database, integration or authorization boundary.
- **Repository:** worktree `/Users/cob/learli-time-utils`, branch `feature/time-utils`, base `d22a061` (equal to `origin/main` when created). Main checkout `/Users/cob/learli` is in use by another session building M3.1–M3.3 and is not written to.

## Implementation Plan — time-zone and slot-generation library

### What we are building

A dependency-free server-and-client-safe module under `src/lib/time/` that (1) decides whether a string is an IANA time-zone identifier Learli accepts for scheduling, (2) turns a tutor's recurring weekly windows, expressed in tutor-local wall-clock time, into concrete UTC intervals for a queried range with correct daylight-saving behavior, and (3) cuts those intervals into candidate lesson times, excluding supplied busy UTC intervals. Later M4 services load rows and call it; this slice stores nothing and renders nothing.

### Requirement and milestone mapping

- PRD: TUT-04, MATCH-03, BR-07, NFR-03; QA-08; §10 DST and time-zone-change edge cases.
- Build plan: M4.2. Prerequisite pieces of M4.1 (window shape) and M4.3 (exclusions) are represented only as plain input types.
- Current repo evidence: `src/lib/time/` does not exist. The only time-zone logic is an inline check in `src/features/account/service.ts` (`accountInput.timezone`) and a `<select>` in `src/features/account/account-form.tsx`. No availability, learner or booking schema exists. Node 24.20.0 with ICU 78.3 and tzdata 2026c; `Temporal` is undefined in this runtime, so `Intl.DateTimeFormat` is the built-in available.

### Language we agreed on

No clarification needed. Terms used below: **window** = one recurring weekly range in tutor-local wall-clock time; **interval** = a half-open UTC range `[start, end)`; **slot** = a candidate lesson time, an interval of fixed real duration (UI term "time", `context/ui-context.md` Terms).

### Decisions made

All are engineering choices inside the requested slice, labelled `[RECOMMENDED]`, recorded under build-feature delegation. None is a founder or policy decision.

1. **Built-in `Intl` only.** No package added; `package.json` and `package-lock.json` are unchanged. Offsets are read from `Intl.DateTimeFormat.formatToParts` numeric fields, never from a hard-coded table.
2. **Window semantics: a window covers exactly the instants at which the tutor's local wall clock reads inside it.** Consequences:
   - Spring-forward gap: skipped local times yield no availability. Nothing is shifted to a later wall-clock time (PRD §10: "never shift silently into wrong time").
   - Fall-back repeat: a repeated local hour is available on both passes, because the wall clock reads inside the window both times. This can produce two intervals for one window on that date.
   - Durations are elapsed real time. A 60-minute slot is 60 real minutes on every date.
3. **Slot duration and step are required arguments with no default.** Lesson duration, lead time and holds are `[OPEN]` (PRD §18). The caller supplies them once approved; minimum notice is expressed by the caller's `from`.
4. **Accepted time-zone identifiers:** the literal `UTC`, or an Area/Location name that `Intl` accepts, excluding the `Etc/` area. Fixed offsets (`+08:00`), offset-style legacy names (`EST`, `GMT`, `Etc/GMT+8`) and unknown names are rejected, following `context/architecture.md` §11 ("IANA timezone", not a fixed offset). The validator is a predicate and does not rewrite the value: this runtime canonicalises `Asia/Kolkata` to `Asia/Calcutta`, so callers store the submitted string.
5. **Window shape:** `{ isoWeekday: 1–7 (Monday = 1), startMinute: 0–1439, endMinute }` with `startMinute < endMinute <= startMinute + 1440`. An `endMinute` above 1440 continues into the next local day. This avoids overloading "end before start" and keeps M4.1 free to choose its column types.
6. **One time zone per call.** If M4.1 stores a zone per availability row, the caller groups rows by zone.
7. **Slot start times step from the beginning of each window on each date,** and again from a clock change inside it, never from the query's `from`. The same times therefore come back whatever range is asked for, so a booking request can be revalidated by regenerating slots around the requested instant. Fit is checked against merged availability, so a lesson may run on into a touching window. `expandWeeklyWindows` returns availability clipped to the queried range.
   - _Revision, 2026-10-11, during implementation:_ the first draft anchored the grid to each merged availability interval and returned intervals unclipped. For unbroken multi-day availability a merged interval has no natural start, so that grid moved with the query range. Corrected before any test was written. Technical correction inside the authorized scope; no product rule changed.
8. **Query range guard of 366 days** as a CPU bound. It is not a booking-horizon policy.
9. **Invalid programmer input throws `RangeError` with a fixed, non-echoing message.** Boundary validation of user input stays with the calling server action, which can reuse the exported predicates.
10. **Isomorphic, no `server-only` import.** The module holds no secrets and no I/O.

### Assumptions

- Offsets are constant between tzdata transitions and no zone has two transitions inside one hour. Offsets are sampled hourly and each change is located by bisection to the second.
- UTC offsets are smaller than 24 hours in magnitude.

### Scope

- Included: `isValidTimeZone`; a per-zone UTC-offset lookup; `isValidWeeklyWindow`; `expandWeeklyWindows` (windows to merged UTC intervals); `generateSlots` (intervals to slots with busy exclusion); unit tests.
- Excluded: any schema, migration, seed, permission helper, route, page or component; `tutor_availability` and exception storage; booking states, holds, lead time, cancellation rules; `LessonTime` display formatting; a time-zone picker; replacing the existing account time-zone check (follow-up dedupe); edits to `context/progress-tracker.md` and the main checkout's `memory.md` until M3 merges.

### System invariants

- Booked and offered instants are UTC; zones are IANA identifiers; no fixed country offset anywhere (`AGENTS.md` §9, `context/architecture.md` §11).
- Output is advisory. The booking service must still recheck eligibility and enforce overlap in PostgreSQL (BKG-02). This library does not replace that constraint.
- No policy constant for duration, notice or holds is introduced.

### Affected areas

- New (proposed names): `src/lib/time/time-zone.ts`, `src/lib/time/availability.ts`, `tests/unit/time-zone.test.ts`, `tests/unit/availability.test.ts`.
- Edited: `context/architecture.md` §11, one short `[RECOMMENDED]` note recording decision 2.
- Untouched: everything else, including `package.json`, `package-lock.json`, `drizzle/`, `src/lib/db/`, `scripts/`, `src/lib/permissions/`, `src/features/`, `src/app/`.

### Data and authorization changes

None.

### Workflow and failure states

- Invalid zone, window, duration, step, date, busy interval, inverted range or range above the guard: `RangeError`.
- `from` equal to `to`, or no windows: empty result.
- Gap day: window shortened or absent. Repeat day: one merged or two separate intervals.
- Windows that touch or overlap, including an overnight window meeting the next day's window, are merged into one availability interval. A slot must fit inside one such interval.
- Busy intervals are half-open: a lesson ending at 10:00 does not block a slot starting at 10:00.

### How to build it

1. `time-zone.ts`: `isValidTimeZone(value: unknown): value is string`; `utcOffsetLookup(timeZone)` returning `(epochMs) => offsetMs`, using one formatter per lookup (no unbounded module cache).
2. `availability.ts`: types `WeeklyWindow`, `UtcInterval`; `isValidWeeklyWindow`; an internal hourly segment scan with bisection; `expandWeeklyWindows({ timeZone, windows, from, to })`; `generateSlots({ timeZone, windows, from, to, slotMinutes, stepMinutes, busy })`.
3. Unit tests with expected UTC instants written as literals taken from settled 2025 transitions (independent of the library), plus an oracle test that compares interval membership against an independently formatted local wall clock across a full year for several zones.
4. Add the `[RECOMMENDED]` note to `context/architecture.md` §11.

### Verification plan for the separate verification stage (DO NOT EXECUTE in Architect)

- Automated: `npm run check` (format check, lint, typecheck, unit and component tests) and `npm run build`, in the worktree. Re-run `npm test` with `TZ=America/New_York` and `TZ=Asia/Manila` to show results do not depend on the host zone. Confirm `git diff` leaves `package.json` and `package-lock.json` untouched.
- Required cases: accepted and rejected identifiers; offsets either side of a transition, including 30- and 45-minute zones; Manila tutor seen from California either side of a US transition (QA-08); gap (window inside, straddling start, straddling end); repeat (inside, straddling start, straddling end, spanning); a 30-minute shift zone; a zone whose transition is at local midnight in both directions; a skipped calendar day; overnight windows across both transitions; merge of adjacent and overlapping windows; clipping to the range; slot fit, step, `from` and `to` bounds, the same slots from different query ranges (including unbroken multi-day availability), busy exclusion and boundaries; time-zone change with a fixed busy instant; every `RangeError` path.
- Manual: none (no UI).
- Operational: none (no migration, secret or provider).
- **NOT RUN by design:** `npm run test:integration`, `npm run test:e2e`, `db:*`, `local:setup`. They use the shared local PostgreSQL on port 55432 and the test server on port 3100, which belong to the M3 session, and this slice changes no database or UI code.
- Verification status: NOT RUN — architecture planning only.

### Context updates

- `context/architecture.md` §11: add decision 2 as `[RECOMMENDED]`.
- `context/progress-tracker.md`: session entry **deferred** until M3.1–M3.3 merges, to avoid a conflict with the other session's edits. The entry text is kept at the end of this file.
- `README.md`, `context/build-plan.md`, `context/prd.md`: no change.

### Risks and open decisions

- Fall-back double availability (decision 2) is a technical default. If product prefers a single pass, it is a contained change in the window-expansion code. Owner: product, non-blocking.
- Tests pin 2025 transitions, which are settled history, so a future tzdata release should not move them.
- M4.2 is not complete as a work package until M4.1/M4.5 exist and a service feeds real rows and active bookings into this engine. This slice delivers the engine only.
- Still `[OPEN]` and untouched here: lesson duration, lead time, holds, cancellation and rescheduling rules.

### Approval gate

- Status: AUTHORIZED — build-feature delegation (2026-10-11), scope as above.
- No policy sign-off is required for this slice. Committing, pushing, merging and deployment are not authorized by this request.

## Coordinator record — build-feature run of 2026-10-11

Written by the build-feature coordinator after the stages ran. It is not part of the Architect plan above.

### Review (same agent, read-only; not an independent reviewer)

- Target: worktree branch `feature/time-utils` at base `d22a061` plus the uncommitted feature files.
- First pass: plan alignment PASS, unintended-change audit PASS, recommendation CHANGES REQUIRED.
  - F1, Important, `src/lib/time/time-zone.ts`: for instants before year 100 the wall-clock round trip through `Date.UTC` returned an "offset" of centuries. A query straddling 100 BCE and 99 BCE then scanned a day range far beyond the 366-day guard.
  - F2, Minor: one over-long comment line.
- After repair: plan alignment PASS, unintended-change audit PASS, recommendation READY FOR VERIFICATION. No outstanding confirmed finding. Review grants no release clearance.

### Recovery

- F1, targeted fix: reproduced first with regression tests (the range query ran 29.3 s without throwing), then the lookup was changed to refuse any result of a day or more. Those tests now pass in milliseconds.
- `npm run check` failed once at `format:check` because this file was unformatted (Prettier checks `prompts/`). Formatted with the project formatter; no code was involved.
- No test was skipped, weakened or deleted.

### Verification (same agent, separate stage, final state)

- `npm run check`: PASS. Format check, lint, typecheck, and 172 unit and component tests in 7 files (37 existing, 135 new).
- `npm run build`: PASS.
- New tests with host `TZ` set to UTC, America/New_York and Pacific/Apia: PASS, 135 each. Asia/Manila is the machine default. Australia/Lord_Howe also passed before the last three tests were added.
- Fault injection: 19 deliberate single-line bugs were applied one at a time to the two source files. All 19 made the suite fail. Sources were restored and checksum-verified.
- `package.json` and `package-lock.json`: unchanged.
- NOT RUN, by design: `test:integration`, `test:e2e`, `db:*`, `local:setup`. They use the shared PostgreSQL and test port that belong to the M3 session, and this slice changes no database or UI code.
- NOT RUN: remote CI. Nothing was committed or pushed.

### Deferred `context/progress-tracker.md` entry

Add this after M3.1–M3.3 merges, correcting the branch and commit line to what is true then. Also update the tracker's Current Phase, Next Up and Milestone Snapshot rows for M4 at that time.

```markdown
### Session — 2026-10-11 (M4.2 time-zone and slot engine)

- **Owner / branch / PR:** Claude Code for the repository owner · worktree branch `feature/time-utils` from `d22a061` · no commit, push, PR or deployment by this session.
- **Authority:** Owner requested `/build-feature` for the M4.2 library. Blueprint `prompts/features/m4-02-time-zone-slot-library.md` — **AUTHORIZED — build-feature delegation**.
- **Goal:** Policy-independent engine for TUT-04 and MATCH-03: IANA validation, weekly windows to UTC, daylight-saving handling, slot generation.
- **Changed:** `src/lib/time/time-zone.ts`, `src/lib/time/availability.ts`, `tests/unit/time-zone.test.ts`, `tests/unit/availability.test.ts`; `context/architecture.md` §11 window-semantics note. No schema, migration, dependency, route or UI change.
- **Review:** Same-agent read-only review. First pass CHANGES REQUIRED (instants before year 100 bypassed the range guard); repaired; then plan alignment PASS, unintended-change audit PASS, READY FOR VERIFICATION.
- **Verified:** `npm run check` PASS with 172 unit and component tests; `npm run build` PASS; new tests PASS under four host time zones; 19 of 19 injected faults detected. `test:integration`, `test:e2e` and remote CI NOT RUN (parallel-session isolation; no database or UI change).
- **Milestone status:** M4 Planned → **M4.2 engine verified in isolation; work package not complete** until M4.1 and M4.5 supply availability rows and active bookings.
- **Blockers / decisions:** Lesson duration, start-time step, minimum notice and holds remain `[OPEN]`; the engine takes them as arguments. A repeated fall-back hour is offered on both passes as a `[RECOMMENDED]` default.
- **Deployment:** Not deployed.
- **Next session:** M4.1 availability schema and tutor editor. Replace the inline account time-zone check with `isValidTimeZone` as a one-line dedupe.
```
