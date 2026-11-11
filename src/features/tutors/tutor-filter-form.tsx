"use client";

import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  groupSubjects,
  learnerLevelOptions,
  type CatalogSubject,
} from "@/features/subjects/catalog";

/**
 * The home page's subject and level search: a plain GET form to the
 * directory, so it works without JavaScript. The directory has its own
 * sentence search (DirectorySearch).
 */
export function TutorFilterForm({
  variant,
  subjects,
  subject,
  level,
}: {
  variant: "finder";
  subjects: (CatalogSubject & { slug: string })[];
  subject?: string;
  level?: string;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = () => setPending(false);
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  const fieldClass = "min-w-0 flex-1 space-y-2";
  return (
    <form
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
      aria-label="Find a tutor"
      className="flex flex-col gap-4"
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
      <button
        className="action action-primary w-full"
        type="submit"
        disabled={pending}
      >
        Find a tutor
      </button>
    </form>
  );
}
