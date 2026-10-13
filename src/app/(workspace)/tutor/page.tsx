import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import {
  readTutorBookingWorkspace,
  tutorAgendaBooking,
} from "@/features/tutors/booking-workspace";
import { TutorBookingAgenda } from "@/features/tutors/booking-agenda";
import { TutorWorkspaceNavigation } from "@/features/tutors/workspace-navigation";
import { TutorBookingRefresh } from "@/features/tutors/booking-refresh";
import { ReviewNotice } from "@/features/tutors/review-notice";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your bookings",
  robots: { index: false, follow: false },
};
export default async function TutorWorkspacePage() {
  const data = await loadPrivatePage("/tutor", readTutorBookingWorkspace);
  if (!data)
    return (
      <>
        <UnavailablePage
          title="Workspace access unavailable"
          message="This workspace is not available to your current account. Return to your account to see your assigned access."
        />
        <nav
          aria-label="Workspace recovery"
          className="page-shell flex flex-wrap gap-4 pb-8"
        >
          <Link className="inline-flex min-h-11 items-center" href="/tutor">
            Try again
          </Link>
          <Link className="inline-flex min-h-11 items-center" href="/account">
            Account settings
          </Link>
          <Link className="inline-flex min-h-11 items-center" href="/contact">
            Contact support
          </Link>
        </nav>
      </>
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Your bookings</h1>
      <div className="mt-4">
        <TutorWorkspaceNavigation />
      </div>
      <p className="mt-3 max-w-prose text-small text-muted-foreground">
        Local simulated bookings assigned to you. Times use your current account
        time zone.
      </p>
      <div className="mt-6 border-y border-border py-3">
        <TutorBookingRefresh />
      </div>
      <div className="mt-8">
        <TutorBookingAgenda
          active={data.overview?.active.items.map(tutorAgendaBooking) ?? []}
          history={data.overview?.history.items.map(tutorAgendaBooking) ?? []}
          evaluatedAt={data.overview?.active.snapshotAtUtc}
          hasMoreActive={data.overview?.active.hasNext ?? false}
          hasMoreHistory={data.overview?.history.hasNext ?? false}
        />
      </div>
      <div className="mt-12">
        <ReviewNotice
          status={data.profile?.reviewStatus ?? null}
          editHref="/tutor/profile"
          publicHref={data.profile ? `/tutors/${data.profile.slug}` : undefined}
        />
      </div>
      <SignOut />
      <nav
        aria-label="Workspace support"
        className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-small"
      >
        <Link className="inline-flex min-h-11 items-center" href="/contact">
          Contact support
        </Link>
        <Link
          className="inline-flex min-h-11 items-center"
          href="/report-a-concern"
        >
          Report a concern
        </Link>
      </nav>
    </div>
  );
}
