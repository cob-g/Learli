import { inspect } from "node:util";
import { createServer, type Socket } from "node:net";
import { sql } from "drizzle-orm";
import { Pool, type PoolConfig } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  stagingDatabaseConfig,
  type StagingDatabaseConfig,
} from "@/lib/db/staging-config";
import {
  createHostedRuntimeDatabase,
  type HostedRuntimeClient,
  type HostedRuntimePool,
} from "@/lib/db/hosted-runtime";
import {
  createStagingTlsHarness,
  type StagingTlsHarness,
} from "../support/staging-tls";

// Test-only module substitution, identical boundary to existing staging TLS
// tests. Production factory has no alternate target, CA or pool injection.
const injected = vi.hoisted(() => ({
  settings: undefined as
    ((config: StagingDatabaseConfig) => PoolConfig) | undefined,
}));
vi.mock("@/lib/db/staging-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/staging-config")>();
  return {
    ...actual,
    stagingPoolConfig: (config: StagingDatabaseConfig) => {
      actual.stagingPoolConfig(config);
      if (!injected.settings) throw new Error("W2 fixture not initialized.");
      return injected.settings(config);
    },
  };
});
function config() {
  return stagingDatabaseConfig({
    appEnv: "staging",
    purpose: "runtime",
    url: "postgresql://learli_app:w2-synthetic-placeholder@ep-fictional-123.us-east-2.aws.neon.tech/learli_staging?sslmode=verify-full",
    target: {
      version: 1,
      provider: "neon",
      environment: "staging",
      projectId: "fictional-project-123",
      branchId: "br-fictional-123",
      endpointId: "ep-fictional-123",
      hostname: "ep-fictional-123.us-east-2.aws.neon.tech",
      database: "learli_staging",
      runtimeRole: "learli_app",
      migrationRole: "learli_migrator",
      approvedPurposes: ["runtime"],
      operatorApproval: {
        approvalId: "fictional-record-123",
        approvedBy: "fictional-operator",
        approvedAt: "2026-10-12T00:00:00Z",
        providerVerifiedAt: "2026-10-12T00:00:00Z",
        isolation: "dedicated-synthetic-staging",
      },
    },
  });
}
let harness: StagingTlsHarness;
type Runtime = Awaited<ReturnType<typeof createHostedRuntimeDatabase>>;
const runtimes: Runtime[] = [];
const leases: HostedRuntimeClient[] = [];
async function open() {
  const runtime = await createHostedRuntimeDatabase(config());
  runtimes.push(runtime);
  await expect.poll(() => runtime.pool.idleCount).toBe(1);
  return runtime;
}
async function borrow(pool: HostedRuntimePool) {
  const client = await pool.connect();
  leases.push(client);
  return client;
}
async function pid(client: HostedRuntimeClient | HostedRuntimePool) {
  return (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"))
    .rows[0].pid;
}
async function targetSql(text: string) {
  const pool = new Pool({
    ...harness.settings("tls_admin"),
    database: "learli_staging",
  });
  try {
    return await pool.query(text);
  } finally {
    await pool.end();
  }
}
function expectSafe(error: unknown, code?: string) {
  expect(error).toBeInstanceOf(Error);
  if (code) expect(error).toMatchObject({ code });
  expect(error).not.toHaveProperty("cause");
  expect(inspect(error, { showHidden: true })).not.toMatch(
    /w2-synthetic-placeholder|postgresql:|127\.0\.0\.1|certificate|password|learli_staging/,
  );
}
beforeAll(async () => {
  harness = await createStagingTlsHarness();
  injected.settings = () => harness.settings("learli_app");
  await targetSql(
    "CREATE TABLE public.w2_runtime_probe(id integer PRIMARY KEY, value integer NOT NULL); " +
      "ALTER TABLE public.w2_runtime_probe OWNER TO learli_migrator; " +
      "GRANT SELECT, INSERT, UPDATE ON public.w2_runtime_probe TO learli_app; " +
      "INSERT INTO public.w2_runtime_probe VALUES(1,0)",
  );
}, 60_000);
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const lease of leases.splice(0)) {
    try {
      lease.release(true);
    } catch {
      /* Already released by the test. */
    }
  }
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
  injected.settings = () => harness.settings("learli_app");
  await expect.poll(() => harness.activeConnections()).toBe(0);
  await targetSql(
    "DELETE FROM public.w2_runtime_probe WHERE id<>1; UPDATE public.w2_runtime_probe SET value=0 WHERE id=1",
  );
});
afterAll(() => harness?.stop());

describe("W2 actual TLS PostgreSQL pooled application runtime", () => {
  it("reuses a fully reset connection for consecutive pool queries without opening another", async () => {
    const { pool } = await open();
    const firstPid = await pid(pool);
    await pool.query("SET application_name='temporary-performance-probe'");
    const state = await pool.query<{ pid: number; name: string }>(
      "SELECT pg_backend_pid() AS pid, current_setting('application_name') AS name",
    );
    expect(state.rows[0].pid).toBe(firstPid);
    expect(state.rows[0].name).not.toBe("temporary-performance-probe");
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
  });
  it("verifies TLS/identity and reuses a checked-out native session", async () => {
    const runtime = await open();
    const first = await borrow(runtime.pool);
    const firstPid = await pid(first);
    const identity = await first.query(
      "SELECT current_user AS role, session_user AS session, current_database() AS database, (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl",
    );
    expect(identity.rows).toEqual([
      {
        role: "learli_app",
        session: "learli_app",
        database: "learli_staging",
        ssl: true,
      },
    ]);
    first.release();
    await expect.poll(() => runtime.pool.idleCount).toBe(1);
    const reused = await borrow(runtime.pool);
    expect(await pid(reused)).toBe(firstPid);
    await expect(first.query("SELECT 1")).rejects.toMatchObject({
      code: "connection_failed",
    });
    expect(() => first.release()).toThrow();
    reused.release();
  });
  it("does not expose native pool options or clients through events or Drizzle $client", async () => {
    const runtime = await open();
    expect(runtime.db.$client).toBe(runtime.pool);
    for (const property of [
      "options",
      "Client",
      "_clients",
      "_idle",
      "connection",
      "password",
    ])
      expect(runtime.pool).not.toHaveProperty(property);
    const acquire = vi.fn();
    // EventEmitter remains ordinary server code; adapter never emits raw clients.
    (runtime.pool as unknown as Pool).on("acquire", acquire);
    const lease = await borrow(runtime.pool);
    expect(lease).not.toHaveProperty("connection");
    expect(lease).not.toHaveProperty("password");
    expect(acquire).not.toHaveBeenCalled();
    lease.release();
    expect(inspect(runtime.pool, { showHidden: true })).not.toContain(
      "w2-synthetic-placeholder",
    );
  });
  it("supports query SQL/config/value/rowMode callback and promise overloads", async () => {
    const { pool } = await open();
    expect(
      (await pool.query<{ value: number }>("SELECT $1::int AS value", [7]))
        .rows[0].value,
    ).toBe(7);
    expect(
      (
        await pool.query({
          text: "SELECT $1::int",
          values: [9],
          rowMode: "array",
        })
      ).rows,
    ).toEqual([[9]]);
    await new Promise<void>((resolve, reject) => {
      pool.query("SELECT 11 AS value", (error, result) => {
        if (error) return reject(error);
        expect(result?.rows[0].value).toBe(11);
        resolve();
      });
    });
    await new Promise<void>((resolve, reject) => {
      pool.query("SELECT $1::int AS value", [12], (error, result) => {
        if (error) return reject(error);
        expect(result?.rows[0].value).toBe(12);
        resolve();
      });
    });
    await new Promise<void>((resolve, reject) => {
      pool.query(
        { text: "SELECT $1::int", values: [13], rowMode: "array" },
        (error, result) => {
          if (error) return reject(error);
          expect(result?.rows).toEqual([[13]]);
          resolve();
        },
      );
    });
    await new Promise<void>((resolve, reject) => {
      pool.connect((error, client, release) => {
        if (error || !client) return reject(error);
        void client.query("SELECT 14 AS value", (failure, result) => {
          release(failure);
          if (failure) return reject(failure);
          expect(result?.rows[0].value).toBe(14);
          resolve();
        });
      });
    });
  });
  it("keeps named prepared statements valid across cleanup and actual same-session reuse", async () => {
    const { pool } = await open();
    const firstPid = await pid(pool);
    await expect.poll(() => pool.idleCount).toBe(1);
    expect(
      (
        await pool.query({
          name: "w2_named",
          text: "SELECT $1::int AS value",
          values: [21],
        })
      ).rows[0].value,
    ).toBe(21);
    await expect.poll(() => pool.idleCount).toBe(1);
    expect(
      (
        await pool.query({
          name: "w2_named",
          text: "SELECT $1::int AS value",
          values: [22],
        })
      ).rows[0].value,
    ).toBe(22);
    await expect.poll(() => pool.idleCount).toBe(1);
    expect(await pid(pool)).toBe(firstPid);
  });
  it("commits and rolls back Drizzle transactions on one actual client, including nested rollback", async () => {
    const { db, pool } = await open();
    await db.transaction(async (tx) => {
      const firstPid = (await tx.execute(sql`SELECT pg_backend_pid() AS pid`))
        .rows[0].pid;
      await tx.execute(
        sql`UPDATE public.w2_runtime_probe SET value=10 WHERE id=1`,
      );
      expect(
        (await tx.execute(sql`SELECT pg_backend_pid() AS pid`)).rows[0].pid,
      ).toBe(firstPid);
      await expect(
        tx.transaction(async (nested) => {
          await nested.execute(
            sql`UPDATE public.w2_runtime_probe SET value=99 WHERE id=1`,
          );
          throw new Error("w2 nested rollback");
        }),
      ).rejects.toThrow("w2 nested rollback");
      expect(
        (
          await tx.execute(
            sql`SELECT value FROM public.w2_runtime_probe WHERE id=1`,
          )
        ).rows[0].value,
      ).toBe(10);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`UPDATE public.w2_runtime_probe SET value=20 WHERE id=1`,
        );
        throw new Error("w2 rollback");
      }),
    ).rejects.toThrow("w2 rollback");
    expect(
      (await pool.query("SELECT value FROM public.w2_runtime_probe WHERE id=1"))
        .rows[0].value,
    ).toBe(10);
  });
  it("serializes two real Drizzle transactions through a row lock on different clients", async () => {
    const { db, pool } = await open();
    let releaseFirst!: () => void;
    let locked!: () => void;
    const lockReady = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstPid: unknown;
    const first = db.transaction(async (tx) => {
      firstPid = (await tx.execute(sql`SELECT pg_backend_pid() AS pid`)).rows[0]
        .pid;
      await tx.execute(
        sql`UPDATE public.w2_runtime_probe SET value=value+1 WHERE id=1`,
      );
      locked();
      await gate;
    });
    await lockReady;
    const second = db.transaction(async (tx) => {
      expect(
        (await tx.execute(sql`SELECT pg_backend_pid() AS pid`)).rows[0].pid,
      ).not.toBe(firstPid);
      await tx.execute(
        sql`UPDATE public.w2_runtime_probe SET value=value+1 WHERE id=1`,
      );
    });
    try {
      await expect
        .poll(async () =>
          Number(
            (
              await targetSql(
                "SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE datname='learli_staging' AND wait_event_type='Lock' AND usename='learli_app'",
              )
            ).rows[0].count,
          ),
        )
        .toBe(1);
    } finally {
      releaseFirst();
    }
    await Promise.all([first, second]);
    expect(
      (await pool.query("SELECT value FROM public.w2_runtime_probe WHERE id=1"))
        .rows[0].value,
    ).toBe(2);
  });
  it("normal release rolls back unfinished SQL, removes advisory locks and resets session settings", async () => {
    const { pool } = await open();
    const lease = await borrow(pool);
    const nativePid = await pid(lease);
    await lease.query(
      "BEGIN; UPDATE public.w2_runtime_probe SET value=99 WHERE id=1; SET search_path=public; SELECT pg_advisory_lock(902,2)",
    );
    lease.release();
    await expect.poll(() => pool.idleCount).toBe(1);
    const reused = await borrow(pool);
    expect(await pid(reused)).toBe(nativePid);
    expect(
      (
        await reused.query(
          "SELECT value FROM public.w2_runtime_probe WHERE id=1",
        )
      ).rows[0].value,
    ).toBe(0);
    expect((await reused.query("SHOW search_path")).rows[0].search_path).toBe(
      "pg_catalog,public",
    );
    expect(
      (await targetSql("SELECT pg_try_advisory_lock(902,2) AS acquired"))
        .rows[0].acquired,
    ).toBe(true);
    reused.release();
  });
  it.each([
    "SUPERUSER",
    "CREATEDB",
    "CREATEROLE",
    "REPLICATION",
    "BYPASSRLS",
    "NOLOGIN",
  ])(
    "denies reused session after role attribute %s drift before application INSERT",
    async (attribute) => {
      const { pool } = await open();
      await harness.asAdmin((admin) =>
        admin.query(`ALTER ROLE learli_app ${attribute}`),
      );
      try {
        const failure = await pool
          .query("INSERT INTO public.w2_runtime_probe VALUES(2,1)")
          .catch((error: unknown) => error);
        expectSafe(failure, "runtime_privilege");
        expect(
          (
            await targetSql(
              "SELECT count(*) FROM public.w2_runtime_probe WHERE id=2",
            )
          ).rows[0].count,
        ).toBe("0");
        await expect.poll(() => pool.totalCount).toBe(0);
      } finally {
        await harness.asAdmin((admin) =>
          admin.query(
            `ALTER ROLE learli_app ${attribute === "NOLOGIN" ? "LOGIN" : `NO${attribute}`}`,
          ),
        );
      }
    },
  );
  it("denies SET-only membership drift on a reused session", async () => {
    const { pool } = await open();
    await harness.asAdmin((admin) =>
      admin.query(
        "CREATE ROLE w2_member NOLOGIN; GRANT w2_member TO learli_app WITH INHERIT FALSE, SET TRUE",
      ),
    );
    try {
      await expect(pool.connect()).rejects.toMatchObject({
        code: "runtime_privilege",
      });
      await expect.poll(() => pool.totalCount).toBe(0);
    } finally {
      await harness.asAdmin((admin) =>
        admin.query("REVOKE w2_member FROM learli_app; DROP ROLE w2_member"),
      );
    }
  });
  it.each([
    ["SET", "session_replication_role", "learli_app"],
    ["SET", "session_replication_role", "PUBLIC"],
    ["ALTER SYSTEM", "work_mem", "learli_app"],
    ["ALTER SYSTEM", "work_mem", "PUBLIC"],
  ])(
    "denies %s parameter %s through %s after pooled reuse",
    async (privilege, parameter, grantee) => {
      const { pool } = await open();
      await harness.asAdmin((admin) =>
        admin.query(
          `GRANT ${privilege} ON PARAMETER ${parameter} TO ${grantee}`,
        ),
      );
      try {
        await new Promise<void>((resolve) =>
          pool.query(
            "INSERT INTO public.w2_runtime_probe VALUES(2,1)",
            (error, result) => {
              expectSafe(error, "runtime_privilege");
              expect(result).toBeUndefined();
              resolve();
            },
          ),
        );
        expect(
          (
            await targetSql(
              "SELECT count(*) FROM public.w2_runtime_probe WHERE id=2",
            )
          ).rows[0].count,
        ).toBe("0");
        await expect.poll(() => pool.totalCount).toBe(0);
      } finally {
        await harness.asAdmin((admin) =>
          admin.query(
            `REVOKE ${privilege} ON PARAMETER ${parameter} FROM ${grantee}`,
          ),
        );
      }
    },
  );
  it.each([
    "ROLE learli_app",
    "DATABASE learli_staging",
    "ROLE learli_app IN DATABASE learli_staging",
  ])(
    "detects non-origin catalog defaults on %s despite old pooled session still origin",
    async (target) => {
      const { pool } = await open();
      const before = await pid(pool);
      await expect.poll(() => pool.idleCount).toBe(1);
      await harness.asAdmin((admin) =>
        admin.query(`ALTER ${target} SET session_replication_role=replica`),
      );
      try {
        await expect(pool.connect()).rejects.toMatchObject({
          code: "runtime_privilege",
        });
        await expect.poll(() => pool.totalCount).toBe(0);
      } finally {
        await harness.asAdmin((admin) =>
          admin.query(`ALTER ${target} RESET session_replication_role`),
        );
      }
      expect(await pid(pool)).not.toBe(before);
    },
  );
  it.each([
    [
      "GRANT CREATE ON DATABASE learli_staging TO learli_app",
      "REVOKE CREATE ON DATABASE learli_staging FROM learli_app",
    ],
    [
      "GRANT CREATE ON SCHEMA public TO PUBLIC",
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC",
    ],
    [
      "ALTER TABLE public.w2_runtime_probe OWNER TO learli_app",
      "ALTER TABLE public.w2_runtime_probe OWNER TO learli_migrator",
    ],
    ["CREATE SCHEMA w2_owned AUTHORIZATION learli_app", "DROP SCHEMA w2_owned"],
    [
      "CREATE FUNCTION public.w2_owned() RETURNS integer LANGUAGE sql AS 'SELECT 1'; ALTER FUNCTION public.w2_owned() OWNER TO learli_app",
      "DROP FUNCTION public.w2_owned()",
    ],
  ])(
    "rejects reused session object/creation drift: %s",
    async (mutate, cleanup) => {
      const { pool } = await open();
      await targetSql(mutate);
      try {
        await expect(pool.connect()).rejects.toMatchObject({
          code: "runtime_privilege",
        });
        await expect.poll(() => pool.totalCount).toBe(0);
      } finally {
        await targetSql(cleanup);
        await targetSql(
          "GRANT SELECT, INSERT, UPDATE ON public.w2_runtime_probe TO learli_app",
        );
      }
    },
  );
  it("denies callback checkout and Drizzle transactions before their callback after drift", async () => {
    const { db, pool } = await open();
    await harness.asAdmin((admin) =>
      admin.query("ALTER ROLE learli_app CREATEDB"),
    );
    const operation = vi.fn();
    try {
      await expect(db.transaction(operation)).rejects.toMatchObject({
        code: "runtime_privilege",
      });
      expect(operation).not.toHaveBeenCalled();
      await new Promise<void>((resolve) =>
        pool.connect((error, client, release) => {
          expectSafe(error, "runtime_privilege");
          expect(client).toBeUndefined();
          release();
          resolve();
        }),
      );
      await expect.poll(() => pool.totalCount).toBe(0);
    } finally {
      await harness.asAdmin((admin) =>
        admin.query("ALTER ROLE learli_app NOCREATEDB"),
      );
    }
  });
  it("sanitizes query errors but preserves SQLSTATE/constraint for conflict handling", async () => {
    const { pool } = await open();
    const failure = await pool
      .query("INSERT INTO public.w2_runtime_probe VALUES(1,123)")
      .catch((error: unknown) => error);
    expectSafe(failure, "23505");
    expect(failure).toMatchObject({ constraint: "w2_runtime_probe_pkey" });
    expect(failure).not.toHaveProperty("detail");
    await expect.poll(() => pool.totalCount).toBe(0);
    expect(
      (await pool.query("SELECT value FROM public.w2_runtime_probe WHERE id=1"))
        .rows[0].value,
    ).toBe(0);
  });
  it("rejects native Submittable transport without invoking submit", async () => {
    const { pool } = await open();
    const submit = vi.fn();
    // Deliberate JS-level adversarial input outside the typed supported API.
    await expect(
      (pool as unknown as Pool).query({ submit }),
    ).rejects.toMatchObject({ code: "config_invalid" });
    expect(submit).not.toHaveBeenCalled();
  });
  it("sanitizes SQL BEGIN failure and reclaims Drizzle's initial lease", async () => {
    const { db, pool } = await open();
    const operation = vi.fn();
    await expect(
      db.transaction(operation, {
        isolationLevel: "w2-invalid" as "serializable",
      }),
    ).rejects.toThrow();
    expect(operation).not.toHaveBeenCalled();
    await expect.poll(() => pool.totalCount).toBe(0);
  });
  it("destroys leases explicitly, closes idempotently and denies work after close", async () => {
    const runtime = await open();
    const lease = await borrow(runtime.pool);
    lease.release(true);
    await expect.poll(() => runtime.pool.totalCount).toBe(0);
    const closed = runtime.close();
    expect(runtime.close()).toBe(closed);
    await closed;
    await new Promise<void>((resolve, reject) =>
      runtime.pool.end((error) => (error ? reject(error) : resolve())),
    );
    await expect(runtime.pool.query("SELECT 1")).rejects.toMatchObject({
      code: "connection_failed",
    });
    await expect(runtime.pool.connect()).rejects.toMatchObject({
      code: "connection_failed",
    });
  });
  it("close drains a genuinely borrowed client and release ends its unfinished transaction", async () => {
    const runtime = await open();
    const lease = await borrow(runtime.pool);
    await lease.query("BEGIN; SELECT pg_advisory_lock(902,3)");
    let finished = false;
    const close = runtime.close().then(() => {
      finished = true;
    });
    expect(runtime.pool.ending).toBe(true);
    await expect(runtime.pool.connect()).rejects.toMatchObject({
      code: "connection_failed",
    });
    expect(finished).toBe(false);
    lease.release();
    await close;
    expect(
      (await targetSql("SELECT pg_try_advisory_lock(902,3) AS acquired"))
        .rows[0].acquired,
    ).toBe(true);
  });
  it("process TLS weakening after initial setup refuses new checkouts and lease queries", async () => {
    const { pool } = await open();
    const lease = await borrow(pool);
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
    await expect(pool.connect()).rejects.toMatchObject({
      code: "config_invalid",
    });
    await expect(lease.query("SELECT 1")).rejects.toMatchObject({
      code: "config_invalid",
    });
    vi.unstubAllEnvs();
    lease.release(true);
  });
  it("revalidates a queued checkout after drift before handing out a callback lease", async () => {
    const { pool } = await open();
    const held = await Promise.all(
      Array.from({ length: 5 }, () => borrow(pool)),
    );
    const queued = new Promise<void>((resolve) =>
      pool.connect((error, client) => {
        expectSafe(error, "runtime_privilege");
        expect(client).toBeUndefined();
        resolve();
      }),
    );
    await expect.poll(() => pool.waitingCount).toBe(1);
    await harness.asAdmin((admin) =>
      admin.query("ALTER ROLE learli_app CREATEDB"),
    );
    try {
      held[0].release();
      await queued;
      expect(pool.totalCount).toBe(4);
    } finally {
      await harness.asAdmin((admin) =>
        admin.query("ALTER ROLE learli_app NOCREATEDB"),
      );
      for (const client of held.slice(1)) client.release(true);
    }
    await expect.poll(() => pool.totalCount).toBe(0);
  });
  it("sanitizes a terminated borrowed connection, reclaims it, and refuses its stale lease", async () => {
    const { pool } = await open();
    const lease = await borrow(pool);
    const backend = await pid(lease);
    const observed: unknown[] = [];
    pool.on("error", (error) => observed.push(error));
    await targetSql(`SELECT pg_terminate_backend(${backend})`);
    await expect.poll(() => pool.totalCount).toBe(0);
    await expect.poll(() => observed.length).toBeGreaterThan(0);
    for (const error of observed) expectSafe(error);
    await expect(
      lease.query("INSERT INTO public.w2_runtime_probe VALUES(2,1)"),
    ).rejects.toMatchObject({ code: "connection_failed" });
    expect(
      (
        await targetSql(
          "SELECT count(*) FROM public.w2_runtime_probe WHERE id=2",
        )
      ).rows[0].count,
    ).toBe("0");
    expect((await pool.query("SELECT 1 AS value")).rows[0].value).toBe(1);
  });
  it("refuses mismatched migration identity and cleans initial verification failure", async () => {
    injected.settings = () => harness.settings("learli_migrator");
    expectSafe(
      await createHostedRuntimeDatabase(config()).catch(
        (error: unknown) => error,
      ),
      "identity_mismatch",
    );
    await expect.poll(() => harness.activeConnections()).toBe(0);
  });
  it("refuses untrusted CA during an actual TLS handshake and leaves no connection", async () => {
    injected.settings = () =>
      harness.settings("learli_app", harness.untrustedCa);
    expectSafe(
      await createHostedRuntimeDatabase(config()).catch(
        (error: unknown) => error,
      ),
      "connection_failed",
    );
    await expect.poll(() => harness.activeConnections()).toBe(0);
  });
  it.each(["expired", "mismatch"] as const)(
    "refuses actual %s certificate and cleans startup",
    async (certificate) => {
      await harness.start(certificate);
      try {
        expectSafe(
          await createHostedRuntimeDatabase(config()).catch(
            (error: unknown) => error,
          ),
          "connection_failed",
        );
      } finally {
        await harness.start("trusted");
      }
      await expect.poll(() => harness.activeConnections()).toBe(0);
    },
    60_000,
  );
  it("bounds stalled SSL negotiation and closes the owned socket", async () => {
    harness.stop();
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("data", () => undefined);
      socket.once("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(harness.port, "127.0.0.1", resolve);
    });
    try {
      const start = performance.now();
      expectSafe(
        await createHostedRuntimeDatabase(config()).catch(
          (error: unknown) => error,
        ),
        "connection_failed",
      );
      expect(performance.now() - start).toBeGreaterThanOrEqual(2500);
      expect(performance.now() - start).toBeLessThan(8000);
      await expect.poll(() => sockets.size).toBe(0);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.start();
    }
  }, 60_000);
});
