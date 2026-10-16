import Link from "next/link";
import { Check } from "lucide-react";
import type { PublicTutor } from "@/features/tutors/eligibility";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { LessonTime } from "@/features/bookings/lesson-time";
import { publicLevelInput } from "./input";
import type { ProfilePreview } from "./profile";
import type { TimeZoneOption } from "@/lib/time/zones";
import { ProfileZone } from "./profile-zone";
import { ProfileFilterForm } from "./profile-filter-form";

export function ProfilePicker({
  tutor,
  preview,
  zones,
}: {
  tutor: PublicTutor;
  preview: ProfilePreview;
  zones: TimeZoneOption[];
}) {
  const times = preview.candidates?.times ?? [];
  // Three actual dates, with native disclosure of the remaining horizon.
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: preview.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const localDate = (time: (typeof times)[number]) =>
    dayFormatter.format(new Date(time.startAtUtc));
  const days = [...new Set(times.map(localDate))];
  const level = publicLevelInput.safeParse(preview.level);
  return (
    <section aria-labelledby="choose-time-title">
      <h2 id="choose-time-title" className="text-section-title">
        Choose a time
      </h2>
      <p className="mt-2 text-small text-muted-foreground" id="preview-zone">
        {preview.needsBrowserZone
          ? `Time zone fallback: ${preview.zoneLabel}. Choose your time zone below.`
          : `Times shown in ${preview.zoneLabel}`}
      </p>
      <p className="mt-2 max-w-prose text-small">
        {preview.privateWorkflow
          ? "Previewing a time does not reserve it. You will choose the learner and request a booking next."
          : "Local simulation only. Previewing a time does not reserve it or confirm a lesson."}
      </p>
      <ProfileZone
        needsBrowserZone={preview.needsBrowserZone}
        timezone={preview.timezone}
        explicitZone={preview.explicitZone}
      />
      <ProfileFilterForm
        key={`${preview.subjectSlug}:${preview.level}:${preview.timezone}`}
        action={`/tutors/${tutor.slug}`}
      >
        <div className="space-y-2">
          <label htmlFor="preview-subject" className="block text-label">
            Subject
          </label>
          <select
            id="preview-subject"
            name="subject"
            className="field"
            defaultValue={preview.subjectSlug}
            required
          >
            <option value="">Choose a subject</option>
            {tutor.offerings.map((offering) => (
              <option key={offering.subjectSlug} value={offering.subjectSlug}>
                {offering.subjectName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="preview-level" className="block text-label">
            Level
          </label>
          <select
            id="preview-level"
            name="level"
            className="field"
            defaultValue={preview.level}
            required
          >
            <option value="">Choose a level</option>
            {learnerLevelOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="preview-timezone" className="block text-label">
            Time zone
          </label>
          <select
            id="preview-timezone"
            name="displayTimezone"
            className="field"
            defaultValue={preview.timezone}
          >
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </div>
      </ProfileFilterForm>
      {preview.message && (
        <p role="alert" className="mt-4 max-w-prose text-body">
          {preview.message}
        </p>
      )}
      {preview.candidates?.state === "unavailable" && (
        <p role="status" className="mt-4 max-w-prose text-body">
          {preview.privateWorkflow
            ? "This tutor is not taking bookings for these choices right now."
            : "This tutor isn’t taking simulated bookings for these choices right now."}{" "}
          <Link href="/tutors">Browse all tutors</Link>
        </p>
      )}
      {preview.candidates?.state === "empty" && (
        <div className="mt-8">
          <h3 className="text-item-title">No open times right now</h3>
          <p className="mt-2 max-w-prose text-body">
            Choose another subject or level, or{" "}
            <Link href="/tutors">browse all tutors</Link>.
          </p>
        </div>
      )}
      {!preview.candidates && !preview.message && (
        <p className="mt-4 text-body">
          Choose a subject and level to preview real dated times.
        </p>
      )}
      {times.length > 0 && level.success && (
        <form
          action={preview.privateWorkflow ? "/bookings/new" : "/bookings/demo"}
          method="get"
          className="mt-6 space-y-6"
          aria-describedby="preview-zone"
        >
          <input type="hidden" name="tutorSlug" value={tutor.slug} />
          <input type="hidden" name="subjectSlug" value={preview.subjectSlug} />
          <input type="hidden" name="level" value={level.data} />
          <input
            type="hidden"
            name="displayTimezone"
            value={preview.timezone}
          />
          <div className="space-y-6">
            {days.slice(0, 3).map((date) => (
              <fieldset key={date} className="max-w-full min-w-0 space-y-4">
                <legend className="mb-4 text-item-title">{date}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {times
                    .filter((time) => localDate(time) === date)
                    .map((time) => (
                      <label
                        key={time.startAtUtc}
                        className="group relative flex min-h-11 items-start gap-2 rounded-control border border-control bg-surface px-4 py-4 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
                      >
                        <input
                          required
                          type="radio"
                          name="time"
                          defaultChecked={
                            time.startAtUtc === preview.selectedStart
                          }
                          value={`${time.startAtUtc}|${time.endAtUtc}`}
                          className="peer mt-1 shrink-0"
                          aria-label={`${date} ${time.time || time.date} ${time.zone}`}
                        />
                        <span className="min-w-0 wrap-anywhere">
                          <time
                            dateTime={time.startAtUtc}
                            className="block text-time"
                          >
                            {time.time || time.date}
                          </time>
                          <span className="block text-small">{time.zone}</span>
                          <span className="mt-2 hidden items-center gap-2 text-small group-has-checked:flex">
                            <Check className="size-4" aria-hidden="true" />
                            Selected time
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
          {days.length > 3 && (
            <details
              open={times.some(
                (time) =>
                  time.startAtUtc === preview.selectedStart &&
                  days.slice(3).includes(localDate(time)),
              )}
            >
              <summary className="min-h-11 cursor-pointer text-body">
                Show later days
              </summary>
              <div className="mt-4 space-y-8">
                {days.slice(3).map((date) => (
                  <fieldset key={date} className="max-w-full min-w-0 space-y-4">
                    <legend className="mb-4 text-item-title">{date}</legend>
                    {times
                      .filter((time) => localDate(time) === date)
                      .map((time) => (
                        <label
                          key={time.startAtUtc}
                          className="flex min-h-12 items-start gap-4 rounded-control border border-control bg-surface px-4 py-4 has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
                        >
                          <input
                            required
                            type="radio"
                            name="time"
                            defaultChecked={
                              time.startAtUtc === preview.selectedStart
                            }
                            value={`${time.startAtUtc}|${time.endAtUtc}`}
                            className="mt-1 shrink-0"
                          />
                          <LessonTime value={time} />
                        </label>
                      ))}
                  </fieldset>
                ))}
              </div>
            </details>
          )}
          <button className="action action-primary w-full" type="submit">
            {preview.privateWorkflow
              ? "Review booking"
              : "Review simulated booking"}
          </button>
          <p className="text-small">
            Choose who this lesson is for after sign-in. Times will be checked
            again.
          </p>
        </form>
      )}
    </section>
  );
}
