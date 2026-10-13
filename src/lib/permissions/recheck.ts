import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import { session, user, userAccess, type Role } from "@/lib/db/schema";
import { AccessError, type Identity } from "./access";
import { adminAssurancePredicate } from "@/features/admin-security/assurance";

/** Recheck a provider-resolved identity after a domain lock, on that transaction's connection. */
export async function recheckIdentity(
  db: Pick<Database, "select">,
  identity: Identity,
  role?: Role,
) {
  const [current] = await db
    .select({
      verified: user.emailVerified,
      status: userAccess.status,
      granted: role
        ? sql<boolean>`EXISTS (SELECT 1 FROM user_roles WHERE user_id = ${identity.userId} AND role = ${role}) AND ${role === "admin" ? adminAssurancePredicate(identity.userId, identity.sessionId) : sql`true`}`
        : sql<boolean>`true`,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .leftJoin(userAccess, eq(userAccess.userId, user.id))
    .where(
      and(
        eq(session.id, identity.sessionId),
        eq(session.userId, identity.userId),
        gt(session.expiresAt, sql`clock_timestamp()`),
      ),
    );
  if (!current) throw new AccessError(401);
  if (!current.verified || current.status !== "active" || !current.granted)
    throw new AccessError(403);
}
