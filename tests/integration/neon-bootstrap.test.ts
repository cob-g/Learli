import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { Pool, type PoolConfig, type PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  bootstrapNeonRoles,
  type NeonRoleCredentials,
} from "../../scripts/neon-bootstrap";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import {
  applyPlan,
  inspectTarget,
  planHash,
} from "../../scripts/staging-migrations/runner";
import {
  neonOperationConfig,
  type NeonOperationConfig,
} from "@/lib/db/neon-operation-config";
import { openVerifiedOperationConnection } from "@/lib/db/staging-connection";
import {
  createStagingTlsHarness,
  type StagingTlsHarness,
} from "../support/staging-tls";
import { operationTarget } from "../support/neon-operation-target";

const injected = vi.hoisted(() => ({
  settings: undefined as
    | ((config: NeonOperationConfig, original: PoolConfig) => PoolConfig)
    | undefined,
}));
vi.mock("@/lib/db/neon-operation-config", async (original) => {
  const actual =
    await original<typeof import("@/lib/db/neon-operation-config")>();
  return {
    ...actual,
    neonOperationPoolConfig: (config: NeonOperationConfig) => {
      const options = actual.neonOperationPoolConfig(config);
      if (!injected.settings)
        throw new Error("Owned bootstrap fixture unavailable.");
      return injected.settings(config, options);
    },
  };
});
let harness: StagingTlsHarness;
let unsafeTracing = false;
let cancelRoleDdl = false;
let credentials: NeonRoleCredentials | undefined;
const target = operationTarget("production");
const config = (
  purpose: "bootstrap" | "inspect" | "migrate" | "inspect-runtime",
) => {
  let url: string;
  if (purpose === "bootstrap") {
    const value = new URL(
      `postgresql://neondb_owner@${target.hostname}/neondb?sslmode=verify-full`,
    );
    value.password = String(harness.settings("neondb_owner").password);
    url = value.toString();
  } else {
    if (!credentials) throw new Error("Owned bootstrap has not committed.");
    url =
      purpose === "inspect-runtime"
        ? credentials.runtimeUrl
        : credentials.migrationUrl;
  }
  return neonOperationConfig({ appEnv: "production", target, purpose, url });
};
beforeAll(async () => {
  harness = await createStagingTlsHarness({ neonBootstrap: true });
  injected.settings = (value, original) => ({
    ...harness.settings("neondb_owner"),
    user: value.role,
    password: original.password,
    database: "neondb",
    statement_timeout: cancelRoleDdl ? 250 : original.statement_timeout,
    options: `-c search_path=pg_catalog,public${unsafeTracing ? " -c debug_print_parse=on" : ""}`,
  });
}, 60000);
afterAll(() => harness?.stop());
describe("actual Neon-shaped non-database-owner bootstrap", () => {
  it("refuses unsafe statement tracing before generating/retaining credentials or DDL", async () => {
    const retain = vi.fn();
    unsafeTracing = true;
    try {
      await expect(
        bootstrapNeonRoles(config("bootstrap"), retain),
      ).rejects.toMatchObject({ category: "migration_prerequisite" });
      expect(retain).not.toHaveBeenCalled();
    } finally {
      unsafeTracing = false;
    }
  });
  it("establishes the original utility-statement logging risk with a never-valid synthetic canary", async () => {
    const canary = randomBytes(32).toString("hex"),
      before = await openVerifiedOperationConnection(config("bootstrap"));
    try {
      // This generated canary is NEVER a valid credential: existing role name
      // makes the original CREATE ROLE statement fail without any role change.
      // No retrieved provider secret or live fixture password is in this SQL.
      await expect(
        before.withClient((client) =>
          client.query(
            `CREATE ROLE neondb_owner LOGIN PASSWORD '${canary}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`,
          ),
        ),
      ).rejects.toThrow();
    } finally {
      await before.close();
    }
    const log = readFileSync(
      path.join(harness.directory, "server.log"),
      "utf8",
    );
    expect(log.includes(canary)).toBe(true);
  });
  it("scrubs actual role-DDL cancellation under catalog lock without disabling timeout", async () => {
    const blocker = new Pool(harness.settings("tls_admin"));
    let lease: PoolClient | undefined,
      cancelled: NeonRoleCredentials | undefined;
    const logPath = path.join(harness.directory, "server.log");
    const beforeLogLength = readFileSync(logPath, "utf8").length;
    cancelRoleDdl = true;
    try {
      await expect(
        bootstrapNeonRoles(config("bootstrap"), async (value) => {
          cancelled = value;
          lease = await blocker.connect();
          await lease.query("BEGIN");
          // SHARE allows earlier AccessShare preflight, but blocks CREATE ROLE's
          // RowExclusive catalog lock: a real server timeout inside dynamic SQL.
          await lease.query("LOCK pg_catalog.pg_authid IN SHARE MODE");
        }),
      ).rejects.toMatchObject({ category: "apply_failed" });
    } finally {
      cancelRoleDdl = false;
      if (lease) {
        await lease.query("ROLLBACK");
        lease.release(true);
      }
      await blocker.end();
    }
    const log = readFileSync(
      path.join(harness.directory, "server.log"),
      "utf8",
    );
    expect(
      log.includes(decodeURIComponent(new URL(cancelled!.runtimeUrl).password)),
    ).toBe(false);
    expect(log.slice(beforeLogLength)).toContain(
      "Private role bootstrap refused",
    );
    expect(log.slice(beforeLogLength)).not.toContain(
      "canceling statement due to statement timeout",
    );
    await harness.asAdmin(async (pool) => {
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM pg_roles WHERE rolname IN ('learli_app','learli_migrator')",
          )
        ).rows[0].count,
      ).toBe(0);
    });
  });
  it("scrubs actual role-creation errors from PostgreSQL statement logs while preserving rollback", async () => {
    let failedCredentials: NeonRoleCredentials | undefined;
    await expect(
      bootstrapNeonRoles(config("bootstrap"), async (value) => {
        failedCredentials = value;
        // Controlled independent actor creates a passwordless conflicting test role
        // after the empty preflight; bootstrap must rollback/scrub, never overwrite.
        await harness.asAdmin(async (pool) => {
          await pool.query("CREATE ROLE learli_app NOLOGIN");
        });
      }),
    ).rejects.toMatchObject({ category: "apply_failed" });
    const log = readFileSync(
      path.join(harness.directory, "server.log"),
      "utf8",
    );
    expect(log).toContain("Private role bootstrap refused");
    expect(log).toContain("STATEMENT:  DO $learli_private$");
    expect(log).not.toContain(
      decodeURIComponent(new URL(failedCredentials!.runtimeUrl).password),
    );
    expect(log).not.toContain(
      decodeURIComponent(new URL(failedCredentials!.migrationUrl).password),
    );
    // Only the passwordless conflicting test role, created by this test, is
    // removed from the owned fixture. No database/data reset or provider target.
    await harness.asAdmin(async (pool) => {
      await pool.query("DROP ROLE learli_app");
    });
  });
  it("preserves database owner, transfers only empty public schema and creates restricted independent roles", async () => {
    const before = await openVerifiedOperationConnection(config("bootstrap"));
    try {
      await before.withClient(async (client) => {
        expect(
          (
            await client.query(
              "SELECT pg_get_userbyid(datdba) owner FROM pg_database WHERE datname=current_database()",
            )
          ).rows[0].owner,
        ).toBe("neondb_owner");
        expect(
          (
            await client.query(
              "SELECT pg_get_userbyid(nspowner) owner FROM pg_namespace WHERE nspname='public'",
            )
          ).rows[0].owner,
        ).toBe("pg_database_owner");
      });
    } finally {
      await before.close();
    }
    const result = await bootstrapNeonRoles(
      config("bootstrap"),
      async (value) => {
        credentials = value;
      },
    );
    expect(result).toMatchObject({
      status: "PASS",
      roles: 2,
      schemaOwner: "learli_migrator",
      databaseOwner: "preserved",
      memberships: "new-roles-none",
      operatorSetPermission: "restored",
    });
    const after = await openVerifiedOperationConnection(config("bootstrap"));
    try {
      await after.withClient(async (client) => {
        const memberships = await client.query(`
          SELECT r.rolname AS granted_role,u.rolname AS member,
            m.admin_option,m.inherit_option,m.set_option
          FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid
          JOIN pg_roles u ON u.oid=m.member
          WHERE r.rolname IN ('learli_app','learli_migrator') ORDER BY r.rolname
        `);
        expect(memberships.rows).toEqual(
          ["learli_app", "learli_migrator"].map((granted_role) => ({
            granted_role,
            member: "neondb_owner",
            admin_option: true,
            inherit_option: false,
            set_option: false,
          })),
        );
      });
    } finally {
      await after.close();
    }
    const log = readFileSync(
      path.join(harness.directory, "server.log"),
      "utf8",
    );
    expect(log).not.toContain(
      decodeURIComponent(new URL(credentials!.runtimeUrl).password),
    );
    expect(log).not.toContain(
      decodeURIComponent(new URL(credentials!.migrationUrl).password),
    );
    expect(new URL(credentials!.runtimeUrl).password).not.toBe(
      new URL(credentials!.migrationUrl).password,
    );
  });
  it("applies exact reviewed SQL/grants using schema owner that is not database owner, with read-only production probe", async () => {
    const candidate = loadCandidate(process.cwd());
    const owner = await openVerifiedOperationConnection(config("migrate"));
    const runtime = await openVerifiedOperationConnection(
      config("inspect-runtime"),
    );
    const identity = {
      environment: "production" as const,
      database: "neondb",
      migrationRole: "learli_migrator",
      targetHash: "b".repeat(64),
    };
    const plan = await inspectTarget(owner, candidate, identity),
      hash = planHash(plan);
    const result = await applyPlan({
      owner,
      runtime,
      candidate,
      identity,
      plan,
      expectedPlanHash: hash,
      recovery: {
        version: 1,
        targetHash: identity.targetHash,
        planHash: hash,
        restorePointReference: "owned-empty-fixture",
        verifiedRecoveryReference: "owned-loopback-restore-evidence",
        operatorApproval: "synthetic-local-test",
      },
      recheckCandidate: () => loadCandidate(process.cwd()),
    });
    expect(result.status, `${result.category}/${result.stage}`).toBe("PASS");
    const inspect = await openVerifiedOperationConnection(config("inspect"));
    try {
      await inspect.withClient(async (client) => {
        expect(
          (
            await client.query(
              "SELECT pg_get_userbyid(datdba) owner FROM pg_database WHERE datname=current_database()",
            )
          ).rows[0].owner,
        ).toBe("neondb_owner");
        expect(
          (
            await client.query(
              'SELECT count(*)::int AS count FROM public."user"',
            )
          ).rows[0].count,
        ).toBe(0);
        expect(
          (
            await client.query(
              "SELECT count(*)::int AS count FROM public.subjects",
            )
          ).rows[0].count,
        ).toBe(8);
        expect(
          (
            await client.query(
              "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
            )
          ).rows[0].count,
        ).toBe(candidate.entries.length);
      });
    } finally {
      await inspect.close();
    }
  });
  it("refuses duplicate bootstrap without retaining new credentials or changing roles", async () => {
    const retain = vi.fn();
    await expect(
      bootstrapNeonRoles(config("bootstrap"), retain),
    ).rejects.toMatchObject({ category: "schema_unrecognized" });
    expect(retain).not.toHaveBeenCalled();
  });
});
