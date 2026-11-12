// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { validateLocalWorkflowBinding } from "@/features/local-workflow/runtime";
import {
  createLocalBookingMessageConstructor,
  createBookingMessageConstructor,
  readValidatedMessage,
  type ValidatedMessage,
} from "@/lib/email/transactional-message";
import {
  createLocalBookingResendTransport,
  createResendTransport,
} from "@/lib/email/resend-transport";
vi.mock("server-only", () => ({}));
const source = {
  APP_ENV: "development",
  AUTH_MODE: "local",
  DATABASE_MODE: "local",
  LOCAL_WORKFLOW_MODE: "enabled",
  APP_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "postgresql://learli_app:synthetic@127.0.0.1:55499/learli_dev",
  BETTER_AUTH_SECRET: "synthetic-local-booking-secret-123456",
};
const capability = validateLocalWorkflowBinding(source, {
  options: {
    host: "127.0.0.1",
    port: 55499,
    database: "learli_dev",
    user: "learli_app",
  },
})!;
const config = { key: "re_synthetic123456", recipient: "owner@example.com" };
const construct = createLocalBookingMessageConstructor(
  capability,
  source.BETTER_AUTH_SECRET,
);
const input = {
  eventId: "ad52bfd5-e5a9-4c26-a9d6-f42441a0306d",
  firstAttemptAt: Date.now() - 1_000,
  recipientEmail: config.recipient,
  kind: "confirmed",
  source: "local_operation",
  subject: "Science",
  startAtUtc: "2026-11-01T05:30:00Z",
  endAtUtc: "2026-11-01T06:30:00Z",
  timezone: "America/New_York",
  detailPath: "/bookings/ad52bfd5-e5a9-4c26-a9d6-f42441a0306d?scope=student",
};
function message(value: unknown = input) {
  const result = construct(value);
  if (!result.ok) throw Error("Synthetic message refused.");
  return result.message;
}
const request = vi.fn<typeof fetch>(async () =>
  Response.json({ id: "00000000-0000-4000-8000-000000000000" }),
);
beforeEach(() => {
  request.mockClear();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(["confirmed", "rescheduled", "cancelled"])(
  "renders and serializes branded %s with timezone, exact owner and no meeting/learner data",
  async (kind) => {
    const proof = message({ ...input, kind });
    const body = readValidatedMessage(proof)!;
    document.documentElement.innerHTML = body.html;
    expect(document.querySelector("h1")).toHaveTextContent(`Booking ${kind}`);
    expect(body.subject).toBe(`Booking ${kind} | Learli`);
    expect(body.text).toContain("Science");
    expect(body.text).toContain("GMT-4");
    expect(body.text).toContain("GMT-5");
    expect(body.text).toContain("America/New_York");
    expect(body.text).toContain("local test booking");
    expect(body.text).toContain("No payment or attendance is established");
    expect(body.text).not.toContain(
      "External email delivery is not configured",
    );
    for (const link of document.querySelectorAll("a"))
      expect(link.getAttribute("href")).toBe(source.APP_URL + input.detailPath);
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "cid:learli-wordmark",
    );
    await expect(
      createLocalBookingResendTransport(capability, config).send(proof),
    ).resolves.toMatchObject({ status: "accepted" });
    const sent = JSON.parse(request.mock.calls[0]![1]!.body as string);
    expect(sent.to).toEqual([config.recipient]);
    expect(sent.from).toBe("Learli <onboarding@resend.dev>");
    expect(sent.attachments[0].content_id).toBe("learli-wordmark");
    expect(JSON.stringify(sent)).not.toMatch(/learnerName|meetingUrl/);
  },
);

it("escapes dynamic subject content and keeps key/material stable across constructors", () => {
  const value = { ...input, subject: 'Science <script>& "topic"' };
  const first = message(value);
  const again = createLocalBookingMessageConstructor(
    capability,
    source.BETTER_AUTH_SECRET,
  )(value);
  expect(again).toEqual({ ok: true, message: first });
  const body = readValidatedMessage(first)!;
  expect(body.html).not.toContain("<script>");
  expect(body.html).toContain("&lt;script&gt;");
  expect(body.text).toContain(value.subject);
  expect(Object.isFrozen(body.attachments)).toBe(true);
  expect(Object.isFrozen(body.attachments![0])).toBe(true);
});

it.each([
  { kind: "provisional" },
  { kind: "expired" },
  { kind: "completed" },
  { kind: "no_show" },
  { source: "synthetic_readiness" },
  { source: "local_simulation" },
  { detailPath: "/account" },
  { detailPath: input.detailPath + "&meeting=private" },
  { learnerName: "private" },
  { meetingUrl: "https://meet.google.com/abc-defg-hij" },
  { html: "arbitrary" },
  { timezone: "Invalid/Zone" },
])("refuses unsupported or private payload material %j", (overrides) => {
  expect(construct({ ...input, ...overrides })).toEqual({
    ok: false,
    code: "payload",
  });
});

it("refuses another participant, foreign origin and forged message without provider I/O", async () => {
  const send = createLocalBookingResendTransport(capability, config);
  await expect(
    send.send(message({ ...input, recipientEmail: "other@example.com" })),
  ).resolves.toEqual({ status: "rejected", code: "recipient" });
  const hosted = createBookingMessageConstructor({
    appOrigin: "https://learli.example",
    identitySecret: source.BETTER_AUTH_SECRET,
  })({ ...input, source: "synthetic_readiness" });
  expect(hosted.ok).toBe(true);
  if (hosted.ok)
    await expect(send.send(hosted.message)).resolves.toEqual({
      status: "rejected",
      code: "configuration",
    });
  await expect(send.send({} as ValidatedMessage)).resolves.toEqual({
    status: "rejected",
    code: "payload",
  });
  expect(request).not.toHaveBeenCalled();
});

it("does not weaken the existing hosted HTTPS factory or accept unregistered local capability", async () => {
  expect(
    createBookingMessageConstructor({
      appOrigin: source.APP_URL,
      identitySecret: source.BETTER_AUTH_SECRET,
    })(input),
  ).toEqual({ ok: false, code: "configuration" });
  expect(() =>
    createLocalBookingResendTransport({ ...capability }, config),
  ).toThrow();
  await expect(
    createResendTransport({
      enabled: true,
      environment: "development",
      appOrigin: source.APP_URL,
      apiKey: config.key,
      sender: "onboarding@resend.dev",
      verifiedSender: {
        sender: "onboarding@resend.dev",
        environment: "development",
        appOrigin: source.APP_URL,
      },
      allowedRecipients: [config.recipient],
    }).send(message()),
  ).resolves.toEqual({ status: "rejected", code: "configuration" });
});

it.each([
  { status: 429, outcome: "retryable", code: "rate_limited" },
  { status: 500, outcome: "retryable", code: "unavailable" },
  { status: 403, outcome: "rejected", code: "configuration" },
])(
  "keeps safe failure handling for provider $status",
  async ({ status, outcome, code }) => {
    request.mockResolvedValueOnce(
      Response.json(
        { name: "application_error", message: "private provider detail" },
        { status },
      ),
    );
    await expect(
      createLocalBookingResendTransport(capability, config).send(message()),
    ).resolves.toEqual({ status: outcome, code });
  },
);

it("bounds a stalled local send and preserves a stable retry key", async () => {
  vi.useFakeTimers();
  request.mockImplementationOnce(() => new Promise<Response>(() => {}));
  const transport = createLocalBookingResendTransport(capability, config);
  const proof = message();
  const pending = transport.send(proof);
  await vi.advanceTimersByTimeAsync(3_000);
  await expect(pending).resolves.toEqual({
    status: "uncertain",
    code: "timeout",
  });
  await expect(transport.send(proof)).resolves.toMatchObject({
    status: "accepted",
  });
  expect(
    request.mock.calls.map(([, init]) =>
      new Headers(init!.headers).get("Idempotency-Key"),
    ),
  ).toEqual([proof.idempotencyKey, proof.idempotencyKey]);
});
