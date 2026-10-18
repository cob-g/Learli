import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { workflowLabels } from "@/features/booking-workflows/model";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { readWorkflowTask } from "@/features/booking-workflows/service";
import { WorkflowActionForm } from "@/features/booking-workflows/forms";
import { LessonTime } from "@/features/bookings/lesson-time";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { bookingStatusLabel } from "@/features/private-workflow/notice";
import Link from "next/link";
import { levelNames } from "@/features/subjects/catalog";
import {
  staffBookingInput,
  staffBookingsHref,
} from "@/features/booking-workflows/staff-input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned booking task",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const returnFilters = staffBookingInput.safeParse(
    await (searchParams ?? Promise.resolve({})),
  );
  const { bookingId } = await params,
    result = await loadPrivatePage(
      `/admin/bookings/${bookingId}`,
      async (runtime, headers) => ({
        task: await readWorkflowTask(
          bookingWorkflowContext(runtime),
          headers,
          bookingId,
        ),
        privateWorkflow: hasPersistentWorkflow(runtime),
        localWorkflow: getLocalWorkflow(runtime) !== null,
      }),
    );
  const task = result?.task;
  const privateWorkflow = result?.privateWorkflow ?? false;
  const state =
    task &&
    (
      [
        "provisional",
        "confirmed",
        "completed",
        "no_show",
        "expired",
        "cancelled",
        "replaced",
      ] as const
    ).find((value) => value === task.state);
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {privateWorkflow
          ? "Assigned booking task"
          : "Assigned synthetic booking task"}
      </h1>
      {privateWorkflow && (
        <Link
          className="mt-4 inline-flex min-h-11 items-center"
          href={staffBookingsHref(
            returnFilters.success
              ? returnFilters.data
              : staffBookingInput.parse({}),
          )}
        >
          Assigned bookings
        </Link>
      )}
      {task ? (
        <>
          <p className="mt-4 text-body">
            {task.subject} ·{" "}
            {privateWorkflow
              ? state
                ? bookingStatusLabel(state, true)
                : "Booking status unavailable"
              : (Object.entries(workflowLabels).find(
                  ([key]) => key === task.state,
                )?.[1] ?? "Synthetic state unavailable")}
            .{" "}
            {privateWorkflow
              ? "Administrative outcomes do not verify meeting attendance."
              : "This is administrative software testing, never attendance evidence."}
          </p>
          <div className="mt-4">
            <LessonTime value={task.time} />
          </div>
          {"learnerName" in task && (
            <section
              className="mt-8 max-w-prose"
              aria-labelledby="booking-participants"
            >
              <h2 id="booking-participants" className="text-section-title">
                Booking participants
              </h2>
              <p className="mt-3 text-body">Tutor: {task.tutorName}.</p>
              <p className="mt-2 text-body">
                Learner: {task.learnerName} ·{" "}
                {levelNames([task.learnerLevel]).join()}.
              </p>
              <p className="mt-2 text-body">
                Requested by: {task.requesterName} (
                {task.relationship === "self"
                  ? "independent learner"
                  : "authorized guardian"}
                ).
              </p>
              <p className="mt-3 text-caption wrap-anywhere">
                Logical booking: {task.logicalBookingId}. Revision{" "}
                {task.revision}.
              </p>
            </section>
          )}
          {task.actions.map((action) => (
            <WorkflowActionForm
              key={`${action}:${task.workflowRevision}`}
              bookingId={bookingId}
              revision={task.workflowRevision}
              action={action}
              admin
              privateWorkflow={privateWorkflow}
              source={
                result?.localWorkflow
                  ? "local_operation"
                  : "synthetic_readiness"
              }
            />
          ))}
        </>
      ) : (
        <p className="mt-4 text-body">
          This booking task is unavailable on this account. Current MFA and an
          exact assignment are required.
        </p>
      )}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation replaces the prior private document. */}
      <a className="mt-8 inline-flex min-h-11 items-center" href="/support">
        Dispute an administrative outcome
      </a>
    </div>
  );
}
