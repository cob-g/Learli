import { expandWeeklyWindows } from "@/lib/time/availability";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { learnerLevels } from "@/lib/db/schema/app";

export const weekdayOptions = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const;
export const timeRangeOptions = [
  {
    value: "overnight",
    label: "Early morning (12:00 AM – 6:00 AM)",
    startMinute: 0,
    endMinute: 360,
  },
  {
    value: "morning",
    label: "Morning (6:00 AM – 12:00 PM)",
    startMinute: 360,
    endMinute: 720,
  },
  {
    value: "afternoon",
    label: "Afternoon (12:00 PM – 6:00 PM)",
    startMinute: 720,
    endMinute: 1080,
  },
  {
    value: "evening",
    label: "Evening (6:00 PM – 12:00 AM)",
    startMinute: 1080,
    endMinute: 1440,
  },
] as const;
export type TimeRange = (typeof timeRangeOptions)[number]["value"];
export type MatchPreferences = {
  timezone: string;
} & ({ when: "any" } | { when: "preferred"; days: number[]; range: TimeRange });
export type MatchParams = Record<string, string | string[] | undefined>;
export type PreferenceFields = Partial<
  Record<"timezone" | "when" | "days" | "range", string>
>;
export type PreferenceDraft = {
  timezone?: string;
  when?: "any" | "preferred";
  days: number[];
  range?: TimeRange;
};

export function preferenceDraft(params: MatchParams): PreferenceDraft {
  const timezone = singleMatchParam(params.timezone);
  const when = singleMatchParam(params.when);
  const rawDays =
    typeof params.days === "string" ? [params.days] : (params.days ?? []);
  return {
    timezone: isValidTimeZone(timezone) ? timezone : undefined,
    when: when === "any" || when === "preferred" ? when : undefined,
    days: [
      ...new Set(
        rawDays
          .slice(0, 7)
          .filter((day) => /^[1-7]$/.test(day))
          .map(Number),
      ),
    ],
    range: timeRangeOptions.find(
      (option) => option.value === singleMatchParam(params.range),
    )?.value,
  };
}

export function singleMatchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/** Only visitor filters are accepted; untrusted values are never echoed. */
export function parseMatchPreferences(params: MatchParams): {
  preferences?: MatchPreferences;
  fields: PreferenceFields;
} {
  const fields: PreferenceFields = {};
  const timezone = singleMatchParam(params.timezone);
  const when = singleMatchParam(params.when);
  if (!isValidTimeZone(timezone)) fields.timezone = "Choose your time zone";
  if (when !== "any" && when !== "preferred")
    fields.when = "Choose Any time or preferred times";
  if (Object.keys(fields).length) return { fields };
  if (when === "any" && isValidTimeZone(timezone))
    return { preferences: { timezone, when }, fields };
  const rawDays =
    typeof params.days === "string" ? [params.days] : (params.days ?? []);
  const days = rawDays.map(Number);
  if (
    !rawDays.length ||
    rawDays.length > 7 ||
    rawDays.some((day) => !/^[1-7]$/.test(day)) ||
    new Set(days).size !== days.length
  )
    fields.days = "Choose one or more weekdays";
  const range = timeRangeOptions.find(
    (option) => option.value === singleMatchParam(params.range),
  );
  if (!range) fields.range = "Choose a time-of-day range";
  if (!Object.keys(fields).length && range && isValidTimeZone(timezone))
    return {
      preferences: {
        timezone,
        when: "preferred",
        days: days.sort((a, b) => a - b),
        range: range.value,
      },
      fields,
    };
  return { fields };
}

export type CandidateTime = { startAtUtc: string; endAtUtc: string };

/** Compile viewer wall-clock preferences once for the whole bounded result set.
 * This filters shared candidates; it never generates new lesson times.
 */
export function preferencePredicate(
  preferences: MatchPreferences,
  from: Date,
  to: Date,
) {
  const range =
    preferences.when === "preferred"
      ? timeRangeOptions.find((option) => option.value === preferences.range)
      : undefined;
  const windows =
    preferences.when === "preferred" && range
      ? expandWeeklyWindows({
          timeZone: preferences.timezone,
          from,
          to,
          windows: preferences.days.map((isoWeekday) => ({
            isoWeekday,
            startMinute: range.startMinute,
            endMinute: range.endMinute,
          })),
        })
      : [];
  return (candidate: CandidateTime) => {
    const start = new Date(candidate.startAtUtc).getTime();
    const end = new Date(candidate.endAtUtc).getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      start < from.getTime() ||
      end > to.getTime()
    )
      return false;
    return (
      preferences.when === "any" ||
      windows.some(
        (window) =>
          window.start.getTime() <= start && end <= window.end.getTime(),
      )
    );
  };
}

/** Back/refresh state contains only catalog answers and validated visitor filters. */
export function matchingHref(
  answers: { level?: string; subject?: string; preferences?: MatchPreferences },
  change?: "level" | "subject" | "when",
  page = 1,
) {
  const query = new URLSearchParams();
  if (learnerLevels.some((level) => level === answers.level) && answers.level)
    query.set("level", answers.level);
  if (
    answers.subject &&
    answers.subject.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(answers.subject)
  )
    query.set("subject", answers.subject);
  if (answers.preferences) {
    query.set("timezone", answers.preferences.timezone);
    query.set("when", answers.preferences.when);
    if (answers.preferences.when === "preferred") {
      for (const day of answers.preferences.days)
        query.append("days", String(day));
      query.set("range", answers.preferences.range);
    }
  }
  if (change) query.set("change", change);
  if (page > 1) query.set("page", String(page));
  return query.size ? `/get-matched?${query}` : "/get-matched";
}

/** Remove unknown query keys before rendering: Next's route state also serializes
 * search parameters, so sanitized component props alone are insufficient.
 */
export function sanitizeMatchParams(raw: MatchParams) {
  const params: MatchParams = {};
  for (const [key, value] of Object.entries(raw)) {
    const scalar = singleMatchParam(value);
    if (key === "level")
      params.level = learnerLevels.some((level) => level === scalar)
        ? scalar
        : "";
    else if (key === "subject")
      params.subject =
        scalar &&
        scalar.length <= 80 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scalar)
          ? scalar
          : "";
    else if (key === "timezone")
      params.timezone = isValidTimeZone(scalar) ? scalar : "";
    else if (key === "when")
      params.when = scalar === "any" || scalar === "preferred" ? scalar : "";
    else if (key === "range")
      params.range = timeRangeOptions.some((range) => range.value === scalar)
        ? scalar
        : "";
    else if (key === "days") {
      const days = typeof value === "string" ? [value] : (value ?? []);
      params.days =
        days.length > 7
          ? [""]
          : days.map((day) => (/^[1-7]$/.test(day) ? day : ""));
      if (typeof value === "string") params.days = params.days[0];
    } else if (
      key === "change" &&
      (scalar === "level" || scalar === "subject" || scalar === "when")
    )
      params.change = scalar;
    else if (key === "submit" && scalar === "results") params.submit = scalar;
    else if (key === "page")
      params.page = scalar && /^[1-9][0-9]{0,3}$/.test(scalar) ? scalar : "1";
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of typeof value === "string" ? [value] : (value ?? []))
      query.append(key, item);
  }
  return {
    params,
    changed: JSON.stringify(params) !== JSON.stringify(raw),
    href: query.size ? `/get-matched?${query}` : "/get-matched",
  };
}
