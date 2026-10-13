# Policy-governed booking workflows

Date: 2026-10-12. Status: **AUTHORIZED — build-feature delegation**.
Authority: dispatched W6 under `prompts/features/m8-10-hosted-workflows-wave.md`; root allocation `w6-ownership-followup.txt` and msg_9a0500acfb26. No separate human blueprint/policy approval.
Baseline:2fa0294c5e6cad895754b3c10a703a6c6f6ef00a, own branch cob-g/m8-booking-workflows, accepted provider233-file aggregate8bd364092127371ec6d0cd5d2dcb87b8a4cf6c5f602c2d24f75250b1cafaaea6.

## Outcome and requirements

BKG-01–07, MEET-01–03, OPS-01–04, NFR-03/04; M4.5–11/M5.1–5/8 under M8.10. Extend existing bookings/logical replacement chain with explicit synthetic readiness provisional, confirmed, completed, no_show, expired, cancelled and replaced states. Real activation remains disabled; historical local simulation retains all original TTL, ownership, outcomes, notices and privacy semantics. Completion/no-show are administrative, never attendance. No money/free/manual-paid assumption.

## Design

Forward0025 only: conditional source/state constraints; one exclusion across all live source/state kinds; policy/immutable logical-booking terms receipt and exact workflow task grants. Existing booking_lifecycle_events gains explicit readiness event names and policy/reason fields, preserving IDs and original history. New narrow security-definer functions with fixed pg_catalog search path own readiness writes; ordinary runtime direct insertion/state/history promotion denied by conditional existing triggers. No parallel booking table.

Synthetic-only policy explicitly consumes60min duration,30min starts,60min notice,14day start horizon,10min provisional lifetime,60min cancellation/move cutoff, named synthetic prerequisite review, assigned MFA admin confirmation/outcome permissions, reason allowlist and /support dispute path, and private link window ending at lesson end. These are test inputs, not commercial or safeguarding terms. Confirmed ignores the saved provisional deadline indefinitely until terminal state; replacements preserve original policy/terms and provisional expiry, confirmed replacements retain confirmed status with a new explicit link required.

Every request uses current provider identity; every final SQL projection and mutation after tutor→booking locks composes W5 current learner authority and W8 current screening plus current policy. Confirmation/outcome require exact logical-task grant and fresh W1 assurance, independent from participant ownership. Cancellation checks current participant obligation authority without requiring future subject/offering eligibility. Moving requires current offering, availability/time-off/DST and atomic replacement; failures preserve all original records/events. DB clock and actor request fingerprint govern retry identity; expired cannot revive. Policy heads and authority are rechecked after waits; original terms stay immutable.

## Integration and ownership

Own booking-workflows/schema/test paths; root allocated minimal existing bookings creation/lifecycle/read/status/dashboard/private-link/public-availability/time-off, exports/grants/protection/test discovery/fixture edits in own checkout. Producer W1/W5/W8 files remain frozen. Shipped composition returns disabled policy; test-owned production mirror installs validated synthetic packets for admission/screening/bookings while retaining real local auth and exact source/override manifest. No peer ports or dev-HMR bypass. Ports55906/3096/3196/56006/3296, Heavy A granted serially.

## Build sequence

1. Implement policy/input/state contract and forward schema/functions/receipt/event semantics; publish actual completion/event/recipient provider v1.
2. Wire same booking routes, participants/history/dashboards, busy/time-off and private links to source-aware predicates, with synthetic labels and native navigation.
3. Author unique real-PG race/retry/post-lock/denial/DST/fresh/populated preservation tests and actual browser parent/College/confirmation/link/move/conflict/cancel/outcome/error/privacy cases.
4. Same-agent read-only Review, then separate Verify; diagnose/repair with Recover, repeat affected Review/Verify and save Remember.

## Planned verification — NOT RUN

Normal npm run check, scoped actual PG plus relevant booking/link/time-off/provider regressions, production build, registered Chromium and affected Firefox/WebKit;320/390/1440 keyboard/axe/no-JS/denial/errors/document lifetime, private artifact/client/public HTML inspection. Actual fresh chain and populated0024→0025 preservation including0000–0024 hashes, grant/PUBLIC/direct-write/protection probes. Preserve original failures and distinguish source evidence from combined acceptance. Owned synthetic DB only; no cloud/live mail/real people/payment/commit/merge/push/deploy/cleanup.

## Documentation and gates

Scoped tracker append and immutable source/evidence report; root reconciles canonical context/decision contribution and full-wave independent review/verification. Real markets/guardianship/consent/screening/contractual booking/meeting/human dispute policy and provider/deployment activation remain OPEN. Rollback disables new composition; no destructive down migration.

Root msg_64cb93b2dc1a authorizes0025-only sessionless `has_current_booking_beneficiary` preserving every W5 non-session policy/evidence/account/role/link predicate. Viewer exact live session and task/participant authority remain independently required. Root accepted AccountFormv2 sole class repair imported hashdb37a27b before verification. Immutable readiness notice intents reference actual existing lifecycle event IDs and queue in the same transaction; W4b owns delivery state/SDK separately. Per-booking policy/admission columns are the immutable original terms receipt rather than an extra duplicated receipt table.

## Delegated dispute bridge extension

Root msg_7000032d9830 allocates a narrow0025 readiness dispute bridge. Reuse W8
`create_safeguarding_case` and existing immutable support_case_bookings in the same
transaction; extend only the association guard for exact readiness/readiness pairs,
retaining original local conditions/new-case event/xmin and immutability. Preserve
W8 policies/functions/services unchanged. Booking participant exact current session,
current response intake policy, replay payload+booking identity and final post-write
rechecks apply. Read context uses requester or exact W8 assigned reviewer/MFA,
existing minimum booking/audit projection, no learner/meeting/case body in dispatch.
Actual PG atomic/replay/foreign/late-wait and browser bound dispute are required;
a generic support link is insufficient. No real incident owner/policy invented.

Root msg_8d47576a40f9 supersedes the proposed xmin-status hypothesis: add nullable
server-stamped immutable `support_cases.creation_transaction` in0025, with old
rows NULL and no backfill. A fixed-path insertion trigger assigns the actual
`pg_current_xact_id()::text` for readiness rows, ignoring caller input; updates
cannot change it. Readiness association requires that exact top-level marker plus
matching new case/event xmin/source/response and definer authority. Preserve the
legacy local xmin equality branch verbatim and frozen W8 create function. Test
nested success, forged marker overwrite/denial, committed-old-case rejection,
post-write revoked/expired rollback and old-row NULL preservation. No epoch/status
inference or broader association permission.
