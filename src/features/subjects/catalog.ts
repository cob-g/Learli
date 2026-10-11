// Client-safe labels for stored catalog values. Imports types only, so no
// database code reaches a browser bundle.
import type { LearnerLevel, SubjectCategory } from "@/lib/db/schema/app";

export const subjectCategoryOptions = [
  ["academic_core", "Academic core"],
  ["test_prep", "Test preparation"],
  ["academic_support", "Academic support"],
  ["specialized", "Specialized subjects"],
] as const satisfies readonly (readonly [SubjectCategory, string])[];

export const learnerLevelOptions = [
  ["elementary", "Elementary"],
  ["middle_school", "Middle School"],
  ["high_school", "High School"],
  ["college_support", "College Support"],
] as const satisfies readonly (readonly [LearnerLevel, string])[];

const levelLabels = new Map<LearnerLevel, string>(learnerLevelOptions);

/** Levels in catalog order, as their stored display names. */
export function levelNames(levels: readonly LearnerLevel[]) {
  return learnerLevelOptions
    .filter(([value]) => levels.includes(value))
    .map(([value]) => levelLabels.get(value)!);
}

export type CatalogSubject = {
  id: string;
  name: string;
  category: SubjectCategory;
  isActive: boolean;
};

/** Subjects under their category label, in catalog order. Empty groups are dropped. */
export function groupSubjects<T extends CatalogSubject>(
  subjects: readonly T[],
) {
  return subjectCategoryOptions
    .map(([category, label]) => ({
      category,
      label,
      subjects: subjects
        .filter((subject) => subject.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
    }))
    .filter((group) => group.subjects.length > 0);
}
