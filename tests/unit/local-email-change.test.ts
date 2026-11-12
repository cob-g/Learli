import { beforeEach, expect, it, vi } from "vitest";
import {
  localAccountProofMail,
  localWorkflowMail,
} from "@/lib/email/local-verification";
import {
  captureOperationalMail,
  validateOperationalMail,
  type LocalMessage,
} from "@/lib/email/local-mail";
import { validateLocalWorkflowBinding } from "@/features/local-workflow/runtime";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/local-mail", async (original) => ({
  ...(await original<typeof import("@/lib/email/local-mail")>()),
  captureOperationalMail: vi.fn(async (capability, mail) => {
    validateOperationalMail(capability, mail);
  }),
}));
const source = {
  APP_ENV: "development",
  AUTH_MODE: "local",
  DATABASE_MODE: "local",
  LOCAL_WORKFLOW_MODE: "enabled",
  APP_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "postgresql://learli_app:test-only@127.0.0.1:55499/learli_dev",
  BETTER_AUTH_SECRET: "local-test-secret-at-least-32-characters",
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
const message = (
  kind: "email-change-current" | "email-change-new",
): LocalMessage => ({
  kind,
  to: config.recipient,
  url: `${source.APP_URL}/account/email`,
  otp: "123456",
});
const accepted = () =>
  new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000000" }));
beforeEach(() => vi.clearAllMocks());

it.each(["email-change-current", "email-change-new"] as const)(
  "sends %s only to its genuine owner with token-free navigation",
  async (kind) => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    await localWorkflowMail(capability, config, request)(message(kind));
    const body = JSON.parse(request.mock.calls[0]![1]!.body as string);
    expect(body.to).toEqual([config.recipient]);
    expect(body.text).toContain("123456");
    expect(body.subject).toContain(
      kind === "email-change-current" ? "current" : "new",
    );
    expect(body.from).toBe("Learli <onboarding@resend.dev>");
    expect(captureOperationalMail).not.toHaveBeenCalled();
  },
);

it("captures only deliberate synthetic counterparts, preserves disabled capture and rejects other real recipients", async () => {
  const request = vi.fn<typeof fetch>(async () => accepted());
  const send = localWorkflowMail(capability, config, request);
  const synthetic = { ...message("email-change-new"), to: "other@learli.test" };
  await send(synthetic);
  expect(captureOperationalMail).toHaveBeenCalledWith(capability, synthetic);
  await expect(
    send({ ...synthetic, to: "other@example.com" }),
  ).rejects.toThrow();
  await expect(
    send({ ...synthetic, kind: "verification" } as LocalMessage),
  ).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  vi.mocked(captureOperationalMail).mockClear();
  await localWorkflowMail(capability)(message("email-change-current"));
  expect(captureOperationalMail).toHaveBeenCalledTimes(1);
});

it.each([
  { otp: "bad" },
  { otp: "12345" },
  { url: "https://evil.example/account/email" },
  { url: `${source.APP_URL}/account/email?otp=123456` },
  { url: `${source.APP_URL}/account/email#123456` },
  { url: `${source.APP_URL}/account/password` },
])(
  "refuses malformed or misplaced code proofs before any send or capture",
  async (override) => {
    const request = vi.fn<typeof fetch>(async () => accepted());
    await expect(
      localWorkflowMail(
        capability,
        config,
        request,
      )({ ...message("email-change-new"), ...override }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(captureOperationalMail).not.toHaveBeenCalled();
  },
);

it("never captures a failed enabled live send or reveals provider details", async () => {
  const request = vi.fn<typeof fetch>(
    async () => new Response("private provider failure", { status: 403 }),
  );
  const send = localWorkflowMail(capability, config, request);
  await expect(send(message("email-change-current"))).rejects.toThrow(
    "Account message request could not be completed.",
  );
  expect(captureOperationalMail).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not permit the direct sender to redirect a counterpart code to the owner", async () => {
  const request = vi.fn<typeof fetch>(async () => accepted());
  await expect(
    localAccountProofMail(
      capability,
      config,
      request,
    )({ ...message("email-change-new"), to: "counterpart@learli.test" }),
  ).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
