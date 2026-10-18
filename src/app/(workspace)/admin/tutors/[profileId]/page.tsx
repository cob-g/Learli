import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { timeZoneLabel } from "@/lib/time/zones";
import { AdminShell } from "@/features/admin/admin-shell";
import { readTutorApplication } from "@/features/tutors/review";
import { ProfileSummary } from "@/features/tutors/profile-summary";
import { ScreeningForm } from "@/features/tutor-screening/forms";
import { ReviewActions } from "@/features/tutors/review-actions";
import { ReviewStatusBadge } from "@/features/tutors/review-status";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tutor application",
  robots: { index: false, follow: false },
};
export default async function TutorApplicationPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const result = await loadPrivatePage(
    `/admin/tutors/${profileId}`,
    async (runtime, headers) => ({
      application: await readTutorApplication(runtime, headers, profileId),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
  );
  const application = result?.application;
  // Identical for a missing application and a missing permission.
  if (!result || !application)
    return (
      <UnavailablePage
        title="We can't find that application"
        message="It may not exist, or this account may not be able to open it."
      />
    );
  return (
    <AdminShell current="tutors">
      <Link className="inline-flex min-h-11 items-center" href="/admin/tutors">
        Tutor review queue
      </Link>
      <h1 className="mt-4 text-page-title wrap-anywhere">
        {application.displayName}
      </h1>
      <p className="mt-4">
        <ReviewStatusBadge status={application.reviewStatus} />
      </p>
      <p className="mt-4 max-w-prose text-small text-muted-foreground">
        {result.localWorkflow
          ? "The tutor supplied the profile below. Review the required evidence for your assigned application before approving it."
          : result.privateWorkflow
            ? "The tutor supplied the profile below. Review the required fictional evidence for this assigned application before approving it."
            : "The tutor wrote everything below. Learli has not checked it, and the screening process is not decided."}
      </p>
      <div className="mt-8">
        <ProfileSummary
          profile={application}
          timeZone={timeZoneLabel(application.timezone)}
        />
      </div>
      <section
        aria-labelledby="review-title"
        className="mt-12 max-w-3xl border-t border-border pt-8"
      >
        <h2 id="review-title" className="text-section-title">
          Review
        </h2>
        {application.screening ? (
          <ScreeningForm
            key={application.screening.revision}
            tutorId={profileId}
            detail={application.screening}
            privateWorkflow={result.privateWorkflow}
            localWorkflow={result.localWorkflow}
          />
        ) : application.ownedByReviewer ? (
          <p className="mt-4 max-w-prose text-body">
            You can&apos;t review your own application. Another admin must
            review it.
          </p>
        ) : (
          <div className="mt-4">
            <ReviewActions
              profileId={application.id}
              tutorName={application.displayName}
              status={application.reviewStatus}
            />
          </div>
        )}
      </section>
    </AdminShell>
  );
}
