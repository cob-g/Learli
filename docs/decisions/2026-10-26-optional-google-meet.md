# Optional tutor-owned automatic Google Meet links

Owner approved `prompts/features/m5-01-google-meet-provisioning.md` and explicitly
requested implementation on 2026-10-26. This bounded M5.1 enhancement supersedes
older blanket later-only creation/OAuth language.

Tutors may connect their own Google account with explicit future-booking consent.
New eligible confirmed ordinary-local bookings enqueue one durable job per physical
booking, in the confirmation transaction. The explicit local supervised runner
creates a restricted Meet space outside database locks and attaches the validated
private link after fresh eligibility/generation checks. No separate role-specific
bookings, payment, Calendar event, child identifiers, attendance or completion
integration is introduced. Manual Zoom/Meet links remain supported and win races.

Separate encrypted credentials and single-use session/browser-bound OAuth attempts
keep Better Auth login unchanged. Automation has explicit system provenance and a
restricted worker role. Creation has no documented provider idempotency key: lost
responses are uncertain and never automatically reissued. Known receipts can be
reconciled without another create. Existing/history records are retained; connection
never backfills old bookings. Rescheduling uses the replacement physical booking.

Cancellation hides Learli access but does not revoke copied external links. Host
admission, organization settings, account compatibility and safeguarding still
need controlled acceptance. Production/deployment and live Google actions are not
authorized by this decision. Default operation remains provider-disabled.

Implementation/review/test evidence belongs in the progress tracker; this decision
is authorization, not a claim that Google or production acceptance passed.
