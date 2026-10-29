# Independent Adult Self-Service V2

- **Decision ID:** `M4.4-INDEPENDENT-ADULT-V2`
- **Date:** 2026-10-18
- **Status:** Approved
- **Authority:** Repository owner approval of the master workflow-alignment
  blueprint subject to fourteen explicit implementation conditions.

## Decision

A verified, active local user may create one self-managed College Support learner
after affirmatively declaring that they are an adult or otherwise legally
eligible to manage the tutoring account independently. The checkbox is explicit
and unchecked by default. Its immutable receipt records a self-attestation only;
it is not verified proof of age, identity, capacity or legal eligibility.
College Support is the initial supported independent level and never establishes
adulthood.

Successful creation atomically grants the trusted Student role and current
authority over the new profile. That V2 learner may create a confirmed no-money
booking under current tutor, subject, availability, ownership, concurrency and
idempotency checks. Routine Admin admission and booking confirmation are not
required. “Confirmed” does not mean “paid,” and no payment functionality is
activated.

## Boundaries

- Preserve every historical v1 request, decision, evidence row, policy receipt,
  booking, lifecycle event and audit record without approval, conversion,
  deletion or relabeling.
- Preserve Parent-v2 semantics and all existing data.
- Independent minor access and existing-student account linking remain disabled
  until separate consent, safeguarding and verification policy is approved.
- Exceptional safeguarding, disputed relationships and suspicious activity may
  still require scoped human review.
- Tutor cancellation and rescheduling authority is unchanged. Any future removal
  or narrowing requires a separate behavior decision.
- Production data, deployment and external payment/meeting systems are outside
  this decision.

## Technical contract

Use distinct immutable admission and booking V2 receipts, a dedicated immutable
attestation, one profile per user, current server-side role/ownership checks,
PostgreSQL overlap protection and opaque retry keys. Different role dashboards
read the same booking. Preserve validated IANA timezone context, deterministic
lifecycle ordering and truthful provisional meeting status.

## Rollback

Disable the new policy head/intake while retaining every created profile,
attestation, role audit, booking and lifecycle record. Do not delete or rewrite
receipts to simulate rollback.

## Acceptance evidence

Verification must cover explicit declaration validation, injected authority,
concurrent profile and booking requests, retry replay/conflict, role/audit grant,
immutable receipts, revoked identity/policy denial, legacy/Parent-v2 migration
preservation, participant-scoped reads, no payment state and regression protection
for existing Tutor actions.
