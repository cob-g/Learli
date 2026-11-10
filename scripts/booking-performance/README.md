# Current workflow performance experiment

Run only in an independently copied, synthetic checkout under
`/tmp/learli-booking-perf-*`, with explicit `LEARLI_PERFORMANCE_ROOT` equal to that
checkout. The scripts deliberately refuse the primary checkout. They do not
reset existing data, change application throttles or contact hosted services.
Private environment, fixture cookies, logs and raw results must stay ignored.

1. Copy the current source (including uncommitted work) without `.git`, `.env*`,
   `.local`, build artifacts or dependencies; record a source SHA-256 manifest.
   Reuse the installed dependencies via a symlink. Preserve the before sources.
2. In that copy, run `LEARLI_DB_PORT=55435 LEARLI_DEV_PORT=3410
LEARLI_TEST_PORT=3311 node scripts/local-db.mjs start`, then `npm run db:migrate`.
3. Run `node --conditions=react-server --import tsx
scripts/booking-performance/fixture.ts` with `LEARLI_PERFORMANCE_ROOT` set.
   This registers and verifies synthetic accounts, uses real local intake,
   reviewer MFA/screening and booking services, and saves private cookie fixtures.
4. Preserve the generated owner environment privately, then remove
   `DATABASE_URL_DIRECT` from the runtime `.env.local` and add
   `LOCAL_WORKFLOW_MODE=enabled`. Keep the runtime restricted to `learli_app`.
5. Build with `NODE_OPTIONS=--max-old-space-size=8192 npm run build`.
6. Start `node --import ./scripts/booking-performance/probe.mjs
node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3410`, with
   `LEARLI_PERFORMANCE_ROOT` and a private `LEARLI_PERFORMANCE_METRICS` file.
   The probe records timings/categories only, with a bounded sample buffer.
7. Run `node scripts/booking-performance/measure.mjs before`; stop the owned
   server, then run `node --conditions=react-server --import tsx
scripts/booking-performance/services.mjs before`. These exercise current
   routes/services rather than the older demo mutation endpoints. Keep auth
   limits enabled and retain all observed HTTP statuses.
8. Apply each scoped source change, rebuild and repeat using `after`, with the
   same database and fixture. Avoid other heavy work during timed runs.
9. Inspect raw distributions, query counts/checkout waits, transaction/held-lock
   samples, session statuses and six-tab idle behavior. Phone-sized Chromium
   scroll/pointer/long-task samples are synthetic, not physical-device evidence.
   Navigation response time and load-event elapsed time are separate metrics;
   neither proves that all hydration has settled. Retain
   failures, uncontrolled warm-cache/machine-load effects and small sample limits.
10. Stop only the owned server/cluster, retaining data and artifacts. Never run
    this setup against the walkthrough database or production.

Formatting microbenchmarks alternate 15 measured samples per variant after two
warmups, assert full output equality, and cover Manila/New York/Lord Howe,
midnight and a New York DST fold. They measure formatting, not page speed.
The probe's transaction/lock timer includes elapsed Node/SQL round trips and is
not a PostgreSQL CPU or exact lock-wait profiler. Checkout duration includes
connection setup/dispatch, with the observed pool waiting count recorded.

The optional `paired.mjs` experiment loads the manifest-verified original service
as `src/features/booking-workflows/service-performance-before.ts` **inside the
owned copy only** and alternates 20 measured pairs per current service after two
warmups. Full candidate outputs must match each pair. This avoids attributing a
natural half-hour candidate-boundary change between separate runs to the patch.
`bounds.mjs` compares the exact blocking predicates with 0/100/1,000/10,000
irrelevant synthetic history rows, asserts relevant-output equality, captures
PostgreSQL plans, and rolls back the growth rows.

After measurements, `live.mjs` exercises current Parent reschedule/cancel and
Student cancel against open participant documents, including phone/desktop
reschedule layouts. It forwards each UI mutation exactly once and captures the
response before the real navigation; it does not synthesize success or replay
uncertain writes. Run it before cancelling the fixture bookings. The 2026-11-10
run uncovered the inherited confirmed-after-hold constraint defect; see the
recovery note and forward migration 0047. Apply reviewed migrations in the owned
copy before repeating that lifecycle check. Default heartbeat/fallback timing and
application authentication throttles stay enabled throughout.

`discovery.mjs` separately measures current catalog reads and compares formatting
all actual public intervals with formatting only the first, preserving identical
first-slot fields. It is diagnostic only and changes no discovery projection.
