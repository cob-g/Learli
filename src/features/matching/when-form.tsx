"use client";

import Link from "next/link";
import Form from "next/form";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CircleAlert } from "lucide-react";
import type { TimeZoneOption } from "@/lib/time/zones";
import {
  matchingHref,
  parseMatchPreferences,
  timeRangeOptions,
  weekdayOptions,
  type MatchPreferences,
  type PreferenceFields,
  type PreferenceDraft,
} from "./preferences";

export function PreferenceInputs({
  preferences,
}: {
  preferences?: MatchPreferences;
}) {
  if (!preferences) return null;
  return (
    <>
      <input type="hidden" name="timezone" value={preferences.timezone} />
      <input type="hidden" name="when" value={preferences.when} />
      {preferences.when === "preferred" && (
        <>
          {preferences.days.map((day) => (
            <input key={day} type="hidden" name="days" value={day} />
          ))}
          <input type="hidden" name="range" value={preferences.range} />
        </>
      )}
    </>
  );
}
export function ChoiceError({
  message,
  id,
  focusField,
}: {
  message?: string;
  id?: string;
  focusField?: "level" | "subject";
}) {
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && focusField)
      error.current
        ?.closest("form")
        ?.querySelector<HTMLElement>(`[name="${focusField}"]`)
        ?.focus();
  }, [message, focusField]);
  return message ? (
    <p
      ref={error}
      id={id}
      role="alert"
      className="flex items-center gap-1 text-small text-error"
    >
      <CircleAlert size={16} aria-hidden="true" />
      {message}
    </p>
  ) : null;
}

/** Native GET works without scripts; hydration only detects a zone and focuses errors. */
export function WhenForm({
  level,
  subject,
  preferences,
  draft,
  fields,
  zones,
}: {
  level: string;
  subject: string;
  preferences?: MatchPreferences;
  draft: PreferenceDraft;
  fields: PreferenceFields;
  zones: TimeZoneOption[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const [timezone, setTimezone] = useState(draft.timezone ?? "");
  const [when, setWhen] = useState(draft.when ?? "");
  const [days, setDays] = useState(draft.days);
  const [range, setRange] = useState(draft.range ?? "");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = () => {
      setPending(false);
      const url = new URL(window.location.href);
      if (
        url.pathname !== "/get-matched" ||
        url.searchParams.get("level") !== level ||
        url.searchParams.get("subject") !== subject
      )
        return;
      const params = url.searchParams;
      const restored = parseMatchPreferences({
        timezone:
          params.getAll("timezone").length === 1
            ? (params.get("timezone") ?? "")
            : params.getAll("timezone"),
        when:
          params.getAll("when").length === 1
            ? (params.get("when") ?? "")
            : params.getAll("when"),
        days: params.getAll("days"),
        range:
          params.getAll("range").length === 1
            ? (params.get("range") ?? "")
            : params.getAll("range"),
      }).preferences;
      if (restored) {
        setTimezone(restored.timezone);
        setWhen(restored.when);
        setDays(restored.when === "preferred" ? restored.days : []);
        setRange(restored.when === "preferred" ? restored.range : "");
      }
    };
    Promise.resolve().then(restore);
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [level, subject]);
  useEffect(() => {
    if (
      !draft.timezone &&
      !fields.timezone &&
      !new URL(window.location.href).searchParams.has("timezone")
    ) {
      Promise.resolve().then(() => {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (zones.some((zone) => zone.value === detected))
          setTimezone(detected);
      });
    }
    const first = Object.keys(fields)[0];
    if (first)
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [fields, draft, zones]);
  const answers = { level, subject, preferences };
  return (
    <Form
      ref={form}
      action="/get-matched"
      prefetch={false}
      className="mt-2"
      aria-busy={pending}
      onSubmit={(event) => {
        if (pending) event.preventDefault();
        else {
          const data = new FormData(event.currentTarget);
          const saved = parseMatchPreferences({
            timezone: String(data.get("timezone") ?? ""),
            when: String(data.get("when") ?? ""),
            days: data.getAll("days").map(String),
            range: String(data.get("range") ?? ""),
          }).preferences;
          if (saved)
            window.history.replaceState(
              null,
              "",
              matchingHref({ level, subject, preferences: saved }, "when"),
            );
          flushSync(() => setPending(true));
        }
      }}
    >
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="submit" value="results" />
      <h2 className="text-section-title">When would you like a lesson?</h2>
      <div className="mt-4">
        <label className="block text-label" htmlFor="matching-zone">
          Your time zone
        </label>
        <select
          id="matching-zone"
          name="timezone"
          className="field mt-2"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
          aria-invalid={!!fields.timezone}
          aria-describedby={fields.timezone ? "timezone-error" : "zone-help"}
        >
          <option value="">Choose your time zone</option>
          {zones.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>
        <ChoiceError id="timezone-error" message={fields.timezone} />
        <p
          id="zone-help"
          className="mt-2 max-w-prose text-small text-muted-foreground"
        >
          Choose the time zone for the days and times below.
        </p>
      </div>
      <fieldset
        className="mt-4"
        aria-invalid={!!fields.when}
        aria-describedby={fields.when ? "when-error" : undefined}
      >
        <legend className="text-label">Time preference</legend>
        <ChoiceError id="when-error" message={fields.when} />
        {(
          [
            ["any", "Any time"],
            ["preferred", "Preferred days and times"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className="group mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-control bg-surface px-4 py-3 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
          >
            <input
              type="radio"
              name="when"
              value={value}
              className="size-5 shrink-0"
              checked={when === value}
              onChange={() => setWhen(value)}
              required
            />
            <span className="min-w-0 wrap-anywhere">{label}</span>
            <span
              aria-hidden="true"
              className="ms-auto hidden size-2 shrink-0 rounded-full bg-brand-teal group-has-checked:block"
            />
          </label>
        ))}
      </fieldset>
      <p className="mt-2 max-w-prose text-small text-muted-foreground">
        Any time searches all days and times. The choices below apply only to
        preferred days and times.
      </p>
      <fieldset
        className="mt-4"
        aria-describedby={fields.days ? "days-error" : "day-help"}
      >
        <legend className="text-label">Preferred weekdays</legend>
        <ChoiceError id="days-error" message={fields.days} />
        <div className="mt-2 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          {weekdayOptions.map(([value, label]) => (
            <label
              key={value}
              className="group mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-control bg-surface px-4 py-3 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
            >
              <input
                type="checkbox"
                name="days"
                value={value}
                className="size-5 shrink-0"
                checked={days.includes(value)}
                onChange={(event) =>
                  setDays((previous) =>
                    event.target.checked
                      ? [...previous, value]
                      : previous.filter((day) => day !== value),
                  )
                }
                aria-invalid={!!fields.days}
              />
              <span className="min-w-0 wrap-anywhere">{label}</span>
              <span
                aria-hidden="true"
                className="ms-auto hidden size-2 shrink-0 rounded-full bg-brand-teal group-has-checked:block"
              />
            </label>
          ))}
        </div>
        <p
          id="day-help"
          className="mt-2 max-w-prose text-small text-muted-foreground"
        >
          Choose one or more weekdays for preferred times.
        </p>
      </fieldset>
      <fieldset
        className="mt-4"
        aria-invalid={!!fields.range}
        aria-describedby={fields.range ? "range-error" : "range-help"}
      >
        <legend className="text-label">Preferred time of day</legend>
        <ChoiceError id="range-error" message={fields.range} />
        {timeRangeOptions.map((option) => (
          <label
            key={option.value}
            className="group mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-control bg-surface px-4 py-3 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse has-checked:[--focus-ring:var(--focus-ring-inverse)] has-checked:[&_.text-muted-foreground]:text-on-inverse"
          >
            <input
              type="radio"
              name="range"
              value={option.value}
              className="size-5 shrink-0"
              checked={range === option.value}
              onChange={() => setRange(option.value)}
            />
            <span className="min-w-0 wrap-anywhere">{option.label}</span>
            <span
              aria-hidden="true"
              className="ms-auto hidden size-2 shrink-0 rounded-full bg-brand-teal group-has-checked:block"
            />
          </label>
        ))}
        <p
          id="range-help"
          className="mt-2 max-w-prose text-small text-muted-foreground"
        >
          The entire lesson must fit the chosen days and time range in your time
          zone.
        </p>
      </fieldset>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
        {pending && (
          <p role="status" className="sr-only">
            Finding matching tutors
          </p>
        )}
        <button
          className="action action-primary w-full sm:w-auto"
          type="submit"
          aria-disabled={pending}
        >
          {pending ? "Finding matching tutors…" : "Show matching tutors"}
        </button>
        <Link
          className="inline-flex min-h-11 items-center"
          href={matchingHref(answers, "subject")}
        >
          Back
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/tutors">
          Browse all tutors
        </Link>
      </div>
    </Form>
  );
}
