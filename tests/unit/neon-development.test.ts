import { mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env/schema";
import { localDatabaseConfig } from "@/lib/db/local-config";
import {
  createNeonDevelopmentAuth,
  loadNeonDevelopmentConfig,
} from "@/lib/db/neon-development";
import { operationTarget } from "../support/neon-operation-target";

vi.mock("server-only", () => ({}));

const directory = path.join(process.cwd(), ".local", "neon-development-units");
const file = path.join(directory, "runtime.json");
const env = () => ({
  APP_ENV: "development",
  AUTH_MODE: "local",
  DATABASE_MODE: "neon-development",
  NEON_DEVELOPMENT_CONFIG_FILE: file,
  APP_URL: "http://127.0.0.1:3039",
  BETTER_AUTH_URL: "http://127.0.0.1:3039",
  BETTER_AUTH_SECRET: "fictional-local-secret-at-least-32-characters",
});
const packet = () => ({
  version: 1,
  purpose: "local-neon-development",
  realWorkflows: "disabled",
  databaseUrl:
    "postgresql://learli_app:fictional-private-password@ep-fictional.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full",
  target: operationTarget(),
});
beforeEach(() => {
  mkdirSync(directory, { mode: 0o700 });
  writeFileSync(file, JSON.stringify(packet()), { mode: 0o600 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of [
    "learliNeonDevelopmentAuth",
    "learliDevelopmentFingerprint",
    "learliDatabaseMode",
    "learliCloseAccountAuth",
  ])
    Reflect.deleteProperty(globalThis, key);
  rmSync(directory, { recursive: true });
});
describe("explicit local Neon development seam", () => {
  it("allocates existing synthetic auth without unchecked network and no owner credential", async () => {
    const config = loadNeonDevelopmentConfig(env());
    const runtime = createNeonDevelopmentAuth(config);
    expect(runtime.environment).toBe("development");
    expect(runtime.origin).toBe(env().APP_URL);
    expect(runtime.pool.totalCount).toBe(0);
    expect(runtime).not.toHaveProperty("hosted");
    expect(runtime.pool).not.toHaveProperty("options");
    expect(() => createNeonDevelopmentAuth({ ...config })).toThrow(/omitted/);
    await runtime.close();
  });
  it.each([
    { APP_ENV: "production" },
    { APP_ENV: "test" },
    { APP_ENV: "staging" },
    { AUTH_MODE: "disabled" },
    { APP_URL: "https://example.test" },
    {
      DATABASE_URL: "postgresql://learli_app:secret@127.0.0.1:55939/learli_dev",
    },
    {
      DATABASE_URL_DIRECT:
        "postgresql://learli_owner:secret@127.0.0.1:55939/learli_dev",
    },
    { RESEND_API_KEY: "fictional-key" },
  ])(
    "refuses activation outside exact local synthetic development %j",
    (change) => {
      expect(() => loadNeonDevelopmentConfig({ ...env(), ...change })).toThrow(
        /configuration/,
      );
    },
  );
  it("preserves strict existing loopback test parser and default mode", () => {
    expect(parseServerEnv({}).DATABASE_MODE).toBe("local");
    expect(() => localDatabaseConfig(packet().databaseUrl, true)).toThrow(
      /local/,
    );
    expect(() => parseServerEnv({ ...env(), DATABASE_MODE: "local" })).toThrow(
      /configuration/,
    );
  });
  it("rejects owner URL and extra credential in runtime packet", () => {
    writeFileSync(
      file,
      JSON.stringify({ ...packet(), migrationUrl: "private" }),
      { mode: 0o600 },
    );
    expect(() => loadNeonDevelopmentConfig(env())).toThrow(/omitted/);
    writeFileSync(
      file,
      JSON.stringify({
        ...packet(),
        databaseUrl: packet().databaseUrl.replace("learli_app", "neondb_owner"),
      }),
      { mode: 0o600 },
    );
    expect(() => loadNeonDevelopmentConfig(env())).toThrow(/omitted/);
  });
  it("refuses production target and symlink packet before allocation", () => {
    writeFileSync(
      file,
      JSON.stringify({ ...packet(), target: operationTarget("production") }),
      { mode: 0o600 },
    );
    expect(() => loadNeonDevelopmentConfig(env())).toThrow(/omitted/);
    const linked = path.join(directory, "linked.json");
    symlinkSync(file, linked);
    expect(() =>
      loadNeonDevelopmentConfig({
        ...env(),
        NEON_DEVELOPMENT_CONFIG_FILE: linked,
      }),
    ).toThrow(/omitted/);
  });
  it("refuses live mode and private packet fingerprint drift instead of stale runtime fallback", async () => {
    for (const [key, value] of Object.entries(env())) vi.stubEnv(key, value);
    for (const key of [
      "DATABASE_URL",
      "DATABASE_URL_DIRECT",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "HOSTED_AUTH_CONFIG_FILE",
      "HOSTED_INGRESS_SECRET",
    ])
      vi.stubEnv(key, undefined);
    const { getAuthRuntime } = await import("@/lib/auth");
    const runtime = getAuthRuntime();
    expect(runtime).not.toBeNull();
    try {
      writeFileSync(
        file,
        JSON.stringify({
          ...packet(),
          databaseUrl: packet().databaseUrl.replace(
            "fictional-private-password",
            "changed-private-password",
          ),
        }),
        { mode: 0o600 },
      );
      expect(() => getAuthRuntime()).toThrow(/configuration/);
      vi.stubEnv("DATABASE_MODE", "local");
      vi.stubEnv("NEON_DEVELOPMENT_CONFIG_FILE", undefined);
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://learli_app:synthetic@127.0.0.1:55939/learli_dev",
      );
      expect(() => getAuthRuntime()).toThrow(/configuration/);
    } finally {
      if (runtime && "close" in runtime) await runtime.close();
    }
  });
});
