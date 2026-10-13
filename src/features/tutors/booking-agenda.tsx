import {
  demoStateLabels,
  demoLiveState,
  type BookingState,
} from "@/features/bookings/lifecycle-model";
import Link from "next/link";
import { Hourglass, TimerOff } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  LessonTime,
  type LessonTimeValue,
} from "@/features/bookings/lesson-time";

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

function SimulationStatus({ state }: { state: TutorAgendaBooking["state"] }) {
  const expired =
    !demoLiveState(state) && state !== "provisional" && state !== "confirmed";
  const Icon = expired ? TimerOff : Hourglass;
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-tag border border-control bg-subtle px-2 text-label">
      <Icon size={16} aria-hidden="true" className="shrink-0 text-primary" />
      {demoStateLabels[state]}
    </span>
  );
}

function BookingIdentity({ booking }: { booking: TutorAgendaBooking }) {
  return (
    <div className="min-w-0">
      <p className="text-item-title wrap-anywhere">{booking.learnerLabel}</p>
      <p className="mt-2 text-body wrap-anywhere">{booking.subject}</p>
      <p className="mt-1 text-small">{booking.learnerLevel}</p>
    </div>
  );
}

function ViewBooking({ booking }: { booking: TutorAgendaBooking }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center text-action"
      href={booking.detailHref}
      aria-label={`View booking for ${booking.learnerLabel}`}
    >
      View booking
    </Link>
  );
}

function Expiry({ booking }: { booking: TutorAgendaBooking }) {
  return (
    <div className="mt-2">
      <p className="text-small text-muted-foreground">
        {booking.state === "confirmed"
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
}: {
  active: readonly TutorAgendaBooking[];
  history: readonly TutorAgendaBooking[];
  evaluatedAt?: string;
  hasMoreActive: boolean;
  hasMoreHistory: boolean;
}) {
  const next = nextTutorSimulation(active, evaluatedAt);
  const agenda = active.filter((booking) => booking.id !== next?.id);
  return (
    <div className="max-w-5xl space-y-12">
      {next ? (
        <section
          aria-labelledby="next-simulation-title"
          className="rounded-surface border border-border bg-surface p-4 md:p-6"
        >
          <h2 id="next-simulation-title" className="text-section-title">
            Next future simulation
          </h2>
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            <LessonTime value={next.time} variant="prominent" />
            <BookingIdentity booking={next} />
          </div>
          <div className="mt-4">
            <SimulationStatus state={next.state} />
          </div>
          <p className="mt-2 max-w-prose text-body">
            This is a local simulation, not a confirmed lesson.
          </p>
          <Expiry booking={next} />
          <div className="mt-4">
            <ViewBooking booking={next} />
          </div>
        </section>
      ) : (
        <EmptyState
          title="No future simulations"
          href="/tutor/availability"
          action="Set availability"
        >
          <p>
            Your assigned simulated bookings will appear here. A simulation does
            not confirm a lesson.
          </p>
        </EmptyState>
      )}
      <BookingRows title="Simulation agenda" bookings={agenda} />
      {hasMoreActive && (
        <Link
          className="inline-flex min-h-11 items-center text-action"
          href="/bookings?scope=tutor&filter=active"
        >
          View all active simulations
        </Link>
      )}
      <BookingRows title="Simulation history" bookings={history} />
      {hasMoreHistory && (
        <Link
          className="inline-flex min-h-11 items-center text-action"
          href="/bookings?scope=tutor&filter=history"
        >
          View all simulation history
        </Link>
      )}
    </div>
  );
}

function BookingRows({
  title,
  bookings,
}: {
  title: string;
  bookings: readonly TutorAgendaBooking[];
}) {
  const groups = new Map<string, TutorAgendaBooking[]>();
  for (const booking of bookings) {
    const key = `${booking.time.date}\u0000${booking.time.zone}`;
    const group = groups.get(key) ?? [];
    group.push(booking);
    groups.set(key, group);
  }
  return (
    <section aria-label={title}>
      <h2 className="text-section-title">{title}</h2>
      {bookings.length ? (
        <div className="mt-4 space-y-8">
          {[...groups.entries()].map(([key, group]) => (
            <div key={key}>
              <h3 className="text-item-title">{group[0].time.date}</h3>
              <p className="mt-2 text-small text-muted-foreground">
                Times shown in {group[0].time.zone}
              </p>
              <ul className="mt-4 divide-y divide-border">
                {group.map((booking) => (
                  <li
                    key={booking.id}
                    className="grid min-w-0 gap-4 py-4 md:flex"
                  >
                    <div className="min-w-0 md:w-44 md:shrink-0">
                      <LessonTime value={booking.time} variant="time-only" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <BookingIdentity booking={booking} />
                    </div>
                    <div className="min-w-0 flex-1 md:text-right">
                      <SimulationStatus state={booking.state} />
                      <Expiry booking={booking} />
                      <ViewBooking booking={booking} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 max-w-prose text-body text-muted-foreground">
          {title === "Simulation history"
            ? "No simulation history on this account."
            : "No other active simulations assigned to you."}
        </p>
      )}
    </section>
  );
}
