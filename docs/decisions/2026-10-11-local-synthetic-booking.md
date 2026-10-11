# Local synthetic reservation policy

Date: 2026-10-11. Authority: coordinator-delegated product decision for the
five-worker local build (`msg_782abd4d7a63`, durable ask reply
`msg_0a9e9bbffdf4`), under AUTHORIZED — build-feature delegation.
This is not founder approval of real operating, consent or commercial terms.

Use server-owned 60-minute elapsed lessons, a 30-minute start step, 60-minute
minimum notice, a 14-day candidate horizon and a 10-minute simulation lifetime.
The rationale is deterministic exercise of real UTC scheduling, conflicts,
notice and expiry without a customer offer. Indefinite demo reservations were
rejected because abandoned tests could block useful demonstrations.

Only local `.test` actors and fixture learners can create `demo_reserved`.
Its only transition is `demo_expired`. Original UTC times and request identity
stay immutable; reservations and minimal created/expired events are retained.
Read/create transactions materialize elapsed state under the tutor row lock;
candidate queries independently ignore elapsed rows. No background worker or
volatile timestamp index predicate is used. Duplicate actor/key returns one
logical result, including after expiry, and never renews it. Changed key payload
is rejected. UI says **simulated reservation**, displays **expires at**, and
never claims paid or confirmed.

Booking and time-off mutations lock `tutor_profiles FOR UPDATE` before reading
exceptions or blocking reservations. Booking uses a GiST half-open UTC exclusion
constraint plus READ COMMITTED transactions, tutor/actor row serialization and
bounded conflict retries. Fresh authorization follows all domain lock waits;
revocations committed before a check deny, while already authorized in-flight
requests may complete. This premerge recovery amendment supersedes the source
SERIALIZABLE choice; see `prompts/recovery/2026-10-11-integration-authorization-freshness.md`. Time-off addition must reject
overlap with unexpired demo reservations under the same lock; combined acceptance
requires both race orders against real PostgreSQL. The sibling owns exceptions.

Local runtime cannot delete reservations/history or change immutable booking
fields. No payment, meeting storage, notification, real minor or cloud capability
is enabled. Real lesson lengths, start steps, notice, holds, confirmation,
cancellation, refunds, safeguarding and public launch stay OPEN/gated.
