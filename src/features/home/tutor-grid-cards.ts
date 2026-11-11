import type { LessonTimeValue } from "@/features/bookings/lesson-time";
import type { PublicTutor } from "@/features/tutors/eligibility";
import { profileHref, tutorLevels } from "@/features/tutors/tutor-card";
import { teachingLanguageNames } from "@/features/tutors/teaching-languages";
import { tutorPhotoUrl } from "@/features/tutor-photos/photo-url";
import { nameInitials } from "@/lib/initials";
import type { TutorGridCard } from "./tutor-grid";

/**
 * Card data from the public tutor read only: no new fields, no new queries.
 * The directory passes its filters (kept in each profile link) and, with a
 * lesson-time preference, each tutor's next fitting time.
 */
export function tutorGridCards(
  tutors: PublicTutor[],
  directory?: {
    subject?: string;
    level?: string;
    timezone?: string;
    nextTimes?: Record<string, LessonTimeValue>;
  },
): TutorGridCard[] {
  return tutors.map((tutor) => {
    const next = directory?.nextTimes?.[tutor.slug];
    return {
      slug: tutor.slug,
      name: tutor.displayName,
      initials: nameInitials(tutor.displayName),
      photoUrl: tutor.photoId ? tutorPhotoUrl(tutor.photoId) : null,
      // Offerings arrive in subject-name order; the first is the main subject.
      subject: tutor.offerings[0]?.subjectName ?? "",
      levels: tutorLevels(tutor).join(" · "),
      summary: tutor.bio,
      languages: teachingLanguageNames(tutor.teachingLanguages),
      href: directory
        ? profileHref(
            tutor.slug,
            directory.subject,
            directory.level,
            directory.timezone,
            next,
          )
        : `/tutors/${tutor.slug}`,
      ...(directory?.nextTimes && {
        timeFit: next
          ? { label: `${next.date}, ${next.time}`, dateTime: next.startAtUtc }
          : null,
      }),
    };
  });
}
