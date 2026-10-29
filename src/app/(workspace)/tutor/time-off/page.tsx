import type { Metadata } from "next";
import Link from "next/link";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { timeZoneLabel } from "@/lib/time/zones";
import { readOwnTimeOff } from "@/features/time-off/service";
import { TimeOffForm } from "@/features/time-off/time-off-form";
import { localDateOf } from "@/features/time-off/calendar";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
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
      privateWorkflow: hasPersistentWorkflow(runtime),
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
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Tutor workspace</p>
          <h1>Time off</h1>
          {schedule?.editable && (
            <>
              <p>
                {data.privateWorkflow
                  ? "Mark when you cannot teach without changing your weekly hours. Time off cannot overlap an active booking request or confirmed booking."
                  : "Mark when you cannot teach without changing your weekly hours. Time off cannot overlap an unexpired simulated reservation."}
              </p>
              <p className="workspace-page-small">
                Times use <b>{timeZoneLabel(schedule.timezone)}</b>. Saved
                periods keep the same actual instants if you change your
                teaching time zone.
              </p>
            </>
          )}
        </div>
      </header>
      {!schedule ? (
        <p className="workspace-page-note">
          Submit your <Link href="/tutor/profile">tutor profile</Link> before
          adding time off.
        </p>
      ) : !schedule.editable ? (
        <p className="workspace-page-note">
          Time off cannot be changed on this account. Return to your{" "}
          <Link href="/tutor">tutor workspace</Link>.
        </p>
      ) : (
        <TimeOffForm
          initial={schedule}
          privateWorkflow={data.privateWorkflow}
          zoneLabel={timeZoneLabel(schedule.timezone)}
          showIntro={false}
          today={localDateOf(new Date().getTime(), schedule.timezone)}
        />
      )}
    </div>
  );
}
