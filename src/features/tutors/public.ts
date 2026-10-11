import "server-only";
import { getAuthRuntime } from "@/lib/auth";
import { learnerLevels, type LearnerLevel } from "@/lib/db/schema/app";
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

function single(value: string | string[] | undefined) {
  return typeof value === "string" && value ? value : undefined;
}

/** Query-string filters, reduced to values the catalog knows. */
export function parseTutorSearch(
  params: Record<string, string | string[] | undefined>,
) {
  const level = learnerLevels.find((value) => value === single(params.level));
  const page = Number(single(params.page));
  return {
    subject: single(params.subject)?.slice(0, 80),
    level: level as LearnerLevel | undefined,
    page: Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

/** Link back to the directory with the given filters. */
export function tutorsHref(filters: {
  subject?: string;
  level?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.level) query.set("level", filters.level);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  const text = query.toString();
  return text ? `/tutors?${text}` : "/tutors";
}
