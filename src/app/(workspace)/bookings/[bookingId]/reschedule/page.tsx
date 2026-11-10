import { WorkflowActionForm } from "@/features/booking-workflows/forms";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { readWorkflowMoveCandidates } from "@/features/booking-workflows/service";
import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AccessError } from "@/lib/permissions/access";
import { readParticipantBooking } from "@/features/bookings/read-service";
import { bookingReadScope } from "@/features/bookings/read-input";
import { bookingDetailPath } from "@/features/bookings/read-model";
import { readDemoRescheduleCandidates } from "@/features/bookings/lifecycle-service";
import { DemoRescheduleForm } from "@/features/bookings/lifecycle-controls";
import "@/features/bookings/booking-pages.css";
import { CalendarDays } from "lucide-react";
import {
  BookingUnavailable,
  bookingWorkspaceLabel,
} from "@/features/bookings/read-presentation";
import { LessonTime } from "@/features/bookings/lesson-time";
import { createLessonTimeFormatter } from "@/features/bookings/format-time";
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
      const formatTime = createLessonTimeFormatter(booking.viewerTimezone);
      return {
        booking,
        privateWorkflow: hasPersistentWorkflow(runtime),
        times: times.map((t) =>
          formatTime(new Date(t.startAtUtc), new Date(t.endAtUtc)),
        ),
      };
    },
  );
  if (!data || !scope.success)
    return (
      <BookingUnavailable scope={scope.success ? scope.data : undefined} />
    );
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {bookingWorkspaceLabel(scope.data)}
          </p>
          <h1>
            {data.privateWorkflow
              ? "Reschedule booking"
              : "Reschedule simulation"}
          </h1>
          <p>
            For {data.booking.learner.displayName} with{" "}
            {data.booking.tutor.displayName}.
            {!data.privateWorkflow &&
              " Local synthetic testing only; no lesson, payment or attendance is recorded."}
          </p>
        </div>
      </header>
      <section className="booking-panel">
        <h2>Original scheduled time</h2>
        <div className="booking-when-row">
          <span className="booking-when-tile" aria-hidden="true">
            <CalendarDays size={30} />
          </span>
          <LessonTime value={data.booking.time} />
        </div>
      </section>
      {!data.times.length ? (
        <section className="workspace-blank">
          <h2>No other times available</h2>
          <p>
            Your current booking is unchanged. The tutor may have no open times
            or may not cover the learner&apos;s current level. Check again later
            or contact support.
          </p>
          <Link
            className="mt-2 inline-flex min-h-11 items-center"
            href={bookingDetailPath(bookingId, scope.data)}
          >
            Return to booking
          </Link>
        </section>
      ) : data.booking.source !== "local_simulation" ? (
        <section className="booking-panel">
          <WorkflowActionForm
            bookingId={bookingId}
            revision={data.booking.workflowRevision ?? 0}
            action="reschedule"
            scope={scope.data}
            times={data.times}
            displayTimezone={data.booking.viewerTimezone}
            privateWorkflow={data.privateWorkflow}
            source={data.booking.source}
          />
        </section>
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
