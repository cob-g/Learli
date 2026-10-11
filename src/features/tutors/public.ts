import "server-only";
import { getAuthRuntime } from "@/lib/auth";
import { listSubjects } from "@/features/subjects/service";
import {
  findEligibleTutor,
  listEligibleTutors,
  type PublicTutor,
} from "./eligibility";

export const tutorsPerPage = 20;

/**
 * Public catalog for discovery pages: eligible tutors plus the subjects a
 * visitor may choose. Without local configuration there is honestly nothing to
 * list. A failed read returns null so the page can say it could not load.
 */
export async function readPublicCatalog() {
  try {
    const runtime = getAuthRuntime();
    if (!runtime) return { tutors: [] as PublicTutor[], subjects: [] };
    const tutors = await listEligibleTutors(runtime.db);
    const offered = new Set(
      tutors.flatMap((tutor) => tutor.offerings.map((o) => o.subjectSlug)),
    );
    // A specialized subject is advertised only while an eligible tutor offers it.
    const subjects = (await listSubjects(runtime.db, true)).filter(
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
    const runtime = getAuthRuntime();
    return runtime ? await findEligibleTutor(runtime.db, slug) : null;
  } catch {
    return undefined;
  }
}

export { parseTutorSearch, tutorsHref } from "./search";
