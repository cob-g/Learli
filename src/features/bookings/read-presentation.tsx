import "./booking-pages.css";
import { CalendarDays } from "lucide-react";
import { LifecycleHeading } from "./lifecycle-heading";
import { bookingEventLabels } from "./lifecycle-model";
import { DemoCancelControl } from "./lifecycle-controls";
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
import { bookingDetailPath, historicalBookingDetailPath } from "./read-model";
import { BookingHistoryFilters, BookingReadLink } from "./read-controls";

export function bookingWorkspaceLabel(scope: BookingReadScope) {
  return scope === "guardian"
    ? "Parent workspace"
    : scope === "tutor"
      ? "Tutor workspace"
      : "Student workspace";
}

export function BookingUnavailable({
  scope = "student",
}: {
  scope?: BookingReadScope;
}) {
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">{bookingWorkspaceLabel(scope)}</p>
          <h1>We can&apos;t find that booking on this account</h1>
        </div>
      </header>
      <div className="booking-actions">
        <Link
          className="inline-flex min-h-11 items-center"
          href={`/bookings?scope=${scope}`}
        >
          Go to your bookings
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/contact">
          Contact support
        </Link>
      </div>
    </div>
  );
}

export function BookingDetailView({
  booking,
  scope,
  meetingSection,
  reviewSection,
  privateWorkflow = false,
  historical = false,
}: {
  booking: BookingDetail;
  scope: BookingReadScope;
  meetingSection?: ReactNode;
  reviewSection?: ReactNode;
  privateWorkflow?: boolean;
  historical?: boolean;
}) {
  const directConfirmation =
    booking.source === "local_operation" &&
    ["local-parent-booking-v2", "local-independent-booking-v2"].includes(
      booking.policyVersion ?? "",
    );
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">{bookingWorkspaceLabel(scope)}</p>
          <LifecycleHeading
            booking={booking}
            privateWorkflow={privateWorkflow}
          />
          <p>
            {privateWorkflow
              ? "Review your saved lesson details and booking status. Payments are disabled."
              : booking.source === "synthetic_readiness"
                ? "Synthetic readiness booking. Confirmation and outcomes exercise software only; no payment or attendance is established."
                : "Local simulated booking. No payment or meeting is arranged."}
          </p>
          {historical &&
            booking.currentHeadId &&
            booking.currentHeadId !== booking.id && (
              <p className="workspace-page-small text-muted-foreground">
                This is a previous version of the booking.
              </p>
            )}
        </div>
      </header>
      <div className="booking-card">
        <BookingReadStatus
          booking={booking}
          privateWorkflow={privateWorkflow}
        />
        <dl className="booking-facts">
          <div className="booking-when booking-facts-wide">
            <dt>Lesson time in your time zone</dt>
            <dd>
              <span className="booking-when-tile" aria-hidden="true">
                <CalendarDays size={30} />
              </span>
              <LessonTime value={booking.time} variant="prominent" />
            </dd>
          </div>
          <div>
            <dt>Tutor</dt>
            <dd className="booking-fact-strong wrap-anywhere">
              {booking.tutor.displayName}
            </dd>
          </div>
          <div>
            <dt>Learner</dt>
            <dd className="wrap-anywhere">
              {booking.learner.displayName} ·{" "}
              {levelNames([booking.learner.level]).join()}
            </dd>
          </div>
          <div>
            <dt>Subject</dt>
            <dd>{booking.subject.name}</dd>
          </div>
          {!directConfirmation && (
            <div>
              <dt>
                {booking.source !== "local_simulation"
                  ? "Original provisional deadline"
                  : [
                        "demo_cancelled",
                        "demo_replaced",
                        "demo_completed",
                      ].includes(booking.state)
                    ? "Original simulation deadline"
                    : "Simulation expiry"}
              </dt>
              <dd>
                <LessonTime value={booking.expires} />
              </dd>
            </div>
          )}
        </dl>
      </div>
      {meetingSection}
      {reviewSection}
      <DemoCancelControl booking={booking} scope={scope} />
      {booking.currentHeadId && booking.currentHeadId !== booking.id && (
        <a
          className="inline-flex min-h-11 items-center text-action"
          href={bookingDetailPath(booking.currentHeadId, scope)}
        >
          {privateWorkflow ? "View current booking" : "View current simulation"}
        </a>
      )}
      <section className="booking-panel">
        <h2>Saved booking history</h2>
        <p className="text-small text-muted-foreground">
          {directConfirmation
            ? "Only saved booking events appear below."
            : "Only saved events appear below. An elapsed deadline can display expiry before an expiry event is saved."}
        </p>
        {booking.events.length ? (
          <ol className="booking-events">
            {booking.events.map((event) => (
              <li key={event.id}>
                <h3 className="text-item-title">
                  {privateWorkflow
                    ? bookingEventLabels[event.event].replace(/^Synthetic /, "")
                    : bookingEventLabels[event.event]}
                </h3>
                <LessonTime value={event.time} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body">No saved booking events are available.</p>
        )}
      </section>
      <nav aria-label="Booking navigation" className="booking-nav">
        <Link
          className="inline-flex min-h-11 items-center"
          href={`/bookings?scope=${scope}`}
        >
          Go to your bookings
        </Link>
        <Link className="inline-flex min-h-11 items-center" href="/account">
          Change account time zone
        </Link>
        <BookingSupportAction
          bookingId={booking.id}
          privateWorkflow={privateWorkflow}
        />
      </nav>
    </div>
  );
}

export function BookingHistoryView({
  result,
  learnerId,
  privateWorkflow = false,
}: {
  result: BookingPage;
  learnerId?: string;
  privateWorkflow?: boolean;
}) {
  const selected = result.learners.find((learner) => learner.id === learnerId);
  const query = (page: number) =>
    `/bookings?${new URLSearchParams({ scope: result.scope, filter: result.filter, page: String(page), pageSize: String(result.pageSize), ...(learnerId ? { learnerId } : {}) })}`;
  const groups = new Map<string, typeof result.items>();
  for (const booking of result.items) {
    const key = `${booking.time.date}\u0000${booking.time.zone}`;
    groups.set(key, [...(groups.get(key) ?? []), booking]);
  }
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {bookingWorkspaceLabel(result.scope)}
          </p>
          <h1>
            {selected
              ? `Bookings for ${selected.displayName}`
              : "Your bookings"}
          </h1>
          <p>
            {privateWorkflow
              ? "Bookings for "
              : "Local simulated bookings for "}
            {result.scope === "tutor"
              ? "your assigned learners"
              : result.scope === "guardian"
                ? "your currently authorized learners"
                : "you"}
            . Times use your current account time zone.
          </p>
        </div>
      </header>
      <BookingHistoryFilters
        scope={result.scope}
        filter={result.filter}
        pageSize={result.pageSize}
        learners={result.learners}
        learnerId={learnerId}
        privateWorkflow={privateWorkflow}
      />
      {result.items.length ? (
        <div className="booking-panel">
          <div className="booking-days">
            {[...groups.entries()].map(([key, group]) => (
              <div key={key}>
                <p className="booking-day">{group[0].time.date}</p>
                <p className="booking-day-zone">
                  Times shown in {group[0].time.zone}
                </p>
                <ul className="booking-rows">
                  {group.map((booking) => (
                    <li key={booking.id}>
                      <div className="booking-row-time">
                        <LessonTime value={booking.time} variant="time-only" />
                      </div>
                      <div className="booking-row-main min-w-0">
                        <h2 className="wrap-anywhere">
                          {booking.tutor.displayName}
                        </h2>
                        <p className="wrap-anywhere">
                          {booking.subject.name} · {booking.learner.displayName}{" "}
                          · {levelNames([booking.learner.level]).join()}
                        </p>
                        <div className="mt-3">
                          <BookingReadStatus
                            booking={booking}
                            privateWorkflow={privateWorkflow}
                          />
                        </div>
                      </div>
                      <BookingReadLink
                        variant="link"
                        href={
                          booking.currentHeadId &&
                          booking.currentHeadId !== booking.id
                            ? historicalBookingDetailPath(
                                booking.id,
                                result.scope,
                              )
                            : bookingDetailPath(booking.id, result.scope)
                        }
                        ariaLabel={`View booking for ${booking.learner.displayName} with ${booking.tutor.displayName}`}
                        label="View booking"
                        pendingLabel="Loading booking details…"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <section className="workspace-blank">
          <h2>No bookings in this view</h2>
          <p>
            Only bookings you can currently access appear here. Choose another
            view or browse tutors.
          </p>
          <Link
            className="mt-2 inline-flex min-h-11 items-center"
            href="/tutors"
          >
            Browse all tutors
          </Link>
        </section>
      )}
      <nav aria-label="Booking pages" className="booking-pages">
        {result.page > 1 && (
          <BookingReadLink
            href={query(result.page - 1)}
            label="Previous bookings"
          />
        )}
        <p>Page {result.page}</p>
        {result.hasNext && (
          <BookingReadLink
            href={query(result.page + 1)}
            label="Next bookings"
          />
        )}
      </nav>
      <Link className="inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
    </div>
  );
}
