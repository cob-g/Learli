import { learnerLevels, type LearnerLevel } from "@/lib/db/schema/app";
import type { CatalogSubject } from "@/features/subjects/catalog";
import { filterTutors, type PublicTutor } from "@/features/tutors/eligibility";
import {
  parseMatchPreferences,
  preferencePredicate,
  singleMatchParam,
  type CandidateTime,
  type MatchParams,
  type MatchPreferences,
  type PreferenceFields,
} from "./preferences";

export const matchLimit = 5;
type Subject = CatalogSubject & { slug: string };

/** Core choices remain available; specialized choices require an eligible offering. */
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

type Answers = { preferences?: MatchPreferences };
export type MatchStep =
  | (Answers & {
      step: "level";
      level?: LearnerLevel;
      subject?: string;
      error?: string;
    })
  | (Answers & {
      step: "subject";
      level: LearnerLevel;
      subject?: string;
      choices: Subject[];
      error?: string;
    })
  | {
      step: "when";
      level: LearnerLevel;
      subject: Subject;
      preferences?: MatchPreferences;
      fields: PreferenceFields;
    }
  | {
      step: "ready";
      level: LearnerLevel;
      subject: Subject;
      preferences: MatchPreferences;
    };

/** The route consumes only known visitor filters, never a learner record. */
export function resolveMatch(
  params: MatchParams,
  subjects: Subject[],
  tutors: PublicTutor[],
): MatchStep {
  const rawLevel = singleMatchParam(params.level);
  const level = learnerLevels.find((value) => value === rawLevel);
  const { preferences, fields } = parseMatchPreferences(params);
  if (!level)
    return {
      step: "level",
      error: params.level === undefined ? undefined : "Choose a level",
      ...(preferences ? { preferences } : {}),
    };
  const choices = subjectChoices(subjects, tutors, level);
  const rawSubject = singleMatchParam(params.subject);
  const subject = choices.find((choice) => choice.slug === rawSubject);
  const saved = {
    ...(preferences ? { preferences } : {}),
    ...(subject ? { subject: subject.slug } : {}),
  };
  if (singleMatchParam(params.change) === "level")
    return { step: "level", level, ...saved };
  if (!subject || singleMatchParam(params.change) === "subject")
    return {
      step: "subject",
      level,
      choices,
      ...saved,
      ...(!subject && params.subject !== undefined
        ? { error: "Choose a subject" }
        : {}),
    };
  if (!preferences || singleMatchParam(params.change) === "when")
    return {
      step: "when",
      level,
      subject,
      preferences,
      fields: params.submit === "results" ? fields : {},
    };
  return { step: "ready", level, subject, preferences };
}

export type AvailableMatch = { tutor: PublicTutor; nextTime: CandidateTime };

/** Directory eligibility plus actual whole-interval preference fit; no scoring. */
export function matchAvailableTutors(
  tutors: PublicTutor[],
  subject: string,
  level: LearnerLevel,
  preferences: MatchPreferences,
  candidates: readonly { tutorSlug: string; times: readonly CandidateTime[] }[],
  from: Date,
  to: Date,
) {
  const fits = preferencePredicate(preferences, from, to);
  const bySlug = new Map(
    candidates.map((candidate) => [candidate.tutorSlug, candidate.times]),
  );
  const matches: AvailableMatch[] = [];
  for (const tutor of filterTutors(tutors, { subject, level })) {
    const nextTime = bySlug
      .get(tutor.slug)
      ?.filter(fits)
      .sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc))[0];
    if (nextTime) matches.push({ tutor, nextTime });
  }
  return matches.sort(
    (a, b) =>
      a.nextTime.startAtUtc.localeCompare(b.nextTime.startAtUtc) ||
      a.tutor.displayName.localeCompare(b.tutor.displayName, "en") ||
      a.tutor.slug.localeCompare(b.tutor.slug, "en"),
  );
}
