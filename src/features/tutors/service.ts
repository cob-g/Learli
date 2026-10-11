import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import { pgErrorCode, uniqueViolation } from "@/lib/db/errors";
import {
  auditEvents,
  subjects,
  tutorProfiles,
  tutorAvailability,
  tutorSubjects,
  tutorTeachingLanguages,
  user,
} from "@/lib/db/schema";
import { requireIdentity, requireRole } from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { RuleError } from "@/lib/rule-error";
import { slugify } from "@/features/subjects/slug";
import { tutorProfileInput } from "./input";
import { tutorCanEdit } from "./review-rules";
import { teachingLanguagesSelection } from "./language-query";

/** Readable public address; the random part keeps it unique and unguessable. */
export function tutorSlug(displayName: string) {
  return `${slugify(displayName).slice(0, 40).replace(/-+$/, "") || "tutor"}-${randomBytes(4).toString("hex")}`;
}

export const startApplicationInput = z.strictObject({});

/**
 * Gives the signed-in, verified, active account the tutor role so it can fill in
 * its own application. The role is an account type, not approval: the tutor is
 * not public until an admin approves. Only the caller's own id is ever passed,
 * and the database function can grant no role other than tutor.
 */
export async function startTutorApplication(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  startApplicationInput.parse(input);
  const identity = await requireIdentity(runtime, headers);
  if (identity.roles.includes("tutor")) return { granted: false };
  return runtime.db.transaction(async (tx) => {
    const result = await tx.execute<{ granted: boolean }>(
      sql`SELECT grant_tutor_role(${identity.userId}) AS granted`,
    );
    const granted = result.rows[0]?.granted === true;
    if (granted)
      await tx.insert(auditEvents).values({
        actorUserId: identity.userId,
        targetUserId: identity.userId,
        action: "tutor_role.self_granted",
      });
    return { granted };
  });
}

/** One profile with its offerings, or null. Callers authorize before calling. */
export async function loadTutorProfile(db: Database, where: SQL) {
  const [profile] = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      slug: tutorProfiles.slug,
      displayName: user.name,
      headline: tutorProfiles.headline,
      bio: tutorProfiles.bio,
      teachingBackground: tutorProfiles.teachingBackground,
      teachingLanguages: teachingLanguagesSelection(),
      timezone: tutorProfiles.timezone,
      reviewStatus: tutorProfiles.reviewStatus,
      createdAt: tutorProfiles.createdAt,
    })
    .from(tutorProfiles)
    .innerJoin(user, eq(user.id, tutorProfiles.userId))
    .where(where);
  if (!profile) return null;
  const offerings = await db
    .select({
      subjectId: subjects.id,
      name: subjects.name,
      category: subjects.category,
      isActive: subjects.isActive,
      levels: tutorSubjects.levels,
      specialty: tutorSubjects.specialty,
    })
    .from(tutorSubjects)
    .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
    .where(eq(tutorSubjects.tutorId, profile.id))
    .orderBy(asc(subjects.name));
  return { ...profile, offerings };
}
export type TutorProfile = NonNullable<
  Awaited<ReturnType<typeof loadTutorProfile>>
>;

/** The signed-in tutor's own profile. There is no id to guess or swap. */
export async function readOwnTutorProfile(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  return loadTutorProfile(
    runtime.db,
    eq(tutorProfiles.userId, identity.userId),
  );
}

/**
 * Creates the tutor's application as pending, or updates their existing profile.
 * Review status is never taken from input. The only move made here is a rejected
 * profile returning to pending when its owner submits it again; an approved
 * profile stays approved after an edit (owner decisions, 2026-10-11).
 */
export async function saveOwnTutorProfile(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  const { offerings, teachingLanguages, ...fields } =
    tutorProfileInput.parse(input);
  try {
    return await runtime.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: tutorProfiles.id,
          reviewStatus: tutorProfiles.reviewStatus,
          timezone: tutorProfiles.timezone,
          availabilityVersion: tutorProfiles.availabilityVersion,
        })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, identity.userId))
        .for("update");
      await recheckIdentity(tx, identity, "tutor");
      if (existing && !tutorCanEdit(existing.reviewStatus))
        throw new RuleError(
          409,
          "This profile can't be edited right now. Contact support.",
        );
      if (existing && fields.timezone !== existing.timezone) {
        const [window] = await tx
          .select({ id: tutorAvailability.id })
          .from(tutorAvailability)
          .where(eq(tutorAvailability.tutorId, existing.id))
          .limit(1);
        if (window)
          throw new RuleError(
            409,
            "Change your teaching time zone on the Availability page, together with your weekly hours.",
          );
      }
      const subjectIds = offerings.map((offering) => offering.subjectId);
      const offered = await tx
        .select({ id: subjects.id })
        .from(subjects)
        .where(
          and(inArray(subjects.id, subjectIds), eq(subjects.isActive, true)),
        );
      if (offered.length !== subjectIds.length)
        throw new RuleError(
          400,
          "One of those subjects is no longer offered. Reload the page and choose again.",
        );
      const submitted = !existing || existing.reviewStatus === "rejected";
      const reviewStatus = submitted ? "pending" : existing.reviewStatus;
      let profileId = existing?.id;
      if (profileId) {
        await tx
          .update(tutorProfiles)
          .set({
            ...fields,
            reviewStatus,
            updatedAt: new Date(),
            ...(existing && fields.timezone !== existing.timezone
              ? { availabilityVersion: existing.availabilityVersion + 1 }
              : {}),
          })
          .where(eq(tutorProfiles.id, profileId));
        await tx
          .delete(tutorSubjects)
          .where(eq(tutorSubjects.tutorId, profileId));
      } else {
        const [owner] = await tx
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, identity.userId));
        [{ id: profileId }] = await tx
          .insert(tutorProfiles)
          .values({
            ...fields,
            userId: identity.userId,
            slug: tutorSlug(owner?.name ?? ""),
          })
          .returning({ id: tutorProfiles.id });
      }
      const tutorId = profileId;
      // Older clients omit this optional field; preserve their existing set.
      if (teachingLanguages !== undefined) {
        await tx
          .delete(tutorTeachingLanguages)
          .where(eq(tutorTeachingLanguages.tutorId, tutorId));
        if (teachingLanguages.length)
          await tx.insert(tutorTeachingLanguages).values(
            teachingLanguages.map((languageCode) => ({
              tutorId,
              languageCode,
            })),
          );
      }
      await tx
        .insert(tutorSubjects)
        .values(offerings.map((offering) => ({ ...offering, tutorId })));
      await tx.insert(auditEvents).values({
        actorUserId: identity.userId,
        targetUserId: identity.userId,
        action: submitted ? "tutor_profile.submitted" : "tutor_profile.updated",
      });
      return { submitted, reviewStatus };
    });
  } catch (error) {
    // Two first submissions raced; the unique owner constraint kept one.
    if (pgErrorCode(error) === uniqueViolation)
      throw new RuleError(
        409,
        "Your application was already submitted. Reload the page.",
      );
    throw error;
  }
}
