import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  auditEvents,
  tutorProfiles,
  user,
  type ReviewStatus,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { reviewActionNames, reviewActions } from "./review-rules";
import { loadTutorProfile } from "./service";

export const reviewInput = z.strictObject({
  action: z.enum(reviewActionNames),
});
export const reviewQueueLimit = 50;
const notFound = "We can't find that application.";

/** The review queue, oldest first. Returns only what the queue shows. */
export async function listTutorApplications(
  runtime: AuthRuntime,
  headers: Headers,
  status?: ReviewStatus,
) {
  await requireRole(runtime, headers, "admin");
  const filter = status ? eq(tutorProfiles.reviewStatus, status) : undefined;
  const [{ total }] = await runtime.db
    .select({ total: sql<number>`count(*)::int` })
    .from(tutorProfiles)
    .where(filter);
  const applications = await runtime.db
    .select({
      id: tutorProfiles.id,
      displayName: user.name,
      headline: tutorProfiles.headline,
      reviewStatus: tutorProfiles.reviewStatus,
      createdAt: tutorProfiles.createdAt,
    })
    .from(tutorProfiles)
    .innerJoin(user, eq(user.id, tutorProfiles.userId))
    .where(filter)
    .orderBy(asc(tutorProfiles.createdAt), asc(tutorProfiles.id))
    .limit(reviewQueueLimit);
  return { total, applications };
}

/** One application for review. The owner's account id and email stay server-side. */
export async function readTutorApplication(
  runtime: AuthRuntime,
  headers: Headers,
  profileId: string,
) {
  const identity = await requireRole(runtime, headers, "admin");
  if (!z.uuid().safeParse(profileId).success)
    throw new RuleError(404, notFound);
  const profile = await loadTutorProfile(
    runtime.db,
    eq(tutorProfiles.id, profileId),
  );
  if (!profile) throw new RuleError(404, notFound);
  const { userId, ...application } = profile;
  return { ...application, ownedByReviewer: userId === identity.userId };
}

/**
 * Moves an application along one allowed transition and records who did it.
 * The update is conditional on the expected status, so of two simultaneous
 * reviews exactly one succeeds.
 */
export async function reviewTutorApplication(
  runtime: AuthRuntime,
  headers: Headers,
  profileId: string,
  input: unknown,
) {
  const identity = await requireRole(runtime, headers, "admin");
  const rule = reviewActions[reviewInput.parse(input).action];
  if (!z.uuid().safeParse(profileId).success)
    throw new RuleError(404, notFound);
  return runtime.db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ userId: tutorProfiles.userId })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.id, profileId));
    if (!profile) throw new RuleError(404, notFound);
    // Holding the admin role never lets an account decide its own application.
    if (profile.userId === identity.userId)
      throw new RuleError(403, "You can't review your own application.");
    const [updated] = await tx
      .update(tutorProfiles)
      .set({ reviewStatus: rule.to, updatedAt: new Date() })
      .where(
        and(
          eq(tutorProfiles.id, profileId),
          eq(tutorProfiles.reviewStatus, rule.from),
        ),
      )
      .returning({ reviewStatus: tutorProfiles.reviewStatus });
    if (!updated)
      throw new RuleError(
        409,
        "This application changed. Reload the page and try again.",
      );
    await tx.insert(auditEvents).values({
      actorUserId: identity.userId,
      targetUserId: profile.userId,
      action: rule.audit,
    });
    return updated;
  });
}
