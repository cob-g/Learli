import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";

const runtime = vi.hoisted(() => ({
  db: { synthetic: true },
  createDatabase: vi.fn(),
  migrate: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));

// Import the real entrypoint, but never the database implementation or migrator.
vi.mock("../../src/lib/db/connection", () => ({
  createDatabase: runtime.createDatabase,
}));
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: runtime.migrate,
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const usage = "Usage: tsx scripts/migrate-local.ts [--test]";
const failure =
  "Local migration failed; details omitted. Existing data was not reset.";
const targets = [
  { name: "development", args: [], file: ".env.local", testing: false },
  { name: "test", args: ["--test"], file: ".env.test.local", testing: true },
];

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.argv = ["node", "scripts/migrate-local.ts"];
  process.exitCode = 0;
  // A non-URL sentinel replaces inherited credentials before entrypoint execution.
  vi.stubEnv("DATABASE_URL_DIRECT", undefined);
  vi.spyOn(process, "loadEnvFile").mockImplementation((file) => {
    if (file !== ".env.local" && file !== ".env.test.local") {
      throw new Error("Unexpected synthetic environment target.");
    }
    vi.stubEnv("DATABASE_URL_DIRECT", `synthetic:${file}`);
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  runtime.createDatabase.mockReturnValue({
    db: runtime.db,
    pool: { query: runtime.query, end: runtime.end },
  });
  runtime.migrate.mockResolvedValue(undefined);
  runtime.query.mockResolvedValue([]);
  runtime.end.mockResolvedValue(undefined);
});

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function run(args: string[]) {
  process.argv = ["node", "scripts/migrate-local.ts", ...args];
  await import("../../scripts/migrate-local");
}

describe("local migration entrypoint arguments", () => {
  it.each([
    { args: ["--tset"] },
    { args: ["--development"] },
    { args: ["--help"] },
    { args: ["--test=true"] },
    { args: ["--test=false"] },
    { args: ["test"] },
    { args: ["development"] },
    { args: [""] },
    { args: ["--"] },
    { args: ["--test", "--test"] },
    { args: ["--test", "--tset"] },
    { args: ["--tset", "--test"] },
    { args: ["--test", "PRIVATE_SYNTHETIC_ARGUMENT"] },
    { args: ["PRIVATE_SYNTHETIC_ARGUMENT", "--test"] },
    { args: ["--test", "--"] },
    { args: ["--", "--test"] },
  ])("refuses $args before environment or database work", async ({ args }) => {
    await run(args);

    expect(process.loadEnvFile).not.toHaveBeenCalled();
    expect(runtime.createDatabase).not.toHaveBeenCalled();
    expect(runtime.migrate).not.toHaveBeenCalled();
    expect(runtime.query).not.toHaveBeenCalled();
    expect(runtime.end).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(usage);
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each(targets)(
    "preserves the $name target, migration, grants and cleanup",
    async ({ args, file, testing, name }) => {
      await run(args);

      expect(process.loadEnvFile).toHaveBeenCalledExactlyOnceWith(file);
      expect(runtime.createDatabase).toHaveBeenCalledExactlyOnceWith(
        `synthetic:${file}`,
        testing,
      );
      expect(runtime.migrate).toHaveBeenCalledExactlyOnceWith(runtime.db, {
        migrationsFolder: "drizzle",
      });
      expect(runtime.query).toHaveBeenCalledExactlyOnceWith(runtimeGrantsSql);
      expect(runtime.end).toHaveBeenCalledExactlyOnceWith();
      expect(console.log).toHaveBeenCalledExactlyOnceWith(
        `Reviewed migrations applied to local ${name} database. Runtime grants restricted.`,
      );
      expect(console.error).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(0);
      expect(vi.mocked(process.loadEnvFile)).toHaveBeenCalledBefore(
        runtime.createDatabase,
      );
      expect(runtime.createDatabase).toHaveBeenCalledBefore(runtime.migrate);
      expect(runtime.migrate).toHaveBeenCalledBefore(runtime.query);
      expect(runtime.query).toHaveBeenCalledBefore(runtime.end);
    },
  );

  it.each(targets)(
    "redacts migration failure, skips grants and closes the $name pool",
    async ({ args }) => {
      runtime.migrate.mockRejectedValueOnce(new Error("PRIVATE_DRIVER_ERROR"));
      await run(args);

      expect(runtime.migrate).toHaveBeenCalledTimes(1);
      expect(runtime.query).not.toHaveBeenCalled();
      expect(runtime.end).toHaveBeenCalledExactlyOnceWith();
      expect(console.error).toHaveBeenCalledExactlyOnceWith(failure);
      expect(console.log).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    },
  );

  it.each(targets)(
    "redacts grant failure and closes the $name pool",
    async ({ args }) => {
      runtime.query.mockRejectedValueOnce(new Error("PRIVATE_DRIVER_ERROR"));
      await run(args);

      expect(runtime.query).toHaveBeenCalledExactlyOnceWith(runtimeGrantsSql);
      expect(runtime.end).toHaveBeenCalledExactlyOnceWith();
      expect(console.error).toHaveBeenCalledExactlyOnceWith(failure);
      expect(console.log).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    },
  );

  it("preserves environment-loading failure before database construction", async () => {
    const error = new Error("Synthetic environment-loading failure.");
    vi.mocked(process.loadEnvFile).mockImplementationOnce(() => {
      throw error;
    });
    await expect(run([])).rejects.toBe(error);
    expect(runtime.createDatabase).not.toHaveBeenCalled();
    expect(runtime.migrate).not.toHaveBeenCalled();
    expect(runtime.end).not.toHaveBeenCalled();
  });

  it("preserves database-construction failure before migration", async () => {
    const error = new Error("Synthetic database-construction failure.");
    runtime.createDatabase.mockImplementationOnce(() => {
      throw error;
    });
    await expect(run(["--test"])).rejects.toBe(error);
    expect(runtime.migrate).not.toHaveBeenCalled();
    expect(runtime.query).not.toHaveBeenCalled();
    expect(runtime.end).not.toHaveBeenCalled();
  });

  it("preserves the empty direct-URL fallback without using inherited credentials", async () => {
    vi.mocked(process.loadEnvFile).mockImplementationOnce(() => {});
    await run([]);
    expect(runtime.createDatabase).toHaveBeenCalledExactlyOnceWith("", false);
  });
});
