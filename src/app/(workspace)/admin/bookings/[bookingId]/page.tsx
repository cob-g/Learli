import { workflowLabels } from "@/features/booking-workflows/model";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { readWorkflowTask } from "@/features/booking-workflows/service";
import { WorkflowActionForm } from "@/features/booking-workflows/forms";
import { LessonTime } from "@/features/bookings/lesson-time";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned synthetic booking task",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params,
    task = await loadPrivatePage(
      `/admin/bookings/${bookingId}`,
      (runtime, headers) =>
        readWorkflowTask(bookingWorkflowContext(runtime), headers, bookingId),
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Assigned synthetic booking task</h1>
      {task ? (
        <>
          <p className="mt-4 text-body">
            {task.subject} ·{" "}
            {Object.entries(workflowLabels).find(
              ([key]) => key === task.state,
            )?.[1] ?? "Synthetic state unavailable"}
            . This is administrative software testing, never attendance
            evidence.
          </p>
          <div className="mt-4">
            <LessonTime value={task.time} />
          </div>
          {task.actions.map((action) => (
            <WorkflowActionForm
              key={`${action}:${task.workflowRevision}`}
              bookingId={bookingId}
              revision={task.workflowRevision}
              action={action}
              admin
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
