import "server-only";
import { randomUUID } from "node:crypto";
import { renderVerificationEmail } from "./verification-email";
import {
  captureOperationalMail,
  validateOperationalMail,
  type LocalMessage,
} from "./local-mail";
import type { LocalWorkflow } from "@/features/local-workflow/runtime";

export const LOCAL_VERIFICATION_PROVIDER_TIMEOUT_MS = 3_000;

/** The sole live local mail path: a real verification proof to its own allowlisted address. */
export function localVerificationMail(
  capability: LocalWorkflow,
  config: Readonly<{ key: string; recipient: string }>,
  request: typeof fetch = globalThis.fetch,
) {
  return async (mail: LocalMessage) => {
    if (mail.kind !== "verification" || mail.to !== config.recipient)
      throw new Error("Account message is unavailable.");
    const message = validateOperationalMail(capability, mail);
    if (message.kind !== "verification")
      throw new Error("Account message is unavailable.");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          const response = await request("https://api.resend.com/emails", {
            method: "POST",
            redirect: "error",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${config.key}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `learli-local-verification/${randomUUID()}`,
            },
            body: JSON.stringify({
              from: "Learli <onboarding@resend.dev>",
              to: [message.to],
              ...renderVerificationEmail(message.url),
            }),
          });
          if (!response.ok) throw new Error();
          const result: unknown = await response.json();
          if (
            !result ||
            typeof result !== "object" ||
            !("id" in result) ||
            typeof result.id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              result.id,
            )
          )
            throw new Error();
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error());
          }, LOCAL_VERIFICATION_PROVIDER_TIMEOUT_MS);
        }),
      ]);
    } catch {
      // Never expose provider details, the credential or the verification proof.
      throw new Error("Account message request could not be completed.");
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

/** Routes only verification to the optional provider; all other messages retain capture. */
export function localWorkflowMail(
  capability: LocalWorkflow,
  config?: Readonly<{ key: string; recipient: string }>,
  request?: typeof fetch,
) {
  const verification = config
    ? localVerificationMail(capability, config, request)
    : null;
  return (mail: LocalMessage) =>
    verification && mail.kind === "verification"
      ? verification(mail)
      : captureOperationalMail(capability, mail);
}
