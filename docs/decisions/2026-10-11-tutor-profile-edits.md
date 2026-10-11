# Tutor profile edits and reapplication

Decision date: 2026-10-11. Status: Approved. Owner and approver: the repository
owner, in the M3.1–M3.3 build session.

## Decisions

1. **An approved tutor's profile edits need no re-review.** The edit takes effect
   and the profile stays `approved`.
2. **A rejected tutor may reapply on their own.** Editing and saving a rejected
   profile returns it to `pending`. An admin can still reopen it.

A suspended profile stays read-only. A tutor still cannot set or choose a review
status; the server makes the one rejected-to-pending move.

## Alternatives considered

- Returning an edited approved profile to `pending`: rejected by the owner.
- Admin-only reopening of a rejected application: replaced by decision 2.

## Impact

- Once profiles are public (M3.4), an approved tutor's new text is shown without
  an admin seeing it first. The audit table records each edit; there is no
  content moderation step. Revisit together with the tutor screening policy,
  which remains open.
- No limit on how often a rejected tutor reapplies. Add one if it is abused.
- No schema change. A resubmission is audited as `tutor_profile.submitted`.

## Tests

`tests/integration/tutor-catalog.test.ts`: approved status survives an edit; a
rejected tutor's save returns the profile to pending and never accepts a status
from input; a suspended profile refuses edits.
