import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AdminAssignedBookings } from "@/features/admin/admin-assigned-bookings";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { listStaffBookings } from "@/features/booking-workflows/staff-read";
import {
  staffBookingInput,
  staffBookingsHref,
} from "@/features/booking-workflows/staff-input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned bookings",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = staffBookingInput.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <UnavailablePage
        title="Booking filters unavailable"
        message="Use an exact booking ID and valid status and page filters."
      />
    );
  const filters = parsed.data;
  const data = await loadPrivatePage(
    staffBookingsHref(filters),
    (runtime, headers) =>
      listStaffBookings(bookingWorkflowContext(runtime), headers, filters),
  );
  if (!data)
    return (
      <UnavailablePage
        title="Assigned bookings unavailable"
        message="Current administrator verification and an exact booking assignment are required."
      />
    );
  return (
    <AdminAssignedBookings
      filters={filters}
      items={data.items}
      page={data.page}
      hasMore={data.hasMore}
    />
  );
}
