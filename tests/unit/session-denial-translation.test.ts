import { APIError } from "better-auth/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { requireIdentity } from "@/lib/permissions/access";

vi.mock("server-only", () => ({}));

function deniedRuntime(error: Error) {
  const getSession = vi.fn(async () => {
    throw error;
  });
  const select = vi.fn();
  return {
    runtime: {
      origin: "http://127.0.0.1:3100",
      environment: "test",
      auth: { api: { getSession } },
      db: { select },
    } as unknown as AuthRuntime,
    select,
  };
}

async function request(runtime: AuthRuntime) {
  const incoming = new Request(`${runtime.origin}/api/learners`, {
    method: "POST",
    headers: { origin: runtime.origin, "content-type": "application/json" },
    body: "{}",
  });
  return handleJsonMutation(
    runtime,
    incoming,
    { method: "POST", invalid: () => ({ message: "Invalid input." }) },
    async () => requireIdentity(runtime, incoming.headers),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("provider session denial at the ordinary JSON boundary", () => {
  it.each([
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
  ] as const)(
    "preserves the provider %s denial before private-data queries",
    async (code, status) => {
      const { runtime, select } = deniedRuntime(new APIError(code));
      expect((await request(runtime)).status).toBe(status);
      expect(select).not.toHaveBeenCalled();
    },
  );

  it("keeps an unrelated provider failure unavailable and private", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { runtime, select } = deniedRuntime(
      new Error("Private provider failure detail"),
    );
    const response = await request(runtime);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: "This service is unavailable. Try again later.",
    });
    expect(select).not.toHaveBeenCalled();
  });
});
