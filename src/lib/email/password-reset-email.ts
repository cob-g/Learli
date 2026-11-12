import "server-only";
import { renderAccountProofEmail } from "./account-proof-email";
import { authOptions } from "../auth-options";

export function renderPasswordResetEmail(resetUrl: string) {
  const minutes = authOptions.emailAndPassword.resetPasswordTokenExpiresIn / 60;
  return renderAccountProofEmail(resetUrl, {
    subject: "Reset your Learli password",
    preview: "Use your private link to choose a new Learli password.",
    heading: "Reset your password",
    introduction:
      "We received a request to reset the password for your Learli account. Use the button below to choose a new password.",
    action: "Reset password",
    guidance: `This link expires in ${minutes} minutes and can only be used once. Keep it private. If it has expired, request a new link on Learli.`,
    ignore:
      "If you didn't request a password reset, you can safely ignore this email. Your password will stay the same.",
  });
}
