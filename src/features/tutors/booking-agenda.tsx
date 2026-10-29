import {
  demoLiveState,
  type BookingState,
} from "@/features/bookings/lifecycle-model";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  Check,
  History,
  Hourglass,
  TimerOff,
} from "lucide-react";
import { bookingStatusLabel } from "@/features/private-workflow/notice";
import {
  LessonTime,
  type LessonTimeValue,
} from "@/features/bookings/lesson-time";
import "./tutor-bookings.css";

/** Presentation only. Participant authorization and effective TTL state belong to the booking provider. */
export type TutorAgendaBooking = {
  id: string;
  detailHref: string;
  state: BookingState;
  learnerLabel: string;
  learnerLevel: string;
  subject: string;
  time: LessonTimeValue;
  expiry: LessonTimeValue;
};

export function nextTutorSimulation(
  bookings: readonly TutorAgendaBooking[],
  evaluatedAt?: string,
) {
  if (!evaluatedAt) return undefined;
  const now = new Date(evaluatedAt).getTime();
  return bookings
    .filter(
      (booking) =>
        (demoLiveState(booking.state) ||
          booking.state === "confirmed" ||
          booking.state === "provisional") &&
        new Date(booking.time.startAtUtc).getTime() > now,
    )
    .toSorted(
      (a, b) =>
        a.time.startAtUtc.localeCompare(b.time.startAtUtc) ||
        a.id.localeCompare(b.id),
    )[0];
}

function SimulationStatus({
  state,
  privateWorkflow = false,
}: {
  state: TutorAgendaBooking["state"];
  privateWorkflow?: boolean;
}) {
  const expired =
    !demoLiveState(state) && state !== "provisional" && state !== "confirmed";
  const success =
    privateWorkflow && (state === "confirmed" || state === "completed");
  const Icon = success ? Check : expired ? TimerOff : Hourglass;
  return (
    <span
      className="workspace-pill"
      data-tone={success ? "success" : expired ? undefined : "waiting"}
    >
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 wrap-anywhere">
        {bookingStatusLabel(state, privateWorkflow)}
      </span>
    </span>
  );
}

function BookingIdentity({ booking }: { booking: TutorAgendaBooking }) {
  return (
    <div className="min-w-0">
      <p className="text-item-title wrap-anywhere text-primary">
        {booking.learnerLabel}
      </p>
      <p className="mt-2 text-body wrap-anywhere">{booking.subject}</p>
      <p className="mt-1 text-small">{booking.learnerLevel}</p>
    </div>
  );
}

function ViewBooking({ booking }: { booking: TutorAgendaBooking }) {
  return (
    <Link
      className="tutor-view-booking"
      href={booking.detailHref}
      aria-label={`View booking for ${booking.learnerLabel}`}
    >
      View booking
    </Link>
  );
}

function Expiry({
  booking,
  privateWorkflow = false,
}: {
  booking: TutorAgendaBooking;
  privateWorkflow?: boolean;
}) {
  if (
    privateWorkflow &&
    booking.state !== "provisional" &&
    booking.state !== "expired" &&
    !booking.state.startsWith("demo_")
  )
    return null;
  return (
    <div className="mt-2">
      <p className="text-small text-muted-foreground">
        {privateWorkflow && booking.state === "expired"
          ? "Provisional hold expired at"
          : booking.state === "confirmed"
            ? "Original provisional deadline (confirmation does not expire)"
            : booking.state === "provisional"
              ? "Provisional hold expires at"
              : booking.state === "demo_expired"
                ? "Simulation expired at"
                : demoLiveState(booking.state)
                  ? "Simulation expires at"
                  : "Original simulation deadline"}
      </p>
      <LessonTime value={booking.expiry} />
    </div>
  );
}

export function TutorBookingAgenda({
  active,
  history,
  evaluatedAt,
  hasMoreActive,
  hasMoreHistory,
  privateWorkflow = false,
  emptyAction = { href: "/tutor/availability", label: "Set availability" },
}: {
  active: readonly TutorAgendaBooking[];
  history: readonly TutorAgendaBooking[];
  evaluatedAt?: string;
  hasMoreActive: boolean;
  hasMoreHistory: boolean;
  privateWorkflow?: boolean;
  /** null when the page already shows the setup action elsewhere. */
  emptyAction?: { href: string; label: string } | null;
}) {
  const next = nextTutorSimulation(active, evaluatedAt);
  const agenda = active.filter((booking) => booking.id !== next?.id);
  return (
    <div className="tutor-sessions">
      {next ? (
        <section aria-labelledby="next-simulation-title" className="tutor-next">
          <span className="tutor-next-tile" aria-hidden="true">
            <CalendarDays size={34} />
          </span>
          <div className="min-w-0">
            <h2 id="next-simulation-title" className="tutor-next-label">
              {privateWorkflow ? "Next session" : "Next future simulation"}
            </h2>
            <div className="mt-4 grid min-w-0 gap-6 md:grid-cols-2">
              <LessonTime value={next.time} variant="prominent" />
              <BookingIdentity booking={next} />
            </div>
            <div className="mt-4">
              <SimulationStatus
                state={next.state}
                privateWorkflow={privateWorkflow}
              />
            </div>
            <p className="mt-6 max-w-prose border-t border-border pt-6 text-small text-muted-foreground">
              {privateWorkflow
                ? next.state === "confirmed"
                  ? "This booking is confirmed. Open its details to manage the private meeting link and session status."
                  : next.state === "provisional"
                    ? "This provisional hold awaits an assigned review before confirmation."
                    : "This is a local simulation, not a confirmed lesson."
                : "This is a local simulation, not a confirmed lesson."}
            </p>
            <Expiry booking={next} privateWorkflow={privateWorkflow} />
            <div className="mt-4">
              <ViewBooking booking={next} />
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="next-simulation-title"
          className="tutor-next"
          data-empty
        >
          <span className="tutor-next-tile" aria-hidden="true">
            <CalendarDays size={34} />
          </span>
          <div className="min-w-0">
            <p className="tutor-next-label" aria-hidden="true">
              {privateWorkflow ? "Next session" : "Next future simulation"}
            </p>
            <h2 id="next-simulation-title">
              {privateWorkflow
                ? "No upcoming sessions"
                : "No future simulations"}
            </h2>
            <p>
              {privateWorkflow
                ? "Bookings assigned to you will appear here with their current status."
                : "Your assigned simulated bookings will appear here. A simulation does not confirm a lesson."}
            </p>
            {emptyAction && (
              <Link
                className="action action-outline mt-4"
                href={emptyAction.href}
              >
                {emptyAction.label}
              </Link>
            )}
          </div>
        </section>
      )}
      <BookingRows
        title={privateWorkflow ? "Upcoming sessions" : "Simulation agenda"}
        bookings={agenda}
        privateWorkflow={privateWorkflow}
        more={
          hasMoreActive
            ? {
                href: "/bookings?scope=tutor&filter=active",
                label: privateWorkflow
                  ? "View all upcoming sessions"
                  : "View all active simulations",
              }
            : undefined
        }
      />
      <BookingRows
        title={privateWorkflow ? "History" : "Simulation history"}
        bookings={history}
        privateWorkflow={privateWorkflow}
        history
        more={
          hasMoreHistory
            ? {
                href: "/bookings?scope=tutor&filter=history",
                label: privateWorkflow
                  ? "View all history"
                  : "View all simulation history",
              }
            : undefined
        }
      />
    </div>
  );
}

function BookingRows({
  title,
  bookings,
  privateWorkflow = false,
  history = false,
  more,
}: {
  title: string;
  bookings: readonly TutorAgendaBooking[];
  privateWorkflow?: boolean;
  history?: boolean;
  more?: { href: string; label: string };
}) {
  const Icon = history ? History : CalendarClock;
  const groups = new Map<string, TutorAgendaBooking[]>();
  for (const booking of bookings) {
    const key = `${booking.time.date}\u0000${booking.time.zone}`;
    const group = groups.get(key) ?? [];
    group.push(booking);
    groups.set(key, group);
  }
  return (
    <section aria-label={title} className="tutor-panel">
      <div className="tutor-panel-heading">
        <span className="tutor-panel-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <h2>{title}</h2>
      </div>
      {bookings.length ? (
        <div className="tutor-days">
          {[...groups.entries()].map(([key, group]) => (
            <div key={key}>
              <h3 className="tutor-day">{group[0].time.date}</h3>
              <p className="tutor-day-zone">
                Times shown in {group[0].time.zone}
              </p>
              <ul className="tutor-rows">
                {group.map((booking) => (
                  <li key={booking.id}>
                    <div className="tutor-row-time">
                      <LessonTime value={booking.time} variant="time-only" />
                    </div>
                    <div className="min-w-0">
                      <BookingIdentity booking={booking} />
                    </div>
                    <div className="tutor-row-status">
                      <SimulationStatus
                        state={booking.state}
                        privateWorkflow={privateWorkflow}
                      />
                      <Expiry
                        booking={booking}
                        privateWorkflow={privateWorkflow}
                      />
                      <ViewBooking booking={booking} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="tutor-void">
          {privateWorkflow
            ? history
              ? "No booking history on this account."
              : "No other upcoming sessions assigned to you."
            : title === "Simulation history"
              ? "No simulation history on this account."
              : "No other active simulations assigned to you."}
        </p>
      )}
      {more && (
        <Link className="tutor-more" href={more.href}>
          {more.label}
        </Link>
      )}
    </section>
  );
}
