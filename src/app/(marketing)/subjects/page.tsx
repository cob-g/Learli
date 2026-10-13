import type { Metadata } from "next";
import Link from "next/link";
import {
  groupSubjects,
  learnerLevelOptions,
} from "@/features/subjects/catalog";
import { filterTutors } from "@/features/tutors/eligibility";
import { readPublicCatalog, tutorsHref } from "@/features/tutors/public";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const catalog = await readPublicCatalog();
  return (
    <div className="page-shell page-space">
      <h1 className="text-headline">Find your subject</h1>
      {!catalog ? (
        <p role="alert" className="mt-8 max-w-prose text-body">
          We couldn&apos;t load subjects. Try again, or{" "}
          <Link href="/contact">contact support</Link> if this keeps happening.
        </p>
      ) : catalog.subjects.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No subjects are listed right now"
            links={[{ href: "/contact", label: "Contact support" }]}
          />
        </div>
      ) : (
        <>
          <p className="mt-4 max-w-prose text-body text-muted-foreground">
            Choose a subject to see tutors who teach it. A level appears beside
            a subject when a tutor on Learli teaches it at that level.
          </p>
          <div className="mt-12 grid items-start gap-12 md:grid-cols-2 lg:grid-cols-3">
            {groupSubjects(catalog.subjects).map((group) => (
              <section key={group.category} className="min-w-0">
                <h2 className="text-section-title">{group.label}</h2>
                <ul className="mt-6 border-t border-border">
                  {group.subjects.map((subject) => (
                    <li
                      key={subject.slug}
                      className="flex flex-col items-start gap-2 border-b border-border py-4"
                    >
                      <Link
                        className="inline-flex min-h-12 items-center text-item-title"
                        href={tutorsHref({ subject: subject.slug })}
                      >
                        {subject.name}
                      </Link>
                      <div className="flex flex-wrap gap-x-4">
                        {learnerLevelOptions
                          .filter(
                            ([level]) =>
                              filterTutors(catalog.tutors, {
                                subject: subject.slug,
                                level,
                              }).length > 0,
                          )
                          .map(([level, label]) => (
                            <Link
                              key={level}
                              className="inline-flex min-h-11 items-center text-small"
                              aria-label={`${subject.name}, ${label}`}
                              href={tutorsHref({
                                subject: subject.slug,
                                level,
                              })}
                            >
                              {label}
                            </Link>
                          ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
