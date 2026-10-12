import { learnerLevels } from "@/lib/db/schema/app";
import {
  parseTeachingLanguage,
  type TeachingLanguageCode,
} from "./teaching-languages";
import {
  parseMatchPreferences,
  preferenceDraft,
  type MatchPreferences,
  type MatchParams,
  type PreferenceFields,
} from "@/features/matching/preferences";
import {
  publicSlugInput,
  publicZoneInput,
} from "@/features/public-availability/input";

function single(value: string | string[] | undefined) {
  return typeof value === "string" && value ? value : undefined;
}

/** Query-string filters, reduced to values the catalog knows. */
export function parseTutorSearch(
  params: Record<string, string | string[] | undefined>,
) {
  const level = learnerLevels.find((value) => value === single(params.level));
  const page = Number(single(params.page));
  return {
    subject: single(params.subject)?.slice(0, 80),
    level,
    language: parseTeachingLanguage(single(params.language)),
    page: Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

/** Link back to the directory with the given filters. */
export function tutorsHref(filters: {
  subject?: string;
  level?: string;
  language?: TeachingLanguageCode;
  page?: number;
  preferences?: MatchPreferences;
}) {
  const query = new URLSearchParams();
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.level) query.set("level", filters.level);
  if (filters.language) query.set("language", filters.language);
  if (filters.preferences) {
    query.set("when", filters.preferences.when);
    query.set("timezone", filters.preferences.timezone);
    if (filters.preferences.when === "preferred") {
      for (const day of filters.preferences.days)
        query.append("days", String(day));
      query.set("range", filters.preferences.range);
    }
  }
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  const text = query.toString();
  return text ? `/tutors?${text}` : "/tutors";
}

/** Optional directory preferences fail closed when an opted-in input is invalid. */
export function parseDirectorySearch(params: MatchParams) {
  const search = parseTutorSearch(params);
  const optIn = params.when !== undefined && params.when !== "";
  const parsed: { preferences?: MatchPreferences; fields: PreferenceFields } =
    optIn ? parseMatchPreferences(params) : { fields: {} };
  return { ...search, ...parsed, optIn, draft: preferenceDraft(params) };
}

/** Next serializes route parameters too: redirect before rendering unknown data. */
export function sanitizeDirectoryParams(raw: MatchParams) {
  const sanitized = {} as MatchParams;
  const base = parseTutorSearch(raw);
  for (const key of ["subject", "level", "language", "page"] as const) {
    if (raw[key] === undefined) continue;
    const value =
      key === "subject"
        ? publicSlugInput.safeParse(raw.subject).success
          ? raw.subject
          : ""
        : key === "page"
          ? String(base.page)
          : (base[key] ?? "");
    sanitized[key] = value;
  }
  // Retain safe invalid sentinels so malformed opt-in never broadens the search.
  if (raw.when !== undefined && raw.when !== "") {
    sanitized.when =
      raw.when === "preferred" || raw.when === "any" ? raw.when : "invalid";
    sanitized.timezone = publicZoneInput.safeParse(raw.timezone).success
      ? raw.timezone
      : "";
    const draft = preferenceDraft(raw);
    if (raw.range !== undefined) sanitized.range = draft.range ?? "";
    if (raw.days !== undefined) {
      const days = typeof raw.days === "string" ? [raw.days] : raw.days;
      const safe =
        days.length > 7
          ? [""]
          : days.map((day) => (/^[1-7]$/.test(day) ? day : ""));
      sanitized.days = safe.length === 1 ? safe[0] : safe;
    }
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sanitized))
    for (const item of typeof value === "string" ? [value] : (value ?? []))
      query.append(key, item);
  return {
    params: sanitized,
    changed:
      Object.keys(raw).length !== Object.keys(sanitized).length ||
      Object.keys(raw).some(
        (key) => JSON.stringify(raw[key]) !== JSON.stringify(sanitized[key]),
      ),
    href: query.size ? `/tutors?${query}` : "/tutors",
  };
}
