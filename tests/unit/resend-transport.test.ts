import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createAuthMessageConstructors,
  type ValidatedMessage,
} from "@/lib/email/transactional-message";
import {
  createResendTransport,
  RESEND_IDEMPOTENCY_RETENTION_MS,
  type ResendTransportConfig,
} from "@/lib/email/resend-transport";

const appOrigin = "https://learli.example";
const now = 1_000_000;
const constructors = createAuthMessageConstructors({
  appOrigin,
  identitySecret: "synthetic-identity-key-for-unit-tests-only",
});
const input = {
  eventId: "5b714f16-371b-4c67-8675-72b407ff37c0",
  firstAttemptAt: now,
  provider: {
    email: "account@example.test",
    url: `${appOrigin}/api/auth/verify-email?token=synthetic-proof-token-only&callbackURL=%2F`,
  },
};
function makeMessage(value = input): ValidatedMessage {
  const result = constructors.verification(value);
  if (!result.ok) throw new Error("Expected synthetic message.");
  return result.message;
}
const config: ResendTransportConfig = {
  enabled: true,
  environment: "test",
  appOrigin,
  apiKey: "re_synthetic_unit_test_key",
  sender: "notice@example.test",
  verifiedSender: {
    sender: "notice@example.test",
    environment: "test",
    appOrigin,
  },
  allowedRecipients: [input.provider.email],
  timeoutMs: 50,
};
const id = "1d053a43-99a6-4295-8056-adc88a712bd8";
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Unsafe": "private-provider-value",
    },
  });
function stub(body: unknown = { id }, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(response(body, status));
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("disabled-by-default actual SDK Resend transport", () => {
  it("exercises SDK send/post serialization through local fetch and stable retries", async () => {
    const fetch = stub();
    const transport = createResendTransport(config, { fetch, now: () => now });
    const message = makeMessage();
    expect(await transport.send(message)).toEqual({
      status: "accepted",
      providerId: id,
    });
    fetch.mockResolvedValueOnce(response({ id }));
    expect(await transport.send(makeMessage())).toEqual({
      status: "accepted",
      providerId: id,
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options?.method).toBe("POST");
    expect(options?.redirect).toBe("error");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(
      message.idempotencyKey,
    );
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      `Bearer ${config.apiKey}`,
    );
    const payload = JSON.parse(String(options?.body));
    expect(Object.keys(payload).sort()).toEqual([
      "from",
      "html",
      "subject",
      "text",
      "to",
    ]);
    expect(payload.to).toEqual([input.provider.email]);
    expect(payload.text).toContain(input.provider.url);
    expect(payload.subject).not.toContain("synthetic-proof-token-only");
    expect(fetch.mock.calls[1][1]?.body).toBe(options?.body);
  });
  it.each([
    undefined,
    {},
    { ...config, enabled: false },
    { ...config, apiKey: "" },
    { ...config, allowedRecipients: [] },
    { ...config, appOrigin: `${appOrigin}/` },
    {
      ...config,
      verifiedSender: { ...config.verifiedSender, environment: "production" },
    },
    {
      ...config,
      verifiedSender: {
        ...config.verifiedSender,
        sender: "foreign@example.test",
      },
    },
    { ...config, sender: "a@example.test\r\nBcc: x@example.test" },
    { ...config, environment: "production" },
  ])(
    "fails closed without any I/O for missing/invalid/test-boundary config",
    async (configuration) => {
      const fetch = stub();
      expect(
        await createResendTransport(configuration, {
          fetch,
          now: () => now,
        }).send(makeMessage()),
      ).toEqual({ status: "rejected", code: "configuration" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("denies non-allowlisted recipients, foreign origin and forged body projection", async () => {
    const fetch = stub();
    const transport = createResendTransport(config, { fetch, now: () => now });
    expect(
      await transport.send(
        makeMessage({
          ...input,
          provider: { ...input.provider, email: "foreign@example.test" },
        }),
      ),
    ).toEqual({ status: "rejected", code: "recipient" });
    expect(await transport.send({ ...makeMessage() })).toEqual({
      status: "rejected",
      code: "payload",
    });
    expect(
      await createResendTransport(
        {
          ...config,
          appOrigin: "https://other.example",
          verifiedSender: {
            ...config.verifiedSender,
            appOrigin: "https://other.example",
          },
        },
        { fetch, now: () => now },
      ).send(makeMessage()),
    ).toEqual({ status: "rejected", code: "configuration" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects changed material and first-attempt reset without another provider call", async () => {
    const fetch = stub();
    const transport = createResendTransport(config, {
      fetch,
      now: () => now + 10,
    });
    await transport.send(makeMessage());
    expect(
      await transport.send(
        makeMessage({
          ...input,
          provider: {
            ...input.provider,
            url: input.provider.url.replace(
              "synthetic-proof-token-only",
              "another-synthetic-proof-only",
            ),
          },
        }),
      ),
    ).toEqual({ status: "rejected", code: "payload" });
    expect(
      await transport.send(makeMessage({ ...input, firstAttemptAt: now + 1 })),
    ).toEqual({ status: "rejected", code: "payload" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("operator-blocks at and beyond key retention without I/O", async () => {
    const fetch = stub();
    for (const age of [
      RESEND_IDEMPOTENCY_RETENTION_MS,
      RESEND_IDEMPOTENCY_RETENTION_MS + 1,
    ]) {
      expect(
        await createResendTransport(config, {
          fetch,
          now: () => now + age,
        }).send(makeMessage()),
      ).toEqual({ status: "uncertain", code: "timeout" });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("evicts identity cache at retention without triggering any resend", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fetch = stub();
    const transport = createResendTransport(config, { fetch });
    await transport.send(makeMessage());
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(RESEND_IDEMPOTENCY_RETENTION_MS);
    expect(vi.getTimerCount()).toBe(0);
    expect(await transport.send(makeMessage())).toEqual({
      status: "uncertain",
      code: "timeout",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [429, "rate_limit_exceeded", "retryable", "rate_limited"],
    [500, "application_error", "retryable", "unavailable"],
    [503, "service_unavailable", "retryable", "unavailable"],
    [409, "concurrent_idempotent_requests", "retryable", "unavailable"],
    [409, "invalid_idempotent_request", "rejected", "payload"],
    [409, "unknown", "rejected", "payload"],
    [401, "validation_error", "rejected", "configuration"],
    [403, "validation_error", "rejected", "configuration"],
    [422, "validation_error", "rejected", "payload"],
    [408, "application_error", "uncertain", "timeout"],
    [504, "application_error", "uncertain", "timeout"],
  ])(
    "sanitizes HTTP %s %s including distinct 409 outcomes",
    async (status, name, expectedStatus, code) => {
      vi.stubEnv("NODE_ENV", "development");
      const error = vi.spyOn(console, "error");
      const warn = vi.spyOn(console, "warn");
      const log = vi.spyOn(console, "log");
      const fetch = stub(
        {
          name,
          message: `${input.provider.email} ${input.provider.url} ${config.apiKey}`,
          statusCode: 200,
        },
        Number(status),
      );
      const result = await createResendTransport(config, {
        fetch,
        now: () => now,
      }).send(makeMessage());
      expect(result).toEqual({ status: expectedStatus, code });
      expect(JSON.stringify(result)).not.toContain("synthetic");
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { id: "unsafe\r\nheader" },
    null,
    { id: input.provider.url },
    { id: 42 },
    { id, error: "unsafe extra provider payload" },
  ])("safely treats malformed success as ambiguous", async (body) => {
    expect(
      await createResendTransport(config, {
        fetch: stub(body),
        now: () => now,
      }).send(makeMessage()),
    ).toEqual({ status: "uncertain", code: "timeout" });
  });
  it("bounds timeout, aborts request, and contains network/invalid JSON failures", async () => {
    let signal: AbortSignal | null | undefined;
    const never = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_, options) => {
        signal = options?.signal;
        return new Promise<Response>(() => {});
      });
    expect(
      await createResendTransport(
        { ...config, timeoutMs: 5 },
        { fetch: never, now: () => now },
      ).send(makeMessage()),
    ).toEqual({ status: "uncertain", code: "timeout" });
    expect(signal?.aborted).toBe(true);
    const fetch = stub();
    fetch.mockRejectedValueOnce(new Error(input.provider.url));
    expect(
      await createResendTransport(config, { fetch, now: () => now }).send(
        makeMessage(),
      ),
    ).toEqual({ status: "uncertain", code: "timeout" });
    fetch.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    expect(
      await createResendTransport(config, { fetch, now: () => now }).send(
        makeMessage(),
      ),
    ).toEqual({ status: "uncertain", code: "timeout" });
  });
});
