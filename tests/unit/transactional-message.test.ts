import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createAuthMessageConstructors,
  readValidatedMessage,
  type MessageConstruction,
} from "@/lib/email/transactional-message";

const appOrigin = "https://learli.example";
const identitySecret = "synthetic-identity-key-for-unit-tests-only";
const constructors = createAuthMessageConstructors({
  appOrigin,
  identitySecret,
});
const input = {
  eventId: "5b714f16-371b-4c67-8675-72b407ff37c0",
  firstAttemptAt: 1_000_000,
  provider: {
    email: "account@example.test",
    url: `${appOrigin}/api/auth/verify-email?token=synthetic-proof-token-only&callbackURL=%2Fsign-in%3Fverified%3D1%26next%3D%252Faccount`,
  },
};
function message(result: MessageConstruction) {
  if (!result.ok) throw new Error("Expected valid synthetic message.");
  return result.message;
}

describe("strict auth transactional messages", () => {
  it("constructs verification and installed-provider reset URL bodies", () => {
    const verification = message(constructors.verification(input));
    const reset = message(
      constructors.passwordReset({
        ...input,
        provider: {
          ...input.provider,
          url: `${appOrigin}/api/auth/reset-password/synthetic-proof-token-only?callbackURL=%2Freset-password`,
        },
      }),
    );
    expect(readValidatedMessage(verification)?.text).toContain(
      input.provider.url,
    );
    expect(readValidatedMessage(reset)?.subject).toBe(
      "Reset your Learli password",
    );
    expect(reset.idempotencyKey).not.toBe(verification.idempotencyKey);
  });
  it("constructs distinct current/new code templates with fixed token-free navigation", () => {
    const code = {
      ...input,
      provider: { email: input.provider.email, otp: "102938" },
    };
    for (const create of [
      constructors.emailChangeCurrent,
      constructors.emailChangeNew,
    ]) {
      const result = message(create(code));
      const body = readValidatedMessage(result);
      expect(body?.text).toContain("102938");
      expect(body?.html).toContain(`${appOrigin}/account/email`);
      expect(body?.subject).not.toContain("102938");
      expect(JSON.stringify(result) + inspect(result)).not.toContain("102938");
      expect(JSON.stringify(result) + inspect(result)).not.toContain(
        code.provider.email,
      );
    }
    expect(
      message(constructors.emailChangeCurrent(code)).idempotencyKey,
    ).not.toBe(message(constructors.emailChangeNew(code)).idempotencyKey);
  });
  it("keeps proof, recipient and private body out of JSON and inspect projection", () => {
    const result = message(constructors.verification(input));
    const projection = JSON.stringify(result) + inspect(result);
    expect(projection).not.toContain(input.provider.email);
    expect(projection).not.toContain(input.provider.url);
    expect(projection).not.toContain("synthetic-proof-token-only");
    expect(Object.isFrozen(result)).toBe(true);
    expect(readValidatedMessage({ ...result })).toBeUndefined();
  });
  it("keeps identity stable but fingerprints changed payload with keyed privacy", () => {
    const first = message(constructors.verification(input));
    expect(message(constructors.verification(input))).toEqual(first);
    const changed = message(
      constructors.verification({
        ...input,
        provider: {
          ...input.provider,
          url: input.provider.url.replace(
            "synthetic-proof-token-only",
            "another-synthetic-proof-only",
          ),
        },
      }),
    );
    expect(changed.idempotencyKey).toBe(first.idempotencyKey);
    expect(changed.payloadFingerprint).not.toBe(first.payloadFingerprint);
    const otherSecret = createAuthMessageConstructors({
      appOrigin,
      identitySecret: "another-synthetic-materialization-secret",
    });
    expect(
      message(otherSecret.verification(input)).payloadFingerprint,
    ).not.toBe(first.payloadFingerprint);
  });
  it.each([
    "http://learli.example/api/auth/verify-email?token=synthetic-proof-token-only&callbackURL=%2F",
    "https://foreign.example/api/auth/verify-email?token=synthetic-proof-token-only&callbackURL=%2F",
    "https://user:password@learli.example/api/auth/verify-email?token=synthetic-proof-token-only&callbackURL=%2F",
    `${input.provider.url}#secret`,
    `${input.provider.url}&token=another-synthetic-proof`,
    `${input.provider.url}&extra=unsafe`,
    input.provider.url.replace(
      "%2Fsign-in%3Fverified%3D1%26next%3D%252Faccount",
      "https%3A%2F%2Fforeign.example",
    ),
    input.provider.url.replace("%252Faccount", "%252F%252Fforeign.example"),
    input.provider.url.replace(
      "%252Faccount",
      "%252Fapi%252Fauth%252Freset-password%252Funsafe-proof",
    ),
    input.provider.url.replace("%252Faccount", "%252Faccount%25250d"),
    input.provider.url.replace("synthetic-proof-token-only", "<unsafe-body>"),
    input.provider.url.replace("verify-email", "arbitrary-path"),
    input.provider.url.replace("learli.example", "learli.example.evil"),
    input.provider.url + "\r\nBcc: attacker@example.test",
    "javascript:alert(1)",
  ])("rejects unsafe URL shape without exposing input: %s", (url) => {
    expect(
      constructors.verification({
        ...input,
        provider: { ...input.provider, url },
      }),
    ).toEqual({ ok: false, code: "payload" });
  });
  it.each([
    "a@example.test\r\nBcc: b@example.test",
    "Display <a@example.test>",
    "a@example.test,b@example.test",
    "<script>@example.test",
  ])("rejects unsafe recipient %s", (email) => {
    expect(
      constructors.verification({
        ...input,
        provider: { ...input.provider, email },
      }),
    ).toEqual({ ok: false, code: "recipient" });
  });
  it("rejects unknown caller body/header/recipient overrides and code shape", () => {
    expect(
      constructors.verification({ ...input, html: "<script>unsafe</script>" }),
    ).toEqual({ ok: false, code: "payload" });
    expect(
      constructors.verification({
        ...input,
        provider: { ...input.provider, headers: { Bcc: "a@example.test" } },
      }),
    ).toEqual({ ok: false, code: "payload" });
    expect(
      constructors.emailChangeNew({
        ...input,
        provider: { email: input.provider.email, otp: "<1234>" },
      }),
    ).toEqual({ ok: false, code: "payload" });
    expect(
      constructors.verification({ ...input, eventId: "raw-proof-secret" }),
    ).toEqual({ ok: false, code: "payload" });
  });
  it.each([
    "http://learli.example",
    `${appOrigin}/`,
    `${appOrigin}/path`,
    "https://user@learli.example",
  ])("disables invalid exact app origin %s", (origin) => {
    expect(
      createAuthMessageConstructors({
        appOrigin: origin,
        identitySecret,
      }).verification(input),
    ).toEqual({ ok: false, code: "configuration" });
  });
  it("escapes HTML attributes while preserving provider link for text", () => {
    const body = readValidatedMessage(
      message(constructors.verification(input)),
    );
    expect(body?.html).toContain("&amp;callbackURL=");
    expect(body?.text).toContain("&callbackURL=");
  });
});
