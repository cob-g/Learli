# Hosted foundation browser recovery

Authority: **AUTHORIZED — build-feature delegation**, eight local software areas
under the root coordinator. This is scoped synthetic test recovery, with no
deployment, production operation, policy change or weakened access control.

## R1 — support-booking browser fixtures omit current MFA

Observed on 2026-10-12 in the integration checkout at base `2fa0294` plus the
accepted119-file foundation: `npm run test:e2e` exited1 with98 passed,2 failed
and44 not run. The failures are the first two cases in
`tests/e2e/support-bookings.spec.ts`, at the assigned reviewer's expected related
booking heading. Private failure artifacts show the administrator security setup
page instead. The test actor helper signs in and grants an admin role but never
enrolls/verifies MFA; the W1 guard correctly redirects that session.

Classification: **targeted test-fixture fix**. Application enforcement is expected.
Other privileged browser fixtures already use `enrollBrowserAdmin`, which calls
the real provider enrollment and TOTP verification endpoints. Foreign-admin
booking tests and role-escalation attacks intentionally lack privileged access
and do not need this setup. No reset or architecture change is indicated.

Proposed repair: import that existing helper and call it only for an admin actor
after real sign-in in the support-booking fixture. Preserve every original
ownership, privacy, revocation, accessibility and presentation assertion. Do not
insert an assurance receipt directly or alter application authorization.

Separate verification: review the two-line test delta, run formatting/lint for
the changed test, then rerun ordinary Chromium acceptance to execute the failed
cases and their44 dependent cases. The unchanged production build and649-case
PostgreSQL pass remain applicable to application code. Preserve the first run's
private log/reports and distinguish its results from the repair run. Final whole
wave acceptance remains pending new workflow imports.

Outcome: the coordinator applied only the two proposed test lines. Same-agent
scoped Review found no remaining issue; separate scoped formatting and lint
passed. The full ordinary Chromium rerun passed144/144 with exit0, including
the two originally failing cases and all44 previously unrun dependents. The
original98/2/44 run remains recorded and its private artifacts preserved. No
application, migration or authorization code changed for R1.
