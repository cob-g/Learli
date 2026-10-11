import Link from "next/link";
import type { ReactNode } from "react";
import { BookingSupportAction } from "@/features/support-bookings/presentation";
import { levelNames } from "@/features/subjects/catalog";
import { LessonTime } from "./lesson-time";
import { BookingReadStatus } from "./read-status";
import type {
  BookingDetail,
  BookingPage,
  BookingReadScope,
} from "./read-model";
import { bookingDetailPath } from "./read-model";
import { BookingHistoryFilters, BookingReadLink } from "./read-controls";

export function BookingUnavailable({
  scope = "student",
}: {
  scope?: BookingReadScope;
}) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        We can&apos;t find that booking on this account
      </h1>
      <Link
        className="mt-6 inline-flex min-h-11 items-center"
        href={`/bookings?scope=${scope}`}
      >
        Go to your bookings
      </Link>
      <Link className="ml-6 inline-flex min-h-11 items-center" href="/contact">
        Contact support
      </Link>
    </div>
  );
}

export function BookingDetailView({
  booking,
  scope,
  meetingSection,
}: {
  booking: BookingDetail;
  scope: BookingReadScope;
  meetingSection?: ReactNode;
}) {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Booking details</h1>
      <p className="mt-4 text-body text-muted-foreground">
        Local simulated booking. No payment or meeting is arranged.
      </p>
      <div className="mt-6 max-w-5xl rounded-surface border border-border bg-surface p-4 sm:p-6">
        <BookingReadStatus booking={booking} />
        <dl className="mt-6 grid min-w-0 gap-6 md:grid-cols-2">
          <div>
            <dt className="text-label text-muted-foreground">Tutor</dt>
            <dd className="mt-1 text-item-title wrap-anywhere">
              {booking.tutor.displayName}
            </dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Learner</dt>
            <dd className="mt-1 text-body wrap-anywhere">
              {booking.learner.displayName} ·{" "}
              {levelNames([booking.learner.level]).join()}
            </dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Subject</dt>
            <dd className="mt-1 text-body">{booking.subject.name}</dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">
              Lesson time in your time zone
            </dt>
            <dd className="mt-2">
              <LessonTime value={booking.time} />
            </dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">
              Simulation expiry
            </dt>
            <dd className="mt-2">
              <LessonTime value={booking.expires} />
            </dd>
          </div>
        </dl>
        {meetingSection}
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-section-title">Saved booking history</h2>
          <p className="mt-2 text-small text-muted-foreground">
            Only saved events appear below. An elapsed deadline can display
            expiry before an expiry event is saved.
          </p>
          {booking.events.length ? (
            <ol className="mt-4 divide-y divide-border">
              {booking.events.map((event) => (
                <li key={event.id} className="py-4">
                  <h3 className="mb-2 text-item-title">
                    {event.event === "demo_reserved"
                      ? "Simulated reservation saved"
                      : "Simulation expiry saved"}
                  </h3>
                  <LessonTime value={event.time} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-body">
              No saved booking events are available.
            </p>
          )}
        </section>
      </div>
      <nav
        aria-label="Booking navigation"
        className="mt-6 flex flex-wrap gap-x-6"
      >
        <Link
          className="inline-flex min-h-11 items-center"
          href={`/bookings?scope=${scope}`}
        >
          Go to your bookings
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/account">
          Change account time zone
        </Link>
        <BookingSupportAction bookingId={booking.id} />
      </nav>
    </div>
  );
}

export function BookingHistoryView({
  result,
  learnerId,
}: {
  result: BookingPage;
  learnerId?: string;
}) {
  const selected = result.learners.find((learner) => learner.id === learnerId);
  const query = (page: number) =>
    `/bookings?${new URLSearchParams({ scope: result.scope, filter: result.filter, page: String(page), pageSize: String(result.pageSize), ...(learnerId ? { learnerId } : {}) })}`;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {selected ? `Bookings for ${selected.displayName}` : "Your bookings"}
      </h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Local simulated bookings for{" "}
        {result.scope === "tutor"
          ? "your assigned learners"
          : result.scope === "guardian"
            ? "your currently authorized learners"
            : "you"}
        . Times use your current account time zone.
      </p>
      <BookingHistoryFilters
        scope={result.scope}
        filter={result.filter}
        pageSize={result.pageSize}
        learners={result.learners}
        learnerId={learnerId}
      />
      {result.items.length ? (
        <ul className="mt-6 max-w-5xl divide-y divide-border rounded-surface border border-border bg-surface px-4 sm:px-6">
          {result.items.map((booking) => (
            <li
              key={booking.id}
              className="flex min-w-0 flex-col gap-4 py-6 md:flex-row"
            >
              <div className="shrink-0 md:w-44">
                <LessonTime value={booking.time} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-item-title wrap-anywhere">
                  {booking.tutor.displayName}
                </h2>
                <p className="mt-2 text-body wrap-anywhere">
                  {booking.subject.name} · {booking.learner.displayName} ·{" "}
                  {levelNames([booking.learner.level]).join()}
                </p>
                <div className="mt-3">
                  <BookingReadStatus booking={booking} />
                </div>
              </div>
              <BookingReadLink
                href={bookingDetailPath(booking.id, result.scope)}
                ariaLabel={`View booking for ${booking.learner.displayName} with ${booking.tutor.displayName}`}
                label="View booking"
                pendingLabel="Loading booking details…"
              />
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">No bookings in this view</h2>
          <p className="mt-2 text-body">
            Only bookings you can currently access appear here. Choose another
            view or browse tutors.
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center"
            href="/tutors"
          >
            Browse all tutors
          </Link>
        </section>
      )}
      <nav
        aria-label="Booking pages"
        className="mt-6 flex flex-wrap items-center gap-6"
      >
        {result.page > 1 && (
          <BookingReadLink
            href={query(result.page - 1)}
            label="Previous bookings"
          />
        )}
        <p className="text-small">Page {result.page}</p>
        {result.hasNext && (
          <BookingReadLink
            href={query(result.page + 1)}
            label="Next bookings"
          />
        )}
      </nav>
      <Link className="mt-6 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
    </div>
  );
}
