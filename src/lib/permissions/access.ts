import { eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import type { AuthRuntime } from "../auth-factory";
import { userAccess, userRoles, type Role } from "../db/schema";
import { recheckAdminAssurance } from "@/features/admin-security/assurance";
import {
  accountHeadersAllowed,
  permitsAccountEmail,
  providerHeaders,
} from "@/features/hosted-auth/request";

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404 | 503) {
    super(
      status === 401
        ? "Sign in to continue."
        : status === 503
          ? "Account service is unavailable. Try again later."
          : "This account is not available.",
    );
  }
}
export async function requireIdentity(runtime: AuthRuntime, headers: Headers) {
  if (!accountHeadersAllowed(runtime, headers)) throw new AccessError(403);
  let session;
  try {
    session = await runtime.auth.api.getSession({
      headers:
        "hosted" in runtime ? providerHeaders(runtime, headers) : headers,
    });
  } catch (error) {
    if (
      "hosted" in runtime &&
      isAPIError(error) &&
      [401, 403].includes(error.statusCode)
    )
      throw new AccessError(error.statusCode === 401 ? 401 : 403);
    throw error;
  }
  if (!session) throw new AccessError(401);
  if (!permitsAccountEmail(runtime, session.user.email))
    throw new AccessError(403);
  if (!session.user.emailVerified) throw new AccessError(403);
  const [access] = await runtime.db
    .select()
    .from(userAccess)
    .where(eq(userAccess.userId, session.user.id));
  if (access?.status !== "active") throw new AccessError(403);
  const grants = await runtime.db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, session.user.id));
  return {
    userId: session.user.id,
    sessionId: session.session.id,
    roles: grants.map((grant) => grant.role),
  };
}
export type Identity = Awaited<ReturnType<typeof requireIdentity>>;
export async function requireRole(
  runtime: AuthRuntime,
  headers: Headers,
  role: Role,
) {
  const identity = await requireIdentity(runtime, headers);
  if (!identity.roles.includes(role)) throw new AccessError(403);
  if (role === "admin") await recheckAdminAssurance(runtime.db, identity);
  return identity;
}
export function requireOwnership(identity: Identity, ownerId: string) {
  // An admin role is deliberately not an ownership bypass.
  if (identity.userId !== ownerId) throw new AccessError(404);
}
