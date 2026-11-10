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
const { samples } = await import("./probe.mjs");
const { createLocalAuth } = await import("../../src/lib/auth-factory.ts");
const { bookingWorkflowContext } =
  await import("../../src/features/booking-workflows/composition.ts");
// Copy the original service beside the candidate in the owned mirror only,
// verifying its bytes against the pre-edit manifest. Never ship that copy.
const before =
  await import("../../src/features/booking-workflows/service-performance-before.ts");
const after = await import("../../src/features/booking-workflows/service.ts");
const runtime = createLocalAuth(process.env);
const context = bookingWorkflowContext(runtime);
const headers = new Headers({ cookie: fixture.parent.cookie });
const choice = {
  learnerId: fixture.parent.learnerId,
  tutorSlug: fixture.tutor.slug,
  subjectSlug: "math",
  displayTimezone: "Asia/Manila",
};
const rows = [];
try {
  for (let iteration = 0; iteration < 22; iteration++) {
    for (const operation of ["candidates", "reschedule"]) {
      const outputs = {};
      for (const variant of iteration % 2
        ? ["after", "before"]
        : ["before", "after"]) {
        const service = variant === "before" ? before : after;
        const mark = samples.length;
        const start = performance.now();
        const value =
          operation === "candidates"
            ? await service.readWorkflowCandidates(context, headers, choice)
            : await service.readWorkflowMoveCandidates(
                context,
                headers,
                fixture.parent.bookingId,
              );
        outputs[variant] = value;
        if (iteration > 1)
          rows.push({
            iteration,
            operation,
            variant,
            ms: performance.now() - start,
            count: value.length,
            transactions: samples
              .slice(mark)
              .filter((sample) => sample.kind === "transaction"),
          });
      }
      assert.deepEqual(outputs.before, outputs.after);
    }
  }
  writeFileSync(".local/service-paired.json", JSON.stringify(rows, null, 2), {
    mode: 0o600,
  });
  console.log(
    "Recorded 20 alternating pairs per current service with identical full output.",
  );
} finally {
  await runtime.pool.end();
}
