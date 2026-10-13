# W4 transactional delivery — implementation blueprint

Date: 2026-10-13 PHT. Status: **AUTHORIZED — build-feature delegation**.
Authority: current Task task_5093c3ee1a3d / Dispatch ctx_db1bf1931f45, explicit
eight-area build request and root launch override. This is software/local synthetic
authority, not human blueprint, operating policy, sending-domain or delivery approval.

Parent acceptance contract: [hosted workflow wave](m8-10-hosted-workflows-wave.md),
including every W4 and applicable cross-feature acceptance item. Requirements:
AUTH-01–04, OPS-04, BR-12, NFR-05/06/09/11; M2.3/9, M5.7/8, M8.5/6/8/9/10.
Checkout: `/Users/cob/orca/workspaces/learli/m8-transactional-delivery`, branch
`cob-g/m8-transactional-delivery`, HEAD `2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`.
Initial Git state clean. Imported immutable 300-file provider-v3 source only after
per-file SHA256 and `sorted path NUL bytes NUL` aggregate validation:
`a9ad16b44d0fc5d181deb23a7e2455379d00f364caef9ba5416975131b715d3e`.
Private configuration/data/memory was neither imported nor inspected.

## Outcome and observed foundation

Existing W4a uses the installed Resend 6.32.1 SDK and strictly constructed private
messages; W3 composes actual provider verification/reset/current-new email callbacks
with awaited send and a request-local mail-failure boundary. Preserve these actual
services, hook ordering, proof binding, secure HTTPS, and native recovery. Exercise
their actual browser proofs at the local SDK HTTP boundary. Do not create an auth
outbox retaining raw tokens/codes. API acceptance means accepted, never delivered.

Add durable booking-event delivery with atomic enqueue, a separately invoked bounded
post-commit drain, short claims, immutable prepared payload/key/fingerprint and durable
attempt/acceptance/uncertainty. Consume accepted W6 current recipient/event services;
do not duplicate its authorization or infer a mutable provider contract.

## Ownership and dependencies

Own new `src/features/transactional-delivery/*`,
`src/lib/db/schema/transactional-delivery.ts`, uniquely named transactional unit,
actual-PG integration and browser tests, scoped operator script/runbook/decision,
this blueprint, own tracker append and ignored reports/memory.
Allocated own-checkout shared hunks: W3 account callback/mail-attempt plus scoped
tests, narrow W4a booking constructor/templates, coordinated package scripts/test
discovery/schema-index/journal additions. Root owns final reconciliation, dependency
and lock changes, migration numbers/cumulative snapshots/grants, all shared runtime
routes/navigation and canonical documents. No existing 0000–0024 SQL edits.

Migration slot **0027** is reserved; no journal/numbered migration generation before
root supplies immutable accepted 0026 metadata. Full completion depends on accepted
W6 event/current-recipient/browser source. Source-v3 contains no accepted W6. Draft
schema/SQL may stay private until actual table/FK identity is known. Independent
account/transport/state work proceeds while those inputs are pending.

## Data and authorization invariants

- Real delivery disabled by default. Existing historical local capture unchanged.
- One queue identity per actual committed event, recipient account and template kind;
  enqueue in the same transaction as event creation, never post-commit best effort.
- Actual event FK and source constraints prevent fabricated or historical-demo events.
  No arbitrary recipient/template/event user endpoint.
- Claim transaction: bounded ordered page, SKIP LOCKED, lease token/expiry, CAS and
  durable firstAttemptAt before SDK I/O. Release database locks before provider await.
- Resolve current authorized recipient after claim and immediately before sending,
  using accepted W6 SQL/current policy/admission/tutor checks. Suppress obsolete events,
  revoked relations, lost authority, address/template/subject/time changes against an
  existing prepared payload. Current account-zone formatting is frozen on first send;
  changes may suppress rather than mutate retry identity.
- Persist only minimal recipient email plus safe subject/time/authenticated detail
  navigation and canonical immutable template material when needed for identical
  retries. No learner name/level, meeting URL/passcode, auth proof, error body or cookie.
- Prepared sender/origin/template/identity secret epoch must remain bound: changed
  delivery configuration blocks rather than silently sending altered content/key.
- Preserve original firstAttemptAt across retries and process restarts. Resend key
  retention is 24h; every unresolved older attempt blocks blind replay and requires
  operator reconciliation. No delivered/exactly-once claim or reset-to-pending API.
- Accepted provider IDs and sanitized reason enums only. A failed ACK leaves durable
  attempt/claim uncertainty; the next drain retries identical bytes/key only inside
  the provider retention window and after fresh recipient authorization.
- Bounded attempts/delay for 429, 5xx and concurrent-key409; altered-key409 terminal.
  Timeout/malformed response/network failure uncertain. Failed mail cannot undo a
  committed booking. External sending may race later revocation after its last fresh
  authorization; no claim that revocation recalls previously authorized email.

## Implementation sequence

1. Extend narrow validated booking-message construction; reusable durable retry/state
   rules and actual SDK boundary tests, preserve W4a account construction.
2. Verify accepted account callbacks/proofs/error/privacy in real provider/PG and owned
   browser harness; no speculative raw-proof persistence or user resend endpoint.
3. On accepted W6/0026 arrival, implement actual queue schema/0027 constraints and
   immutable triggers, atomic event enqueue, current-recipient adapter and operator
   drain. Provide exact shared hunks/inventory for root review.
4. Read-only same-agent Review against the actual complete diff, then separate Verify;
   Recover diagnosis before scoped repairs and re-review changed state.
5. Record evidence-bound tracker append, exact source freeze including untracked and
   shared hunks, ignored durable report and Remember save. Root performs independent
   combined acceptance; isolated W4 pass does not complete the wave or launch.

## Planned verification — NOT RUN at architecture stage

Use existing normal test commands, add browser project/script through allocated hunks;
actual pinned SDK mocked HTTP, never external provider calls or a toy mail adapter.
Test transport 409 distinction, 429/5xx/timeout/malformed acceptance, disabled config,
same-key changed payload and retention. Real owned PostgreSQL proves transactional
enqueue/rollback, independent post-commit visibility, simultaneous drains, abandoned
lease/ACK failure, immutable DB payload/key, fresh authority after waits, address
change/revocation/stale event suppression and older-than24h block. Fresh migration and
populated0026→0027 preserve every prior value and exact restricted grants.

Actual account browser verification/reset/current-new proofs and booking create,
confirm/change/cancel/outcome notices through SDK boundary, with failed delivery
preserving committed booking and safe UI uncertainty. Applicable 320/390/1440,
keyboard/focus/axe, no-JS read/denied states, errors and same-document actor/revocation/
Back privacy. Include affected Firefox/WebKit and disclose physical-device limitations.
`npm run check`, scoped actual PG, production build and registered browser tests must
actually pass for the frozen final state; inherited failures retained separately.

Heavy lease B authorized by launch override, serial within this checkout. Check own
ports before use: PG55904, ordinary3194, mirror3094, hosted backend3314, HTTPS3414,
TLS56004. Use own generated secrets, synthetic state and private0700/0600 ignored
artifacts. Never stop another process, use main55432/unrelated5432/EduSphere, cloud,
live mail, people, payments, peers, nested agents, commit/merge/push/deploy or cleanup.

## Documentation and gates

Contribute narrow architecture/PRD/build-plan/decision/runbook facts; root reconciles
canonical wave docs. Own tracker distinguishes implementation, Review and Verify.
Real guardian/screening/legal/booking/commercial/launch/provider-domain approvals stay
OPEN, and no runtime synthetic policy grants them. Completion waits for actual
accepted W6 and migration metadata, all parent acceptance evidence and memory save.

Blueprint ready. Build coordinator may proceed with independent implementation;
dependent database/booking work remains awaiting actual frozen provider inputs.
