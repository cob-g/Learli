// Node-only directory composition. Matching policy and ordering are unchanged.
import type { AuthRuntime } from "@/lib/auth-factory";
import { PUBLIC_CANDIDATE_LIMITS } from "@/features/public-availability/input";
import { commonCandidateBatchWindow } from "@/features/public-availability/batch-window";
import {
  PublicAvailabilityUnavailable,
  readPublicDirectoryCandidates,
} from "@/features/public-availability/service";
import {
  preferencePredicate,
  type MatchPreferences,
} from "@/features/matching/preferences";
import {
  filterTutors,
  type PublicTutor,
  type TutorFilters,
} from "./eligibility";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";

export const directoryAvailabilityLimit = 100;
export type DirectoryAvailability = {
  tutors: PublicTutor[];
  nextTimes: Record<string, LessonTimeValue>;
};

/** Complete filtered inventory only; never truncate before counting or paging. */
export async function readDirectoryAvailability(
  runtime: AuthRuntime,
  tutors: PublicTutor[],
  filters: TutorFilters,
  preferences: MatchPreferences,
): Promise<DirectoryAvailability> {
  const eligible = filterTutors(tutors, filters);
  if (eligible.length > directoryAvailabilityLimit)
    throw new PublicAvailabilityUnavailable(
      "Directory times are temporarily unavailable.",
    );
  if (!eligible.length) return { tutors: [], nextTimes: {} };
  const batches = [];
  for (
    let offset = 0;
    offset < eligible.length;
    offset += PUBLIC_CANDIDATE_LIMITS.tutors
  ) {
    batches.push(
      await readPublicDirectoryCandidates(runtime, {
        tutorSlugs: eligible
          .slice(offset, offset + PUBLIC_CANDIDATE_LIMITS.tutors)
          .map((tutor) => tutor.slug),
        ...(filters.subject ? { subjectSlug: filters.subject } : {}),
        ...(filters.level ? { level: filters.level } : {}),
        ...(filters.language ? { language: filters.language } : {}),
        displayTimezone: preferences.timezone,
      }),
    );
  }
  // Advisory per-batch snapshots share a start horizon, as in matching.
  const window = commonCandidateBatchWindow(batches);
  const from = new Date(window.from);
  const to = window.to;
  const fits = preferencePredicate(
    preferences,
    from,
    new Date(to + batches[0].durationMinutes * 60_000),
  );
  const nextTimes: Record<string, LessonTimeValue> = {};
  for (const candidate of batches.flatMap((batch) => batch.tutors)) {
    const time = candidate.times.find(
      (time) => Date.parse(time.startAtUtc) < to && fits(time),
    );
    if (time) {
      // Drop tutor-local context; directory only needs the public viewer time.
      nextTimes[candidate.tutorSlug] = {
        startAtUtc: time.startAtUtc,
        endAtUtc: time.endAtUtc,
        date: time.date,
        time: time.time,
        zone: time.zone,
      };
    }
  }
  return {
    tutors: eligible.filter((tutor) => Object.hasOwn(nextTimes, tutor.slug)),
    nextTimes,
  };
}
