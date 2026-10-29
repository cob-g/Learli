import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarX2, Search, X } from "lucide-react";
import type { StaffBooking } from "@/features/booking-workflows/staff-read";
import {
  staffBookingHref,
  staffBookingStates,
  staffBookingsHref,
  type StaffBookingFilters,
} from "@/features/booking-workflows/staff-input";
import { bookingStatusLabel } from "@/features/private-workflow/notice";
import { levelNames } from "@/features/subjects/catalog";
import { LessonTime } from "@/features/bookings/lesson-time";
import "./admin-assigned-bookings.css";

/** Presentation only; the page loads assigned bookings through its guard. */
export function AdminAssignedBookings({
  filters,
  items,
  page,
  hasMore,
}: {
  filters: StaffBookingFilters;
  items: Pick<
    StaffBooking,
    | "id"
    | "state"
    | "subject"
    | "tutorName"
    | "learnerName"
    | "learnerLevel"
    | "requesterName"
    | "relationship"
    | "time"
  >[];
  page: number;
  hasMore: boolean;
}) {
  const cleared = { ...filters, q: undefined, state: "all" as const, page: 1 };
  const chips = [
    filters.q && {
      label: `Booking ID: ${filters.q}`,
      name: "Booking ID",
      href: staffBookingsHref({ ...filters, q: undefined, page: 1 }),
    },
    filters.state !== "all" && {
      label: `Status: ${bookingStatusLabel(filters.state, true)}`,
      name: "Status",
      href: staffBookingsHref({ ...filters, state: "all", page: 1 }),
    },
  ].filter((chip) => !!chip);
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Operations</p>
          <h1>Assigned bookings</h1>
          <p>
            Only booking records with a current exact assignment appear here.
            This view contains essential coordination details.
          </p>
        </div>
      </header>
      <form
        role="search"
        aria-label="Find assigned bookings"
        method="get"
        className="booking-filters"
      >
        <div className="booking-filter-field">
          <label htmlFor="booking-id" className="text-label">
            Booking ID
          </label>
          <span className="booking-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="booking-id"
              name="q"
              className="field"
              defaultValue={filters.q}
              maxLength={36}
              autoComplete="off"
              spellCheck={false}
              placeholder="Exact booking ID"
            />
          </span>
        </div>
        <div className="booking-filter-field">
          <label htmlFor="booking-state" className="text-label">
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
        <div className="booking-filter-actions">
          <button type="submit" className="action action-primary">
            Apply filters
          </button>
          <Link className="booking-clear" href={staffBookingsHref(cleared)}>
            Clear
          </Link>
        </div>
      </form>
      {chips.length > 0 && (
        <div className="booking-chips">
          <span>Filtered by</span>
          {chips.map((chip) => (
            <span key={chip.name} className="booking-chip">
              <span className="wrap-anywhere">{chip.label}</span>
              <Link href={chip.href} aria-label={`Remove ${chip.name} filter`}>
                <X size={12} aria-hidden="true" />
              </Link>
            </span>
          ))}
        </div>
      )}
      {items.length ? (
        <ul className="booking-list">
          {items.map((item) => (
            <li
              key={item.id}
              data-booking-id={item.id}
              className="booking-card"
            >
              <span className="booking-card-icon" aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <div className="min-w-0">
                <h2>
                  <span className="wrap-anywhere">{item.subject}</span>
                  <span className="sr-only"> · </span>
                  <span
                    className="workspace-pill"
                    data-dot
                    data-tone={
                      item.state === "provisional"
                        ? "waiting"
                        : item.state === "confirmed" ||
                            item.state === "completed"
                          ? "success"
                          : undefined
                    }
                  >
                    {bookingStatusLabel(item.state, true)}
                  </span>
                </h2>
                <dl>
                  <div>
                    <dt>Tutor</dt>
                    <dd>{item.tutorName}</dd>
                  </div>
                  <div>
                    <dt>Learner</dt>
                    <dd>
                      {item.learnerName} ·{" "}
                      {levelNames([item.learnerLevel]).join()}
                    </dd>
                  </div>
                  <div>
                    <dt>Requested by</dt>
                    <dd>
                      {item.requesterName} (
                      {item.relationship === "self"
                        ? "independent learner"
                        : "authorized guardian"}
                      )
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="booking-card-side">
                <LessonTime value={item.time} />
                <Link
                  href={staffBookingHref(item.id, filters)}
                  className="action workspace-action booking-open"
                >
                  View booking details
                  <span className="workspace-action-icon" aria-hidden="true">
                    <ArrowRight size={13} />
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section
          className="workspace-blank"
          aria-labelledby="booking-blank-title"
        >
          <span className="booking-blank-icon" aria-hidden="true">
            <CalendarX2 size={40} />
          </span>
          <h2 id="booking-blank-title">No bookings to show</h2>
          <p role="status">No assigned bookings match these filters.</p>
        </section>
      )}
      {(page > 1 || hasMore) && (
        <nav aria-label="Assigned booking pages" className="booking-pages">
          {page > 1 && (
            <Link
              href={staffBookingsHref(filters, page - 1)}
              className="action action-outline"
            >
              Previous bookings
            </Link>
          )}
          {hasMore && (
            <Link
              href={staffBookingsHref(filters, page + 1)}
              className="action action-outline"
            >
              Next bookings
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
