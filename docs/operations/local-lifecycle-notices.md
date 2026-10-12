# Local captured lifecycle notices

The M5.7/M5.8 local extension consumes immutable booking_lifecycle_events through
an atomic separate outbox with a real event foreign key. Original creation rows
and artifacts remain intact; only revision0 creation queues notices. Replacements
have one rescheduling event and never a second creation notice. Current logical
head/state/participant checks suppress pending stale or unauthorized captures.
Owner-fixture confirmation/completion is explicitly synthetic; completion does
not establish payment or attendance. Terminal cancellation/completion captures
may outlive the original TTL, with current participant checks still required.

Run only in the checkout-owned loopback development/test environment:

```sh
node --import tsx scripts/local-booking-notifications.ts --limit=25
node --import tsx scripts/local-booking-notifications.ts --test --event=<committed-event-uuid>
```

The single total bound is25 across both queues. No schedule, web endpoint,
recipient override or provider email exists. Private HTML is stored below the
ignored .local/mail environment directory with0600 files and0700 mailbox.
Only catalog subject, recipient-local scheduled time, meaningful live expiry,
synthetic label and sign-in-required booking detail link enter HTML. No recipient
email/account/learner information or private meeting link is projected.

Failures retain the committed booking and immutable event. A pending row may be
retried through the same command; event/account/kind keys give a stable artifact
identity after capture-before-ack failure. This is not exactly-once delivery across
filesystem/database crashes. Closed delivery rows cannot be rewritten through
runtime. Already captured notices are historical artifacts; current detail access
is independently authenticated/authorized. Suppression is terminal for that
queued notice and does not imply a retention or real notification policy.

Worker SQL0018 follows accepted provider0017; root integrates it as reserved0021
and reconciles metadata/grants. Local scoped evidence is separate from root
combined review/verification. Real Resend delivery, sender domain, reminders,
commercial/guardian/safeguarding/retention and production readiness remain gated.
