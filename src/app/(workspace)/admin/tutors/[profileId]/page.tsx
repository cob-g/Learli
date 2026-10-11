import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { timeZoneLabel } from "@/lib/time/zones";
import { AdminShell } from "@/features/admin/admin-shell";
import { readTutorApplication } from "@/features/tutors/review";
import { ProfileSummary } from "@/features/tutors/profile-summary";
import { ReviewActions } from "@/features/tutors/review-actions";
import { ReviewStatusBadge } from "@/features/tutors/review-status";
import { UnavailablePage } from "@/components/shared/unavailable-page";
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
  const application = await loadPrivatePage(
    `/admin/tutors/${profileId}`,
    (runtime, headers) => readTutorApplication(runtime, headers, profileId),
  );
  // Identical for a missing application and a missing permission.
  if (!application)
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
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        The tutor wrote everything below. Learli has not checked it, and the
        screening process is not decided.
      </p>
      <div className="mt-8">
        <ProfileSummary
          profile={application}
          timeZone={timeZoneLabel(application.timezone)}
        />
      </div>
      <section aria-labelledby="review-title" className="mt-12">
        <h2 id="review-title" className="text-section-title">
          Review
        </h2>
        {application.ownedByReviewer ? (
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
