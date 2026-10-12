import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export class BaselineError extends Error {}

export function fixtureEmail(run, kind, index) {
  if (
    !/^[a-f0-9-]{36}$/.test(run) ||
    !["learner", "tutor"].includes(kind) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 24
  )
    throw new BaselineError("Invalid bounded fixture identity.");
  return `performance-${kind}-${run}-${index}@learli.test`;
}

export async function disposeContexts(contexts) {
  const results = await Promise.allSettled(
    contexts.map((context) => context.dispose()),
  );
  return results.every((row) => row.status === "fulfilled");
}

export const workload = Object.freeze({
  tutors: 24,
  repetitions: 2,
  pageWarmups: 1,
  pageSamples: 3,
  bookingWarmups: 2,
  bookingPairsPerRepetition: 8,
});

export function distribution(samples) {
  if (!samples.length) throw new BaselineError("No timing samples.");
  if (samples.some((value) => !Number.isFinite(value) || value < 0))
    throw new BaselineError("Invalid timing sample.");
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.ceil((p / 100) * sorted.length) - 1];
  return {
    n: sorted.length,
    min: sorted[0],
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50: percentile(50),
    p95: percentile(95),
    max: sorted.at(-1),
  };
}

export function validateEnvironment(env, state) {
  if (env.APP_ENV !== "test" || env.AUTH_MODE !== "local")
    throw new BaselineError("Dedicated test/local configuration required.");
  const app = new URL(env.APP_URL);
  const database = new URL(env.DATABASE_URL);
  const owner = new URL(env.DATABASE_URL_DIRECT);
  if (
    app.protocol !== "http:" ||
    app.hostname !== "127.0.0.1" ||
    app.username ||
    app.password ||
    app.pathname !== "/" ||
    app.search ||
    app.hash ||
    app.port !== String(state.ports.test) ||
    env.BETTER_AUTH_URL !== app.origin ||
    env.LEARLI_TEST_PORT !== app.port ||
    env.LEARLI_DB_PORT !== String(state.ports.database)
  )
    throw new BaselineError(
      "Explicit owned loopback application ports required.",
    );
  for (const target of [database, owner]) {
    if (
      target.protocol !== "postgresql:" ||
      target.hostname !== "127.0.0.1" ||
      target.port !== String(state.ports.database) ||
      target.pathname !== "/learli_test" ||
      target.search ||
      target.hash
    )
      throw new BaselineError("Owned loopback test database required.");
  }
  if (
    database.username !== "learli_app" ||
    owner.username !== "learli_owner" ||
    database.password !== state.appPassword ||
    owner.password !== state.ownerPassword
  )
    throw new BaselineError("Private owned database state does not match.");
  return app.origin;
}

export function ownedEnvironment(env, root = process.cwd()) {
  if (!existsSync(path.join(root, ".local/postgres/learli-owned")))
    throw new BaselineError("Owned local cluster marker required.");
  const state = JSON.parse(
    readFileSync(path.join(root, ".local/database.json"), "utf8"),
  );
  return validateEnvironment(env, state);
}

export function sourceIdentity(root = process.cwd()) {
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .filter((file) =>
      /^(src\/|public\/|scripts\/|drizzle\/|package.*json$|.*config\.|\.nvmrc$|\.npmrc$)/.test(
        file,
      ),
    );
  const manifest = [...new Set(files)].sort().map((file) => ({
    file,
    sha256: createHash("sha256")
      .update(readFileSync(path.join(root, file)))
      .digest("hex"),
  }));
  return {
    head: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    manifest,
    aggregate: createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex"),
  };
}
