import type { PublicTutor } from "@/features/tutors/eligibility";
import { tutorLevels } from "@/features/tutors/tutor-card";
import { teachingLanguageNames } from "@/features/tutors/teaching-languages";
import { tutorPhotoUrl } from "@/features/tutor-photos/photo-url";
import { nameInitials } from "@/lib/initials";
import type { TutorGridCard } from "./tutor-grid";

/** Card data from the public tutor read only: no new fields, no new queries. */
export function tutorGridCards(tutors: PublicTutor[]): TutorGridCard[] {
  return tutors.map((tutor) => ({
    slug: tutor.slug,
    name: tutor.displayName,
    initials: nameInitials(tutor.displayName),
    photoUrl: tutor.photoId ? tutorPhotoUrl(tutor.photoId) : null,
    // Offerings arrive in subject-name order; the first is the main subject.
    subject: tutor.offerings[0]?.subjectName ?? "",
    levels: tutorLevels(tutor).join(" · "),
    summary: tutor.bio,
    languages: teachingLanguageNames(tutor.teachingLanguages),
    href: `/tutors/${tutor.slug}`,
  }));
}
