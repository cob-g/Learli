import type { Metadata } from "next";
import Link from "next/link";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { readOwnAvailability } from "@/features/availability/service";
import { AvailabilityForm } from "@/features/availability/availability-form";
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
    <div className="page-shell page-space">
      <h1 className="text-page-title">Weekly availability</h1>
      <nav aria-label="Tutor work areas" className="mt-4 flex flex-wrap gap-4">
        <Link className="inline-flex min-h-11 items-center" href="/tutor">
          Tutor workspace
        </Link>
        <Link
          className="inline-flex min-h-11 items-center"
          href="/tutor/profile"
        >
          Profile
        </Link>
        <Link
          className="inline-flex min-h-11 items-center border-b-2 border-primary"
          href="/tutor/availability"
          aria-current="page"
        >
          Availability
        </Link>
      </nav>
      <div className="mt-8">
        {!schedule ? (
          <p className="text-body">
            Submit your <Link href="/tutor/profile">tutor profile</Link> before
            setting weekly hours.
          </p>
        ) : !schedule.editable ? (
          <p className="text-body">
            Your tutor profile is suspended. Availability cannot be changed.
          </p>
        ) : (
          <AvailabilityForm
            initial={schedule}
            timeZones={listTimeZoneOptions(
              new Date(),
              isValidTimeZone(schedule.timezone) ? [schedule.timezone] : [],
            )}
          />
        )}
      </div>
    </div>
  );
}
