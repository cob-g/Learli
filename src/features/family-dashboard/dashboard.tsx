import {
  demoStateLabels,
  demoLiveState,
} from "@/features/bookings/lifecycle-model";
import Link from "next/link";
import { Check, TimerOff, TriangleAlert } from "lucide-react";
import {
  LessonTime,
  type LessonTimeValue,
} from "@/features/bookings/lesson-time";
import { levelNames } from "@/features/subjects/catalog";
import { bookingDetailPath } from "@/features/bookings/read-model";
import type { LearnerLevel } from "@/lib/db/schema/app";
import { DashboardHelp } from "./states";
import { ExpiryRefresh } from "./expiry-refresh";
import { DashboardFilterForm, DashboardLink } from "./pending";
import {
  dashboardHref,
  groupByDate,
  type DashboardLearner,
  type DashboardQuery,
  type FamilyWorkspace,
  type ReservationView,
} from "./model";

export type DashboardData = {
  workspace: FamilyWorkspace;
  learners: DashboardLearner[];
  selectedLearner?: DashboardLearner;
  query: DashboardQuery;
  active: ReservationView[];
  history: ReservationView[];
  activeHasNext: boolean;
  historyHasNext: boolean;
  checkedAt: LessonTimeValue;
};

export function StatusBadge({ state }: { state: ReservationView["state"] }) {
  const expired =
    !demoLiveState(state) && state !== "provisional" && state !== "confirmed";
  const Icon = expired ? TimerOff : TriangleAlert;
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1 rounded-tag border px-2 text-label ${expired ? "border-control bg-subtle text-muted-foreground" : "border-warning bg-warning-soft text-warning"}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {demoStateLabels[state]}
    </span>
  );
}

function LearnerSelector({
  learners,
  selected,
}: {
  learners: DashboardLearner[];
  selected?: string;
}) {
  const options = [
    { id: "", displayName: "All learners", level: "" },
    ...learners,
  ];
  return (
    <DashboardFilterForm key={selected ?? "all"}>
      <fieldset>
        <legend className="text-label">Show bookings for</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((learner) => (
            <label
              key={learner.id}
              className="group flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-control border border-control bg-surface px-4 py-2 text-body has-checked:border-primary has-checked:bg-primary has-checked:text-on-inverse"
            >
              <input
                type="radio"
                name="learner"
                value={learner.id}
                defaultChecked={(selected ?? "") === learner.id}
              />
              <span className="min-w-0 wrap-anywhere">
                {learner.displayName}
                {learner.level
                  ? ` · ${levelNames([learner.level as LearnerLevel]).join()}`
                  : ""}
              </span>
              <Check
                className="hidden size-4 shrink-0 group-has-checked:block"
                aria-hidden="true"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <button className="action action-outline mt-4" type="submit">
        Show bookings
      </button>
    </DashboardFilterForm>
  );
}

function ViewBooking({
  row,
  workspace,
}: {
  row: ReservationView;
  workspace: FamilyWorkspace;
}) {
  return (
    <Link
      className="inline-flex min-h-11 items-center text-action"
      href={bookingDetailPath(
        row.id,
        workspace === "parent" ? "guardian" : "student",
      )}
      aria-label={`View booking for ${row.learner.displayName} with ${row.tutorName}`}
    >
      View booking
    </Link>
  );
}

function Expiry({ row }: { row: ReservationView }) {
  return (
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-2 text-small text-primary underline">
        {row.state === "confirmed"
          ? "Original provisional deadline (confirmation does not expire)"
          : row.state === "provisional"
            ? "Provisional hold expires at"
            : row.state === "demo_expired"
              ? "Simulation expired at"
              : demoLiveState(row.state)
                ? "Simulation expires at"
                : "Original simulation deadline"}
      </summary>
      <LessonTime value={row.expiry} />
    </details>
  );
}

function Agenda({
  rows,
  workspace,
}: {
  rows: ReservationView[];
  workspace: FamilyWorkspace;
}) {
  return (
    <div className="mt-4 space-y-8">
      {groupByDate(rows).map((group) => (
        <section key={group.key}>
          <h3 className="text-item-title">{group.date}</h3>
          <p className="mt-2 text-small text-muted-foreground">
            Times shown in {group.zone}.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {group.reservations.map((row) => (
              <li
                key={row.id}
                className="flex min-h-16 min-w-0 flex-col gap-4 py-4 md:flex-row"
              >
                <div className="min-w-0 md:w-44 md:shrink-0">
                  <LessonTime value={row.when} variant="time-only" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-item-title wrap-anywhere">
                    {row.subjectName} with {row.tutorName}
                  </h4>
                  {workspace === "parent" && (
                    <p className="mt-2 text-body wrap-anywhere">
                      For {row.learner.displayName}
                    </p>
                  )}
                  <div className="mt-2">
                    <StatusBadge state={row.state} />
                  </div>
                  <Expiry row={row} />
                </div>
                <div className="md:shrink-0">
                  <ViewBooking row={row} workspace={workspace} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Pagination({
  data,
  kind,
}: {
  data: DashboardData;
  kind: "active" | "history";
}) {
  const key = "historyPage";
  const page = data.query[key] ?? 1;
  const more = kind === "active" ? data.activeHasNext : data.historyHasNext;
  if (page === 1 && !more) return null;
  return (
    <nav
      className="mt-4 flex flex-wrap items-center gap-4"
      aria-label={
        kind === "active"
          ? "Active reservations pages"
          : "Reservation history pages"
      }
    >
      {page > 1 && (
        <Link
          className="action action-outline"
          href={dashboardHref(
            data.workspace,
            { ...data.query, [key]: page - 1 },
            `#${kind}`,
          )}
        >
          Previous page
        </Link>
      )}
      <p className="text-small">Page {page}</p>
      {more && (
        <Link
          className="action action-outline"
          href={dashboardHref(
            data.workspace,
            { ...data.query, [key]: page + 1 },
            `#${kind}`,
          )}
        >
          Next page
        </Link>
      )}
    </nav>
  );
}

export function FamilyDashboard({ data }: { data: DashboardData }) {
  const { workspace, learners, selectedLearner, active, history } = data;
  const next = active.find((row) => row.startAtUtc > data.checkedAt.startAtUtc);
  const agenda = active.filter((row) => row.id !== next?.id);
  const title =
    workspace === "student"
      ? "Your bookings"
      : selectedLearner
        ? `Bookings for ${selectedLearner.displayName}`
        : "Bookings";
  const timedActive = active.filter((row) => row.state !== "confirmed");
  const earliestExpiry = timedActive.length
    ? timedActive.reduce(
        (earliest, row) =>
          row.expiresAt < earliest ? row.expiresAt : earliest,
        timedActive[0].expiresAt,
      )
    : null;
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <nav
          aria-label="Workspace navigation"
          className="mb-8 flex flex-wrap gap-x-6 gap-y-2"
        >
          <Link href={`/${workspace}`} className="nav-link" aria-current="page">
            Bookings
          </Link>
          {workspace === "parent" && (
            <Link href="/learners" className="nav-link">
              Learners
            </Link>
          )}
          <Link href="/tutors" className="nav-link">
            Find a tutor
          </Link>
          <Link href="/account" className="nav-link">
            Account settings
          </Link>
        </nav>
        <h1 className="text-page-title wrap-anywhere">{title}</h1>
        <p className="mt-4 max-w-prose text-body">
          Local simulation only. Reservations expire after ten minutes and do
          not confirm a lesson.
        </p>
        {workspace === "parent" && learners.length > 1 && (
          <LearnerSelector learners={learners} selected={selectedLearner?.id} />
        )}
        <p className="mt-4 text-small text-muted-foreground">
          Times shown in {data.checkedAt.zone}.
        </p>
        <Link href="/account" className="inline-flex min-h-11 items-center">
          Change time zone in account settings
        </Link>
        <div className="mt-2 text-small text-muted-foreground">
          <details>
            <summary className="min-h-11 cursor-pointer py-2">
              Status checked at
            </summary>
            <LessonTime value={data.checkedAt} />
          </details>
          <DashboardLink href={dashboardHref(workspace, data.query)}>
            Refresh bookings
          </DashboardLink>
        </div>
        {!learners.length ? (
          <section className="mt-8">
            <h2 className="text-item-title">No authorized learner available</h2>
            <p className="mt-2 max-w-prose text-body">
              This account has no eligible local learner profile. Create a
              fictional profile to try the local booking flow.
            </p>
            <div className="mt-4">
              <DashboardLink href="/learners/new">
                Create a local learner
              </DashboardLink>
            </div>
          </section>
        ) : (
          <>
            {next && (
              <section
                className="mt-8 rounded-surface border border-border bg-surface p-4 md:p-6"
                aria-labelledby="next-reservation"
              >
                <h2 id="next-reservation" className="text-item-title">
                  Next simulated reservation
                </h2>
                <div className="mt-4">
                  <LessonTime value={next.when} variant="prominent" />
                </div>
                <p className="mt-4 text-body wrap-anywhere">
                  {next.subjectName} with {next.tutorName}
                </p>
                {workspace === "parent" && (
                  <p className="mt-2 text-body wrap-anywhere">
                    For {next.learner.displayName}
                  </p>
                )}
                <p className="mt-2 text-small">
                  {next.durationMinutes} minutes
                </p>
                <div className="mt-4">
                  <StatusBadge state={next.state} />
                </div>
                <p className="mt-2 max-w-prose text-body">
                  This is a temporary local reservation. Refresh bookings to
                  check its current status.
                </p>
                <p className="mt-4 text-label">Simulation expires at</p>
                <LessonTime value={next.expiry} />
                <div className="mt-4">
                  <ViewBooking row={next} workspace={workspace} />
                </div>
              </section>
            )}
            <section
              id="active"
              className="mt-12"
              aria-labelledby="active-title"
            >
              <h2 id="active-title" className="text-section-title">
                Active simulated reservations
              </h2>
              {!active.length && (
                <p className="mt-4 max-w-prose text-body">
                  No active simulated reservations. Any expired reservation
                  remains in history.
                </p>
              )}
              {next && !agenda.length && (
                <p className="mt-4 text-body">
                  No other active simulated reservations.
                </p>
              )}
              <Agenda rows={agenda} workspace={workspace} />
              {data.activeHasNext && (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center"
                  href={`/bookings?${new URLSearchParams({ scope: workspace === "parent" ? "guardian" : "student", filter: "active", ...(data.query.learner ? { learnerId: data.query.learner } : {}) })}`}
                >
                  View all active reservations
                </Link>
              )}
            </section>
            <section
              id="history"
              className="mt-12"
              aria-labelledby="history-title"
            >
              <h2 id="history-title" className="text-section-title">
                Reservation history
              </h2>
              {!history.length && (
                <p className="mt-4 max-w-prose text-body">
                  {(data.query.historyPage ?? 1) === 1
                    ? "No reservation history yet. Expired simulations appear here with their original scheduled time."
                    : "No history on this page. Use the previous page to return to earlier results."}
                </p>
              )}
              <Agenda rows={history} workspace={workspace} />
              <Pagination data={data} kind="history" />
            </section>
          </>
        )}
        <Link
          href="/learners"
          className="mt-8 inline-flex min-h-11 items-center"
        >
          Your learners
        </Link>
        <DashboardHelp />
        <ExpiryRefresh
          expiresAt={earliestExpiry}
          snapshotAt={data.checkedAt.startAtUtc}
        />
      </div>
    </div>
  );
}
