// Server boundary only. Better Auth owns identity, proof storage and consumption.
import { eq, sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { session, user } from "@/lib/db/schema";
import { requireIdentity } from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { syntheticEmail } from "@/lib/local-mode";
import { RuleError } from "@/lib/rule-error";
import type { EmailChangeInput } from "./input";

export class EmailFreshnessError extends RuleError {
  constructor() {
    super(403, "Sign out, then sign in again to change your email.");
  }
}
export async function changeOwnEmail(
  runtime: AuthRuntime,
  requestHeaders: Headers,
  input: EmailChangeInput,
) {
  const identity = await requireIdentity(runtime, requestHeaders);
  return runtime.db.transaction(async (tx) => {
    // Coordinate with password changes and bound the shared five-connection pool.
    const capacity = await tx.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(41003, 0) AS acquired`,
    );
    const lock = await tx.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(41004, hashtext(${identity.userId})) AS acquired`,
    );
    if (!capacity.rows[0]?.acquired || !lock.rows[0]?.acquired)
      throw new RuleError(409, "Account changes are busy. Try again shortly.");
    await recheckIdentity(tx, identity);
    const [current] = await tx
      .select({ createdAt: session.createdAt, email: user.email })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(eq(session.id, identity.sessionId));
    const { sessionConfig } = await runtime.auth.$context;
    if (
      !current ||
      (sessionConfig.freshAge !== 0 &&
        Date.now() - current.createdAt.getTime() >=
          sessionConfig.freshAge * 1000)
    )
      throw new EmailFreshnessError();
    if (!syntheticEmail(current.email))
      throw new RuleError(
        403,
        "Email changes are unavailable on this account.",
      );
    if (
      input.action !== "start" &&
      input.newEmail === current.email.toLowerCase()
    )
      throw new RuleError(400, "Choose a different synthetic .test address.");
    const headers = new Headers(requestHeaders);
    headers.set("x-learli-local-ip", "127.0.0.1");
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const call = (path: string, body: object) =>
      runtime.emailProofBinding.withContext(
        {
          userId: identity.userId,
          sessionId: identity.sessionId,
          currentEmail: current.email.toLowerCase(),
          newEmail: input.action === "start" ? undefined : input.newEmail,
        },
        () =>
          runtime.auth.handler(
            new Request(`${runtime.origin}/api/auth/${path}`, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
            }),
          ),
      );
    const provider = await call(
      input.action === "start"
        ? "email-otp/send-verification-otp"
        : input.action === "request"
          ? "email-otp/request-email-change"
          : "email-otp/change-email",
      input.action === "start"
        ? { email: current.email, type: "email-verification" }
        : { newEmail: input.newEmail, otp: input.code },
    );
    if (input.action !== "confirm" || provider.status !== 200)
      return { provider, revocationFailed: false };
    // The email write is already committed in the provider's transaction.
    try {
      const revoked = await call("revoke-other-sessions", {});
      for (const cookie of revoked.headers.getSetCookie())
        provider.headers.append("set-cookie", cookie);
      return { provider, revocationFailed: revoked.status !== 200 };
    } catch {
      return { provider, revocationFailed: true };
    }
  });
}
