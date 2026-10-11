import Link from "next/link";
import { LessonTime } from "@/features/bookings/lesson-time";
import { formatLessonTime } from "@/features/bookings/format-time";
import { InitialsAvatar, tutorLevels } from "@/features/tutors/tutor-card";
import type { AvailableMatch } from "./match";
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
}: {
  matches: AvailableMatch[];
  preferences: MatchPreferences;
  profileHref: (match: AvailableMatch) => string;
}) {
  return (
    <ul className="@container divide-y divide-border rounded-surface border border-border bg-surface px-4 md:px-6">
      {matches.map(({ tutor, nextTime }) => (
        <li
          key={tutor.slug}
          className="relative grid grid-cols-1 gap-4 py-4 @3xl:grid-cols-[minmax(0,1fr)_13rem_auto] @3xl:items-start"
        >
          <div className="flex min-w-0 gap-3">
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
                  ? "Has an open time in the demo search window."
                  : "Has an open time within your chosen weekdays and time range."}
              </p>
            </div>
          </div>
          <div className="min-w-0 shrink-0 @3xl:w-52">
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
