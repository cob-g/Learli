import { WorkflowActionForm } from "@/features/booking-workflows/forms";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { readWorkflowMoveCandidates } from "@/features/booking-workflows/service";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AccessError } from "@/lib/permissions/access";
import { readParticipantBooking } from "@/features/bookings/read-service";
import { bookingReadScope } from "@/features/bookings/read-input";
import { readDemoRescheduleCandidates } from "@/features/bookings/lifecycle-service";
import { DemoRescheduleForm } from "@/features/bookings/lifecycle-controls";
import { BookingUnavailable } from "@/features/bookings/read-presentation";
import { LessonTime } from "@/features/bookings/lesson-time";
import { formatLessonTime } from "@/features/bookings/format-time";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reschedule booking",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { bookingId } = await params,
    query = await searchParams;
  const scope = bookingReadScope.safeParse(query.scope ?? "student");
  const data = await loadPrivatePage(
    `/bookings/${encodeURIComponent(bookingId)}/reschedule?scope=${scope.success ? scope.data : "student"}`,
    async (runtime, headers) => {
      if (
        !scope.success ||
        scope.data === "tutor" ||
        Object.keys(query).some((k) => k !== "scope")
      )
        throw new AccessError(404);
      const booking = await readParticipantBooking(
        runtime,
        headers,
        bookingId,
        scope.data,
      );
      const times =
        booking.source !== "local_simulation"
          ? await readWorkflowMoveCandidates(
              bookingWorkflowContext(runtime),
              headers,
              bookingId,
            )
          : await readDemoRescheduleCandidates(runtime, headers, bookingId);
      return {
        booking,
        privateWorkflow: hasPersistentWorkflow(runtime),
        times: times.map((t) =>
          formatLessonTime(
            new Date(t.startAtUtc),
            new Date(t.endAtUtc),
            booking.viewerTimezone,
          ),
        ),
      };
    },
  );
  if (!data || !scope.success)
    return (
      <BookingUnavailable scope={scope.success ? scope.data : undefined} />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {data.privateWorkflow ? "Reschedule booking" : "Reschedule simulation"}
      </h1>
      <p className="mt-4 max-w-prose text-body">
        For {data.booking.learner.displayName} with{" "}
        {data.booking.tutor.displayName}.
        {!data.privateWorkflow &&
          " Local synthetic testing only; no lesson, payment or attendance is recorded."}
      </p>
      <section className="mt-6">
        <h2 className="text-item-title">Original scheduled time</h2>
        <LessonTime value={data.booking.time} />
      </section>
      {data.booking.source !== "local_simulation" ? (
        <WorkflowActionForm
          bookingId={bookingId}
          revision={data.booking.workflowRevision ?? 0}
          action="reschedule"
          scope={scope.data}
          times={data.times}
          privateWorkflow={data.privateWorkflow}
          source={data.booking.source}
        />
      ) : (
        <DemoRescheduleForm
          booking={data.booking}
          scope={scope.data}
          times={data.times}
        />
      )}
    </div>
  );
}
