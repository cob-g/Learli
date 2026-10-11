# Tutor time off — local combined contract

The private `/tutor/time-off` page is linked from `/tutor/availability`. A verified,
active tutor adds and removes their own dated periods; pending/rejected profiles
may prepare a schedule, while suspended profiles cannot mutate. No reason text is
collected. Weekly windows remain unchanged. Removing one overlapping period leaves
the others effective. Existing intervals remain fixed in UTC when the teaching
time zone changes. Start/end are explicit minute-precision local dates and times;
DST gaps and repeated endpoints are rejected with field errors. An interval may
cross midnight, span multiple days or contain a clock transition.

## Private API

`GET /api/tutor/time-off` returns `{ schedule: null | { timezone, version,
editable, exceptions: [{ id, startAtUtc, endAtUtc }] } }`. Dates are ISO UTC strings.
No tutor/account ID, reason or learner data is returned. Responses are no-store.

`POST /api/tutor/time-off` accepts exactly one of:

```json
{
  "operation": "add",
  "version": 0,
  "timezone": "Asia/Manila",
  "startLocal": "2026-10-13T23:00",
  "endLocal": "2026-10-14T01:00"
}
```

```json
{
  "operation": "remove",
  "version": 1,
  "id": "00000000-0000-4000-8000-000000000001"
}
```

The session selects the owner; submitted owner/tutor IDs are refused. JSON/origin
guards and trusted role/access checks are shared with weekly availability. The
current profile row is locked first FOR UPDATE. Its expected version (and teaching
zone on addition) must still match. The mutation, shared schedule revision and
minimal audit event commit atomically. A stale/missing/foreign record never becomes
success. Responses return `{version, exceptions}` for the current owner snapshot.
The 128-period bound prevents unbounded list growth; it is not a retention policy,
and nothing auto-purges past time off. Identical stored ranges are rejected.

## Scheduling/booking dependency

Schema: `src/lib/db/schema/time-off.ts` exports `tutorAvailabilityExceptions` for
`tutor_availability_exceptions(id,tutor_id,start_at_utc,end_at_utc,created_at)`.
Finite half-open `[start,end)` timestamps, end > start, tutor FK, tutor/start index
and unique tutor/start/end. The runtime has SELECT/INSERT/DELETE only, no UPDATE
or schema privilege. The generated migration is reported in the worker handoff;
the coordinator reconciles the merged migration chain, never source DB histories.

`src/features/time-off/repository.ts` exports (also re-exported by `service.ts`):

```ts
readTutorTimeOffIntervals(
  db: Pick<Database, "select">, // a Drizzle transaction is accepted
  tutorId: string,
  from: Date,
  to: Date,
): Promise<UtcInterval[]> // {start: Date, end: Date}[]
```

It selects `tutor_id = tutorId AND start_at_utc < to AND end_at_utc > from`.
No clamping or re-conversion; the caller is responsible for authorization and tutor
eligibility. Query bounds follow the engine's technical 366-day maximum. Pass these
intervals as engine `busy` exclusions. The module is Node-only and is never loaded
by a client component. `readOwnAvailabilityIntervals` reads weekly windows and
time off under a profile FOR SHARE lock and returns the remaining effective UTC
intervals without selecting lesson-duration/start-step/lead-time policy.

**Mandatory combined integration:** both booking creation and time-off mutations
must lock the same `tutor_profiles` row FOR UPDATE first, then read/write domain
rows. Addition must reject overlap against the actual booking model's active
reservation predicate before inserting/revising/auditing. For the coordinator's
authorized synthetic contract this is `state = 'demo_reserved' AND expires_at >
server now`. Booking must read time off after acquiring the same lock and revalidate
candidate times. Never silently cancel a reservation. The baseline has no booking
table. This checkout imports the coordinator-verified standalone implementation
and adds that guard before any exception/revision/audit write. Both real
PostgreSQL race orders, expired/adjacent reservations and preserved booking and
audit state on rejected addition are required combined verification.

No production migration, live booking/legal policy, remote CI, hosted provider,
external email, real user/minor, pricing/payment or deployment is authorized here.
