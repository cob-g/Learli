import { describe, expect, it } from "vitest";
import {
  backupEmptyNeonTarget,
  recoveryToolEnvironment,
  restoreEmptyNeonBackup,
} from "../../scripts/neon-recovery";
import {
  neonOperationConfig,
  type NeonOperationConfig,
} from "@/lib/db/neon-operation-config";
import { operationTarget } from "../support/neon-operation-target";

function operation(
  environment: "production" | "development",
  purpose: "bootstrap" | "inspect" = "bootstrap",
) {
  const target = operationTarget(environment),
    role = purpose === "bootstrap" ? "neondb_owner" : "learli_migrator";
  return neonOperationConfig({
    appEnv: environment,
    target,
    purpose,
    url: `postgresql://${role}:private-fixture-only@${target.hostname}/neondb?sslmode=verify-full`,
  });
}
describe("bounded empty-target Neon recovery boundary", () => {
  it("passes credentials only through explicit private libpq env with authenticated TLS", () => {
    const env = recoveryToolEnvironment(operation("production"));
    expect(env).toMatchObject({
      PGUSER: "neondb_owner",
      PGPASSWORD: "private-fixture-only",
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: "system",
      PGCHANNELBINDING: "require",
      PGPORT: "5432",
    });
    expect(Object.keys(env).sort()).toEqual(
      [
        "NODE_ENV",
        "PATH",
        "LANG",
        "LC_ALL",
        "PGHOST",
        "PGPORT",
        "PGDATABASE",
        "PGUSER",
        "PGPASSWORD",
        "PGSSLMODE",
        "PGSSLROOTCERT",
        "PGCHANNELBINDING",
        "PGCONNECT_TIMEOUT",
        "PGAPPNAME",
      ].sort(),
    );
    expect(env).not.toHaveProperty("PGOPTIONS");
    expect(env).not.toHaveProperty("DATABASE_URL");
  });
  it("rejects forged/cloned config before tool allocation or networking", () => {
    const valid = operation("production");
    expect(() => recoveryToolEnvironment({ ...valid })).toThrow();
    expect(() => recoveryToolEnvironment({} as NeonOperationConfig)).toThrow();
  });
  it("refuses migration/runtime credentials for recovery", () => {
    expect(() =>
      recoveryToolEnvironment(operation("production", "inspect")),
    ).toThrow();
  });
  it("refuses any production restore destination before filesystem/network operations", async () => {
    await expect(
      restoreEmptyNeonBackup(
        operation("production"),
        operation("production"),
        "never-created",
        "never-created",
      ),
    ).rejects.toMatchObject({ category: "config_invalid" });
  });
  it("refuses non-production backup before filesystem/network operations", async () => {
    await expect(
      backupEmptyNeonTarget(operation("development"), "never-created"),
    ).rejects.toMatchObject({ category: "config_invalid" });
  });
  it("refuses an unrelated development source branch before filesystem/network operations", async () => {
    const target = operationTarget("development");
    target.operatorApproval.sourceBranchId = "br-other-production";
    const config = neonOperationConfig({
      appEnv: "development",
      target,
      purpose: "bootstrap",
      url: `postgresql://neondb_owner:private-fixture-only@${target.hostname}/neondb?sslmode=verify-full`,
    });
    await expect(
      restoreEmptyNeonBackup(
        config,
        operation("production"),
        "never-created",
        "never-created",
      ),
    ).rejects.toMatchObject({ category: "config_invalid" });
  });
});
