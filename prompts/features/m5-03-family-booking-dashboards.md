# M5.3–M5.4 — Local student and parent booking dashboards

Status: AUTHORIZED — build-feature delegation. Date: 2026-10-11.
Authority: actual dispatched request to `$build-feature Build M5.3–M5.4 local student and parent booking dashboards` in the user-approved six-feature wave. This is delegated execution authority, not separate human blueprint approval.

## What we are building

Replace the generic student/parent landing experience with private, server-rendered synthetic reservation overviews. Show current simulated reservation status, expiry, tutor, subject, named learner, local date/time, next reservation, agenda and paginated history. Preserve learner management and account access. PRD OPS-01, OPS-03, FAM-03, BKG-04; build plan M5.3/M5.4 and V11.

## Baseline and inspected evidence

Repository: /Users/cob/orca/workspaces/learli/m5-3-family-dashboard. Branch: cob-g/m5-3-family-dashboard. Clean HEAD: 0c078bf50f9f967b20391ef3640353a7b3897e62. Canonical AGENTS.md and all eight context documents read in required order; relevant local synthetic booking decision consulted. Existing generic [workspace] page, learners/account routes, private page loader, permissions, LessonTime formatter, database schema, pinned scripts and default browser projects inspected. Existing learner read service checks exact active self ownership or currently authorized guardian links. No dashboard booking read service exists at baseline.

## Language, decisions and scope

No terminology question needed. A simulated reservation is local-only and never a confirmed lesson. Parent default is All learners with two or more authorized profiles; one learner has a named heading and no selector; none has no guessed profiles or creation control. Students use only their eligible self-managed College Support profile, including multi-role accounts. View booking links go to private provider detail with explicit scope. Existing user timezone is the viewer zone; parent never uses a learner's timezone. Timezone changes link to existing account settings rather than invent a new settings contract.

Included: next/active reservation, agenda, history, current expiry projection, GET learner selection and pagination, loading/error/no-learner/no-reservation states, private metadata/caching, keyboard/mobile/desktop checks. Excluded: payments, confirmed/paid/completed/cancelled states, join/cancellation/reschedule actions, meeting storage, email/provider integrations, onboarding, LMS or tutor/admin landing changes. No migration, dependencies, auth configuration, global CSS or booking mutation changes.

## Provider and ownership contract

Agent1 owns authorization/query and private booking detail/list. Coordinator msg_e55e9e56111d accepts pending read-model.ts exports BookingReadScope student|guardian|tutor, BookingReadFilter all|active|history, BookingSummary/Detail/Page; read-service.ts listParticipantBookings(runtime,headers,input), readParticipantBooking(runtime,headers,id,scope). List accepts scope,page=1,pageSize=20 (max50),filter=all,learnerId optional. Active ordered start/id ASC, history/all DESC, hasNext without count. Exact DTO fields and frozen tested files remain pending. Final imports require parent authorization of exact paths/hashes. No competing query/auth layer or final stub. Owned proposed modules: src/features/family-dashboard/*; static student/parent routes and loading boundaries; own unit/component/integration/browser tests. Generic fallback removes only student/parent behavior; tutor/admin routing remains.

Read-only provider final SQL statement must repeat current session expiry, verification, active account, trusted role, ownership/link, and local synthetic gates. Read after elapsed TTL projects demo_expired without mutating stored records or manufacturing events. No admin bypass. Unauthorized/nonexistent learner selection gives identical unavailable response, never defaults to all. Coordinator msg_f613a06f1e19 refines BookingPage with learners:BookingLearnerSummary[] {id,displayName,level}, viewerTimezone and snapshotAtUtc from the same final authorized SQL snapshot, even for empty bookings. This supersedes the initial reuse of separate learner reads: the provider context supplies all selector data. Active means effective unexpired/end>snapshot; Next specifically future start. The provider exports bookingDetailPath(id,scope). No new booking query/authorization is owned here. Parent navigation is Bookings/Learners/Find a tutor/Account settings; student Bookings/Find a tutor/Account settings plus existing Your learners access. Coordinator allows feature-local role navigation; no new shared shell dependency.

## Implementation sequence

1. Build pure presentation model, server-rendered status/time/next/agenda/history UI and no-JS GET selector against an explicitly pending structural contract; no authorization/query implementation.
2. Set up owned synthetic databases on 55472 and app ports3032/3132 with pinned npm ci, existing scripts and full12-migration chain. Keep credentials ignored/private.
3. Obtain exact DTO fields and parent hash authorization; import only frozen provider paths into this checkout, record imported bytes separately; wire a narrow page loader to provider list/context only. No placeholder/stub remains.
4. Add meaningful role/relationship/selection negative tests on real PostgreSQL; browser auth, filtering, history, expiry, no-JS, privacy, failure/loading, accessibility and responsive screenshots. Keep baseline concurrency/auth tests selected.
5. Update factual tracker and necessary local implementation notes, then same-agent read-only Review, executed Verify, scoped Recover if needed, and Remember save.

## Verification plan (not executed by Architect)

Run npm run check; full npm run test:integration; production npm run build; default npm run test:e2e -- --workers=1 including baseline and new suite, with tests discovered in standard config. Run selective unit/model checks, exact private-value/client-output scan, git diff --check and scoped design detector. Inspect narrow/desktop populated and empty/error/loading screenshots; axe, keyboard controls, 320/390/768/1024/1440 and forced-colors/reduced-motion/reflow. Test multi-role self/guardian isolation, foreign learner filters, revoked/archived profiles, suspended/unverified/expired callers, TTL projection without writes, date rollover/DST and pagination. All final checks require real imported provider behavior. Logs private .local; do not print credentials/cookies/private records. Rollback is reverting owned files; no data mutation/migration required by dashboard reads.

## Context updates and risks

Update own progress tracker after meaningful changes, with exact results and limits. Add concise architecture/UI/build-plan local implementation notes only when actual behavior changes documented facts; reconcile shared docs via parent. Existing commercial, consent/safeguarding, real users, production and deployment gates remain OPEN. Pending provider DTO/hash bundle blocks final wiring/acceptance, not independent UI work. Same-agent review is not independent review. No commits/push/merge/deployment/external messages or extra workers.

## Coordinator refinement — 2026-10-11

msg_96a3664668ad supersedes dual-read composition: final provider listParticipantBookingOverview(runtime,headers,{scope,learnerId?,page(history),pageSize}) returns {active:BookingPage,history:BookingPage} in one final current authorization SQL snapshot, sharing zone/clock/learners. Active is first20 ascending with hasNext and a private full-active-list link; history has ordinary GET pagination. The consumer owns no TTL projection/authentication reconciliation/query. Next uses future starts; ongoing appears in agenda. Provider hash/import gate remains.

msg_2c08fade8596 authorizes targeted no-JS recovery after observed52/53 browser results: remove own newly added automatic student/parent loading.tsx boundaries, fully await core document content, and retain native GET plus form/useLinkStatus pending feedback. Earlier automatic loading-boundary step is superseded. Server-snapshot-relative expiry refresh replaces device wall-clock timing; provider remains sole status authority.

Frozen imports: initial16paths under msg_de33110e4b44; repaired15paths with two verified provisional loading removals under msg_0b89fbb7a715; final one-file controls replacement under msg_21fc64cd24f6. Exact final hashes and previous/deleted hash proof are private .local/provider-imports.json and its version records. Hydrated family GET selection now uses a router transition, keeping native GET for no-JS and keying the authoritative selected learner for Back restoration; real delayed-read/Back/revocation tests verify this in the default browser project. No provider file is modified locally, no internal RSC headers/alternate authorization paths are used.
