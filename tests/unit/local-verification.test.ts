import { describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env/schema";
import { validateLocalWorkflowBinding } from "@/features/local-workflow/runtime";
import { localVerificationMail } from "@/lib/email/local-verification";

vi.mock("server-only", () => ({}));
const source = {
  APP_ENV: "development",
  AUTH_MODE: "local",
  DATABASE_MODE: "local",
  LOCAL_WORKFLOW_MODE: "enabled",
  APP_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "postgresql://learli_app:test-only@127.0.0.1:55499/learli_dev",
  BETTER_AUTH_SECRET: "local-test-secret-at-least-32-characters",
};
const pool = {
  options: {
    host: "127.0.0.1",
    port: 55499,
    database: "learli_dev",
    user: "learli_app",
  },
};
const config = {
  key: "re_abcdefgh1234",
  recipient: "owner@example.com",
};
const verification = {
  kind: "verification" as const,
  to: config.recipient,
  url: "http://127.0.0.1:3000/api/auth/verify-email?token=abcdefghijklmnop&callbackURL=%2Fsign-in",
};

describe("local verification delivery", () => {
  it("requires both settings and the ordinary local workflow", () => {
    expect(() =>
      parseServerEnv({ ...source, LOCAL_VERIFICATION_RESEND_KEY: config.key }),
    ).toThrow();
    expect(() =>
      parseServerEnv({
        ...source,
        LOCAL_VERIFICATION_RESEND_KEY: config.key,
        LOCAL_VERIFICATION_RECIPIENT: config.recipient,
        LOCAL_WORKFLOW_MODE: "disabled",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnv({
        ...source,
        LOCAL_VERIFICATION_RESEND_KEY: config.key,
        LOCAL_VERIFICATION_RECIPIENT: config.recipient,
      }),
    ).not.toThrow();
  });
  it("sends only a valid verification for the exact recipient", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "00000000-0000-4000-8000-000000000000" }),
          { status: 200 },
        ),
    );
    const send = localVerificationMail(
      validateLocalWorkflowBinding(source, pool)!,
      config,
      request,
    );
    await send(verification);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "Learli <onboarding@resend.dev>",
      to: [config.recipient],
    });
    await expect(
      send({ ...verification, to: "other@example.com" }),
    ).rejects.toThrow();
    await expect(send({ ...verification, kind: "reset" })).rejects.toThrow();
    await expect(
      send({
        ...verification,
        url: verification.url.replace("127.0.0.1", "example.com"),
      }),
    ).rejects.toThrow();
    await expect(
      send({ ...verification, url: verification.url + "&token=duplicate" }),
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("hides provider failures", async () => {
    const send = localVerificationMail(
      validateLocalWorkflowBinding(source, pool)!,
      config,
      vi.fn(async () => {
        throw new Error("private provider detail");
      }),
    );
    await expect(send(verification)).rejects.toThrow(
      "Account message request could not be completed.",
    );
  });
  it("enforces one configured mailbox without substituting recipients", async () => {
    const request = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ id: "00000000-0000-4000-8000-000000000000" }),
          { status: 200 },
        ),
    );
    const send = localVerificationMail(
      validateLocalWorkflowBinding(source, pool)!,
      { ...config, recipient: "different@example.com" },
      request,
    );
    await expect(send(verification)).rejects.toThrow();
    await send({ ...verification, to: "different@example.com" });
    expect(JSON.parse(request.mock.calls[0]![1]!.body as string).to).toEqual([
      "different@example.com",
    ]);
  });
  it.each(["fetch", "body"])(
    "times out a stalled %s without exposing details",
    async (stall) => {
      vi.useFakeTimers();
      try {
        const request = vi.fn(() =>
          stall === "fetch"
            ? new Promise<Response>(() => {})
            : Promise.resolve({
                ok: true,
                json: () => new Promise(() => {}),
              } as Response),
        );
        const send = localVerificationMail(
          validateLocalWorkflowBinding(source, pool)!,
          config,
          request,
        );
        const pending = send(verification);
        const check = expect(pending).rejects.toThrow(
          "Account message request could not be completed.",
        );
        await vi.advanceTimersByTimeAsync(3_000);
        await check;
        expect(request).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it.each([
    new Response("{}", { status: 200 }),
    new Response("private", { status: 403 }),
    new Response(null, { status: 302 }),
  ])("refuses an invalid provider response", async (response) => {
    const send = localVerificationMail(
      validateLocalWorkflowBinding(source, pool)!,
      config,
      vi.fn(async () => response),
    );
    await expect(send(verification)).rejects.toThrow(
      "Account message request could not be completed.",
    );
  });
});
