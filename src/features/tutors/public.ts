import {
  getPrivateWorkflow,
  isPrivateWorkflow,
} from "@/features/private-workflow/runtime";
import "server-only";
import { publicationContext } from "@/features/review-publication/composition";
import { requirePublicationPolicy } from "@/features/review-publication/service";
import { getDomainAuthRuntime } from "@/lib/auth";
import { listSubjects } from "@/features/subjects/service";
import {
  findEligibleTutor,
  listEligibleTutors,
  type PublicTutor,
} from "./eligibility";
import { readDirectoryAvailability } from "./directory-availability";
import type { MatchPreferences } from "@/features/matching/preferences";
import type { TutorFilters } from "./eligibility";

export const tutorsPerPage = 20;

/**
 * Public catalog for discovery pages: eligible tutors plus the subjects a
 * visitor may choose. Without local configuration there is honestly nothing to
 * list. A failed read returns null so the page can say it could not load.
 */
export async function readPublicCatalog() {
  try {
    const runtime = await getDomainAuthRuntime();
    if (!runtime) return { tutors: [] as PublicTutor[], subjects: [] };
    const [tutors, catalog] = await Promise.all([
      listEligibleTutors(
        runtime.db,
        {},
        isPrivateWorkflow(runtime) ? "synthetic_readiness" : "local_demo",
        getPrivateWorkflow(runtime),
      ),
      listSubjects(runtime.db, true),
    ]);
    const offered = new Set(
      tutors.flatMap((tutor) => tutor.offerings.map((o) => o.subjectSlug)),
    );
    // A specialized subject is advertised only while an eligible tutor offers it.
    const subjects = catalog.filter(
      (subject) =>
        subject.category !== "specialized" || offered.has(subject.slug),
    );
    return { tutors, subjects };
  } catch {
    return null;
  }
}
export type PublicCatalog = NonNullable<
  Awaited<ReturnType<typeof readPublicCatalog>>
>;

/** undefined when the read failed, null when no eligible tutor has that slug. */
export async function readPublicTutor(slug: string) {
  try {
    const runtime = await getDomainAuthRuntime();
    if (!runtime) return null;
    const context = publicationContext(runtime);
    const scope = isPrivateWorkflow(runtime)
      ? "synthetic_readiness"
      : context.publication.authority === "disabled"
        ? "local_demo"
        : (requirePublicationPolicy(context), "synthetic_readiness");
    return await findEligibleTutor(
      runtime.db,
      slug,
      scope,
      getPrivateWorkflow(runtime),
    );
  } catch {
    return undefined;
  }
}

/** Provider failure is distinct from genuine no matches. */
export async function readDirectoryTimes(
  tutors: PublicTutor[],
  filters: TutorFilters,
  preferences: MatchPreferences,
) {
  try {
    const runtime = await getDomainAuthRuntime();
    if (!runtime) return null;
    return await readDirectoryAvailability(
      runtime,
      tutors,
      filters,
      preferences,
    );
  } catch {
    return null;
  }
}

export { parseTutorSearch, tutorsHref } from "./search";
