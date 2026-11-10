# Local Parent child level updates

Status: **AUTHORIZED — build-feature delegation**, 2026-11-10. The owner asked
to fix the inability of a Parent to update a child's education level, including
the misleading instruction on the profile form. This is execution authority for
the requested fix, not separate approval of the implementation blueprint.

For ordinary local operation, a currently authorized Parent can update their
guardian-managed child's supported tutoring level. The current level governs
new bookings and reschedule eligibility. Existing bookings, their timestamps,
statuses, consent and admission receipts are retained; booking views display the
current profile level rather than an immutable level-at-booking snapshot. A
level change must not automatically cancel or reassign a lesson. School grade is
separate metadata and must be explicitly cleared before College Support.
Reviewed synthetic/staging and independent Student behavior remain unchanged.
No existing-account linking, real guardian verification, production action,
or public-minor launch is authorized. Implementation and verification evidence
are tracked separately in `context/progress-tracker.md`.
