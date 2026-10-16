import "server-only";
import { randomUUID } from "node:crypto";
import { APIError } from "better-auth/api";
import { createAuthMessageConstructors } from "@/lib/email/transactional-message";
import { createResendTransport } from "@/lib/email/resend-transport";
import type { HostedAuthConfig } from "./config";
import type { AccountMail } from "./composition";
import { createPrivateAccountCapture } from "./private-capture";

export function hostedAccountMail(config: HostedAuthConfig) {
  if (config.mail.mode === "private-capture")
    return createPrivateAccountCapture(config);
  const transport = createResendTransport(
    config.mail.mode === "disabled" ? undefined : config.mail.transport,
  );
  return bindAccountMail(config, transport);
}
/** Consumed callback wiring; test fixtures compose the supported test SDK transport. */
export function bindAccountMail(
  config: HostedAuthConfig,
  transport: ReturnType<typeof createResendTransport>,
) {
  if (config.mail.mode === "private-capture")
    return createPrivateAccountCapture(config);
  const constructors = createAuthMessageConstructors(
    config.mail.mode === "disabled"
      ? undefined
      : {
          appOrigin: config.origin,
          identitySecret: config.mail.identitySecret,
        },
  );
  return async (mail: AccountMail) => {
    if (
      !config.accountEmails.includes(mail.to) ||
      config.mail.mode === "disabled"
    )
      throw new APIError("SERVICE_UNAVAILABLE", {
        message: "Account messages are unavailable.",
      });
    const base = { eventId: randomUUID(), firstAttemptAt: Date.now() };
    const result =
      "otp" in mail
        ? mail.kind === "email-change-current"
          ? constructors.emailChangeCurrent({
              ...base,
              provider: { email: mail.to, otp: mail.otp },
            })
          : constructors.emailChangeNew({
              ...base,
              provider: { email: mail.to, otp: mail.otp },
            })
        : mail.kind === "verification"
          ? constructors.verification({
              ...base,
              provider: { email: mail.to, url: mail.url },
            })
          : constructors.passwordReset({
              ...base,
              provider: { email: mail.to, url: mail.url },
            });
    if (
      !result.ok ||
      (await transport.send(result.message)).status !== "accepted"
    )
      throw new APIError("SERVICE_UNAVAILABLE", {
        message:
          "Account message request could not be completed. Restart verification or recovery.",
      });
  };
}
