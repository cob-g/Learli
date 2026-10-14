import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import {
  neonOperationConfig,
  neonOperationPoolConfig,
} from "@/lib/db/neon-operation-config";
import { inspectNeonConfiguration } from "../../scripts/neon-database";

import { operationTarget } from "../support/neon-operation-target";

const url = (role = "learli_app") =>
  `postgresql://${role}:fictional-private-password@ep-fictional.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require`;
describe("truthful Neon operational configuration", () => {
  it("constructs exact explicit TLS options without URL/env fallback", () => {
    const config = neonOperationConfig({
      appEnv: "development",
      target: operationTarget(),
      url: url(),
      purpose: "runtime",
    });
    expect(neonOperationPoolConfig(config)).toMatchObject({
      user: "learli_app",
      database: "neondb",
      enableChannelBinding: true,
      ssl: {
        rejectUnauthorized: true,
        servername: "ep-fictional.ap-southeast-1.aws.neon.tech",
      },
    });
    expect(neonOperationPoolConfig(config)).not.toHaveProperty(
      "connectionString",
    );
    expect(() => neonOperationPoolConfig({ ...config })).toThrow(/omitted/);
  });
  it("keeps idle connections longer for the development runtime only", () => {
    const idle = (
      appEnv: "development" | "production",
      purpose: "runtime" | "inspect-runtime" | "inspect" | "migrate",
    ) =>
      neonOperationPoolConfig(
        neonOperationConfig({
          appEnv,
          target: operationTarget(appEnv),
          url: url(
            ["runtime", "inspect-runtime"].includes(purpose)
              ? "learli_app"
              : "learli_migrator",
          ),
          purpose,
        }),
      ).idleTimeoutMillis;
    expect(idle("development", "runtime")).toBe(240_000);
    expect(idle("development", "inspect")).toBe(10_000);
    expect(idle("development", "migrate")).toBe(10_000);
    expect(idle("production", "inspect-runtime")).toBe(10_000);
    expect(idle("production", "migrate")).toBe(10_000);
  });
  it("permits production metadata inspection but forbids production runtime", () => {
    const target = operationTarget("production");
    expect(
      neonOperationConfig({
        appEnv: "production",
        target,
        url: url(),
        purpose: "inspect-runtime",
      }).role,
    ).toBe("learli_app");
    expect(() =>
      neonOperationConfig({
        appEnv: "production",
        target,
        url: url(),
        purpose: "runtime",
      }),
    ).toThrow(/omitted/);
    expect(() =>
      neonOperationConfig({
        appEnv: "development",
        target,
        url: url(),
        purpose: "runtime",
      }),
    ).toThrow(/omitted/);
  });
  it.each([
    "sslmode=require",
    "sslmode=disable",
    "sslmode=verify-full&sslmode=verify-full",
    "sslmode=verify-full&host=evil.invalid",
    "sslmode=verify-full&channel_binding=disable",
  ])("refuses unsafe URL query %s", (query) => {
    expect(() =>
      neonOperationConfig({
        appEnv: "development",
        target: operationTarget(),
        url: url().split("?")[0] + "?" + query,
        purpose: "runtime",
      }),
    ).toThrow(/omitted/);
  });
  it.each([
    { database: "learli_test" },
    { environment: "staging" },
    { hostname: "ep-fictional-pooler.ap-southeast-1.aws.neon.tech" },
    { runtimeRole: "neondb_owner" },
    { migrationRole: "learli_app" },
  ])("rejects host/role/environment/ownership substitution %j", (change) => {
    expect(() =>
      neonOperationConfig({
        appEnv: "development",
        target: { ...operationTarget(), ...change },
        url: url(),
        purpose: "runtime",
      }),
    ).toThrow(/omitted/);
  });
  it("binds production inspect plan to exact migration identity and target", () => {
    const value = inspectNeonConfiguration(
      {
        APP_ENV: "production",
        NEON_RUNTIME_INSPECTION_URL: url(),
        NEON_MIGRATION_URL: url("learli_migrator"),
      },
      operationTarget("production"),
      "inspect",
    );
    expect(value.identity.environment).toBe("production");
    expect(value.runtime.purpose).toBe("inspect-runtime");
    expect(inspect(value.summary)).not.toMatch(
      /fictional-private-password|postgresql:/,
    );
    expect(() =>
      inspectNeonConfiguration(
        {
          APP_ENV: "production",
          NEON_RUNTIME_INSPECTION_URL: url("neondb_owner"),
          NEON_MIGRATION_URL: url("learli_migrator"),
        },
        operationTarget("production"),
        "inspect",
      ),
    ).toThrow();
  });
});
