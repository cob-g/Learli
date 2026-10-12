import { createServer, type Socket } from "node:net";
import { drizzle } from "drizzle-orm/node-postgres";
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
  createStagingTlsHarness,
  type StagingTlsHarness,
} from "../support/staging-tls";
import {
  stagingDatabaseConfig,
  StagingDatabaseError,
  type StagingDatabaseConfig,
  type StagingPurpose,
} from "@/lib/db/staging-config";
import {
  openStagingConnection,
  type StagingConnection,
} from "@/lib/db/staging-connection";

// CA and loopback settings exist only in Vitest's module substitution. There is
// no test switch, alternate factory or injectable TLS option in production.
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
      actual.stagingPoolConfig(config); // Still requires opaque config and TLS guards.
      if (!injected.settings)
        throw new Error("TLS test settings not initialized.");
      return injected.settings(config);
    },
  };
});
function config(purpose: StagingPurpose = "runtime") {
  const role = purpose === "runtime" ? "learli_app" : "learli_migrator";
  return stagingDatabaseConfig({
    appEnv: "staging",
    purpose,
    url: `postgresql://${role}:synthetic-placeholder@ep-fictional-123.us-east-2.aws.neon.tech/learli_staging?sslmode=verify-full`,
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
      approvedPurposes: ["runtime", "inspect", "migrate"],
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
const connections: StagingConnection[] = [];
async function open(purpose: StagingPurpose = "runtime") {
  const connection = await openStagingConnection(config(purpose));
  connections.push(connection);
  return connection;
}
beforeAll(async () => {
  harness = await createStagingTlsHarness();
  injected.settings = (parsed) =>
    harness.settings(
      parsed.purpose === "runtime" ? "learli_app" : "learli_migrator",
    );
}, 60_000);
afterEach(async () => {
  await Promise.all(
    connections.splice(0).map((connection) => connection.close()),
  );
  injected.settings = (parsed) =>
    harness.settings(
      parsed.purpose === "runtime" ? "learli_app" : "learli_migrator",
    );
});
afterAll(() => harness?.stop());

async function nativeTlsFailure(settings: PoolConfig, codes: string[]) {
  const pool = new Pool(settings);
  try {
    const failure = await pool.connect().then(
      (client) => {
        client.release(true);
        return undefined;
      },
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(codes).toContain((failure as NodeJS.ErrnoException).code);
  } finally {
    await pool.end();
  }
}

async function refused(code: string) {
  const result = await openStagingConnection(config()).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(result).toBeInstanceOf(StagingDatabaseError);
  expect(result).toMatchObject({ code });
  expect(result).not.toHaveProperty("cause");
  expect(String(result)).not.toMatch(
    /password|certificate|127\.0\.0\.1|55701|synthetic-placeholder/,
  );
  // Eventual session removal is observed, not assumed from mocked pool.end.
  await expect.poll(() => harness.activeConnections()).toBe(0);
}

describe("owned PostgreSQL verified TLS staging lifecycle", () => {
  it("performs trusted handshake, exact read-only identity and Drizzle on one client", async () => {
    const connection = await open();
    await connection.withClient(async (client) => {
      const rows = await drizzle(client)
        .execute(sql`SELECT current_user AS role, current_database() AS database,
        (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl`);
      expect(rows.rows).toEqual([
        { role: "learli_app", database: "learli_staging", ssl: true },
      ]);
    });
    await connection.close();
    await expect.poll(() => harness.activeConnections()).toBe(0);
  });
  it("rejects an untrusted issuer with an actual handshake and no leaked connection", async () => {
    injected.settings = () =>
      harness.settings("learli_app", harness.untrustedCa);
    await nativeTlsFailure(
      harness.settings("learli_app", harness.untrustedCa),
      [
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
        "SELF_SIGNED_CERT_IN_CHAIN",
      ],
    );
    await refused("connection_failed");
  });
  it("rejects an expired trusted certificate through actual handshake", async () => {
    await harness.start("expired");
    await nativeTlsFailure(harness.settings("learli_app"), [
      "CERT_HAS_EXPIRED",
    ]);
    // Admin connection also cannot trust an expired certificate; inspect session
    // cleanup only after restarting the same owned target with its valid cert.
    const result = await openStagingConnection(config()).catch(
      (error: unknown) => error,
    );
    expect(result).toBeInstanceOf(StagingDatabaseError);
    expect(result).toMatchObject({ code: "connection_failed" });
    expect(result).not.toHaveProperty("cause");
    await harness.start("trusted");
    await expect.poll(() => harness.activeConnections()).toBe(0);
  }, 60_000);
  it("rejects hostname/IP mismatch despite a trusted CA through actual handshake", async () => {
    await harness.start("mismatch");
    await nativeTlsFailure(harness.settings("learli_app"), [
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ]);
    const result = await openStagingConnection(config()).catch(
      (error: unknown) => error,
    );
    expect(result).toBeInstanceOf(StagingDatabaseError);
    expect(result).toMatchObject({ code: "connection_failed" });
    expect(result).not.toHaveProperty("cause");
    await harness.start("trusted");
    await expect.poll(() => harness.activeConnections()).toBe(0);
  }, 60_000);
  it("uses a single migration session and destroys held advisory locks on callback failure", async () => {
    const connection = await open("migrate");
    let pid: number | undefined;
    await expect(
      connection.withClient(async (client) => {
        pid = (
          await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
        ).rows[0].pid;
        await client.query("SELECT pg_advisory_lock(123, 456)");
        const rows = await drizzle(client).execute(
          sql`SELECT pg_backend_pid() AS pid`,
        );
        expect(rows.rows[0].pid).toBe(pid);
        await client.query("BEGIN");
        throw new Error("Synthetic callback failure.");
      }),
    ).rejects.toThrow("Synthetic callback failure.");
    await connection.close();
    await expect.poll(() => harness.activeConnections()).toBe(0);
    const owner = new Pool(harness.settings("learli_migrator"));
    try {
      expect(
        (await owner.query("SELECT pg_try_advisory_lock(123,456) AS acquired"))
          .rows[0].acquired,
      ).toBe(true);
    } finally {
      await owner.end();
    }
  });
  it("refuses mismatched credential/database identity and closes the initial session", async () => {
    injected.settings = () => harness.settings("learli_migrator");
    await refused("identity_mismatch");
  });
  it.each(["SUPERUSER", "CREATEDB", "CREATEROLE", "REPLICATION", "BYPASSRLS"])(
    "refuses runtime attribute %s with real role catalog",
    async (attribute) => {
      await harness.asAdmin((pool) =>
        pool.query(`ALTER ROLE learli_app ${attribute}`),
      );
      try {
        await refused("runtime_privilege");
      } finally {
        await harness.asAdmin((pool) =>
          pool.query(`ALTER ROLE learli_app NO${attribute}`),
        );
      }
    },
  );
  it("refuses SET ROLE-only administrative membership", async () => {
    await harness.asAdmin(async (pool) => {
      await pool.query("CREATE ROLE tls_admin_member NOLOGIN CREATEROLE");
      await pool.query(
        "GRANT tls_admin_member TO learli_app WITH INHERIT FALSE, SET TRUE",
      );
    });
    try {
      await refused("runtime_privilege");
    } finally {
      await harness.asAdmin((pool) =>
        pool.query(
          "REVOKE tls_admin_member FROM learli_app; DROP ROLE tls_admin_member",
        ),
      );
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
    "refuses administrative parameter privilege $privilege via $grantee",
    async ({ grantee, privilege, parameter }) => {
      await harness.asAdmin((pool) =>
        pool.query(
          `GRANT ${privilege} ON PARAMETER ${parameter} TO ${grantee}`,
        ),
      );
      try {
        const native = new Pool(harness.settings("learli_app"));
        try {
          expect(
            (
              await native.query(
                "SELECT has_parameter_privilege(current_user,$1,$2) AS allowed",
                [parameter, privilege],
              )
            ).rows[0].allowed,
          ).toBe(true);
          if (privilege === "SET") {
            const client = await native.connect();
            try {
              await client.query(
                "BEGIN; SET LOCAL session_replication_role=replica",
              );
              expect(
                (await client.query("SHOW session_replication_role")).rows[0]
                  .session_replication_role,
              ).toBe("replica");
            } finally {
              await client.query("ROLLBACK");
              client.release(true);
            }
          }
        } finally {
          await native.end();
        }
        await refused("runtime_privilege");
      } finally {
        await harness.asAdmin((pool) =>
          pool.query(
            `REVOKE ${privilege} ON PARAMETER ${parameter} FROM ${grantee}`,
          ),
        );
      }
      await open();
    },
  );
  it.each([
    "ROLE learli_app",
    "DATABASE learli_staging",
    "ROLE learli_migrator",
  ])(
    "refuses non-origin default on %s without a parameter ACL",
    async (target) => {
      await harness.asAdmin((pool) =>
        pool.query(`ALTER ${target} SET session_replication_role=replica`),
      );
      try {
        const purpose =
          target === "ROLE learli_migrator" ? "inspect" : "runtime";
        const native = new Pool(
          harness.settings(
            purpose === "runtime" ? "learli_app" : "learli_migrator",
          ),
        );
        try {
          expect(
            (await native.query("SHOW session_replication_role")).rows[0]
              .session_replication_role,
          ).toBe("replica");
          expect(
            (
              await native.query(
                "SELECT has_parameter_privilege('learli_app','session_replication_role','SET') AS allowed",
              )
            ).rows[0].allowed,
          ).toBe(false);
        } finally {
          await native.end();
        }
        const result = await open(purpose).catch((error: unknown) => error);
        expect(result).toBeInstanceOf(StagingDatabaseError);
        expect(result).toMatchObject({ code: "identity_mismatch" });
        expect(result).not.toHaveProperty("cause");
        await expect.poll(() => harness.activeConnections()).toBe(0);
      } finally {
        await harness.asAdmin((pool) =>
          pool.query(`ALTER ${target} RESET session_replication_role`),
        );
      }
      await open();
    },
  );
  it("rejects parameter privilege drift before an already-open connection callback", async () => {
    const connection = await open();
    await harness.asAdmin((pool) =>
      pool.query("GRANT SET ON PARAMETER session_replication_role TO PUBLIC"),
    );
    let called = false;
    try {
      await expect(
        connection.withClient(async () => {
          called = true;
        }),
      ).rejects.toMatchObject({ code: "runtime_privilege" });
      expect(called).toBe(false);
      await expect.poll(() => harness.activeConnections()).toBe(0);
    } finally {
      await harness.asAdmin((pool) =>
        pool.query(
          "REVOKE SET ON PARAMETER session_replication_role FROM PUBLIC",
        ),
      );
    }
    await connection.withClient(async () => {
      called = true;
    });
    expect(called).toBe(true);
  });
  it("refuses runtime database CREATE rights", async () => {
    await harness.asAdmin((pool) =>
      pool.query("GRANT CREATE ON DATABASE learli_staging TO learli_app"),
    );
    try {
      await refused("runtime_privilege");
    } finally {
      await harness.asAdmin((pool) =>
        pool.query("REVOKE CREATE ON DATABASE learli_staging FROM learli_app"),
      );
    }
  });
  it("refuses effective PUBLIC schema creation rights", async () => {
    const owner = new Pool(harness.settings("learli_migrator"));
    try {
      await owner.query("GRANT CREATE ON SCHEMA public TO PUBLIC");
    } finally {
      await owner.end();
    }
    try {
      await refused("runtime_privilege");
    } finally {
      const cleanup = new Pool(harness.settings("learli_migrator"));
      try {
        await cleanup.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
      } finally {
        await cleanup.end();
      }
    }
  });
  it("refuses runtime-owned application objects", async () => {
    await harness.asAdmin(async (pool) => {
      // Connect to exact owned synthetic target for this privilege mutation.
      const targetPool = new Pool({
        ...harness.settings("tls_admin"),
        database: "learli_staging",
      });
      try {
        await targetPool.query(
          "CREATE TABLE public.tls_owned_probe(id integer); ALTER TABLE public.tls_owned_probe OWNER TO learli_app",
        );
      } finally {
        await targetPool.end();
      }
      await pool.query("SELECT 1");
    });
    try {
      await refused("runtime_privilege");
    } finally {
      const targetPool = new Pool({
        ...harness.settings("tls_admin"),
        database: "learli_staging",
      });
      try {
        await targetPool.query("DROP TABLE public.tls_owned_probe");
      } finally {
        await targetPool.end();
      }
    }
  });
  it("bounds an actual stalled SSL negotiation and closes the client socket", async () => {
    harness.stop();
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("data", () => undefined); // Owned peer deliberately never acknowledges SSLRequest.
      socket.once("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(harness.port, "127.0.0.1", resolve);
    });
    try {
      const started = performance.now();
      const failure = await openStagingConnection(config()).catch(
        (error: unknown) => error,
      );
      const elapsed = performance.now() - started;
      expect(failure).toMatchObject({ code: "connection_failed" });
      expect(failure).not.toHaveProperty("cause");
      expect(elapsed).toBeGreaterThanOrEqual(2500);
      expect(elapsed).toBeLessThan(8000);
      await expect.poll(() => sockets.size).toBe(0);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await harness.start("trusted");
    }
    await expect.poll(() => harness.activeConnections()).toBe(0);
  }, 60_000);

  it("rechecks changed runtime privileges before invoking a later callback", async () => {
    const connection = await open();
    await harness.asAdmin((pool) =>
      pool.query("ALTER ROLE learli_app CREATEDB"),
    );
    const operation = vi.fn();
    try {
      await expect(connection.withClient(operation)).rejects.toMatchObject({
        code: "runtime_privilege",
      });
    } finally {
      await harness.asAdmin((pool) =>
        pool.query("ALTER ROLE learli_app NOCREATEDB"),
      );
    }
    expect(operation).not.toHaveBeenCalled();
  });
});
