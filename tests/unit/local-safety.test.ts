import { describe, expect, it } from "vitest";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { parseServerEnv } from "@/lib/env/schema";
import { safeReturnPath } from "@/lib/permissions/return-path";

const local = "postgresql://learli_app:synthetic@127.0.0.1:55432/learli_test";
describe("local database isolation", () => {
  it("accepts only designated local databases and makes pool settings explicit", () => {
    expect(localDatabaseConfig(local, true)).toMatchObject({
      host: "127.0.0.1",
      database: "learli_test",
      ssl: false,
      max: 5,
    });
  });
  it.each([
    local.replace("127.0.0.1", "remote.example"),
    local.replace("learli_test", "production"),
    `${local}?host=remote.example`,
    `${local}#anything`,
    "postgresql://127.0.0.1/learli_test",
    local.replace("learli_test", "learli_dev"),
  ])("rejects unsafe test targets without leaking credentials", (url) => {
    expect(() => localDatabaseConfig(url, true)).toThrow(
      "Connection values omitted",
    );
    try {
      localDatabaseConfig(url, true);
    } catch (error) {
      expect(String(error)).not.toContain("synthetic");
    }
  });
  it("requires local origins, app credentials and a test database in test mode", () => {
    const config = {
      AUTH_MODE: "local",
      APP_ENV: "test",
      APP_URL: "http://127.0.0.1:3100",
      DATABASE_URL: local,
      BETTER_AUTH_SECRET: "synthetic-test-secret-that-is-long-enough",
    };
    expect(parseServerEnv(config).AUTH_MODE).toBe("local");
    for (const patch of [
      { APP_ENV: "production" },
      { APP_URL: "https://remote.example" },
      { DATABASE_URL: local.replace("learli_test", "learli_dev") },
      { DATABASE_URL: local.replace("learli_app", "learli_owner") },
      { BETTER_AUTH_URL: "http://localhost:3000" },
    ]) {
      expect(() => parseServerEnv({ ...config, ...patch })).toThrow(
        "Invalid server configuration",
      );
    }
  });
});
describe("authentication return paths", () => {
  it("preserves local selection parameters", () => {
    expect(safeReturnPath("/tutors?subject=math&slot=example#times")).toBe(
      "/tutors?subject=math&slot=example#times",
    );
  });
  it.each([
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/%2fexample.com",
    "/%5cexample.com",
    "/%0dLocation:evil",
    "/sign-in",
    "/api/auth/sign-out",
    "javascript:alert(1)",
    "/bad%zz",
    "",
  ])("rejects unsafe or looping redirects", (url) => {
    expect(safeReturnPath(url)).toBe("/account");
  });
});
