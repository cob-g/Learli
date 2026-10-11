import type { Metadata } from "next";
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
  return (
    <BookingDetailView
      booking={detail}
      scope={scope.data}
      meetingSection={
        <BookingMeetingSection
          bookingId={bookingId}
          initial={meeting ?? { state: "error" }}
        />
      }
    />
  );
}
