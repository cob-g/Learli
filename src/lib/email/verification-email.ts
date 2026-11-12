import "server-only";
import { renderAccountProofEmail } from "./account-proof-email";

export function renderVerificationEmail(verificationUrl: string) {
  return renderAccountProofEmail(verificationUrl, {
    subject: "Verify your Learli email",
    preview:
      "Verify your email address to finish setting up your Learli account.",
    heading: "Verify your email address",
    introduction:
      "Thanks for creating a Learli account. Verify your email address to finish setting up your account and sign in.",
    action: "Verify email address",
    guidance:
      "Keep this link private. If it has expired, request a new verification email on Learli.",
    ignore:
      "If you didn't create a Learli account, you can safely ignore this email.",
  });
}
