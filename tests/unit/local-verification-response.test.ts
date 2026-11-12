import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
vi.mock("@/features/local-workflow/runtime", () => ({
  getLocalWorkflow: () => ({}),
}));
vi.mock("@/features/hosted-auth/request", () => ({
  permitsAccountEmail: () => true,
  providerHeaders: (_runtime: unknown, headers: Headers) => headers,
  accountHeadersAllowed: () => true,
}));
import { handleAuthRequest } from "@/lib/auth-handler";

afterEach(() => vi.useRealTimers());
describe("local verification response boundary", () => {
  describe.each(["send-verification-email", "request-password-reset"])(
    "%s",
    (route) => {
      it.each([400, 429])(
        "preserves provider validation or rate limit %s and headers",
        async (status) => {
          vi.useFakeTimers();
          const handler = vi.fn(
            async () =>
              new Response("refused", {
                status,
                headers: { "retry-after": "60" },
              }),
          );
          const runtime = {
            origin: "http://127.0.0.1:3000",
            localVerificationRecipient: "owner@example.com",
            auth: { handler },
            mailAttempt: {
              run: async (call: () => Promise<Response>) => ({
                value: await call(),
                failed: false,
              }),
            },
          } as unknown as AuthRuntime;
          const pending = handleAuthRequest(
            runtime,
            new Request(`http://127.0.0.1:3000/api/auth/${route}`, {
              method: "POST",
              headers: {
                origin: "http://127.0.0.1:3000",
                "content-type": "application/json",
              },
              body: JSON.stringify({ email: "other@example.com" }),
            }),
          );
          await vi.advanceTimersByTimeAsync(3_500);
          const response = await pending;
          expect(handler).toHaveBeenCalledTimes(1);
          expect(response.status).toBe(status);
          expect(response.headers.get("retry-after")).toBe("60");
          expect(response.headers.get("cache-control")).toBe(
            "private, no-store, max-age=0",
          );
          expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        },
      );
    },
  );
});
