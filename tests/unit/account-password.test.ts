import { describe, expect, it } from "vitest";
import { passwordChangeInput } from "@/features/account-password/input";
import { projectPasswordResponse } from "@/features/account-password/handler";

const input = {
  currentPassword: "Current synthetic passphrase",
  newPassword: "New synthetic passphrase",
  confirmPassword: "New synthetic passphrase",
};
describe("password boundary projection and input", () => {
  it("validates exact fields, length and confirmation without trimming credentials", () => {
    expect(passwordChangeInput.parse(input)).toEqual(input);
    const spaced = {
      ...input,
      newPassword: " twelve chars ",
      confirmPassword: " twelve chars ",
    };
    expect(passwordChangeInput.parse(spaced).newPassword).toBe(
      spaced.newPassword,
    );
    for (const body of [
      { ...input, userId: "foreign" },
      { ...input, revokeOtherSessions: false },
      { ...input, confirmPassword: "mismatched synthetic" },
      { ...input, currentPassword: "" },
      { ...input, currentPassword: "x".repeat(129) },
      {
        ...input,
        newPassword: "x".repeat(11),
        confirmPassword: "x".repeat(11),
      },
      {
        ...input,
        newPassword: "x".repeat(129),
        confirmPassword: "x".repeat(129),
      },
    ])
      expect(passwordChangeInput.safeParse(body).success).toBe(false);
    for (const length of [12, 128])
      expect(
        passwordChangeInput.safeParse({
          ...input,
          newPassword: "x".repeat(length),
          confirmPassword: "x".repeat(length),
        }).success,
      ).toBe(true);
  });
  it("forwards every independent cookie while dropping provider token/user/body headers", async () => {
    const provider = Response.json({
      token: "provider-body-secret",
      user: { id: "private-user" },
    });
    provider.headers.append("set-cookie", "first=fixture-a; Path=/; HttpOnly");
    provider.headers.append(
      "set-cookie",
      "second=fixture-b; Expires=Wed, 21 Oct 2037 07:28:00 GMT; HttpOnly",
    );
    provider.headers.set("x-private", "provider-internal");
    const response = await projectPasswordResponse(provider);
    expect(await response.json()).toEqual({ status: true });
    expect(response.headers.getSetCookie()).toEqual(
      provider.headers.getSetCookie(),
    );
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.has("x-private")).toBe(false);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
  });
  it("keeps failure cookies and discloses uncertain outcomes without provider internals", async () => {
    const provider = Response.json(
      { message: "private database failure", token: "private-token" },
      { status: 500 },
    );
    provider.headers.append("set-cookie", "clear=; Max-Age=0; HttpOnly");
    const response = await projectPasswordResponse(provider);
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("CHANGE_UNCERTAIN");
    expect(response.headers.getSetCookie()).toHaveLength(1);
  });
  it("projects freshness and provider throttle with bounded retry metadata", async () => {
    const fresh = await projectPasswordResponse(
      Response.json(
        { code: "SESSION_NOT_FRESH", message: "private" },
        { status: 403 },
      ),
    );
    expect((await fresh.json()).code).toBe("SESSION_NOT_FRESH");
    const limited = await projectPasswordResponse(
      new Response("private throttle", {
        status: 429,
        headers: { "retry-after": "60" },
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect((await limited.text()).includes("private throttle")).toBe(false);
    const installed = await projectPasswordResponse(
      new Response(null, { status: 429, headers: { "X-Retry-After": "59" } }),
    );
    expect(installed.headers.get("retry-after")).toBe("59");
  });
});
