# M5.4 — Parent booking live updates and booking copy

**Status: AUTHORIZED — build-feature delegation**, 2026-11-10. The user requested fixes for the Parent cross-tab booking update and misleading initial booking copy, followed by a complete Chrome walkthrough. This records execution authority, not a separate review or approval of this document.

Repository `/Users/cob/learli`; observed `main` at `cbc55d7`, with substantial pre-existing uncommitted changes including the M5.3/M5.5 live booking implementation. Preserve those changes. Read AGENTS.md and its eight canonical context files in order. Primary M5.4; related M4.9–M4.10, M5.1/M5.3/M5.5. PRD FAM-01/03, BKG-03/04/05/06, MEET-01/02.

## Outcome and boundaries

An authorized Parent sees current booking status, time and private meeting state automatically in dashboard, booking list and detail. Old active detail URLs follow authorized replacement records; explicit history retains historical records. Before learner selection, copy does not wrongly promise a reviewer for every booking; after selection it reflects the applicable existing policy. No commercial, admission, guardian consent, booking lifecycle or production policy changes. Synthetic local data only for walkthrough. Existing legacy provisional paths remain truthful. No production deployment or destructive reset.

## Design

- Reuse the transaction-committed learner-ID notification mechanism, expanding it additively to guardian-managed learners. An opaque learner ID is internal to the server listener; client SSE carries only generic invalidation. Preserve Student scoping and do not subscribe by supplied learner ID. Add a reviewed migration; preserve historical data and trigger permissions.
- Add a separate Parent stream deriving guardian learner IDs from the existing authorized guardian overview; require Parent role, same-origin, current session and current guardian authority, rechecked before each event and periodically. A changed set closes the stream, and the browser reconnects and rereads. No private payload, cross-account/role access, or authority derived from knowing an ID. Reuse listener limits, heartbeat, fallback, and no-JS/manual refresh.
- Wire the Parent dashboard, list and detail; handle old active links and explicit historical snapshots like Student/Tutor while retaining authorization on every projection. Ensure updated date, status and meeting state, not merely a badge.
- Use neutral copy until a learner has been selected; then retain selected-policy-specific confirmation messaging.

## Verification plan

Review diff in same-agent read-only stage. On isolated local test database test commit versus rollback, guardian vs self stream isolation, unrelated accounts, origin, role and guardian revocation; check meeting and booking notifications and historical/current-head navigation. Run relevant component/integration, typecheck, lint, build and appropriate browser checks. Repeat local Chrome Parent signup/profile access, discovery, booking, reschedule, cancellation, cross-tab live detail/dashboard, history and cross-account privacy insofar as existing signed-in sessions and synthetic tutor availability permit. Check desktop/mobile as feasible. Report exact outcomes, limitations and local migration application; do not claim independent review, real screening, attendance, hosted performance or public-launch readiness.

## Documentation and rollback

Update architecture, PRD, build plan and progress tracker for this requested extension and its evidence. No schema tables or destructive migration; roll back application deployment and additive notification behavior deliberately, preserving booking data. Record review and verification separately in ignored local memory. Hosted connection/load evaluation remains gated.
