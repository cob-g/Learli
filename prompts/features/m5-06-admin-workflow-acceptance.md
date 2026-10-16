# M5.6 — Scoped private Admin workflow and connected acceptance

## Authority and baseline

2026-10-16: owner approved the Admin cross-check recommendation (“okay approve
recomendation do it”): verify/correct the private Tutor legacy-grant boundary,
complete scoped account-management and booking-lookup gaps, and establish a
connected normal-build Admin Playwright journey. Dashboard aggregate totals are a
separate optional enhancement, not part of this bounded correction.

**AUTHORIZED — build-feature delegation** from that actual request. This is not
separate human inspection of this generated blueprint, hosted activation, provider
write, account purge, commit, merge or deployment permission. Prior resolved
scope stays private fictional accounts, payments disabled, assigned-Tutor
completion after the saved end. Real-family intake and public reviews remain gated.

Repository `/Users/cob/learli`, branch
`feature/staging-interface-cleanup-20261016`, HEAD `572cf4d`, mixed prior uncommitted
interface/Parent/Tutor/private/Student work preserved. Exact 1,143-file dirty
baseline and Git status/diff retained under `.local/admin-workflow-20261016/`.
Compare this unit against that state rather than HEAD alone.

## Requirements and intended outcome

Primary M5.6; related M8.9/M8.8, M2.4 and M3.3; PRD ADM-01–04, AUTH-01–05,
FAM-01/02/04, BKG-01–07, MEET-02 and applicable OPS controls. Reuse the unchanged
AGENTS and eight canonical context files already read in this session, with the
current Student tracker and relevant Admin requirements reread before planning.

An actually verified, current-MFA Admin can navigate assigned Tutor/learner
reviews, maintain subjects, find only explicitly authorized fictional non-Admin
account targets, safely suspend/restore them, and look up only assigned booking
records. Trusted roles are display-only. A role or packet membership alone never
grants access to another account or booking. The normal build must prove these
operations alongside unchanged Parent/Tutor and independent Student journeys.

## Existing evidence and established boundaries

- `/admin` provides identity/navigation, not aggregate platform metrics. Login
  returns to validated `next` or Account; entering `/admin` preserves that route
  through real MFA. Do not impose an automatic single-role redirect on legitimate
  multi-role accounts.
- `tutors/review.ts` permits current exact legacy assignments without a packet
  audience intersection; its old mutation calls local review regardless of private
  mode. This is source-supported, not yet runtime-reproduced. Private screening
  already has evidence/assignment/current packet transaction checks.
- Account restriction source `local_fixture`, exact owner-provisioned staff grant,
  `.test` nonself/non-Admin target and the latest READ COMMITTED SQL function in0031
  provide atomic revision/status/event/replay and lock-wait authority rechecks.
  Reuse these; no new role/status UPDATE permission or safeguarding activation.
- Booking workflow grants already scope exact logical bookings and action access.
  `/admin/bookings/[id]` lacks a list and minimal participant summary. Reuse its
  policy/current beneficiary/screening/MFA/grant authority, not participant scope
  or a blanket Admin bypass.
- Catalog supports specialized creation/rename and active-state changes. Stable
  IDs/slug/category and persisted bookings survive; historical display labels
  resolve the current name. Public specialized offerings require an eligible
  Tutor; adding a catalog entry alone does not advertise it.
- Public review publication and real safeguarding defaults remain disabled.
  Local private approval never publishes; payments remain disabled.

## Minimal implementation and ownership

1. **Tutor boundary (worker B).** Capture the current packet; intersect list/detail
   with finite actor and `privateTutorPredicate` target/policy scope, including
   pending applications. Assert packet continuity after final reads. Deny legacy
   review mutations while private mode is active; private actions use existing
   evidence-based screening. Preserve no-packet legacy behavior. Protect packet
   enable/replacement during any touched awaited legacy mutation using transaction
   rollback/current context as appropriate. Add actual-PG RED/GREEN regression for
   retained outside-audience grants and current assigned private positive access.
2. **Accounts (worker A).** Extend existing restriction service/input/handler/UI and
   `/admin/accounts` pages. Only a valid **local-test** private packet admits this
   connected tool; keep hosted account restriction unsupported and explicit.
   Without a packet retain the existing local contract. Invalid packets never
   fall back. Intersect current actor and target membership plus matching source,
   authorized exact grant, current MFA and nonself/non-Admin exclusions.
   Add bounded literal name search, trusted-role/status filters and paging
   (default20, optional bounded pageSize1–20 for small actual paginated journeys);
   strict allowed/unique query fields, deterministic name/ID ordering and preserved
   filters through paging/detail return. Show trusted roles read-only. Reuse current
   action reasons/keys/confirmation/history with accurate private copy.
3. **Account mutation safety (A).** Keep the existing SQL function unchanged. In
   private mode call it inside explicit READ COMMITTED and retain transaction
   ownership through fresh post-function SQL checks of identity/MFA, finite actor
   and target scope/source/grant and non-Admin exclusion; assert captured packet
   unchanged before commit. Failed rechecks roll back status and audit together.
   Do not use cached identity for final authority or broaden target provenance.
4. **Booking lookup (B).** New proposed
   `features/booking-workflows/staff-read.ts` shares the private read authority for
   list/detail. Add `/admin/bookings` and read-only `/api/admin/bookings`, exact
   opaque UUID search, saved/effective-state filter and paging(max1000; default20,
   optional bounded pageSize1–20 preserved in filter/Next/Previous links).
   Stable date/ID ordering and one-row lookahead; expired provisional projection
   must not mutate data. Require current packet, actor membership, exact booking
   policy/audience/current beneficiary/screening and existing current workflow
   assignment. Include only Tutor, learner, booking-requester display labels,
   learner level and self/guardian relationship; no emails, account IDs, contacts,
   private meeting credentials or universal participant access. Keep the existing
   nonprivate task branch and all mutation/confirmation/completion permissions.
5. **Navigation/operator (coordinator).** Add guarded private booking entry and
   local-private account entry, preserving legacy destinations and hiding gated
   reviews/safeguarding. Account visibility must reflect local support rather than
   advertise hosted controls. Update overview copy for current assigned tasks.
   Extend the existing local metadata-only operator with an explicit single-target
   account grant action if needed: exact in-packet registered nonself/non-Admin
   target and reviewer, existing source/guard rules, no role/account/status/approval
   mutation, no automatic all-packet grants or revoked-grant revival. Hosted
   operator admission remains unsupported. Update strict CLI and tests/runbook.
6. **Connected browser (worker C).** Add proposed
   `tests/e2e/private-fictional-admin.spec.ts` to the actual existing build config,
   finite disjoint accounts and no mirror/composition overrides. Reuse focused
   private browser helpers where cohesive. Use real signup/verification/MFA,
   actual learner requests/evidence/assigned authorization and Tutor screening;
   owner fixtures may provision initial Admin role and exact metadata grants only.
   Cover current entry/session refresh, new account search/filters/details/status
   action/restore/events/retry, assigned booking lookup/details/status/pagination,
   subject specialized add/rename/deactivate/reactivate and retained references,
   protected pending/current eligibility, saved-booking retention and new booking
   denial while Tutor suspended, foreign role/record denial, actual logout, and
   narrow/wide/keyboard/Axe checks. Clearly disclose any separately historical or
   owner-created pagination fixtures; never claim real attendance/email/video.
7. **Docs (coordinator).** Save corrected ten-step Admin checklist and actual QA
   results, concise owner decision, PRD/architecture/UI/build-plan additions and
   verified progress. Do not check M5/M8 launch gates complete. Record dashboard
   totals, hosted management, real reviews/payments and actual hosting as deferred.

## Parallel boundaries

A owns account-restrictions feature/pages and its tests. B owns Tutor review
scope, staff booking reads/index/detail/API and their tests. C owns new Admin E2E
and a focused new support helper; coordinator owns shared existing browser setup,
configuration, operator/CLI, shell navigation and docs. Existing helper changes
must be coordinated first. No concurrent editing of shared foundations. All
changes remain scoped to the preserved dirty baseline.

## Invariants, failures and exclusions

Retain actual current session/verification/access/roles, exact-session MFA,
assigned record grants, source/policy/audience scope, existing lock and fresh
post-wait checks, idempotency, revision conflicts, immutable events and booking
exclusion. Packet replacement/removal must not disclose data or commit a change.
No meeting links in staff list/detail payloads. A restored account remains subject
to all independent learner/Tutor eligibility rules. Saved bookings/events/sessions
are retained; suspension is not deletion and restoration is not a new role grant.

No migrations or runtime grants are planned. No dependencies, global dashboards,
blanket role/account edits, advanced Tutor management, real safeguarding intake,
real-family policy, payments, public review activation, hosted account management,
production access, provider actions, destructive cleanup or deployment.

## Separate verification plan — NOT RUN in Architect

- Reproduce the Tutor grant concern on actual owned local PostgreSQL before fixing
  where feasible, then show denied list/detail/mutation with unchanged row/audit;
  no-packet compatibility and assigned private screening remain valid.
- Accounts: filters/literal wildcard handling, trusted roles, populated paging,
  in-packet/ungranted and out-of-packet/granted denials, self/Admin/source mismatch,
  MFA/role/session revocation, concurrent conflict and replay, stored sessions and
  bookings retained; deterministic lock wait plus packet change rolls back status
  and audit. Legacy restriction/mutation isolation remains valid.
- Bookings: assigned-positive list/detail, full current grant/policy/audience
  denial matrix, strict exact-ID/state/paging inputs, safe no-results/expiry and
  logical replacement history; no meeting/contact fields in any response.
- Full current `npm run check`, test-env production build, relevant actual PG
  Admin/account/Tutor/screening/catalog/booking/admission suites. Use existing
  34 applied test migrations; no production or development database mutation.
- `npm run test:e2e:private`: current Parent/Tutor, Student and new Admin cases,
  one worker/no retries, normal build. Protect logs/proofs; no trace/video/private
  screenshots, intercepted external URLs, controlled local mailbox only.
- Independent cross-author read-only Review of exact candidate against this
  blueprint, then separate executed verification. Re-review/rerun affected state
  after scoped repairs; preserve failed attempts. Final diff/source preservation,
  link/format and build trace audits; stop only owned test services, keep preview.

## Acceptance, documentation and handoff

Local acceptance requires current finite packet/record authority enforced across
Tutor review, scoped searchable account management and assigned booking lookup;
actual saved state/audits/retries/denials verified; all three connected normal-build
journeys and relevant DB/static/build checks pass; matching Review and final docs
are accurate, prior work is preserved and local Remember is saved. Do not label
hosted activation, real staff operations or full original checklist complete.

Architect stage complete: blueprint ready, authority recorded; implementation and
verification NOT RUN in this stage. Return to build-feature coordinator for the
separate implementation stage. No unresolved material policy choice blocks this
bounded private software slice.
