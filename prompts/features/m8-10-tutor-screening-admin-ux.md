# M8.10 — Tutor screening admin UX and receipt integrity

**Status: IMPLEMENTED AND VERIFIED LOCALLY — AUTHORIZED through build-feature
delegation (safe first slice).**

Approval record: on 2026-10-18 the user instructed, “implement that blue print,”
after the coordinator recommended keeping an explicit expiry picker until a real
validity policy is approved. This authorizes normal checked-at/expiry pickers,
automatic UTC conversion, a system-generated internal receipt reference, and
truthful check-state presentation. It does not approve a screening-validity
duration, external verification provider, `Verified` claim, deployment, or
production data change.

## Authority and observed baseline

- User request, 2026-10-18: replace technical Tutor Screening inputs with a
  normal date/time picker, a system-generated evidence reference linked to the
  verification record, policy-calculated expiry, and clear Identity/Eligibility
  states.
- Repository: `/Users/cob/learli`, branch `main`, observed HEAD
  `3ad1933d3904a06bb11a8b37bc3251dd4106420d`.
- The working tree already contains substantial, unrelated authorized Parent-v2
  and master-workflow alignment changes. Preserve them exactly. The existing
  tutor-screening source and tests are not modified at this planning stage.
- Primary work package: **M8.10**, with **M3.3** and **M5.6**. Requirements:
  **TUT-01**, **ADM-01**, **NFR-01**, **NFR-02**, and **NFR-05**.
- Read before implementation: repository `AGENTS.md`; all eight canonical
  context files in their required order; this blueprint; the existing
  `prompts/features/m8-10-screening-safeguarding.md`; and
  `docs/decisions/2026-10-12-screening-safeguarding-readiness.md`. The focused
  repair is governed by
  `prompts/recovery/2026-10-18-tutor-screening-admin-ux-review.md`.

## What we are building

An assigned, MFA-assured Admin reviewer records each required Tutor screening
check through an understandable native form. The reviewer chooses when the
check occurred with a normal local date/time control; the browser clearly names
its time zone and converts the instant to canonical UTC before submission. The
system creates the opaque screening receipt reference. The page presents
Identity and Eligibility check states in plain language, including missing,
current, failed, revoked, and expired states. This safe slice retains an explicit
expiry choice through a normal picker. Policy-calculated expiry remains a later
change after an approved duration exists.

This remains a scoped Admin task UI. It does not introduce document uploads,
third-party identity verification, new Admin authority, or public-launch
screening approval.

## Observed baseline and approved repair

- Before this slice, `src/features/tutor-screening/forms.tsx` asked reviewers to
  type an opaque reference and raw UTC ISO strings and rendered raw check codes.
- The first implementation draft incorrectly treated the browser request key as
  the stored and reviewer-facing receipt. Review confirmed that request-key
  uniqueness is actor-scoped and that this breaks an exact replay when a legacy
  immutable `evidence_reference` differs.
- PostgreSQL already gives every `tutor_screening_checks` row a UUID primary key.
  That database-owned ID is the correct globally unique, one-to-one source for
  the reviewer-facing receipt; no migration is necessary.
- The existing database function still receives `evidence_reference`. The repair
  keeps that field internal, preserves historical values, reuses a stored value
  only for its old exact replay, and gives a new mutation a separate server-owned
  compatibility value.
- Server rendering previously risked using an implicit runtime time zone, and a
  future checked-at value could surface only as a generic database error. The
  repair uses explicit UTC before browser-zone hydration and adds the same clear
  future-time rejection at the client and service boundaries.
- `src/features/tutor-screening/policy.ts` requires `identity` and
  `eligibility`, and its only expiry rule is `all_checks_current`. It contains no
  validity period for either check. `context/prd.md` still leaves real screening
  criteria and provider policy open.

## Language and decisions already established

- **Date/time picker:** a native `datetime-local` control. Its value represents
  the Admin's browser-local wall-clock choice. The UI displays the resolved IANA
  time zone after hydration and submits the selected instant in ISO UTC form.
  Server and first-client receipt rendering use explicit UTC until that zone is
  known.
- **Screening receipt:** the opaque, database-owned
  `screening:<tutor_screening_checks row UUID>` identifier for one immutable
  check row. It is globally one-to-one with that record and independent of the
  browser request key and legacy `evidence_reference`. It is not an uploaded
  document, provider response, URL, or proof that an external identity service
  verified the Tutor.
- **Current check:** the latest receipt for the required check code is passed,
  has begun, and has not expired under the current immutable policy/case round.
- **Verified wording:** until real criteria/provider policy is approved, the
  truthful label is `Identity check — Passed and current` or
  `Eligibility check — Passed and current`. The UI must not imply third-party or
  legal verification that did not occur.

## Scope

### Included

- Replace raw checked-at ISO text with a native local date/time picker.
- Display the browser's IANA time zone and a human-readable UTC conversion.
- Generate the reviewer-facing screening receipt from the database check-row ID
  and remove receipt/evidence-reference ownership from reviewer input.
- Link the generated reference one-to-one with the immutable check receipt.
- Render friendly Identity and Eligibility labels and distinct Missing, Passed
  and current, Failed, Revoked, and Expired states.
- Show check/expiry times to the assigned reviewer in readable local and UTC
  context where those values are available.
- Retain an explicit expiry picker in this slice. Policy-calculated expiry stays
  deferred until a validity duration is approved.
- Preserve MFA, exact reviewer assignment, idempotency, revision, audit/event,
  post-lock policy and public eligibility checks.
- Update focused unit/component/integration/E2E coverage and the affected
  context/progress documentation.

### Excluded

- Choosing real screening criteria, vendors, documents, launch countries, or
  legal obligations.
- Uploading identity documents or storing personal verification content.
- Changing who may review, approve, discover, or book a Tutor.
- Backfilling, relabeling, deleting, or recalculating historical screening
  receipts.
- Activating screening in staging/production or modifying production data.
- Redesigning unrelated Admin or Tutor pages.

## System invariants

- Only the exact currently assigned, active, verified, MFA-assured Admin reviewer
  may record or decide this case; self-review remains denied.
- The client never selects policy version, expiry duration, receipt ID, reviewer,
  Tutor ownership, or eligibility state.
- Each accepted logical mutation creates one immutable receipt/event, and replay
  returns that same receipt without generating another reference.
- Historical `evidence_reference` values and explicit historical expiry instants
  remain unchanged and internal. An existing value is reused only when its old
  actor/request mutation is replayed.
- A current profile approval without every required current check cannot make a
  Tutor discoverable or bookable.
- References never contain names, emails, document details, provider tokens, or
  URLs and never enter public Tutor projections or ordinary logs.
- Failed and revoked checks remain explicit negative receipts. Their retention
  does not silently become positive eligibility.

## Proposed data and API changes

1. Remove `reference` from the form and retain it only as an optional legacy API
   compatibility field that cannot control new storage. For a prior
   `(actor_user_id, request_key)` mutation, pass its unchanged stored
   `evidence_reference` back to `record_tutor_screening_check` so old exact replay
   remains exact. Otherwise create a separate server-owned compatibility value
   for the existing function. Never expose either value as the reviewer receipt.
2. Project the reviewer-facing `receiptReference` as
   `screening:<tutor_screening_checks.id>`. PostgreSQL owns that UUID primary key,
   which gives the visible receipt global uniqueness and a one-to-one link to the
   immutable row. No schema migration, historical rewrite or backfill is required.
3. Continue accepting validated UTC `checkedAt` and `expiresAt` instants after
   the browser converts both native local picker values. Treat a changed request
   body under an existing idempotency key as a conflict exactly as today. Reject
   a future `checkedAt` in the service with the clear 400 response “Choose a check
   time that is not in the future.”; retain the database clock rule for races and
   skew.
4. Extend assigned-reviewer read projection with safe receipt metadata needed by
   the form (`checkedAt`, `expiresAt`, `receiptReference` and derived state).
   Keep the Tutor-owner projection minimal and never expose either receipt
   identifier outside the assigned Admin view.
5. Keep endpoint paths and successful decision behavior stable.

## UI behavior

1. Required-check selector uses human labels: `Identity check` and
   `Eligibility check`; unknown future codes fall back to a safe title-cased
   label without changing authority.
2. Status rows use semantic text and a status tag:
   - no receipt: `Not recorded`;
   - current passed receipt: `Passed and current`;
   - passed but expired: `Expired`;
   - latest failed receipt: `Failed`;
   - latest revoked receipt: `Revoked`.
3. The reviewer chooses `Checked at` through `datetime-local`. The form displays
   `Times entered here use <IANA zone>` and a live `Stored as <UTC instant>`
   preview. Invalid/nonexistent local times are rejected without submission. A
   future value is rejected with “Choose a check time that is not in the future.”
4. `Screening receipt` displays only after persistence as the read-only
   `screening:<database check-row UUID>`, with no editable field. The legacy
   evidence reference is never displayed.
5. The first slice uses a second normal picker for expiry, previews its UTC
   instant, and retains server/database ordering checks. No default duration is
   implied.
6. Preserve native labels, keyboard order, visible focus, pending/disabled state,
   retry identity, focused alerts, confirmation dialog, no-JavaScript notice,
   narrow layouts and 200% text wrapping.
7. Render existing receipt times in explicit UTC during SSR and the first client
   render. After hydration resolves the browser's IANA zone, localize them to
   that zone while retaining UTC context. Never rely on an implicit server zone.

## Failure states

- Browser time zone unavailable or hydration incomplete: format existing receipt
  timestamps explicitly in UTC and label them UTC; do not use an implicit runtime
  zone or guess a geographical zone.
- Invalid, future, nonexistent, or ambiguous selected time: reject before or at
  the server with an understandable error; server/database remain authoritative.
- Missing current policy duration: keep explicit expiry in this slice; never
  invent a default.
- Replay after a lost response: reuse any stored legacy evidence reference for
  database comparison and return the original database-row receipt and expiry.
- Stale revision, revoked assignment, expired MFA/session, policy change, or
  concurrent decision: preserve current conflict/denial behavior and create no
  partial receipt.

## Implementation sequence

1. Add pure time conversion/presentation helpers and focused tests for local
   wall-clock → UTC behavior, invalid values, and stable accessible labels.
2. Narrow the API input and update service/query projections while retaining
   exact authorization and idempotency behavior.
3. Replace the technical inputs and status list in `ScreeningForm` using existing
   Learli fields, status tags and flat panels.
4. Update component, integration and browser tests, then reconcile canonical
   context and progress documentation with actual verified behavior.

## Verification plan for the separate Verify stage

- Focused unit/component: explicit UTC server/first-client rendering followed by
  browser-zone hydration, time-zone display/conversion, invalid/future local
  values, human labels, all derived states, no editable reference/automatic
  expiry, focused errors, retry body stability and accessible control names.
- Focused PostgreSQL integration: database-row receipt linkage, exact legacy
  replay without rewriting its evidence reference, new server-owned compatibility
  value, stale key/body conflict, current-check eligibility, expiry boundary, concurrent
  reviewer mutation, assignment/MFA/policy revocation after lock, rollback and
  historical-row preservation.
- Focused Playwright: assigned Admin records Identity and Eligibility with native
  date/time controls, sees generated receipts/current statuses, approves only
  after both are current; mobile/desktop, keyboard and Axe checks.
- Broader checks: format, lint, typecheck, unit/component suite, affected
  integration suite, production build, relevant Chromium workflow. Run full
  repository suites only when the final diff or failures justify them.
- Operational: no schema migration is expected for this slice. No production
  migration or deployment.
- Verification status: **PASS locally on 2026-10-18.** Final read-only Review
  found no remaining issue. Focused unit/component checks passed 61/61, focused
  PostgreSQL screening checks passed 39/39, direct Chromium screening checks
  passed 2/2, the full repository `npm run check` passed 153 files/2,285 tests,
  the production build passed, and the Impeccable detector returned no finding.
  The dependency-chain browser attempt stopped before screening on an unrelated
  stale Learner copy assertion; the isolated screening project then passed.

## Context updates after implementation

- `context/prd.md` and `context/architecture.md`: only if the policy owner
  approves actual validity/verification semantics.
- `context/ui-context.md`: record the scoped Admin screening form convention if
  the UI ships.
- `context/build-plan.md` and `context/progress-tracker.md`: record exact local
  implementation and executed evidence without closing the real launch gate.
- `docs/decisions/`: add the approved validity policy or a scoped decision that
  automatic expiry remains deferred.

## Deferred decisions

1. **Expiry validity:** the approved validity duration, measured from
   `checked_at`, for `identity` and `eligibility`. Existing policy defines no
   duration. This is owned by Founder plus qualified safety/legal review for real
   launch; a local-only duration may be explicitly authorized without claiming
   production readiness.
2. **Status language:** whether current local checks must use the truthful
   `Passed and current` wording, or whether actual verification criteria/provider
   evidence are being approved so `Verified` becomes accurate.

The authorized first slice does not depend on these deferred decisions. The
reviewer-facing receipt is settled as the existing immutable database check-row
ID; a future external-provider verification record would be a separate feature.
A later automatic-expiry or provider change must return to architecture. No
deployment or production data change is authorized here.
