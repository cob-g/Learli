import { loadPublicReviews } from "@/features/review-publication/public";
import {
  PublicReviewSection,
  PublicationBookingHandoff,
} from "@/features/review-publication/presentation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { levelNames } from "@/features/subjects/catalog";
import { readPublicTutor } from "@/features/tutors/public";
import { InitialsAvatar } from "@/features/tutors/tutor-card";
import { ProfilePicker } from "@/features/public-availability/profile-picker";
import { loadProfilePreview } from "@/features/public-availability/profile";
import { listTimeZoneOptions } from "@/lib/time/zones";
import type { SearchValues } from "@/features/bookings/selection";
import { teachingLanguageNames } from "@/features/tutors/teaching-languages";
import {
  noIndex,
  publicPageMetadata,
  tutorPageTitle,
} from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
const loadTutor = cache(readPublicTutor);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const tutor = await loadTutor((await params).slug);
  // Only public tutor fields reach metadata; an unknown tutor gets none. The
  // canonical address drops the visitor's filters and selected time, and a
  // profile that could not be loaded is never offered for indexing.
  return tutor
    ? publicPageMetadata({
        title: tutorPageTitle(tutor),
        description: tutor.headline,
        path: `/tutors/${tutor.slug}`,
      })
    : { title: "Tutor", robots: noIndex };
}

export default async function TutorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchValues>;
}) {
  const tutor = await loadTutor((await params).slug);
  if (tutor === null) notFound();
  if (tutor === undefined)
    return (
      <div className="page-shell page-space">
        <h1 className="text-page-title">Tutor</h1>
        <p role="alert" className="mt-8 max-w-prose text-body">
          We couldn&apos;t load this tutor. Try again, or contact support if
          this keeps happening.
        </p>
        <Link className="mt-2 inline-flex min-h-11 items-center" href="/tutors">
          Browse all tutors
        </Link>
      </div>
    );
  const reviews = await loadPublicReviews(tutor.slug);
  // null is the ordinary disabled composition; an enabled failure must not
  // silently show the historical demo duration/source picker.
  const preview =
    reviews === null
      ? await loadProfilePreview(tutor, await searchParams)
      : null;
  return (
    <div className="page-shell page-space">
      <Link className="mb-6 inline-flex min-h-12 items-center" href="/tutors">
        Browse all tutors
      </Link>
      <div className="flex items-start gap-4 border-b border-border pb-8 md:gap-6">
        <InitialsAvatar name={tutor.displayName} large />
        <div className="min-w-0 wrap-anywhere">
          <h1 className="text-page-title wrap-anywhere">{tutor.displayName}</h1>
          <p className="mt-2 max-w-prose text-body wrap-anywhere">
            {tutor.headline}
          </p>
          <p className="mt-2 max-w-prose text-body">
            {tutor.offerings.map((row) => row.subjectName).join(" · ")}
          </p>
          <p className="mt-2 max-w-prose text-small">
            {levelNames([
              ...new Set(tutor.offerings.flatMap((row) => row.levels)),
            ]).join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-8 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <aside className="rounded-surface border border-border bg-surface p-6 md:p-8 lg:order-2">
          {preview ? (
            <ProfilePicker
              tutor={tutor}
              preview={preview}
              zones={listTimeZoneOptions(new Date(), [preview.timezone])}
            />
          ) : (
            <PublicationBookingHandoff
              slug={tutor.slug}
              subjectSlug={tutor.offerings[0]?.subjectSlug}
            />
          )}
        </aside>
        <div className="min-w-0 lg:order-1">
          <section aria-labelledby="subjects-title">
            <h2 id="subjects-title" className="text-section-title">
              Subjects and levels
            </h2>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {tutor.offerings.map((offering) => (
                <li key={offering.subjectSlug} className="py-4">
                  <p className="text-body">{offering.subjectName}</p>
                  <p className="text-small text-muted-foreground">
                    {levelNames(offering.levels).join(" · ")}
                  </p>
                  {offering.specialty && (
                    <p className="text-small wrap-anywhere text-muted-foreground">
                      Specialty: {offering.specialty}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="languages-title" className="mt-8">
            <h2 id="languages-title" className="text-section-title">
              Teaching languages
            </h2>
            <p className="mt-4 max-w-prose text-body">
              {teachingLanguageNames(tutor.teachingLanguages).join(" · ") ||
                "No teaching languages listed"}
            </p>
            {tutor.teachingLanguages.length > 0 && (
              <p className="mt-2 max-w-prose text-small text-muted-foreground">
                Declared by the tutor. Learli has not checked language
                proficiency.
              </p>
            )}
          </section>
          <section aria-labelledby="introduction-title" className="mt-12">
            <h2 id="introduction-title" className="text-section-title">
              Introduction
            </h2>
            <p className="mt-4 max-w-prose font-reading text-reading wrap-anywhere whitespace-pre-line">
              {tutor.bio}
            </p>
          </section>
          <PublicReviewSection result={reviews} />
          <section aria-labelledby="background-title" className="mt-12">
            <h2 id="background-title" className="text-section-title">
              Teaching background
            </h2>
            <p className="mt-2 max-w-prose text-small text-muted-foreground">
              Written by the tutor. Learli has not checked these details.
            </p>
            <p className="mt-4 max-w-prose font-reading text-reading wrap-anywhere whitespace-pre-line">
              {tutor.teachingBackground}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
