import pg from "pg";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { parseEnv } from "node:util";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";

const root = realpathSync(process.cwd());
if (
  !process.env.LEARLI_PERFORMANCE_ROOT ||
  realpathSync(process.env.LEARLI_PERFORMANCE_ROOT) !== root ||
  !root.startsWith(`${realpathSync("/tmp")}/learli-booking-perf-`)
)
  throw new Error("Explicit owned performance copy required");
const env = parseEnv(readFileSync(".local/owner.env", "utf8"));
const url = new URL(env.DATABASE_URL_DIRECT);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55435" ||
  url.pathname !== "/learli_dev" ||
  url.username !== "learli_owner"
)
  throw new Error("Owned synthetic database required");
const fixture = JSON.parse(
  readFileSync(".local/performance-fixture.json", "utf8"),
);
const client = new pg.Client({ connectionString: url.toString() });
const result = { samples: [], plans: [], inventory: null };
await client.connect();
try {
  await client.query("BEGIN");
  const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
    .now;
  const from = new Date(now.getTime() + 3600000);
  const until = new Date(now.getTime() + 14 * 86400000 + 3600000);
  const predicate =
    "((b.source='local_simulation' AND b.state IN ('demo_reserved','demo_confirmed') AND b.expires_at>$2) OR (b.source IN('synthetic_readiness','local_operation') AND (b.state='confirmed' OR (b.state='provisional' AND b.expires_at>$2))))";
  const base = `SELECT b.start_at_utc AS start,b.end_at_utc AS \"end\" FROM public.bookings b WHERE b.tutor_id=$1::uuid AND ($3::uuid IS NULL OR b.id<>$3::uuid) AND ${predicate}`;
  const queries = {
    before: base,
    after: `${base} AND b.end_at_utc>$4::timestamptz AND b.start_at_utc<$5::timestamptz`,
  };
  const args = {
    before: [fixture.tutor.profileId, now, null],
    after: [fixture.tutor.profileId, now, null, from, until],
  };
  let inserted = 0;
  for (const count of [0, 100, 1000, 10000]) {
    if (count > inserted) {
      await client.query(
        `WITH added AS (
        INSERT INTO bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id)
        SELECT b.source,b.tutor_id,b.learner_id,b.booked_by_user_id,b.subject_id,$2::timestamptz-interval '2 days'-i*interval '2 hours',$2::timestamptz-interval '2 days'-i*interval '2 hours'+interval '1 hour','UTC',gen_random_uuid(),repeat('a',64),'confirmed',$2::timestamptz-interval '3 days'-i*interval '2 hours',$2::timestamptz-interval '3 days'-i*interval '2 hours'+interval '10 minutes',b.workflow_policy_id,b.admission_policy_id
        FROM bookings b CROSS JOIN generate_series($3::int,$4::int)i WHERE b.id=$1::uuid RETURNING *
      ) INSERT INTO booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code)
      SELECT logical_booking_id,id,booked_by_user_id,'workflow_confirmed',idempotency_key,request_fingerprint,created_at,workflow_policy_id,0,'local_parent_booking' FROM added`,
        [fixture.parent.bookingId, now, inserted + 1, count],
      );
      inserted = count;
    }
    await client.query("ANALYZE public.bookings");
    await client.query("SET LOCAL ROLE learli_app");
    for (let iteration = 0; iteration < 17; iteration++) {
      const output = {};
      for (const variant of iteration % 2
        ? ["after", "before"]
        : ["before", "after"]) {
        const start = performance.now();
        output[variant] = (
          await client.query(queries[variant], args[variant])
        ).rows;
        if (iteration > 1)
          result.samples.push({
            count,
            variant,
            ms: performance.now() - start,
            rows: output[variant].length,
          });
      }
      const relevant = output.before.filter(
        (row) => row.end > from && row.start < until,
      );
      const key = (row) =>
        `${row.start.toISOString()}-${row.end.toISOString()}`;
      assert.deepEqual(relevant.map(key).sort(), output.after.map(key).sort());
    }
    for (const variant of ["before", "after"]) {
      const plan = (
        await client.query(
          `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${queries[variant]}`,
          args[variant],
        )
      ).rows[0]["QUERY PLAN"];
      result.plans.push({ count, variant, plan });
    }
    await client.query("RESET ROLE");
  }
  result.inventory = (
    await client.query(
      "SELECT (SELECT count(*)::int FROM tutor_profiles) tutors,(SELECT count(*)::int FROM tutor_subjects) offerings,(SELECT count(*)::int FROM tutor_availability) weekly_windows",
    )
  ).rows[0];
  writeFileSync(".local/bounds.json", JSON.stringify(result, null, 2), {
    mode: 0o600,
  });
  console.log(
    "Recorded bounded-query growth samples and PostgreSQL plans; synthetic growth rows rolled back.",
  );
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
