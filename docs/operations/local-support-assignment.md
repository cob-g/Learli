# Synthetic local support assignment

Scope: M5.6/M5.9 OPS-05/ADM-03 under AUTHORIZED — build-feature delegation.
Blueprint: `prompts/features/m5-09-local-support-assignment.md`. This is loopback,
development/test and synthetic `.test` data only. It is unmonitored and does not
provide emergency or real incident response. No email or private messaging occurs.

The local fixture owner first provisions reviewer capability with the existing
CLI, then an exact case-specific reviewer choice and an exact dispatcher grant:

```sh
npx tsx scripts/local-support.ts authorize <owned-admin-fixture-label>
npx tsx scripts/local-support.ts choose <owned-admin-fixture-label> <case-uuid>
npx tsx scripts/local-support.ts dispatch <owned-admin-fixture-label> <case-uuid>
```

Each label must belong to this checkout's private fixture manifest and match its
actual verified, active synthetic admin account. This tool never grants admin or
reactivates revoked grants. `revoke-choice` and `revoke-dispatch` remove the exact
authority while retaining history; existing `authorize`, `revoke`, and owner
`assign` operations remain. At most20 provisioned reviewer choices per case is a
local technical bound, including revoked choices, not a real staffing policy.

`/admin/support` links to `/admin/support/dispatch`. Dispatcher views show only
provisioned case reference/category/status/current reviewer and minimal assignment
history. They omit report subject/body, requester identity, booking context,
learner, contact, meeting and email fields. Reviewer access still requires current
reviewer capability, admin role and exact current assignment. Dispatch authority
is separate and never implies access to the full report.

Runtime assign/reassign/escalate accepts an expected case revision and actor-scoped
UUID key. Exact retries acknowledge the recorded revision after current authority
and candidate eligibility checks; changed keys/payload or stale revision conflict.
Escalation requires an existing assignment and a different eligible candidate.
Closed cases require their existing authorized reviewer to reopen first; dispatch
does not reopen or change status. Former reviewers lose report/status/booking
context access on subsequent current checks. Revocations/suspensions committed
before post-lock authorization deny; already-authorized in-flight work may finish.

Unknown browser outcomes require native reload and current history inspection;
no blind second action is sent. Mutation controls require JavaScript while case
metadata/history remain server-readable. Protected support routes await their
core HTML; status and assignment forms use POST with disabled unhydrated submits
and truthful no-JS guidance. Native dispatch navigation replaces
private documents. No real support response or customer policy follows.

Forward migration is isolated0017_local_support_assignment, reserved0019 in final
integration. Existing0000–0016 stay immutable. Four new tables and a narrow
SECURITY DEFINER mutation with fixed search path are added. Runtime gets SELECT
on grants/choices/assignment receipts and execution only; it cannot directly write
these tables or current assignments, and cannot edit new immutable history.
Rollback means disabling the new routes/grants while preserving audit and old
assignment data; do not drop historical records or rewrite applied migrations.

Root owns final journal/snapshots, runtime grants/schema exports, staging verifier
compatibility and default browser registration. Scoped worker browser execution:

```sh
LEARLI_STAGING_TEST_PORT=55714 npm run test:e2e -- --config tests/e2e/support-assignment.config.ts --workers=1
```

Only the isolated worker uses those ports; integration must use its own assigned
environment. Results, failures/repairs and source hashes belong in the private
worker report and canonical progress tracker. This document describes behavior,
not a claim that tests passed. Real safeguarding/consent/legal/retention/staffing
and release decisions remain open.
