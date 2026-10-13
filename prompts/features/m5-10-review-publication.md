# Policy-governed anonymous review publication — W7

Date: 2026-10-13. Status: **AUTHORIZED — build-feature delegation**.
Actual authority: dispatched task_a2d9cf615b6b / ctx_32c1ce3f8e0d, user-approved eight-area software workflow, mandatory parent `prompts/features/m8-10-hosted-workflows-wave.md` and current root launch allocations. Not human policy/blueprint approval.
Repository: own `m8-review-publication`, clean-start HEAD2fa0294c5e6cad895754b3c10a703a6c6f6ef00a, branch allocated by Orca. Accepted baseline-v3 300 paths aggregate a9ad16b44d0fc5d181deb23a7e2455379d00f364caef9ba5416975131b715d3e and bounded W6v5 34 paths aggregate3c22a40aab30b317c8c717a6d8bb4ba7eabb98361420a056c5eae939a8346fb4 validated/imported; private provenance retained.0000–0025 SQL immutable.

## Outcome, trace and terminology

OPS-06/PUB-04/BR-13/14/NFR-05; primary M5.10 with M3.4/7/8 and M8.10. Eligible current synthetic readiness customer submits one immutable integer1–5 review with optional <=1000-character plain text for a current administratively completed logical booking. Exactly assigned MFA moderator records approval/rejection, publication/withdrawal or reconsideration with audited revisions/retry identity. Anonymous public test profile rows and count/average come from precisely the same current eligibility set. Administrative completion never proves attendance. Historical private demo approvals remain private forever. No terminology clarification or real-policy decision is needed for this default-disabled software slice.

## Delegated technical decisions and invariants

- Separate publication policies/head, reviews, exact moderator grants and append-only event storage. No private-review data migration/backfill or W6 service/migration edit. Forward0026 exclusively allocated; root composes0027 afterward.
- Validated test-only capability binds policy ID/version/reference/content digest, completed outcome, exact current customer relation, one logical-booking review, manual assigned MFA moderation, fixed public allowlist, privacy confirmation and dispute path. Shipped composition is disabled; synthetic capability is rejected outside exact test-owned loopback execution. No approved production packet is invented.
- Store immutable booking ID/logical root/completion event/booking workflow revision/author/policy/source/rating/text/submission request. Unique logical root prevents duplicate authors/retries, including concurrent submissions. Bind completion event to exact booking/policy/workflow revision and current latest logical head.
- Exact live actor session/current W5 admission and W6 completion predicate protect submission and author reads. Exclude tutor-as-author. Public eligibility uses stored exact author and sessionless W6 beneficiary relation plus current immutable completion event/head/provenance/booking/publication/admission/screening policy and public tutor status/account/role/offering. Logout alone does not revoke anonymous published visibility; revocation does. No public author-session cache.
- Manual transitions: pending→approved/rejected; approved→published/pending; published→withdrawn; rejected/withdrawn→pending. Approval/publication require explicit privacy confirmation. No automatic moderation, replies, arbitrary text editing or hard deletion. Withdrawal is available to exact current moderator even when completion visibility ceased; disclosure stays private.
- Exact grant plus current W1 MFA and self-author/self-tutor exclusion applies at request, final private query and after tutor→booking→review locks. Policy and authority recheck after every blocking write, audit/FK/trigger wait and final same-transaction projection. Missing/NULL inputs fail closed. Minimal events capture action/actor/policy/revision/request/privacy confirmation/time; never meeting data.
- Public SQL returns only anonymous `Customer` label/rating/escaped approved text/date and truthful count/average, never internal review/author/account/booking/learner/event identifiers, learner names, email, schedule or meeting evidence. No rounded fabricated5.0. Failures are unavailable, never false zero.

## Scope and ownership

Own new `src/features/review-publication/*`, `src/lib/db/schema/review-publication.ts`, unique review-publication unit/component/PG/browser files. Allocated own-checkout shared hunks: schema export,0026 SQL/journal/cumulative snapshot/runtime grant/protection inventories; normal test discovery; public tutor profile query/component/route and exact private author/moderator review routes/navigation. Preserve original private source path explicitly. Existing shared public tutor eligibility is consumed, not rewritten. Root owns final integration/canonical docs/lock/package ownership. No peer edits, nested workers, cloud/live mail/people/payments/commit/merge/push/deploy/cleanup.

## Implementation sequence and failure behavior

1. Freeze validated policy/state/DTO and0026 immutable/definer/current-eligibility/grant contract. Use narrow runtime EXECUTE and column SELECT; no runtime grants to owner-controlled policy/task records or protected write/delete.
2. Add reusable service/query and safe HTTP handlers with exact-session author and exact MFA moderator projection, idempotent payload retries, stale409, generic404,503 disabled/error and bounded input. Publish minimal frozen schema/service provider with actual PG evidence for root/W4b before UI completion.
3. Integrate actual author/moderator pages and anonymous profile projection into root-accepted single four-factory W6 browser mirror. Wait for exact immutable mirror source; do not fabricate endpoint/provider contracts. Native document navigation preserves document-lifetime privacy; readable no-JS state and inert POST fallback prevent query-string text leaks.
4. Author acceptance tests, perform separate same-agent read-only Review, separate Verify, Recover scoped defects with preserved failures and rerun affected Review/Verify. Root independently reviews/composes later.

## Verification plan — NOT RUN at planning checkpoint

Ask root for current heavy lease before install/PG/build/browser/restore. Own PG55907, ordinary3197, domainmirror3097, hostedbackend3317, HTTPS3417/TLS56007; recheck ports, never stop unknown listener. Own synthetic secrets and0700/0600 artifacts; no borrowed configuration/data.

Execute actual normal check/build, scoped PostgreSQL and registered Chromium plus affected Firefox/WebKit. PG: permitted completion submission; foreign/noncompleted/old-head/event/revision/source denials; immutable unique logical booking/retry concurrent assertions; exact/current MFA/task revocation before and after lock and late audit waits; NULL vectors; stale/retry/publication/withdraw races; public sessionless logout-versus-revocation; policy head/admission/screening/tutor/public offering withdrawals; private fixture exclusion; safe grant/direct-write/PUBLIC/protection probes. Actual fresh canonical27-chain and populated0025→0026 preservation with0000–0025 unchanged hashes and all original column projections. Preserve failures/no skipped assertions.

Browser: eligible ended readiness booking submit→MFA assigned moderator privacy review→publish→marked synthetic local profile/text/count/average→withdraw removes all; wrong actor/noncompleted/private fixture/XSS/API/HTML/RSC/metadata privacy; zero/unavailable/error/pending/stale;320/390/1440 keyboard/axe/no-JS/native denied POST and document lifetime across account switches, failed reauth/revoked sessions/Back. Inspect screenshots/client/log/report content privately. Exact source hashes and command/exit evidence, independent acceptance and whole-wave success remain distinct.

## Documents, risks and rollback

Contribute scoped decision/architecture/PRD/UI/build-plan prose and verified tracker append for root reconciliation. No real privacy/moderation/dispute owner/policy evidence supplied; real publication disabled. Full W6 UI mirror source and current root heavy lease are execution dependencies. Rollback disables composition/head; no destructive down migration. Final ignored memory/report records exact current source, separate Review/Verify, provider provenance, failures and outstanding gates. Blueprint ready; return to build-feature coordinator for implementation.

## Root-directed forward isolation repair — 2026-10-13

Root msg_1621585135d6 allocates exact forward-only replacements in still-unaccepted0026 for accepted0025 create_policy_booking, change_policy_booking and create_booking_workflow_dispute. Add only an early non-READ-COMMITTED rejection (23514), preserving every signature/security/search-path/body byte otherwise;0025 remains immutable. This addresses the same direct runtime SQL stale-snapshot issue as W7 submission/decision. Preserve actual oldfunction RR stale-task demonstration, explicit RR denials for all3, normalRC positives, before/after source identities and canonical fresh/populated0025→0026 proof. Frozen v1 remains preserved and downstream metadata withheld until root independent v2 review. This is delegated bounded security repair, not change to provider/domain policy.
