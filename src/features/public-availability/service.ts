import { blockingBookingPredicate } from "@/features/booking-workflows/model";
// Node-only read service, also used directly by isolated PostgreSQL tests.
import { and, asc, gt, inArray, lt, sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  bookings,
  tutorAvailability,
  tutorAvailabilityExceptions,
  tutorProfiles,
} from "@/lib/db/schema";
import { isLoopbackOrigin } from "@/lib/local-mode";
import type { ScreeningScope } from "@/features/tutor-screening/policy";
import { listEligibleTutorsBySlugs } from "@/features/tutors/eligibility";
import { demoBookingPolicy } from "@/features/bookings/demo-policy";
import {
  demoCandidateIntervals,
  demoCandidateRange,
} from "@/features/bookings/demo-schedule";
import { createLessonTimeFormatter } from "@/features/bookings/format-time";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";
import {
  PUBLIC_CANDIDATE_LIMITS,
  publicCandidateQueryInput,
  publicDirectoryCandidateQueryInput,
  type PublicCandidateQuery,
} from "./input";

export type PublicCandidateTime = LessonTimeValue & {
  tutorTime: LessonTimeValue;
};
export type PublicTutorCandidates = {
  tutorSlug: string;
  state: "available" | "empty" | "unavailable";
  times: PublicCandidateTime[];
};
export type PublicCandidates = {
  source: "local_simulation";
  generatedAtUtc: string;
  from: string;
  to: string;
  durationMinutes: number;
  stepMinutes: number;
  tutors: PublicTutorCandidates[];
};

export class PublicAvailabilityUnavailable extends Error {
  readonly status = 503;
}

const overload = () =>
  new PublicAvailabilityUnavailable(
    "Open times could not be loaded. Try a smaller selection or try again later.",
  );

/**
 * One consistent, read-only snapshot; six bounded SQL statements regardless of
 * tutor count. No learner/session/participant columns, locks, writes or expiry
 * events. Elapsed reservations are simply not busy. Create always revalidates.
 */
export async function readPublicCandidates(
  runtime: AuthRuntime,
  input: unknown,
  scope: ScreeningScope = "local_demo",
): Promise<PublicCandidates> {
  assertLocal(runtime);
  if (scope !== "local_demo" && scope !== "synthetic_readiness")
    throw overload();
  if (scope === "synthetic_readiness" && runtime.environment !== "test")
    throw overload();
  return readCandidates(runtime, publicCandidateQueryInput.parse(input), scope);
}

/** Optional offering filters for directory reads only, with the same public DTO. */
export async function readPublicDirectoryCandidates(
  runtime: AuthRuntime,
  input: unknown,
  scope: ScreeningScope = "local_demo",
): Promise<PublicCandidates> {
  assertLocal(runtime);
  if (scope !== "local_demo" && scope !== "synthetic_readiness")
    throw overload();
  if (scope === "synthetic_readiness" && runtime.environment !== "test")
    throw overload();
  return readCandidates(
    runtime,
    publicDirectoryCandidateQueryInput.parse(input),
    scope,
  );
}

function assertLocal(runtime: AuthRuntime) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new PublicAvailabilityUnavailable(
      "Local simulated open times are unavailable.",
    );
}

async function readCandidates(
  runtime: AuthRuntime,
  query: Omit<PublicCandidateQuery, "subjectSlug" | "level"> &
    Partial<Pick<PublicCandidateQuery, "subjectSlug" | "level">> & {
      language?: import("@/features/tutors/teaching-languages").TeachingLanguageCode;
    },
  scope: ScreeningScope = "local_demo",
): Promise<PublicCandidates> {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new PublicAvailabilityUnavailable(
      "Local simulated open times are unavailable.",
    );
  return runtime.db.transaction(
    async (tx) => {
      const clock = await tx.execute<{ milliseconds: number }>(
        sql`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::float8 AS milliseconds`,
      );
      const now = new Date(clock.rows[0].milliseconds);
      const range = demoCandidateRange(now, query);
      const eligible = await listEligibleTutorsBySlugs(
        tx,
        query.tutorSlugs,
        {
          subject: query.subjectSlug,
          level: query.level,
          language: query.language,
        },
        scope,
      );
      const base = {
        source: "local_simulation" as const,
        generatedAtUtc: now.toISOString(),
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        durationMinutes: demoBookingPolicy.durationMinutes,
        stepMinutes: demoBookingPolicy.stepMinutes,
      };
      const eligibleSlugs = eligible.map((tutor) => tutor.slug);
      if (!eligibleSlugs.length || range.from >= range.to)
        return {
          ...base,
          tutors: query.tutorSlugs.map((tutorSlug) => ({
            tutorSlug,
            state: eligibleSlugs.includes(tutorSlug) ? "empty" : "unavailable",
            times: [],
          })),
        };
      const profiles = await tx
        .select({
          id: tutorProfiles.id,
          slug: tutorProfiles.slug,
          timezone: tutorProfiles.timezone,
        })
        .from(tutorProfiles)
        .where(inArray(tutorProfiles.slug, eligibleSlugs))
        .limit(PUBLIC_CANDIDATE_LIMITS.tutors);
      const ids = profiles.map((profile) => profile.id);
      const windows = await tx
        .select({
          tutorId: tutorAvailability.tutorId,
          isoWeekday: tutorAvailability.isoWeekday,
          startMinute: tutorAvailability.startMinute,
          endMinute: tutorAvailability.endMinute,
        })
        .from(tutorAvailability)
        .where(inArray(tutorAvailability.tutorId, ids))
        .limit(PUBLIC_CANDIDATE_LIMITS.windows + 1);
      const exceptions = await tx
        .select({
          tutorId: tutorAvailabilityExceptions.tutorId,
          start: tutorAvailabilityExceptions.startAtUtc,
          end: tutorAvailabilityExceptions.endAtUtc,
        })
        .from(tutorAvailabilityExceptions)
        .where(
          and(
            inArray(tutorAvailabilityExceptions.tutorId, ids),
            lt(tutorAvailabilityExceptions.startAtUtc, range.busyTo),
            gt(tutorAvailabilityExceptions.endAtUtc, range.from),
          ),
        )
        .limit(PUBLIC_CANDIDATE_LIMITS.exceptions + 1);
      const busy = await tx
        .select({
          tutorId: bookings.tutorId,
          start: bookings.startAtUtc,
          end: bookings.endAtUtc,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.tutorId, ids),
            blockingBookingPredicate(sql`bookings`, now),
            lt(bookings.startAtUtc, range.busyTo),
            gt(bookings.endAtUtc, range.from),
          ),
        )
        .orderBy(asc(bookings.startAtUtc))
        .limit(PUBLIC_CANDIDATE_LIMITS.busy + 1);
      if (
        windows.length > PUBLIC_CANDIDATE_LIMITS.windows ||
        exceptions.length > PUBLIC_CANDIDATE_LIMITS.exceptions ||
        busy.length > PUBLIC_CANDIDATE_LIMITS.busy
      )
        throw overload();
      // At most one viewer zone plus 20 tutor zones, retained only for this batch.
      const timeFormatters = new Map<
        string,
        ReturnType<typeof createLessonTimeFormatter>
      >();
      const formatTime = (start: Date, end: Date, timezone: string) => {
        let formatter = timeFormatters.get(timezone);
        if (!formatter) {
          formatter = createLessonTimeFormatter(timezone);
          timeFormatters.set(timezone, formatter);
        }
        return formatter(start, end);
      };
      const tutors = query.tutorSlugs.map(
        (tutorSlug): PublicTutorCandidates => {
          const profile = profiles.find((row) => row.slug === tutorSlug);
          if (!profile) return { tutorSlug, state: "unavailable", times: [] };
          const intervals = demoCandidateIntervals({
            timezone: profile.timezone,
            windows: windows.filter((row) => row.tutorId === profile.id),
            busy: [...exceptions, ...busy].filter(
              (row) => row.tutorId === profile.id,
            ),
            from: range.from,
            to: range.to,
          });
          if (intervals.length > PUBLIC_CANDIDATE_LIMITS.timesPerTutor)
            throw overload();
          const times = intervals.map(({ start, end }) => ({
            ...formatTime(start, end, query.displayTimezone),
            tutorTime: formatTime(start, end, profile.timezone),
          }));
          return {
            tutorSlug,
            state: times.length ? "available" : "empty",
            times,
          };
        },
      );
      return { ...base, tutors };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
