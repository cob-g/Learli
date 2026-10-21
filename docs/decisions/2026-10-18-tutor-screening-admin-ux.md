# Tutor screening Admin UX and internal receipt ownership

**Date:** 2026-10-18

**Status:** Approved safe first slice; implemented and verified locally

**Blueprint:** `prompts/features/m8-10-tutor-screening-admin-ux.md`

## Decision

The assigned Admin reviewer records a Tutor's required Identity and Eligibility
checks with native local date/time controls. Learli displays the browser's
resolved IANA time zone, converts the selected wall-clock values to UTC before
submission, and shows that UTC representation to the reviewer. Invalid,
nonexistent and ambiguous local times must be rejected explicitly. A future
check time receives the focused message “Choose a check time that is not in the
future.” Receipt timestamps render in explicit UTC on the server and first
client render; after hydration they may use the resolved browser IANA zone.

The reviewer continues to choose an explicit expiry instant in this slice.
Learli must not calculate or suggest a validity period until a screening-duration
policy is approved.

The database-generated screening check row UUID owns the reviewer-facing opaque
receipt: `screening:<database check-row UUID>`. It is globally unique and linked
one-to-one with that immutable row; it is independent of the browser retry key.
The form cannot enter a receipt or evidence reference. The existing
`evidence_reference` column remains immutable and internal. When an old
`(actor_user_id, request_key)` mutation is replayed, the service reuses its
stored legacy evidence reference so the database can recognize the exact prior
body; it never rewrites or exposes that value. A new mutation receives a
server-owned compatibility value for the existing database function. Exact
idempotent replay returns the same check-row receipt. Assigned-reviewer reads may
show this receipt and its checked/expiry timestamps. Tutor-owner reads may show
the timestamps needed to understand the check state, but omit both identifiers.

The UI names the required checks `Identity check` and `Eligibility check` and
uses the explicit states `Not recorded`, `Passed and current`, `Expired`,
`Failed`, and `Revoked`. It does not call a locally recorded check `Verified`.

## Boundaries preserved

- Exact reviewer assignment, current Admin capability, installed-provider MFA,
  policy version, revision checks, idempotency, immutable receipts, audit events,
  and public tutor-eligibility gates remain authoritative.
- No database migration, historical-row rewrite, backfill, deletion, or relabel
  is part of this slice.
- The check-row receipt and legacy evidence reference are internal audit
  identifiers. Neither is a document, URL, provider response, identity proof, or
  claim that a real person was externally verified.
- No document upload, third-party verification integration, additional Admin
  authority, production activation, or production data operation is authorized.

## Decisions still open

TUT-01 and the M8.10 launch gate remain open for the real screening criteria,
approved providers or evidence, jurisdictional and safeguarding requirements,
validity duration for each check, and the conditions under which `Verified`
would be accurate. Those decisions require a separate architecture and policy
approval before automatic expiry or real-user launch work.

## Implementation and rollback

The local source uses the existing database-generated check row, request key,
legacy evidence-reference column and database function; no schema change is
required. Rollback can restore the prior form and request projection without
altering existing screening receipts. Verification evidence and remaining
launch-policy gates are recorded separately in `context/progress-tracker.md`.
