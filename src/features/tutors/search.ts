import { learnerLevels } from "@/lib/db/schema/app";
import {
  parseTeachingLanguage,
  type TeachingLanguageCode,
} from "./teaching-languages";

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
}) {
  const query = new URLSearchParams();
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.level) query.set("level", filters.level);
  if (filters.language) query.set("language", filters.language);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  const text = query.toString();
  return text ? `/tutors?${text}` : "/tutors";
}
