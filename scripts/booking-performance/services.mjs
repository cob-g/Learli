import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { parseEnv } from "node:util";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
if (
  !process.env.LEARLI_PERFORMANCE_ROOT ||
  realpathSync(process.env.LEARLI_PERFORMANCE_ROOT) !==
    realpathSync(process.cwd()) ||
  !realpathSync(process.cwd()).startsWith(
    `${realpathSync("/tmp")}/learli-booking-perf-`,
  )
)
  throw new Error("Explicit owned performance copy required");
Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
const fixture = JSON.parse(
  readFileSync(".local/performance-fixture.json", "utf8"),
);
if (fixture.origin !== "http://127.0.0.1:3410")
  throw new Error("Owned origin required");
const label = process.argv[2];
if (!/^(before|after)$/.test(label)) throw new Error("Choose before or after");
const { samples } = await import("./probe.mjs");
const { createLocalAuth } = await import("../../src/lib/auth-factory.ts");
const { bookingWorkflowContext } =
  await import("../../src/features/booking-workflows/composition.ts");
const { readWorkflowCandidates, readWorkflowMoveCandidates } =
  await import("../../src/features/booking-workflows/service.ts");
const { listParticipantBookingOverview } =
  await import("../../src/features/bookings/read-service.ts");
const { formatLessonTime, createLessonTimeFormatter } =
  await import("../../src/features/bookings/format-time.ts");
const runtime = createLocalAuth(process.env);
const result = { label, calls: [], formatting: [], metrics: samples };
const headers = new Headers({ cookie: fixture.parent.cookie });
try {
  const context = bookingWorkflowContext(runtime);
  const choice = {
    learnerId: fixture.parent.learnerId,
    tutorSlug: fixture.tutor.slug,
    subjectSlug: "math",
    displayTimezone: "Asia/Manila",
  };
  for (let iteration = 0; iteration < 17; iteration++) {
    for (const operation of [
      "candidates",
      "reschedule",
      "parent-overview",
      "student-overview",
    ]) {
      const mark = samples.length;
      const start = performance.now();
      const value =
        operation === "candidates"
          ? await readWorkflowCandidates(context, headers, choice)
          : operation === "reschedule"
            ? await readWorkflowMoveCandidates(
                context,
                headers,
                fixture.parent.bookingId,
              )
            : await listParticipantBookingOverview(
                runtime,
                new Headers({
                  cookie:
                    fixture[
                      operation === "parent-overview" ? "parent" : "student"
                    ].cookie,
                }),
                {
                  scope:
                    operation === "parent-overview" ? "guardian" : "student",
                },
              );
      if (iteration > 1)
        result.calls.push({
          operation,
          iteration,
          ms: performance.now() - start,
          count: Array.isArray(value)
            ? value.length
            : value.active.items.length,
          queries: samples.slice(mark).filter((row) => row.kind === "query")
            .length,
          transactions: samples
            .slice(mark)
            .filter((row) => row.kind === "transaction"),
        });
    }
  }
  for (const zone of [
    "Asia/Manila",
    "America/New_York",
    "Australia/Lord_Howe",
  ]) {
    for (const count of [42, 210]) {
      const slots = Array.from({ length: count }, (_, i) => {
        const start = new Date(Date.UTC(2026, 9, 30, 0, 0) + i * 30 * 60000);
        return [start, new Date(start.getTime() + 3600000)];
      });
      for (let iteration = 0; iteration < 17; iteration++) {
        const variants =
          iteration % 2 ? ["reuse", "fresh"] : ["fresh", "reuse"];
        const output = {};
        for (const variant of variants) {
          const start = performance.now();
          const format =
            variant === "reuse"
              ? createLessonTimeFormatter(zone)
              : (a, b) => formatLessonTime(a, b, zone);
          output[variant] = slots.map(([a, b]) => format(a, b));
          if (iteration > 1)
            result.formatting.push({
              zone,
              count,
              iteration,
              variant,
              ms: performance.now() - start,
            });
        }
        assert.deepEqual(output.fresh, output.reuse);
      }
    }
  }
  writeFileSync(
    `.local/service-${label}.json`,
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  console.log(
    `Recorded ${result.calls.length} current-service and ${result.formatting.length} alternating formatting samples (${label}).`,
  );
} finally {
  await runtime.pool.end();
}
