# Separate manual persistent-booking preview — 2026-10-17

Status: Selected by the owner under the delegated build-feature scope.

The owner requested removal of the old simulation workflow for manual testing
and approved the recommended separate private preview, preserving the same
Parent, Student, Tutor and assigned Admin workflows. This does not authorize
production deployment, real-family intake, external delivery, payment activation
or deletion/conversion of existing development records.

Use a separate Orca-managed checkout with independently generated local secrets,
owned PostgreSQL cluster and fresh finite fictional identities. The selected
origin is `http://localhost:3200`, database `127.0.0.1:55433/learli_test`.
The ordinary automated database remains `127.0.0.1:55432/learli_test`.
The original Neon-development accounts/history remain outside this preview.
Use hostname separation to avoid sharing session cookies with the former
`127.0.0.1:3000` preview.

Reuse the existing approved private fictional packet and persisted workflow:
provisional request → assigned current-MFA Admin confirmation → assigned Tutor
meeting information → Tutor completion after the saved lesson end → history.
A provisional request still has its approved ten-minute hold. Confirmation does
not expire when that hold ends. Do not rename or convert historical simulations,
forge attendance, alter booking timestamps, or bypass guardian/Tutor review.

The finite packet uses the existing 24-hour preparation window. Its exact expiry
is recorded in the private local account sheet, not silently extended at startup.
Expired authority/evidence needs deliberate maintenance; persistence is not a
promise of perpetual access after policy expiry. Payments remain disabled.

Owner-invoked bounded dispatch may prepare at most 20 new exact review assignments
and confirmation grants. It creates no identity, role, review evidence, approval
or booking transition and must not revive revoked/expired metadata or replace
another reviewer. An assigned Admin still acts through the actual application.
No scheduler or always-on worker is introduced.

See the [authorized blueprint](../../prompts/features/m8-03-manual-persistent-booking-preview.md)
and [manual operations](../operations/manual-persistent-preview.md).
Implementation and executed verification are recorded separately in the tracker.
