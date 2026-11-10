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
const { createLocalAuth } = await import("../../src/lib/auth-factory.ts");
const { listEligibleTutors } =
  await import("../../src/features/tutors/eligibility.ts");
const { readPublicCandidates } =
  await import("../../src/features/public-availability/service.ts");
const { createLessonTimeFormatter } =
  await import("../../src/features/bookings/format-time.ts");
const runtime = createLocalAuth(process.env);
const result = { catalog: [], formatting: [], slots: 0 };
try {
  const candidates = await readPublicCandidates(runtime, {
    tutorSlugs: [fixture.tutor.slug],
    subjectSlug: "math",
    level: "high_school",
    displayTimezone: "UTC",
  });
  const intervals = candidates.tutors[0].times.map((time) => [
    new Date(time.startAtUtc),
    new Date(time.endAtUtc),
  ]);
  result.slots = intervals.length;
  assert.ok(intervals.length > 42);
  for (let iteration = 0; iteration < 22; iteration++) {
    const start = performance.now();
    const tutors = await listEligibleTutors(
      runtime.db,
      { subject: "math", level: "high_school" },
      "local_operation",
    );
    if (iteration > 1)
      result.catalog.push({
        ms: performance.now() - start,
        tutors: tutors.length,
      });
    const outputs = {};
    for (const variant of iteration % 2 ? ["first", "all"] : ["all", "first"]) {
      const begin = performance.now();
      const viewer = createLessonTimeFormatter("UTC"),
        tutor = createLessonTimeFormatter("Asia/Manila");
      outputs[variant] = (
        variant === "all" ? intervals : intervals.slice(0, 1)
      ).map(([from, to]) => ({
        ...viewer(from, to),
        tutorTime: tutor(from, to),
      }));
      if (iteration > 1)
        result.formatting.push({ variant, ms: performance.now() - begin });
    }
    assert.deepEqual(outputs.all[0], outputs.first[0]);
  }
  writeFileSync(".local/discovery.json", JSON.stringify(result, null, 2), {
    mode: 0o600,
  });
  console.log(
    "Recorded current catalog reads and 20 paired all-slot/first-slot-only formatting samples; no discovery contract changed.",
  );
} finally {
  await runtime.pool.end();
}
