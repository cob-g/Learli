import type { LearnerLevel } from "@/lib/db/schema";

export type BookingLearnerChoice = {
  id: string;
  displayName: string;
  level: LearnerLevel;
  management: "guardian" | "self";
};

export type BookingTutorChoice = {
  slug: string;
  displayName: string;
  offerings: {
    subjectSlug: string;
    subjectName: string;
    levels: LearnerLevel[];
  }[];
};

export function bookingSubjects(
  tutors: readonly BookingTutorChoice[],
  level?: LearnerLevel,
) {
  const subjects = new Map<string, { value: string; label: string }>();
  for (const tutor of tutors)
    for (const offering of tutor.offerings)
      if (!level || offering.levels.includes(level))
        subjects.set(offering.subjectSlug, {
          value: offering.subjectSlug,
          label: offering.subjectName,
        });
  return [...subjects.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "en"),
  );
}

export function bookingTutors(
  tutors: readonly BookingTutorChoice[],
  level?: LearnerLevel,
  subjectSlug?: string,
) {
  return tutors.filter((tutor) =>
    tutor.offerings.some(
      (offering) =>
        (!level || offering.levels.includes(level)) &&
        (!subjectSlug || offering.subjectSlug === subjectSlug),
    ),
  );
}

export function bookingHistoryScope(
  learners: readonly Pick<BookingLearnerChoice, "id" | "management">[],
  selectedLearnerId: string | undefined,
  hint: "guardian" | "student" | undefined,
) {
  const selected = learners.find((learner) => learner.id === selectedLearnerId);
  if (selected)
    return selected.management === "guardian" ? "guardian" : "student";
  if (hint) return hint;
  const modes = new Set(learners.map((learner) => learner.management));
  if (modes.size === 1 && modes.has("guardian")) return "guardian";
  return "student";
}
