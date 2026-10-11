# Local booking notification capture

This is an owned synthetic development exercise for M5.7–M5.8/OPS-04. Reservation
creation queues pending notices; capture happens only through the manual command.
Nothing sends email or confirms a lesson. Auth verification/reset captures keep
their existing behavior and directory.

After local setup/migrations, use the installed pinned tool:

```sh
npx --no-install tsx scripts/local-booking-notifications.ts --limit=25
npx --no-install tsx scripts/local-booking-notifications.ts --limit=2 --event=<creation-event-uuid>
```

The optional exact event ID is internal, from the owned local database; it never
grants participant access. The command accepts no recipient override or provider
configuration. `--test` explicitly selects `.env.test.local` for owned testing.
Only the matching loopback local Learli dev/test runtime connection is accepted.
Output contains aggregate counts, never account identifiers, addresses, payloads
or URLs. Invocation is bounded to 1..25 pending rows and never polls continuously.

Captured artifacts are private ignored files under
`.local/mail/development/booking-notifications/` (or `test`). Open them locally;
their detail link requires an eligible current account and exact relationship.
Captures contain catalog subject, local dated time/offset, simulation expiry and
that protected link. They never contain learner or meeting information.

Each committed creation-event/recipient/kind has one queue identity and one
stable artifact path. A failed capture remains pending with a safe fixed failure
code and incremented attempt count, attempted once per invocation. Run the same
command after fixing the owned filesystem issue. Expired or unauthorized pending
notices become suppressed, not sent; no expiry/cancellation message is generated.
Captured/suppressed rows are terminal. Existing historical files remain private
snapshots; no claim is made that an already viewed notice can be retracted.

The independent connection cannot see an outer transaction's uncommitted queue.
Database rollback creates no notice. Capture failure cannot change a committed
booking. Filesystem publication precedes the captured acknowledgement; failure
or process crash in between leaves a retryable pending row and potentially an
existing artifact. Retry atomically replaces that same path. Database failure may
prevent attempt metadata from committing, so counts describe the invocation and
the durable row remains authoritative. There is no exactly-once guarantee across
filesystem/PostgreSQL or hardware crashes; no scheduled worker, fsync/SLA claim,
provider receipt or real-email capability is provided.

Operational rollback: stop invoking capture. Preserve existing bookings/events/
delivery history; do not rewrite applied migrations, delete history, reset another
database or expose `.local` files. Real notification delivery requires separately
approved scope, recipients/consent, sending-domain and provider verification.
