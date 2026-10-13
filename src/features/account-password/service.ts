import {
  providerHeaders,
  permitsAccountEmail,
} from "@/features/hosted-auth/request";
// Server boundary only: routes/tests. Better Auth remains the credential owner.
import { eq, sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { requireIdentity } from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { RuleError } from "@/lib/rule-error";
import { session, user } from "@/lib/db/schema";
import type { PasswordChangeInput } from "./input";

export class PasswordFreshnessError extends RuleError {
  constructor() {
    super(403, "Sign out, then sign in again to change your password.");
  }
}

export async function changeOwnPassword(
  runtime: AuthRuntime,
  requestHeaders: Headers,
  input: PasswordChangeInput,
) {
  const identity = await requireIdentity(runtime, requestHeaders);
  return runtime.db.transaction(async (tx) => {
    // The provider shares this max5 pool. One held wrapper transaction leaves
    // connections for its work; same-account locks alone cannot bound capacity.
    const capacity = await tx.execute<{ acquired: boolean }>(sql`
      SELECT pg_try_advisory_xact_lock(41003, 0) AS acquired
    `);
    if (!capacity.rows[0]?.acquired)
      throw new RuleError(409, "Password changes are busy. Try again shortly.");
    // This additional nonblocking lock only coordinates this Learli boundary.
    const lock = await tx.execute<{ acquired: boolean }>(sql`
      SELECT pg_try_advisory_xact_lock(41004, hashtext(${identity.userId})) AS acquired
    `);
    if (!lock.rows[0]?.acquired)
      throw new RuleError(
        409,
        "Another password change is in progress. Check your sign-in status before trying again.",
      );
    await recheckIdentity(tx, identity);
    const [current] = await tx
      .select({ createdAt: session.createdAt, email: user.email })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(eq(session.id, identity.sessionId));
    const { sessionConfig } = await runtime.auth.$context;
    if (current && !permitsAccountEmail(runtime, current.email))
      throw new RuleError(
        403,
        "Password changes are unavailable on this account.",
      );
    // 1.7.7 sensitive middleware checks validity, not freshness. Match the
    // provider's fresh-session age rule explicitly for this local boundary.
    if (
      !current ||
      (sessionConfig.freshAge !== 0 &&
        Date.now() - current.createdAt.getTime() >=
          sessionConfig.freshAge * 1000)
    )
      throw new PasswordFreshnessError();
    const headers = providerHeaders(runtime, requestHeaders, true);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    // Use the HTTP handler, not auth.api: rate limiting runs in HTTP middleware.
    return runtime.auth.handler(
      new Request(`${runtime.origin}/api/auth/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        }),
      }),
    );
  });
}
