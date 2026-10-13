import { describe, expect, it } from "vitest";
import {
  createMailAttemptBoundary,
  refusedMailResponse,
} from "@/features/hosted-auth/mail-attempt";

describe("consumed request-local mail outcome without proof persistence", () => {
  it("detects awaited callback errors swallowed by the provider, preserves cookies and emits no credential", async () => {
    const boundary = createMailAttemptBoundary(async () => {
      throw new Error("synthetic-private-provider-material");
    });
    const attempt = await boundary.run(async () => {
      await boundary
        .send({
          kind: "verification",
          to: "account@example.test",
          url: "https://accounts.learli.test/api/auth/verify-email?token=synthetic-proof",
        })
        .catch(() => undefined);
      return new Response("provider-success", {
        headers: {
          "Set-Cookie": "synthetic=value; Secure; HttpOnly; SameSite=Lax",
          "X-Safe-Metadata": "preserved",
          "Content-Length": "16",
        },
      });
    });
    expect(attempt.failed).toBe(true);
    const response = refusedMailResponse(attempt.value);
    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie()).toHaveLength(1);
    expect(response.headers.get("x-safe-metadata")).toBe("preserved");
    expect(response.headers.has("content-length")).toBe(false);
    expect(await response.text()).not.toMatch(
      /account@example|synthetic-proof|private-provider/,
    );
  });
  it("keeps simultaneous successful and failed provider dispatches isolated and retains no failed sticky state", async () => {
    const boundary = createMailAttemptBoundary(async (mail) => {
      await Promise.resolve();
      if (mail.to === "failed@example.test")
        throw new Error("synthetic-send-failure");
    });
    const run = (to: string) =>
      boundary.run(async () => {
        await boundary
          .send({
            kind: "reset",
            to,
            url: "https://accounts.learli.test/reset-password",
          })
          .catch(() => undefined);
        return "opaque-provider-result";
      });
    const [failed, success] = await Promise.all([
      run("failed@example.test"),
      run("success@example.test"),
    ]);
    expect(failed.failed).toBe(true);
    expect(success.failed).toBe(false);
    expect((await run("success@example.test")).failed).toBe(false);
  });
});
