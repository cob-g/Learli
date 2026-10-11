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

export type EligibleTutor = {
  profileId: string;
  displayName: string;
  headline: string;
  offerings: {
    subjectId: string;
    subjectName: string;
    levels: LearnerLevel[];
  }[];
};

/**
 * The single definition of a publicly eligible tutor (prd.md BR-01, BR-02,
 * MATCH-02): an approved profile, on an active verified account, with at least
 * one offering on an active subject. Directory, matching and booking must all
 * read tutors through this query so they can never disagree.
 */
export async function listEligibleTutors(db: Database) {
  const rows = await db
    .select({
      profileId: tutorProfiles.id,
      displayName: user.name,
      headline: tutorProfiles.headline,
      subjectId: subjects.id,
      subjectName: subjects.name,
      levels: tutorSubjects.levels,
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
      ),
    )
    .orderBy(asc(user.name), asc(tutorProfiles.id), asc(subjects.name));
  const tutors = new Map<string, EligibleTutor>();
  for (const { subjectId, subjectName, levels, ...tutor } of rows) {
    const entry = tutors.get(tutor.profileId) ?? { ...tutor, offerings: [] };
    entry.offerings.push({ subjectId, subjectName, levels });
    tutors.set(tutor.profileId, entry);
  }
  return [...tutors.values()];
}
