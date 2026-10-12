# M3.5 / M4.11 — Actual-date directory time filters

Status: AUTHORIZED — build-feature delegation.
Authority: AUTHORIZED — build-feature delegation for the actual supervised
2026-10-12 directory request; no separate human blueprint approval.
Baseline: clean `cob-g/m3-directory-time-filters` at
`b6cf237554b3d46e1e4c58ce10e1ef3ebafe10c0` in this isolated worktree.
Coordinator plan: `/Users/cob/learli/prompts/features/m3-05-next-three-feature-wave.md`
(read-only). PRD PUB-03, MATCH-02/03, BR-01/02/07/08; build plan M3.5/M4.11.

## Outcome and scope

Visitors optionally choose a valid IANA viewer zone, selected ISO weekdays and
one existing bounded time band in `/tutors`. A tutor appears only when an actual
dated candidate fits the whole preference interval. Preserve subject/level on
one actual offering, real declared languages, College Support, name/slug order,
20-per-page exact full-set counts and ordinary browse without time preferences.
Use native GET plus pending enhancement, safe URL restoration/removal/paging,
truthful empty/error/validation states and local simulation wording.

No terminology clarification needed. Time bands and full-interval DST semantics
are reused read-only from matching/preferences; simulation duration/notice/grid/
horizon/TTL remain the existing delegated inputs. No matching result/policy change,
account-zone mutation, schedule/booking write, schema, dependency or migration.

## Proposed capacity and provider seam

The existing shared query accepts at most20 slugs and requires subject+level;
directory supports optional combinations. Add a separate strict optional-filter
directory query schema and `readPublicDirectoryCandidates`, sharing the exact
existing read-only candidate engine through an internal function. Keep the
original public query validation/DTO/endpoint contract unchanged. Reuse the
single eligibility predicate with optional subject/level; every batch rechecks.

Propose <=100 eligible filtered tutors in <=5 complete batches, matching the
existing matcher bound. Above100 or any provider row/output overflow/failure,
show retry/change-filters with no partial list/count or false-empty claim. Plain
browse remains uncapped. Intersect batch start windows and retain complete
candidate durations when compiling preferences, as matching already does.
Coordinator approved this exact bound and additive input/service seam through the
injected orchestration ask on2026-10-12, including additive Playwright registration.
Original profile/matching provider regressions are required because internals move.

## Implementation

1. Add safe parsing/canonicalization of allowlisted public directory parameters;
   opt-in preferences validate fail-closed with actionable errors. Only canonical
   public values reach rendering and links. No learner/account/booking IDs.
2. Add the strict directory shared-provider read and directory composition that
   filters the complete eligible set before paging, preserves name order and
   returns only public tutor/time DTOs. No writes/locks/expiry materialization.
3. Extend only directory filter UI (home finder unchanged), preserving native GET,
   optional zone/day/band inputs, keyed restoration and pending feedback. Add
   dated earliest fitting time/profile context to filtered rows as needed using
   existing LessonTime/formatting and tokens. Fully awaited SSR for no-JS.
4. Own meaningful unit/component, real PostgreSQL and browser regressions;
   shared Playwright registration is an additive integration hunk only.
5. Scoped context notes, same-agent read-only Review, separate executed Verify,
   Recover on defects, report/manifest and ignored memory handoff.

## Ownership and invariants

Own `/tutors` page, tutors/search/public/filter-form/card additive changes,
additive public-availability helpers, own tests/blueprint/context sections.
Matching, auth/accounts and subject mutations remain read-only. Existing0000–0015
immutable; no new migration. DB55491/dev3051/test3151, owned private local state,
pinned Node24.20.0/npm11.19.0 with npm ci. No env/artifact/DB copying, subagents,
commit/merge/push/deploy/provider visits/email/real users/payments/cleanup.

## Acceptance and planned verification

- Unit: malformed/repeated/unknown inputs and safe links; no-time browse;
  same-offering language/subject/level composition; whole-interval DST gap/fold,
  midnight boundaries via existing helpers; exact page/count/order and >100 refusal.
- Components: labeled native GET fields, College Support, opt-in/error/pending,
  removal and restored state without private values.
- Real PostgreSQL: directory/matching agreement; genuine optional combinations,
  time off/unexpired holds/elapsed holds without writes; current suspended/unverified/
  role/disabled-subject exclusions;21+ tutors across complete batches and privacy.
- Execute actual npm run check, full appropriate PostgreSQL suite, npm run build,
  affected browser suite and full appropriate browser regression sequentially.
  Actual phone/desktop/320px keyboard/axe/overflow/no-JS, Back/paging/removal,
  empty/failure/loading, safe public DTOs. No undiscovered-count claims.
- Review is same-agent read-only; verification is separately executed. Source and
  exact command outcomes preserved in `.local/next-wave/report.md`; every changed
  tracked/untracked nonignored path+SHA256/baseline in manifest.json. Remember
  saves ignored root memory.md. Failed checks/recovery remain visible.

## Documents and risks

Append only scoped PRD/architecture/UI/build-plan/tracker facts as applicable;
no broad reformat or whole-milestone/launch promotion. Inherited13 advisories and
real guardian/consent/safety/commercial/provider/production gates remain open.
Each provider batch is a snapshot, not one cross-batch transaction; reads are
advisory and booking always revalidates. Reversible source rollback is sufficient.
Verification: NOT RUN at architecture handoff; implementation now authorized.
