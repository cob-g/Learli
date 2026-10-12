# M5.10 — Private synthetic booking-backed reviews

Date: 2026-10-12. Status: AUTHORIZED — build-feature delegation; coordinator froze concrete contract via ask reply on 2026-10-12.
Authority: AUTHORIZED — build-feature delegation under local-completion-wave Task E.
Repository: /Users/cob/orca/workspaces/learli/m5-local-private-reviews.
Observed HEAD:0494f6b4cd1044ebebb89f0d41b1b706cb851352, initially clean.
Parent unchanged reference: /Users/cob/orca/workspaces/learli/m4-local-completion-integration/prompts/features/m4-10-local-completion-wave.md.
Required context: AGENTS.md, all eight context/*.md in prescribed order, ORCHESTRATION-LESSONS.md.
PRD OPS-06; build-plan M5.10 local subset only. Real policies remain OPEN.

## Outcome and agreed language

Active verified synthetic parents/students submit an integer1–5 rating and optional trimmed plain text up to1000 characters for an ended owner-provisioned demo_completed fixture. Their immutable submission stays private regardless of moderation. Current booking authority is mandatory on every read and retry. No attendance or payment claim, customer review policy, publication/aggregate, replies, editing/deletion or real-user behavior.
Accepted A42-file source bundle is an explicitly recorded dirty provider baseline; copy only coordinator manifest paths and verify hashes. Preserve provider files except essential own-scope journal/grant additions. No commits/merge/push/cloud/email/payment or nested workers.

## Proposed schema and authority

Local forward0018_private_synthetic_reviews.sql (root final0020). Add private_booking_reviews with physical booking FK, stable logical booking FK/unique, author FK, request UUID unique per author, immutable rating/text/source, status pending|locally_approved|locally_rejected, DB revision/timestamps. Add review_moderators (owner-only trusted local capability), review_moderator_grants (exact review/moderator pair), owner provisioning events, and immutable review_events containing only actor/request/revision/old/new state/time, never copied text. SQL checks match supported Drizzle metadata. Runtime SELECT only on feature tables plus EXECUTE on two narrow SECURITY DEFINER functions; no direct INSERT/UPDATE/DELETE. Fixed pg_catalog search path, all relation and row types public-qualified, revoke PUBLIC execution. DB validation and guards preserve immutable submission and append-only audit.

Submission function locks tutor first, stable logical root/physical booking then rechecks current session/account/.test/student-or-parent/learner ownership and ended current-head demo_completed plus owner lifecycle completion event. Actor cannot be assigned tutor. Current-head means no successor and no higher logical revision. Provided expected booking revision detects stale view. Logical unique protects simultaneous guardian submissions; actor/request uniqueness protects cross-booking key reuse. Same actor/request/exact immutable payload returns existing review only after fresh authority; changed/reused key or differing submission409. Missing/foreign/ineligible all404. Original TTL does not gate completed fixture.

Moderation function uses tutor/root/review lock order and rechecks active verified .test admin, owner capability and exact review grant, excluding review author and assigned tutor. No global admin bypass. Expected review revision/request UUID; identical current retry returns unchanged result, stale/differing replay409. Proposed transitions pending→either decision; either decision→pending (explicit reconsideration), never direct approve↔reject. Every actual transition increments revision and appends one audit atomically. Read author is exact author plus current booking authority; moderator content read is exact current grant/capability with same self/tutor exclusions, without learner/meeting joins in DTO. Proposed historical-author access does not depend on current tutor approval/account status; author learner must stay active.

## Planned service/API/UI

New features/private-reviews and schema/private-reviews.ts; minimal schema index/runtime grant own hunks. GET/POST /api/bookings/[bookingId]/review; PATCH /api/admin/reviews/[reviewId]; GET scoped admin queue/detail. Dynamic noindex fully awaited pages /bookings/[bookingId]/review and /admin/reviews[/id]. React plain-text rendering, explicit local/private/fixture labels, labelled numeric/native controls, pessimistic pending/error/focus and stable request UUID. Forms use POST method and disabled-before-hydration/no-script explanation to prevent private GET fallback. No loading boundary. No existing booking-detail/public catalog edit; coordinator attaches navigation.

Owner CLI scripts/local-private-reviews.ts operates owned loopback local database only with guarded owner/.test fixtures. Commands document complete-ended(existing booking) through accepted A helper (no clock rewrite), provision/revoke moderator and grant/revoke exact review. Owner history is immutable. It never creates real accounts, makes public reviews, prints review text/private identity or changes production policy. README-style operations note supplies safe commands/URLs; fixtures can be prepared via trusted test setup with real ended instants.

## Build and evidence plan

1. Confirm edge contract with root, import accepted A hashes; npm ci pinned lockfile.
2. Add schema/SQL/functions and focused validation/permission/concurrency tests; tracker implementation evidence only.
3. Add services/boundaries/pages/forms/owner tooling and tests; record separate same-agent read-only Review.
4. Ask heavy-work lease before PG/check/build/browser. Own ports DB55815/dev3085/browser3185; every integration LEARLI_STAGING_TEST_PORT55715. Tests sequential.
5. Verify formatting/lint/types/unit/component; actual PG identical/distinct retry, two guardian race, stale head/revision, ended/completed/event requirements, self/student/guardian/tutor/admin negatives, revocation/session after lock waits, exact moderator scope and concurrency, immutable grant/write denial, fresh and populated baseline0017→0018 preservation. Required inherited migration count failure remains unmodified and explicit.
6. Build and Chromium phone390/desktop1440/narrow320 keyboard/axe/text safety/no-JS/session-expiry/Back/account-switch/public no-real-reviews evidence. Root final registration/shared staging/combined cross-feature acceptance remains separate.
7. Recover actual failures with retained evidence, revise Review then affected checks. Save ignored report.md/manifest.json and memory.md preserving history; exact own hashes and provider hashes separate; send freeze/report and worker_done once.

Verification: NOT RUN — Architect stage. Root reconciles canonical PRD/architecture/decision/build-plan/shared metadata; worker updates own tracker. Risks: stale grant/privacy, PG lock ordering and real head provenance. Rollback is code disable and preserving additive private records; no destructive reset authorized. Next consumer: root integration and independent combined review/verify.

## Frozen owner usability amendment

Coordinator accepted prepare-history with exact manifest-owned family/tutor labels, learner UUID, offered subject slug, real finite past UTC start/end of60elapsed minutes and caller stable request UUID. Canonical payload fingerprint plus original actor/key uniqueness reuses the immutable booking after partial/unknown completion, refusing changed input. Preparation commits before accepted A helper's separate owner transaction; completion uncertainty returns saved ID and directs identical retry without date/deadline rewrite or duplicate creation. Every retry rechecks owner fixtures/current authority. This is synthetic local fixture tooling only. Root supplied heavy slot2 for own sequential verification.
