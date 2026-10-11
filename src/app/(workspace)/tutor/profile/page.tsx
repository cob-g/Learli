import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions, timeZoneLabel } from "@/lib/time/zones";
import { readAccount } from "@/features/account/service";
import { listSubjects } from "@/features/subjects/service";
import { readOwnTutorProfile } from "@/features/tutors/service";
import { tutorCanEdit } from "@/features/tutors/review-rules";
import { ProfileSummary } from "@/features/tutors/profile-summary";
import { ReviewNotice } from "@/features/tutors/review-notice";
import { TutorProfileForm } from "@/features/tutors/tutor-profile-form";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tutor profile",
  robots: { index: false, follow: false },
};
export default async function TutorProfilePage() {
  const data = await loadPrivatePage(
    "/tutor/profile",
    async (runtime, headers) => ({
      profile: await readOwnTutorProfile(runtime, headers),
      account: await readAccount(runtime, headers),
      subjects: await listSubjects(runtime.db, true),
    }),
  );
  if (!data)
    return (
      <UnavailablePage
        title="Tutor profile unavailable"
        message="This page is not available to your current account. Return to your account to see your assigned access."
      />
    );
  const { profile, account, subjects } = data;
  const editable = !profile || tutorCanEdit(profile.reviewStatus);
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Tutor profile</h1>
      <div className="mt-8">
        <ReviewNotice
          status={profile?.reviewStatus ?? null}
          publicHref={profile ? `/tutors/${profile.slug}` : undefined}
        />
      </div>
      <div className="mt-8">
        {editable ? (
          <TutorProfileForm
            // Only the editable values cross into the browser bundle's props.
            resubmitting={profile?.reviewStatus === "rejected"}
            initial={
              profile && {
                headline: profile.headline,
                bio: profile.bio,
                teachingBackground: profile.teachingBackground,
                teachingLanguages: profile.teachingLanguages,
                timezone: profile.timezone,
                offerings: profile.offerings.map((offering) => ({
                  subjectId: offering.subjectId,
                  levels: offering.levels,
                  specialty: offering.specialty,
                })),
              }
            }
            subjects={subjects}
            timeZones={listTimeZoneOptions(new Date(), [
              account.timezone,
              ...(profile ? [profile.timezone] : []),
            ])}
            defaultTimeZone={account.timezone}
          />
        ) : (
          <ProfileSummary
            profile={profile}
            timeZone={timeZoneLabel(profile.timezone)}
          />
        )}
      </div>
      <Link className="mt-8 inline-flex min-h-11 items-center" href="/tutor">
        Tutor workspace
      </Link>
    </div>
  );
}
