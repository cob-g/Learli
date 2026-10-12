// Test-only loopback adapter. The staging CLI/factory never accepts this target.
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  loadCandidate,
  digest,
  type Candidate,
} from "../../scripts/staging-migrations/journal";
import {
  applyPlan,
  inspectTarget,
  planHash,
  type Connection,
  type Identity,
  type Plan,
} from "../../scripts/staging-migrations/runner";
import {
  probeRuntime,
  verifyRuntimeGrants,
  migrationPrerequisites,
} from "../../scripts/staging-migrations/privileges";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";

const portText = process.env.LEARLI_STAGING_TEST_PORT ?? "55702";
const port = Number(portText);
if (
  !/^\d+$/.test(portText) ||
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535
)
  throw new Error("Invalid owned staging test port");
const directory = path.join(
  process.cwd(),
  ".local/staging-database-wave",
  `pg-${randomUUID()}`,
);
const data = path.join(directory, "data");
const password = randomBytes(32).toString("hex");
let control: Pool,
  candidate: Candidate,
  started = false,
  startupAttempted = false;
const tool = (name: string) =>
  process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name;
function run(name: string, args: string[]) {
  const result = spawnSync(tool(name), args, {
    encoding: "utf8",
    timeout: 30000,
  });
  writeFileSync(
    path.join(directory, `${name}-${randomUUID()}.log`),
    (result.stdout ?? "") + (result.stderr ?? ""),
    { mode: 0o600 },
  );
  if (result.status !== 0)
    throw new Error(
      "Owned staging migration test tool failed; private evidence retained",
    );
}
function connect(database: string, user: string): Pool {
  const pool = new Pool({
    host: "127.0.0.1",
    port,
    database,
    user,
    password,
    max: 2,
    connectionTimeoutMillis: 3000,
  });
  pool.on("error", () => {});
  return pool;
}
class LocalConnection implements Connection {
  closed = false;
  constructor(
    readonly pool: Pool,
    readonly inject?: (client: PoolClient) => void,
  ) {}
  async withClient<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      this.inject?.(client);
      return await callback(client);
    } finally {
      client.release(true);
    }
  }
  async close() {
    if (!this.closed) {
      this.closed = true;
      await this.pool.end();
    }
  }
}
async function world(prefix = "fresh") {
  const database = `staging_${prefix}_${randomUUID().replaceAll("-", "")}`;
  await control.query(`CREATE DATABASE ${database} OWNER learli_migrator`);
  await control.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
  await control.query(`GRANT CONNECT ON DATABASE ${database} TO learli_app`);
  const owner = new LocalConnection(connect(database, "learli_migrator"));
  const runtime = new LocalConnection(connect(database, "learli_app"));
  const identity: Identity = {
    database,
    migrationRole: "learli_migrator",
    targetHash: digest(database),
  };
  return { owner, runtime, identity, database };
}
function recovery(plan: Plan) {
  return {
    version: 1,
    targetHash: plan.targetHash,
    planHash: planHash(plan),
    restorePointReference: "owned-synthetic-preserved-cluster",
    verifiedRecoveryReference: "local-recovery-proof-only",
    operatorApproval: "test-only-attestation",
  };
}
async function originalRows(
  connection: Connection,
  shape?: Record<string, string[]>,
) {
  return connection.withClient(async (client) => {
    const columns =
      shape ??
      Object.fromEntries(
        (
          await client.query<{ table: string; columns: string[] }>(`
      SELECT c.relname AS "table",array_agg(a.attname::text ORDER BY a.attnum) AS columns
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped GROUP BY c.relname ORDER BY c.relname`)
        ).rows.map((row) => [row.table, row.columns]),
      );
    const hashes: Record<string, string> = {};
    for (const [table, names] of Object.entries(columns)) {
      if (!/^[a-z_]+$/.test(table) || names.some((name) => !/^\w+$/.test(name)))
        throw new Error("Invalid owned fixture shape");
      const rows = await client.query(
        `SELECT to_jsonb(original) AS row FROM (SELECT ${names.map((name) => `"${name}"`).join(",")} FROM public."${table}") original ORDER BY to_jsonb(original)::text`,
      );
      hashes[table] = digest(JSON.stringify(rows.rows));
    }
    return { shape: columns, hashes };
  });
}
const apply = (
  w: Awaited<ReturnType<typeof world>>,
  plan: Plan,
  extra: Partial<Parameters<typeof applyPlan>[0]> = {},
) =>
  applyPlan({
    ...w,
    candidate,
    plan,
    expectedPlanHash: planHash(plan),
    recovery: recovery(plan),
    recheckCandidate: () => candidate,
    ...extra,
  });
beforeAll(async () => {
  if (process.env.APP_ENV !== "test")
    throw new Error("Isolated test environment required");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(port, "127.0.0.1", resolve);
  });
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  writeFileSync(path.join(directory, "password"), password, { mode: 0o600 });
  run("initdb", [
    "-D",
    data,
    "-U",
    "learli_test_owner",
    "--auth=scram-sha-256",
    "--pwfile",
    path.join(directory, "password"),
    "--encoding=UTF8",
    "--locale=C",
  ]);
  startupAttempted = true;
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(directory, "server.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -c unix_socket_directories='' -c timezone=UTC`,
    "-w",
    "start",
  ]);
  started = true;
  control = connect("postgres", "learli_test_owner");
  await control.query(
    `CREATE ROLE learli_migrator LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  await control.query(
    `CREATE ROLE learli_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  candidate = loadCandidate(process.cwd());
}, 60000);
afterAll(async () => {
  await control?.end();
  const status = startupAttempted
    ? spawnSync(tool("pg_ctl"), ["-D", data, "status"], { encoding: "utf8" })
    : undefined;
  if (started || status?.status === 0)
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
}, 30000);
describe("real PostgreSQL controlled staging migration primitives", () => {
  it("applies the reviewed fresh chain, restricted grants/probes and a no-op migration rerun", async () => {
    const w = await world(),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    expect(plan.state).toBe("empty");
    expect(plan.pending).toHaveLength(22);
    const result = await apply(w, plan);
    expect(result.status, `${result.category}/${result.stage}`).toBe("PASS");
    expect(result.migrations).toBe("committed");
    expect(result.runtime).toBe("pass");
    expect(w.owner.closed && w.runtime.closed).toBe(true);
    const rerun = {
      ...w,
      owner: new LocalConnection(connect(w.database, "learli_migrator")),
      runtime: new LocalConnection(connect(w.database, "learli_app")),
    };
    const next = await inspectTarget(rerun.owner, candidate, w.identity);
    expect(next.pending).toHaveLength(0);
    const second = await apply(rerun, next, { recovery: undefined });
    expect(second.status).toBe("PASS");
    expect(second.migrations).toBe("unchanged");
  });
  it("upgrades populated0015 and preserves synthetic original rows with explicit recovery binding", async () => {
    const w = await world("upgrade");
    await w.owner.withClient(async (client) => {
      await new PgDialect().migrate(
        candidate.entries.slice(0, 16).map((entry) => ({
          sql: [...entry.statements],
          bps: true,
          folderMillis: entry.when,
          hash: entry.hash,
        })),
        drizzle(client, { schema: {} })._.session,
        { migrationsFolder: "drizzle" },
      );
      await client.query(
        'INSERT INTO public."user" (id,name,email) VALUES ($1,$2,$3)',
        ["owned-upgrade-fixture", "Synthetic upgrade", "upgrade@learli.test"],
      );
      await client.query(
        "INSERT INTO public.subjects(slug,name,category) VALUES('owned-specialized','Synthetic specialized','specialized')",
      );
    });
    const before = await originalRows(w.owner);
    const plan = await inspectTarget(w.owner, candidate, w.identity);
    expect(plan.state).toBe("populated");
    expect(plan.pending).toHaveLength(candidate.entries.length - 16);
    const denied = await apply(w, plan, { recovery: undefined });
    expect(denied.category).toBe("recovery_required");
    const upgraded = {
      ...w,
      owner: new LocalConnection(connect(w.database, "learli_migrator")),
      runtime: new LocalConnection(connect(w.database, "learli_app")),
    };
    expect((await apply(upgraded, plan)).status).toBe("PASS");
    const check = new LocalConnection(connect(w.database, "learli_migrator"));
    try {
      expect((await originalRows(check, before.shape)).hashes).toEqual(
        before.hashes,
      );
      expect(Object.keys(before.hashes)).toHaveLength(32);
    } finally {
      await check.close();
    }
  });
  it.each(["target", "candidate", "digest", "history"])(
    "refuses apply drift %s and closes both pools",
    async (mode) => {
      const w = await world(mode),
        plan = await inspectTarget(w.owner, candidate, w.identity);
      const extra: Partial<Parameters<typeof applyPlan>[0]> = {};
      if (mode === "target")
        extra.identity = {
          ...w.identity,
          targetHash: digest("changed-target"),
        };
      if (mode === "candidate")
        extra.recheckCandidate = () => ({
          ...candidate,
          hash: digest("changed-candidate"),
        });
      if (mode === "digest") extra.expectedPlanHash = digest("wrong-plan");
      if (mode === "history")
        await w.owner.withClient((client) =>
          client
            .query("CREATE TABLE public.unrecognized(id integer)")
            .then(() => {}),
        );
      const result = await apply(w, plan, extra);
      expect(result.status).toBe("FAIL");
      expect(result.migrations).toBe("not_started");
      expect(w.owner.closed && w.runtime.closed).toBe(true);
    },
  );
  it("refuses concurrent runners without losing the session lock or data", async () => {
    const w = await world("lock"),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    const holder = connect(w.database, "learli_migrator"),
      client = await holder.connect();
    try {
      await client.query("SELECT pg_advisory_lock(1835344,804)");
      expect((await apply(w, plan)).category).toBe("runner_busy");
    } finally {
      await client.query("SELECT pg_advisory_unlock(1835344,804)");
      client.release(true);
      await holder.end();
    }
    const retry = {
      ...w,
      owner: new LocalConnection(connect(w.database, "learli_migrator")),
      runtime: new LocalConnection(connect(w.database, "learli_app")),
    };
    expect((await apply(retry, plan)).status).toBe("PASS");
  });
  it("rejects divergent recorded history before migration", async () => {
    const w = await world("diverge"),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    expect((await apply(w, plan)).status).toBe("PASS");
    const owner = new LocalConnection(connect(w.database, "learli_migrator"));
    try {
      await owner.withClient((client) =>
        client
          .query("UPDATE drizzle.__drizzle_migrations SET hash=$1 WHERE id=1", [
            digest("divergent"),
          ])
          .then(() => {}),
      );
      await expect(inspectTarget(owner, candidate, w.identity)).rejects.toThrow(
        "history_divergent",
      );
    } finally {
      await owner.close();
    }
  });
  it("a second actual runner refuses while first migrates and refreshes grants", async () => {
    const w = await world("runners"),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    await w.owner.close();
    let enter: () => void = () => {},
      release: () => void = () => {};
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const owner = new LocalConnection(
      connect(w.database, "learli_migrator"),
      (client) => {
        const original = client.query.bind(client);
        client.query = ((...args: Parameters<PoolClient["query"]>) => {
          if (args[0] === runtimeGrantsSql) {
            enter();
            return gate.then(() => original(runtimeGrantsSql));
          }
          return original(...args);
        }) as PoolClient["query"];
      },
    );
    const first = apply({ ...w, owner }, plan);
    try {
      await Promise.race([
        entered,
        first.then(() => {
          throw new Error("First runner failed before grant checkpoint");
        }),
      ]);
      const second = {
        ...w,
        owner: new LocalConnection(connect(w.database, "learli_migrator")),
        runtime: new LocalConnection(connect(w.database, "learli_app")),
      };
      expect((await apply(second, plan)).category).toBe("runner_busy");
    } finally {
      release();
    }
    expect((await first).status).toBe("PASS");
  });
  it("reports transaction migration failure honestly and releases the actual lock", async () => {
    const w = await world("failure");
    const broken: Candidate = {
      ...candidate,
      hash: digest("broken-test-candidate"),
      entries: candidate.entries.map((entry, index) =>
        index === 16 ? { ...entry, statements: ["SELECT 1/0"] } : entry,
      ),
    };
    const plan = await inspectTarget(w.owner, broken, w.identity);
    const result = await apply(w, plan, {
      candidate: broken,
      recheckCandidate: () => broken,
    });
    expect(result.status).toBe("FAIL");
    expect(result.stage).toBe("migrate");
    expect(result.migrations).toBe("unknown");
    const owner = new LocalConnection(connect(w.database, "learli_migrator"));
    try {
      await owner.withClient(async (client) => {
        expect(
          (
            await client.query(
              "SELECT count(*) AS count FROM drizzle.__drizzle_migrations",
            )
          ).rows[0].count,
        ).toBe("0");
        expect(
          (
            await client.query(
              "SELECT pg_try_advisory_lock(1835344,804) AS locked",
            )
          ).rows[0].locked,
        ).toBe(true);
      });
    } finally {
      await owner.close();
    }
  });
  it("rolls failed grants back after committed migrations; rejects surplus effective rights", async () => {
    const w = await world("grants"),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    const owner = new LocalConnection(
      connect(w.database, "learli_migrator"),
      (client) => {
        const original = client.query.bind(client);
        client.query = ((...args: Parameters<PoolClient["query"]>) => {
          if (args[0] === runtimeGrantsSql)
            args[0] = runtimeGrantsSql + "; SELECT 1/0";
          return original(...args);
        }) as PoolClient["query"];
      },
    );
    await w.owner.close();
    const result = await apply({ ...w, owner }, plan);
    expect(result.status).toBe("FAIL");
    expect(result.migrations).toBe("committed");
    expect(result.grants).toBe("rolled_back");
    const check = new LocalConnection(connect(w.database, "learli_migrator"));
    try {
      await check.withClient(async (client) => {
        await client.query(runtimeGrantsSql);
        expect((await verifyRuntimeGrants(client)).functionChecks).toBe(24);
        await client.query("GRANT UPDATE ON user_roles TO learli_app");
        await expect(verifyRuntimeGrants(client)).rejects.toThrow(
          "grant_mismatch",
        );
      });
    } finally {
      await check.close();
    }
  });
  it.each([
    "disabled-trigger",
    "conditional-trigger",
    "weakened-state",
    "changed-function",
    "missing-overlap",
    "wrong-lifecycle-deferral",
    "missing-logical-uniqueness",
    "weakened-logical-revision",
  ])("rejects already-migrated protection drift %s", async (mode) => {
    const w = await world("drift"),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    expect((await apply(w, plan)).status).toBe("PASS");
    const owner = new LocalConnection(connect(w.database, "learli_migrator"));
    try {
      await owner.withClient(async (client) => {
        if (mode === "disabled-trigger")
          await client.query(
            "ALTER TABLE public.bookings DISABLE TRIGGER preserve_demo_booking",
          );
        if (mode === "conditional-trigger") {
          await client.query(
            "DROP TRIGGER preserve_demo_booking ON public.bookings",
          );
          await client.query(
            "CREATE TRIGGER preserve_demo_booking BEFORE UPDATE ON public.bookings FOR EACH ROW WHEN (false) EXECUTE FUNCTION public.preserve_demo_booking()",
          );
        }
        if (mode === "weakened-state") {
          await client.query(
            "ALTER TABLE public.bookings DROP CONSTRAINT bookings_demo_state",
          );
          await client.query(
            "ALTER TABLE public.bookings ADD CONSTRAINT bookings_demo_state CHECK (true)",
          );
        }
        if (mode === "changed-function")
          await client.query(
            "CREATE OR REPLACE FUNCTION public.preserve_demo_booking() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$",
          );
        if (mode === "missing-overlap")
          await client.query(
            "ALTER TABLE public.bookings DROP CONSTRAINT bookings_tutor_no_overlap",
          );
        if (mode === "wrong-lifecycle-deferral") {
          await client.query(
            "DROP TRIGGER require_booking_lifecycle_event ON public.bookings",
          );
          await client.query(
            "CREATE CONSTRAINT TRIGGER require_booking_lifecycle_event AFTER UPDATE ON public.bookings DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION public.require_booking_lifecycle_event()",
          );
        }
        if (mode === "missing-logical-uniqueness")
          await client.query("DROP INDEX public.bookings_logical_live_unique");
        if (mode === "weakened-logical-revision") {
          await client.query(
            "ALTER TABLE public.bookings DROP CONSTRAINT bookings_revision_valid",
          );
          await client.query(
            "ALTER TABLE public.bookings ADD CONSTRAINT bookings_revision_valid CHECK ((revision>=0 AND revision=0 AND replaces_booking_id IS NULL AND logical_booking_id=id) OR revision>0 AND replaces_booking_id IS NOT NULL OR logical_booking_id<>id)",
          );
        }
      });
      await expect(inspectTarget(owner, candidate, w.identity)).rejects.toThrow(
        "protection_mismatch",
      );
    } finally {
      await owner.close();
    }
  });
  it("refuses inherited runtime migration-role membership without broadening it", async () => {
    const w = await world("membership");
    try {
      await control.query("GRANT learli_migrator TO learli_app");
      await expect(
        inspectTarget(w.owner, candidate, w.identity),
      ).rejects.toThrow("runtime_role_invalid");
    } finally {
      await control.query("REVOKE learli_migrator FROM learli_app");
      await w.owner.close();
      await w.runtime.close();
    }
  });
  it("requires the exact runtime role to exist before migration", async () => {
    const w = await world("missing_role");
    try {
      await control.query(
        "ALTER ROLE learli_app RENAME TO absent_runtime_role",
      );
      await expect(
        inspectTarget(w.owner, candidate, w.identity),
      ).rejects.toThrow("runtime_role_invalid");
    } finally {
      await control.query(
        "ALTER ROLE absent_runtime_role RENAME TO learli_app",
      );
      await w.owner.close();
      await w.runtime.close();
    }
  });
  it.each([
    {
      grantee: "learli_app",
      privilege: "SET",
      parameter: "session_replication_role",
    },
    {
      grantee: "PUBLIC",
      privilege: "SET",
      parameter: "session_replication_role",
    },
    { grantee: "learli_app", privilege: "ALTER SYSTEM", parameter: "work_mem" },
    { grantee: "PUBLIC", privilege: "ALTER SYSTEM", parameter: "work_mem" },
  ])(
    "rejects parameter ACL $privilege via $grantee before migration/audit/probes",
    async ({ grantee, privilege, parameter }) => {
      const w = await world("parameter"),
        initial = await inspectTarget(w.owner, candidate, w.identity);
      expect((await apply(w, initial)).status).toBe("PASS");
      const owner = new LocalConnection(connect(w.database, "learli_migrator")),
        runtime = new LocalConnection(connect(w.database, "learli_app"));
      const plan = await inspectTarget(owner, candidate, w.identity);
      await control.query(
        `GRANT ${privilege} ON PARAMETER ${parameter} TO ${grantee}`,
      );
      try {
        await expect(owner.withClient(migrationPrerequisites)).rejects.toThrow(
          "runtime_role_invalid",
        );
        await expect(owner.withClient(verifyRuntimeGrants)).rejects.toThrow(
          "grant_mismatch",
        );
        await expect(runtime.withClient(probeRuntime)).rejects.toThrow(
          "runtime_probe_failed",
        );
        const result = await apply({ ...w, owner, runtime }, plan);
        expect(result.status).toBe("FAIL");
        expect(result.category).toBe("runtime_role_invalid");
        expect(result.migrations).toBe("not_started");
        expect(result.runtime).toBe("not_run");
      } finally {
        await control.query(
          `REVOKE ${privilege} ON PARAMETER ${parameter} FROM ${grantee}`,
        );
        await owner.close();
        await runtime.close();
      }
    },
  );
  it.each(["role", "database", "migration-role"])(
    "rejects non-origin %s defaults before inspection/probes",
    async (mode) => {
      const w = await world("replica"),
        initial = await inspectTarget(w.owner, candidate, w.identity);
      expect((await apply(w, initial)).status).toBe("PASS");
      const target =
        mode === "database"
          ? `DATABASE ${w.database}`
          : mode === "role"
            ? "ROLE learli_app"
            : "ROLE learli_migrator";
      await control.query(
        `ALTER ${target} SET session_replication_role=replica`,
      );
      const owner = new LocalConnection(connect(w.database, "learli_migrator")),
        runtime = new LocalConnection(connect(w.database, "learli_app"));
      try {
        if (mode !== "migration-role")
          await expect(runtime.withClient(probeRuntime)).rejects.toThrow(
            "runtime_probe_failed",
          );
        if (mode !== "role") {
          await expect(
            inspectTarget(owner, candidate, w.identity),
          ).rejects.toThrow("migration_prerequisite");
          await expect(owner.withClient(verifyRuntimeGrants)).rejects.toThrow(
            "grant_mismatch",
          );
        }
      } finally {
        await control.query(`ALTER ${target} RESET session_replication_role`);
        await owner.close();
        await runtime.close();
      }
    },
  );
  it.each([
    {
      kind: "function",
      object: "FUNCTION public.grant_tutor_role(text)",
      privilege: "EXECUTE",
      survives: true,
    },
    {
      kind: "schema",
      object: "SCHEMA public",
      privilege: "USAGE",
      survives: true,
    },
    {
      kind: "table",
      object: "public.subjects",
      privilege: "SELECT",
      survives: false,
    },
    {
      kind: "column",
      object: "public.bookings",
      privilege: "UPDATE (state)",
      survives: false,
    },
    {
      kind: "table-delete",
      object: "public.session",
      privilege: "DELETE",
      survives: false,
    },
    {
      kind: "database-connect",
      object: "DATABASE",
      privilege: "CONNECT",
      survives: true,
    },
    {
      kind: "database-temp",
      object: "DATABASE",
      privilege: "TEMPORARY",
      survives: true,
    },
  ])(
    "rejects surplus $kind grant options without widening the grant policy",
    async ({ object, privilege, survives }) => {
      const w = await world("delegation"),
        initial = await inspectTarget(w.owner, candidate, w.identity);
      expect((await apply(w, initial)).status).toBe("PASS");
      const owner = new LocalConnection(connect(w.database, "learli_migrator"));
      const target = object === "DATABASE" ? `DATABASE ${w.database}` : object;
      try {
        await owner.withClient(async (client) => {
          await client.query(
            `GRANT ${privilege} ON ${target} TO learli_app WITH GRANT OPTION`,
          );
          await expect(verifyRuntimeGrants(client)).rejects.toThrow(
            "grant_mismatch",
          );
        });
        if (survives) {
          const plan = await inspectTarget(owner, candidate, w.identity);
          const result = await apply(
            {
              ...w,
              owner: new LocalConnection(
                connect(w.database, "learli_migrator"),
              ),
              runtime: new LocalConnection(connect(w.database, "learli_app")),
            },
            plan,
          );
          expect(result.status).toBe("FAIL");
          expect(result.category).toBe("grant_mismatch");
          expect(result.grants).toBe("rolled_back");
          expect(result.runtime).toBe("not_run");
        }
        await owner.withClient(async (client) => {
          await client.query(
            `REVOKE GRANT OPTION FOR ${privilege} ON ${target} FROM learli_app`,
          );
          expect((await verifyRuntimeGrants(client)).functionChecks).toBe(24);
        });
      } finally {
        await owner.close();
      }
    },
  );
  it("runtime probes reject owner credentials and actually use restricted role", async () => {
    const w = await world("probe"),
      plan = await inspectTarget(w.owner, candidate, w.identity);
    expect((await apply(w, plan)).status).toBe("PASS");
    const owner = new LocalConnection(connect(w.database, "learli_migrator")),
      runtime = new LocalConnection(connect(w.database, "learli_app"));
    try {
      await expect(owner.withClient(probeRuntime)).rejects.toThrow(
        "runtime_probe_failed",
      );
      const result = await runtime.withClient(probeRuntime);
      expect(result.denials).toBe(6);
      expect(result.integrityChecks).toBe(3);
    } finally {
      await owner.close();
      await runtime.close();
    }
  });
  it.each(["commit-response", "unlock", "unlock-error", "close"])(
    "retains partial outcome and cleanup failure %s",
    async (mode) => {
      const w = await world("partial"),
        plan = await inspectTarget(w.owner, candidate, w.identity);
      await w.owner.close();
      const owner = new LocalConnection(
        connect(w.database, "learli_migrator"),
        (client) => {
          const original = client.query.bind(client);
          let grantsStarted = false;
          client.query = ((...args: Parameters<PoolClient["query"]>) => {
            if (args[0] === runtimeGrantsSql) grantsStarted = true;
            if (
              mode === "commit-response" &&
              grantsStarted &&
              args[0] === "COMMIT"
            )
              return original("COMMIT").then(() => {
                throw new Error("Synthetic lost COMMIT response");
              });
            if (
              mode === "unlock-error" &&
              typeof args[0] === "string" &&
              args[0].includes("pg_advisory_unlock")
            )
              return Promise.reject(
                new Error("Synthetic unlock transport failure"),
              );
            if (
              mode === "unlock" &&
              typeof args[0] === "string" &&
              args[0].includes("pg_advisory_unlock")
            )
              return Promise.resolve({
                rows: [{ unlocked: false }],
                rowCount: 1,
              });
            return original(...args);
          }) as PoolClient["query"];
        },
      );
      if (mode === "close") {
        const close = owner.close.bind(owner);
        owner.close = async () => {
          await close();
          throw new Error("Synthetic close failure");
        };
      }
      const result = await apply({ ...w, owner }, plan);
      expect(result.status).toBe("FAIL");
      expect(result.migrations).toBe("committed");
      if (mode === "commit-response") expect(result.grants).toBe("unknown");
      else expect(result.cleanup).toBe("failed");
      expect(owner.closed && w.runtime.closed).toBe(true);
      const check = new LocalConnection(connect(w.database, "learli_migrator"));
      try {
        expect(
          await check.withClient(
            async (client) =>
              (
                await client.query(
                  "SELECT pg_try_advisory_lock(1835344,804) AS locked",
                )
              ).rows[0].locked,
          ),
        ).toBe(true);
      } finally {
        await check.close();
      }
    },
  );
});
