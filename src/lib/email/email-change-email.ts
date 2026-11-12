import "server-only";
import { renderAccountProofEmail } from "./account-proof-email";
import type { LocalMessage } from "./local-mail";

/** The transport validates the code and token-free account navigation first. */
export function renderEmailChangeEmail(
  message: Extract<LocalMessage, { otp: string }>,
) {
  const current = message.kind === "email-change-current";
  return renderAccountProofEmail(
    message.url,
    {
      subject: current
        ? "Confirm your current Learli email"
        : "Confirm your new Learli email",
      preview:
        "Use your private confirmation code to continue your email change.",
      heading: current ? "Verify your current email" : "Verify your new email",
      introduction: current
        ? "You requested to change the email address on your Learli account. Enter this code on the Change account email page to confirm you own your current address."
        : "This address was requested as the new email for a Learli account. Enter this code on the Change account email page to confirm you own this new address.",
      action: "Continue email change",
      guidance:
        "This code expires in five minutes and can only be used once. Keep it private and enter it only in the signed-in Learli session where you started the change. Both addresses must be verified before your email changes.",
      ignore:
        "If you didn't request this change, do not share or enter this code. Your email address will stay the same unless both confirmation steps are completed.",
    },
    message.otp,
  );
}
