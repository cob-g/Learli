import type { Metadata } from "next";
import Link from "next/link";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { readOwnAvailability } from "@/features/availability/service";
import { AvailabilityForm } from "@/features/availability/availability-form";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Availability",
  robots: { index: false, follow: false },
};
export default async function AvailabilityPage() {
  const data = await loadPrivatePage(
    "/tutor/availability",
    async (runtime, headers) => ({
      schedule: await readOwnAvailability(runtime, headers),
      privateWorkflow: hasPersistentWorkflow(runtime),
    }),
  );
  if (!data)
    return (
      <UnavailablePage
        title="Availability unavailable"
        message="This page is not available to your current account. Return to your account to see your assigned access."
      />
    );
  const schedule = data.schedule;
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Tutor workspace</p>
          <h1>Weekly availability</h1>
          <p>
            <Link href="/tutor/time-off">Manage time off</Link> for dated
            periods when you cannot teach.
          </p>
        </div>
      </header>
      {!schedule ? (
        <p className="workspace-page-note">
          Submit your <Link href="/tutor/profile">tutor profile</Link> before
          setting weekly hours.
        </p>
      ) : !schedule.editable ? (
        <p className="workspace-page-note">
          Your tutor profile is suspended. Availability cannot be changed.
        </p>
      ) : (
        <AvailabilityForm
          initial={schedule}
          privateWorkflow={data.privateWorkflow}
          timeZones={listTimeZoneOptions(
            new Date(),
            isValidTimeZone(schedule.timezone) ? [schedule.timezone] : [],
          )}
        />
      )}
    </div>
  );
}
