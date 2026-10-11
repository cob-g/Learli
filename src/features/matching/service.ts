// Node-only matching composition; candidates come from the shared advisory query.
import type { AuthRuntime } from "@/lib/auth-factory";
import type { LearnerLevel } from "@/lib/db/schema";
import { filterTutors, type PublicTutor } from "@/features/tutors/eligibility";
import {
  PublicAvailabilityUnavailable,
  readPublicCandidates,
  type PublicCandidates,
} from "@/features/public-availability/service";
import { PUBLIC_CANDIDATE_LIMITS } from "@/features/public-availability/input";
import { matchAvailableTutors, type AvailableMatch } from "./match";
import type { MatchPreferences } from "./preferences";

/** Technical work bound: never truncate eligible tutors and silently rank a subset. */
export const matchingTutorLimit = 100;
export type MatchingAvailability = {
  matches: AvailableMatch[];
  window: { generatedAtUtc: string; from: string; to: string } | null;
};
export async function readMatchingAvailability(
  runtime: AuthRuntime,
  tutors: PublicTutor[],
  answers: {
    subjectSlug: string;
    level: LearnerLevel;
    preferences: MatchPreferences;
  },
): Promise<MatchingAvailability> {
  const eligible = filterTutors(tutors, {
    subject: answers.subjectSlug,
    level: answers.level,
  });
  if (eligible.length > matchingTutorLimit)
    throw new PublicAvailabilityUnavailable(
      "Matching is temporarily unavailable.",
    );
  if (!eligible.length) return { matches: [], window: null };
  const batches: PublicCandidates[] = [];
  for (
    let offset = 0;
    offset < eligible.length;
    offset += PUBLIC_CANDIDATE_LIMITS.tutors
  )
    batches.push(
      await readPublicCandidates(runtime, {
        tutorSlugs: eligible
          .slice(offset, offset + PUBLIC_CANDIDATE_LIMITS.tutors)
          .map((tutor) => tutor.slug),
        subjectSlug: answers.subjectSlug,
        level: answers.level,
        displayTimezone: answers.preferences.timezone,
      }),
    );
  // Each batch is a consistent snapshot. Use their common start-time search
  // window so a slower batch cannot give its tutors a larger ranking horizon.
  const from = new Date(
    Math.max(...batches.map((batch) => Date.parse(batch.from))),
  );
  const to = new Date(
    Math.min(...batches.map((batch) => Date.parse(batch.to))),
  );
  const generatedAtUtc = new Date(
    Math.max(...batches.map((batch) => Date.parse(batch.generatedAtUtc))),
  ).toISOString();
  const candidates = batches.flatMap((batch) =>
    batch.tutors.map((tutor) => ({
      tutorSlug: tutor.tutorSlug,
      times: tutor.times.filter(
        (time) => Date.parse(time.startAtUtc) < to.getTime(),
      ),
    })),
  );
  // The shared policy bounds candidate START times. Keep the full final lesson
  // interval for preference fitting, rather than losing a valid horizon-edge time.
  const fullEnd = new Date(to.getTime() + batches[0].durationMinutes * 60_000);
  return {
    matches: matchAvailableTutors(
      eligible,
      answers.subjectSlug,
      answers.level,
      answers.preferences,
      candidates,
      from,
      fullEnd,
    ),
    window: { generatedAtUtc, from: from.toISOString(), to: to.toISOString() },
  };
}
