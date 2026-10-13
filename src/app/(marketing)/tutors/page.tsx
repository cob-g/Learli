import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { redirect } from "next/navigation";
import { listTimeZoneOptions } from "@/lib/time/zones";
import {
  parseDirectorySearch,
  sanitizeDirectoryParams,
} from "@/features/tutors/search";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { filterTutors } from "@/features/tutors/eligibility";
import {
  readDirectoryTimes,
  readPublicCatalog,
  tutorsHref,
  tutorsPerPage,
} from "@/features/tutors/public";
import { TutorList } from "@/features/tutors/tutor-card";
import { TutorFilterForm } from "@/features/tutors/tutor-filter-form";
import { EmptyState } from "@/components/shared/empty-state";
import {
  declaredTeachingLanguages,
  teachingLanguageLabels,
} from "@/features/tutors/teaching-languages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find a tutor" };

export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sanitized = sanitizeDirectoryParams(await searchParams);
  if (sanitized.changed) redirect(sanitized.href);
  const { subject, level, language, page, preferences, fields, draft, optIn } =
    parseDirectorySearch(sanitized.params);
  const catalog = await readPublicCatalog();
  if (!catalog)
    return (
      <div className="page-shell page-space">
        <h1 className="text-page-title">Find a tutor</h1>
        <p role="alert" className="mt-8 max-w-prose text-body">
          We couldn&apos;t load tutors. Try again, or contact support if this
          keeps happening.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-6">
          <Link
            className="inline-flex min-h-11 items-center"
            href={sanitized.href}
          >
            Try again
          </Link>
          <Link className="inline-flex min-h-11 items-center" href="/contact">
            Contact support
          </Link>
        </p>
      </div>
    );
  if (catalog.tutors.length === 0)
    return (
      <div className="page-shell page-space">
        <h1 className="text-page-title">Find a tutor</h1>
        <div className="mt-8">
          <EmptyState
            title="No tutors are listed right now"
            href="/become-a-tutor"
            action="Become a tutor"
            links={[{ href: "/contact", label: "Contact support" }]}
          >
            <p>Learli lists a tutor after reviewing their application.</p>
          </EmptyState>
        </div>
      </div>
    );

  const subjectName = catalog.subjects.find(
    (item) => item.slug === subject,
  )?.name;
  const levelName = learnerLevelOptions.find(([value]) => value === level)?.[1];
  let matches = filterTutors(catalog.tutors, { subject, level, language });
  let nextTimes: Record<string, LessonTimeValue> | undefined;
  let unavailable = false;
  if (preferences) {
    const result = await readDirectoryTimes(
      catalog.tutors,
      { subject, level, language },
      preferences,
    );
    if (result) {
      matches = result.tutors;
      nextTimes = result.nextTimes;
    } else unavailable = true;
  }
  const invalid = optIn && !preferences;
  const pages = Math.max(1, Math.ceil(matches.length / tutorsPerPage));
  const current = Math.min(page, pages);
  const shown = matches.slice(
    (current - 1) * tutorsPerPage,
    current * tutorsPerPage,
  );
  const applied = [
    subject && {
      label: subjectName ?? "Unknown subject",
      href: tutorsHref({ level, language, preferences }),
    },
    levelName && {
      label: levelName,
      href: tutorsHref({ subject, language, preferences }),
    },
    language && {
      label: `Teaching language: ${teachingLanguageLabels[language]}`,
      href: tutorsHref({ subject, level, preferences }),
    },
    preferences && {
      label: "Lesson time",
      href: tutorsHref({ subject, level, language }),
    },
  ].filter((item) => !!item);

  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Find a tutor</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Compare tutors by the subjects and levels they teach. Add a time
        preference to see times that fit.
      </p>
      <div className="mt-8 lg:flex lg:gap-12">
        <div className="mb-8 self-start rounded-surface border border-border bg-surface p-6 lg:mb-0 lg:w-72 lg:shrink-0">
          <TutorFilterForm
            key={sanitized.href}
            variant="filters"
            subjects={catalog.subjects}
            subject={subject}
            level={level}
            languages={declaredTeachingLanguages(catalog.tutors)}
            language={language}
            draft={draft}
            fields={fields}
            zones={listTimeZoneOptions(
              new Date(),
              draft.timezone ? [draft.timezone] : [],
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          {preferences && !unavailable && (
            <p className="mb-4 max-w-prose text-small text-muted-foreground">
              Local simulation: actual dated open times over the next 14 days,
              for 60-minute lessons. Times are advisory and checked again when
              reserving. No payment or confirmed lesson.
            </p>
          )}
          {invalid ? (
            <p role="alert" className="text-body">
              Check your lesson time choices to see tutors.
            </p>
          ) : unavailable ? (
            <div>
              <p role="alert" className="text-body">
                Lesson times are temporarily unavailable. Choose a subject,
                level or teaching language to narrow your search, or try again.
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                <Link
                  className="inline-flex min-h-11 items-center"
                  href={sanitized.href}
                >
                  Try again
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center"
                  href={tutorsHref({ subject, level, language })}
                >
                  Clear lesson time filter
                </Link>
              </div>
            </div>
          ) : matches.length === 0 ? (
            subjectName && !level && !language && !preferences ? (
              <EmptyState
                title={`No tutors teach ${subjectName} on Learli right now`}
                href="/tutors"
                action="Browse all tutors"
              />
            ) : (
              <EmptyState
                title="No tutors match these filters"
                href="/tutors"
                action="Clear filters"
              >
                <p>{applied.map((item) => item.label).join(" · ")}</p>
                <div className="mt-2 flex flex-wrap gap-x-4">
                  {applied.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-label={`Remove filter: ${item.label}`}
                      className="inline-flex min-h-11 items-center gap-1 text-label"
                    >
                      {item.label}
                      <X size={16} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </EmptyState>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p role="status" className="text-body">
                  {matches.length === 1
                    ? "1 tutor"
                    : `${matches.length} tutors`}
                </p>
                {applied.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-label={`Remove filter: ${item.label}`}
                    className="inline-flex min-h-11 items-center gap-1 text-label"
                  >
                    {item.label}
                    <X size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <div className="mt-6">
                <TutorList
                  tutors={shown}
                  nextTimes={nextTimes}
                  timezone={preferences?.timezone}
                />
              </div>
              {pages > 1 && (
                <nav
                  aria-label="Tutor pages"
                  className="mt-4 flex flex-wrap items-center gap-x-6"
                >
                  {current > 1 && (
                    <Link
                      className="inline-flex min-h-11 items-center"
                      href={tutorsHref({
                        subject,
                        level,
                        language,
                        preferences,
                        page: current - 1,
                      })}
                    >
                      Previous page
                    </Link>
                  )}
                  <p className="text-small text-muted-foreground">
                    Page {current} of {pages}
                  </p>
                  {current < pages && (
                    <Link
                      className="inline-flex min-h-11 items-center"
                      href={tutorsHref({
                        subject,
                        level,
                        language,
                        preferences,
                        page: current + 1,
                      })}
                    >
                      Next page
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
