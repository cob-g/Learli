import { blockingBookingPredicate } from "@/features/booking-workflows/model";
import { inArray, and, asc, count, eq, gt, lt, sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  auditEvents,
  bookings,
  tutorAvailabilityExceptions,
  tutorProfiles,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { RuleError } from "@/lib/rule-error";
import { tutorCanEdit } from "@/features/tutors/review-rules";
import { maxTimeOffIntervals, timeOffInput } from "./input";
import { resolveLocalTime } from "./local-time";
export { readTutorTimeOffIntervals } from "./repository";

/** One joined SELECT snapshots the zone, revision and dated records together. */
export async function readOwnTimeOff(runtime: AuthRuntime, headers: Headers) {
  const identity = await requireRole(runtime, headers, "tutor");
  const rows = await runtime.db
    .select({
      timezone: tutorProfiles.timezone,
      version: tutorProfiles.availabilityVersion,
      reviewStatus: tutorProfiles.reviewStatus,
      exception: {
        id: tutorAvailabilityExceptions.id,
        startAtUtc: tutorAvailabilityExceptions.startAtUtc,
        endAtUtc: tutorAvailabilityExceptions.endAtUtc,
      },
    })
    .from(tutorProfiles)
    .leftJoin(
      tutorAvailabilityExceptions,
      eq(tutorAvailabilityExceptions.tutorId, tutorProfiles.id),
    )
    .where(eq(tutorProfiles.userId, identity.userId))
    .orderBy(
      asc(tutorAvailabilityExceptions.startAtUtc),
      asc(tutorAvailabilityExceptions.id),
    );
  if (!rows.length) return null;
  return {
    timezone: rows[0].timezone,
    version: rows[0].version,
    editable: tutorCanEdit(rows[0].reviewStatus),
    exceptions: rows.flatMap(({ exception }) =>
      exception
        ? [
            {
              id: exception.id,
              startAtUtc: exception.startAtUtc.toISOString(),
              endAtUtc: exception.endAtUtc.toISOString(),
            },
          ]
        : [],
    ),
  };
}
export type OwnTimeOff = NonNullable<
  Awaited<ReturnType<typeof readOwnTimeOff>>
>;

export async function saveOwnTimeOff(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const identity = await requireRole(runtime, headers, "tutor");
  const values = timeOffInput.parse(input);
  return runtime.db.transaction(async (tx) => {
    // First domain lock. Booking must lock this same row before conflict reads.
    const [profile] = await tx
      .select({
        id: tutorProfiles.id,
        timezone: tutorProfiles.timezone,
        reviewStatus: tutorProfiles.reviewStatus,
        version: tutorProfiles.availabilityVersion,
      })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, identity.userId))
      .for("update");
    // A queued operation must observe provider/session/role/access revocations.
    await recheckIdentity(tx, identity, "tutor");
    if (!profile)
      throw new RuleError(
        409,
        "Submit your tutor profile before adding time off.",
      );
    if (!tutorCanEdit(profile.reviewStatus))
      throw new RuleError(
        409,
        "Time off cannot be changed on this account. Return to your tutor workspace.",
      );
    if (
      profile.version !== values.version ||
      (values.operation === "add" && profile.timezone !== values.timezone)
    )
      throw new RuleError(
        409,
        "Your schedule or time zone changed in another tab. Reload the page and review the saved time off before trying again.",
      );
    if (values.operation === "add") {
      const startAtUtc = resolveLocalTime(values.startLocal, profile.timezone);
      const endAtUtc = resolveLocalTime(values.endLocal, profile.timezone);
      const [total] = await tx
        .select({ value: count() })
        .from(tutorAvailabilityExceptions)
        .where(eq(tutorAvailabilityExceptions.tutorId, profile.id));
      if (total.value >= maxTimeOffIntervals)
        throw new RuleError(
          409,
          `Remove an existing period before adding more than ${maxTimeOffIntervals} periods of time off.`,
        );
      const [duplicate] = await tx
        .select({ id: tutorAvailabilityExceptions.id })
        .from(tutorAvailabilityExceptions)
        .where(
          and(
            eq(tutorAvailabilityExceptions.tutorId, profile.id),
            eq(tutorAvailabilityExceptions.startAtUtc, startAtUtc),
            eq(tutorAvailabilityExceptions.endAtUtc, endAtUtc),
          ),
        )
        .limit(1);
      if (duplicate)
        throw new RuleError(
          409,
          "This period of time off is already saved. Review the saved periods below.",
        );
      // Booking and time off share tutor-profile-first locking. Capture current
      // DB time after any lock wait; expired demos never block time off.
      const clock = await tx.execute<{ milliseconds: number }>(
        sql`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::float8 AS milliseconds`,
      );
      const [reservation] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.tutorId, profile.id),
            blockingBookingPredicate(
              sql`bookings`,
              new Date(clock.rows[0].milliseconds),
            ),
            lt(bookings.startAtUtc, endAtUtc),
            gt(bookings.endAtUtc, startAtUtc),
          ),
        )
        .limit(1);
      if (reservation)
        throw new RuleError(
          409,
          "This period overlaps a simulated reservation. Choose another period or wait for the reservation to expire.",
        );
      await tx
        .insert(tutorAvailabilityExceptions)
        .values({ tutorId: profile.id, startAtUtc, endAtUtc });
    } else {
      const removed = await tx
        .delete(tutorAvailabilityExceptions)
        .where(
          and(
            eq(tutorAvailabilityExceptions.tutorId, profile.id),
            eq(tutorAvailabilityExceptions.id, values.id),
          ),
        )
        .returning({ id: tutorAvailabilityExceptions.id });
      if (!removed.length)
        throw new RuleError(
          404,
          "We can't find that period of time off on this account. Reload the page.",
        );
    }
    const version = profile.version + 1;
    await tx
      .update(tutorProfiles)
      .set({ availabilityVersion: version, updatedAt: new Date() })
      .where(eq(tutorProfiles.id, profile.id));
    await tx.insert(auditEvents).values({
      actorUserId: identity.userId,
      targetUserId: identity.userId,
      action: "tutor_time_off.updated",
    });
    const exceptions = await tx
      .select({
        id: tutorAvailabilityExceptions.id,
        startAtUtc: tutorAvailabilityExceptions.startAtUtc,
        endAtUtc: tutorAvailabilityExceptions.endAtUtc,
      })
      .from(tutorAvailabilityExceptions)
      .where(eq(tutorAvailabilityExceptions.tutorId, profile.id))
      .orderBy(
        asc(tutorAvailabilityExceptions.startAtUtc),
        asc(tutorAvailabilityExceptions.id),
      );
    return {
      version,
      exceptions: exceptions.map((row) => ({
        ...row,
        startAtUtc: row.startAtUtc.toISOString(),
        endAtUtc: row.endAtUtc.toISOString(),
      })),
    };
  });
}
