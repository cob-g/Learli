import { and, asc, eq, gt, lt } from "drizzle-orm";
import { types } from "node:util";
import type { Database } from "@/lib/db/connection";
import { tutorAvailabilityExceptions } from "@/lib/db/schema";
import {
  MAX_QUERY_RANGE_DAYS,
  type UtcInterval,
} from "@/lib/time/availability";

/** Also accepts a Drizzle transaction. Authorization/eligibility belongs to the caller. */
export async function readTutorTimeOffIntervals(
  db: Pick<Database, "select">,
  tutorId: string,
  from: Date,
  to: Date,
): Promise<UtcInterval[]> {
  // The Node import also prevents this private repository from entering a client bundle.
  if (!types.isDate(from) || !types.isDate(to))
    throw new RangeError("Use UTC Date instants.");
  const duration = to.getTime() - from.getTime();
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > MAX_QUERY_RANGE_DAYS * 86_400_000
  )
    throw new RangeError("Use a valid bounded time range.");
  if (duration === 0) return [];
  return db
    .select({
      start: tutorAvailabilityExceptions.startAtUtc,
      end: tutorAvailabilityExceptions.endAtUtc,
    })
    .from(tutorAvailabilityExceptions)
    .where(
      and(
        eq(tutorAvailabilityExceptions.tutorId, tutorId),
        lt(tutorAvailabilityExceptions.startAtUtc, to),
        gt(tutorAvailabilityExceptions.endAtUtc, from),
      ),
    )
    .orderBy(asc(tutorAvailabilityExceptions.startAtUtc));
}
