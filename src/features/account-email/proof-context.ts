// Node-only request context, never a second proof/token store.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";

export type EmailProofContext = {
  userId: string;
  sessionId: string;
  currentEmail: string;
  newEmail?: string;
};
export function expectedProofIdentifiers(value: EmailProofContext) {
  return {
    current: `email-verification-otp-${value.currentEmail}`,
    next: value.newEmail
      ? `change-email-otp-${value.currentEmail}-${value.newEmail}`
      : undefined,
  };
}
async function emailProofIdentifier(
  value: EmailProofContext | undefined,
  identifier: string,
  secret: string,
  hasPlain: (identifier: string) => Promise<boolean>,
) {
  if (!value) throw new Error("Email confirmation context unavailable.");
  const expected = expectedProofIdentifiers(value);
  const purpose =
    identifier === expected.current
      ? "current"
      : identifier === expected.next
        ? "new"
        : null;
  if (!purpose || (await hasPlain(identifier)))
    throw new Error("Email confirmation binding rejected.");
  // Include the complete provider purpose/identifier; unambiguous tuple adds
  // exact trusted ownership/session binding to the provider's existing store.
  const tuple = JSON.stringify([
    "learli-email-proof-v1",
    purpose,
    identifier,
    value.userId,
    value.sessionId,
    value.currentEmail,
    purpose === "new" ? value.newEmail : null,
  ]);
  return `learli-email-proof-v1:${createHmac("sha256", secret).update(tuple).digest("hex")}`;
}

/** Coupled to the actual auth runtime, even across separately emitted bundles. */
export function createEmailProofBinding() {
  const context = new AsyncLocalStorage<EmailProofContext>();
  return {
    withContext: <T>(value: EmailProofContext, run: () => T) =>
      context.run(value, run),
    identifier: (
      identifier: string,
      secret: string,
      hasPlain: (identifier: string) => Promise<boolean>,
    ) => emailProofIdentifier(context.getStore(), identifier, secret, hasPlain),
  };
}
