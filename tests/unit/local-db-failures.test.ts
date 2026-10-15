import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/local-db.mjs", import.meta.url),
);
const pgModule = fileURLToPath(
  new URL("../../node_modules/pg/lib/index.js", import.meta.url),
);
const privateMarker = "PRIVATE_LOCAL_DB_FIXTURE";
const failureMessage =
  "Local database setup could not complete. Check PostgreSQL 17 tools, the configured local port, and private .local/postgres/server.log. Existing data was not reset.\n";
type Action = "status" | "stop" | "start";
type Failure = "missing" | "non-executable" | "signal" | 1 | 4 | 7;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(status: Failure | 0 | 3, stop: Failure | 0 | 3 = 0) {
  const cwd = realpathSync(
    mkdtempSync(path.join(tmpdir(), "learli-local-db-failures-")),
  );
  directories.push(cwd);
  const postgres = path.join(cwd, ".local/postgres");
  const bin = path.join(cwd, "bin");
  const calls = path.join(cwd, "calls.jsonl");
  const connections = path.join(cwd, "connections.jsonl");
  mkdirSync(path.join(postgres, "data"), { recursive: true });
  mkdirSync(bin);
  writeFileSync(
    path.join(postgres, "learli-owned"),
    "Synthetic owned fixture\n",
  );
  writeFileSync(path.join(postgres, "data/PG_VERSION"), "17\n");
  const state = JSON.stringify({
    ports: { database: 55432, development: 3000, test: 3100 },
    ownerPassword: privateMarker,
    appPassword: privateMarker,
  });
  const statePath = path.join(cwd, ".local/database.json");
  writeFileSync(statePath, state);
  for (const name of [".env.local", ".env.test.local"])
    writeFileSync(path.join(cwd, name), privateMarker);

  // The subprocess imports the real CLI, but every SQL attempt is intercepted.
  // Even a regression in start must never connect to an actual cluster.
  const preload = path.join(cwd, "preload.mjs");
  writeFileSync(
    preload,
    `import { createRequire } from "node:module";
import { appendFileSync } from "node:fs";
const pg = createRequire(import.meta.url)(${JSON.stringify(pgModule)});
pg.Pool = class {
  constructor() { appendFileSync(${JSON.stringify(connections)}, "pool\\n"); }
  async query() {
    appendFileSync(${JSON.stringify(connections)}, "query\\n");
    return { rowCount: 1 };
  }
  async end() { appendFileSync(${JSON.stringify(connections)}, "end\\n"); }
};
`,
  );
  const executable = path.join(bin, "pg_ctl");
  if (status !== "missing") {
    writeFileSync(
      executable,
      `#!${process.execPath}
import { appendFileSync, chmodSync, unlinkSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + "\\n");
process.stdout.write(${JSON.stringify(privateMarker)});
process.stderr.write(${JSON.stringify(privateMarker)});
const isStatus = args.includes("status");
const behavior = isStatus ? ${JSON.stringify(status)} : ${JSON.stringify(stop)};
if (isStatus && ${JSON.stringify(stop)} === "missing") unlinkSync(process.argv[1]);
if (isStatus && ${JSON.stringify(stop)} === "non-executable") chmodSync(process.argv[1], 0o600);
if (behavior === "signal") process.kill(process.pid, "SIGTERM");
else process.exit(typeof behavior === "number" ? behavior : 99);
`,
      { mode: status === "non-executable" ? 0o600 : 0o700 },
    );
    // Explicit chmod also makes the EACCES fixture independent of umask.
    chmodSync(executable, status === "non-executable" ? 0o600 : 0o700);
  }

  return {
    cwd,
    postgres,
    run(action: Action) {
      const result = spawnSync(
        process.execPath,
        ["--import", preload, script, action],
        {
          cwd,
          // Do not inherit credentials, PG options, NODE_OPTIONS or env files.
          env: { PG_BIN: bin, NODE_ENV: "test" },
          encoding: "utf8",
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.stdout + result.stderr).not.toContain(privateMarker);
      expect(readFileSync(statePath, "utf8")).toBe(state);
      expect(readFileSync(path.join(postgres, "data/PG_VERSION"), "utf8")).toBe(
        "17\n",
      );
      for (const name of [".env.local", ".env.test.local"])
        expect(readFileSync(path.join(cwd, name), "utf8")).toBe(privateMarker);
      return result;
    },
    calls() {
      return existsSync(calls)
        ? readFileSync(calls, "utf8")
            .trim()
            .split("\n")
            .map((line): unknown => JSON.parse(line))
        : [];
    },
    connections() {
      return existsSync(connections) ? readFileSync(connections, "utf8") : "";
    },
  };
}

function expectFailure(result: ReturnType<ReturnType<typeof fixture>["run"]>) {
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(failureMessage);
}

describe("local database CLI failure truthfulness", () => {
  for (const action of ["status", "stop", "start"] as const) {
    it.each<Failure>(["missing", "non-executable", "signal", 1, 4, 7])(
      `${action} rejects unrecognized status %s without follow-up operations`,
      (failure) => {
        const cluster = fixture(failure);
        expectFailure(cluster.run(action));
        expect(cluster.calls()).toEqual(
          failure === "missing" || failure === "non-executable"
            ? []
            : [["-D", path.join(cluster.postgres, "data"), "status"]],
        );
        expect(cluster.connections()).toBe("");
      },
    );
  }

  it.each([0, 3] as const)(
    "reports recognized status %s without SQL or mutations",
    (status) => {
      const cluster = fixture(status);
      const result = cluster.run("status");
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(
        status === 0
          ? "Local PostgreSQL is running.\n"
          : "Local PostgreSQL is stopped.\n",
      );
      expect(result.stderr).toBe("");
      expect(cluster.calls()).toEqual([
        ["-D", path.join(cluster.postgres, "data"), "status"],
      ]);
      expect(cluster.connections()).toBe("");
    },
  );

  it.each([0, 3] as const)(
    "stops safely after recognized status %s",
    (status) => {
      const cluster = fixture(status);
      const result = cluster.run("stop");
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("Local PostgreSQL stopped; data preserved.\n");
      expect(result.stderr).toBe("");
      const data = path.join(cluster.postgres, "data");
      expect(cluster.calls()).toEqual([
        ["-D", data, "status"],
        ...(status === 0 ? [["-D", data, "stop", "-m", "fast"]] : []),
      ]);
      expect(cluster.connections()).toBe("");
    },
  );

  it.each<Failure | 3>(["missing", "non-executable", "signal", 1, 3, 4, 7])(
    "does not claim success after failed stop %s",
    (failure) => {
      const cluster = fixture(0, failure);
      expectFailure(cluster.run("stop"));
      const data = path.join(cluster.postgres, "data");
      expect(cluster.calls()).toEqual([
        ["-D", data, "status"],
        ...(failure === "missing" || failure === "non-executable"
          ? []
          : [["-D", data, "stop", "-m", "fast"]]),
      ]);
      expect(cluster.connections()).toBe("");
    },
  );

  it.each([0, 3] as const)(
    "preserves start behavior for recognized status %s",
    (status) => {
      const cluster = fixture(status);
      const result = cluster.run("start");
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(
        "Local PostgreSQL ready on 127.0.0.1:55432. Development/test databases are separate. Existing environment files preserved.\n",
      );
      expect(result.stderr).toBe("");
      const data = path.join(cluster.postgres, "data");
      expect(cluster.calls()).toEqual([
        ["-D", data, "status"],
        ...(status === 3
          ? [
              [
                "-D",
                data,
                "-l",
                path.join(cluster.postgres, "server.log"),
                "-o",
                `-c timezone=UTC -c log_timezone=UTC -h 127.0.0.1 -p 55432 -k '${path.join(cluster.postgres, "socket")}'`,
                "-w",
                "start",
              ],
            ]
          : []),
      ]);
      expect(cluster.connections()).toBe(
        "pool\n" + "query\n".repeat(7) + "end\n",
      );
    },
  );

  it.each(["status", "stop", "start"] as const)(
    "preserves owned-cluster guard for %s",
    (action) => {
      const cluster = fixture(0);
      rmSync(path.join(cluster.postgres, "learli-owned"));
      expectFailure(cluster.run(action));
      expect(cluster.calls()).toEqual([]);
      expect(cluster.connections()).toBe("");
    },
  );
});
