import { inspect } from "node:util";
import type { ClientBase } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  stagingDatabaseConfig,
  type StagingDatabaseConfig,
  type StagingPurpose,
} from "@/lib/db/staging-config";
import { createHostedRuntimeDatabase } from "@/lib/db/hosted-runtime";
import { verifyRuntimeLease } from "@/lib/db/hosted-runtime-validation";

// SQL authorization units isolate transport; real native TLS is covered by the
// separate owned PostgreSQL/proxy tests, never a production success flag.
vi.mock("@/lib/db/native-tls", () => ({ verifyNativeTls: vi.fn() }));

function config(purpose: StagingPurpose = "runtime") {
  const role = purpose === "runtime" ? "learli_app" : "learli_migrator";
  return stagingDatabaseConfig({
    appEnv: "staging",
    purpose,
    url: `postgresql://${role}:w2-private-unit-password@ep-fictional-123.us-east-2.aws.neon.tech/learli_staging`,
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
const identity = {
  database: "learli_staging",
  current_role: "learli_app",
  session_role: "learli_app",
  ssl: true,
  replication_role: "origin",
};
function client() {
  const query = vi.fn().mockResolvedValueOnce({ rows: [identity] });
  query.mockResolvedValue({ rows: [{ safe: true }] });
  return { query, client: { query } as unknown as ClientBase };
}
afterEach(() => vi.unstubAllEnvs());

describe("W2 opaque runtime lease boundary", () => {
  it.each(["inspect", "migrate"] as const)(
    "refuses parser-issued %s identity before allocation or verification SQL",
    async (purpose) => {
      const probe = client();
      await expect(
        createHostedRuntimeDatabase(config(purpose)),
      ).rejects.toMatchObject({
        code: "config_invalid",
      });
      await expect(
        verifyRuntimeLease(probe.client, config(purpose)),
      ).rejects.toMatchObject({
        code: "config_invalid",
      });
      expect(probe.query).not.toHaveBeenCalled();
    },
  );
  it("rejects a metadata clone without opaque registration", async () => {
    const forged = { ...config() } as StagingDatabaseConfig;
    const probe = client();
    await expect(createHostedRuntimeDatabase(forged)).rejects.toMatchObject({
      code: "config_invalid",
    });
    await expect(
      verifyRuntimeLease(probe.client, forged),
    ).rejects.toMatchObject({
      code: "config_invalid",
    });
    expect(probe.query).not.toHaveBeenCalled();
  });
  it("refuses process TLS weakening before allocating a pool", async () => {
    const parsed = config();
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
    await expect(createHostedRuntimeDatabase(parsed)).rejects.toMatchObject({
      code: "config_invalid",
    });
  });
  it("runs all three read-only lease checks", async () => {
    const probe = client();
    await verifyRuntimeLease(probe.client, config());
    expect(probe.query).toHaveBeenCalledTimes(3);
    expect(probe.query.mock.calls.map(([text]) => text).join("\n")).toMatch(
      /pg_catalog\.pg_db_role_setting/,
    );
  });
  it.each([
    { database: "other_database" },
    { current_role: "learli_migrator" },
    { session_role: "learli_migrator" },
    { replication_role: "replica" },
  ])("refuses actual mismatched identity %j", async (drift) => {
    const probe = client();
    probe.query
      .mockReset()
      .mockResolvedValue({ rows: [{ ...identity, ...drift }] });
    await expect(
      verifyRuntimeLease(probe.client, config()),
    ).rejects.toMatchObject({
      code: "identity_mismatch",
    });
    expect(probe.query).toHaveBeenCalledTimes(1);
  });
  it("accepts backend SSL false after separate actual transport validation", async () => {
    const probe = client();
    probe.query
      .mockReset()
      .mockResolvedValueOnce({ rows: [{ ...identity, ssl: false }] })
      .mockResolvedValue({ rows: [{ safe: true }] });
    await verifyRuntimeLease(probe.client, config());
    expect(probe.query).toHaveBeenCalledTimes(3);
  });
  it.each([0, 2])("refuses %s identity rows", async (count) => {
    const probe = client();
    probe.query
      .mockReset()
      .mockResolvedValue({ rows: Array(count).fill(identity) });
    await expect(
      verifyRuntimeLease(probe.client, config()),
    ).rejects.toMatchObject({
      code: "identity_mismatch",
    });
  });
  it.each([2, 3])(
    "refuses unsafe privilege result in check %s",
    async (check) => {
      const probe = client();
      probe.query.mockReset();
      probe.query.mockResolvedValueOnce({ rows: [identity] });
      if (check === 3)
        probe.query.mockResolvedValueOnce({ rows: [{ safe: true }] });
      probe.query.mockResolvedValue({ rows: [{ safe: false }] });
      await expect(
        verifyRuntimeLease(probe.client, config()),
      ).rejects.toMatchObject({
        code: "runtime_privilege",
      });
      expect(probe.query).toHaveBeenCalledTimes(check);
    },
  );
  it("drops raw driver causes, messages and DSN/password from validation errors", async () => {
    const probe = client();
    probe.query
      .mockReset()
      .mockRejectedValue(
        new Error(
          "postgresql://learli_app:w2-private-unit-password@private.invalid/db",
        ),
      );
    const error = await verifyRuntimeLease(probe.client, config()).catch(
      (failure: unknown) => failure,
    );
    expect(error).toMatchObject({ code: "connection_failed" });
    expect(error).not.toHaveProperty("cause");
    expect(inspect(error)).not.toMatch(
      /w2-private-unit-password|private\.invalid|postgresql:/,
    );
  });
});
