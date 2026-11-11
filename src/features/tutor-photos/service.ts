import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { auditEvents, tutorPhotos, tutorProfiles } from "@/lib/db/schema";
import {
  AccessError,
  requireIdentity,
  requireRole,
} from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { RuleError } from "@/lib/rule-error";
import { tutorCanEdit } from "@/features/tutors/review-rules";
import { adminMayReviewTutor } from "@/features/tutors/review";
import { readPublicTutor } from "@/features/tutors/public";
import { preparePhoto } from "./image";
import { discardPhotos, newPhotoKey, type PhotoStorage } from "./storage";

/** What the tutor sees about their own photo on Account settings. */
export type OwnTutorPhoto = {
  approvedId: string | null;
  pendingId: string | null;
  /** The most recent photo was not approved and nothing replaced it yet. */
  rejected: boolean;
};

/** null when the account has no tutor profile yet. */
export async function readOwnTutorPhoto(
  runtime: AuthRuntime,
  headers: Headers,
): Promise<OwnTutorPhoto | null> {
  const identity = await requireRole(runtime, headers, "tutor");
  const [profile] = await runtime.db
    .select({ id: tutorProfiles.id })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, identity.userId));
  if (!profile) return null;
  const photos = await runtime.db
    .select({ id: tutorPhotos.id, status: tutorPhotos.status })
    .from(tutorPhotos)
    .where(eq(tutorPhotos.tutorId, profile.id))
    .orderBy(desc(tutorPhotos.createdAt))
    .limit(20);
  return {
    approvedId: photos.find((p) => p.status === "approved")?.id ?? null,
    pendingId: photos.find((p) => p.status === "pending")?.id ?? null,
    rejected: photos[0]?.status === "rejected",
  };
}

/**
 * Stores a new photo for review. It replaces any photo still waiting; an
 * approved photo stays public until an admin approves the new one.
 */
export async function submitTutorPhoto(
  runtime: AuthRuntime,
  headers: Headers,
  storage: PhotoStorage | null,
  upload: Uint8Array,
) {
  if (!storage)
    throw new RuleError(409, "Photo uploads aren't available here yet.");
  const identity = await requireRole(runtime, headers, "tutor");
  const photo = await preparePhoto(upload);
  const key = newPhotoKey();
  await storage.put(key, photo);
  let saved;
  try {
    saved = await runtime.db.transaction(async (tx) => {
      const [profile] = await tx
        .select({ id: tutorProfiles.id, status: tutorProfiles.reviewStatus })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.userId, identity.userId))
        .for("update");
      await recheckIdentity(tx, identity, "tutor");
      if (!profile)
        throw new RuleError(
          409,
          "Save your tutor profile before adding a photo.",
        );
      if (!tutorCanEdit(profile.status))
        throw new RuleError(
          409,
          "This profile can't be edited right now. Contact support.",
        );
      const replaced = await tx
        .update(tutorPhotos)
        .set({ status: "replaced" })
        .where(
          and(
            eq(tutorPhotos.tutorId, profile.id),
            eq(tutorPhotos.status, "pending"),
          ),
        )
        .returning({ key: tutorPhotos.objectKey });
      const [row] = await tx
        .insert(tutorPhotos)
        .values({
          tutorId: profile.id,
          objectKey: key,
          byteSize: photo.byteLength,
        })
        .returning({ id: tutorPhotos.id });
      await tx.insert(auditEvents).values({
        actorUserId: identity.userId,
        targetUserId: identity.userId,
        action: "tutor_photo.submitted",
      });
      return { id: row.id, stale: replaced.map((r) => r.key) };
    });
  } catch (error) {
    await discardPhotos(storage, [key]);
    throw error;
  }
  await discardPhotos(storage, saved.stale);
  return { pendingId: saved.id };
}

/** Takes down the tutor's photo, public and waiting alike; initials return. */
export async function removeTutorPhoto(
  runtime: AuthRuntime,
  headers: Headers,
  storage: PhotoStorage | null,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  const removed = await runtime.db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, identity.userId))
      .for("update");
    await recheckIdentity(tx, identity, "tutor");
    if (!profile) return [];
    const rows = await tx
      .update(tutorPhotos)
      .set({ status: "removed" })
      .where(
        and(
          eq(tutorPhotos.tutorId, profile.id),
          inArray(tutorPhotos.status, ["pending", "approved"]),
        ),
      )
      .returning({ key: tutorPhotos.objectKey });
    if (rows.length)
      await tx.insert(auditEvents).values({
        actorUserId: identity.userId,
        targetUserId: identity.userId,
        action: "tutor_photo.removed",
      });
    return rows.map((r) => r.key);
  });
  await discardPhotos(storage, removed);
  return { removed: removed.length > 0 };
}

/**
 * The image bytes for a photo id, or null. An approved photo of a publicly
 * listed tutor is public. Otherwise only its tutor, or an admin who may review
 * that tutor, can open a pending or approved photo. Nothing else is served.
 */
export async function readTutorPhotoForServing(
  runtime: AuthRuntime,
  headers: Headers,
  storage: PhotoStorage | null,
  photoId: string,
) {
  if (!storage || !z.uuid().safeParse(photoId).success) return null;
  const [photo] = await runtime.db
    .select({
      key: tutorPhotos.objectKey,
      status: tutorPhotos.status,
      tutorId: tutorPhotos.tutorId,
      ownerId: tutorProfiles.userId,
      slug: tutorProfiles.slug,
    })
    .from(tutorPhotos)
    .innerJoin(tutorProfiles, eq(tutorProfiles.id, tutorPhotos.tutorId))
    .where(
      and(
        eq(tutorPhotos.id, photoId),
        inArray(tutorPhotos.status, ["pending", "approved"]),
      ),
    );
  if (!photo) return null;
  const shared =
    photo.status === "approved" && !!(await readPublicTutor(photo.slug));
  if (!shared) {
    let identity;
    try {
      identity = await requireIdentity(runtime, headers);
    } catch (error) {
      if (error instanceof AccessError) return null;
      throw error;
    }
    const allowed =
      identity.userId === photo.ownerId ||
      (identity.roles.includes("admin") &&
        (await adminMayReviewTutor(runtime, identity, photo.tutorId)));
    if (!allowed) return null;
  }
  const bytes = await storage.get(photo.key);
  return bytes ? { bytes, shared } : null;
}
