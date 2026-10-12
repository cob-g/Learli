import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";

const runtime = { origin: "http://127.0.0.1:3164" } as AuthRuntime;
const options = {
  method: "POST" as const,
  invalid: () => ({ message: "Check the permitted fields." }),
};
const sensitive = [
  "synthetic-secret-token",
  "synthetic-identity-id",
  "fictional@learli.test",
  "postgresql://synthetic:password@127.0.0.1:55504/learli_test",
  "https://meet.google.com/synthetic-private?token=synthetic",
  "SELECT synthetic_private_payload",
];
function request(patch: RequestInit = {}) {
  return new Request(`${runtime.origin}/api/synthetic?private=synthetic`, {
    method: "POST",
    headers: {
      origin: runtime.origin,
      "content-type": "application/json",
      "x-correlation-id": sensitive[0],
      cookie: `synthetic=${sensitive[0]}`,
      authorization: `Bearer ${sensitive[0]}`,
    },
    body: JSON.stringify({ privatePayload: sensitive.join(" ") }),
    ...patch,
  });
}
function safeEvent(log: ReturnType<typeof vi.spyOn>, category: string) {
  expect(log.mock.calls.length).toBe(1);
  expect(log.mock.calls[0].length).toBe(1);
  const output = log.mock.calls[0][0] as string;
  const record = JSON.parse(output);
  expect(Object.keys(record).sort()).toEqual(["correlationId", "event"]);
  expect(record.event).toBe(category);
  expect(sensitive.some((value) => output.includes(value))).toBe(false);
}
afterEach(() => vi.restoreAllMocks());

describe("mutation diagnostics preserve the private response boundary", () => {
  it("never emits a malicious error, cause, stack or request context", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const inspect = vi.fn(() => {
      throw new Error("Forbidden synthetic inspection");
    });
    const error = new Error(sensitive.join(" "), { cause: sensitive });
    Object.defineProperties(error, {
      stack: { get: inspect },
      toJSON: { value: inspect },
    });
    const response = await handleJsonMutation(
      runtime,
      request(),
      options,
      async () => {
        throw error;
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: "This service is unavailable. Try again later.",
    });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.has("x-correlation-id")).toBe(false);
    expect(inspect).not.toHaveBeenCalled();
    safeEvent(log, "mutation.failed");
  });

  it.each([null, "Synthetic thrown string", 42, { message: sensitive[0] }])(
    "safely translates non-Error throws (%#)",
    async (error) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await handleJsonMutation(
        runtime,
        request(),
        options,
        async () => {
          throw error;
        },
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        message: "This service is unavailable. Try again later.",
      });
      safeEvent(log, "mutation.failed");
    },
  );

  it.each([
    new AccessError(401),
    new AccessError(403),
    new AccessError(404),
    new RuleError(409, "Choose another time."),
    new RuleError(429, "Try later."),
  ])("keeps expected refusals quiet and unchanged (%#)", async (error) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleJsonMutation(
      runtime,
      request(),
      options,
      async () => {
        throw error;
      },
    );
    expect(response.status).toBe(error.status);
    expect(await response.json()).toEqual({ message: error.message });
    expect(log).not.toHaveBeenCalled();
  });

  it("keeps Zod projection, success and malformed-body guards unchanged and quiet", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const invalid = await handleJsonMutation(
      runtime,
      request(),
      options,
      async () => z.object({ allowed: z.string() }).parse({}),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual(options.invalid());
    const run = vi.fn(async () => ({ saved: true }));
    const success = await handleJsonMutation(runtime, request(), options, run);
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ saved: true });
    for (const [patch, status] of [
      [{ body: "{" }, 400],
      [{ method: "PUT" }, 405],
      [{ headers: { origin: "http://attacker.test" } }, 403],
    ] as const) {
      run.mockClear();
      expect(
        (await handleJsonMutation(runtime, request(patch), options, run))
          .status,
      ).toBe(status);
      expect(run).not.toHaveBeenCalled();
    }
    expect(log).not.toHaveBeenCalled();
  });

  it("signals missing runtime and known availability while preserving their distinct503 messages", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => ({}));
    const missing = await handleJsonMutation(null, request(), options, run);
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({
      message: "This service is unavailable.",
    });
    expect(run).not.toHaveBeenCalled();
    safeEvent(log, "mutation.unavailable");
    log.mockClear();
    const unavailable = await handleJsonMutation(
      runtime,
      request(),
      options,
      async () => {
        throw new AccessError(503);
      },
    );
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      message: "Account service is unavailable. Try again later.",
    });
    safeEvent(log, "mutation.unavailable");
  });

  it("keeps unknown error translation safe when console output fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error(sensitive[0]);
    });
    const response = await handleJsonMutation(
      runtime,
      request(),
      options,
      async () => {
        throw new Error(sensitive[0]);
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: "This service is unavailable. Try again later.",
    });
  });
});
