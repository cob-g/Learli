export type SignUpField = "name" | "email" | "password";
export type SignUpErrors = Partial<Record<SignUpField, string>>;

export const signUpUncertainMessage =
  "We couldn't confirm that your registration request finished. Try again, or sign in if you already have an account.";

// Provider details and account-specific codes must never become public feedback.
export function signUpFailure(error: unknown): {
  message: string;
  fields: SignUpErrors;
} {
  if (typeof error !== "object" || error === null)
    return { message: signUpUncertainMessage, fields: {} };

  const status = "status" in error ? error.status : undefined;
  if (status === 429)
    return {
      message:
        "Too many registration attempts. Wait before trying again, or sign in if you already have an account.",
      fields: {},
    };
  if (typeof status === "number" && status >= 500)
    return { message: signUpUncertainMessage, fields: {} };

  const code = "code" in error ? error.code : undefined;
  if (code === "INVALID_EMAIL")
    return {
      message: "Check the highlighted email address and try again.",
      fields: { email: "Enter a valid email address." },
    };
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG")
    return {
      message: "Check the highlighted password and try again.",
      fields: { password: "Use 12–128 characters." },
    };
  return { message: signUpUncertainMessage, fields: {} };
}
