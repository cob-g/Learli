import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { filterTutors } from "@/features/tutors/eligibility";
import {
  parseTutorSearch,
  readPublicCatalog,
  tutorsHref,
  tutorsPerPage,
} from "@/features/tutors/public";
import { TutorList } from "@/features/tutors/tutor-card";
import { TutorFilterForm } from "@/features/tutors/tutor-filter-form";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find a tutor" };

export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subject, level, page } = parseTutorSearch(await searchParams);
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
            href={tutorsHref({ subject, level, page })}
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
  const matches = filterTutors(catalog.tutors, { subject, level });
  const pages = Math.max(1, Math.ceil(matches.length / tutorsPerPage));
  const current = Math.min(page, pages);
  const shown = matches.slice(
    (current - 1) * tutorsPerPage,
    current * tutorsPerPage,
  );
  const applied = [
    subject && {
      label: subjectName ?? "Unknown subject",
      href: tutorsHref({ level }),
    },
    levelName && { label: levelName, href: tutorsHref({ subject }) },
  ].filter((item) => !!item);

  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Find a tutor</h1>
      <div className="mt-8 lg:flex lg:gap-8">
        <div className="mb-8 lg:mb-0 lg:w-64 lg:shrink-0">
          <TutorFilterForm
            variant="filters"
            subjects={catalog.subjects}
            subject={subject}
            level={level}
          />
        </div>
        <div className="min-w-0 flex-1">
          {matches.length === 0 ? (
            subjectName && !level ? (
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
              <div className="mt-4">
                <TutorList tutors={shown} />
              </div>
              {pages > 1 && (
                <nav
                  aria-label="Tutor pages"
                  className="mt-4 flex flex-wrap items-center gap-x-6"
                >
                  {current > 1 && (
                    <Link
                      className="inline-flex min-h-11 items-center"
                      href={tutorsHref({ subject, level, page: current - 1 })}
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
                      href={tutorsHref({ subject, level, page: current + 1 })}
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
