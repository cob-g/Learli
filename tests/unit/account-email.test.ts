import { describe, expect, it } from "vitest";
import { emailChangeInput } from "@/features/account-email/input";
import { projectEmailResponse } from "@/features/account-email/handler";
import { createEmailProofBinding } from "@/features/account-email/proof-context";

describe("email change boundary", () => {
  it("normalizes bounded synthetic addresses and rejects actor/callback/role overrides", () => {
    expect(
      emailChangeInput.parse({
        action: "request",
        newEmail: " New@Learli.test ",
        code: "123456",
      }).action,
    ).toBe("request");
    for (const body of [
      {},
      { action: "start", email: "other@learli.test" },
      { action: "request", newEmail: "bad", code: "123456" },
      { action: "request", newEmail: "person@example.com", code: "123456" },
      ...["userId", "role", "callbackURL", "returnTo"].map((key) => ({
        action: "confirm",
        newEmail: "new@learli.test",
        code: "123456",
        [key]: "untrusted",
      })),
      {
        action: "confirm",
        newEmail: "x".repeat(255) + "@learli.test",
        code: "123456",
      },
      { action: "confirm", newEmail: "new@learli.test", code: "12345" },
    ])
      expect(emailChangeInput.safeParse(body).success).toBe(false);
  });
  it("projects safe status only, preserves cookies/retry and truthfully reports partial completion", async () => {
    const provider = Response.json(
      { token: "synthetic-hidden", email: "private@learli.test" },
      { headers: { "set-cookie": "synthetic=opaque; HttpOnly" } },
    );
    const result = await projectEmailResponse(provider, "confirm");
    expect(await result.json()).toEqual({ status: true, stage: "complete" });
    expect(result.headers.getSetCookie().length).toBe(1);
    const uncertain = await projectEmailResponse(provider, "confirm", true);
    expect(uncertain.status).toBe(503);
    expect((await uncertain.json()).message).toContain(
      "may already have changed",
    );
    const limited = await projectEmailResponse(
      new Response(null, { status: 429, headers: { "x-retry-after": "60" } }),
      "start",
    );
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(limited.headers.get("cache-control")).toContain("no-store");
    expect(
      (await projectEmailResponse(new Response(null, { status: 302 }), "start"))
        .status,
    ).toBe(503);
  });
  it("isolates overlapping async contexts, collision pairs, sessions and plain fallback", async () => {
    const binding = createEmailProofBinding();
    const withEmailProofContext = binding.withContext;
    const emailProofIdentifier = binding.identifier;
    const left = {
      userId: "owner",
      sessionId: "one",
      currentEmail: "a@foo.test",
      newEmail: "x.test-y@bar.test",
    };
    const right = {
      ...left,
      currentEmail: "a@foo.test-x.test",
      newEmail: "y@bar.test",
    };
    const identifier = `change-email-otp-${left.currentEmail}-${left.newEmail}`;
    const key = (value: typeof left) =>
      withEmailProofContext(value, async () => {
        await Promise.resolve();
        return emailProofIdentifier(
          identifier,
          "synthetic-test-secret",
          async () => false,
        );
      });
    const keys = await Promise.all([
      key(left),
      key(right),
      key({ ...left, sessionId: "two" }),
    ]);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((k) => !k.includes("@"))).toBe(true);
    await expect(
      emailProofIdentifier(
        identifier,
        "synthetic-test-secret",
        async () => false,
      ),
    ).rejects.toThrow("context");
    await expect(
      withEmailProofContext(left, () =>
        emailProofIdentifier(
          "change-email-unexpected",
          "synthetic-test-secret",
          async () => false,
        ),
      ),
    ).rejects.toThrow("binding");
    await expect(
      withEmailProofContext(left, () =>
        emailProofIdentifier(
          identifier,
          "synthetic-test-secret",
          async () => true,
        ),
      ),
    ).rejects.toThrow("binding");
  });
  it("keeps the scoped-run and provider hasher on the same runtime instance", async () => {
    const runtime = createEmailProofBinding();
    const otherBundle = createEmailProofBinding();
    const value = {
      userId: "owner",
      sessionId: "session",
      currentEmail: "old@learli.test",
    };
    const identifier = "email-verification-otp-old@learli.test";
    await expect(
      otherBundle.withContext(value, () =>
        runtime.identifier(
          identifier,
          "synthetic-test-secret",
          async () => false,
        ),
      ),
    ).rejects.toThrow("context");
    const result = await runtime.withContext(value, () =>
      runtime.identifier(
        identifier,
        "synthetic-test-secret",
        async () => false,
      ),
    );
    expect(result.startsWith("learli-email-proof-v1:")).toBe(true);
  });
});
