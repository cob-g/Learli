import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
import { WorkflowActionForm } from "@/features/booking-workflows/forms";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { readTutorCompletion } from "@/features/booking-workflows/service";
import { publicationContext } from "@/features/review-publication/composition";
import { readAuthorPublication } from "@/features/review-publication/service";
import type { Metadata } from "next";
import { readAuthorReview } from "@/features/private-reviews/service";
import { BookingReadLink } from "@/features/bookings/read-controls";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AccessError } from "@/lib/permissions/access";
import { readParticipantBooking } from "@/features/bookings/read-service";
import {
  BookingDetailView,
  BookingUnavailable,
} from "@/features/bookings/read-presentation";
import { bookingReadScope } from "@/features/bookings/read-input";
import { readPrivateMeetingLink } from "@/features/booking-meeting-links/service";
import { BookingMeetingSection } from "@/features/booking-meeting-links/meeting-section";
import type { MeetingSectionState } from "@/features/booking-meeting-links/model";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking details",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { bookingId } = await params;
  const query = await searchParams;
  const scope = bookingReadScope.safeParse(query.scope ?? "student");
  const path = `/bookings/${encodeURIComponent(bookingId)}?scope=${scope.success ? scope.data : "student"}`;
  const loaded = await loadPrivatePage(path, async (runtime, headers) => {
    if (!scope.success || Object.keys(query).some((key) => key !== "scope"))
      throw new AccessError(404);
    return {
      detail: await readParticipantBooking(
        runtime,
        headers,
        bookingId,
        scope.data,
      ),
      privateWorkflow: isPrivateWorkflow(runtime),
    };
  });
  const detail = loaded?.detail;
  const privateWorkflow = loaded?.privateWorkflow ?? false;
  if (!detail || !scope.success)
    return (
      <BookingUnavailable scope={scope.success ? scope.data : undefined} />
    );
  const meeting = await loadPrivatePage(
    path,
    async (runtime, headers): Promise<MeetingSectionState> => {
      try {
        return await readPrivateMeetingLink(runtime, headers, bookingId);
      } catch (error) {
        if (error instanceof AccessError && error.status !== 503)
          return { state: "unavailable" };
        return { state: "error" };
      }
    },
  );
  const review =
    detail.source === "local_simulation" &&
    scope.data !== "tutor" &&
    detail.state === "demo_completed" &&
    detail.currentHeadId === detail.id
      ? await loadPrivatePage(path, async (runtime, headers) => ({
          saved: Boolean(
            (await readAuthorReview(runtime, headers, bookingId)).review,
          ),
        }))
      : null;
  const publication =
    !privateWorkflow &&
    detail.source === "synthetic_readiness" &&
    detail.state === "completed" &&
    scope.data !== "tutor" &&
    detail.currentHeadId === detail.id
      ? await loadPrivatePage(path, async (runtime, headers) => ({
          saved: Boolean(
            (
              await readAuthorPublication(
                publicationContext(runtime),
                headers,
                bookingId,
              )
            ).review,
          ),
        }))
      : null;
  const completion =
    scope.data === "tutor" && detail.state === "confirmed"
      ? await loadPrivatePage(path, (runtime, headers) =>
          readTutorCompletion(
            bookingWorkflowContext(runtime),
            headers,
            bookingId,
          ),
        )
      : null;
  return (
    <BookingDetailView
      booking={detail}
      privateWorkflow={privateWorkflow}
      scope={scope.data}
      reviewSection={
        completion ? (
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-section-title">Session completion</h2>
            <WorkflowActionForm
              bookingId={completion.id}
              revision={completion.workflowRevision}
              action="complete"
              privateWorkflow={privateWorkflow}
              scope="tutor"
            />
          </section>
        ) : !privateWorkflow &&
          detail.source === "synthetic_readiness" &&
          ["completed", "no_show", "cancelled"].includes(detail.state) ? (
          <section className="mt-8 border-t border-border pt-6">
            {publication && (
              <div className="mb-8">
                <h2 className="text-section-title">
                  Synthetic publication review
                </h2>
                <p className="mt-2 max-w-prose text-small">
                  One immutable review for this administrative completion,
                  subject to assigned manual moderation and privacy review.
                </p>
                <a
                  className="mt-4 inline-flex min-h-11 items-center"
                  href={`/bookings/${bookingId}/publication-review?scope=${scope.data}`}
                >
                  {publication.saved
                    ? "View synthetic publication review"
                    : "Add synthetic publication review"}
                </a>
              </div>
            )}
            <h2 className="text-section-title">
              Dispute this administrative record
            </h2>
            <a
              className="mt-4 inline-flex min-h-11 items-center"
              href={`/bookings/${bookingId}/dispute`}
            >
              Request synthetic booking dispute
            </a>
            <p className="mt-2 text-small">
              Completion and no-show are administrative states, never observed
              attendance.
            </p>
          </section>
        ) : detail.source === "synthetic_readiness" &&
          scope.data !== "tutor" &&
          ["provisional", "confirmed"].includes(detail.state) ? (
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-section-title">
              {privateWorkflow ? "Change booking" : "Change synthetic booking"}
            </h2>
            <a
              className="mt-4 inline-flex min-h-11 items-center"
              href={`/bookings/${bookingId}/reschedule?scope=${scope.data}`}
            >
              {privateWorkflow
                ? "Reschedule booking"
                : "Move synthetic booking"}
            </a>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-2 text-action">
                {privateWorkflow
                  ? "Cancel booking"
                  : "Cancel synthetic booking"}
              </summary>
              <WorkflowActionForm
                bookingId={bookingId}
                revision={detail.workflowRevision ?? 0}
                action="cancel"
                privateWorkflow={privateWorkflow}
                scope={scope.data}
              />
            </details>
          </section>
        ) : (
          review && (
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="text-section-title">Private synthetic review</h2>
              <p className="mt-2 max-w-prose text-small text-muted-foreground">
                This completed local fixture can have one private review. It
                stays private after moderation and does not prove attendance.
              </p>
              <BookingReadLink
                href={`/bookings/${bookingId}/review`}
                label={
                  review.saved
                    ? "View private synthetic review"
                    : "Add private synthetic review"
                }
              />
            </section>
          )
        )
      }
      meetingSection={
        <BookingMeetingSection
          key={`${bookingId}:${detail.state}:${meeting?.state}:${meeting?.state === "present" ? meeting.revision : 0}`}
          bookingId={bookingId}
          privateWorkflow={privateWorkflow}
          inactive={[
            "demo_cancelled",
            "demo_replaced",
            "demo_completed",
            "cancelled",
            "replaced",
            "completed",
            "no_show",
            "expired",
          ].includes(detail.state)}
          initial={meeting ?? { state: "error" }}
        />
      }
    />
  );
}
