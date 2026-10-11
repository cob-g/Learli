import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AccessError } from "@/lib/permissions/access";
import { readParticipantBooking } from "@/features/bookings/read-service";
import {
  BookingDetailView,
  BookingUnavailable,
} from "@/features/bookings/read-presentation";
import { bookingReadScope } from "@/features/bookings/read-input";
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
  return <BookingDetailView booking={detail} scope={scope.data} />;
}
