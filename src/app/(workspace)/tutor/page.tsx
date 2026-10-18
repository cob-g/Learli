import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import {
  readTutorBookingWorkspace,
  tutorAgendaBooking,
} from "@/features/tutors/booking-workspace";
import { TutorBookingAgenda } from "@/features/tutors/booking-agenda";
import { TutorBookingRefresh } from "@/features/tutors/booking-refresh";
import { ReviewNotice } from "@/features/tutors/review-notice";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your bookings",
  robots: { index: false, follow: false },
};
export default async function TutorWorkspacePage() {
  const result = await loadPrivatePage("/tutor", async (runtime, headers) => ({
    data: await readTutorBookingWorkspace(runtime, headers),
    privateWorkflow: hasPersistentWorkflow(runtime),
  }));
  if (!result)
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
  const { data, privateWorkflow } = result;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Your bookings</h1>
      <p className="mt-3 max-w-prose text-small text-muted-foreground">
        {privateWorkflow
          ? "Manage sessions assigned to you. Times use your current account time zone."
          : "Local simulated bookings assigned to you. Times use your current account time zone."}
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
          privateWorkflow={privateWorkflow}
        />
      </div>
      <div className="mt-12">
        <ReviewNotice
          status={data.profile?.reviewStatus ?? null}
          editHref="/tutor/profile"
          publicHref={data.profile ? `/tutors/${data.profile.slug}` : undefined}
          privateWorkflow={privateWorkflow}
        />
      </div>
      <SignOut />
    </div>
  );
}
