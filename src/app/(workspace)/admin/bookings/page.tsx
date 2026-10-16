import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AdminShell } from "@/features/admin/admin-shell";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { listStaffBookings } from "@/features/booking-workflows/staff-read";
import {
  staffBookingHref,
  staffBookingInput,
  staffBookingStates,
  staffBookingsHref,
} from "@/features/booking-workflows/staff-input";
import { bookingStatusLabel } from "@/features/private-workflow/notice";
import { levelNames } from "@/features/subjects/catalog";
import { LessonTime } from "@/features/bookings/lesson-time";
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
        message="Current administrator verification, private staging and an exact booking assignment are required."
      />
    );
  return (
    <AdminShell current="bookings">
      <h1 className="text-page-title">Assigned bookings</h1>
      <p className="mt-4 max-w-prose text-body">
        Only booking records with a current exact assignment appear here. This
        view contains essential coordination details.
      </p>
      <form
        role="search"
        aria-label="Find assigned bookings"
        method="get"
        className="mt-6 flex flex-wrap items-end gap-4"
      >
        <div className="w-full space-y-2 sm:w-96">
          <label htmlFor="booking-id" className="block text-label">
            Booking ID
          </label>
          <input
            id="booking-id"
            name="q"
            className="field"
            defaultValue={filters.q}
            maxLength={36}
            placeholder="Exact booking ID"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="booking-state" className="block text-label">
            Status
          </label>
          <select
            id="booking-state"
            name="state"
            className="field"
            defaultValue={filters.state}
          >
            {staffBookingStates.map((state) => (
              <option key={state} value={state}>
                {state === "all"
                  ? "All statuses"
                  : bookingStatusLabel(state, true)}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="pageSize" value={filters.pageSize} />
        <button type="submit" className="action action-outline">
          Apply filters
        </button>
      </form>
      {data.items.length ? (
        <ul className="mt-8 divide-y divide-border">
          {data.items.map((item) => (
            <li key={item.id} data-booking-id={item.id} className="py-6">
              <h2 className="text-item-title wrap-anywhere">
                {item.subject} · {bookingStatusLabel(item.state, true)}
              </h2>
              <p className="mt-2 text-body">
                Tutor: {item.tutorName}. Learner: {item.learnerName} ·{" "}
                {levelNames([item.learnerLevel]).join()}.
              </p>
              <p className="mt-2 text-small">
                Requested by: {item.requesterName} (
                {item.relationship === "self"
                  ? "independent learner"
                  : "authorized guardian"}
                ).
              </p>
              <div className="mt-2">
                <LessonTime value={item.time} />
              </div>
              <Link
                href={staffBookingHref(item.id, filters)}
                className="mt-3 inline-flex min-h-11 items-center"
              >
                View booking details
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-body" role="status">
          No assigned bookings match these filters.
        </p>
      )}
      <nav
        aria-label="Assigned booking pages"
        className="mt-8 flex flex-wrap gap-4"
      >
        {data.page > 1 && (
          <Link
            href={staffBookingsHref(filters, data.page - 1)}
            className="action action-outline"
          >
            Previous bookings
          </Link>
        )}
        {data.hasMore && (
          <Link
            href={staffBookingsHref(filters, data.page + 1)}
            className="action action-outline"
          >
            Next bookings
          </Link>
        )}
      </nav>
    </AdminShell>
  );
}
