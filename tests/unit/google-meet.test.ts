import { afterEach, describe, expect, it, vi } from "vitest";
import { googleMeetConfig } from "@/features/google-meet/config";
import {
  encryptSecret,
  decryptSecret,
  tokenContext,
} from "@/features/google-meet/crypto";
import {
  googleMeetProvider,
  validateMeetReceipt,
} from "@/features/google-meet/provider";
import { testMeetConfig } from "../support/google-meet";
afterEach(() => vi.unstubAllGlobals());
describe("optional Google Meet connector", () => {
  it("defaults off without inspecting secrets; refuses unsafe enabled environments", () => {
    expect(googleMeetConfig({})).toBeNull();
    for (const source of [
      { GOOGLE_MEET_ENABLED: "true", APP_ENV: "production" },
      { GOOGLE_MEET_ENABLED: "maybe" },
      { GOOGLE_MEET_ENABLED: "true", APP_ENV: "test" },
    ])
      expect(() => googleMeetConfig(source)).toThrow("Values omitted");
  });
  it("authenticates owner, subject, environment and purpose with randomized encrypted envelopes", () => {
    const config = testMeetConfig(),
      aad = tokenContext("connection", "owner", "subject", config.fingerprint);
    const one = encryptSecret(config, "private-test-value", aad),
      two = encryptSecret(config, "private-test-value", aad);
    expect(one).not.toBe(two);
    expect(one).not.toContain("private-test-value");
    expect(decryptSecret(config, one, aad)).toBe("private-test-value");
    for (const wrong of [
      aad + "other",
      tokenContext("connection", "other", "subject", config.fingerprint),
      tokenContext("connection", "owner", "other", config.fingerprint),
    ])
      expect(() => decryptSecret(config, one, wrong)).toThrow(
        "Details omitted",
      );
    expect(() => decryptSecret(config, one.slice(0, -2) + "xx", aad)).toThrow();
    expect(() => decryptSecret({ ...config, keys: {} }, one, aad)).toThrow();
    const rotated = {
      ...config,
      activeKeyId: "new",
      keys: { ...config.keys, new: "b".repeat(64) },
    };
    expect(decryptSecret(rotated, one, aad)).toBe("private-test-value");
    expect(encryptSecret(rotated, "new-value", aad)).toMatch(/^new\./);
  });
  it("requests only the approved scopes with offline consent, state, nonce and S256", () => {
    const url = new URL(
      googleMeetProvider(testMeetConfig()).authorize(
        "bound-state",
        "bound-nonce",
        "challenge",
      ),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/meetings.space.created",
    ]);
    expect(
      Object.fromEntries(
        ["state", "nonce", "access_type", "code_challenge_method"].map(
          (key) => [key, url.searchParams.get(key)],
        ),
      ),
    ).toEqual({
      state: "bound-state",
      nonce: "bound-nonce",
      access_type: "offline",
      code_challenge_method: "S256",
    });
  });
  it("requires a validated Google URI and effective restricted access", () => {
    expect(
      validateMeetReceipt({
        name: "spaces/abc",
        meetingUri: "https://meet.google.com/aaa-bbbb-ccc",
        config: { accessType: "RESTRICTED" },
      }),
    ).toEqual({
      name: "spaces/abc",
      uri: "https://meet.google.com/aaa-bbbb-ccc",
    });
    for (const patch of [
      { meetingUri: "https://meet.google.com.evil.test/aaa-bbbb-ccc" },
      { config: { accessType: "OPEN" } },
      { name: "spaces/../other" },
      { meetingUri: "https://meet.google.com/aaa-bbbb-ccc?secret=x" },
    ])
      expect(() =>
        validateMeetReceipt({
          name: "spaces/abc",
          meetingUri: "https://meet.google.com/aaa-bbbb-ccc",
          config: { accessType: "RESTRICTED" },
          ...patch,
        }),
      ).toThrow();
  });
  it.each([500, 502, 503, 504, 302])(
    "never transparently retries an ambiguous create HTTP %s",
    async (status) => {
      const send = vi
        .fn()
        .mockResolvedValue(new Response("private-provider-body", { status }));
      vi.stubGlobal("fetch", send);
      await expect(
        googleMeetProvider(testMeetConfig()).createSpace("synthetic-access"),
      ).rejects.toMatchObject({ code: "uncertain" });
      expect(send).toHaveBeenCalledTimes(1);
    },
  );
  it("uses no booking or learner data in a create request and handles rate rejection separately", async () => {
    const send = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", send);
    await expect(
      googleMeetProvider(testMeetConfig()).createSpace("synthetic-access"),
    ).rejects.toMatchObject({ code: "rate_limited" });
    const [url, options] = send.mock.calls[0];
    expect(url).toBe("https://meet.googleapis.com/v2/spaces");
    expect(JSON.parse(options.body)).toEqual({
      config: { accessType: "RESTRICTED", entryPointAccess: "ALL" },
    });
    expect(options.redirect).toBe("error");
  });
  it("maps transport loss and malformed successful responses to uncertainty without replay", async () => {
    for (const send of [
      vi.fn().mockRejectedValue(new Error("private-token")),
      vi.fn().mockResolvedValue(new Response("invalid")),
    ]) {
      vi.stubGlobal("fetch", send);
      await expect(
        googleMeetProvider(testMeetConfig()).createSpace("synthetic-access"),
      ).rejects.toMatchObject({ code: "uncertain" });
      expect(send).toHaveBeenCalledTimes(1);
    }
  });
});

// Keep the real role boundary in configuration; no fake application DB identity.
import { googleMeetWorkerConfig } from "@/features/google-meet/config";
import { googleMeetChildEnvironments } from "@/features/google-meet/process-env";
import {
  assertGoogleMeetDatabasePair,
  createGoogleMeetWorkerDatabase,
} from "@/features/google-meet/worker-database";
it("separates process credentials and validates the real worker identity", async () => {
  const source = {
    PATH: process.env.PATH,
    GOOGLE_MEET_ENABLED: "true",
    APP_ENV: "development",
    APP_URL: "http://127.0.0.1:3100",
    AUTH_MODE: "local",
    DATABASE_MODE: "local",
    LOCAL_WORKFLOW_MODE: "enabled",
    GOOGLE_MEET_CLIENT_ID: "synthetic.apps.googleusercontent.com",
    GOOGLE_MEET_CLIENT_SECRET: "synthetic-client-secret",
    GOOGLE_MEET_REDIRECT_URI:
      "http://127.0.0.1:3100/api/tutor/meeting-providers/google/callback",
    GOOGLE_MEET_KEY_ID: "test",
    GOOGLE_MEET_KEYS: JSON.stringify({ test: "a".repeat(64) }),
    GOOGLE_MEET_WORKER_DATABASE_URL:
      "postgresql://learli_meet_worker:synthetic@127.0.0.1:55432/learli_dev",
    DATABASE_URL: "application-credential",
    BETTER_AUTH_SECRET: "application-secret",
    UNRELATED_SECRET: "keep-private",
  };
  const { web, worker } = googleMeetChildEnvironments(source);
  expect(web.GOOGLE_MEET_WORKER_DATABASE_URL).toBe("");
  expect(worker).not.toHaveProperty("DATABASE_URL");
  expect(worker).not.toHaveProperty("BETTER_AUTH_SECRET");
  expect(worker).not.toHaveProperty("UNRELATED_SECRET");
  expect(googleMeetWorkerConfig(worker).fingerprint).toBe(
    testMeetConfig().fingerprint,
  );
  expect(() =>
    googleMeetWorkerConfig({
      ...worker,
      DATABASE_URL: "application-credential",
    }),
  ).toThrow("Values omitted");
  await expect(
    createGoogleMeetWorkerDatabase(
      "postgresql://learli_owner:synthetic@127.0.0.1:55432/learli_dev",
    ),
  ).rejects.toThrow("Dedicated local meeting worker identity required");
});

it("rejects a worker target on a different local cluster before any connection", () => {
  const app = "postgresql://learli_app:synthetic@127.0.0.1:55432/learli_dev",
    worker =
      "postgresql://learli_meet_worker:synthetic@127.0.0.1:55432/learli_dev";
  expect(() => assertGoogleMeetDatabasePair(app, worker)).not.toThrow();
  expect(() =>
    assertGoogleMeetDatabasePair(app, worker.replace("55432", "55433")),
  ).toThrow("same isolated local target");
});
