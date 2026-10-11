import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import {
  subjects,
  tutorProfiles,
  tutorSubjects,
  user,
  userAccess,
  type LearnerLevel,
} from "@/lib/db/schema";

/** Everything the public may see about a tutor. Nothing else leaves this module. */
export type PublicTutor = {
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  teachingBackground: string;
  offerings: {
    subjectSlug: string;
    subjectName: string;
    levels: LearnerLevel[];
    specialty: string | null;
  }[];
};
export type TutorFilters = { subject?: string; level?: LearnerLevel };

/**
 * The single definition of a publicly eligible tutor (prd.md BR-01, BR-02,
 * MATCH-02): an approved profile, on an active verified account, with at least
 * one offering on an active subject. Directory, tutor page, matching and booking
 * must all read tutors through this module so they can never disagree.
 */
async function eligibleTutors(db: Database, slug?: string) {
  const rows = await db
    .select({
      slug: tutorProfiles.slug,
      displayName: user.name,
      headline: tutorProfiles.headline,
      bio: tutorProfiles.bio,
      teachingBackground: tutorProfiles.teachingBackground,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      levels: tutorSubjects.levels,
      specialty: tutorSubjects.specialty,
    })
    .from(tutorProfiles)
    .innerJoin(user, eq(user.id, tutorProfiles.userId))
    .innerJoin(userAccess, eq(userAccess.userId, user.id))
    .innerJoin(tutorSubjects, eq(tutorSubjects.tutorId, tutorProfiles.id))
    .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
    .where(
      and(
        eq(tutorProfiles.reviewStatus, "approved"),
        eq(userAccess.status, "active"),
        eq(user.emailVerified, true),
        eq(subjects.isActive, true),
        slug === undefined ? undefined : eq(tutorProfiles.slug, slug),
      ),
    )
    .orderBy(asc(user.name), asc(tutorProfiles.slug), asc(subjects.name));
  const tutors = new Map<string, PublicTutor>();
  for (const {
    subjectSlug,
    subjectName,
    levels,
    specialty,
    ...tutor
  } of rows) {
    const entry = tutors.get(tutor.slug) ?? { ...tutor, offerings: [] };
    entry.offerings.push({ subjectSlug, subjectName, levels, specialty });
    tutors.set(tutor.slug, entry);
  }
  return [...tutors.values()];
}

/** A tutor matches when one offering has the subject and the level together. */
export function filterTutors(tutors: PublicTutor[], filters: TutorFilters) {
  if (!filters.subject && !filters.level) return tutors;
  return tutors.filter((tutor) =>
    tutor.offerings.some(
      (offering) =>
        (!filters.subject || offering.subjectSlug === filters.subject) &&
        (!filters.level || offering.levels.includes(filters.level)),
    ),
  );
}

/**
 * Eligible tutors by display name. Filtering is in memory, which suits a small
 * catalog; move it into the query before inventory grows.
 */
export async function listEligibleTutors(
  db: Database,
  filters: TutorFilters = {},
) {
  return filterTutors(await eligibleTutors(db), filters);
}

/** One eligible tutor, or null. Ineligible and unknown look the same. */
export async function findEligibleTutor(db: Database, slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  return (await eligibleTutors(db, slug))[0] ?? null;
}
