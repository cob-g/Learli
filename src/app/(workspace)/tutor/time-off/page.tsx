import type { Metadata } from "next";
import Link from "next/link";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { timeZoneLabel } from "@/lib/time/zones";
import { readOwnTimeOff } from "@/features/time-off/service";
import { TimeOffForm } from "@/features/time-off/time-off-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Time off",
  robots: { index: false, follow: false },
};
export default async function TimeOffPage() {
  const data = await loadPrivatePage(
    "/tutor/time-off",
    async (runtime, headers) => ({
      schedule: await readOwnTimeOff(runtime, headers),
    }),
  );
  if (!data)
    return (
      <UnavailablePage
        title="Time off unavailable"
        message="This page is not available to your current account. Return to your account to see your assigned access."
      />
    );
  const schedule = data.schedule;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Time off</h1>
      <nav aria-label="Tutor work areas" className="mt-4 flex flex-wrap gap-4">
        <Link className="inline-flex min-h-11 items-center" href="/tutor">
          Tutor workspace
        </Link>
        <Link
          className="inline-flex min-h-11 items-center"
          href="/tutor/availability"
        >
          Weekly availability
        </Link>
        <Link
          className="inline-flex min-h-11 items-center border-b-2 border-primary"
          href="/tutor/time-off"
          aria-current="page"
        >
          Time off
        </Link>
      </nav>
      <div className="mt-8">
        {!schedule ? (
          <p className="text-body">
            Submit your <Link href="/tutor/profile">tutor profile</Link> before
            adding time off.
          </p>
        ) : !schedule.editable ? (
          <p className="text-body">
            Time off cannot be changed on this account. Return to your{" "}
            <Link href="/tutor">tutor workspace</Link>.
          </p>
        ) : (
          <TimeOffForm
            initial={schedule}
            zoneLabel={timeZoneLabel(schedule.timezone)}
          />
        )}
      </div>
    </div>
  );
}
