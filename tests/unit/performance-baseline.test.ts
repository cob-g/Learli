import { describe, expect, it } from "vitest";
import {
  distribution,
  disposeContexts,
  fixtureEmail,
  validateEnvironment,
  workload,
} from "../../scripts/performance-baseline-core.mjs";

const state = {
  ports: { database: 55506, test: 3166 },
  appPassword: "fixture-app",
  ownerPassword: "fixture-owner",
};
const env = {
  APP_ENV: "test",
  AUTH_MODE: "local",
  APP_URL: "http://127.0.0.1:3166",
  BETTER_AUTH_URL: "http://127.0.0.1:3166",
  LEARLI_TEST_PORT: "3166",
  LEARLI_DB_PORT: "55506",
  DATABASE_URL:
    "postgresql://learli_app:fixture-app@127.0.0.1:55506/learli_test",
  DATABASE_URL_DIRECT:
    "postgresql://learli_owner:fixture-owner@127.0.0.1:55506/learli_test",
};
describe("local performance harness safety and statistics", () => {
  it("gives every learner/tutor a distinct bounded synthetic identity", () => {
    const run = "11111111-1111-4111-8111-111111111111";
    const emails = [
      ...Array.from({ length: 2 }, (_, index) =>
        fixtureEmail(run, "learner", index),
      ),
      ...Array.from({ length: workload.tutors }, (_, index) =>
        fixtureEmail(run, "tutor", index),
      ),
    ];
    expect(new Set(emails).size).toBe(26);
    expect(emails.every((email) => email.endsWith("@learli.test"))).toBe(true);
    expect(() => fixtureEmail(run, "tutor", 24)).toThrow();
    expect(() => fixtureEmail(run, "tutor", -1)).toThrow();
    expect(() => fixtureEmail("unbounded", "tutor", 0)).toThrow();
  });
  it("continues disposal after a context failure so database cleanup can follow", async () => {
    const visited: string[] = [];
    const closed = await disposeContexts([
      {
        dispose: async () => {
          visited.push("failed");
          throw new Error("Injected teardown failure");
        },
      },
      {
        dispose: async () => {
          visited.push("closed");
        },
      },
    ]);
    expect(closed).toBe(false);
    expect(visited).toEqual(["failed", "closed"]);
    expect(await disposeContexts([])).toBe(true);
  });
  it("uses nearest-rank percentiles and preserves the input", () => {
    const samples = [4, 1, 3, 2];
    expect(distribution(samples)).toEqual({
      n: 4,
      min: 1,
      mean: 2.5,
      p50: 2,
      p95: 4,
      max: 4,
    });
    expect(samples).toEqual([4, 1, 3, 2]);
    expect(distribution([0])).toEqual({
      n: 1,
      min: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      max: 0,
    });
  });
  it.each([[], [-1], [NaN], [Infinity]].map((samples) => ({ samples })))(
    "rejects invalid distribution %#",
    ({ samples }) => {
      expect(() => distribution(samples)).toThrow();
    },
  );
  it("accepts only the matching owned test configuration", () => {
    expect(validateEnvironment(env, state)).toBe(env.APP_URL);
  });
  it.each([
    { APP_ENV: "production" },
    { AUTH_MODE: "disabled" },
    { APP_URL: "https://127.0.0.1:3166" },
    { APP_URL: "http://localhost:3166" },
    { APP_URL: "http://127.0.0.1:3166@remote.test" },
    { APP_URL: "http://127.0.0.1:3166/private" },
    { APP_URL: "http://127.0.0.1:3166?x=1" },
    { LEARLI_TEST_PORT: "3100" },
    { LEARLI_DB_PORT: "55432" },
    { BETTER_AUTH_URL: "http://127.0.0.1:3100" },
    {
      DATABASE_URL_DIRECT:
        "postgresql://learli_owner:fixture-owner@remote.test:55506/learli_test",
    },
    {
      DATABASE_URL:
        "postgresql://learli_app:fixture-app@127.0.0.1:55506/learli_dev",
    },
    {
      DATABASE_URL_DIRECT:
        "postgresql://learli_owner:wrong@127.0.0.1:55506/learli_test",
    },
  ])("refuses unsafe configuration %# before fixture work", (change) => {
    expect(() => validateEnvironment({ ...env, ...change }, state)).toThrow();
  });
  it("keeps a bounded immutable workload under existing actor quotas", () => {
    expect(Object.isFrozen(workload)).toBe(true);
    expect(
      2 +
        workload.bookingWarmups +
        workload.repetitions * workload.bookingPairsPerRepetition,
    ).toBeLessThanOrEqual(20);
    expect(workload.tutors).toBeGreaterThan(20);
    expect(workload.tutors).toBeLessThanOrEqual(100);
  });
});
