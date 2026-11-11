import "../home.css";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDomainAuthRuntime } from "@/lib/auth";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { listTimeZoneOptions } from "@/lib/time/zones";
import {
  parseDirectorySearch,
  sanitizeDirectoryParams,
} from "@/features/tutors/search";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";
import { filterTutors, type PublicTutor } from "@/features/tutors/eligibility";
import {
  readDirectoryTimes,
  readPublicCatalog,
  tutorsHref,
  tutorsPerPage,
} from "@/features/tutors/public";
import { DirectorySearch } from "@/features/tutors/directory-search";
import { TutorGrid, TutorGridHint } from "@/features/home/tutor-grid";
import { tutorGridCards } from "@/features/home/tutor-grid-cards";
import {
  parseVisitTimeZone,
  visitTimeZoneKey,
} from "@/features/public-availability/visit-timezone";
import { EmptyState } from "@/components/shared/empty-state";
import { FindATutorGuide } from "@/features/home/page-guides";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { declaredTeachingLanguages } from "@/features/tutors/teaching-languages";

export const dynamic = "force-dynamic";
// One canonical address for every filter, time and page of the directory.
export const metadata = publicPageMetadata({
  title: "Find a tutor by subject and level",
  description:
    "Compare tutors by the subjects and learner levels they teach, and add a lesson time to see the open times that fit. Browsing needs no account.",
  path: "/tutors",
});

type DirectoryProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The directory, then what it is for. The guide is the same in every state. */
export default function TutorsPage(props: DirectoryProps) {
  return (
    <>
      <Directory {...props} />
      <FindATutorGuide />
    </>
  );
}

async function Directory({ searchParams }: DirectoryProps) {
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

  // A lesson time never hides anyone: tutors with a fitting open time come
  // first, then everyone else the filters allow.
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
      nextTimes = result.nextTimes;
      const fits = (tutor: PublicTutor) =>
        Object.hasOwn(result.nextTimes, tutor.slug);
      matches = [...matches.filter(fits), ...matches.filter((t) => !fits(t))];
    } else unavailable = true;
  }
  const fitting = nextTimes ? Object.keys(nextTimes).length : 0;
  const runtime = preferences ? await getDomainAuthRuntime() : null;
  const privateWorkflow = !!runtime && hasPersistentWorkflow(runtime);
  const pages = Math.max(1, Math.ceil(matches.length / tutorsPerPage));
  const current = Math.min(page, pages);
  const shown = matches.slice(
    (current - 1) * tutorsPerPage,
    current * tutorsPerPage,
  );
  const filtered = !!(subject || level || language);
  const zone =
    preferences?.timezone ??
    draft.timezone ??
    parseVisitTimeZone((await cookies()).get(visitTimeZoneKey)?.value);

  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Find a tutor</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Compare tutors by the subjects and levels they teach. Add a time
        preference to see times that fit.
      </p>
      <DirectorySearch
        href={sanitized.href}
        subjects={catalog.subjects}
        subject={subject}
        level={level}
        languages={declaredTeachingLanguages(catalog.tutors)}
        language={language}
        draft={draft}
        zone={zone}
        zones={listTimeZoneOptions(new Date(), zone ? [zone] : [])}
        fields={fields}
      />
      <div className="tutor-results-bar">
        <p role="status" aria-live="polite" className="tutor-results-count">
          {matches.length} {matches.length === 1 ? "tutor" : "tutors"}{" "}
          <em>{filtered ? "match" : "on Learli"}</em>
        </p>
        {matches.length > 0 && <TutorGridHint />}
      </div>
      {preferences && !unavailable && (
        <p className="tutor-results-notice">
          {fitting === 1
            ? "1 tutor fits your time. "
            : `${fitting} tutors fit your time. `}
          {privateWorkflow
            ? "Available times over the next 14 days, for 60-minute lessons. Times are checked again when you request a booking. Confirmation requires assigned review."
            : "Local simulation: actual dated open times over the next 14 days, for 60-minute lessons. Times are advisory and checked again when reserving. No payment or confirmed lesson."}
        </p>
      )}
      {unavailable && (
        <p role="alert" className="tutor-results-notice">
          Lesson times are temporarily unavailable, so tutors are shown in their
          usual order. <Link href={sanitized.href}>Try again</Link>
        </p>
      )}
      {optIn && !preferences && (
        <p role="alert" className="tutor-results-notice">
          Check your lesson time choices to sort tutors by your time.
        </p>
      )}
      {matches.length === 0 ? (
        <div className="tutor-results-empty">
          <h2>No tutors match these filters</h2>
          <p>
            Try a different subject or level, or{" "}
            <Link href="/tutors">clear filters</Link>
          </p>
        </div>
      ) : (
        <>
          <div className="tutor-results-grid">
            <TutorGrid
              entrance
              cards={tutorGridCards(shown, {
                subject,
                level,
                timezone: preferences?.timezone,
                nextTimes,
              })}
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
  );
}
