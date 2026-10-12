import {
  demoStateLabels,
  demoLiveState,
} from "@/features/bookings/lifecycle-model";
import { LessonTime } from "@/features/bookings/lesson-time";
import { Hourglass, TimerOff } from "lucide-react";
import type { SupportBookingContext } from "./model";

/** Root inserts this only within an already-authorized booking detail. */
export function BookingSupportAction({ bookingId }: { bookingId: string }) {
  return (
    <a
      href={`/contact?bookingId=${encodeURIComponent(bookingId)}`}
      className="action action-outline"
    >
      Report a simulated booking issue
    </a>
  );
}

export function SupportBookingSection({
  booking,
}: {
  booking: SupportBookingContext;
}) {
  return (
    <section
      className="mt-8 max-w-prose"
      aria-labelledby="support-booking-heading"
    >
      <h2 className="text-section-title" id="support-booking-heading">
        Related simulated booking
      </h2>
      {booking.available ? (
        <>
          <p className="mt-4 text-body">
            Local simulation only. This is not a confirmed lesson.
          </p>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-label">Tutor</dt>
              <dd className="mt-1 text-body wrap-anywhere">
                {booking.tutorName}
              </dd>
            </div>
            <div>
              <dt className="text-label">Subject</dt>
              <dd className="mt-1 text-body wrap-anywhere">
                {booking.subjectName}
              </dd>
            </div>
            <div>
              <dt className="text-label">Recorded time</dt>
              <dd className="mt-1">
                <LessonTime value={booking.time} />
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <span className="inline-flex items-center gap-1 rounded-tag border border-control bg-subtle px-2 py-1 text-label">
              {!demoLiveState(booking.state) ? (
                <TimerOff className="size-4" aria-hidden="true" />
              ) : (
                <Hourglass className="size-4" aria-hidden="true" />
              )}
              {demoStateLabels[booking.state]}
            </span>
          </div>
          <h3 className="mt-8 text-item-title">Saved simulation history</h3>
          {booking.events.length ? (
            <ol className="mt-4 divide-y divide-border">
              {booking.events.map((event, index) => (
                <li className="py-4" key={index}>
                  <p className="text-body">
                    {event.event === "demo_reserved"
                      ? "Simulation created"
                      : "Simulation expiry saved"}
                  </p>
                  <LessonTime value={event.time} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-body">No saved simulation events.</p>
          )}
        </>
      ) : (
        <p className="mt-4 text-body">
          Booking context is unavailable. This fictional case remains saved.
        </p>
      )}
    </section>
  );
}
