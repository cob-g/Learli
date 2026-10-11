import { learnerLevels, type LearnerLevel } from "@/lib/db/schema/app";
import type { CatalogSubject } from "@/features/subjects/catalog";
import { filterTutors, type PublicTutor } from "@/features/tutors/eligibility";

export const matchLimit = 5;
type Subject = CatalogSubject & { slug: string };
type Params = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/**
 * Subjects a visitor may choose at a level: every core subject, and a
 * specialized subject only when an eligible tutor teaches it at that level.
 */
export function subjectChoices(
  subjects: Subject[],
  tutors: PublicTutor[],
  level: LearnerLevel,
) {
  return subjects.filter(
    (subject) =>
      subject.category !== "specialized" ||
      filterTutors(tutors, { subject: subject.slug, level }).length > 0,
  );
}

export type MatchStep =
  | { step: "level"; level?: LearnerLevel; error?: string }
  | { step: "subject"; level: LearnerLevel; choices: Subject[]; error?: string }
  | {
      step: "results";
      level: LearnerLevel;
      subject: Subject;
      tutors: PublicTutor[];
      total: number;
    };

/**
 * Which screen the answers in the query string lead to. The rule is the
 * directory's own filter: one offering with this subject at this level.
 * Rule-based, ordered by display name, and capped to a small real set.
 */
export function resolveMatch(
  params: Params,
  subjects: Subject[],
  tutors: PublicTutor[],
): MatchStep {
  const rawLevel = single(params.level);
  const level = learnerLevels.find((value) => value === rawLevel);
  if (!level)
    return {
      step: "level",
      error: rawLevel === undefined ? undefined : "Choose a level",
    };
  if (single(params.change) === "level") return { step: "level", level };
  const choices = subjectChoices(subjects, tutors, level);
  const rawSubject = single(params.subject);
  const subject = choices.find((choice) => choice.slug === rawSubject);
  if (!subject)
    return {
      step: "subject",
      level,
      choices,
      error: rawSubject === undefined ? undefined : "Choose a subject",
    };
  const matches = filterTutors(tutors, { subject: subject.slug, level });
  return {
    step: "results",
    level,
    subject,
    tutors: matches.slice(0, matchLimit),
    total: matches.length,
  };
}
