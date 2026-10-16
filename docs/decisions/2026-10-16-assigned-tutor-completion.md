# Assigned tutor records completion after the scheduled end

- Date: 2026-10-16, Asia/Manila.
- Authority: the owner replied “yes ;approve ur recommmendation” to the specific
  recommendation: assigned tutor, after the scheduled end, with an audit record.
- Related requirements: BKG-07, BKG-04, OPS-02/03; build-plan M5.5 subset.

Only the assigned, currently eligible Tutor may manually complete the confirmed
booking after its saved end. Record the actor, database timestamp and transition
atomically, with idempotent retries. Neither a call ending nor time passing
establishes completion or verified external attendance. Parent and unrelated
Tutor accounts are denied. No-show authority and admin correction policy remain
separate decisions.

Preserve immutable existing admin-only v1 test policies and their digests. The
software adds a distinct v2 test capability for assigned-tutor completion, reusing
the current authoritative database workflow guards and existing form. Default
composition remains disabled: this decision does not approve real-family intake,
legacy fixed booking terms, payments, provider targets, account deletion or
deployment. It does not approve an admin override for v2 completion.

The implementation blueprint is
[assigned tutor completion](../../prompts/features/m5-05-assigned-tutor-completion.md).
The [Parent–Tutor checklist](../qa/parent-tutor-session-checklist.md) retains the
full-journey acceptance scope; execution status and actual checks belong in
`context/progress-tracker.md`.
