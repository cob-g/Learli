import { sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { requireIdentity, AccessError } from "@/lib/permissions/access";
import { adminAssurancePredicate } from "./assurance";

export async function readAdminSecurity(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const identity = await requireIdentity(runtime, headers);
  if (!identity.roles.includes("admin")) throw new AccessError(403);
  const result = await runtime.db.execute<{
    enrolled: boolean;
    assured: boolean;
  }>(sql`
    SELECT coalesce(u.two_factor_enabled,false) AND EXISTS(SELECT 1 FROM public.two_factor f WHERE f.user_id=u.id AND f.verified=true) AS enrolled,
    ${adminAssurancePredicate(identity.userId, identity.sessionId)} AS assured
    FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
    JOIN public.session s ON s.user_id=u.id AND s.id=${identity.sessionId} AND s.expires_at>clock_timestamp()
    WHERE u.id=${identity.userId} AND u.email_verified AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')`);
  if (!result.rows[0]) throw new AccessError(403);
  return result.rows[0];
}
