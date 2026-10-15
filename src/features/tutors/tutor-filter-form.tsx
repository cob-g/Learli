"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  timeRangeOptions,
  weekdayOptions,
  type PreferenceDraft,
  type PreferenceFields,
} from "@/features/matching/preferences";
import type { TimeZoneOption } from "@/lib/time/zones";
import {
  groupSubjects,
  learnerLevelOptions,
  type CatalogSubject,
} from "@/features/subjects/catalog";
import {
  teachingLanguageLabels,
  type TeachingLanguageCode,
} from "./teaching-languages";

/**
 * Subject and level search as a plain GET form, so it works without JavaScript.
 * "finder" is the home page entry; "filters" is the directory's own form.
 */
export function TutorFilterForm({
  variant,
  subjects,
  subject,
  level,
  languages = [],
  language,
  draft = { days: [] },
  fields = {},
  zones = [],
}: {
  variant: "finder" | "filters";
  subjects: (CatalogSubject & { slug: string })[];
  subject?: string;
  level?: string;
  languages?: TeachingLanguageCode[];
  language?: TeachingLanguageCode;
  draft?: PreferenceDraft;
  fields?: PreferenceFields;
  zones?: TimeZoneOption[];
}) {
  const finder = variant === "finder";
  const [pending, setPending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const restore = () => setPending(false);
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  useEffect(() => {
    const first = Object.keys(fields)[0];
    if (first)
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [fields]);
  const fieldClass = finder
    ? "min-w-0 flex-1 space-y-2"
    : "min-w-0 flex-1 space-y-2 sm:min-w-40 lg:min-w-0";
  return (
    <form
      ref={form}
      action="/tutors"
      method="get"
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        flushSync(() => setPending(true));
      }}
      aria-busy={pending}
      role="search"
      aria-label={finder ? "Find a tutor" : "Filter tutors"}
      className={
        finder
          ? "flex flex-col gap-4"
          : "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end lg:flex-col lg:items-stretch"
      }
    >
      <div className={fieldClass}>
        <label htmlFor={`${variant}-subject`} className="block text-label">
          Subject
        </label>
        <select
          className="field"
          id={`${variant}-subject`}
          name="subject"
          defaultValue={subject ?? ""}
        >
          <option value="">Any subject</option>
          {groupSubjects(subjects).map((group) => (
            <optgroup key={group.category} label={group.label}>
              {group.subjects.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className={fieldClass}>
        <label htmlFor={`${variant}-level`} className="block text-label">
          Level
        </label>
        <select
          className="field"
          id={`${variant}-level`}
          name="level"
          defaultValue={level ?? ""}
        >
          <option value="">Any level</option>
          {learnerLevelOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {finder ? (
        <button
          className="action action-primary w-full"
          type="submit"
          disabled={pending}
        >
          Find a tutor
        </button>
      ) : (
        <>
          {(languages.length > 0 || language) && (
            <div className={fieldClass}>
              <label htmlFor="filters-language" className="block text-label">
                Teaching language
              </label>
              <select
                className="field"
                id="filters-language"
                name="language"
                defaultValue={language ?? ""}
              >
                <option value="">Any teaching language</option>
                {language && !languages.includes(language) && (
                  <option value={language}>
                    {teachingLanguageLabels[language]} (no tutors listed)
                  </option>
                )}
                {languages.map((code) => (
                  <option key={code} value={code}>
                    {teachingLanguageLabels[code]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <details
            open={!!draft.when || Object.keys(fields).length > 0}
            className="w-full"
          >
            <summary className="min-h-11 cursor-pointer text-label">
              Lesson time (optional)
            </summary>
            <p className="mt-2 text-small text-muted-foreground">
              Choose a time zone for your weekdays and times. This does not
              change your account time zone.
            </p>
            <label className="mt-4 block text-label" htmlFor="filters-when">
              Availability filter
            </label>
            <select
              id="filters-when"
              name="when"
              className="field mt-2"
              defaultValue={draft.when ?? ""}
              aria-invalid={!!fields.when}
              aria-describedby={
                fields.when ? "directory-when-error" : undefined
              }
            >
              <option value="">Browse without a time filter</option>
              <option value="preferred">Preferred days and times</option>
              <option value="any">Any available time</option>
            </select>
            <PreferenceError field="when" message={fields.when} />
            <label className="mt-4 block text-label" htmlFor="filters-zone">
              Your time zone
            </label>
            <select
              id="filters-zone"
              name="timezone"
              className="field mt-2"
              defaultValue={draft.timezone ?? ""}
              aria-invalid={!!fields.timezone}
              aria-describedby={
                fields.timezone ? "directory-timezone-error" : undefined
              }
            >
              <option value="">Choose your time zone</option>
              {zones.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
            <PreferenceError field="timezone" message={fields.timezone} />
            <fieldset
              className="mt-4"
              aria-describedby={
                fields.days ? "directory-days-error" : undefined
              }
            >
              <legend className="text-label">Preferred weekdays</legend>
              <PreferenceError field="days" message={fields.days} />
              {weekdayOptions.map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 items-center gap-2 text-body"
                >
                  <input
                    type="checkbox"
                    name="days"
                    value={value}
                    defaultChecked={draft.days.includes(value)}
                    className="size-5"
                    aria-invalid={!!fields.days}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="mt-4 block text-label" htmlFor="filters-range">
              Preferred time of day
            </label>
            <select
              id="filters-range"
              name="range"
              className="field mt-2"
              defaultValue={draft.range ?? ""}
              aria-invalid={!!fields.range}
              aria-describedby={
                fields.range ? "directory-range-error" : "directory-time-help"
              }
            >
              <option value="">Choose one time range</option>
              {timeRangeOptions.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <PreferenceError field="range" message={fields.range} />
            <p
              id="directory-time-help"
              className="mt-2 text-small text-muted-foreground"
            >
              The whole lesson must fit. Weekdays and time range apply only to
              preferred times.
            </p>
          </details>
          <div className="flex flex-wrap items-center gap-4">
            {pending && (
              <p role="status" className="sr-only">
                Loading tutors
              </p>
            )}
            <button
              className="action action-outline"
              type="submit"
              disabled={pending}
              aria-disabled={pending}
            >
              {pending ? "Loading tutors…" : "Apply filters"}
            </button>
            <Link className="inline-flex min-h-11 items-center" href="/tutors">
              Clear filters
            </Link>
          </div>
        </>
      )}
    </form>
  );
}

function PreferenceError({
  field,
  message,
}: {
  field: string;
  message?: string;
}) {
  return message ? (
    <p
      id={`directory-${field}-error`}
      role="alert"
      className="mt-2 text-small text-error"
    >
      {message}
    </p>
  ) : null;
}
