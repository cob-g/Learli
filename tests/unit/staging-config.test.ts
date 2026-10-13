import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  stagingDatabaseConfig,
  stagingPoolConfig,
  StagingDatabaseError,
  type ApprovedStagingTarget,
  type StagingDatabaseConfig,
  type StagingPurpose,
} from "@/lib/db/staging-config";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { stagingTlsTestPort } from "../support/staging-tls";

function target(): ApprovedStagingTarget {
  return {
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
  };
}
const secret = "private-unit-synthetic-password";
const url = (role = "learli_app") =>
  `postgresql://${role}:${secret}@${target().hostname}/learli_staging`;
function config(purpose: StagingPurpose = "runtime") {
  return stagingDatabaseConfig({
    appEnv: "staging",
    url: url(purpose === "runtime" ? "learli_app" : "learli_migrator"),
    target: target(),
    purpose,
  });
}
function refused(operation: () => unknown) {
  try {
    operation();
    throw new Error("Expected refusal");
  } catch (error) {
    expect(error).toBeInstanceOf(StagingDatabaseError);
    expect(error).toMatchObject({ code: "config_invalid" });
    expect(error).not.toHaveProperty("cause");
    expect(inspect(error)).not.toContain(secret);
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("explicit staging target binding", () => {
  it.each(["runtime", "inspect", "migrate"] as const)(
    "binds %s to its exact approved role",
    (purpose) => {
      const parsed = config(purpose);
      expect(parsed.role).toBe(
        purpose === "runtime" ? "learli_app" : "learli_migrator",
      );
      expect(parsed.target).toEqual(target());
      expect(stagingPoolConfig(parsed)).toMatchObject({
        host: target().hostname,
        port: 5432,
        user: parsed.role,
        password: secret,
        database: "learli_staging",
        max: 5,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: true },
      });
      expect(stagingPoolConfig(parsed)).not.toHaveProperty("connectionString");
    },
  );
  it("allows only the unique verify-full URL hint and strips it before pg", () => {
    const parsed = stagingDatabaseConfig({
      appEnv: "staging",
      url: `${url()}?sslmode=verify-full`,
      target: target(),
      purpose: "runtime",
    });
    expect(stagingPoolConfig(parsed).ssl).toMatchObject({
      rejectUnauthorized: true,
      servername: target().hostname,
    });
  });
  it("keeps passwords outside JSON, inspect and frozen safe metadata", () => {
    const input = target();
    const parsed = stagingDatabaseConfig({
      appEnv: "staging",
      url: url(),
      target: input,
      purpose: "runtime",
    });
    expect(JSON.stringify(parsed)).not.toContain(secret);
    expect(inspect(parsed, { showHidden: true })).not.toContain(secret);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.target.approvedPurposes)).toBe(true);
    expect(Object.isFrozen(parsed.target.operatorApproval)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    const settings = stagingPoolConfig(parsed);
    settings.host = "evil.invalid";
    expect(stagingPoolConfig(parsed).host).toBe(target().hostname);
  });
  it.each([undefined, "", "test", "development", "production", "Staging"])(
    "refuses APP_ENV=%s",
    (appEnv) => {
      refused(() =>
        stagingDatabaseConfig({
          appEnv,
          url: url(),
          target: target(),
          purpose: "runtime",
        }),
      );
    },
  );
  it.each([
    undefined,
    "",
    "not-a-url",
    "https://example.test",
    url().replace(secret, ""),
    url().replace(secret, "%00"),
    url().replace(secret, "%ZZ"),
    url().replace("learli_app", "learli_migrator"),
    url().replace("learli_staging", "learli_test"),
    url().replace(target().hostname, "127.0.0.1"),
    url().replace(target().hostname, "localhost"),
    url().replace(target().hostname, "[::1]"),
    url().replace(target().hostname, "evil.neon.tech"),
    url().replace(target().hostname, `${target().hostname}.evil.test`),
    url().replace("ep-fictional-123.", "ep-fictional-123-pooler."),
    url().replace("ep-fictional-123.", "ep-other-123."),
    url().replace(target().hostname, `${target().hostname}:6543`),
    `${url()}/`,
    `${url()}#private`,
    `${url()}?sslmode=disable`,
    `${url()}?sslmode=require`,
    `${url()}?sslmode=no-verify`,
    `${url()}?sslmode=verify-full&sslmode=verify-full`,
    `${url()}?host=evil.invalid`,
    `${url()}?sslrootcert=private.pem`,
    `${url()}?sslcert=private.pem`,
    `${url()}?sslkey=private.pem`,
    `${url()}?options=-c%20role=owner`,
    `${url()}?sslmode=verify-full&options=anything`,
    `${url()}?%73slmode=verify-full`,
    `${url()}?sslnegotiation=direct`,
    ` ${url()}`,
    `${url()}\n`,
  ])("refuses malformed/mismatched/unsafe input #%#", (value) => {
    refused(() =>
      stagingDatabaseConfig({
        appEnv: "staging",
        url: value,
        target: target(),
        purpose: "runtime",
      }),
    );
  });
  it.each([
    {},
    { ...target(), environment: "production" },
    { ...target(), provider: "other" },
    { ...target(), endpointId: "ep-other-123" },
    { ...target(), branchId: "" },
    { ...target(), projectId: "" },
    { ...target(), runtimeRole: "admin" },
    { ...target(), migrationRole: "learli_app" },
    { ...target(), migrationRole: "neon_superuser" },
    { ...target(), approvedPurposes: ["migrate"] },
    { ...target(), approvedPurposes: ["runtime", "runtime"] },
    { ...target(), database: "learli_production" },
    { ...target(), hostname: "ep-fictional-123.evil.test" },
    { ...target(), operatorApproval: undefined },
    {
      ...target(),
      operatorApproval: {
        ...target().operatorApproval,
        providerVerifiedAt: "",
      },
    },
    { ...target(), extra: "unsafe" },
  ])("requires complete strict operator attestation #%#", (record) => {
    refused(() =>
      stagingDatabaseConfig({
        appEnv: "staging",
        url: url(),
        target: record,
        purpose: "runtime",
      }),
    );
  });
  it("rejects forged config and extra TLS/settings injection", () => {
    refused(() =>
      stagingPoolConfig({
        target: target(),
        purpose: "runtime",
        role: "learli_app",
      }),
    );
    refused(() =>
      stagingDatabaseConfig({
        appEnv: "staging",
        url: url(),
        target: target(),
        purpose: "runtime",
        ssl: { rejectUnauthorized: false },
      } as Parameters<typeof stagingDatabaseConfig>[0]),
    );
  });
  it.each([
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ])("refuses process-wide TLS override %s", (name) => {
    vi.stubEnv(
      name,
      name === "NODE_TLS_REJECT_UNAUTHORIZED" ? "0" : "/private/test.pem",
    );
    refused(() => stagingPoolConfig(config()));
  });
  it("preserves existing loopback parser refusal of staging remote input", () => {
    expect(() => localDatabaseConfig(url())).toThrow("dedicated local");
    expect(() => localDatabaseConfig(url(), true)).toThrow("dedicated local");
    expect(
      localDatabaseConfig(
        "postgresql://learli_app:synthetic@127.0.0.1:55601/learli_test",
        true,
      ).ssl,
    ).toBe(false);
  });
});

// This file tests mock SQL/lifecycle semantics; native transport has actual
// PostgreSQL/proxy coverage in neon-native-tls and staging-connection suites.
vi.mock("@/lib/db/native-tls", () => ({ verifyNativeTls: vi.fn() }));

const poolState = vi.hoisted(() => ({
  options: undefined as import("pg").PoolConfig | undefined,
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  release: vi.fn(),
  query: vi.fn(),
}));
vi.mock("pg", () => ({
  Pool: class {
    constructor(options: import("pg").PoolConfig) {
      poolState.options = options;
    }
    connect = poolState.connect;
    end = poolState.end;
    on = poolState.on;
  },
}));
import { openStagingConnection } from "@/lib/db/staging-connection";

beforeEach(() => {
  vi.resetAllMocks();
  poolState.end.mockResolvedValue(undefined);
  poolState.connect.mockResolvedValue({
    query: poolState.query,
    release: poolState.release,
  });
  poolState.query.mockImplementation(async (query: string) => ({
    rows: query.includes("current_database() AS database")
      ? [
          {
            database: "learli_staging",
            current_role: "learli_app",
            session_role: "learli_app",
            ssl: true,
            replication_role: "origin",
          },
        ]
      : query.includes("pg_parameter_acl")
        ? [{ safe: true }]
        : [{ unsafe: false }],
  }));
});

describe("bounded staging lifecycle and safe errors", () => {
  it("allocates no pool for forged config", async () => {
    await expect(
      openStagingConnection({} as StagingDatabaseConfig),
    ).rejects.toMatchObject({ code: "config_invalid" });
    expect(poolState.connect).not.toHaveBeenCalled();
  });
  it("checks every checkout and closes idempotently", async () => {
    const connection = await openStagingConnection(config());
    expect(connection).not.toHaveProperty("db");
    expect(poolState.options).toMatchObject({
      max: 5,
      onConnect: expect.any(Function),
    });
    await connection.withClient(async () => 42);
    expect(poolState.query).toHaveBeenCalledTimes(6);
    expect(poolState.release).toHaveBeenNthCalledWith(1, true);
    expect(poolState.release).toHaveBeenNthCalledWith(2, true);
    await Promise.all([connection.close(), connection.close()]);
    expect(poolState.end).toHaveBeenCalledTimes(1);
    await expect(
      connection.withClient(async () => undefined),
    ).rejects.toMatchObject({ code: "connection_failed" });
  });
  it.each([
    {
      database: "wrong",
      current_role: "learli_app",
      session_role: "learli_app",
      ssl: true,
      replication_role: "origin",
    },
    {
      database: "learli_staging",
      current_role: "learli_migrator",
      session_role: "learli_app",
      ssl: true,
      replication_role: "origin",
    },
    {
      database: "learli_staging",
      current_role: "learli_app",
      session_role: "learli_migrator",
      ssl: true,
      replication_role: "origin",
    },
    {
      database: "learli_staging",
      current_role: "learli_app",
      session_role: "learli_app",
      ssl: false,
      replication_role: "replica",
    },
  ])(
    "refuses actual identity mismatch #%# and closes pool",
    async (identity) => {
      poolState.query.mockResolvedValue({ rows: [identity] });
      await expect(openStagingConnection(config())).rejects.toMatchObject({
        code: "identity_mismatch",
      });
      expect(poolState.release).toHaveBeenCalledWith(true);
      expect(poolState.end).toHaveBeenCalledTimes(1);
    },
  );
  it("refuses dangerous runtime privileges", async () => {
    poolState.query
      .mockResolvedValueOnce({
        rows: [
          {
            database: "learli_staging",
            current_role: "learli_app",
            session_role: "learli_app",
            ssl: true,
            replication_role: "origin",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ safe: true }] })
      .mockResolvedValueOnce({ rows: [{ unsafe: true }] });
    await expect(openStagingConnection(config())).rejects.toMatchObject({
      code: "runtime_privilege",
    });
    expect(poolState.end).toHaveBeenCalledOnce();
  });
  it("sanitizes connection and probe driver failures without cause", async () => {
    poolState.connect.mockRejectedValueOnce(new Error(`private ${secret}`));
    const failedConnect = openStagingConnection(config());
    await expect(failedConnect).rejects.toMatchObject({
      code: "connection_failed",
    });
    await expect(failedConnect).rejects.not.toHaveProperty("cause");
    poolState.query.mockRejectedValueOnce(new Error(`private ${secret}`));
    const failedProbe = openStagingConnection(config());
    await expect(failedProbe).rejects.toMatchObject({
      code: "connection_failed",
    });
    await expect(failedProbe).rejects.not.toHaveProperty("cause");
    expect(poolState.end).toHaveBeenCalledTimes(2);
  });
  it("always destroys callback client including failed transaction; caller owns domain errors", async () => {
    const connection = await openStagingConnection(config());
    const safeDomainError = new Error("Operator migration refused.");
    await expect(
      connection.withClient(async () => {
        throw safeDomainError;
      }),
    ).rejects.toBe(safeDomainError);
    expect(poolState.release).toHaveBeenLastCalledWith(true);
    await connection.close();
  });
  it("rechecks privileges after opening, before the next callback", async () => {
    const connection = await openStagingConnection(config());
    poolState.query
      .mockResolvedValueOnce({
        rows: [
          {
            database: "learli_staging",
            current_role: "learli_app",
            session_role: "learli_app",
            ssl: true,
            replication_role: "origin",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ safe: true }] })
      .mockResolvedValueOnce({ rows: [{ unsafe: true }] });
    const operation = vi.fn();
    await expect(connection.withClient(operation)).rejects.toMatchObject({
      code: "runtime_privilege",
    });
    expect(operation).not.toHaveBeenCalled();
    await connection.close();
  });
  it("contains idle pool errors and cleanup failures", async () => {
    const connection = await openStagingConnection(config());
    const listener = poolState.on.mock.calls[0][1];
    listener(new Error(`private ${secret}`));
    await expect(
      connection.withClient(async () => undefined),
    ).rejects.toMatchObject({ code: "connection_failed" });
    poolState.end.mockRejectedValueOnce(new Error(`private ${secret}`));
    const failedClose = connection.close();
    await expect(failedClose).rejects.toMatchObject({ code: "cleanup_failed" });
    await expect(failedClose).rejects.not.toHaveProperty("cause");
  });
});

describe("isolated staging TLS test port ownership", () => {
  it.each(["", "0", "1023", "65536", "1.5", "0xd999", "55701 ", "5e4"])(
    "refuses invalid explicit port %s",
    (value) => {
      expect(() => stagingTlsTestPort(value)).toThrow(
        "assigned staging TLS test port",
      );
    },
  );
  it("preserves assigned default and bounded coordinator override", () => {
    expect(stagingTlsTestPort(undefined)).toBe(55701);
    expect(stagingTlsTestPort("55703")).toBe(55703);
    expect(stagingTlsTestPort("1024")).toBe(1024);
    expect(stagingTlsTestPort("65535")).toBe(65535);
  });
});
