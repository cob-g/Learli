// Owner-only fixture provisioning. No web route imports this module.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { createDatabase } from "@/lib/db/connection";
import {
  supportCases,
  supportDispatchGrants,
  supportReviewerChoices,
  supportDispatchGrantEvents,
  supportReviewers,
  user,
  userAccess,
  userRoles,
} from "@/lib/db/schema";
import { syntheticEmail } from "@/lib/local-mode";
type Owner = ReturnType<typeof createDatabase>;

export async function provisionFixtureDispatch(
  owner: Owner,
  caseId: string,
  userId: string,
  kind: "dispatcher" | "reviewer_choice",
  action: "authorized" | "revoked",
) {
  if (
    owner.pool.options.user !== "learli_owner" ||
    owner.pool.options.host !== "127.0.0.1" ||
    !["learli_dev", "learli_test"].includes(String(owner.pool.options.database))
  )
    throw new Error("Use isolated local owner tooling.");
  z.uuid().parse(caseId);
  z.enum(["dispatcher", "reviewer_choice"]).parse(kind);
  z.enum(["authorized", "revoked"]).parse(action);
  z.string().min(1).max(128).parse(userId);
  return owner.db.transaction(async (tx) => {
    const [report] = await tx
      .select({ requester: supportCases.requesterUserId })
      .from(supportCases)
      .where(
        and(
          eq(supportCases.id, caseId),
          eq(supportCases.source, "local_synthetic"),
        ),
      )
      .for("update");
    if (!report || report.requester === userId)
      throw new Error("Case is unavailable for this fixture.");
    const table =
      kind === "dispatcher" ? supportDispatchGrants : supportReviewerChoices;
    const person =
      kind === "dispatcher"
        ? supportDispatchGrants.dispatcherUserId
        : supportReviewerChoices.reviewerUserId;
    const [prior] = await tx
      .select({ status: table.status, source: table.source })
      .from(table)
      .where(and(eq(table.caseId, caseId), eq(person, userId)));
    if (action === "revoked") {
      if (prior?.status !== "authorized") return;
      await tx
        .update(table)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(and(eq(table.caseId, caseId), eq(person, userId)));
    } else {
      const [account] = await tx
        .select({ email: user.email })
        .from(user)
        .innerJoin(userAccess, eq(userAccess.userId, user.id))
        .innerJoin(userRoles, eq(userRoles.userId, user.id))
        .where(
          and(
            eq(user.id, userId),
            eq(user.emailVerified, true),
            eq(userAccess.status, "active"),
            eq(userRoles.role, "admin"),
          ),
        );
      if (!account || !syntheticEmail(account.email))
        throw new Error("Use an active verified synthetic admin fixture.");
      if (kind === "reviewer_choice") {
        const [cap] = await tx
          .select({ id: supportReviewers.userId })
          .from(supportReviewers)
          .where(
            and(
              eq(supportReviewers.userId, userId),
              eq(supportReviewers.source, "local_fixture"),
              eq(supportReviewers.status, "authorized"),
            ),
          );
        if (!cap)
          throw new Error(
            "Provision reviewer capability before the case choice.",
          );
      }
      if (prior) {
        if (prior.status !== "authorized" || prior.source !== "local_fixture")
          throw new Error("Existing revoked grant preserved.");
        return;
      }
      if (kind === "reviewer_choice") {
        const count = await tx.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM support_reviewer_choices WHERE case_id=${caseId}::uuid`,
        );
        if (count.rows[0].n >= 20)
          throw new Error("The local case reviewer-choice bound was reached.");
        await tx.insert(supportReviewerChoices).values({
          caseId,
          reviewerUserId: userId,
          source: "local_fixture",
          status: "authorized",
        });
      } else
        await tx.insert(supportDispatchGrants).values({
          caseId,
          dispatcherUserId: userId,
          source: "local_fixture",
          status: "authorized",
        });
    }
    await tx
      .insert(supportDispatchGrantEvents)
      .values({ caseId, userId, kind, action });
  });
}
