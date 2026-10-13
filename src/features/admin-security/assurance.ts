import { sql, type SQL } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import {
  AccessError,
  requireIdentity,
  type Identity,
} from "@/lib/permissions/access";

export const ADMIN_ASSURANCE_SECONDS = 8 * 60 * 60;
export const ADMIN_FRESH_FACTOR_SECONDS = 5 * 60;

/** Compose this with the domain's exact capability/assignment and self exclusions. */
export function adminAssurancePredicate(
  userId: string | SQL,
  sessionId: string | SQL,
  maxAgeSeconds = ADMIN_ASSURANCE_SECONDS,
): SQL {
  if (
    !Number.isInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1 ||
    maxAgeSeconds > ADMIN_ASSURANCE_SECONDS
  )
    throw new Error("Invalid administrator assurance age.");
  return sql`public.has_admin_assurance(${userId}, ${sessionId}, ${maxAgeSeconds})`;
}

export async function recheckAdminAssurance(
  db: Pick<Database, "execute">,
  identity: Pick<Identity, "userId" | "sessionId">,
  maxAgeSeconds = ADMIN_ASSURANCE_SECONDS,
) {
  const result = await db.execute<{ allowed: boolean }>(
    sql`SELECT ${adminAssurancePredicate(identity.userId, identity.sessionId, maxAgeSeconds)} AS allowed`,
  );
  if (!result.rows[0]?.allowed) throw new AccessError(403);
}

/** Runtime-compatible: provider identity is resolved first; SQL is authoritative. */
export async function requireAdminAssurance(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const identity = await requireIdentity(runtime, headers);
  await recheckAdminAssurance(runtime.db, identity);
  return identity;
}
