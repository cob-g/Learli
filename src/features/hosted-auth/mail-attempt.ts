import { AsyncLocalStorage } from "node:async_hooks";
import type { AccountMail } from "./composition";

/** Request-local outcome only: no recipient, proof, token, body or durable queue. */
export function createMailAttemptBoundary(
  send: (mail: AccountMail) => Promise<void>,
) {
  const context = new AsyncLocalStorage<{ failed: boolean }>();
  return {
    async send(mail: AccountMail) {
      try {
        await send(mail);
      } catch (error) {
        const attempt = context.getStore();
        if (attempt) attempt.failed = true;
        throw error;
      }
    },
    run<T>(
      operation: () => Promise<T>,
    ): Promise<{ value: T; failed: boolean }> {
      return context.run({ failed: false }, async () => {
        const value = await operation();
        return { value, failed: context.getStore()?.failed ?? true };
      });
    },
  };
}
export function refusedMailResponse(provider: Response) {
  const headers = new Headers(provider.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  const response = Response.json(
    {
      message:
        "The account message request could not be completed. Restart verification or recovery; account changes may already be saved.",
    },
    { status: 503, headers },
  );
  return response;
}
