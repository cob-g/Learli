import { asc, eq } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { auditEvents, tutorAvailability, tutorProfiles } from "@/lib/db/schema";
import { requireRole } from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { RuleError } from "@/lib/rule-error";
import { expandWeeklyWindows } from "@/lib/time/availability";
import { tutorCanEdit } from "@/features/tutors/review-rules";
import { availabilityInput } from "./input";
import { readTutorTimeOffIntervals } from "@/features/time-off/repository";
import { subtractTimeOff } from "@/features/time-off/intervals";

/** One SELECT gives a consistent zone/revision/window snapshot, even during saves. */
export async function readOwnAvailability(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  const rows = await runtime.db
    .select({
      timezone: tutorProfiles.timezone,
      version: tutorProfiles.availabilityVersion,
      reviewStatus: tutorProfiles.reviewStatus,
      window: {
        isoWeekday: tutorAvailability.isoWeekday,
        startMinute: tutorAvailability.startMinute,
        endMinute: tutorAvailability.endMinute,
      },
    })
    .from(tutorProfiles)
    .leftJoin(
      tutorAvailability,
      eq(tutorAvailability.tutorId, tutorProfiles.id),
    )
    .where(eq(tutorProfiles.userId, identity.userId))
    .orderBy(
      asc(tutorAvailability.isoWeekday),
      asc(tutorAvailability.startMinute),
    );
  if (!rows.length) return null;
  return {
    timezone: rows[0].timezone,
    version: rows[0].version,
    editable: tutorCanEdit(rows[0].reviewStatus),
    windows: rows.flatMap((row) => (row.window ? [row.window] : [])),
  };
}
export type OwnAvailability = NonNullable<
  Awaited<ReturnType<typeof readOwnAvailability>>
>;

/** Private schedule intervals, not public/bookable slots; no duration policy is assumed. */
export async function readOwnAvailabilityIntervals(
  runtime: AuthRuntime,
  headers: Headers,
  from: Date,
  to: Date,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  return runtime.db.transaction(async (tx) => {
    // Shared lock prevents mixing revisions across weekly/time-off reads.
    const [profile] = await tx
      .select()
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, identity.userId))
      .for("share");
    await recheckIdentity(tx, identity, "tutor");
    if (!profile || !tutorCanEdit(profile.reviewStatus))
      throw new RuleError(409, "Availability is unavailable.");
    const windows = await tx
      .select()
      .from(tutorAvailability)
      .where(eq(tutorAvailability.tutorId, profile.id));
    const open = expandWeeklyWindows({
      timeZone: profile.timezone,
      windows,
      from,
      to,
    });
    const busy = await readTutorTimeOffIntervals(tx, profile.id, from, to);
    return subtractTimeOff(open, busy);
  });
}

export async function saveOwnAvailability(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  const values = availabilityInput.parse(input);
  return runtime.db.transaction(async (tx) => {
    // The same row is locked by profile edits and admin status updates.
    const [profile] = await tx
      .select({
        id: tutorProfiles.id,
        reviewStatus: tutorProfiles.reviewStatus,
        version: tutorProfiles.availabilityVersion,
      })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, identity.userId))
      .for("update");
    await recheckIdentity(tx, identity, "tutor");
    if (!profile)
      throw new RuleError(
        409,
        "Submit your tutor profile before setting weekly hours.",
      );
    if (!tutorCanEdit(profile.reviewStatus))
      throw new RuleError(
        409,
        "Your tutor profile is suspended. Availability cannot be changed.",
      );
    if (profile.version !== values.version)
      throw new RuleError(
        409,
        "Your schedule or time zone changed in another tab. Reload the page and review the saved hours before trying again.",
      );
    await tx
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.tutorId, profile.id));
    if (values.windows.length)
      await tx
        .insert(tutorAvailability)
        .values(
          values.windows.map((window) => ({ ...window, tutorId: profile.id })),
        );
    const version = profile.version + 1;
    await tx
      .update(tutorProfiles)
      .set({
        timezone: values.timezone,
        availabilityVersion: version,
        updatedAt: new Date(),
      })
      .where(eq(tutorProfiles.id, profile.id));
    await tx.insert(auditEvents).values({
      actorUserId: identity.userId,
      targetUserId: identity.userId,
      action: "tutor_availability.updated",
    });
    return { version };
  });
}
