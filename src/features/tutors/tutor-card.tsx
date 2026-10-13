import Link from "next/link";
import { levelNames } from "@/features/subjects/catalog";
import { learnerLevels } from "@/lib/db/schema/app";
import { cn } from "@/lib/utils";
import type { PublicTutor } from "./eligibility";
import { teachingLanguageNames } from "./teaching-languages";
import {
  LessonTime,
  type LessonTimeValue,
} from "@/features/bookings/lesson-time";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = [words[0], words.length > 1 ? words.at(-1) : undefined]
    .map((word) => (word ? [...word][0] : ""))
    .join("");
  return letters.toLocaleUpperCase("en");
}

/** Every avatar uses the same two tokens; no photo upload exists. */
export function InitialsAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-mint text-label-strong text-foreground",
        large ? "size-20" : "size-12",
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Levels a tutor covers across all subjects, in catalog order. */
export function tutorLevels(tutor: PublicTutor) {
  return levelNames(
    learnerLevels.filter((level) =>
      tutor.offerings.some((offering) => offering.levels.includes(level)),
    ),
  );
}

/**
 * Directory rows optionally show an actual dated, viewer-local open time.
 */
export function TutorList({
  tutors,
  heading: Heading = "h2",
  nextTimes,
  timezone,
}: {
  tutors: PublicTutor[];
  heading?: "h2" | "h3";
  nextTimes?: Record<string, LessonTimeValue>;
  timezone?: string;
}) {
  return (
    <ul className="@container divide-y divide-border border-y border-border">
      {tutors.map((tutor) => {
        const names = tutor.offerings.map((offering) => offering.subjectName);
        return (
          <li
            key={tutor.slug}
            className="relative grid grid-cols-1 gap-6 py-6 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:items-start"
          >
            <div className="flex min-w-0 gap-4">
              <InitialsAvatar name={tutor.displayName} />
              <div className="min-w-0">
                <Heading className="text-item-title wrap-anywhere">
                  {tutor.displayName}
                </Heading>
                <p className="mt-2 text-body">
                  {names.slice(0, 3).join(" · ")}
                  {names.length > 3 && ` · +${names.length - 3} more`}
                </p>
                <p className="text-small text-muted-foreground">
                  {tutorLevels(tutor).join(" · ")}
                </p>
                <p className="mt-2 line-clamp-2 max-w-prose text-body wrap-anywhere text-muted-foreground">
                  {tutor.bio}
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  {tutor.teachingLanguages.length
                    ? `Teaching languages (tutor-declared): ${teachingLanguageNames(tutor.teachingLanguages).join(" · ")}`
                    : "No teaching languages listed"}
                </p>
                {nextTimes?.[tutor.slug] && (
                  <div className="mt-4">
                    <p className="text-small text-muted-foreground">
                      Next time that fits
                    </p>
                    <LessonTime value={nextTimes[tutor.slug]} />
                  </div>
                )}
              </div>
            </div>
            <Link
              href={`/tutors/${tutor.slug}${timezone ? `?displayTimezone=${encodeURIComponent(timezone)}` : ""}`}
              aria-label={`View profile: ${tutor.displayName}`}
              className="action action-outline w-full shrink-0 after:absolute after:inset-0 @3xl:w-auto"
            >
              View profile
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
