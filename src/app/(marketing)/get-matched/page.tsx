import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthRuntime } from "@/lib/auth";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { resolveMatch, matchLimit } from "@/features/matching/match";
import { MatchQuestions } from "@/features/matching/questions";
import {
  matchingHref,
  sanitizeMatchParams,
  type MatchParams,
} from "@/features/matching/preferences";
import {
  MatchResultList,
  preferenceDescription,
} from "@/features/matching/results";
import {
  readMatchingAvailability,
  type MatchingAvailability,
} from "@/features/matching/service";
import { readPublicCatalog } from "@/features/tutors/public";
import { publicProfileHref } from "@/features/public-availability/links";
import { EmptyState } from "@/components/shared/empty-state";
import { demoBookingPolicy } from "@/features/bookings/demo-policy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get matched" };

function LoadFailure({
  href,
  times = false,
}: {
  href: string;
  times?: boolean;
}) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Get matched</h1>
      <p role="alert" className="mt-8 max-w-prose text-body">
        We couldn&apos;t load {times ? "matching times" : "tutors"}. Try again,
        or contact support if this keeps happening.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link className="action action-outline" href={href}>
          Try again
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/tutors">
          Browse all tutors
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/contact">
          Contact support
        </Link>
      </div>
    </div>
  );
}

export default async function GetMatchedPage({
  searchParams,
}: {
  searchParams: Promise<MatchParams>;
}) {
  const safe = sanitizeMatchParams(await searchParams);
  if (safe.changed) redirect(safe.href);
  const catalog = await readPublicCatalog();
  if (!catalog) return <LoadFailure href={safe.href} />;
  if (catalog.tutors.length === 0)
    return (
      <div className="page-shell page-space">
        <h1 className="text-page-title">Get matched</h1>
        <div className="mt-8 border-t border-border pt-8">
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
  const match = resolveMatch(safe.params, catalog.subjects, catalog.tutors);
  if (match.step !== "ready")
    return <MatchQuestions match={match} params={safe.params} />;
  const answers = {
    level: match.level,
    subject: match.subject.slug,
    preferences: match.preferences,
  };
  const runtime = getAuthRuntime();
  let availability: MatchingAvailability;
  try {
    if (!runtime) throw new Error("Availability is not configured.");
    availability = await readMatchingAvailability(runtime, catalog.tutors, {
      subjectSlug: match.subject.slug,
      level: match.level,
      preferences: match.preferences,
    });
  } catch {
    return <LoadFailure href={matchingHref(answers)} times />;
  }
  const level = learnerLevelOptions.find(
    ([value]) => value === match.level,
  )?.[1];
  const summary = `${level} · ${match.subject.name} · ${preferenceDescription(match.preferences)}`;
  const change = matchingHref(answers, "when");
  const total = availability.matches.length;
  const pages = Math.max(1, Math.ceil(total / matchLimit));
  const requestedPage =
    typeof safe.params.page === "string" ? Number(safe.params.page) : 1;
  const page = Math.min(pages, requestedPage);
  const matches = availability.matches.slice(
    (page - 1) * matchLimit,
    page * matchLimit,
  );
  return (
    <div className="page-shell page-space">
      <div className="max-w-6xl">
        <h1 className="text-page-title">Get matched</h1>
        <p className="mt-4 max-w-prose text-small text-muted-foreground">
          Local demo search: {demoBookingPolicy.durationMinutes}-minute times in{" "}
          {demoBookingPolicy.stepMinutes}-minute steps, at least{" "}
          {demoBookingPolicy.noticeMinutes} minutes ahead, within{" "}
          {demoBookingPolicy.horizonDays} days. These are simulated options;
          live lesson terms are not set. Times can change before a reservation.
        </p>
        <div className="mt-8 border-t border-border pt-8">
          {total === 0 ? (
            <EmptyState
              title="No tutors match your answers"
              href={change}
              action="Change answers"
              links={[
                { href: "/tutors", label: "Browse all tutors" },
                { href: "/contact", label: "Contact support" },
              ]}
            >
              <p>{summary}</p>
              <p>
                No eligible tutor has an open demo time that fits these answers.
              </p>
            </EmptyState>
          ) : (
            <>
              <p role="status" className="text-body">
                {total} {total === 1 ? "tutor teaches" : "tutors teach"}{" "}
                {match.subject.name} at {level} with an open time that fits.
              </p>
              <p className="mt-2 text-small text-muted-foreground">{summary}</p>
              <p className="mt-2 max-w-prose text-small text-muted-foreground">
                Ordered by the earliest matching time, then tutor name.
              </p>
              <div className="mt-6">
                <MatchResultList
                  matches={matches}
                  preferences={match.preferences}
                  profileHref={({ tutor, nextTime }) =>
                    publicProfileHref({
                      tutorSlug: tutor.slug,
                      subjectSlug: match.subject.slug,
                      level: match.level,
                      displayTimezone: match.preferences.timezone,
                      startAtUtc: nextTime.startAtUtc,
                      endAtUtc: nextTime.endAtUtc,
                    })
                  }
                />
              </div>
              {pages > 1 && (
                <nav
                  aria-label="Matching result pages"
                  className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2"
                >
                  <p className="text-small">
                    Page {page} of {pages}
                  </p>
                  {page > 1 && (
                    <Link
                      className="action action-outline"
                      href={matchingHref(answers, undefined, page - 1)}
                    >
                      Previous tutors
                    </Link>
                  )}
                  {page < pages && (
                    <Link
                      className="action action-outline"
                      href={matchingHref(answers, undefined, page + 1)}
                    >
                      More tutors
                    </Link>
                  )}
                </nav>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link className="action action-outline" href={change}>
                  Change answers
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center"
                  href="/tutors"
                >
                  Browse all tutors
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
