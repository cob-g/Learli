import { and, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { user, userAccess, auditEvents } from "@/lib/db/schema";
import {
  requireIdentity,
  requireOwnership,
  AccessError,
} from "@/lib/permissions/access";
import { timeZoneSchema } from "@/lib/validation/time-zone";
import { recheckIdentity } from "@/lib/permissions/recheck";

export const accountInput = z.strictObject({
  name: z.string().trim().min(1).max(100),
  timezone: timeZoneSchema,
});
export async function readAccount(
  runtime: AuthRuntime,
  headers: Headers,
  ownerId?: string,
) {
  const identity = await requireIdentity(runtime, headers);
  requireOwnership(identity, ownerId ?? identity.userId);
  const [account] = await runtime.db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
    })
    .from(user)
    .innerJoin(userAccess, eq(user.id, userAccess.userId))
    .where(
      and(
        eq(user.id, identity.userId),
        eq(user.emailVerified, true),
        eq(userAccess.status, "active"),
        "hosted" in runtime
          ? and(
              inArray(user.email, [...runtime.hosted.accountEmails]),
              sql`EXISTS(SELECT 1 FROM public.session s WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>clock_timestamp())`,
            )
          : sql`true`,
      ),
    );
  if (!account) throw new AccessError(404);
  return { ...account, roles: identity.roles };
}
export async function updateAccount(
  runtime: AuthRuntime,
  headers: Headers,
  ownerId: string,
  input: unknown,
) {
  const identity = await requireIdentity(runtime, headers);
  requireOwnership(identity, ownerId);
  const values = accountInput.parse(input);
  return runtime.db.transaction(async (tx) => {
    if ("hosted" in runtime) {
      await tx.execute(
        sql`SELECT id FROM public."user" WHERE id=${ownerId} FOR NO KEY UPDATE`,
      );
      await recheckIdentity(tx, identity);
    }
    const [updated] = await tx
      .update(user)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(user.id, ownerId),
          eq(user.emailVerified, true),
          sql`EXISTS (SELECT 1 FROM user_access WHERE user_id = ${ownerId} AND status = 'active')`,
          "hosted" in runtime
            ? and(
                inArray(user.email, [...runtime.hosted.accountEmails]),
                sql`EXISTS(SELECT 1 FROM public.session s WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>clock_timestamp())`,
              )
            : sql`true`,
        ),
      )
      .returning({ id: user.id, name: user.name, timezone: user.timezone });
    if (!updated) throw new AccessError(404);
    await tx.insert(auditEvents).values({
      actorUserId: identity.userId,
      targetUserId: ownerId,
      action: "account.updated",
    });
    return updated;
  });
}
