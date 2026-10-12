import { spawn, execFileSync } from "node:child_process";
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import os from "node:os";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import {
  BaselineError,
  disposeContexts,
  ownedEnvironment,
  sourceIdentity,
  distribution,
  workload,
} from "./performance-baseline-core.mjs";
import {
  createFixtures,
  fixtureRegistry,
  cleanupFixtures,
} from "./performance-baseline-fixtures.mjs";

const output = `.local/readiness-wave/performance-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
const results = {
  status: "pending",
  stage: "guard",
  samples: [],
  invariants: [],
  workload,
  startedAt: new Date().toISOString(),
};
let pool,
  browser,
  server,
  record,
  outputCreated = false;

async function portIsFree(port) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () =>
      reject(new BaselineError("Refusing an existing application listener.")),
    );
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
}

async function startServer(origin) {
  await portIsFree(Number(new URL(origin).port));
  const log = openSync(`${output}/server.log`, "wx", 0o600);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      new URL(origin).port,
    ],
    {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", log, log],
    },
  );
  closeSync(log);
  server.once("error", () => {});
  const deadline = performance.now() + 60_000;
  while (performance.now() < deadline) {
    if (server.exitCode !== null)
      throw new BaselineError("Owned application exited during startup.");
    try {
      const response = await fetch(`${origin}/api/health`, {
        redirect: "error",
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      /* Only the owned loopback server is retried during startup. */
    }
    await delay(200);
  }
  throw new BaselineError("Owned application startup timed out.");
}

async function timedRequest(context, method, url, options) {
  const start = performance.now();
  const response = await context[method](url, { ...options, maxRedirects: 0 });
  const body = await response.body();
  return {
    status: response.status(),
    ms: performance.now() - start,
    body: JSON.parse(body.toString("utf8")),
  };
}

async function candidates(actor, tutor, origin) {
  const query = new URLSearchParams({
    learnerId: actor.learnerId,
    tutorSlug: tutor.slug,
    subjectSlug: "math",
    displayTimezone: "UTC",
  });
  const response = await timedRequest(
    actor.context,
    "get",
    `/api/bookings/demo/candidates?${query}`,
    { headers: { origin } },
  );
  if (response.status !== 200 || !response.body.times?.length)
    throw new BaselineError("Authenticated candidates were unavailable.");
  return response;
}

async function bookingPair(actors, tutor, origin, measured, repetition) {
  const available = await candidates(actors[0], tutor, origin);
  const time = available.body.times[0];
  const payloads = actors.map((actor) => ({
    learnerId: actor.learnerId,
    tutorSlug: tutor.slug,
    subjectSlug: "math",
    displayTimezone: "UTC",
    startAtUtc: time.startAtUtc,
    endAtUtc: time.endAtUtc,
    idempotencyKey: randomUUID(),
  }));
  const responses = await Promise.all(
    actors.map((actor, index) =>
      timedRequest(actor.context, "post", "/api/bookings/demo", {
        headers: { origin },
        data: payloads[index],
      }),
    ),
  );
  if (
    responses
      .map((row) => row.status)
      .sort()
      .join() !== "200,409"
  )
    throw new BaselineError(
      "Booking pair did not produce exactly one success and conflict.",
    );
  const winner = responses.findIndex((row) => row.status === 200);
  const loser = 1 - winner;
  if (
    responses[loser].body.message !==
    "That time is no longer available. Please choose another."
  )
    throw new BaselineError("409 response was not an overlap conflict.");
  if (responses[winner].body.state !== "demo_reserved")
    throw new BaselineError("Unexpected reservation state.");
  const replay = await timedRequest(
    actors[winner].context,
    "post",
    "/api/bookings/demo",
    { headers: { origin }, data: payloads[winner] },
  );
  if (replay.status !== 200 || replay.body.id !== responses[winner].body.id)
    throw new BaselineError("Idempotent retry invariant failed.");
  const proof = await pool.query(
    "SELECT count(*)::int AS bookings,(SELECT count(*)::int FROM booking_events WHERE booking_id IN (SELECT id FROM bookings WHERE tutor_id=$1)) AS events FROM bookings WHERE tutor_id=$1",
    [tutor.profileId],
  );
  if (proof.rows[0].bookings !== 1 || proof.rows[0].events !== 1)
    throw new BaselineError("Reservation/history count invariant failed.");
  results.invariants.push({
    repetition,
    measured,
    oneReservation: true,
    oneCreationEvent: true,
    conflict: true,
    idempotentReplay: true,
  });
  if (measured) {
    for (const [operation, ms] of [
      ["authenticated-availability", available.ms],
      ["booking-success", responses[winner].ms],
      ["booking-conflict", responses[loser].ms],
      ["booking-retry", replay.ms],
    ])
      results.samples.push({ repetition, operation, ms });
  }
}

async function pageSamples(origin, tutors, repetition) {
  const routes = [
    ["directory", "/tutors?subject=math&level=college_support"],
    [
      "directory-availability",
      "/tutors?subject=math&level=college_support&when=any&timezone=UTC",
    ],
    [
      "profile-availability",
      `/tutors/${tutors[0].slug}?subject=math&level=college_support&displayTimezone=UTC`,
    ],
  ];
  for (const [viewport, dimensions] of [
    ["desktop", { width: 1440, height: 900 }],
    ["phone-sized", { width: 390, height: 844 }],
  ]) {
    for (const [operation, route] of routes) {
      for (const cache of ["fresh-context", "warm-context"]) {
        let context;
        const makeContext = async () => {
          const created = await browser.newContext({
            viewport: dimensions,
            serviceWorkers: "block",
            timezoneId: "UTC",
          });
          // CDP interception blocks external providers; resource sizes record
          // observed cache reuse rather than assuming that it happened.
          return created;
        };
        try {
          if (cache === "warm-context") context = await makeContext();
          for (
            let sample = -workload.pageWarmups;
            sample < workload.pageSamples;
            sample++
          ) {
            if (cache === "fresh-context") context = await makeContext();
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send("Fetch.enable", {
              patterns: [{ urlPattern: "*", requestStage: "Request" }],
            });
            cdp.on("Fetch.requestPaused", async (event) => {
              const url = new URL(event.request.url);
              if (url.origin === origin)
                await cdp
                  .send("Fetch.continueRequest", { requestId: event.requestId })
                  .catch(() => {});
              else {
                results.externalRequestsBlocked =
                  (results.externalRequestsBlocked ?? 0) + 1;
                await cdp
                  .send("Fetch.failRequest", {
                    requestId: event.requestId,
                    errorReason: "BlockedByClient",
                  })
                  .catch(() => {});
              }
            });
            const response = await page.goto(`${origin}${route}`, {
              waitUntil: "load",
              timeout: 30_000,
            });
            if (response?.status() !== 200)
              throw new BaselineError("Public navigation did not succeed.");
            if (operation === "profile-availability")
              await page
                .locator('input[name="time"]')
                .first()
                .waitFor({ state: "visible" });
            else {
              await page
                .getByRole("link", { name: /^View profile:/ })
                .first()
                .waitFor({ state: "visible" });
              if (
                (await page
                  .getByRole("link", { name: /^View profile:/ })
                  .count()) !== 20
              )
                throw new BaselineError(
                  "Directory sample did not render its real first page.",
                );
              if (
                operation === "directory-availability" &&
                (await page.locator("time").count()) === 0
              )
                throw new BaselineError(
                  "Directory availability sample had no actual times.",
                );
            }
            const timing = await page.evaluate(() => {
              const entry = performance.getEntriesByType("navigation")[0];
              return {
                ttfb: entry.responseStart - entry.startTime,
                htmlResponse: entry.responseEnd - entry.startTime,
                domContentLoaded:
                  entry.domContentLoadedEventEnd - entry.startTime,
                load: entry.loadEventEnd - entry.startTime,
                transferSize: entry.transferSize,
                encodedBodySize: entry.encodedBodySize,
                cachedResources: performance
                  .getEntriesByType("resource")
                  .filter(
                    (row) => row.transferSize === 0 && row.decodedBodySize > 0,
                  ).length,
              };
            });
            if (sample >= 0)
              results.samples.push({
                repetition,
                operation,
                viewport,
                cache,
                ...timing,
                ms: timing.load,
              });
            await page.close();
            if (cache === "fresh-context") {
              await context.close();
              context = undefined;
            }
          }
        } finally {
          if (context) await context.close();
        }
      }
    }
  }
}

async function main() {
  const origin = ownedEnvironment(process.env);
  if (
    process.argv.length !== 2 ||
    process.env.PERFORMANCE_SLOT !== "exclusive" ||
    !process.env.PERFORMANCE_CANDIDATE
  )
    throw new BaselineError(
      "Explicit coordinator candidate and exclusive timing slot required; no workload overrides.",
    );
  mkdirSync(output, { recursive: true, mode: 0o700 });
  outputCreated = true;
  results.source = sourceIdentity();
  results.buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
  results.candidate = process.env.PERFORMANCE_CANDIDATE;
  results.environment = {
    appEnv: "test",
    authMode: "local",
    appPort: Number(new URL(origin).port),
    databasePort: Number(process.env.LEARLI_DB_PORT),
    node: process.version,
    os: os.type(),
    osRelease: os.release(),
    architecture: os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryBytes: os.totalmem(),
    freeMemoryBefore: os.freemem(),
    server: "next start, production build",
    network: "loopback, no network/CPU throttling",
    percentiles: "nearest rank; milliseconds; no outlier removal",
  };
  results.environment.npm = execFileSync("npm", ["--version"], {
    encoding: "utf8",
  }).trim();
  results.environment.packages = Object.fromEntries(
    ["next", "pg", "@playwright/test", "better-auth"].map((name) => [
      name,
      JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8"))
        .version,
    ]),
  );
  results.stage = "setup";
  const [{ default: pg }, { chromium, request }] = await Promise.all([
    import("pg"),
    import("@playwright/test"),
  ]);
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL_DIRECT,
    max: 1,
  });
  results.environment.postgresql = (
    await pool.query("SHOW server_version")
  ).rows[0].server_version;
  await startServer(origin);
  record = fixtureRegistry(`${output}/private-fixture-registry.json`);
  const fixtures = await createFixtures(pool, request, origin, record);
  const { actors, tutors } = fixtures;
  for (const tutor of tutors.slice(0, 2)) {
    const available = await candidates(actors[0], tutor, origin);
    const response = await actors[0].context.post("/api/bookings/demo", {
      headers: { origin },
      data: {
        learnerId: actors[0].learnerId,
        tutorSlug: tutor.slug,
        subjectSlug: "math",
        displayTimezone: "UTC",
        startAtUtc: available.body.times[0].startAtUtc,
        endAtUtc: available.body.times[0].endAtUtc,
        idempotencyKey: randomUUID(),
      },
    });
    if (response.status() !== 200)
      throw new BaselineError("Pre-existing reservation fixture failed.");
  }
  const denied = await actors[1].context.get(
    `/api/bookings/demo/candidates?${new URLSearchParams({ learnerId: actors[0].learnerId, tutorSlug: tutors[0].slug, subjectSlug: "math", displayTimezone: "UTC" })}`,
    { headers: { origin } },
  );
  if (denied.status() !== 404)
    throw new BaselineError("Cross-owner candidate read was not denied.");
  results.crossOwnerDenied = true;
  results.dataset = {
    approvedTutors: tutors.length,
    subjects: 1,
    offerings: tutors.length,
    weeklyWindows: tutors.length * 7,
    datedExceptions: tutors.length,
    independentLearners: actors.length,
    preExistingReservations: 2,
    teachingZones: ["UTC", "Asia/Manila", "America/New_York"],
    weeklyWindowLocal: "18:00–20:00 daily",
    localDurationMinutes: 60,
    localStepMinutes: 30,
    localHorizonDays: 14,
    localNoticeMinutes: 60,
    localTtlMinutes: 10,
  };
  results.dataset.observedRows = (
    await pool.query(`SELECT
      (SELECT count(*)::int FROM "user") AS users,
      (SELECT count(*)::int FROM subjects) AS catalog_subjects,
      (SELECT count(*)::int FROM tutor_profiles) AS tutors,
      (SELECT count(*)::int FROM tutor_subjects) AS offerings,
      (SELECT count(*)::int FROM tutor_availability) AS weekly_windows,
      (SELECT count(*)::int FROM tutor_availability_exceptions) AS exceptions,
      (SELECT count(*)::int FROM learner_profiles) AS learners,
      (SELECT count(*)::int FROM bookings) AS bookings`)
  ).rows[0];
  browser = await chromium.launch({ headless: true });
  results.environment.browser = browser.version();
  for (let warmup = 0; warmup < workload.bookingWarmups; warmup++)
    await bookingPair(actors, tutors[2 + warmup], origin, false, 0);
  results.stage = "measurement";
  for (let repetition = 1; repetition <= workload.repetitions; repetition++) {
    console.log(
      `Local performance repetition ${repetition}/${workload.repetitions}.`,
    );
    await pageSamples(origin, tutors, repetition);
    for (let sample = 0; sample < workload.bookingPairsPerRepetition; sample++)
      await bookingPair(
        actors,
        tutors[
          4 + (repetition - 1) * workload.bookingPairsPerRepetition + sample
        ],
        origin,
        true,
        repetition,
      );
  }
  const groups = Map.groupBy(results.samples, (row) =>
    [
      row.operation,
      row.viewport ?? "http",
      row.cache ?? "provider-session",
      row.repetition,
    ].join("/"),
  );
  results.distributions = Object.fromEntries(
    [...groups].map(([key, rows]) => [
      key,
      distribution(rows.map((row) => row.ms)),
    ]),
  );
  if (sourceIdentity().aggregate !== results.source.aggregate)
    throw new BaselineError(
      "Source changed during measurement; result invalidated.",
    );
  results.status = "passed";
}

try {
  await main();
} catch (error) {
  results.status = "failed";
  results.failure =
    error instanceof BaselineError
      ? error.message
      : "Unexpected failure; raw payload excluded.";
  console.error(
    `Local performance failed at ${results.stage}; private evidence retained, no sensitive payload printed.`,
  );
  process.exitCode = 1;
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {
      results.browserClose = "failed";
      results.status = "failed";
      process.exitCode = 1;
    }
  }
  if (record) {
    if (!(await disposeContexts(record.contexts))) {
      results.contextClose = "failed";
      results.status = "failed";
      process.exitCode = 1;
    }
  }
  if (pool && record) {
    try {
      await cleanupFixtures(pool, record);
      results.cleanup = "passed";
    } catch {
      results.cleanup = "failed";
      results.status = "failed";
      process.exitCode = 1;
    }
  }
  if (pool) {
    try {
      await pool.end();
    } catch {
      results.poolClose = "failed";
      results.status = "failed";
      process.exitCode = 1;
    }
  }
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      delay(5000),
    ]);
    if (server.exitCode === null) {
      server.kill("SIGKILL");
      results.status = "failed";
      results.serverStop = "forced";
      process.exitCode = 1;
    }
  }
  results.finishedAt = new Date().toISOString();
  results.limits = [
    "Local lab only; phone-sized Chromium is not physical mobile hardware or mobile field data.",
    "Small n; p95 is near the observed maximum, not a stable service percentile.",
    "Warm server/DB caches and uncontrolled OS cache; no production/Neon/Railway/provider/network latency.",
    "Booking pairs exercise concurrency two, not sustained throughput or capacity.",
    "Fixture setup, candidate selection, proof queries and cleanup excluded from booking request timings; same server shares local DB/browser hardware.",
    "No SLA/target threshold chosen; actual target-device/connection profiles remain future NFR-08 work.",
  ];
  if (outputCreated)
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2), {
      mode: 0o600,
    });
  console.log(
    `Local performance ${results.status}; evidence ${output}/results.json.`,
  );
}
