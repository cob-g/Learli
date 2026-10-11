import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import {
  subjects,
  tutorProfiles,
  tutorSubjects,
  user,
  userAccess,
  userRoles,
  type LearnerLevel,
} from "@/lib/db/schema";
import { teachingLanguagesSelection } from "./language-query";
import type { TeachingLanguageCode } from "./teaching-languages";

/** Everything the public may see about a tutor. Nothing else leaves this module. */
export type PublicTutor = {
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  teachingBackground: string;
  teachingLanguages: TeachingLanguageCode[];
  offerings: {
    subjectSlug: string;
    subjectName: string;
    levels: LearnerLevel[];
    specialty: string | null;
  }[];
};
export type TutorFilters = {
  subject?: string;
  level?: LearnerLevel;
  language?: TeachingLanguageCode;
};

/**
 * The single definition of a publicly eligible tutor (prd.md BR-01, BR-02,
 * MATCH-02): an approved profile, on an active verified account, with at least
 * one offering on an active subject. Directory, tutor page, matching and booking
 * must all read tutors through this module so they can never disagree.
 */
async function eligibleTutors(db: Pick<Database, "select">, slug?: string) {
  const rows = await db
    .select({
      slug: tutorProfiles.slug,
      displayName: user.name,
      headline: tutorProfiles.headline,
      bio: tutorProfiles.bio,
      teachingBackground: tutorProfiles.teachingBackground,
      teachingLanguages: teachingLanguagesSelection(),
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
        sql`EXISTS (SELECT 1 FROM ${userRoles} r WHERE r.user_id = ${user.id} AND r.role = 'tutor')`,
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
  if (!filters.subject && !filters.level && !filters.language) return tutors;
  return tutors.filter(
    (tutor) =>
      (!filters.language ||
        tutor.teachingLanguages.includes(filters.language)) &&
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
  db: Pick<Database, "select">,
  filters: TutorFilters = {},
) {
  return filterTutors(await eligibleTutors(db), filters);
}

/** One eligible tutor, or null. Ineligible and unknown look the same. */
export async function findEligibleTutor(
  db: Pick<Database, "select">,
  slug: string,
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  return (await eligibleTutors(db, slug))[0] ?? null;
}
