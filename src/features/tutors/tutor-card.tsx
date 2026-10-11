import Link from "next/link";
import { levelNames } from "@/features/subjects/catalog";
import { learnerLevels } from "@/lib/db/schema/app";
import { cn } from "@/lib/utils";
import type { PublicTutor } from "./eligibility";

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
        "inline-flex shrink-0 items-center justify-center rounded-full bg-subtle text-label-strong text-foreground",
        large ? "size-16" : "size-10",
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
 * Tutors as one list, one row each. No time column yet: availability arrives
 * with M4, and a row never shows a time, rating or price it cannot back.
 */
export function TutorList({
  tutors,
  heading: Heading = "h2",
}: {
  tutors: PublicTutor[];
  heading?: "h2" | "h3";
}) {
  return (
    <ul className="@container divide-y divide-border rounded-surface border border-border bg-surface px-4 md:px-6">
      {tutors.map((tutor) => {
        const names = tutor.offerings.map((offering) => offering.subjectName);
        return (
          <li
            key={tutor.slug}
            className="relative flex flex-col gap-4 py-4 @3xl:flex-row @3xl:items-start @3xl:justify-between"
          >
            <div className="flex min-w-0 gap-3">
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
              </div>
            </div>
            <Link
              href={`/tutors/${tutor.slug}`}
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
