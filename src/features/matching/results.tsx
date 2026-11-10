import Link from "next/link";
import { LessonTime } from "@/features/bookings/lesson-time";
import { formatLessonTime } from "@/features/bookings/format-time";
import { InitialsAvatar, tutorLevels } from "@/features/tutors/tutor-card";
import { levelNames } from "@/features/subjects/catalog";
import { publicProfileHref } from "@/features/public-availability/links";
import type { LearnerLevel } from "@/lib/db/schema";
import type { AvailableMatch } from "./match";
import type { MatchAlternative } from "./alternatives";
import {
  timeRangeOptions,
  weekdayOptions,
  type MatchPreferences,
} from "./preferences";

export function preferenceDescription(preferences: MatchPreferences) {
  return preferences.when === "any"
    ? "Any time"
    : `${weekdayOptions
        .filter(([value]) => preferences.days.includes(value))
        .map(([, label]) => label)
        .join(
          ", ",
        )} · ${timeRangeOptions.find((option) => option.value === preferences.range)?.label}`;
}
export function MatchResultList({
  matches,
  preferences,
  profileHref,
  privateWorkflow = false,
}: {
  matches: AvailableMatch[];
  preferences: MatchPreferences;
  profileHref: (match: AvailableMatch) => string;
  privateWorkflow?: boolean;
}) {
  return (
    <ul className="@container divide-y divide-border border-y border-border">
      {matches.map(({ tutor, nextTime }) => (
        <li
          key={tutor.slug}
          className="relative grid grid-cols-1 gap-6 py-6 @3xl:grid-cols-[minmax(0,1fr)_13rem_auto] @3xl:items-start"
        >
          <div className="flex min-w-0 gap-4">
            <InitialsAvatar name={tutor.displayName} />
            <div className="min-w-0">
              <h2 className="text-item-title wrap-anywhere">
                {tutor.displayName}
              </h2>
              <p className="mt-2 text-body">
                {tutor.offerings
                  .map((offering) => offering.subjectName)
                  .slice(0, 3)
                  .join(" · ")}
              </p>
              <p className="text-small text-muted-foreground">
                {tutorLevels(tutor).join(" · ")}
              </p>
              <p className="mt-2 line-clamp-2 max-w-prose text-body wrap-anywhere text-muted-foreground">
                {tutor.bio}
              </p>
              <p className="mt-2 max-w-prose text-small text-muted-foreground">
                {preferences.when === "any"
                  ? privateWorkflow
                    ? "Has an open time in the next 14 days."
                    : "Has an open time in the demo search window."
                  : "Has an open time within your chosen weekdays and time range."}
              </p>
            </div>
          </div>
          <div className="min-w-0 shrink-0 rounded-control bg-surface p-4 @3xl:w-52">
            <p className="mb-2 text-label">Next open time</p>
            <LessonTime
              value={formatLessonTime(
                new Date(nextTime.startAtUtc),
                new Date(nextTime.endAtUtc),
                preferences.timezone,
              )}
            />
          </div>
          <Link
            href={profileHref({ tutor, nextTime })}
            aria-label={`View profile: ${tutor.displayName}`}
            className="action action-outline w-full shrink-0 after:absolute after:inset-0 @3xl:w-auto"
          >
            View profile
          </Link>
        </li>
      ))}
    </ul>
  );
}

function alternativeNote(
  item: MatchAlternative,
  subjectName: string,
  levelName: string,
  privateWorkflow: boolean,
) {
  const levels = (values: LearnerLevel[]) => levelNames(values).join(", ");
  switch (item.kind) {
    case "time":
      return `Teaches ${subjectName} at ${levelName}, but has no open time on your chosen days and times. Its next open time is shown.`;
    case "unscheduled":
      return `Teaches ${subjectName} at ${levelName}, but has no open time ${privateWorkflow ? "in the next 14 days" : "in the demo search window"}.`;
    case "level":
      return `Teaches ${subjectName} for ${levels(item.levels)}, not ${levelName}.`;
    case "subject":
      return `Teaches ${item.subjects.join(", ")} at ${levelName}, not ${subjectName}.`;
    case "other":
      return `Does not teach ${subjectName} or ${levelName}.`;
  }
}

/** A real offering of the tutor to open their profile on, closest first. */
function alternativeHref(
  item: MatchAlternative,
  subject: string,
  level: LearnerLevel,
  timezone: string,
) {
  const offering =
    item.kind === "time" || item.kind === "unscheduled"
      ? { subjectSlug: subject, level }
      : item.kind === "level"
        ? { subjectSlug: subject, level: item.levels[0] }
        : item.kind === "subject"
          ? {
              subjectSlug: item.tutor.offerings.find((o) =>
                o.levels.includes(level),
              )!.subjectSlug,
              level,
            }
          : {
              subjectSlug: item.tutor.offerings[0].subjectSlug,
              level: item.tutor.offerings[0].levels[0],
            };
  return publicProfileHref({
    tutorSlug: item.tutor.slug,
    displayTimezone: timezone,
    ...offering,
    ...(item.kind === "time"
      ? {
          startAtUtc: item.nextTime.startAtUtc,
          endAtUtc: item.nextTime.endAtUtc,
        }
      : {}),
  });
}

/**
 * Shown under an empty match: the nearest eligible tutors, each saying exactly
 * which answer it does not fit. They are not presented as matches.
 */
export function MatchAlternatives({
  alternatives,
  subject,
  subjectName,
  level,
  levelName,
  timezone,
  privateWorkflow = false,
}: {
  alternatives: MatchAlternative[];
  subject: string;
  subjectName: string;
  level: LearnerLevel;
  levelName: string;
  timezone: string;
  privateWorkflow?: boolean;
}) {
  if (!alternatives.length) return null;
  return (
    <section aria-labelledby="match-alternatives" className="mt-10">
      <h2 id="match-alternatives" className="text-item-title">
        Closest available tutors
      </h2>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        These tutors do not fit every answer. Each one says what is different,
        so you can decide whether to look at their profile.
      </p>
      <ul className="@container mt-6 divide-y divide-border border-y border-border">
        {alternatives.map((item) => (
          <li
            key={item.tutor.slug}
            className="relative grid grid-cols-1 gap-6 py-6 @3xl:grid-cols-[minmax(0,1fr)_13rem_auto] @3xl:items-start"
          >
            <div className="flex min-w-0 gap-4">
              <InitialsAvatar name={item.tutor.displayName} />
              <div className="min-w-0">
                <h3 className="text-item-title wrap-anywhere">
                  {item.tutor.displayName}
                </h3>
                <p className="mt-2 text-body">
                  {item.tutor.offerings
                    .map((offering) => offering.subjectName)
                    .slice(0, 3)
                    .join(" · ")}
                </p>
                <p className="text-small text-muted-foreground">
                  {tutorLevels(item.tutor).join(" · ")}
                </p>
                <p className="mt-2 max-w-prose text-small text-warning">
                  {alternativeNote(
                    item,
                    subjectName,
                    levelName,
                    privateWorkflow,
                  )}
                </p>
              </div>
            </div>
            {item.kind === "time" ? (
              <div className="min-w-0 shrink-0 rounded-control bg-surface p-4 @3xl:w-52">
                <p className="mb-2 text-label">Next open time</p>
                <LessonTime
                  value={formatLessonTime(
                    new Date(item.nextTime.startAtUtc),
                    new Date(item.nextTime.endAtUtc),
                    timezone,
                  )}
                />
              </div>
            ) : (
              <div className="hidden @3xl:block" />
            )}
            <Link
              href={alternativeHref(item, subject, level, timezone)}
              aria-label={`View profile: ${item.tutor.displayName}`}
              className="action action-outline w-full shrink-0 after:absolute after:inset-0 @3xl:w-auto"
            >
              View profile
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
