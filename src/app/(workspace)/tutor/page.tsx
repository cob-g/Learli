import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import {
  readTutorBookingWorkspace,
  tutorAgendaBooking,
} from "@/features/tutors/booking-workspace";
import { TutorBookingAgenda } from "@/features/tutors/booking-agenda";
import { TutorBookingRefresh } from "@/features/tutors/booking-refresh";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { TutorSetupPanel } from "@/features/tutors/setup-panel";
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
  const active = data.overview?.active.items.map(tutorAgendaBooking) ?? [];
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Tutor workspace</p>
          <h1>Your bookings</h1>
          <p>
            {privateWorkflow
              ? "Manage sessions assigned to you. Times use your current account time zone."
              : "Local simulated bookings assigned to you. Times use your current account time zone."}
          </p>
        </div>
        <TutorBookingRefresh />
      </header>
      <TutorSetupPanel
        readiness={data.readiness}
        reviewStatus={data.profile?.reviewStatus ?? null}
        publicHref={
          data.profile && data.readiness.publicListing
            ? `/tutors/${data.profile.slug}`
            : undefined
        }
        privateWorkflow={privateWorkflow}
      />
      <TutorBookingAgenda
        active={active}
        history={data.overview?.history.items.map(tutorAgendaBooking) ?? []}
        evaluatedAt={data.overview?.active.snapshotAtUtc}
        hasMoreActive={data.overview?.active.hasNext ?? false}
        hasMoreHistory={data.overview?.history.hasNext ?? false}
        privateWorkflow={privateWorkflow}
        emptyAction={null}
      />
      <div className="tutor-signout">
        <p>Signed in on this device</p>
        <SignOut className="" />
      </div>
    </div>
  );
}
