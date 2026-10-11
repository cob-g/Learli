import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env/schema";

describe("server environment safety", () => {
  it("allows the public foundation without integration credentials", () => {
    expect(parseServerEnv({})).toEqual({
      APP_ENV: "development",
      AUTH_MODE: "disabled",
      APP_URL: "http://localhost:3000",
    });
    expect(
      parseServerEnv({
        DATABASE_URL: "",
        BETTER_AUTH_SECRET: "",
        RESEND_API_KEY: "",
      }).DATABASE_URL,
    ).toBeUndefined();
  });

  it.each([
    "APP_URL",
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "EMAIL_FROM",
  ])("rejects invalid %s without revealing its value", (field) => {
    const marker = "PRIVATE_TEST_VALUE";
    let message = "";
    try {
      parseServerEnv({ [field]: marker });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(field);
    expect(message).not.toContain(marker);
  });

  it("rejects database URLs with the wrong protocol", () => {
    expect(() =>
      parseServerEnv({ DATABASE_URL: "https://example.com" }),
    ).toThrow("DATABASE_URL");
  });

  it("requires secure configured origins for staging and production", () => {
    expect(() => parseServerEnv({ APP_ENV: "production" })).toThrow("APP_URL");
    expect(() =>
      parseServerEnv({
        APP_ENV: "staging",
        APP_URL: "https://example.com",
        BETTER_AUTH_URL: "http://example.com",
      }),
    ).toThrow("BETTER_AUTH_URL");
    expect(
      parseServerEnv({ APP_ENV: "production", APP_URL: "https://example.com" })
        .APP_ENV,
    ).toBe("production");
  });

  it.each(["staging", "production"])(
    "redacts malformed origins in %s",
    (environment) => {
      for (const field of ["APP_URL", "BETTER_AUTH_URL"]) {
        expect(() =>
          parseServerEnv({
            APP_ENV: environment,
            APP_URL: "https://example.com",
            [field]: "PRIVATE_TEST_VALUE",
          }),
        ).toThrow(`Invalid server configuration: ${field}. Values omitted.`);
      }
    },
  );

  it("does not copy unknown environment values into the parsed configuration", () => {
    expect(parseServerEnv({ UNRELATED_SECRET: "private" })).not.toHaveProperty(
      "UNRELATED_SECRET",
    );
  });
});
