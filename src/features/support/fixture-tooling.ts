// Owner-only local fixture operations. Never imported by a runtime route/page.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { createDatabase } from "@/lib/db/connection";
import {
  supportCases,
  supportCaseAssignments,
  supportCaseEvents,
  supportReviewers,
  supportReviewerEvents,
  user,
  userAccess,
  userRoles,
} from "@/lib/db/schema";
import { syntheticEmail } from "@/lib/local-mode";

type Owner = ReturnType<typeof createDatabase>;
type Tx = Parameters<Parameters<Owner["db"]["transaction"]>[0]>[0];
function trusted(owner: Owner) {
  if (
    owner.pool.options.user !== "learli_owner" ||
    owner.pool.options.host !== "127.0.0.1" ||
    !["learli_dev", "learli_test"].includes(String(owner.pool.options.database))
  )
    throw new Error("Use isolated local owner tooling.");
}
async function reviewerAccount(tx: Tx, id: string) {
  const [row] = await tx
    .select({ email: user.email })
    .from(user)
    .innerJoin(userAccess, eq(userAccess.userId, user.id))
    .innerJoin(userRoles, eq(userRoles.userId, user.id))
    .where(
      and(
        eq(user.id, id),
        eq(user.emailVerified, true),
        eq(userAccess.status, "active"),
        eq(userRoles.role, "admin"),
      ),
    );
  if (!row || !syntheticEmail(row.email))
    throw new Error(
      "Reviewer must be an active verified synthetic admin fixture.",
    );
}
export async function authorizeFixtureReviewer(owner: Owner, userId: string) {
  trusted(owner);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`support-reviewer:${userId}`}, 0))`,
    );
    await reviewerAccount(tx, userId);
    const [existing] = await tx
      .select()
      .from(supportReviewers)
      .where(eq(supportReviewers.userId, userId));
    if (existing) {
      if (
        existing.status !== "authorized" ||
        existing.source !== "local_fixture"
      )
        throw new Error("Existing revoked capability preserved.");
      return;
    }
    await tx
      .insert(supportReviewers)
      .values({ userId, source: "local_fixture", status: "authorized" });
    await tx
      .insert(supportReviewerEvents)
      .values({ reviewerUserId: userId, action: "authorized" });
  });
}
export async function revokeFixtureReviewer(owner: Owner, userId: string) {
  trusted(owner);
  return owner.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(supportReviewers)
      .set({ status: "revoked" })
      .where(
        and(
          eq(supportReviewers.userId, userId),
          eq(supportReviewers.status, "authorized"),
          eq(supportReviewers.source, "local_fixture"),
        ),
      )
      .returning();
    if (updated)
      await tx
        .insert(supportReviewerEvents)
        .values({ reviewerUserId: userId, action: "revoked" });
  });
}
export async function assignFixtureCase(
  owner: Owner,
  caseId: string,
  reviewerId: string,
) {
  trusted(owner);
  z.uuid().parse(caseId);
  return owner.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(supportCases)
      .where(
        and(
          eq(supportCases.id, caseId),
          eq(supportCases.source, "local_synthetic"),
        ),
      )
      .for("update");
    if (!row || row.requesterUserId === reviewerId)
      throw new Error("Case is unavailable for this reviewer.");
    await reviewerAccount(tx, reviewerId);
    const [capability] = await tx
      .select()
      .from(supportReviewers)
      .where(
        and(
          eq(supportReviewers.userId, reviewerId),
          eq(supportReviewers.source, "local_fixture"),
          eq(supportReviewers.status, "authorized"),
        ),
      )
      .for("share");
    if (!capability) throw new Error("Reviewer capability is unavailable.");
    const [previous] = await tx
      .select()
      .from(supportCaseAssignments)
      .where(eq(supportCaseAssignments.caseId, caseId));
    if (previous?.reviewerUserId === reviewerId) return;
    const revision = row.revision + 1;
    await tx
      .insert(supportCaseAssignments)
      .values({ caseId, reviewerUserId: reviewerId })
      .onConflictDoUpdate({
        target: supportCaseAssignments.caseId,
        set: { reviewerUserId: reviewerId, updatedAt: new Date() },
      });
    await tx
      .update(supportCases)
      .set({ revision, updatedAt: new Date() })
      .where(eq(supportCases.id, caseId));
    await tx.insert(supportCaseEvents).values({
      caseId,
      action: previous ? "reassigned" : "assigned",
      previousReviewerId: previous?.reviewerUserId ?? null,
      nextReviewerId: reviewerId,
      revision,
    });
  });
}
