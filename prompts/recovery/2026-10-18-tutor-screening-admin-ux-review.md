# Learli Recovery — Tutor screening Admin UX review repairs

- **Status:** RESOLVED BY SEPARATE VERIFIER
- **Mode:** Targeted Fix
- **Severity and environment:** High compatibility/integrity defect in the uncommitted local implementation; no production or hosted change inspected
- **Current branch/commit:** `main` at `3ad1933d3904a06bb11a8b37bc3251dd4106420d`, with pre-existing authorized work preserved in the working tree
- **Related work:** M8.10, M3.3, M5.6; TUT-01, ADM-01, NFR-01, NFR-02, NFR-05; `prompts/features/m8-10-tutor-screening-admin-ux.md`

## Expected versus observed

The approved safe slice removes reviewer ownership of receipt identifiers, keeps
idempotent retries compatible with immutable historical checks, renders time-zone
dependent content without hydration errors, and gives an understandable error for
a future check time.

The current implementation instead always forwards
`screening:<requestKey>` to the existing database function. Historical rows can
contain a different immutable `evidence_reference`, while
`record_tutor_screening_check` includes that column in its replay comparison, so
an otherwise exact replay returns a conflict. The same client-selected UUID is
also displayed as the screening receipt even though request-key uniqueness is
scoped to `(actor_user_id, request_key)`, not global. Receipt times use the
runtime's implicit time zone before hydration, allowing server and first-client
markup to differ. The browser checks expiry ordering but does not explain that a
future checked-at value is forbidden; the database then returns the generic
screening-fields error.

## Evidence and confidence

- **Observed:** `src/features/tutor-screening/service.ts` derives the stored and
  displayed reference from `v.requestKey` and projects `ck.evidence_reference`.
- **Observed:** `drizzle/0035_local_operational_workflow.sql` lines 429–435
  scopes request-key uniqueness by actor, compares `prior.evidence_reference`
  during replay, rejects `p_checked > clock_timestamp()`, and lets PostgreSQL
  generate the immutable check row UUID.
- **Observed:** `src/lib/db/schema/tutor-screening.ts` makes the row `id` a UUID
  primary key but has no unique constraint on `evidence_reference`; the existing
  request constraint is `(actor_user_id, request_key)`.
- **Observed:** `src/features/tutor-screening/forms.tsx` formats the pre-hydration
  timestamp with `Intl.DateTimeFormat` and no explicit time zone when
  `useHydrated()` is false, and only compares expiry with checked-at in submit
  validation.
- **Observed:** focused tests cover ordinary conversion and expiry ordering, but
  do not cover a historical-reference replay, a database-owned one-to-one receipt
  identifier, pre-hydration UTC fallback/hydration, or the future-time message.
- **Confidence:** Confirmed through deterministic code and schema analysis.
- **Tests:** Not run by Recover, per the skill boundary.

## Root cause

One identifier was assigned three incompatible meanings: browser idempotency
key, historical evidence reference, and reviewer-visible immutable receipt. The
database deliberately gives the actual check record a separate system-owned UUID.
Separately, a null time-zone argument was treated as permission to use an implicit
runtime default, which is not stable between SSR and the browser.

## Recovery recommendation

Apply a focused repair without a migration:

1. Preserve the optional legacy `reference` request field only for parsing old
   clients, but never trust it for a new record.
2. When calling `record_tutor_screening_check`, pass the already stored
   `evidence_reference` when `(actor_user_id, request_key)` exists; otherwise pass
   the new server-owned compatibility value. This keeps old exact replays exact,
   while all other stored-body fields continue to decide replay versus conflict.
   The existing actor/request uniqueness and advisory lock still serialize a
   first-time concurrent retry.
3. Treat the database-generated check row UUID as the reviewer-visible receipt:
   project `screening:<ck.id>` as a distinct `receiptReference`. Do not expose or
   rewrite historical `evidence_reference` values. The UUID primary key provides
   global uniqueness and a one-to-one link to the immutable record even when two
   actors deliberately reuse the same client request UUID.
4. Format all pre-hydration or unavailable-zone receipt times with explicit
   `timeZone: "UTC"` and a UTC label. After hydration, format with the resolved
   browser IANA zone. Never call `Intl.DateTimeFormat` with an implicit default in
   server-rendered output.
5. Reject `checkedAt > now` in the form with “Choose a check time that is not in
   the future.” and focus the existing alert. Repeat the same rule in the service
   with a `RuleError(400, ...)`; retain the database clock check as the authority
   and generic fallback for races or clock skew.

This approach does not change table shape, stored history, function signatures,
authorization, current policy, or production data. A migration is not required
for the safe slice. If product later requires the legacy
`evidence_reference` column itself to become the public globally unique receipt,
that is a separate data-contract change requiring a reviewed migration/backfill;
do not fold it into this repair.

## Proposed execution by the implementation owner

1. Repair the service call and reviewer projection as above; keep owner/public
   projections free of receipt identifiers.
2. Rename the client-facing DTO/UI field to `receiptReference` so it cannot be
   confused with the preserved legacy evidence column.
3. Make the timestamp fallback explicitly UTC and add future checked-at
   validation in both UI and service.
4. Update only focused Tutor screening tests and any selectors directly affected
   by the approved form change. Preserve unrelated working-tree edits.

## Verification required from the separate Verify stage

- PostgreSQL integration: manually seed or create a legacy check whose
  `evidence_reference != screening:<requestKey>`, replay the exact logical request
  through the service without a client reference, and assert `replayed: true`, no
  extra row/event, unchanged stored reference and revision.
- PostgreSQL integration: assert the reviewer DTO's `receiptReference` equals
  `screening:<check-row-id>` and does not equal a caller-supplied reference or
  depend on request-key identity; assert Tutor-owner and public projections omit it.
- PostgreSQL integration: preserve same-key concurrent replay, changed-body
  conflict, cross-action conflict, assignment/MFA/policy freshness and rollback.
- Component/hydration: server output uses explicit UTC; hydration reports no
  recoverable mismatch; hydrated output may then show the resolved IANA zone.
- Component/service: a future checked-at value receives the exact understandable
  400 message, creates no fetch/receipt/event, focuses the alert, and an expiry
  before checked-at remains rejected.
- Run focused unit/component/integration/E2E checks, then typecheck, lint, format
  check and production build according to the coordinator's verification plan.
- **Status:** NOT RUN BY RECOVER.

## Required decisions and documentation changes

No new product decision is required. Expiry duration, real verification criteria
and provider evidence remain deferred. Update the active blueprint/decision text
to distinguish the system-owned receipt (`screening:<row UUID>`) from the
preserved legacy evidence-reference column after the repair is implemented.

## Approval and outcome

- **Approval:** AUTHORIZED — build-feature delegation; scoped to the user's
  approved Tutor screening Admin UX safe slice and these review repairs
- **Implementation:** Completed by the separate implementation workflow. Recover
  did not implement the repair.
- **Independent review:** Final read-only Review reported **READY FOR
  VERIFICATION** with zero findings.
- **Independent verification:**
  - focused unit/component checks: **61/61 passed**;
  - time-zone helper checks under `TZ=Pacific/Auckland`: **8/8 passed**;
  - focused PostgreSQL checks: **39/39 passed**;
  - direct Playwright Tutor screening run with `--no-deps`: **2/2 passed**;
  - `npm run check`: **passed**, covering 153 files and 2,285 tests, with one
    pre-existing lint warning;
  - production build: **passed**;
  - Impeccable detector: **`[]`**.
- **Browser-chain limitation:** the dependency-chain browser attempt completed 76
  passing checks, then stopped before reaching Tutor screening on an unrelated
  stale copy assertion in `learners.spec`. The direct scoped screening run above
  independently passed.
- **Operations:** No migration, deployment, or production operation was performed.
