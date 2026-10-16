# Parent workspace onboarding

- Date: 2026-10-16, Asia/Manila.
- Status: owner-approved product direction; implementation authority is
  **AUTHORIZED — build-feature delegation**. Not a launch/policy approval.
- Authority: the owner supplied the five-step parent checklist and approved the
  recommendation to complete its normal journey (“okay approve what. you
  recomend”). Exact implementation blueprint:
  `prompts/features/m2-04-parent-onboarding.md`.

## Decision

Add Parent intent to signup and preserve it through mandatory email verification
and sign-in. A separate authenticated action gives only the current account a
parent workspace. Existing verified accounts can also choose Parent. Preserve
generic signup, legitimate multiple roles, and all server-side ownership guards.

Selecting Parent is not evidence of adulthood, consent or guardian authority.
It must create no child, guardian relationship or booking permission. The child
and booking parts of the approved journey remain separate dependent work; the
operating policies and staging target cannot be inferred from this approval.
Payments remain disabled.

## Technical boundary

Reuse the installed Better Auth signup/verification and strict provider HTTP
allowlist without accepting `role`, owner IDs or other trusted fields. A narrow
database operation grants only parent, rechecking current user/access/session
after identity locks and writing the initial audit atomically. Repeated requests
do not duplicate the grant/event; no general role-table write is granted to the
runtime. Local and hosted account origin/ingress/membership controls remain.

Migration0032 is additive and preserves all prior audit action values and
historical SQL. Apply only through reviewed environment-specific migration tools;
code generation or a successful test is not a provider migration. Function
privileges/search path and lock behavior follow the installed PostgreSQL
[function security](https://www.postgresql.org/docs/17/sql-createfunction.html)
and [locking rules](https://www.postgresql.org/docs/17/explicit-locking.html).

## Acceptance evidence

Require UI registration/verification/sign-in/enrollment without SQL fixture role
grants, generic signup preservation, forged-role/foreign-actor/session denial,
concurrent retry idempotency, atomic audit failure/recovery, and fresh/populated
migration/grant preservation. Actual results belong in progress-tracker. No
real-family, staging deployment, external mail or payment readiness is implied.

## Owner-approved continuation — Steps 5–9

The owner approved the recommended Parent/Tutor dashboard, external-session and
history checklist on 2026-10-16 (“ok appporove hte recommended checklist”). The
canonical [acceptance checklist](../qa/parent-tutor-session-checklist.md) records
the adjustments: compare one booking across roles and local time zones; tutor
supplies the private meeting link before joining; guardian-managed children use
the Parent account; include unrelated-account denials; record completion manually
with an audit record after the scheduled end without inferring external attendance.

Tutor acceptance remains conditional on actual implemented policy. Completion
actor, guardian/booking policy and the exact private-staging/real-family target
remain open; the existing isolated completion path is assigned-admin-only. This
approval records expected acceptance behavior, not implementation or manual QA
results. Preserve the verified Parent enrollment unit and its existing evidence.

## Subsequent completion-actor decision

The owner answered “yes ;approve ur recommmendation” to the explicit recommendation
of assigned-tutor completion after scheduled end with an audit record. This
supersedes the open actor noted above, not the other operating/target policies.
See [the completion decision](2026-10-16-assigned-tutor-completion.md).
