import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { groupSubjects } from "@/features/subjects/catalog";
import { readPublicCatalog, tutorsHref } from "@/features/tutors/public";
import { TutorList } from "@/features/tutors/tutor-card";
import { TutorFilterForm } from "@/features/tutors/tutor-filter-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await readPublicCatalog();
  const tutors = catalog?.tutors ?? [];
  return (
    <>
      <section className="page-shell page-space">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <h1 className="max-w-3xl text-display">
              <span className="brand-highlight">Find a tutor</span> for
              one-to-one online lessons
            </h1>
            <p className="mt-6 max-w-xl text-body text-muted-foreground md:text-lead">
              For Elementary, Middle School, High School, and College Support
              learners. Lessons take place with your tutor on Zoom or Google
              Meet.
            </p>
          </div>
          <div className="rounded-surface border border-border bg-surface p-6 md:p-8">
            {!catalog ? (
              <>
                <h2 className="text-section-title">
                  Tutor search is unavailable
                </h2>
                <p role="alert" className="mt-4 text-body">
                  We couldn&apos;t load tutors. Try again, or contact support if
                  this keeps happening.
                </p>
                <p className="mt-4 flex flex-wrap gap-x-6">
                  <Link className="inline-flex min-h-12 items-center" href="/">
                    Try again
                  </Link>
                  <Link
                    className="inline-flex min-h-12 items-center"
                    href="/contact"
                  >
                    Contact support
                  </Link>
                </p>
              </>
            ) : tutors.length > 0 ? (
              <>
                <h2 className="text-section-title">
                  What do you need help with?
                </h2>
                <div className="mt-6">
                  <TutorFilterForm
                    variant="finder"
                    subjects={catalog.subjects}
                  />
                </div>
                <p className="mt-4 text-small text-muted-foreground">
                  Prefer a little guidance?{" "}
                  <Link href="/get-matched">Get matched</Link> by subject, level
                  and available time.
                </p>
              </>
            ) : (
              <EmptyState
                title="No tutors are listed right now"
                links={[
                  { href: "/become-a-tutor", label: "Become a tutor" },
                  { href: "/contact", label: "Contact support" },
                ]}
              >
                <p>
                  Learli is preparing to welcome tutors. Booking is not
                  available yet.
                </p>
              </EmptyState>
            )}
          </div>
        </div>
      </section>
      {tutors.length > 0 && (
        <section className="page-shell pb-16 md:pb-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-headline">Tutors on Learli</h2>
            <Link className="inline-flex min-h-12 items-center" href="/tutors">
              Browse all tutors
            </Link>
          </div>
          <div className="mt-6">
            <TutorList tutors={tutors.slice(0, 3)} heading="h3" />
          </div>
        </section>
      )}
      {catalog && catalog.subjects.length > 0 && (
        <section className="border-y border-border bg-surface">
          <div className="page-shell py-12 md:py-16">
            <h2 className="text-headline">Find your subject</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {groupSubjects(catalog.subjects).map((group) => (
                <div key={group.category}>
                  <h3 className="text-item-title">{group.label}</h3>
                  <ul className="mt-4 divide-y divide-border">
                    {group.subjects.map((subject) => (
                      <li key={subject.slug}>
                        <Link
                          className="flex min-h-12 items-center py-2"
                          href={tutorsHref({ subject: subject.slug })}
                        >
                          {subject.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="page-shell py-16 md:py-24">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="text-headline">Tutoring through Learli</h2>
            <p className="mt-6 max-w-prose font-reading text-reading">
              Learli brings tutor discovery and lesson coordination into one
              place. You can <Link href="/tutors">find a tutor</Link> or{" "}
              <Link href="/get-matched">get matched</Link> when tutors are
              available.
            </p>
            <Link
              href="/how-it-works"
              className="mt-6 inline-flex min-h-12 items-center"
            >
              How it works
            </Link>
          </div>
          <ol className="divide-y divide-border border-y border-border">
            <li className="py-6">
              <h3 className="text-item-title">Find a tutor for your subject</h3>
              <p className="mt-2 text-body text-muted-foreground">
                Compare the subjects and learner levels each tutor offers.
              </p>
            </li>
            <li className="py-6">
              <h3 className="text-item-title">Choose an available time</h3>
              <p className="mt-2 text-body text-muted-foreground">
                View dated times in your time zone. Availability is checked
                again when booking.
              </p>
            </li>
            <li className="py-6">
              <h3 className="text-item-title">Meet on Zoom or Google Meet</h3>
              <p className="mt-2 text-body text-muted-foreground">
                Your tutor teaches independently and provides the learning
                materials.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
