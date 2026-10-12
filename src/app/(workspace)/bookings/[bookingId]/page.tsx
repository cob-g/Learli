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
  const detail = await loadPrivatePage(path, (runtime, headers) => {
    if (!scope.success || Object.keys(query).some((key) => key !== "scope"))
      throw new AccessError(404);
    return readParticipantBooking(runtime, headers, bookingId, scope.data);
  });
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
    scope.data !== "tutor" &&
    detail.state === "demo_completed" &&
    detail.currentHeadId === detail.id
      ? await loadPrivatePage(path, async (runtime, headers) => ({
          saved: Boolean(
            (await readAuthorReview(runtime, headers, bookingId)).review,
          ),
        }))
      : null;
  return (
    <BookingDetailView
      booking={detail}
      scope={scope.data}
      reviewSection={
        review && (
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="text-section-title">Private synthetic review</h2>
            <p className="mt-2 max-w-prose text-small text-muted-foreground">
              This completed local fixture can have one private review. It stays
              private after moderation and does not prove attendance.
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
      }
      meetingSection={
        <BookingMeetingSection
          key={`${bookingId}:${detail.state}:${meeting?.state}:${meeting?.state === "present" ? meeting.revision : 0}`}
          bookingId={bookingId}
          inactive={[
            "demo_cancelled",
            "demo_replaced",
            "demo_completed",
          ].includes(detail.state)}
          initial={meeting ?? { state: "error" }}
        />
      }
    />
  );
}
