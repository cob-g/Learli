# M5.5 — Tutor follows rescheduled booking

Status: AUTHORIZED — build-feature delegation, 2026-11-10. The owner reports that an open Tutor booking detail retains the old date after a Student reschedules, and cannot show a subsequent cancellation even after reloading. The owner requests the current date and status automatically. This authorizes this fix, not a separate human approval of this blueprint.

PRD TUT-06, BKG-04/05/06, OPS-02; build plan M5.5 and M4.10. Repository `/Users/cob/learli`, `main` at `cbc55d7`, with existing uncommitted admin and booking-stream work preserved. Read AGENTS.md and the eight canonical context documents in order.

## Diagnosis and scope

Rescheduling creates an immutable replacement; the existing Tutor SSE refresh rereads the obsolete original URL, whose status and date correctly remain historical. On an authorized Tutor detail request, redirect a superseded booking to its server-derived current head, including on live refresh and a direct reload. Read and authorize the original before redirect; the new page must independently authorize the replacement. Preserve deliberately selected historical snapshots through an explicit Tutor history URL and a current-booking link. Do not change Student/Parent behavior, server mutations, meeting privacy, SSE authorization, notification payload, booking policy, storage, or other roles. No schema, provider or dependency changes.

## Implementation and acceptance

1. Add an explicit history URL for superseded Tutor entries in both Tutor dashboard and participant booking history. Validate the flag strictly; it never grants access. History remains distinguishable and links to current booking.
2. After the guarded read, follow the current head on ordinary Tutor detail requests; use existing time zone formatting and active/terminal meeting behavior.
3. Extend the synthetic isolated-browser journey: keep the original Tutor page open during Student reschedule and cancellation, verify it follows the replacement, shows the new date/time, and then shows cancelled without navigation or reload. Verify reload of original follows current, explicit old history remains accessible, and unauthorized viewers cannot read it. Preserve existing meeting privacy and dashboard checks.
4. Review the actual scoped implementation read-only; separately run relevant check, build, and isolated PostgreSQL/browser verification. No production data, deployment, migration or external messages.

Update architecture and progress tracker to describe the changed Tutor behavior and actual evidence. Save local memory after verification. Hosted load/cost testing remains a separately gated staging activity.
