import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import {
  groupSubjects,
  learnerLevelOptions,
} from "@/features/subjects/catalog";
import { resolveMatch } from "@/features/matching/match";
import { readPublicCatalog, tutorsHref } from "@/features/tutors/public";
import { TutorList } from "@/features/tutors/tutor-card";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get matched" };

function ChoiceError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-center gap-1 text-small text-error">
      <CircleAlert size={16} aria-hidden="true" />
      {message}
    </p>
  );
}

export default async function GetMatchedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const catalog = await readPublicCatalog();
  if (!catalog)
    return (
      <div className="page-shell page-space">
        <h1 className="text-page-title">Get matched</h1>
        <p role="alert" className="mt-8 max-w-prose text-body">
          We couldn&apos;t load tutors. Try again, or{" "}
          <Link href="/contact">contact support</Link> if this keeps happening.
        </p>
      </div>
    );
  if (catalog.tutors.length === 0)
    return (
      <div className="page-shell page-space">
        <h1 className="text-page-title">Get matched</h1>
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

  const match = resolveMatch(
    await searchParams,
    catalog.subjects,
    catalog.tutors,
  );
  const levelName = (value: string) =>
    learnerLevelOptions.find(([level]) => level === value)?.[1] ?? "";
  const browse = (
    <Link className="inline-flex min-h-11 items-center" href="/tutors">
      Browse all tutors
    </Link>
  );

  if (match.step === "level")
    return (
      <div className="page-shell page-space">
        <div className="mx-auto max-w-xl">
          <h1 className="text-page-title">Get matched</h1>
          <p className="mt-4 text-small text-muted-foreground">
            Question 1 of 2
          </p>
          <form method="get" className="mt-2">
            <fieldset>
              <legend className="text-section-title">
                Which level is the learner at?
              </legend>
              <div className="mt-2">
                <ChoiceError message={match.error} />
              </div>
              <div className="mt-2 flex flex-col">
                {learnerLevelOptions.map(([value, label]) => (
                  <label
                    key={value}
                    className="inline-flex min-h-11 items-center gap-2 text-body"
                  >
                    <input
                      type="radio"
                      className="size-5"
                      name="level"
                      value={value}
                      defaultChecked={match.level === value}
                      required
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <button className="action action-primary" type="submit">
                Continue
              </button>
              {browse}
            </div>
          </form>
        </div>
      </div>
    );

  if (match.step === "subject")
    return (
      <div className="page-shell page-space">
        <div className="mx-auto max-w-xl">
          <h1 className="text-page-title">Get matched</h1>
          <p className="mt-4 text-small text-muted-foreground">
            Question 2 of 2
          </p>
          <form method="get" className="mt-2">
            <input type="hidden" name="level" value={match.level} />
            <fieldset>
              <legend className="text-section-title">
                Which subject do you need help with?
              </legend>
              <div className="mt-2">
                <ChoiceError message={match.error} />
              </div>
              {groupSubjects(match.choices).map((group) => (
                <div key={group.category} className="mt-4">
                  <h2 className="text-label text-muted-foreground">
                    {group.label}
                  </h2>
                  <div className="flex flex-col">
                    {group.subjects.map((subject) => (
                      <label
                        key={subject.slug}
                        className="inline-flex min-h-11 items-center gap-2 text-body"
                      >
                        <input
                          type="radio"
                          className="size-5"
                          name="subject"
                          value={subject.slug}
                          required
                        />
                        {subject.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <button className="action action-primary" type="submit">
                Show matching tutors
              </button>
              <Link
                className="inline-flex min-h-11 items-center"
                href={`/get-matched?level=${match.level}&change=level`}
              >
                Back
              </Link>
              {browse}
            </div>
          </form>
        </div>
      </div>
    );

  const level = levelName(match.level);
  const change = `/get-matched?level=${match.level}&change=level`;
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <h1 className="text-page-title">Get matched</h1>
        <div className="mt-8">
          {match.total === 0 ? (
            <EmptyState
              title="No tutors match your answers"
              href={change}
              action="Change answers"
              links={[
                { href: "/tutors", label: "Browse all tutors" },
                { href: "/contact", label: "Contact support" },
              ]}
            >
              <p>
                {level} · {match.subject.name}
              </p>
            </EmptyState>
          ) : (
            <>
              <p role="status" className="text-body">
                {match.total === 1
                  ? `1 tutor teaches ${match.subject.name} at ${level}`
                  : `${match.total} tutors teach ${match.subject.name} at ${level}`}
              </p>
              <p className="mt-2 text-small text-muted-foreground">
                Matched by subject and level, listed by name.
              </p>
              <div className="mt-4">
                <TutorList tutors={match.tutors} />
              </div>
              <p className="mt-4 flex flex-wrap gap-x-6">
                {match.total > match.tutors.length && (
                  <Link
                    className="inline-flex min-h-11 items-center"
                    href={tutorsHref({
                      subject: match.subject.slug,
                      level: match.level,
                    })}
                  >
                    See all {match.total} matching tutors
                  </Link>
                )}
                <Link
                  className="inline-flex min-h-11 items-center"
                  href={change}
                >
                  Change answers
                </Link>
                {browse}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
