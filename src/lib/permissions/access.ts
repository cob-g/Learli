import { eq } from "drizzle-orm";
import type { AuthRuntime } from "../auth-factory";
import { userAccess, userRoles, type Role } from "../db/schema";

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
  const session = await runtime.auth.api.getSession({ headers });
  if (!session) throw new AccessError(401);
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
  return identity;
}
export function requireOwnership(identity: Identity, ownerId: string) {
  // An admin role is deliberately not an ownership bypass.
  if (identity.userId !== ownerId) throw new AccessError(404);
}
