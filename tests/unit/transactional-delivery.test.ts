import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  deliveryOutcome,
  retryGate,
  PROVIDER_KEY_RETENTION_MS,
  DELIVERY_MAX_ATTEMPTS,
} from "@/features/transactional-delivery/state";
import {
  createBookingMessageConstructor,
  readValidatedMessage,
} from "@/lib/email/transactional-message";
import { createResendTransport } from "@/lib/email/resend-transport";
const origin = "https://learli.example";
const identitySecret = "W4-synthetic-message-secret-tests-only";
const input = {
  eventId: "ad52bfd5-e5a9-4c26-a9d6-f42441a0306d",
  firstAttemptAt: 1_000_000,
  recipientEmail: "account@example.test",
  kind: "confirmed",
  source: "synthetic_readiness",
  subject: "Math",
  startAtUtc: "2026-11-01T05:30:00Z",
  endAtUtc: "2026-11-01T06:30:00Z",
  timezone: "America/New_York",
  detailPath: "/bookings/ad52bfd5-e5a9-4c26-a9d6-f42441a0306d?scope=guardian",
};
const construct = createBookingMessageConstructor({
  appOrigin: origin,
  identitySecret,
});
function message(value: unknown = input) {
  const result = construct(value);
  if (!result.ok) throw new Error("Synthetic booking message refused.");
  return result.message;
}
const transportConfig = {
  enabled: true,
  environment: "test",
  appOrigin: origin,
  apiKey: "re_synthetic_transport_test_key",
  sender: "sender@example.test",
  verifiedSender: {
    sender: "sender@example.test",
    environment: "test",
    appOrigin: origin,
  },
  allowedRecipients: [input.recipientEmail],
  timeoutMs: 20,
};
describe("immutable minimal booking message and actual SDK serialization", () => {
  it("formats each endpoint at its actual DST offset and never implies delivered/attendance", () => {
    const projection = message();
    const body = readValidatedMessage(projection);
    expect(body?.text).toContain("EDT");
    expect(body?.text).toContain("EST");
    expect(body?.text).toContain("No lesson or email delivery is established");
    expect(body?.text).toContain("do not establish attendance");
    expect(body?.subject).toBe("Your Learli booking update");
    expect(JSON.stringify(projection)).not.toContain(input.recipientEmail);
    expect(JSON.stringify(projection)).not.toContain(input.detailPath);
  });
  it("reconstructs stable body/key across constructor instances, keeping payload changes detectable", () => {
    const second = createBookingMessageConstructor({
      appOrigin: origin,
      identitySecret,
    })(JSON.parse(JSON.stringify(input)));
    expect(second.ok && second.message).toEqual(message());
    expect(second.ok && readValidatedMessage(second.message)).toEqual(
      readValidatedMessage(message()),
    );
    const changed = message({ ...input, subject: "English" });
    expect(changed.idempotencyKey).toBe(message().idempotencyKey);
    expect(changed.payloadFingerprint).not.toBe(message().payloadFingerprint);
  });
  it.each([
    { learnerName: "private synthetic child" },
    { meetingUrl: "https://meet.google.com/abc-defg-hij" },
    { html: "<b>arbitrary</b>" },
    { source: "local_simulation" },
    { source: "operational" },
    { endAtUtc: input.startAtUtc },
    { timezone: "Invalid/Zone" },
    { detailPath: "https://foreign.example" },
    { detailPath: "/bookings/demo" },
    { recipientEmail: "account@example.test\r\nBcc:a@example.test" },
  ])("rejects unknown/private/unsafe fields %j", (overrides) => {
    expect(construct({ ...input, ...overrides }).ok).toBe(false);
  });
  it("escapes legitimate subject text and confines link to current origin", () => {
    const body = readValidatedMessage(
      message({ ...input, subject: 'Math <script>& "topic"' }),
    );
    expect(body?.html).toContain("Math &lt;script&gt;&amp; &quot;topic&quot;");
    expect(body?.html).not.toContain("<script>");
    expect(body?.html).toContain(`${origin}/bookings/`);
  });
  it("sends identical SDK body/key after constructing from a durable snapshot in a fresh process context", async () => {
    const requests: { key: string | null; body: string }[] = [];
    const fetch: typeof globalThis.fetch = async (_, options) => {
      requests.push({
        key: new Headers(options?.headers).get("Idempotency-Key"),
        body: String(options?.body),
      });
      return Response.json({ id: "ad52bfd5-e5a9-4c26-a9d6-f42441a0306d" });
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const sdk = createResendTransport(transportConfig, {
        fetch,
        now: () => input.firstAttemptAt + attempt,
      });
      expect((await sdk.send(message())).status).toBe("accepted");
    }
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(JSON.parse(requests[0].body).to).toEqual([input.recipientEmail]);
  });
  it("refuses changed body under the same key through the actual transport", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        Response.json({ id: "ad52bfd5-e5a9-4c26-a9d6-f42441a0306d" }),
      );
    const sdk = createResendTransport(transportConfig, {
      fetch,
      now: () => input.firstAttemptAt,
    });
    expect((await sdk.send(message())).status).toBe("accepted");
    expect(await sdk.send(message({ ...input, subject: "English" }))).toEqual({
      status: "rejected",
      code: "payload",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe("durable bounded retry and uncertainty decisions", () => {
  it("keeps accepted distinct from delivery and permits truthful acknowledgment after retention elapsed", () => {
    expect(
      deliveryOutcome(
        { status: "accepted", providerId: "safe-id" },
        0,
        1,
        PROVIDER_KEY_RETENTION_MS,
      ),
    ).toEqual({
      state: "provider_accepted",
      providerId: "safe-id",
      failureCode: null,
      nextAttemptAt: null,
    });
  });
  it.each(["rate_limited", "unavailable"] as const)(
    "bounds retry for %s without moving the original first attempt",
    (code) => {
      expect(
        deliveryOutcome({ status: "retryable", code }, 1_000, 2, 2_000),
      ).toEqual({
        state: "retryable",
        providerId: null,
        failureCode: code,
        nextAttemptAt: 12_000,
      });
    },
  );
  it("persists uncertainty and blocks unresolved replay exactly at24h or attempt limit", () => {
    expect(
      deliveryOutcome({ status: "uncertain", code: "timeout" }, 0, 1, 0).state,
    ).toBe("uncertain");
    expect(retryGate(0, 1, PROVIDER_KEY_RETENTION_MS - 1)).toBeNull();
    expect(retryGate(0, 1, PROVIDER_KEY_RETENTION_MS)).toBe(
      "retention_elapsed",
    );
    expect(retryGate(0, DELIVERY_MAX_ATTEMPTS, 1)).toBe("attempt_limit");
    expect(
      deliveryOutcome(
        { status: "uncertain", code: "timeout" },
        0,
        1,
        PROVIDER_KEY_RETENTION_MS,
      ).state,
    ).toBe("blocked");
  });
  it.each(["payload", "recipient", "configuration"] as const)(
    "terminal %s never schedules a resend",
    (code) => {
      expect(deliveryOutcome({ status: "rejected", code }, 0, 1, 1)).toEqual({
        state: "blocked",
        providerId: null,
        failureCode: code,
        nextAttemptAt: null,
      });
    },
  );
  it("refuses invalid clock/attempt state without exposing values", () => {
    expect(() => retryGate(10, 1, 9)).toThrow("Invalid delivery attempt state");
    expect(() => retryGate(0, 0, 9)).toThrow();
  });
});
