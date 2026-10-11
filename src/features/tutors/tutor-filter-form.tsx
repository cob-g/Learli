import Link from "next/link";
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
}: {
  variant: "finder" | "filters";
  subjects: (CatalogSubject & { slug: string })[];
  subject?: string;
  level?: string;
  languages?: TeachingLanguageCode[];
  language?: TeachingLanguageCode;
}) {
  const finder = variant === "finder";
  const fieldClass = finder
    ? "min-w-0 flex-1 space-y-2"
    : "min-w-0 flex-1 space-y-2 sm:min-w-40 lg:min-w-0";
  return (
    <form
      action="/tutors"
      method="get"
      role="search"
      aria-label={finder ? "Find a tutor" : "Filter tutors"}
      className={
        finder
          ? "flex flex-col gap-4 md:flex-row md:items-end"
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
        <button className="action action-inverse" type="submit">
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
          <div className="flex flex-wrap items-center gap-4">
            <button className="action action-outline" type="submit">
              Apply filters
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
