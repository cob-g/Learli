"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  timeRangeOptions,
  weekdayOptions,
  type MatchPreferences,
  type PreferenceDraft,
  type PreferenceFields,
  type TimeRange,
} from "@/features/matching/preferences";
import { browserVisitTimeZone } from "@/features/public-availability/visit-timezone";
import {
  groupSubjects,
  learnerLevelOptions,
  type CatalogSubject,
} from "@/features/subjects/catalog";
import type { TimeZoneOption } from "@/lib/time/zones";
import { tutorsHref } from "./search";
import {
  teachingLanguageLabels,
  type TeachingLanguageCode,
} from "./teaching-languages";
import "./directory-search.css";

type Search = {
  subject: string;
  level: string;
  language: string;
  days: number[];
  range: TimeRange | "";
  timezone: string;
  /** "any" survives only from an older shared link until a day or time is chosen. */
  when: "any" | "preferred" | "";
};

/** Short hours for each real time-of-day window, as shown on its button. */
const rangeHours: Record<TimeRange, [string, string]> = {
  overnight: ["Early morning", "12–6 AM"],
  morning: ["Morning", "6 AM–12 PM"],
  afternoon: ["Afternoon", "12–6 PM"],
  evening: ["Evening", "6 PM–12 AM"],
};

function preferencesOf(search: Search): MatchPreferences | undefined {
  if (!search.timezone) return undefined;
  if (search.days.length && search.range)
    return {
      timezone: search.timezone,
      when: "preferred",
      days: [...search.days].sort((a, b) => a - b),
      range: search.range,
    };
  if (search.when === "any" && !search.days.length && !search.range)
    return { timezone: search.timezone, when: "any" };
  return undefined;
}

function hrefOf(search: Search) {
  return tutorsHref({
    subject: search.subject || undefined,
    level: search.level || undefined,
    language: (search.language || undefined) as
      TeachingLanguageCode | undefined,
    preferences: preferencesOf(search),
  });
}

/**
 * Find a tutor as one sentence (owner's "Find a Tutor" reference). A GET form
 * that works without JavaScript; with it, results follow every change.
 */
export function DirectorySearch({
  href,
  subjects,
  subject,
  level,
  languages,
  language,
  draft,
  zone,
  zones,
  fields,
}: {
  /** The directory address the server rendered. */
  href: string;
  subjects: (CatalogSubject & { slug: string })[];
  subject?: string;
  level?: string;
  languages: TeachingLanguageCode[];
  language?: TeachingLanguageCode;
  draft: PreferenceDraft;
  /** The viewer's time zone: from the address, else this visit's. */
  zone?: string;
  zones: TimeZoneOption[];
  fields: PreferenceFields;
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // The address last asked for, to skip a navigation that changes nothing.
  const lastTarget = useRef(href);
  const [pending, startTransition] = useTransition();
  const fromAddress = (): Search => ({
    subject: subject ?? "",
    level: level ?? "",
    language: language ?? "",
    days: draft.days,
    range: draft.range ?? "",
    timezone: zone ?? "",
    when: draft.when ?? "",
  });
  const [search, setSearch] = useState(fromAddress);
  const [open, setOpen] = useState(
    !!draft.when ||
      draft.days.length > 0 ||
      !!draft.range ||
      Object.keys(fields).length > 0,
  );
  // Back, forward, Clear filters and page links change the address without
  // this form: take their values. Our own updates (possibly several in
  // flight) already match, so a late response never undoes a newer choice.
  const [shown, setShown] = useState(href);
  const [requested, setRequested] = useState<string[]>([href]);
  if (shown !== href) {
    setShown(href);
    const index = requested.indexOf(href);
    if (index === -1) {
      setRequested([href]);
      setSearch(fromAddress());
    } else setRequested(requested.slice(index));
  }
  useEffect(() => {
    lastTarget.current = href;
  }, [href]);

  useEffect(() => {
    const first = Object.keys(fields)[0];
    if (!first) return;
    form.current
      ?.querySelector<HTMLElement>(
        first === "when" ? "[aria-controls]" : `[name="${first}"]`,
      )
      ?.focus();
  }, [fields]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function update(change: Partial<Search>, delay: number) {
    const next = { ...search, ...change };
    // A time choice needs a zone: this visit's, as the browser reports it.
    if (
      !next.timezone &&
      (next.days.length || next.range || next.when === "any")
    )
      next.timezone = browserVisitTimeZone() ?? "";
    if (change.days || change.range !== undefined) next.when = "";
    setSearch(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      const target = hrefOf(next);
      if (target === lastTarget.current) return;
      lastTarget.current = target;
      setRequested((list) => [...list, target]);
      startTransition(() => router.replace(target, { scroll: false }));
    }, delay);
  }

  const preferences = preferencesOf(search);
  const incomplete =
    search.days.length > 0 !== !!search.range && !fields.days && !fields.range;
  const filtered =
    !!(search.subject || search.level || search.language) ||
    search.days.length > 0 ||
    !!search.range ||
    !!search.when;
  const subjectGroups = groupSubjects(subjects);
  const subjectName = subjects.find(
    (item) => item.slug === search.subject,
  )?.name;
  const levelName = learnerLevelOptions.find(
    ([value]) => value === search.level,
  )?.[1];
  const knownLanguages =
    language && !languages.includes(language)
      ? [language, ...languages]
      : languages;

  return (
    <form
      ref={form}
      action="/tutors"
      method="get"
      role="search"
      aria-label="Filter tutors"
      aria-busy={pending}
      className="tutor-search"
      onSubmit={(event) => {
        event.preventDefault();
        update({}, 0);
      }}
    >
      <p className="tutor-search-sentence">
        I&apos;m looking for a tutor in{" "}
        <Pick
          label="Subject"
          name="subject"
          value={search.subject}
          text={
            subjectName ??
            (search.subject ? "an unknown subject" : "any subject")
          }
          onChange={(value) => update({ subject: value }, 150)}
        >
          <option value="">any subject</option>
          {search.subject && !subjectName && (
            <option value={search.subject}>an unknown subject</option>
          )}
          {subjectGroups.map((group) => (
            <optgroup key={group.category} label={group.label}>
              {group.subjects.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Pick>{" "}
        at{" "}
        <Pick
          label="Level"
          name="level"
          value={search.level}
          text={levelName ?? "any level"}
          onChange={(value) => update({ level: value }, 150)}
        >
          <option value="">any level</option>
          {learnerLevelOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Pick>
        {knownLanguages.length > 0 ? (
          <>
            , who teaches in{" "}
            <Pick
              label="Teaching language"
              name="language"
              value={search.language}
              text={
                search.language
                  ? teachingLanguageLabels[
                      search.language as TeachingLanguageCode
                    ]
                  : "any language"
              }
              onChange={(value) => update({ language: value }, 150)}
            >
              <option value="">any language</option>
              {knownLanguages.map((code) => (
                <option key={code} value={code}>
                  {teachingLanguageLabels[code]}
                  {languages.includes(code) ? "" : " (no tutors listed)"}
                </option>
              ))}
            </Pick>
            .
          </>
        ) : (
          "."
        )}
      </p>

      <div
        className="tutor-search-time"
        id="tutor-search-time"
        data-collapsed={!open || undefined}
      >
        <fieldset
          className="tutor-search-group"
          aria-describedby={fields.days ? "directory-days-error" : undefined}
        >
          <legend>Days</legend>
          <div className="tutor-search-toggles">
            {weekdayOptions.map(([value, label]) => (
              <label key={value} className="tutor-search-toggle-option">
                <input
                  type="checkbox"
                  name="days"
                  value={value}
                  aria-label={label}
                  checked={search.days.includes(value)}
                  aria-invalid={!!fields.days}
                  onChange={(event) =>
                    update(
                      {
                        days: event.target.checked
                          ? [...search.days, value]
                          : search.days.filter((day) => day !== value),
                      },
                      400,
                    )
                  }
                />
                <span aria-hidden="true">{label.slice(0, 3)}</span>
              </label>
            ))}
          </div>
          <FieldError field="days" message={fields.days} />
        </fieldset>
        <fieldset
          className="tutor-search-group"
          aria-describedby={fields.range ? "directory-range-error" : undefined}
        >
          <legend>Time of day</legend>
          <div className="tutor-search-toggles">
            {timeRangeOptions.map((option) => {
              const [name, hours] = rangeHours[option.value];
              return (
                <label
                  key={option.value}
                  className="tutor-search-toggle-option"
                >
                  <input
                    type="radio"
                    name="range"
                    value={option.value}
                    checked={search.range === option.value}
                    onChange={() => update({ range: option.value }, 400)}
                    // A second press clears it: one range or none.
                    onClick={() => {
                      if (search.range === option.value)
                        update({ range: "" }, 400);
                    }}
                  />
                  <span>
                    {name} <small>{hours}</small>
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError field="range" message={fields.range} />
        </fieldset>
        <div className="tutor-search-zone">
          <label htmlFor="tutor-search-zone">Times in</label>
          <select
            id="tutor-search-zone"
            name="timezone"
            className="field"
            value={search.timezone}
            aria-invalid={!!fields.timezone}
            aria-describedby={
              fields.timezone ? "directory-timezone-error" : undefined
            }
            onChange={(event) => update({ timezone: event.target.value }, 150)}
          >
            <option value="">Choose your time zone</option>
            {zones.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <FieldError field="timezone" message={fields.timezone} />
        </div>
        <p className="tutor-search-note" aria-live="polite">
          {incomplete
            ? "Choose at least one day and a time of day to see who fits."
            : preferences?.when === "any"
              ? "Tutors with any open time in the next 14 days come first."
              : "Tutors who fit come first; nobody is hidden. The whole lesson must fit."}
        </p>
        <FieldError field="when" message={fields.when} />
      </div>

      {/* Only the scripted form submits a lesson time it has checked. */}
      {hydrated && preferences && (
        <input type="hidden" name="when" value={preferences.when} />
      )}
      <noscript>
        {/* Without JavaScript the time choices are always open. */}
        <style>{`.tutor-search-time[data-collapsed]{display:grid}.tutor-search-toggle{display:none}`}</style>
        <div className="tutor-search-fallback">
          <label htmlFor="tutor-search-when">Lesson time</label>
          <select
            id="tutor-search-when"
            name="when"
            className="field"
            defaultValue={draft.when ?? ""}
          >
            <option value="">Browse without a time</option>
            <option value="preferred">The days and time of day above</option>
            <option value="any">Any open time</option>
          </select>
          <button className="action action-primary" type="submit">
            Show tutors
          </button>
        </div>
      </noscript>

      <div className="tutor-search-foot">
        <button
          type="button"
          className="tutor-search-toggle"
          aria-expanded={open}
          aria-controls="tutor-search-time"
          onClick={() => setOpen((value) => !value)}
        >
          <Clock size={18} aria-hidden="true" />
          Lesson time <small>(optional)</small>
          <Plus className="tutor-search-plus" size={16} aria-hidden="true" />
        </button>
        {pending && (
          <span className="tutor-search-pending" aria-hidden="true">
            Updating…
          </span>
        )}
        {filtered && (
          <Link className="tutor-search-clear" href="/tutors">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}

/**
 * A real select set as inline text. A hidden copy of the chosen label sizes
 * it, so the chevron never covers the text.
 */
function Pick({
  label,
  name,
  value,
  text,
  onChange,
  children,
}: {
  label: string;
  name: string;
  value: string;
  text: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="tutor-search-pick" data-set={value ? "" : undefined}>
      <span className="tutor-search-pick-size" aria-hidden="true">
        {text}
      </span>
      <select
        name={name}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" />
    </span>
  );
}

function FieldError({ field, message }: { field: string; message?: string }) {
  return message ? (
    <p
      id={`directory-${field}-error`}
      role="alert"
      className="tutor-search-error"
    >
      {message}
    </p>
  ) : null;
}
