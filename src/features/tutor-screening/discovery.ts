import type { AuthRuntime } from "@/lib/auth-factory";
import { getScreeningContext } from "./composition";
import { requireScreening } from "./service";
import {
  listEligibleTutors,
  findEligibleTutor,
  type TutorFilters,
} from "@/features/tutors/eligibility";
import { readPublicCandidates } from "@/features/public-availability/service";
import { commonCandidateBatchWindow } from "@/features/public-availability/batch-window";
export async function readinessDirectory(
  runtime: AuthRuntime,
  filters: TutorFilters = {},
) {
  requireScreening(getScreeningContext(runtime));
  return listEligibleTutors(runtime.db, filters, "synthetic_readiness");
}
export async function readinessTutor(runtime: AuthRuntime, slug: string) {
  requireScreening(getScreeningContext(runtime));
  return findEligibleTutor(runtime.db, slug, "synthetic_readiness");
}
export async function readinessCandidates(
  runtime: AuthRuntime,
  input: unknown,
) {
  requireScreening(getScreeningContext(runtime));
  return readPublicCandidates(runtime, input, "synthetic_readiness");
}
/** Use the existing transparent ranking rules on current scoped slot candidates. */
export async function readinessMatches(
  runtime: AuthRuntime,
  subjectSlug: string,
  level: import("@/lib/db/schema").LearnerLevel,
) {
  const tutors = await readinessDirectory(runtime, {
    subject: subjectSlug,
    level,
  });
  if (tutors.length > 100) throw new Error("Synthetic matching unavailable.");
  const batches = [];
  for (let offset = 0; offset < tutors.length; offset += 20)
    batches.push(
      await readinessCandidates(runtime, {
        tutorSlugs: tutors.slice(offset, offset + 20).map((t) => t.slug),
        subjectSlug,
        level,
        displayTimezone: "Asia/Manila",
      }),
    );
  if (!batches.length) return [];
  const window = commonCandidateBatchWindow(batches);
  const from = new Date(window.from),
    to = new Date(window.to + batches[0].durationMinutes * 60000);
  const { matchAvailableTutors } = await import("@/features/matching/match");
  return matchAvailableTutors(
    tutors,
    subjectSlug,
    level,
    { timezone: "Asia/Manila", when: "any" },
    batches.flatMap((b) =>
      b.tutors.map((t) => ({
        tutorSlug: t.tutorSlug,
        times: t.times.filter(
          (time) => Date.parse(time.startAtUtc) < to.getTime(),
        ),
      })),
    ),
    from,
    to,
  );
}
